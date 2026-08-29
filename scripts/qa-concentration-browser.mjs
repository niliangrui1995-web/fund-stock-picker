import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { constants as fileSystemConstants } from "node:fs";
import {
  access,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
} from "node:fs/promises";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryParent = resolve(projectRoot, "..", "..");
const temporaryPrefix = "_tmp_concentration_qa_";
const appPagePaths = new Set(["/research", "/leverage", "/concentration", "/methodology"]);
const payloadBrowserPath = "/data/trading-concentration-dashboard.json";
const manifestBrowserPath = "/data/trading-concentration-dashboard.manifest.json";
const viewports = [
  { name: "desktop-1440", width: 1440, height: 1024 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-320", width: 320, height: 780 },
];
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function describeError(error) {
  return error instanceof Error ? error.message : "未知错误。";
}

function timestampBeijing() {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const fields = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${fields.year}-${fields.month}-${fields.day}T${fields.hour}:${fields.minute}:${fields.second}+08:00`;
}

function isWithinDirectory(directory, candidate) {
  const pathFromDirectory = relative(directory, candidate);
  return (
    pathFromDirectory.length > 0
    && !pathFromDirectory.startsWith("..")
    && !isAbsolute(pathFromDirectory)
  );
}

function isSafeTemporaryRoot(directory) {
  return (
    dirname(directory) === temporaryParent
    && basename(directory).startsWith(temporaryPrefix)
    && isWithinDirectory(temporaryParent, directory)
  );
}

function assertSafeTemporaryDescendant(root, candidate) {
  assertCondition(isSafeTemporaryRoot(root), "临时 QA 根目录不在允许范围内。");
  assertCondition(isWithinDirectory(root, candidate), "临时 QA 子路径越出允许目录。");
}

function runNodeProgram(program, args) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [program, ...args], {
      cwd: projectRoot,
      env: { ...process.env, GOMAXPROCS: "1" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", rejectPromise);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      const details = Buffer.concat([...stdout, ...stderr]).toString("utf8").trim();
      rejectPromise(
        new Error(
          `命令执行失败（退出码 ${code ?? "未知"}${signal ? `，信号 ${signal}` : ""}）${details ? `：${details}` : "。"}`,
        ),
      );
    });
  });
}

async function verifyBuildOutput(directory) {
  await Promise.all([
    access(join(directory, "index.html"), fileSystemConstants.F_OK),
    access(join(directory, payloadBrowserPath.slice(1)), fileSystemConstants.F_OK),
    access(join(directory, manifestBrowserPath.slice(1)), fileSystemConstants.F_OK),
  ]);
  const assets = await readdir(join(directory, "assets"), { withFileTypes: true });
  const assetNames = assets.filter((entry) => entry.isFile()).map((entry) => entry.name);
  const entryChunk = assetNames.find((name) => /^index-.*\.js$/.test(name));
  const concentrationChunk = assetNames.find((name) => /^TradingConcentrationDashboard-.*\.js$/.test(name));
  assertCondition(entryChunk !== undefined, "临时生产构建缺少主入口 JavaScript chunk。");
  assertCondition(concentrationChunk !== undefined, "临时生产构建缺少交易集中度异步 chunk。");
  return { entryChunk, concentrationChunk };
}

function requestPathForStaticRoot(root, requestUrl) {
  const url = new URL(requestUrl ?? "/", "http://127.0.0.1");
  const decodedPath = decodeURIComponent(url.pathname);
  const canonicalPath = decodedPath.replace(/\/+$/, "") || "/";
  if (appPagePaths.has(canonicalPath)) {
    return resolve(root, "index.html");
  }
  const requestedPath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const target = resolve(root, requestedPath);
  return isWithinDirectory(root, target) ? target : null;
}

async function startStaticServer(root, temporaryRoot) {
  const resolvedRoot = resolve(root);
  assertSafeTemporaryDescendant(temporaryRoot, resolvedRoot);
  const server = createServer(async (request, response) => {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" });
      response.end();
      return;
    }

    try {
      const target = requestPathForStaticRoot(resolvedRoot, request.url);
      if (target === null) {
        response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Forbidden");
        return;
      }
      const details = await stat(target);
      if (!details.isFile()) {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not Found");
        return;
      }
      response.writeHead(200, {
        "Content-Type": mimeTypes[extname(target).toLowerCase()] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      });
      if (request.method === "HEAD") {
        response.end();
        return;
      }
      response.end(await readFile(target));
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : null;
      response.writeHead(code === "ENOENT" ? 404 : 500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(code === "ENOENT" ? "Not Found" : "Internal Server Error");
    }
  });

  await new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", rejectPromise);
      resolvePromise();
    });
  });
  const address = server.address();
  assertCondition(address !== null && typeof address !== "string", "本机静态服务未返回端口。");
  return { server, url: `http://127.0.0.1:${address.port}` };
}

async function closeServer(server) {
  await new Promise((resolvePromise, rejectPromise) => {
    server.close((error) => (error ? rejectPromise(error) : resolvePromise()));
  });
}

async function ensureChromium() {
  process.env.PLAYWRIGHT_BROWSERS_PATH = "0";
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error("未发现本工作树的 Playwright 依赖，无法运行交易集中度浏览器 QA。");
  }
  const executablePath = chromium.executablePath();
  try {
    await access(executablePath, fileSystemConstants.F_OK);
  } catch {
    throw new Error("未发现本工作树的 Playwright Chromium，无法运行交易集中度浏览器 QA。");
  }
  return { chromium, executablePath };
}

