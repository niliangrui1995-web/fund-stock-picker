import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import {
  access,
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { constants as fileSystemConstants } from "node:fs";
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

import { verifyLeverageDashboard } from "./verify-leverage-dashboard.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tempParent = resolve(projectRoot, "..", "..");
const tempPrefix = "_tmp_leverage_qa_";
const formalDataDirectory = resolve(projectRoot, "public", "data");
const screenshotDirectory = resolve(projectRoot, "design-qa-assets");
const resultPath = join(screenshotDirectory, "leverage-browser-qa-result.json");
const qaScrollTop = 3960;
const sourceSwitchDate = "2017-01-03";
const officialUnavailableMixedReviewStatus =
  "mixed_official_pre2017_unavailable_eastmoney_vendor_unverified";
const mxUnavailableMixedReviewStatus =
  "mixed_mx_pre2017_unavailable_eastmoney_vendor_unverified";
const ratioUnavailableReason = "QA 临时包：全部精确同日市值分母不可用，因此比例模式已禁用。";
const appPagePaths = new Set(["/research", "/leverage", "/methodology"]);
const dataFiles = [
  "leverage-dashboard.json",
  "leverage-dashboard.manifest.json",
];
const screenshotFiles = [
  "leverage-default-desktop.png",
  "leverage-ratio-desktop.png",
  "leverage-mobile.png",
  "leverage-blocked.png",
];
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
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
    pathFromDirectory.length > 0 &&
    !pathFromDirectory.startsWith("..") &&
    !isAbsolute(pathFromDirectory)
  );
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

async function fileSha256(path) {
  const text = await readFile(path);
  return createHash("sha256").update(text).digest("hex");
}

async function snapshotFormalData() {
  const hashes = {};
  for (const filename of dataFiles) {
    const path = join(formalDataDirectory, filename);
    const details = await stat(path);
    assertCondition(details.isFile(), `正式发布包不是文件：${filename}`);
    hashes[filename] = await fileSha256(path);
  }
  return hashes;
}

async function readFormalDataBounds() {
  const payloadPath = join(formalDataDirectory, "leverage-dashboard.json");
  const manifestPath = join(formalDataDirectory, "leverage-dashboard.manifest.json");
  const [payload, manifest] = await Promise.all([
    readFile(payloadPath, "utf8").then(JSON.parse),
    readFile(manifestPath, "utf8").then(JSON.parse),
  ]);
  const cutoff = manifest?.data_range?.end;
  const ratioRange = payload?.provenance?.ratio_data_range;
  assertCondition(
    typeof cutoff === "string" && /^\d{4}-\d{2}-\d{2}$/.test(cutoff),
    "正式发布清单 data_range.end 无效。",
  );
  assertCondition(
    payload?.provenance?.ratio_available === true &&
      ratioRange !== null &&
      typeof ratioRange?.start === "string" &&
      typeof ratioRange?.end === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(ratioRange.start) &&
      /^\d{4}-\d{2}-\d{2}$/.test(ratioRange.end) &&
      ratioRange.start <= ratioRange.end,
    "正式发布包比例日期范围无效。",
  );
  const sourceSegments = manifest?.market_cap?.source_segments;
  assertCondition(Array.isArray(sourceSegments), "正式发布清单市值来源分段无效。");
  const hasAuditedPre2017Segment = sourceSegments.some(
    (segment) =>
      segment?.market_cap_source === "official_exchange_pre2017_raw_chain_audited" &&
      segment?.market_cap_review_status === "official_exchange_pre2017_raw_chain_audited" &&
      segment?.ratio_available === true,
  );
  const hasMxPre2017Segment = sourceSegments.some(
    (segment) =>
      segment?.market_cap_source === "mx_pre2017_vendor_unverified" &&
      segment?.market_cap_review_status === "mx_vendor_unverified" &&
      segment?.ratio_available === true,
  );
  const hasUnavailablePre2017Segment = sourceSegments.some(
    (segment) =>
      segment?.market_cap_source === "pre2017_official_unavailable" ||
      segment?.market_cap_source === "pre2017_mx_vendor_unavailable",
  );
  const marketCapSourceText = hasAuditedPre2017Segment
    ? "市值来源：交易所历史数据（2011–2016）· 东方财富 Choice（2017 年起）。"
    : hasMxPre2017Segment
      ? "市值来源：东方财富妙想厂商数据（2011–2016）· 东方财富 Choice（2017 年起）。"
      : hasUnavailablePre2017Segment
        ? "市值来源：2011–2016 暂缺 · 东方财富 Choice（2017 年起）。"
        : "市值来源：2011–2016 待更新 · 东方财富 Choice（2017 年起）。";
  return {
    dataCutoff: cutoff,
    ratioStart: ratioRange.start,
    ratioEnd: ratioRange.end,
    marketCapSourceText,
  };
}

