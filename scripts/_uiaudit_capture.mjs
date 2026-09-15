// 一次性 UI 审计截图脚本（不属于发布流程，仅用于本次 UI/UX 评审基线）。
// 在同一进程内启动 Vite dev server，避免依赖外部常驻服务。
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

// 仓库根目录：由脚本自身位置推导，避免硬编码绝对路径。
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = resolve(ROOT, "outputs", process.env.UI_AUDIT_OUT || "uiaudit");
await mkdir(OUT, { recursive: true });

const log = [];
const note = (...a) => { const l = a.join(" "); log.push(l); };

const PORT = Number(process.env.UI_AUDIT_PORT || 5199);
const BASE = `http://127.0.0.1:${PORT}`;

async function reachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch { return false; }
}

let server = null;
if (await reachable(BASE + "/")) {
  note("复用已运行的 dev server: " + BASE);
} else {
  server = await createServer({
    root: ROOT,
    server: { host: "127.0.0.1", port: PORT, strictPort: true },
    logLevel: "error",
  });
  await server.listen();
  note("vite dev server ready at " + BASE);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });

async function shoot(name, { path, width = 1440, height = 1024, wait = 2000, full = true, ready, action, mobile = false }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    colorScheme: "light",
    ...(mobile ? { isMobile: true, hasTouch: true } : {}),
  });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  try {
    const t0 = Date.now();
    await page.goto(BASE + path, { waitUntil: "load", timeout: 90000 });
    const loadMs = Date.now() - t0;
    await page.waitForTimeout(wait);
    if (ready) await ready(page);
    if (action) await action(page);
    await page.waitForTimeout(600);
    await page.screenshot({ path: resolve(OUT, name + ".png"), fullPage: full });

    const m = await page.evaluate(() => {
      const el = document.documentElement;
      const focusables = [...document.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]:not([tabindex="-1"])')]
        .filter((n) => n.getClientRects().length > 0);
      const small = focusables.filter((n) => { const r = n.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 44 || r.width < 24); });
      // 按「标签.首个类名」聚合小命中区，用于定位到底哪些控件需要补足命中区
      const smallGroups = {};
      for (const n of small) {
        const r = n.getBoundingClientRect();
        const key = `${n.tagName.toLowerCase()}.${String(n.className || "").trim().split(/\s+/)[0] || "-"}`;
        const g = (smallGroups[key] ??= { count: 0, w: Math.round(r.width), h: Math.round(r.height), sample: (n.textContent || "").trim().slice(0, 14) });
        g.count += 1;
      }
      const smallTop = Object.entries(smallGroups).sort((a, b) => b[1].count - a[1].count).slice(0, 14);
      // 真正低于 WCAG 2.2 AA 24×24 门槛的（与 44px 建议区分开）
      const violations = focusables.filter((n) => {
        const r = n.getBoundingClientRect();
        const cs = getComputedStyle(n);
        if (cs.clipPath === "inset(50%)") return false; // 读屏专用，免除命中要求
        return r.width > 0 && r.height > 0 && (r.height < 24 || r.width < 24);
      }).map((n) => {
        const r = n.getBoundingClientRect();
        return `${n.tagName.toLowerCase()}.${String(n.className || "").trim().split(/\s+/)[0] || "-"} ${Math.round(r.width)}x${Math.round(r.height)} "${(n.textContent || "").trim().slice(0, 12)}"`;
      });
      const tiny = [...document.querySelectorAll("*")].filter((n) => {
        if (n.children.length) return false;
        const t = (n.textContent || "").trim(); if (!t) return false;
        const fs = parseFloat(getComputedStyle(n).fontSize);
        return fs > 0 && fs < 12;
      }).map((n) => Math.round(parseFloat(getComputedStyle(n).fontSize)));
      const cs = getComputedStyle(document.body);
      return {
        overflowX: el.scrollWidth - el.clientWidth,
        scrollHeight: document.body.scrollHeight,
        focusable: focusables.length,
        smallTargets: small.length,
        smallTop: smallTop.map(([k, v]) => `${k} x${v.count} (${v.w}x${v.h} "${v.sample}")`),
        violations,
        tinyText: tiny.length,
        tinySizes: [...new Set(tiny)].sort((a, b) => a - b),
        h2: [...document.querySelectorAll("h2")].map((n) => n.textContent.trim()).filter(Boolean),
        shellWidth: Math.round(document.querySelector(".app-shell")?.getBoundingClientRect().width ?? 0),
        bodyFont: cs.fontSize + " " + cs.color,
      };
    });
    note(`[${name}] w=${width} loadMs=${loadMs} overflowX=${m.overflowX} docH=${m.scrollHeight} focusable=${m.focusable} small(<44) =${m.smallTargets} wcagViolations(<24)=${m.violations.length} tinyText=${m.tinyText}@${JSON.stringify(m.tinySizes)} shell=${m.shellWidth}`);
    if (m.violations.length) note(`    ⚠ 低于 24×24 门槛: ${m.violations.join(" | ")}`);
    if (m.smallTargets > 0) note(`    小命中区构成: ${m.smallTop.join(" | ")}`);
    note(`    h2=${JSON.stringify(m.h2)}`);
    if (errors.length) note(`    consoleErrors=${errors.length}: ${errors.slice(0, 3).join(" || ").slice(0, 400)}`);
  } catch (e) {
    note(`[${name}] FAILED: ${e.message?.split("\n")[0]}`);
  }
  await context.close();
}

