import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { access, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { constants as fileSystemConstants } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tempParent = resolve(projectRoot, "..", "..");
const tempPrefix = "_tmp_research_qa_";
const appPaths = new Set(["/", "/research", "/leverage", "/methodology"]);
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

function assertCondition(condition, message) {
  assert.equal(Boolean(condition), true, message);
}

function isWithinDirectory(directory, candidate) {
  const pathFromDirectory = relative(directory, candidate);
  return pathFromDirectory.length > 0 && !pathFromDirectory.startsWith("..") && !isAbsolute(pathFromDirectory);
}

function isSafeTemporaryRoot(directory) {
  return (
    dirname(directory) === tempParent &&
    basename(directory).startsWith(tempPrefix) &&
    isWithinDirectory(tempParent, directory)
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
      stdio: "inherit",
    });
    child.once("error", rejectPromise);
    child.once("exit", (code) => {
      if (code === 0) {
        resolvePromise();
      } else {
        rejectPromise(new Error(`命令执行失败（退出码 ${code ?? "未知"}）。`));
      }
    });
  });
}

function requestPathForStaticRoot(root, requestUrl) {
  const url = new URL(requestUrl ?? "/", "http://127.0.0.1");
  const decodedPath = decodeURIComponent(url.pathname);
  const canonicalPath = decodedPath.replace(/\/+$/, "") || "/";
  if (appPaths.has(canonicalPath)) {
    return resolve(root, "index.html");
  }
  const requested = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const target = resolve(root, requested);
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

function closeServer(server) {
  return new Promise((resolvePromise, rejectPromise) => {
    server.close((error) => (error ? rejectPromise(error) : resolvePromise()));
  });
}

async function assertNoPageOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  assertCondition(
    metrics.documentWidth <= metrics.viewportWidth,
    `${label}出现页面级横向溢出：${metrics.documentWidth}px > ${metrics.viewportWidth}px。`,
  );
  return metrics;
}

async function assertScreenshot(page, label) {
  const image = await page.screenshot({ animations: "disabled" });
  assertCondition(image.subarray(0, 8).equals(pngSignature), `${label}截图不是有效 PNG。`);
  return image.length;
}

async function waitForSelectedResult(page, expectedCode) {
  const title = page.locator("#stock-result-title");
  await title.waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForFunction(
    (code) => document.querySelector("#stock-result-title")?.textContent?.includes(code),
    expectedCode,
    { timeout: 10_000 },
  );
  return title;
}

async function assertResultFocusedAndVisible(page, title, label) {
  await page.waitForFunction(
    () => document.activeElement?.id === "stock-result-title",
    undefined,
    { timeout: 10_000 },
  );
  const focusId = await page.evaluate(() => document.activeElement?.id ?? "");
  assert.equal(focusId, "stock-result-title", `${label}后结果标题没有获得焦点。`);
  const box = await title.boundingBox();
  const viewport = page.viewportSize();
  assertCondition(box !== null && viewport !== null, `${label}后结果标题没有可用边界。`);
  assertCondition(
    box.y >= 0 && box.y < viewport.height,
    `${label}后结果标题未进入当前视口。`,
  );
}

async function waitForActiveClass(page, className, label) {
  await page.waitForFunction(
    (expectedClassName) => document.activeElement?.classList.contains(expectedClassName),
    className,
    { timeout: 10_000 },
  );
  assert.equal(
    await page.evaluate(() => document.activeElement?.className ?? ""),
    className,
    `${label}焦点目标不正确。`,
  );
}

async function selectWithKeyboard(page, query, expectedCode) {
  const input = page.getByRole("combobox", { name: "搜索股票名称或代码" });
  await input.fill(query);
  await page.getByRole("listbox", { name: "搜索建议" }).waitFor({ state: "visible", timeout: 10_000 });
  await input.press("ArrowDown");
  const activeId = await input.getAttribute("aria-activedescendant");
  assertCondition(activeId, "下方向键未激活搜索建议。");
  await input.press("Enter");
  const title = await waitForSelectedResult(page, expectedCode);
  await assertResultFocusedAndVisible(page, title, `键盘选择 ${query}`);
}