function assertEqualObject(actual, expected, message) {
  assert.deepEqual(actual, expected, message);
}

function runNodeProgram(program, args, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(process.execPath, [program, ...args], {
      cwd: projectRoot,
      env: options.env ?? process.env,
      stdio: "inherit",
    });
    child.once("error", rejectPromise);
    child.once("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      rejectPromise(new Error(`命令执行失败（退出码 ${code ?? "未知"}）。`));
    });
  });
}

async function verifyBuildOutput(directory) {
  const assetsDirectory = join(directory, "assets");
  const assets = await readdir(assetsDirectory, { withFileTypes: true });
  const assetNames = assets.filter((entry) => entry.isFile()).map((entry) => entry.name);
  const entryName = assetNames.find((name) => /^index-.*\.js$/.test(name));
  const leverageName = assetNames.find((name) => /^LeverageDashboard-.*\.js$/.test(name));

  assertCondition(entryName !== undefined, "临时 QA 构建缺少主入口 JavaScript chunk。");
  assertCondition(leverageName !== undefined, "临时 QA 构建缺少独立两融异步 chunk。");

  const entryText = await readFile(join(assetsDirectory, entryName), "utf8");
  assertCondition(
    entryText.includes(leverageName),
    "临时 QA 构建主入口未以动态 import 引用两融异步 chunk。",
  );
  return { entryName, leverageName };
}

async function copyFormalDataToPreview(previewDirectory, expectedHashes) {
  const previewDataDirectory = join(previewDirectory, "data");
  assertSafeTemporaryDescendant(temporaryRoot, previewDataDirectory);
  await mkdir(previewDataDirectory, { recursive: true });
  for (const filename of dataFiles) {
    const source = join(formalDataDirectory, filename);
    const target = join(previewDataDirectory, filename);
    assertSafeTemporaryDescendant(temporaryRoot, target);
    await copyFile(source, target);
    assertCondition(
      (await fileSha256(target)) === expectedHashes[filename],
      `临时预览中的 ${filename} 与正式发布包哈希不一致。`,
    );
  }
}