function observePage(page) {
  const pageErrors = [];
  const consoleErrors = [];
  const requestFailures = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("requestfailed", (request) => {
    requestFailures.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "unknown"}`);
  });
  return { pageErrors, consoleErrors, requestFailures };
}

async function openConcentrationPage(page, baseUrl) {
  const response = await page.goto(`${baseUrl}/concentration`, {
    waitUntil: "domcontentloaded",
    timeout: 30_000,
  });
  assertCondition(response !== null && response.ok(), "交易集中度页面导航未返回成功响应。");
}

async function waitForPaintedChart(page) {
  const chart = page.getByRole("img", {
    name: "成交活跃 A 股前百分之五个股成交额占比与创业板指双轴趋势图",
    exact: true,
  });
  await chart.waitFor({ state: "visible", timeout: 30_000 });
  const canvas = chart.locator("canvas");
  await canvas.waitFor({ state: "visible", timeout: 30_000 });
  assertCondition(await canvas.count() === 1, "交易集中度图表应只渲染一个 canvas。");
  await page.waitForFunction(() => {
    const element = document.querySelector(".concentration-chart-canvas canvas");
    if (!(element instanceof HTMLCanvasElement) || element.width === 0 || element.height === 0) {
      return false;
    }
    const context = element.getContext("2d");
    if (context === null) return false;
    const pixels = context.getImageData(0, 0, element.width, element.height).data;
    let painted = 0;
    for (let index = 3; index < pixels.length; index += 4) {
      if (pixels[index] !== 0 && ++painted >= 100) return true;
    }
    return false;
  }, undefined, { timeout: 30_000 });
  const box = await canvas.boundingBox();
  assertCondition(box !== null && box.width >= 200 && box.height >= 240, "交易集中度 canvas 可视尺寸无效。");
  return { width: Math.round(box.width), height: Math.round(box.height) };
}

async function runViewportScenario(browser, baseUrl, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const observed = observePage(page);
  try {
    await openConcentrationPage(page, baseUrl);
    await page.getByRole("heading", { name: "前 5% 个股成交额占比", exact: true })
      .waitFor({ state: "visible", timeout: 30_000 });

    const summaryCards = page.locator(".concentration-summary-card");
    await summaryCards.first().waitFor({ state: "visible", timeout: 30_000 });
    assertCondition(await summaryCards.count() === 4, "交易集中度关键指标卡应为 4 张。");
    for (const label of ["最新 C5", "较上一交易日", "成交活跃 A 股", "全A等权 AMOUNT"]) {
      const cardLabel = summaryCards.getByText(label, { exact: true });
      assertCondition(await cardLabel.count() === 1, `缺少关键指标卡：${label}。`);
      const card = cardLabel.locator("..");
      assertCondition(await card.isVisible(), `关键指标卡不可见：${label}。`);
      const value = (await card.locator("strong").textContent())?.trim() ?? "";
      assertCondition(value.length > 0, `关键指标卡没有可见数值：${label}。`);
    }

    const periodGroup = page.getByRole("group", { name: "选择时间区间", exact: true });
    await periodGroup.scrollIntoViewIfNeeded();
    const periodButtons = periodGroup.getByRole("button");
    assertCondition(await periodButtons.count() === 5, "时间区间按钮应为 5 个。");
    for (const label of ["1 年", "3 年", "5 年", "10 年", "全部"]) {
      assertCondition(
        await periodGroup.getByRole("button", { name: label, exact: true }).isVisible(),
        `时间区间按钮不可见：${label}。`,
      );
    }

    const rangeLabel = page.locator(".concentration-chart-panel-head span");
    const initialRange = (await rangeLabel.textContent())?.trim() ?? "";
    const oneYearButton = periodGroup.getByRole("button", { name: "1 年", exact: true });
    await oneYearButton.click();
    await page.waitForFunction(() => {
      const button = Array.from(document.querySelectorAll(".concentration-period-toggle button"))
        .find((element) => element.textContent?.trim() === "1 年");
      return button?.getAttribute("aria-pressed") === "true";
    });
    const switchedRange = (await rangeLabel.textContent())?.trim() ?? "";
    assertCondition(initialRange.length > 0 && switchedRange.length > 0, "图表日期范围缺失。");
    assertCondition(initialRange !== switchedRange, "切换到 1 年后图表日期范围没有变化。");

    const canvas = await waitForPaintedChart(page);
    const overflow = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
    }));
    assertCondition(
      overflow.documentScrollWidth <= overflow.clientWidth + 1
        && overflow.bodyScrollWidth <= overflow.clientWidth + 1,
      `视口 ${viewport.width}px 出现横向溢出：${JSON.stringify(overflow)}。`,
    );
    assertCondition(observed.pageErrors.length === 0, `页面异常：${observed.pageErrors.join("；")}`);
    assertCondition(observed.consoleErrors.length === 0, `控制台错误：${observed.consoleErrors.join("；")}`);
    assertCondition(observed.requestFailures.length === 0, `请求失败：${observed.requestFailures.join("；")}`);

    return {
      viewport: `${viewport.width}x${viewport.height}`,
      overflow: false,
      canvas,
      periods: 5,
      range_changed: true,
      runtime_errors: 0,
    };
  } finally {
    await context.close();
  }
}

function isExpectedMockNetworkConsoleError(message) {
  return /Failed to load resource|net::ERR_/i.test(message);
}

async function runErrorScenario(browser, baseUrl, scenario, manifestText) {
  const context = await browser.newContext({
    viewport: { width: 768, height: 900 },
    locale: "zh-CN",
    timezoneId: "Asia/Shanghai",
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  const observed = observePage(page);
  try {
    if (scenario === "http") {
      await page.route(`**${payloadBrowserPath}`, (route) => route.fulfill({
        status: 503,
        contentType: "application/json; charset=utf-8",
        body: "{}",
      }));
    } else if (scenario === "transport") {
      await page.route(`**${payloadBrowserPath}`, (route) => route.abort("connectionfailed"));
    } else if (scenario === "validation") {
      const manifest = JSON.parse(manifestText);
      manifest.payload_sha256 = "0".repeat(64);
      await page.route(`**${manifestBrowserPath}`, (route) => route.fulfill({
        status: 200,
        contentType: "application/json; charset=utf-8",
        body: JSON.stringify(manifest),
      }));
    } else {
      throw new Error(`未知错误场景：${scenario}`);
    }

    await openConcentrationPage(page, baseUrl);
    const expectedHeading = scenario === "validation" ? "数据包未通过校验" : "数据读取失败";
    const heading = page.getByRole("heading", { name: expectedHeading, exact: true });
    await heading.waitFor({ state: "visible", timeout: 30_000 });
    const reason = (await heading.locator("xpath=following-sibling::p[1]").textContent())?.trim() ?? "";
    assertCondition(reason.length > 0, `${scenario} 场景未显示可见原因。`);
    if (scenario === "http") {
      assertCondition(reason === "交易集中度静态数据包不存在或无法读取。", `HTTP 错误原因不正确：${reason}`);
    }
    if (scenario === "validation") {
      assertCondition(reason === "交易集中度发布包 SHA-256 校验失败。", `坏校验包原因不正确：${reason}`);
    }
    assertCondition(observed.pageErrors.length === 0, `${scenario} 场景出现 pageerror：${observed.pageErrors.join("；")}`);
    const unexpectedConsoleErrors = observed.consoleErrors.filter(
      (message) => !isExpectedMockNetworkConsoleError(message),
    );
    assertCondition(
      unexpectedConsoleErrors.length === 0,
      `${scenario} 场景出现非预期控制台错误：${unexpectedConsoleErrors.join("；")}`,
    );
    if (scenario === "validation") {
      assertCondition(observed.consoleErrors.length === 0, `坏校验包场景出现控制台错误：${observed.consoleErrors.join("；")}`);
      assertCondition(observed.requestFailures.length === 0, `坏校验包场景出现请求失败：${observed.requestFailures.join("；")}`);
    }

    return {
      heading: expectedHeading,
      reason,
      page_errors: 0,
      unexpected_console_errors: 0,
    };
  } finally {
    await context.close();
  }
}

const result = {
  schema_version: "1",
  generated_at_beijing: timestampBeijing(),
  status: "running",
  build: null,
  preview: null,
  viewports: {},
  error_semantics: {},
  cleanup: {
    browser_closed: false,
    server_closed: false,
    temporary_root_removed: false,
  },
  failure: null,
};

let temporaryRoot = null;
let browser = null;
let staticServer = null;
let terminalError = null;

try {
  temporaryRoot = await mkdtemp(join(temporaryParent, temporaryPrefix));
  assertCondition(isSafeTemporaryRoot(temporaryRoot), "临时 QA 目录不在 D:\\ 根目录的允许范围内。");
  const buildDirectory = join(temporaryRoot, "dist");
  assertSafeTemporaryDescendant(temporaryRoot, buildDirectory);

  await runNodeProgram(resolve(projectRoot, "node_modules", "typescript", "bin", "tsc"), ["--noEmit"]);
  await runNodeProgram(resolve(projectRoot, "node_modules", "vite", "bin", "vite.js"), [
    "build",
    "--outDir",
    buildDirectory,
    "--emptyOutDir",
  ]);
  const chunks = await verifyBuildOutput(buildDirectory);
  result.build = {
    command: "tsc --noEmit + vite build --outDir <temporary>",
    GOMAXPROCS: "1",
    entry_chunk: chunks.entryChunk,
    concentration_chunk: chunks.concentrationChunk,
  };

  staticServer = await startStaticServer(buildDirectory, temporaryRoot);
  result.preview = {
    host: "127.0.0.1",
    port: Number(new URL(staticServer.url).port),
  };

  const playwright = await ensureChromium();
  browser = await playwright.chromium.launch({ headless: true });
  for (const viewport of viewports) {
    result.viewports[viewport.name] = await runViewportScenario(browser, staticServer.url, viewport);
  }

  const manifestText = await readFile(join(buildDirectory, manifestBrowserPath.slice(1)), "utf8");
  for (const scenario of ["http", "transport", "validation"]) {
    result.error_semantics[scenario] = await runErrorScenario(
      browser,
      staticServer.url,
      scenario,
      manifestText,
    );
  }
  result.status = "passed";
} catch (error) {
  terminalError = error;
  result.status = "failed";
  result.failure = describeError(error);
} finally {
  if (browser !== null) {
    try {
      await browser.close();
      result.cleanup.browser_closed = true;
    } catch (error) {
      terminalError ??= error;
      result.status = "failed";
      result.failure ??= `浏览器关闭失败：${describeError(error)}`;
    }
  } else {
    result.cleanup.browser_closed = true;
  }

  if (staticServer !== null) {
    try {
      await closeServer(staticServer.server);
      result.cleanup.server_closed = true;
    } catch (error) {
      terminalError ??= error;
      result.status = "failed";
      result.failure ??= `本机服务关闭失败：${describeError(error)}`;
    }
  } else {
    result.cleanup.server_closed = true;
  }

  if (temporaryRoot !== null) {
    try {
      assertCondition(isSafeTemporaryRoot(temporaryRoot), "拒绝删除未验证的临时 QA 目录。");
      await rm(temporaryRoot, { recursive: true, force: true });
      try {
        await access(temporaryRoot, fileSystemConstants.F_OK);
        throw new Error("临时 QA 目录删除后仍存在。");
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
          result.cleanup.temporary_root_removed = true;
        } else {
          throw error;
        }
      }
    } catch (error) {
      terminalError ??= error;
      result.status = "failed";
      result.failure ??= `临时 QA 目录清理失败：${describeError(error)}`;
    }
  }
}

if (
  result.status === "passed"
  && (!result.cleanup.browser_closed || !result.cleanup.server_closed || !result.cleanup.temporary_root_removed)
) {
  terminalError ??= new Error("QA 清理状态不完整。");
  result.status = "failed";
  result.failure = describeError(terminalError);
}

console.log(JSON.stringify(result, null, 2));
if (terminalError !== null || result.status !== "passed") {
  process.exitCode = 1;
}