async function testDesktop(browser, baseUrl, result) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1024 },
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  await context.addInitScript(() => {
    window.turnstile = {
      render(container, options) {
        const widget = document.createElement("div");
        const widgetId = "qa-turnstile-widget";
        widget.dataset.qaTurnstile = widgetId;
        widget.textContent = "QA Turnstile";
        container.appendChild(widget);
        queueMicrotask(() => options.callback("qa-turnstile-token"));
        return widgetId;
      },
      reset() {},
      remove(widgetId) {
        document.querySelector(`[data-qa-turnstile="${widgetId}"]`)?.remove();
      },
    };
  });
  const requests = [];
  const failedResources = [];
  context.on("request", (request) => requests.push(request.url()));
  context.on("response", (response) => {
    if (response.status() >= 400) {
      failedResources.push({ status: response.status(), url: response.url() });
    }
  });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/research?q=NVDA`, { waitUntil: "domcontentloaded" });
    const title = await waitForSelectedResult(page, "NVDA");
    await assertResultFocusedAndVisible(page, title, "深链直达");
    await selectWithKeyboard(page, "TSM", "TSM");

    const hotCard = page.locator(".ai-hotspot-main").first();
    const hotCode = (await hotCard.locator("em").innerText()).trim();
    await hotCard.click();
    const hotTitle = await waitForSelectedResult(page, hotCode);
    await assertResultFocusedAndVisible(page, hotTitle, "热点入口选择");

    const feedbackTrigger = page.locator(".feedback-trigger");
    await feedbackTrigger.click();
    const dialog = page.getByRole("dialog", { name: "意见反馈" });
    await dialog.waitFor({ state: "visible", timeout: 10_000 });
    await page.locator("[data-qa-turnstile='qa-turnstile-widget']").waitFor({ state: "visible", timeout: 10_000 });
    await page.waitForFunction(
      () => !document.querySelector(".feedback-submit")?.hasAttribute("disabled"),
      undefined,
      { timeout: 10_000 },
    );
    await waitForActiveClass(page, "feedback-close", "反馈弹层初始");
    await page.keyboard.press("Shift+Tab");
    await waitForActiveClass(page, "feedback-submit", "反馈弹层 Shift+Tab");
    await page.keyboard.press("Tab");
    await waitForActiveClass(page, "feedback-close", "反馈弹层 Tab");
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden", timeout: 10_000 });
    await waitForActiveClass(page, "feedback-trigger", "反馈弹层关闭后");

    result.desktop = {
      overflow: await assertNoPageOverflow(page, "1440px 桌面页"),
      screenshotBytes: await assertScreenshot(page, "1440px 桌面页"),
      externalRequests: requests.filter((url) => !url.startsWith(baseUrl)),
      failedResources,
    };
    assert.equal(result.desktop.externalRequests.length, 0, "研究页出现了非本机资源请求。");
    assert.deepEqual(result.desktop.failedResources, [], "研究页存在失败资源请求。");
    assertCondition(
      !requests.some((url) => /echarts|LeverageDashboard/i.test(url)),
      "研究页首屏错误加载了两融图表资源。",
    );
  } finally {
    await context.close();
  }
}

async function testMobileInteractions(browser, baseUrl, result) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    colorScheme: "light",
    reducedMotion: "reduce",
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/research?stock=NVDA`, { waitUntil: "domcontentloaded" });
    await waitForSelectedResult(page, "NVDA");

    const collapsedCards = await page.locator(".ai-hotspot-card").evaluateAll((cards) =>
      cards.filter((card) => getComputedStyle(card).display !== "none").length,
    );
    assert.equal(collapsedCards, 3, "390px 下热点默认不应超过三张。");
    const expandButton = page.locator(".ai-hotspot-expand-toggle");
    await expandButton.waitFor({ state: "visible", timeout: 10_000 });
    await expandButton.click();
    const expandedCards = await page.locator(".ai-hotspot-card").evaluateAll((cards) =>
      cards.filter((card) => getComputedStyle(card).display !== "none").length,
    );
    assertCondition(expandedCards > collapsedCards, "热点展开按钮没有显示其余热点。 ");

    const hint = page.locator(".table-scroll-hint").first();
    await hint.waitFor({ state: "visible", timeout: 10_000 });
    assert.match(await hint.innerText(), /左右滑动/, "移动端表格缺少横向浏览提示。");
    const stickyPositions = await page.locator(".table-wrap th").evaluateAll((headers) =>
      headers.slice(0, 2).map((header) => getComputedStyle(header).position),
    );
    assert.deepEqual(stickyPositions, ["sticky", "sticky"], "移动端表格前两列未固定。 ");

    const touchTargets = await page.locator(".topbar-nav a, .market-shortcut").evaluateAll((elements) =>
      elements.map((element) => ({ text: element.textContent?.trim(), height: element.getBoundingClientRect().height })),
    );
    touchTargets.forEach((target) => {
      assertCondition(target.height >= 44, `${target.text}的移动端触控高度不足 44px。`);
    });

    const fundAction = page.locator(".fund-holdings-action").first();
    await fundAction.scrollIntoViewIfNeeded();
    await fundAction.click();
    const fundDialog = page.getByRole("dialog");
    await fundDialog.waitFor({ state: "visible", timeout: 10_000 });
    assert.equal(await fundDialog.getAttribute("aria-labelledby"), "fund-holdings-title", "基金明细弹层缺少标题关联。");
    await waitForActiveClass(page, "hover-card-close", "基金明细弹层初始");
    await page.keyboard.press("Escape");
    await fundDialog.waitFor({ state: "hidden", timeout: 10_000 });
    await waitForActiveClass(page, "fund-holdings-action", "基金明细弹层关闭后");

    result.mobile390 = {
      overflow: await assertNoPageOverflow(page, "390px 移动页"),
      collapsedCards,
      expandedCards,
      screenshotBytes: await assertScreenshot(page, "390px 移动页"),
    };
  } finally {
    await context.close();
  }
}