async function mutateBadManifest(badDirectory) {
  const manifestPath = join(badDirectory, "data", "leverage-dashboard.manifest.json");
  assertSafeTemporaryDescendant(temporaryRoot, manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assertCondition(
    typeof manifest.payload_sha256 === "string" && /^[a-f0-9]{64}$/.test(manifest.payload_sha256),
    "坏包副本原 payload_sha256 无效。",
  );
  manifest.payload_sha256 = "0".repeat(64);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  return manifest.payload_sha256;
}

async function createRatioUnavailablePackage(previewDirectory) {
  const payloadPath = join(previewDirectory, "data", "leverage-dashboard.json");
  const manifestPath = join(previewDirectory, "data", "leverage-dashboard.manifest.json");
  assertSafeTemporaryDescendant(temporaryRoot, payloadPath);
  assertSafeTemporaryDescendant(temporaryRoot, manifestPath);

  const payload = JSON.parse(await readFile(payloadPath, "utf8"));
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assertCondition(Array.isArray(payload?.records) && payload.records.length > 0, "比例不可用临时包记录为空。");
  assertCondition(
    payload?.provenance !== null && typeof payload.provenance === "object",
    "比例不可用临时包缺少 provenance。",
  );
  assertCondition(
    manifest?.market_cap !== null && typeof manifest.market_cap === "object",
    "比例不可用临时包缺少 market_cap。",
  );
  const hasOfficialPre2017Records = payload.records.some(
    (record) =>
      record.date < sourceSwitchDate &&
      record.market_cap_source === "official_exchange_pre2017_raw_chain_audited",
  );
  const hasMxPre2017Records = payload.records.some(
    (record) =>
      record.date < sourceSwitchDate &&
      record.market_cap_source === "mx_pre2017_vendor_unverified",
  );
  const usesMxPre2017Schema =
    hasMxPre2017Records ||
    Object.hasOwn(payload.provenance, "mx_pre2017_chain_status") ||
    Object.hasOwn(manifest.market_cap, "mx_pre2017");

  for (const record of payload.records) {
    assertCondition(record !== null && typeof record === "object", "比例不可用临时包存在无效记录。");
    record.denominator_market_cap_yi = null;
    record.ratio_pct = null;
    if (record.date < sourceSwitchDate) {
      if (record.market_cap_source === "official_exchange_pre2017_raw_chain_audited") {
        record.market_cap_source = "pre2017_official_unavailable";
        record.market_cap_review_status = "unavailable";
      } else if (record.market_cap_source === "mx_pre2017_vendor_unverified") {
        record.market_cap_source = "pre2017_mx_vendor_unavailable";
        record.market_cap_review_status = "unavailable";
      }
    } else if (record.date >= sourceSwitchDate) {
      record.market_cap_review_status = "unavailable";
    }
  }

  const emptyRatioRange = { start: null, end: null };
  payload.provenance.ratio_available = false;
  payload.provenance.ratio_unavailable_reason = ratioUnavailableReason;
  payload.provenance.ratio_scope_warning = usesMxPre2017Schema
    ? "QA 临时包：2011–2016 东方财富妙想前段与 2017 年后东方财富 Choice 分母均改为 N/A；两段厂商口径均未经交易所复核、未经完整审计，分子可能含非 A 股融资标的。"
    : "QA 临时包：2011–2016 官方前段与 2017 年后东方财富分母均改为 N/A；东方财富Choice厂商口径仍未经交易所复核、未经完整审计，分子可能含非 A 股融资标的。";
  payload.provenance.ratio_data_range = emptyRatioRange;
  manifest.market_cap.ratio_available = false;
  manifest.market_cap.reason = ratioUnavailableReason;
  manifest.market_cap.ratio_data_range = emptyRatioRange;
  manifest.market_cap.ratio_missing_records = payload.records.length;
  manifest.market_cap.source_segments = manifest.market_cap.source_segments.map((segment) => ({
    ...segment,
    market_cap_source:
      segment.start < sourceSwitchDate
        ? hasMxPre2017Records
          ? "pre2017_mx_vendor_unavailable"
          : hasOfficialPre2017Records
            ? "pre2017_official_unavailable"
            : segment.market_cap_source
        : segment.market_cap_source,
    market_cap_review_status: "unavailable",
    ratio_available: false,
    reason: ratioUnavailableReason,
  }));
  if (payload.provenance.official_pre2017_chain_status === "available") {
    payload.provenance.official_pre2017_chain_status = "unavailable";
    payload.provenance.official_pre2017_unavailable_reason = ratioUnavailableReason;
    manifest.market_cap.official_pre2017 = {
      available: false,
      reason: ratioUnavailableReason,
      table_sha256: null,
      raw_chain_status: "blocked",
      financial_evidence_audit: {
        applicable: false,
        status: "N/A",
        reason_code: "UNSUPPORTED_RATIO_CONTRACT",
      },
    };
    manifest.market_cap.ratio_review_status = officialUnavailableMixedReviewStatus;
  }
  if (usesMxPre2017Schema) {
    payload.provenance.mx_pre2017_chain_status = "unavailable";
    payload.provenance.mx_pre2017_unavailable_reason = ratioUnavailableReason;
    manifest.market_cap.mx_pre2017 = {
      available: false,
      reason: ratioUnavailableReason,
      table_sha256: null,
      raw_response_sha256: null,
      date_contract_status: "blocked",
      financial_evidence_audit: {
        applicable: false,
        status: "N/A",
        reason_code: "UNSUPPORTED_RATIO_CONTRACT",
      },
    };
    delete payload.provenance.official_pre2017_chain_status;
    delete payload.provenance.official_pre2017_unavailable_reason;
    delete manifest.market_cap.official_pre2017;
    manifest.market_cap.ratio_review_status = mxUnavailableMixedReviewStatus;
  }

  const payloadText = `${JSON.stringify(payload, null, 2)}\n`;
  manifest.payload_sha256 = createHash("sha256").update(payloadText, "utf8").digest("hex");
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
  const summary = verifyLeverageDashboard(payloadText, manifestText);
  assertCondition(summary.ratioAvailable === false, "比例不可用临时包仍被标记为可用。");
  assertCondition(summary.ratioMissingRecords === summary.recordCount, "比例不可用临时包缺失统计不完整。");
  assertCondition(payload.records.every((record) => record.ratio_pct === null), "比例不可用临时包仍含比例数值。");
  assert.deepEqual(payload.provenance.ratio_data_range, emptyRatioRange, "比例不可用 payload 日期范围无效。");
  assert.deepEqual(manifest.market_cap.ratio_data_range, emptyRatioRange, "比例不可用 manifest 日期范围无效。");
  assertCondition(
    payload.provenance.ratio_unavailable_reason === manifest.market_cap.reason,
    "比例不可用临时包的 payload 与 manifest 原因不一致。",
  );

  await writeFile(payloadPath, payloadText, "utf8");
  await writeFile(manifestPath, manifestText, "utf8");
  return {
    reason: ratioUnavailableReason,
    data_cutoff: summary.lastDate,
    ratio_available: false,
    all_ratio_pct_null: true,
    ratio_data_range: emptyRatioRange,
    manifest_reason: manifest.market_cap.reason,
    payload_records: summary.recordCount,
    ratio_missing_records: summary.ratioMissingRecords,
    payload_sha256: manifest.payload_sha256,
  };
}

function requestPathForStaticRoot(root, requestUrl) {
  const url = new URL(requestUrl ?? "/", "http://127.0.0.1");
  const decoded = decodeURIComponent(url.pathname);
  const canonicalPath = decoded.replace(/\/+$/, "") || "/";
  if (appPagePaths.has(canonicalPath)) {
    return resolve(root, "index.html");
  }
  const requested = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  const target = resolve(root, requested);
  if (!isWithinDirectory(root, target)) {
    return null;
  }
  return target;
}

async function startStaticServer(root) {
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
      const extension = extname(target).toLowerCase();
      const headers = {
        "Content-Type": mimeTypes[extension] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      };
      response.writeHead(200, headers);
      if (request.method === "HEAD") {
        response.end();
        return;
      }
      response.end(await readFile(target));
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? error.code : null;
      if (code === "ENOENT") {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not Found");
        return;
      }
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Internal Server Error");
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
  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
  };
}