const readyData = async (page) => { await page.waitForSelector(".portfolio-workbench, .empty-state", { timeout: 60000 }); await page.waitForTimeout(2500); };

await shoot("01-research-empty-desktop", { path: "/research", ready: readyData });
await shoot("02-research-nvda-desktop", { path: "/research?stock=NVDA", ready: readyData, wait: 4000 });
await shoot("03-research-detail-dialog", {
  path: "/research?stock=NVDA", ready: readyData, wait: 4000,
  action: async (page) => {
    const btn = page.locator('.portfolio-row-actions button').nth(1);
    if (await btn.count()) { await btn.first().click(); await page.waitForTimeout(1500); note("    详情弹窗已打开"); }
  },
});
await shoot("04-research-editor-open", {
  path: "/research?stock=NVDA", ready: readyData, wait: 3500,
  action: async (page) => { await page.locator("#portfolio-edit-trigger").click({ timeout: 8000 }); await page.waitForTimeout(900); },
});
await shoot("05-research-hotspot-expand", {
  path: "/research", ready: readyData,
  action: async (page) => {
    const t = page.locator(".ai-hotspot-expand-toggle");
    if (!(await t.count())) { note("    未找到 .ai-hotspot-expand-toggle"); return; }
    const label0 = await t.innerText();
    const beforeVisible = await page.locator(".ai-hotspot-card:visible").count();
    await t.click(); await page.waitForTimeout(700);
    const label1 = await t.innerText();
    const afterVisible = await page.locator(".ai-hotspot-card:visible").count();
    const hasClass = await page.locator(".ai-hotspot-section.is-collapsed").count();
    note(`    热点展开按钮: "${label0.trim()}" -> "${label1.trim()}" | 可见卡片 ${beforeVisible} -> ${afterVisible} | .is-collapsed 数量=${hasClass}`);
  },
});
await shoot("06-research-empty-mobile", { path: "/research", width: 390, height: 844, mobile: true, ready: readyData });
await shoot("07-research-nvda-mobile", { path: "/research?stock=NVDA", width: 390, height: 844, mobile: true, ready: readyData, wait: 4000 });
await shoot("08-leverage-desktop", { path: "/leverage", wait: 4000, height: 1200 });
await shoot("09-concentration-desktop", { path: "/concentration", wait: 4000, height: 1200 });
await shoot("10-methodology-desktop", { path: "/methodology", wait: 1500 });
await shoot("11-leverage-mobile", { path: "/leverage", width: 390, height: 844, mobile: true, wait: 4000 });
await shoot("12-concentration-mobile", { path: "/concentration", width: 390, height: 844, mobile: true, wait: 4000 });

