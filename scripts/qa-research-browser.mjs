import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import {
  access,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
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

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tmpParent = resolve(root, "..", ".."),
  prefix = "_tmp_research_qa_";
const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const appPaths = new Set(["/", "/research", "/leverage", "/methodology"]);
const mime = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
const ok = (value, message) => assert.equal(Boolean(value), true, message);
const within = (base, path) => {
  const diff = relative(base, path);
  return diff.length > 0 && !diff.startsWith("..") && !isAbsolute(diff);
};
const safeTmp = (path) =>
  dirname(path) === tmpParent &&
  basename(path).startsWith(prefix) &&
  within(tmpParent, path);
const sha = (value) => createHash("sha256").update(value).digest("hex");
const stockShardPathPattern = (stockCode) =>
  new RegExp(
    `/stock-${Buffer.from(stockCode, "utf8").toString("hex")}\\.json(?:\\?|$)`,
    "i",
  );

function runVite(out) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(
      process.execPath,
      [
        resolve(root, "node_modules/vite/bin/vite.js"),
        "build",
        "--outDir",
        out,
        "--emptyOutDir",
      ],
      { cwd: root, stdio: "inherit" },
    );
    child.once("error", rejectPromise);
    child.once("exit", (code) =>
      code === 0
        ? resolvePromise()
        : rejectPromise(new Error(`临时 Vite 构建退出码 ${code ?? "未知"}`)),
    );
  });
}
function staticPath(directory, raw) {
  const pathname = decodeURIComponent(
    new URL(raw ?? "/", "http://127.0.0.1").pathname,
  );
  if (appPaths.has(pathname.replace(/\/+$/, "") || "/"))
    return resolve(directory, "index.html");
  const target = resolve(
    directory,
    pathname === "/" ? "index.html" : pathname.replace(/^\/+/, ""),
  );
  return within(directory, target) ? target : null;
}
async function serve(directory, tempRoot) {
  ok(safeTmp(tempRoot) && within(tempRoot, directory), "临时预览目录越界。");
  const server = createServer(async (request, response) => {
    try {
      if (!/^(GET|HEAD)$/.test(request.method ?? "")) {
        response.writeHead(405);
        response.end();
        return;
      }
      const target = staticPath(directory, request.url);
      if (!target) {
        response.writeHead(403);
        response.end();
        return;
      }
      if (!(await stat(target)).isFile()) {
        response.writeHead(404);
        response.end();
        return;
      }
      response.writeHead(200, {
        "Content-Type": mime[extname(target)] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(
        request.method === "HEAD" ? undefined : await readFile(target),
      );
    } catch (error) {
      response.writeHead(error?.code === "ENOENT" ? 404 : 500);
      response.end();
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
  ok(address && typeof address !== "string", "本机服务器无端口。");
  return { server, url: `http://127.0.0.1:${address.port}` };
}
function stop(server) {
  return new Promise((resolvePromise, rejectPromise) =>
    server.close((error) => (error ? rejectPromise(error) : resolvePromise())),
  );
}

async function fixture(preview, tempRoot) {
  const data = join(preview, "data"),
    manifestFile = join(data, "fund-portfolio-index-2026q2.manifest.json");
  ok(within(tempRoot, manifestFile), "fixture 文件越界。");
  const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
  for (const metadata of Object.values(manifest.fundDetailShards)) {
    const detailFile = join(data, metadata.path);
    ok(within(tempRoot, detailFile), "详情 fixture 越界。");
    const detail = JSON.parse(await readFile(detailFile, "utf8"));
    for (const fundFamilyKey of Object.keys(detail.fundDetails)) {
      detail.fundDetails[fundFamilyKey] = {
        fundFamilyKey,
        detailStatus: "not_captured_in_current_stock_detail_rows",
        detailMessage: "QA 临时夹具：当前已采集公开股票明细未包含详情。",
      };
    }
    const bytes = Buffer.from(`${JSON.stringify(detail, null, 2)}\n`);
    await writeFile(detailFile, bytes);
    metadata.sha256 = sha(bytes);
  }
  await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`);
  return { path: "fund-details/" };
}

async function scenario(browser, url, viewport, setup) {
  const context = await browser.newContext({
    viewport,
    colorScheme: "light",
    reducedMotion: "reduce",
    serviceWorkers: "block",
    isMobile: viewport.width <= 390,
    hasTouch: viewport.width <= 390,
  });
  const requests = [],
    failures = [],
    requestFailures = [],
    external = [];
  context.on("request", (request) => requests.push(request.url()));
  context.on("response", (response) => {
    if (response.status() >= 400)
      failures.push(`${response.status()} ${response.url()}`);
  });
  context.on("requestfailed", (request) =>
    requestFailures.push(`${request.failure()?.errorText ?? "unknown"} ${request.url()}`),
  );
  await context.route("https://**/*", (route) => {
    external.push(route.request().url());
    return route.abort("blockedbyclient");
  });
  if (setup) await setup(context);
  return {
    context,
    page: await context.newPage(),
    requests,
    failures,
    requestFailures,
    external,
    url,
  };
}
function network(state, label, forbidden = [], required = [], allowedRequestFailures = []) {
  const foreign = state.requests.filter(
    (item) => new URL(item).origin !== state.url,
  );
  assert.deepEqual(
    state.external,
    [],
    `${label}尝试外部 https：${state.external.join(",")}`,
  );
  assert.deepEqual(foreign, [], `${label}非同源请求：${foreign.join(",")}`);
  assert.deepEqual(
    state.failures,
    [],
    `${label}资源错误：${state.failures.join(",")}`,
  );
  const unexpectedRequestFailures = state.requestFailures.filter(
    (item) =>
      !item.startsWith("net::ERR_ABORTED ") &&
      !allowedRequestFailures.some((regex) => regex.test(item)),
  );
  assert.deepEqual(
    unexpectedRequestFailures,
    [],
    `${label}请求失败：${unexpectedRequestFailures.join(",")}`,
  );
  forbidden.forEach((regex) =>
    ok(
      !state.requests.some((item) => regex.test(item)),
      `${label}请求了禁止资源 ${regex}`,
    ),
  );
  required.forEach((regex) =>
    ok(
      state.requests.some((item) => regex.test(item)),
      `${label}未请求预期资源 ${regex}`,
    ),
  );
}
async function ready(page, url, code = "NVDA") {
  await page.goto(`${url}/research?stock=${encodeURIComponent(code)}`, {
    waitUntil: "domcontentloaded",
  });
  await page
    .getByLabel("多股票组合研究工作台")
    .waitFor({ state: "visible", timeout: 30000 });
  await page
    .getByRole("tablist", { name: "基金结果分类" })
    .waitFor({ state: "visible", timeout: 30000 });
}
async function add(page, code) {
  const picker = page.getByRole("combobox", { name: "检索添加股票" });
  await picker.fill(code);
  const suggestions = page.getByRole("listbox", { name: "匹配股票" });
  await suggestions.waitFor({ state: "visible" });
  const options = suggestions.locator('[role="option"]');
  const exactIndex = await options.evaluateAll(
    (items, expectedCode) => items.findIndex(
      (item) => item.querySelector("code")?.textContent?.trim() === expectedCode,
    ),
    code,
  );
  ok(exactIndex >= 0, `组合股票检索没有唯一的 ${code} 建议`);
  await options.nth(exactIndex).click();
  await page.locator(".portfolio-stock-search-field").getByRole("button", { name: "加入组合" }).click();
  await page
    .getByText("校验并加载结果…")
    .waitFor({ state: "hidden", timeout: 30000 });
}
async function target(locator, label) {
  const box = await locator.boundingBox();
  const minimum = locator.page().viewportSize().width <= 720 ? 44 : 24;
  ok(box && box.width >= minimum && box.height >= minimum, `${label}小于 ${minimum}×${minimum}`);
}
async function overflow(page, label) {
  const size = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    window.innerWidth,
  ]);
  ok(size[0] <= size[1], `${label}横向溢出 ${size[0]}>${size[1]}`);
  return { documentWidth: size[0], viewportWidth: size[1] };
}
async function portfolioEditorLayout(page, label, { wide, stacked }) {
  const layout = await page.locator(".portfolio-editor").evaluate((editor) => {
    const rect = (selector) => {
      const element = editor.querySelector(selector);
      if (!element) return null;
      const { top, bottom } = element.getBoundingClientRect();
      return { top, bottom };
    };
    return {
      labels: {
        name: rect(":scope > label:nth-of-type(1)"),
        savedBasket: rect(":scope > label:nth-of-type(2)"),
        stockSearch: rect(".portfolio-stock-search-field > label"),
      },
      controls: {
        name: rect(":scope > label:nth-of-type(1) > input"),
        savedBasket: rect(":scope > label:nth-of-type(2) > select"),
        stockSearch: rect(".portfolio-stock-search-field input"),
        addStock: rect(".portfolio-add-stock"),
      },
    };
  });
  const sameRow = (rowName, entries) => {
    const [referenceName, reference] = Object.entries(entries)[0];
    ok(Number.isFinite(reference?.top), `${label} ${rowName} 缺少 ${referenceName} 坐标`);
    for (const [name, rect] of Object.entries(entries).slice(1)) {
      ok(Number.isFinite(rect?.top), `${label} ${rowName} 缺少 ${name} 坐标`);
      ok(
        Math.abs(rect.top - reference.top) <= 1,
        `${label} ${rowName} 未对齐：${referenceName}=${reference.top.toFixed(2)}，${name}=${rect.top.toFixed(2)}`,
      );
    }
  };
  if (wide) {
    sameRow("标签", layout.labels);
    sameRow("控件", layout.controls);
  } else if (stacked) {
    ok(Number.isFinite(layout.controls.stockSearch?.bottom), `${label} 缺少检索输入框坐标`);
    ok(Number.isFinite(layout.controls.addStock?.top), `${label} 缺少添加按钮坐标`);
    const gap = layout.controls.addStock.top - layout.controls.stockSearch.bottom;
    ok(gap >= 0 && gap <= 16, `${label} 纵向按钮间距异常：${gap.toFixed(2)}px`);
  } else {
    sameRow("检索与添加控件", {
      stockSearch: layout.controls.stockSearch,
      addStock: layout.controls.addStock,
    });
  }
  return Object.fromEntries(
    Object.entries(layout).map(([rowName, entries]) => [
      rowName,
      entries && "top" in entries
        ? Object.fromEntries(Object.entries(entries).map(([name, value]) => [name, Number(value.toFixed(2))]))
        : Object.fromEntries(Object.entries(entries).map(([name, rect]) => [name, Number(rect.top.toFixed(2))])),
    ]),
  );
}
function contrastRatio(foreground, background) {
  const channel = (value) => {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (rgb) =>
    0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}
function rgb(value) {
  const channels = value.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number);
  ok(channels?.length === 3, `无法解析颜色 ${value}`);
  return channels;
}
async function focusEvidence(locator, label, { keyboard = true } = {}) {
  const page = locator.page();
  if (keyboard) {
    // 先把焦点移到前一项，再以真实 Tab 回到目标；这避免脚本 focus 被误计为键盘焦点。
    await locator.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    ok(
      await locator.evaluate((element) => document.activeElement === element),
      `${label} 无法通过键盘 Tab 回到目标`,
    );
  } else {
    await locator.focus();
  }
  const handle = await locator.elementHandle();
  ok(handle, `${label} 缺少焦点元素句柄`);
  await page.waitForFunction(
    (element) => getComputedStyle(element).outlineColor !== "rgb(255, 255, 255)",
    handle,
    { timeout: 5000 },
  );
  await handle.dispose();
  const evidence = await locator.evaluate((element) => {
    const opaqueBackground = (node) => {
      for (let current = node; current; current = current.parentElement) {
        const color = getComputedStyle(current).backgroundColor;
        if (color && color !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(color)) return color;
      }
      return "rgb(255, 255, 255)";
    };
    const style = getComputedStyle(element);
    return {
      outlineColor: style.outlineColor,
      outlineWidth: style.outlineWidth,
      outlineOffset: style.outlineOffset,
      matchesFocus: element.matches(":focus"),
      matchesFocusVisible: element.matches(":focus-visible"),
      matchesWorkbenchFocus: element.matches(".portfolio-workbench button:focus"),
      backgroundColor: opaqueBackground(element.parentElement),
    };
  });
  const ratio = contrastRatio(rgb(evidence.outlineColor), rgb(evidence.backgroundColor));
  ok(
    ratio >= 3,
    `${label} 焦点对比度 ${ratio.toFixed(3)} < 3；outline=${evidence.outlineColor} background=${evidence.backgroundColor}`,
  );
  ok(
    parseFloat(evidence.outlineWidth) >= 3,
    `${label} 焦点线小于 3px；width=${evidence.outlineWidth}`,
  );
  ok(
    Number.isFinite(parseFloat(evidence.outlineOffset)),
    `${label} 焦点偏移不是可审计像素值；offset=${evidence.outlineOffset} focus=${evidence.matchesFocus} focusVisible=${evidence.matchesFocusVisible}`,
  );
  return { ...evidence, contrast: Number(ratio.toFixed(3)) };
}
async function normalTextEvidence(page) {
  const selectors = [
    ".portfolio-header h2",
    ".portfolio-editor label",
    ".portfolio-disclosure",
    ".portfolio-blocked",
  ];
  return page.evaluate((items) => {
    const channel = (value) => {
      const normalized = value / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    const parse = (value) => value.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number) ?? [];
    const lum = (color) => 0.2126 * channel(color[0]) + 0.7152 * channel(color[1]) + 0.0722 * channel(color[2]);
    const opaqueBackground = (node) => {
      for (let current = node; current; current = current.parentElement) {
        const color = getComputedStyle(current).backgroundColor;
        if (color && color !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(color)) return color;
      }
      return "rgb(255, 255, 255)";
    };
    return items.flatMap((selector) => Array.from(document.querySelectorAll(selector)).slice(0, 1).map((element) => {
      const style = getComputedStyle(element);
      const foreground = parse(style.color);
      const background = parse(opaqueBackground(element.parentElement));
      const [lighter, darker] = [lum(foreground), lum(background)].sort((a, b) => b - a);
      return { selector, color: style.color, background: `rgb(${background.join(", ")})`, contrast: Number(((lighter + .05) / (darker + .05)).toFixed(3)) };
    }));
  }, selectors);
}
async function auditVisibleControls(page, label) {
  const controls = page.locator(".portfolio-workbench button:not(:disabled), .portfolio-workbench input:not(:disabled), .portfolio-workbench select:not(:disabled), .portfolio-workbench [role=tab]:not(:disabled):not([tabindex='-1'])");
  const count = await controls.count();
  ok(count > 0, `${label} 未找到可交互控件`);
  const evidence = [];
  for (let index = 0; index < count; index += 1) {
    const control = controls.nth(index);
    if (!(await control.isVisible())) continue;
    if (
      (await control.getAttribute("role")) === "tab" &&
      (await control.getAttribute("aria-selected")) !== "true"
    )
      continue;
    const accessibleName = await control.evaluate(
      (element, fallback) =>
        element.getAttribute("aria-label") ??
        element.labels?.[0]?.childNodes[0]?.textContent?.trim() ??
        element.textContent?.trim() ??
        fallback,
      `control-${index}`,
    );
    await target(control, `${label} ${accessibleName}`);
    evidence.push({ label: accessibleName, ...(await focusEvidence(control, `${label} ${accessibleName}`)) });
  }
  return evidence;
}
async function detailsButton(page) {
  // 这里验证的是普通基金的主索引“最多十条”契约；QDII 的 H1 全权益详情
  // 有独立口径，不能再把它误判为失败。优先从当前完整排序中选非 QDII 行。
  const rows = page.getByRole("tabpanel").locator(".portfolio-fund-row");
  const count = await rows.count();
  for (let index = 0; index < count; index += 1) {
    const row = rows.nth(index);
    if ((await row.getAttribute("data-qdii")) === "true") continue;
    const button = row.getByRole("button", { name: /查看 .* 基金详情/ });
    await button.waitFor({ state: "visible" });
    return button;
  }
  throw new Error("当前完整排序中没有可验证前十详情契约的非 QDII 基金行。");
}

async function emptyLazy(browser, url, result) {
  const state = await scenario(browser, url, { width: 1440, height: 1024 });
  try {
    await state.page.goto(`${url}/research`, { waitUntil: "domcontentloaded" });
    await state.page
      .getByRole("combobox", { name: "搜索股票名称或代码" })
      .waitFor({ state: "visible" });
    await state.page
      .getByText("添加股票，查看持有它们的基金。")
      .waitFor();
    network(state, "空研究", [
      /fund-portfolio-index-.*manifest/i,
      /fund-portfolio-index-.*\.json/i,
      /LeverageMarketSummary|leverage-dashboard|LeverageDashboard|LeverageChart|LeverageControls|echarts|zrender/i,
    ]);
    result.empty = { requests: state.requests.length };
  } finally {
    network(state, "空研究最终", [/fund-holdings-.*\.json/i]);
    await state.context.close();
  }
}
async function readySummaryTabs(browser, url, result) {
  const state = await scenario(browser, url, { width: 1440, height: 1024 });
  try {
    const { page } = state;
    await ready(page, url);
    await page.waitForFunction(
      () =>
        document.activeElement?.classList.contains("portfolio-result-focus"),
      undefined,
      { timeout: 10000 },
    );
    await page.getByRole("heading", { name: "临时研究" }).waitFor();
    await page.getByLabel("已选股票").getByRole("button", { name: /^移除 .* NVDA$/ }).waitFor();
    const titleFocus = await focusEvidence(page.locator(".portfolio-result-focus"), "结果标题", { keyboard: false });
    const tabs = page.getByRole("tab", { name: /场外基金|场内 ETF/ });
    assert.equal(await tabs.count(), 2, "缺少两个互斥页签。");
    for (const tab of [tabs.nth(0), tabs.nth(1)]) {
      const id = await tab.getAttribute("aria-controls");
      ok(id, "页签缺少 aria-controls");
      assert.equal(
        await page.locator(`#${id}`).getAttribute("role"),
        "tabpanel",
        "关联面板不是 tabpanel",
      );
    }
    for (const name of ["场外基金", "场内 ETF / LOF"]) {
      await page.getByRole("tab", { name }).click();
      ok((await page.getByRole("tabpanel", { name }).locator(".portfolio-fund-row").count()) > 0, `NVDA ${name} 互斥面板没有基金行`);
    }
    await page.getByRole("tab", { name: "场外基金" }).click();
    await tabs.nth(0).focus();
    await page.keyboard.press("ArrowRight");
    await page
      .getByRole("tab", { name: "场内 ETF / LOF", selected: true })
      .waitFor();
    await page.keyboard.press("ArrowLeft");
    await page.getByRole("tab", { name: "场外基金", selected: true }).waitFor();
    await page.keyboard.press("Home");
    await page.getByRole("tab", { name: "场外基金", selected: true }).waitFor();
    await page.keyboard.press("End");
    await page.locator(".research-market-details > summary").click();
    const summary = page.getByLabel("市场环境");
    await summary
      .getByText(/\d+ 个共同交易日/)
      .waitFor({ state: "visible", timeout: 30000 });
    assert.equal(
      await summary
        .getByRole("link", { name: "打开完整两融数据看板" })
        .getAttribute("href"),
      "/leverage",
    );
    await target(
      summary.getByRole("link", { name: "打开完整两融数据看板" }),
      "摘要链接",
    );
    const summaryText = await summary.innerText();
    const comparisons = await summary.locator("dl > div").evaluateAll((items) => Object.fromEntries(items.map((item) => [item.querySelector("dt")?.textContent?.trim(), item.querySelector("dd")?.textContent?.trim()])));
    assert.match(comparisons["融资余额变化"] ?? "", /^-?\d+\.\d{2}%$/, "摘要缺少融资余额区间变化");
    assert.match(comparisons["上证指数变化"] ?? "", /^-?\d+\.\d{2}%$/, "摘要缺少上证指数区间变化");
    assert.match(comparisons["融资 − 指数"] ?? "", /^-?\d+\.\d{2} 个百分点$/, "摘要差值没有使用百分点");
    ok(Math.abs(parseFloat(comparisons["融资余额变化"]) - parseFloat(comparisons["上证指数变化"]) - parseFloat(comparisons["融资 − 指数"])) <= 0.02, "摘要差值与两个区间变化不一致");
    const interval = summaryText.match(/(20\d{2}-\d{2}-\d{2})\s*至\s*(20\d{2}-\d{2}-\d{2})/);
    ok(interval?.[1] && interval?.[2], `摘要缺少实际起止日期：${summaryText}`);
    ok(interval[1] !== interval[2], `摘要起止日期没有区分：${summaryText}`);
    await summary.getByText(/不说明个股或基金表现的原因/).waitFor();
    network(
      state,
      "ready 组合",
      [/LeverageDashboard|LeverageChart|LeverageControls|echarts|zrender/i],
      [
        /fund-portfolio-index-.*manifest/i,
        stockShardPathPattern("NVDA"),
        /LeverageMarketSummary/i,
        /leverage-dashboard\.json/i,
        /leverage-dashboard\.manifest\.json/i,
      ],
    );
    result.ready = { requests: state.requests.length, summaryText, interval: { start: interval[1], end: interval[2] }, titleFocus };
  } finally {
    network(state, "ready 组合最终", [/LeverageDashboard|LeverageChart|LeverageControls|echarts|zrender/i]);
    await state.context.close();
  }
}
async function selectionAndLimit(browser, url, result) {
  const state = await scenario(browser, url, { width: 1440, height: 1024 });
  try {
    const { page } = state;
    await ready(page, url);
    const picker = page.getByRole("combobox", { name: "检索添加股票" });
    await picker.click();
    await page.keyboard.press("KeyA");
    const pointerTyping = await picker.evaluate((element) => ({
      inputMode: document.documentElement.dataset.inputMode,
      outlineStyle: getComputedStyle(element).outlineStyle,
    }));
    assert.equal(pointerTyping.inputMode, "pointer", "鼠标输入普通字符后不应切换为键盘焦点模式");
    assert.equal(pointerTyping.outlineStyle, "none", "鼠标输入普通字符后仍显示焦点外框");
    await picker.fill("台湾积体");
    const pickerSuggestions = page.getByRole("listbox", { name: "匹配股票" });
    await pickerSuggestions.waitFor({ state: "visible" });
    ok(
      (await pickerSuggestions.getByRole("option", { name: /台积电.*TSM/ }).count()) === 1,
      "旧中文名称没有命中标准台积电 ADR",
    );
    await picker.press("ArrowDown");
    ok(
      await picker.getAttribute("aria-activedescendant"),
      "中文组合检索没有激活建议",
    );
    await picker.press("Enter");
    assert.match(await picker.inputValue(), /台积电/, "中文组合检索没有以标准名称选中台积电");
    await picker.fill("2330");
    await pickerSuggestions.locator("#portfolio-stock-search-option-2330").waitFor();
    assert.equal(await pickerSuggestions.getByRole("option", { name: /TSM/ }).count(), 0, "台股本股代码被误合并到 ADR");

    const onExchangeTab = page.getByRole("tab", { name: "场内 ETF / LOF" });
    await onExchangeTab.click();
    const pointerFocus = await onExchangeTab.evaluate((element) => ({
      inputMode: document.documentElement.dataset.inputMode,
      outlineStyle: getComputedStyle(element).outlineStyle,
      outlineWidth: getComputedStyle(element).outlineWidth,
    }));
    assert.equal(pointerFocus.inputMode, "pointer", "点击页签后未记录为指针操作");
    assert.equal(pointerFocus.outlineStyle, "none", "鼠标点击页签仍显示焦点外框");
    const keyboardFocus = await focusEvidence(onExchangeTab, "键盘场内基金页签");

    await picker.fill("");
    await pickerSuggestions.waitFor({ state: "visible" });
    const values = await pickerSuggestions
      .getByRole("option")
      .evaluateAll((items) =>
        items
          .map((item) => item.querySelector("code")?.textContent?.trim())
          .filter(Boolean)
          .slice(0, 9),
      );
    assert.equal(values.length, 9, "可搜索范围不足十只验证");
    for (let index = 0; index < 12; index += 1) await picker.press("ArrowDown");
    const activeOptionId = await picker.getAttribute("aria-activedescendant");
    ok(activeOptionId, "组合检索无法移动到最后一个候选项");
    const pickerScroll = await pickerSuggestions.evaluate((listbox, activeId) => {
      const activeOption = document.getElementById(activeId);
      if (activeOption === null) return { found: false, visible: false };
      const listboxBounds = listbox.getBoundingClientRect();
      const optionBounds = activeOption.getBoundingClientRect();
      return {
        found: true,
        visible: optionBounds.top >= listboxBounds.top && optionBounds.bottom <= listboxBounds.bottom,
        scrollTop: listbox.scrollTop,
      };
    }, activeOptionId);
    ok(pickerScroll.found && pickerScroll.visible, "活动组合检索候选项未滚动到可视区");
    const search = page.getByRole("combobox", { name: "搜索股票名称或代码" });
    await search.fill("TSM");
    await page
      .getByRole("listbox", { name: "搜索建议" })
      .waitFor({ state: "visible" });
    await search.press("ArrowDown");
    ok(
      await search.getAttribute("aria-activedescendant"),
      "键盘搜索没有激活建议",
    );
    await search.press("Enter");
    await page.getByLabel("已选股票").getByRole("button", { name: /^移除 .* TSM$/ }).waitFor();
    for (const value of values) await add(page, value);
    assert.equal(
      await picker.isDisabled(),
      true,
      "10 只后选择器未禁用",
    );
    await page.getByText(/已满 10 只/).waitFor();
    await search.fill("TSM");
    await search.press("ArrowDown");
    await search.press("Enter");
    const dialog = page.getByRole("dialog", { name: "有未保存更改" });
    await dialog.waitFor().catch((error) => { throw new Error(`临时替换保护未出现：${error.message}`); });
    const beforeCancel = await page.getByLabel("已选股票").innerText();
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await page.waitForFunction(
      () =>
        document.activeElement?.getAttribute("aria-label") ===
        "搜索股票名称或代码",
    );
    assert.equal(await page.getByLabel("已选股票").innerText(), beforeCancel, "取消替换改变了工作台股票");
    result.limit = {
      chips: await page
        .getByLabel("已选股票")
        .getByRole("button", { name: /移除 / })
        .count(),
      pointerTyping,
      pointerFocus,
      keyboardFocus,
      pickerScroll,
    };
  } finally {
    network(state, "选择上限最终", [/LeverageDashboard|LeverageChart|LeverageControls|echarts|zrender/i]);
    await state.context.close();
  }
}
async function storageGuards(browser, url, result) {
  const state = await scenario(browser, url, { width: 1440, height: 1024 });
  try {
    const { page } = state;
    await ready(page, url);
    const name = page.getByLabel("组合名称");
    await name.fill("QA 组合 A");
    await page.getByRole("button", { name: "保存组合", exact: true }).click();
    ok(await page.getByRole("button", { name: "保存更改" }).isDisabled(), "保存后重复保存未禁用");
    await page.locator(".portfolio-status").getByText("已保存", { exact: true }).waitFor();
    await page.getByRole("button", { name: "另存为" }).click();
    const copyDialog = page.getByRole("dialog", { name: "另存为" });
    assert.equal(await copyDialog.getByLabel("副本名称").inputValue(), "QA 组合 A（副本）");
    await copyDialog.getByRole("button", { name: "保存副本" }).click();
    await copyDialog.waitFor({ state: "hidden" });
    const copies = await page.evaluate(() => JSON.parse(localStorage.getItem("chuhaiqianyan.portfolio-baskets.v1")).baskets);
    assert.equal(copies.length, 2, "另存为没有产生独立副本");
    assert.notEqual(copies[0].id, copies[1].id, "副本沿用原组合 ID");
    await page.getByLabel("本机组合").selectOption({ label: "QA 组合 A" });
    await page.goto(`${url}/research`, { waitUntil: "domcontentloaded" });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page
      .getByRole("heading", { name: "QA 组合 A", exact: true })
      .waitFor({ state: "visible", timeout: 30000 });
    await add(page, "TSM");
    const dirty = await page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
    ok(dirty, "脏草稿没有 beforeunload 保护");
    await page.evaluate(() => window.history.pushState(null, "", "/research?stock=NVDA"));
    const nav = page.getByRole("link", { name: "基金穿透" });
    await nav.click();
    const dialog = page.getByRole("dialog", { name: "有未保存更改" });
    await dialog.waitFor().catch((error) => { throw new Error(`顶部研究离开保护未出现：${error.message}`); });
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      () => document.activeElement?.textContent?.trim() === "基金穿透",
    );
    await nav.click();
    await dialog.getByRole("button", { name: "保存" }).click();
    await page.waitForURL(/\/research$/);
    const clean = await page.evaluate(() => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
    ok(!clean, "保存后 beforeunload 仍阻止离开");
    await page
      .getByRole("heading", { name: "QA 组合 A", exact: true })
      .waitFor({ state: "visible", timeout: 30000 });
    await page.getByRole("button", { name: "新建" }).click();
    await name.fill("QA 组合 B");
    await add(page, "TSM");
    await page.getByRole("button", { name: "保存组合", exact: true }).click();
    const saved = page.getByLabel("本机组合");
    await saved.selectOption({ label: "QA 组合 A" });
    await add(page, "AAPL");
    await saved.selectOption({ label: "QA 组合 B" });
    await dialog.waitFor().catch((error) => { throw new Error(`切换组合保护未出现：${error.message}`); });
    await dialog.getByRole("button", { name: "取消" }).click();
    await saved.selectOption({ label: "QA 组合 B" });
    await dialog.getByRole("button", { name: "放弃" }).click();
    await page.getByRole("heading", { name: "QA 组合 B", exact: true }).waitFor();
    await add(page, "AAPL");
    await page.locator(".portfolio-more-actions > summary").click();
    const deleteButton = page.getByRole("button", { name: "删除组合", exact: true });
    await deleteButton.click();
    const deleteDialog = page.getByRole("alertdialog", { name: "删除“QA 组合 B”？" });
    await deleteDialog.waitFor();
    await deleteDialog.getByText(/及当前未保存的更改/).waitFor();
    await page.keyboard.press("Escape");
    await deleteDialog.waitFor({ state: "hidden" });
    await page.waitForFunction(() => document.activeElement?.textContent?.trim() === "删除组合");
    await page.getByRole("heading", { name: "QA 组合 B", exact: true }).waitFor();
    await deleteButton.click();
    await deleteDialog.getByRole("button", { name: "确认删除" }).click();
    await page.getByRole("heading", { name: "QA 组合 A", exact: true }).waitFor();
    result.storage = { beforeUnload: { dirty, clean }, independentCopy: true, deletionConfirmation: true };
  } finally {
    network(state, "本机保存最终", [/LeverageDashboard|LeverageChart|LeverageControls|echarts|zrender/i]);
    await state.context.close();
  }
}
async function paginationAndEmpty(browser, url, result) {
  const state = await scenario(browser, url, { width: 1440, height: 1024 });
  try {
    const { page } = state;
    await ready(page, url, "00700");
    for (const name of ["场外基金", "场内 ETF / LOF"]) {
      await page.getByRole("tab", { name }).click();
      const panel = page.getByRole("tabpanel", { name });
      const rows = panel.locator(".portfolio-fund-row");
      assert.equal(await rows.count(), 50, `${name}初始不是 50 行`);
      const firstPageCount = await rows.count();
      const first = await rows.first().innerText();
      const loadMore = page.getByRole("button", { name: /^更多（/ });
      await focusEvidence(loadMore, `${name} 加载更多`);
      await target(loadMore, `${name} 加载更多`);
      await loadMore.click();
      const loadedCount = await rows.count();
      ok(
        loadedCount > firstPageCount && loadedCount <= firstPageCount + 50,
        `${name}加载后行数异常：${loadedCount}`,
      );
      assert.equal(
        await rows.first().innerText(),
        first,
        `${name}分页后首行被重排`,
      );
      const totals = await rows.evaluateAll((items) =>
        items
          .map((item) =>
            Number(
              item.querySelector(".portfolio-total-exposure")?.textContent?.replace(/[,%]/g, ""),
            ),
          )
          .filter(Number.isFinite),
      );
      assert.equal(totals.length, loadedCount, "比较表没有可读取的总估算暴露数值");
      totals
        .slice(1)
        .forEach((value, index) =>
          ok(totals[index] >= value, `${name}排序非递减`),
        );
    }
    result.pagination = true;
  } finally {
    network(state, "分页最终", [/LeverageDashboard|LeverageChart|LeverageControls|echarts|zrender/i]);
    await state.context.close();
  }
  const empty = await scenario(browser, url, { width: 1440, height: 1024 });
  try {
    const currentIndex = JSON.parse(await readFile(join(root, "public/data/fund-stock-index-2026q2.json"), "utf8"));
    const emptyStock = currentIndex.stocks.find((stock) => stock.offExchangeFundCount > 0 && stock.portfolioOnExchangeFundCount === 0);
    ok(emptyStock, "当前索引缺少可验证场内空分类的真实证券");
    await ready(empty.page, url, emptyStock.code);
    const tab = empty.page.getByRole("tab", { name: "场内 ETF / LOF" });
    await tab.click();
    const panel = empty.page.getByRole("tabpanel", { name: "场内 ETF / LOF" });
    await panel.focus();
    assert.equal(await panel.getAttribute("tabindex"), "0");
    await panel.getByText("该分类暂无匹配基金。未出现不代表未持有。").waitFor();
    result.emptyOnExchange = { stockCode: emptyStock.code };
  } finally {
    network(empty, "空分类最终", [/LeverageDashboard|LeverageChart|LeverageControls|echarts|zrender/i]);
    await empty.context.close();
  }
}
async function detailsAndFailure(browser, url, fixtureSource, result) {
  const normal = await scenario(browser, url, { width: 1440, height: 1024 });
  try {
    await ready(normal.page, url, "00700");
    const trigger = await detailsButton(normal.page);
    await trigger.click();
    const dialog = normal.page.getByRole("dialog");
    await dialog.waitFor();
    await dialog.locator("ol li").first().waitFor();
    const count = await dialog.locator("ol li").count();
    ok(count > 0 && count <= 10, "available 详情不是 1–10 行");
    await normal.page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    await normal.page.waitForFunction(() =>
      document.activeElement?.getAttribute("aria-label")?.includes("基金详情"),
    );
    result.availableDetail = true;
  } finally {
    network(normal, "详情可用最终", [/LeverageDashboard|LeverageChart|LeverageControls|echarts|zrender/i]);
    await normal.context.close();
  }
  const info = await fixture(fixtureSource.preview, fixtureSource.temp);
  const absent = await scenario(browser, url, { width: 1440, height: 1024 });
  try {
    await ready(absent.page, url, "00700");
    const absentMore = absent.page.getByRole("button", { name: /^更多（/ });
    if (await absentMore.count()) await absentMore.click();
    await (await detailsButton(absent.page)).click();
    const dialog = absent.page.getByRole("dialog");
    await dialog.waitFor();
    await dialog.getByText(/QA 临时夹具：当前已采集公开股票明细未包含详情/).waitFor();
    const detailText = await dialog.innerText();
    ok(detailText.includes("QA 临时夹具：当前已采集公开股票明细未包含详情。"), `not-captured 文案缺失：${detailText}`);
    ok(detailText.includes("未出现不代表未持有"), `not-captured 未披露边界：${detailText}`);
    ok(
      !detailText.includes("暂无持仓记录"),
      "not-captured 被伪装为空详情",
    );
    result.notCaptured = info.path;
  } finally {
    network(absent, "详情未采集最终", [/LeverageDashboard|LeverageChart|LeverageControls|echarts|zrender/i]);
    await absent.context.close();
  }
  const unavailable = await scenario(browser, url, { width: 1440, height: 1024 });
  const detailPath = new RegExp(info.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const abortDetail = (route) => route.abort("failed");
  await unavailable.context.route(detailPath, abortDetail);
  try {
    await ready(unavailable.page, url, "00700");
    const unavailableMore = unavailable.page.getByRole("button", { name: /^更多（/ });
    if (await unavailableMore.count()) await unavailableMore.click();
    await (await detailsButton(unavailable.page)).click();
    const dialog = unavailable.page.getByRole("dialog");
    await dialog.getByRole("alert").waitFor();
    const retry = dialog.getByRole("button", { name: "重试详情" });
    await retry.waitFor();
    const requestedBeforeRetry = unavailable.requests.filter((item) => detailPath.test(item)).length;
    await unavailable.context.unroute(detailPath, abortDetail);
    await retry.click();
    await dialog.getByText("QA 临时夹具：当前已采集公开股票明细未包含详情。").waitFor();
    ok(
      unavailable.requests.filter((item) => detailPath.test(item)).length > requestedBeforeRetry,
      "详情重试未重新请求分片",
    );
    result.unavailableDetail = { retried: true };
  } finally {
    network(unavailable, "详情不可用后重试最终", [/LeverageDashboard|LeverageChart|LeverageControls|echarts|zrender/i], [], [detailPath]);
    await unavailable.context.close();
  }
  const blocked = await scenario(browser, url, { width: 1440, height: 1024 });
  const abortTsm = (route) => route.abort("failed");
  const tsmShardPath = stockShardPathPattern("TSM");
  try {
    await ready(blocked.page, url, "NVDA");
    await blocked.context.route(tsmShardPath, abortTsm);
    await add(blocked.page, "TSM");
    await blocked.page
      .getByRole("alert")
      .waitFor({ state: "visible", timeout: 30000 });
    assert.equal(
      await blocked.page.locator(".portfolio-fund-row").count(),
      0,
      "股票分片失败仍显示了基金行",
    );
    assert.equal(
      await blocked.page.getByLabel("市场环境").count(),
      0,
      "股票分片失败仍加载摘要",
    );
    const blockedText = await normalTextEvidence(blocked.page);
    const blockedNotice = blockedText.find((item) => item.selector === ".portfolio-blocked");
    ok(blockedNotice && blockedNotice.contrast >= 4.5, "阻断状态普通文本未达到 4.5:1");
    await blocked.page.getByRole("button", { name: /^移除 .* TSM$/ }).click();
    await blocked.context.unroute(tsmShardPath, abortTsm);
    await blocked.page.locator(".portfolio-fund-row").first().waitFor({ state: "visible", timeout: 30000 });
    await blocked.page.locator(".research-market-details > summary").waitFor();
    result.blocked = { removedFailedStockAndRecovered: true, blockedNotice };
  } finally {
    network(blocked, "阻断并移除恢复最终", [/LeverageDashboard|LeverageChart|LeverageControls|echarts|zrender/i], [], [tsmShardPath]);
    await blocked.context.close();
  }
  const summaryFail = await scenario(
    browser,
    url,
    { width: 1440, height: 1024 },
    (context) =>
      context.route(/\/data\/leverage-dashboard\.json(?:\?|$)/, (route) =>
        route.abort("failed"),
      ),
  );
  try {
    await ready(summaryFail.page, url);
    await summaryFail.page.locator(".research-market-details > summary").click();
    ok(
      (await summaryFail.page.locator(".portfolio-fund-row").count()) > 0,
      "摘要失败清空了组合结果",
    );
    await summaryFail.page
      .getByLabel("市场环境")
      .getByText("摘要暂不可用")
      .waitFor({ state: "visible", timeout: 30000 });
    const fallbackLink = summaryFail.page.getByLabel("市场环境").getByRole("link", { name: "打开完整两融数据看板" });
    assert.equal(await fallbackLink.getAttribute("href"), "/leverage");
    await target(fallbackLink, "摘要失败完整看板链接");
    await focusEvidence(fallbackLink, "摘要失败完整看板链接");
    result.summaryFallback = true;
  } finally {
    network(summaryFail, "摘要失败降级最终", [/LeverageDashboard|LeverageChart|LeverageControls|echarts|zrender/i], [], [/leverage-dashboard\.json(?:\?|$)/]);
    await summaryFail.context.close();
  }
}
async function viewportMatrix(browser, url, result) {
  result.viewports = {};
  for (const viewport of [
    { width: 1440, height: 1024 },
    { width: 768, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 900 },
  ]) {
    const state = await scenario(browser, url, viewport);
    try {
      const { page } = state;
      await ready(page, url);
      const editorLayout = await portfolioEditorLayout(page, `${viewport.width}px 编辑区`, {
        wide: viewport.width >= 1024,
        stacked: viewport.width <= 720,
      });
      const picker = page.getByRole("combobox", { name: "检索添加股票" });
      await picker.click();
      await picker.fill("台湾积体");
      await page
        .getByRole("listbox", { name: "匹配股票" })
        .waitFor({ state: "visible" });
      const pickerOverflow = await overflow(page, `${viewport.width}px 展开组合检索`);
      await picker.press("Escape");
      await add(page, "TSM");
      await page.getByRole("button", { name: /^移除 .* TSM$/ }).click();
      await page.getByRole("tab", { name: "场内 ETF / LOF" }).click();
      const detail = page.getByRole("tabpanel").getByRole("button", { name: /查看 .* 基金详情/ }).first();
      await detail.click();
      await page.getByRole("dialog").waitFor();
      await page.keyboard.press("Escape");
      // 枚举当前视口每个可见、可用的工作台控件；nth 在此是完整枚举，不用于消除选择器歧义。
      const controls = await auditVisibleControls(page, `${viewport.width}px`);
      const text = await normalTextEvidence(page);
      text.forEach((item) => ok(item.contrast >= 4.5, `${viewport.width}px ${item.selector} 普通文本对比度 ${item.contrast} < 4.5`));
      result.viewports[viewport.width] = {
        ...(await overflow(page, `${viewport.width}px`)),
        pickerOverflow,
        controls,
        text,
        editorLayout,
      };
    } finally {
      network(state, `${viewport.width}px 最终`, [/LeverageDashboard|LeverageChart|LeverageControls|echarts|zrender/i]);
      await state.context.close();
    }
  }
}

let temp = null,
  local = null,
  browser = null,
  failure = null;
const result = {
  status: "running",
  command: "npm run qa:research",
  build: null,
  scenarios: {},
  cleanup: { serverClosed: false, temporaryRootRemoved: false },
  failure: null,
};
try {
  temp = await mkdtemp(join(tmpParent, prefix));
  ok(safeTmp(temp), "临时目录不安全");
  const preview = join(temp, "preview");
  await runVite(preview);
  result.build = {
    chunks: (await readdir(join(preview, "assets"))).filter((item) =>
      /^(index|LeverageMarketSummary|LeverageDashboard|echarts)-.*\.(js|css)$/.test(
        item,
      ),
    ),
    seoGeneration: false,
  };
  await access(chrome, fsConstants.F_OK);
  const { chromium } = await import("playwright");
  browser = await chromium.launch({ headless: true, executablePath: chrome });
  local = await serve(preview, temp);
  await emptyLazy(browser, local.url, result.scenarios);
  await readySummaryTabs(browser, local.url, result.scenarios);
  await selectionAndLimit(browser, local.url, result.scenarios);
  await storageGuards(browser, local.url, result.scenarios);
  await paginationAndEmpty(browser, local.url, result.scenarios);
  await detailsAndFailure(browser, local.url, { preview, temp }, result.scenarios);
  await viewportMatrix(browser, local.url, result.scenarios);
  result.status = "passed";
} catch (error) {
  failure = error;
  result.status = "failed";
  result.failure = error instanceof Error ? error.message : String(error);
} finally {
  try {
    if (browser) await browser.close();
    if (local) await stop(local.server);
    result.cleanup.serverClosed = true;
  } catch (error) {
    failure ??= error;
    result.status = "failed";
    result.failure ??= String(error);
  }
  try {
    if (temp) {
      ok(safeTmp(temp), "拒绝删除不安全目录");
      await rm(temp, { recursive: true, force: true });
      try {
        await access(temp, fsConstants.F_OK);
        throw new Error("临时目录仍存在");
      } catch (error) {
        if (error?.code === "ENOENT")
          result.cleanup.temporaryRootRemoved = true;
        else throw error;
      }
    }
  } catch (error) {
    failure ??= error;
    result.status = "failed";
    result.failure ??= String(error);
  }
}
console.log(JSON.stringify(result, null, 2));
if (failure || result.status !== "passed") process.exitCode = 1;