async function closeServer(server) {
  await new Promise((resolvePromise, rejectPromise) => {
    server.close((error) => (error ? rejectPromise(error) : resolvePromise()));
  });
}

async function ensureChromium() {
  // 固定到本工作树 node_modules，避免继承用户机器上某个手工安装的浏览器缓存。
  process.env.PLAYWRIGHT_BROWSERS_PATH = "0";
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error(
      "未发现本工作树的 Playwright 依赖。QA runner 为离线验收，不会自动下载依赖或浏览器；请由用户或受控环境预先准备本地 Playwright Chromium 后再运行 npm run qa:leverage。",
    );
  }
  const executablePath = chromium.executablePath();
  try {
    await access(executablePath, fileSystemConstants.F_OK);
  } catch {
    throw new Error(
      "未发现本工作树的 Playwright Chromium。QA runner 为离线验收，不会自动下载浏览器；请由用户或受控环境预先准备本地 Chromium 后再运行 npm run qa:leverage。",
    );
  }
  return { chromium, executablePath };
}

function textContains(text, expected, label) {
  assertCondition(text.includes(expected), `${label}应包含“${expected}”，实际为：“${text}”。`);
}

async function waitForReadyDashboard(page) {
  await page
    .getByRole("heading", { name: "两融数据" })
    .waitFor({ state: "visible", timeout: 30_000 });
  await page.locator(".leverage-chart-canvas").waitFor({ state: "visible", timeout: 30_000 });
}

async function openDataDisclosure(page) {
  const details = page.locator(".leverage-disclosure details");
  await details.waitFor({ state: "visible", timeout: 30_000 });
  if (!(await details.evaluate((element) => element.open))) {
    await page.locator(".leverage-disclosure summary").click();
  }
  return details;
}

async function moveToMidChartAndReadTooltip(page) {
  const chart = page.locator(".leverage-chart-canvas");
  await chart.scrollIntoViewIfNeeded();
  const box = await chart.boundingBox();
  assertCondition(box !== null, "两融图表未获得可用边界框。");
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45);
  await page.waitForTimeout(300);
  return { chart, box, tooltip: await chart.innerText() };
}