// 键盘可达性 + 悬浮预览是否仅鼠标可用
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 1024 }, colorScheme: "light" });
  const page = await context.newPage();
  try {
    await page.goto(BASE + "/research?stock=NVDA", { waitUntil: "load", timeout: 90000 });
    await readyData(page);
    const seq = [];
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab");
      seq.push(await page.evaluate(() => {
        const a = document.activeElement; if (!a) return "none";
        const cs = getComputedStyle(a); const r = a.getBoundingClientRect();
        return `${a.tagName}.${String(a.className || "").split(" ")[0]} "${(a.textContent || "").trim().slice(0, 12)}" ${cs.outlineStyle}/${cs.outlineWidth} ${Math.round(r.width)}x${Math.round(r.height)}`;
      }));
    }
    note("Tab 焦点序列（前 20）:");
    seq.forEach((s, i) => note(`  ${i + 1}. ${s}`));

    // 跳转链接是否真正跳过顶部导航（先清掉应用自动设置的焦点，否则测不到首个可聚焦元素）
    note("跳转链接验证:");
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    });
    await page.keyboard.press("Tab");
    const skipInfo = await page.evaluate(() => {
      const a = document.activeElement;
      return `${a?.tagName} "${(a?.textContent || "").trim()}" href=${a?.getAttribute("href")}`;
    });
    note(`  首个焦点元素: ${skipInfo}`);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    const afterSkip = await page.evaluate(() => {
      const a = document.activeElement;
      const topbar = document.querySelector(".topbar")?.getBoundingClientRect();
      return `焦点=${a?.tagName}#${a?.id || ""} "${(a?.textContent || "").trim().slice(0, 14)}" | 导航底边=${Math.round(topbar?.bottom ?? -1)} 视口内可见=${a ? a.getBoundingClientRect().top >= 0 && a.getBoundingClientRect().top < window.innerHeight : false}`;
    });
    note(`  回车后: ${afterSkip}`);

    const hc = await page.evaluate(() => document.querySelectorAll(".fund-holdings-action").length);
    note(`  .fund-holdings-action 数量=${hc}（悬浮预览系统已在本次改版中整体移除，同等能力改由行内「持仓」按钮 + 弹窗承担）`);
    // 对比度采样：关键小字色 vs 白底
    const contrast = await page.evaluate(() => {
      const sel = [".metric p", ".summary-card span", ".selected-context span", ".eyeline", ".candidate em", ".fund-code", ".hotspot-title-row em", ".suggestion-meta", ".indirect-note", ".portfolio-result-count"];
      const lum = (c) => { const [r, g, b] = c.match(/\d+/g).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return ((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)).toFixed(2); };
      return sel.map((s) => { const n = document.querySelector(s); if (!n) return `${s}: n/a`; const cs = getComputedStyle(n); let bg = "rgb(255,255,255)"; let p = n; while (p && p !== document.documentElement) { const c = getComputedStyle(p).backgroundColor; if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent") { bg = c; break; } p = p.parentElement; } return `${s}: ${cs.color} on ${bg} = ${ratio(cs.color, bg)}:1 @${cs.fontSize}`; });
    });
    note("对比度抽样:");
    contrast.forEach((c) => note("  " + c));
  } catch (e) { note("键盘序列采集失败: " + e.message?.split("\n")[0]); }
  await context.close();
}

await browser.close();
if (server) await server.close();
await writeFile(resolve(OUT, "audit-log.txt"), log.join("\n"), "utf8");
await writeFile(resolve(ROOT, "outputs", process.env.UI_AUDIT_LOG || "_uiaudit_log.txt"), log.join("\n"), "utf8");
