import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const output = process.env.DASHBOARD_QA_OUTPUT ?? "outputs/ui-ux-optimization-2026-09-05";
const baseUrl = process.env.DASHBOARD_QA_URL ?? "http://127.0.0.1:5180";
await mkdir(output, { recursive: true });
await writeFile(`${output}/dashboard-browser-check.json`, JSON.stringify({ status: "running" }, null, 2), "utf8");
const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const route of ["leverage", "concentration"]) {
    for (const width of [320, 390, 768, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      await page.goto(`${baseUrl}/${route}`, { waitUntil: "domcontentloaded" });
      await page.locator(`.${route}-chart-canvas canvas`).waitFor();
      const size = await page.locator(`.${route}-summary-grid`).evaluate((element) => ({
        columns: getComputedStyle(element).gridTemplateColumns,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        cards: [...element.children].map((card) => ({ width: card.getBoundingClientRect().width, text: card.textContent })),
      }));
      assert.equal(size.overflow, false, `${route}/${width} 页面溢出`);
      if (route === "concentration" && width <= 390) assert.equal(size.columns.split(" ").length, 1);
      const disclosure = page.locator(`.${route}-disclosure details`);
      assert.equal(await disclosure.getAttribute("open"), null);
      await page.locator(".chart-data-table summary").focus();
      await page.keyboard.press("Enter");
      const caption = await page.locator(".chart-data-table caption").textContent();
      await page.getByRole("button", { name: "上一交易日", exact: true }).focus();
      await page.keyboard.press("Enter");
      assert.notEqual(await page.locator(".chart-data-table caption").textContent(), caption);
      const tableBox = await page.locator(".chart-data-table table").boundingBox();
      assert.ok(tableBox.x >= 0 && tableBox.x + tableBox.width <= width, `${route}/${width} 表格溢出`);
      if (route === "concentration") {
        await page.getByRole("checkbox", { name: "创业板指", exact: true }).focus();
        await page.keyboard.press("Space");
        assert.equal(await page.getByRole("checkbox", { name: "创业板指", exact: true }).isChecked(), false);
      } else {
        await page.getByRole("button", { name: "融资余额占市值", exact: true }).focus();
        await page.keyboard.press("Enter");
        assert.match(await page.locator(".leverage-chart-canvas").getAttribute("aria-label"), /融资余额占市值/);
        await page.locator('.leverage-date-range input').nth(1).fill("2025-12-31");
        assert.match(await page.locator(".leverage-summary-primary").textContent(), /统计日：2025-12-31/);
      }
      await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo({ top: 0, behavior: "instant" }); });
      await page.screenshot({ path: `${output}/dashboard-${route}-${width}.png`, fullPage: true });
      results.push({ route, width, ...size, keyboardTable: true, tableWithinViewport: true });
      await page.close();
    }
  }
  for (const route of ["leverage", "concentration"]) {
    const zoomPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await zoomPage.goto(`${baseUrl}/${route}`, { waitUntil: "domcontentloaded" });
    await zoomPage.locator(`.${route}-chart-canvas canvas`).waitFor();
    await zoomPage.locator(`.${route}-dashboard`).evaluate((dashboard) => {
      const elements = [...dashboard.querySelectorAll("h2,p,span,strong,small,label,button,input,summary,em,legend,li")];
      const sizes = elements.map((element) => Number.parseFloat(getComputedStyle(element).fontSize));
      elements.forEach((element, index) => { element.style.fontSize = `${sizes[index] * 2}px`; });
    });
    const zoomOverflow = await zoomPage.locator(`.${route}-dashboard`).evaluate((dashboard) => dashboard.scrollWidth > dashboard.clientWidth);
    assert.equal(zoomOverflow, false, `${route} 200%文字缩放溢出`);
    await zoomPage.screenshot({ path: `${output}/dashboard-${route}-text-200.png`, fullPage: true });
    results.push({ route, textZoom: "200%", overflow: zoomOverflow });
    await zoomPage.close();
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route("**/data/trading-concentration-dashboard.json", (route) => route.abort("failed"));
  await page.goto(`${baseUrl}/concentration`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "数据读取失败", exact: true }).waitFor();
  assert.match(await page.locator(".concentration-dashboard-state p").first().textContent(), /检查网络.*重试/);
  await page.unroute("**/data/trading-concentration-dashboard.json");
  await page.getByRole("button", { name: "重新加载", exact: true }).click();
  await page.locator(".concentration-chart-canvas canvas").waitFor();
  results.push({ retryAfterNetworkFailure: true });
  await page.close();
  await writeFile(`${output}/dashboard-browser-check.json`, JSON.stringify({ status: "passed", results }, null, 2), "utf8");
  console.log(JSON.stringify({ status: "passed", cases: results.length, output }));
} catch (error) {
  await writeFile(`${output}/dashboard-browser-check.json`, JSON.stringify({ status: "failed", reason: String(error), results }, null, 2), "utf8");
  throw error;
} finally {
  await browser.close();
}