async function runDesktopScenario(
  browser,
  result,
  baseUrl,
  dataCutoff,
  ratioRange,
  marketCapSourceText,
) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1024 },
    deviceScaleFactor: 1,
    colorScheme: "light",
  });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/research`, { waitUntil: "domcontentloaded" });
    await page.locator(".search-zone").waitFor({ state: "visible", timeout: 30_000 });
    assert.equal(await page.locator(".leverage-dashboard").count(), 0, "研究页不应渲染两融面板。");
    assert.equal(
      await page.getByRole("link", { name: "研究", exact: true }).getAttribute("aria-current"),
      "page",
      "研究页导航状态无效。",
    );

    await page.goto(`${baseUrl}/methodology`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "基金持仓穿透口径" }).waitFor({ state: "visible", timeout: 30_000 });
    assert.equal(await page.locator(".search-zone").count(), 0, "方法论页不应渲染研究面板。");
    assert.equal(
      await page.getByRole("link", { name: "方法论", exact: true }).getAttribute("aria-current"),
      "page",
      "方法论页导航状态无效。",
    );

    await page.goto(`${baseUrl}/leverage`, { waitUntil: "domcontentloaded" });
    await waitForReadyDashboard(page);
    assert.equal(new URL(page.url()).pathname, "/leverage", "两融页直达路径无效。");
    assert.equal(
      await page.getByRole("link", { name: "两融", exact: true }).getAttribute("aria-current"),
      "page",
      "两融页导航状态无效。",
    );

    const indexCheckboxes = page.locator(".leverage-index-toggle input[type=checkbox]");
    assert.equal(await indexCheckboxes.count(), 3, "默认页应提供三只可选叠加指数。");
    assert.deepEqual(
      await indexCheckboxes.evaluateAll((elements) => elements.map((element) => element.checked)),
      [true, true, true],
      "默认应叠加上证指数、深证综指和创业板指。",
    );

    const chartHead = await page.locator(".leverage-chart-panel-head").innerText();
    textContains(chartHead, "融资余额与指数", "默认主图标题");
    textContains(chartHead, "对比基准", "默认主图基准标签");
    const baseBeforeZoom = await page.locator(".leverage-chart-panel-head em").innerText();
    const beforeZoom = await moveToMidChartAndReadTooltip(page);
    textContains(beforeZoom.tooltip, "融资余额：", "默认图表提示框");
    for (const label of ["上证指数", "深证综指", "创业板指"]) {
      textContains(beforeZoom.tooltip, label, "默认图表提示框指数");
    }
    textContains(beforeZoom.tooltip, "收盘", "默认图表提示框收盘");
    textContains(beforeZoom.tooltip, "对比值", "默认图表提示框对比值");
    textContains(beforeZoom.tooltip, "对比基准：", "默认图表提示框对比基准");

    await page.screenshot({
      path: join(screenshotDirectory, "leverage-default-desktop.png"),
      animations: "disabled",
    });

    assert.equal(
      await page.locator(".leverage-disclosure details").evaluate((element) => element.open),
      false,
      "数据说明默认应收起。",
    );
    const disclosureDetails = await openDataDisclosure(page);
    const disclosure = await disclosureDetails.innerText();
    textContains(disclosure, "融资数据：东方财富；指数数据：通达信。", "数据来源说明");
    textContains(disclosure, marketCapSourceText, "市值来源说明");
    textContains(disclosure, "计算方式：融资余额 ÷ 沪深 A 股市值。", "比例计算说明");

    await page.mouse.move(
      beforeZoom.box.x + beforeZoom.box.width - 50,
      beforeZoom.box.y + beforeZoom.box.height - 10,
    );
    await page.mouse.down();
    await page.mouse.move(
      beforeZoom.box.x + 700,
      beforeZoom.box.y + beforeZoom.box.height - 10,
      { steps: 24 },
    );
    await page.mouse.up();
    await page.waitForTimeout(350);
    const afterZoom = await moveToMidChartAndReadTooltip(page);
    const baseAfterZoom = await page.locator(".leverage-chart-panel-head em").innerText();
    assert.notEqual(
      afterZoom.tooltip.split("\n")[0],
      beforeZoom.tooltip.split("\n")[0],
      "dataZoom 后图表中点应对应另一日期，以证明缩放交互实际生效。",
    );
    assert.equal(baseAfterZoom, baseBeforeZoom, "dataZoom 不得改写共同基期。");

    const dateInputs = page.locator(".leverage-date-range input[type=date]");
    assert.equal(await dateInputs.count(), 2, "应提供起止两个手动日期控件。");
    await dateInputs.nth(0).fill("2020-01-02");
    await dateInputs.nth(0).press("Tab");
    await page
      .locator(".leverage-chart-panel-head em")
      .filter({ hasText: "2020-01-02" })
      .waitFor({ state: "visible", timeout: 10_000 });
    const manualRangeHead = await page.locator(".leverage-chart-panel-head").innerText();
    textContains(manualRangeHead, "对比基准：2020-01-02 = 100", "手动日期后的对比基准");
    textContains(
      await page.locator(".leverage-control-period").innerText(),
      "自定义",
      "手动日期后的观察区间",
    );

    await page.goto(`${baseUrl}/leverage?qa-leverage-ratio=1`, { waitUntil: "domcontentloaded" });
    await waitForReadyDashboard(page);
    const ratioButton = page.getByRole("button", { name: "融资余额占市值" });
    assert.equal(await ratioButton.isDisabled(), false, "当前发布包比例模式应可用。");
    await ratioButton.click();
    await page.getByRole("button", { name: "全部", exact: true }).click();
    await page
      .locator(".leverage-chart-panel-head")
      .filter({ hasText: `${ratioRange.start} 至 ${ratioRange.end}` })
      .waitFor({ state: "visible", timeout: 10_000 });
    const ratioHead = await page.locator(".leverage-chart-panel-head").innerText();
    textContains(ratioHead, `对比基准：${ratioRange.start} = 100`, "比例主图对比基准");
    textContains(await page.locator(".leverage-summary-primary").innerText(), "%", "比例摘要单位");
    await page.locator(".leverage-workspace").scrollIntoViewIfNeeded();
    await page.screenshot({
      path: join(screenshotDirectory, "leverage-ratio-desktop.png"),
      animations: "disabled",
    });
    const ratioDisclosure = await (await openDataDisclosure(page)).innerText();
    textContains(ratioDisclosure, marketCapSourceText, "比例市值来源说明");
    textContains(ratioDisclosure, "仅供趋势参考，不构成投资建议。", "比例使用说明");

    result.desktop = {
      independentPages: ["/research", "/leverage", "/methodology"],
      baseBeforeZoom,
      baseAfterZoom,
      zoomedTooltipDate: afterZoom.tooltip.split("\n")[0] ?? "N/A",
      manualBase: "2020-01-02",
      ratioStart: ratioRange.start,
      ratioEnd: ratioRange.end,
      dataCutoff,
    };
  } finally {
    await context.close();
  }
}

async function runMobileScenario(browser, result, baseUrl) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    colorScheme: "light",
  });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/leverage`, { waitUntil: "domcontentloaded" });
    await waitForReadyDashboard(page);

    const navigation = page.locator(".topbar-nav");
    const navigationMetrics = await navigation.evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
      overflowX: getComputedStyle(element).overflowX,
    }));
    assert.equal(navigationMetrics.overflowX, "auto", "移动端导航应允许横向滚动。");
    assert(
      navigationMetrics.scrollWidth >= navigationMetrics.clientWidth,
      "移动端导航滚动区域尺寸无效。",
    );
    const navLinks = page.locator(".topbar-nav a");
    assert.equal(await navLinks.count(), 3, "移动端导航应保留研究、两融、方法论。");
    for (const expectedName of ["研究", "两融", "方法论"]) {
      await page.getByRole("link", { name: expectedName, exact: true }).waitFor({ state: "visible" });
    }
    const buttonMetrics = await navLinks.evaluateAll((elements) =>
      elements.map((element) => ({
        text: element.textContent?.trim(),
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        height: element.getBoundingClientRect().height,
      })),
    );
    for (const metric of buttonMetrics) {
      assert(metric.clientWidth >= metric.scrollWidth, `${metric.text}文本在移动端被截断。`);
      assert(metric.height >= 44, `${metric.text}移动端触控高度不足 44px。`);
    }
    const viewportMetrics = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    assert(
      viewportMetrics.documentWidth <= viewportMetrics.viewportWidth,
      "移动端页面出现横向溢出。",
    );
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), qaScrollTop);
    await page.waitForTimeout(150);
    await page.screenshot({
      path: join(screenshotDirectory, "leverage-mobile.png"),
      animations: "disabled",
    });
    result.mobile = { navigationMetrics, buttonMetrics, viewportMetrics };
  } finally {
    await context.close();
  }
}