async function testViewport(browser, baseUrl, width, result) {
  const context = await browser.newContext({
    viewport: { width, height: 900 },
    colorScheme: "light",
    reducedMotion: "reduce",
    isMobile: width <= 390,
    hasTouch: width <= 390,
  });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/research?stock=NVDA`, { waitUntil: "domcontentloaded" });
    await waitForSelectedResult(page, "NVDA");
    result[`viewport${width}`] = {
      overflow: await assertNoPageOverflow(page, `${width}px 页面`),
      screenshotBytes: await assertScreenshot(page, `${width}px 页面`),
    };
  } finally {
    await context.close();
  }
}

async function verifyBuildOutput(previewDirectory) {
  const assetDirectory = join(previewDirectory, "assets");
  const assetNames = (await readdir(assetDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
  assertCondition(assetNames.some((name) => /^index-.*\.js$/.test(name)), "临时构建缺少主入口 chunk。 ");
  assertCondition(assetNames.some((name) => /^LeverageDashboard-.*\.js$/.test(name)), "临时构建缺少两融异步 chunk。 ");
  return assetNames.filter((name) => /^(index|react-vendor|icons|LeverageDashboard|echarts)-.*\.js$/.test(name));
}

let temporaryRoot = null;
let server = null;
let browser = null;
let terminalError = null;
const result = {
  status: "running",
  command: "npm run qa:research",
  build: null,
  scenarios: {},
  cleanup: { serverClosed: false, temporaryRootRemoved: false },
  failure: null,
};

try {
  temporaryRoot = await mkdtemp(join(tempParent, tempPrefix));
  assertCondition(isSafeTemporaryRoot(temporaryRoot), "临时 QA 目录不在 D:\\vcp_hunter 范围内。");
  const previewDirectory = join(temporaryRoot, "preview");
  assertSafeTemporaryDescendant(temporaryRoot, previewDirectory);
  await runNodeProgram(resolve(projectRoot, "node_modules", "vite", "bin", "vite.js"), [
    "build",
    "--outDir",
    previewDirectory,
    "--emptyOutDir",
  ]);
  result.build = { chunks: await verifyBuildOutput(previewDirectory), seoGeneration: false };

  await access(chromePath, fileSystemConstants.F_OK);
  const { chromium } = await import("playwright");
  browser = await chromium.launch({ headless: true, executablePath: chromePath });
  server = await startStaticServer(previewDirectory, temporaryRoot);
  await testDesktop(browser, server.url, result.scenarios);
  await testMobileInteractions(browser, server.url, result.scenarios);
  await testViewport(browser, server.url, 320, result.scenarios);
  await testViewport(browser, server.url, 768, result.scenarios);
  result.status = "passed";
} catch (error) {
  terminalError = error;
  result.status = "failed";
  result.failure = error instanceof Error ? error.message : "未知错误。";
} finally {
  try {
    if (browser !== null) await browser.close();
    if (server !== null) await closeServer(server.server);
    result.cleanup.serverClosed = true;
  } catch (error) {
    terminalError ??= error;
    result.status = "failed";
    result.failure ??= `本机服务或浏览器关闭失败：${error instanceof Error ? error.message : "未知错误。"}`;
  }
  try {
    if (temporaryRoot !== null) {
      assertCondition(isSafeTemporaryRoot(temporaryRoot), "拒绝删除未验证的临时 QA 目录。");
      await rm(temporaryRoot, { recursive: true, force: true });
      try {
        await access(temporaryRoot, fileSystemConstants.F_OK);
        throw new Error("临时 QA 目录删除后仍存在。 ");
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
          result.cleanup.temporaryRootRemoved = true;
        } else {
          throw error;
        }
      }
    }
  } catch (error) {
    terminalError ??= error;
    result.status = "failed";
    result.failure ??= `临时 QA 目录清理失败：${error instanceof Error ? error.message : "未知错误。"}`;
  }
}

console.log(JSON.stringify(result, null, 2));
if (terminalError !== null || result.status !== "passed") {
  process.exitCode = 1;
}
