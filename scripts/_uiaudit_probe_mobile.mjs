// 一次性探针：定位移动端被压扁的交互控件（不属于发布流程）。
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

// 仓库根目录：由脚本自身位置推导，避免硬编码绝对路径。
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = resolve(ROOT, "outputs", "uiaudit-after");
await mkdir(OUT, { recursive: true });
const log = [];
const note = (...a) => log.push(a.join(" "));

const PORT = 5202;
const BASE = `http://127.0.0.1:${PORT}`;
const server = await createServer({
  root: ROOT,
  server: { host: "127.0.0.1", port: PORT, strictPort: true },
  logLevel: "error",
});
await server.listen();
note("vite ready " + BASE);

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  colorScheme: "light",
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
await page.goto(BASE + "/research", { waitUntil: "load", timeout: 90000 });
await page.waitForSelector(".portfolio-workbench, .empty-state", { timeout: 60000 });
await page.waitForTimeout(3000);

const dump = await page.evaluate(() => {
  const lines = [];
  const grid = document.querySelector(".ai-hotspot-grid");
  const card = document.querySelector(".ai-hotspot-card");
  const noteEl = document.querySelector(".hotspot-note");
  const sum = document.querySelector(".hotspot-note summary");
  const describe = (label, el) => {
    if (!el) { lines.push(`${label}: 不存在`); return; }
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    lines.push(`${label}: ${Math.round(r.width)}x${Math.round(r.height)} @(${Math.round(r.left)},${Math.round(r.top)}) display=${cs.display} writingMode=${cs.writingMode} gridTemplateColumns="${cs.gridTemplateColumns}" flexDirection=${cs.flexDirection} overflow=${cs.overflow} minWidth=${cs.minWidth}`);
  };
  describe("shell", document.querySelector(".app-shell"));
  describe(".ai-hotspot-grid", grid);
  describe(".ai-hotspot-card", card);
  describe(".ai-hotspot-main", document.querySelector(".ai-hotspot-main"));
  describe(".hotspot-note", noteEl);
  describe(".hotspot-note summary", sum);
  if (sum) {
    lines.push(`summary 文本: "${(sum.textContent || "").trim()}"`);
    lines.push(`summary offsetParent chain:`);
    let p = sum.parentElement;
    let d = 0;
    while (p && d < 6) {
      const cs = getComputedStyle(p);
      const r = p.getBoundingClientRect();
      lines.push(`   ${d} <${p.tagName.toLowerCase()} class="${p.className}"> ${Math.round(r.width)}x${Math.round(r.height)} display=${cs.display} gtc="${cs.gridTemplateColumns}"`);
      p = p.parentElement;
      d += 1;
    }
  }
  // 所有 summary
  lines.push("全部 summary:");
  for (const s of document.querySelectorAll("summary")) {
    const r = s.getBoundingClientRect();
    lines.push(`   "${(s.textContent || "").trim().slice(0, 10)}" ${Math.round(r.width)}x${Math.round(r.height)} class="${s.className}"`);
  }
  // 窄于 24px 或矮于 24px 的交互元素
  lines.push("未达 WCAG 2.2 AA 24px 门槛的可交互元素:");
  const all = [...document.querySelectorAll('a[href],button,input:not([type="hidden"]),select,textarea,summary,[tabindex]:not([tabindex="-1"])')]
    .filter((n) => n.getClientRects().length > 0);
  for (const n of all) {
    const r = n.getBoundingClientRect();
    if (r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24)) {
      const cs = getComputedStyle(n);
      lines.push(`   <${n.tagName.toLowerCase()} class="${n.className}"> ${Math.round(r.width)}x${Math.round(r.height)} "${(n.textContent || "").trim().slice(0, 12)}" clip=${cs.clipPath} pos=${cs.position}`);
    }
  }
  return lines;
});
dump.forEach((l) => note(l));

await browser.close();
await server.close();
await writeFile(resolve(ROOT, "outputs", "_uiaudit_probe_mobile.txt"), log.join("\n"), "utf8");