async function runBlockedScenario(browser, result, badUrl) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1024 },
    deviceScaleFactor: 1,
    colorScheme: "light",
  });
  const page = await context.newPage();
  try {
    await page.goto(`${badUrl}/leverage`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { name: "数据暂不可用" }).waitFor({ state: "visible", timeout: 30_000 });
    const blockedText = await page.locator(".leverage-dashboard-state").innerText();
    textContains(blockedText, "请稍后刷新再试。", "坏包阻断提示");
    textContains(blockedText, "数据截至：暂无", "坏包截止日");
    assert.equal(await page.locator(".leverage-chart-canvas").count(), 0, "坏包时不得渲染图表。");
    await page.locator(".leverage-dashboard-state").evaluate((element) =>
      element.scrollIntoView({ block: "center" }),
    );
    await page.waitForTimeout(120);
    await page.screenshot({
      path: join(screenshotDirectory, "leverage-blocked.png"),
      animations: "disabled",
    });
    result.blocked = { text: blockedText };
  } finally {
    await context.close();
  }
}

async function runRatioUnavailableScenario(browser, result, baseUrl, dataCutoff, reason) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1024 },
    deviceScaleFactor: 1,
    colorScheme: "light",
  });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/leverage`, { waitUntil: "domcontentloaded" });
    await waitForReadyDashboard(page);

    const ratioButton = page.getByRole("button", { name: "融资余额占市值" });
    assert.equal(await ratioButton.isDisabled(), true, "比例不可用包应禁用比例按钮。");
    const controlsText = await page.locator(".leverage-controls").innerText();
    textContains(controlsText, "暂无可用比例数据", "比例不可用控制提示");

    const disclosureText = await (await openDataDisclosure(page)).innerText();
    textContains(disclosureText, "融资余额占市值：暂不可用。", "比例不可用披露状态");

    const chartHead = await page.locator(".leverage-chart-panel-head").innerText();
    textContains(chartHead, "融资余额与指数", "比例不可用时余额主图标题");
    textContains(chartHead, dataCutoff, "比例不可用时余额主图截止日");
    assert.equal(await page.locator(".leverage-chart-canvas").count(), 1, "比例不可用时余额图表未渲染。");
    const tooltip = await moveToMidChartAndReadTooltip(page);
    textContains(tooltip.tooltip, "融资余额：", "比例不可用时余额图表提示框");

    result.ratio_unavailable = {
      frontendValidatorAccepted: true,
      ratioButtonDisabled: true,
      reason,
      disclosureRange: "N/A",
      defaultMetric: "margin",
      marginChartRendered: true,
      dataCutoff,
    };
  } finally {
    await context.close();
  }
}

async function runOfflineScenario(browser, result, baseUrl) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1024 },
    deviceScaleFactor: 1,
    colorScheme: "light",
  });
  const requests = [];
  const blockedHttpsRequests = [];
  context.on("request", (request) => requests.push(request.url()));
  await context.route("https://**/*", async (route) => {
    blockedHttpsRequests.push(route.request().url());
    await route.abort();
  });
  const page = await context.newPage();
  try {
    await page.goto(`${baseUrl}/research`, { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: "两融", exact: true }).waitFor({ state: "visible", timeout: 30_000 });
    await page.goto(`${baseUrl}/leverage`, { waitUntil: "domcontentloaded" });
    await waitForReadyDashboard(page);
    assert.equal(blockedHttpsRequests.length, 0, "离线场景不应尝试任何 HTTPS 外部资源。");
    assert(
      requests.every((url) => url.startsWith(baseUrl)),
      `离线场景出现非本机请求：${requests.join("，")}`,
    );
    result.offline = {
      requestUrls: [...new Set(requests)].sort(),
      blockedHttpsRequests,
    };
  } finally {
    await context.close();
  }
}

async function readPngEvidence() {
  const evidence = {};
  for (const filename of screenshotFiles) {
    const path = join(screenshotDirectory, filename);
    const bytes = await readFile(path);
    assertCondition(bytes.subarray(0, 8).equals(pngSignature), `${filename} 的 PNG 签名无效。`);
    assertCondition(bytes.length >= 24, `${filename} 文件长度不足。`);
    evidence[filename] = {
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.length,
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
    };
  }
  return evidence;
}

let temporaryRoot = null;
let normalServer = null;
let badServer = null;
let ratioUnavailableServer = null;
let browser = null;
let sourceDataBefore = null;
let sourceDataAfter = null;
let terminalError = null;
const result = {
  schema_version: "1",
  generated_at_beijing: timestampBeijing(),
  command: "npm run qa:leverage",
  status: "running",
  data_cutoff: null,
  ratio_data_range: null,
  temp_parent: tempParent,
  normal_preview: null,
  bad_preview: null,
  ratio_unavailable_preview: null,
  ratio_unavailable_package: null,
  build: null,
  formal_data_sha256_before: null,
  formal_data_sha256_after: null,
  formal_data_unchanged: false,
  scenarios: {},
  screenshots: null,
  cleanup: {
    servers_closed: false,
    temporary_root_removed: false,
  },
  failure: null,
};

try {
  await mkdir(screenshotDirectory, { recursive: true });
  sourceDataBefore = await snapshotFormalData();
  result.formal_data_sha256_before = sourceDataBefore;
  const formalDataBounds = await readFormalDataBounds();
  result.data_cutoff = formalDataBounds.dataCutoff;
  result.ratio_data_range = {
    start: formalDataBounds.ratioStart,
    end: formalDataBounds.ratioEnd,
  };

  temporaryRoot = await mkdtemp(join(tempParent, tempPrefix));
  assertCondition(isSafeTemporaryRoot(temporaryRoot), "临时 QA 目录不在 D:\\vcp_hunter 范围内。");
  const normalDirectory = join(temporaryRoot, "normal");
  const badDirectory = join(temporaryRoot, "bad");
  const ratioUnavailableDirectory = join(temporaryRoot, "ratio-unavailable");
  assertSafeTemporaryDescendant(temporaryRoot, normalDirectory);
  assertSafeTemporaryDescendant(temporaryRoot, badDirectory);
  assertSafeTemporaryDescendant(temporaryRoot, ratioUnavailableDirectory);

  await runNodeProgram(resolve(projectRoot, "node_modules", "typescript", "bin", "tsc"), ["--noEmit"]);
  await runNodeProgram(resolve(projectRoot, "node_modules", "vite", "bin", "vite.js"), [
    "build",
    "--outDir",
    normalDirectory,
    "--emptyOutDir",
  ]);
  const chunks = await verifyBuildOutput(normalDirectory);
  await copyFormalDataToPreview(normalDirectory, sourceDataBefore);
  await cp(normalDirectory, badDirectory, { recursive: true, errorOnExist: true });
  await cp(normalDirectory, ratioUnavailableDirectory, { recursive: true, errorOnExist: true });
  await mutateBadManifest(badDirectory);
  result.ratio_unavailable_package = await createRatioUnavailablePackage(ratioUnavailableDirectory);
  assert.equal(
    result.ratio_unavailable_package.data_cutoff,
    result.data_cutoff,
    "比例不可用临时包截止日与正式 manifest 不一致。",
  );
  assertEqualObject(
    await Promise.all(dataFiles.map((filename) => fileSha256(join(normalDirectory, "data", filename)))).then((hashes) =>
      Object.fromEntries(dataFiles.map((filename, index) => [filename, hashes[index]])),
    ),
    sourceDataBefore,
    "坏包副本创建后正常临时发布包发生了变化。",
  );

  normalServer = await startStaticServer(normalDirectory);
  badServer = await startStaticServer(badDirectory);
  ratioUnavailableServer = await startStaticServer(ratioUnavailableDirectory);
  result.normal_preview = { host: "127.0.0.1", port: Number(new URL(normalServer.url).port) };
  result.bad_preview = { host: "127.0.0.1", port: Number(new URL(badServer.url).port) };
  result.ratio_unavailable_preview = {
    host: "127.0.0.1",
    port: Number(new URL(ratioUnavailableServer.url).port),
  };
  result.build = {
    entry_chunk: chunks.entryName,
    leverage_async_chunk: chunks.leverageName,
    command: "node_modules/typescript/bin/tsc --noEmit + node_modules/vite/bin/vite.js build",
    seo_generation: false,
  };

  const playwright = await ensureChromium();
  browser = await playwright.chromium.launch({ headless: true });
  result.browser = {
    engine: "Playwright Chromium",
    executable: playwright.executablePath,
    availability_policy: "preprovisioned_local_only_no_automatic_download",
  };
  await runDesktopScenario(
    browser,
    result.scenarios,
    normalServer.url,
    result.data_cutoff,
    result.ratio_data_range,
    formalDataBounds.marketCapSourceText,
  );
  await runMobileScenario(browser, result.scenarios, normalServer.url);
  await runBlockedScenario(browser, result.scenarios, badServer.url);
  await runRatioUnavailableScenario(
    browser,
    result.scenarios,
    ratioUnavailableServer.url,
    result.data_cutoff,
    result.ratio_unavailable_package.reason,
  );
  await runOfflineScenario(browser, result.scenarios, normalServer.url);
  result.screenshots = await readPngEvidence();
  result.status = "passed";
} catch (error) {
  terminalError = error;
  result.status = "failed";
  result.failure = describeError(error);
} finally {
  if (browser !== null) {
    try {
      await browser.close();
    } catch (error) {
      terminalError ??= error;
      result.status = "failed";
      result.failure ??= `浏览器关闭失败：${describeError(error)}`;
    }
  }
  try {
    if (normalServer !== null) {
      await closeServer(normalServer.server);
    }
    if (badServer !== null) {
      await closeServer(badServer.server);
    }
    if (ratioUnavailableServer !== null) {
      await closeServer(ratioUnavailableServer.server);
    }
    result.cleanup.servers_closed = true;
  } catch (error) {
    terminalError ??= error;
    result.status = "failed";
    result.failure ??= `本机服务关闭失败：${describeError(error)}`;
  }
  try {
    sourceDataAfter = await snapshotFormalData();
    result.formal_data_sha256_after = sourceDataAfter;
    result.formal_data_unchanged = sourceDataBefore !== null &&
      JSON.stringify(sourceDataBefore) === JSON.stringify(sourceDataAfter);
    assertCondition(result.formal_data_unchanged, "QA 运行前后正式 public/data 的 SHA-256 发生变化。");
  } catch (error) {
    terminalError ??= error;
    result.status = "failed";
    result.failure ??= describeError(error);
  }
  try {
    if (temporaryRoot !== null) {
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
    }
  } catch (error) {
    terminalError ??= error;
    result.status = "failed";
    result.failure ??= `临时 QA 目录清理失败：${describeError(error)}`;
  }
  if (result.status === "passed" && (!result.formal_data_unchanged || !result.cleanup.temporary_root_removed)) {
    terminalError ??= new Error("QA 清理或正式数据哈希状态不完整。");
    result.status = "failed";
    result.failure ??= describeError(terminalError);
  }
  await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
}

if (terminalError !== null || result.status !== "passed") {
  console.error(`两融浏览器离线 QA 失败：${result.failure ?? describeError(terminalError)}`);
  console.error(`结构化结果：${resultPath}`);
  process.exitCode = 1;
} else {
  console.log("两融浏览器离线 QA 通过：已完成临时构建、坏包阻断、比例不可用、离线边界和清理验证。");
  console.log(`结构化结果：${resultPath}`);
}
