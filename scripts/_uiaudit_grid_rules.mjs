// 一次性诊断：找出 .ai-hotspot-grid 在小屏上真正生效的规则来源（不属于发布流程）。
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "playwright";

// 仓库根目录：由脚本自身位置推导，避免硬编码绝对路径。
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = 5204;
const BASE = `http://127.0.0.1:${PORT}`;
const log = [];
const note = (...a) => log.push(a.join(" "));

const server = await createServer({
  root: ROOT,
  server: { host: "127.0.0.1", port: PORT, strictPort: true },
  logLevel: "error",
});
await server.listen();

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
await page.goto(BASE + "/research", { waitUntil: "load", timeout: 90000 });
await page.waitForSelector(".portfolio-workbench, .empty-state", { timeout: 60000 });
await page.waitForTimeout(2500);

const out = await page.evaluate(() => {
  const lines = [];
  const target = document.querySelector(".ai-hotspot-grid");
  if (!target) return ["未找到 .ai-hotspot-grid"];

  const spec = (sel) => {
    // 粗略计算 specificity：id / class+attr+pseudo-class / type+pseudo-element
    const ids = (sel.match(/#[\w-]+/g) || []).length;
    const cls = (sel.match(/[.\[]/g) || []).length + (sel.match(/:(?!:)[\w-]+/g) || []).length;
    const typ = (sel.match(/(^|[\s>+~])[a-zA-Z][\w-]*/g) || []).length;
    return [ids, cls, typ];
  };

  const props = ["grid-template-columns", "grid-auto-flow", "grid-auto-columns", "margin-left", "margin-right", "padding-left", "overflow-x", "display"];
  const matched = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    const walk = (list, media) => {
      for (const rule of list) {
        if (rule.cssRules && rule.conditionText !== undefined && !rule.selectorText) {
          walk(rule.cssRules, rule.conditionText);
          continue;
        }
        if (!rule.selectorText) continue;
        let hit = false;
        try { hit = target.matches(rule.selectorText); } catch { hit = false; }
        if (!hit) continue;
        const decls = [];
        for (const p of props) {
          const v = rule.style.getPropertyValue(p);
          if (v) decls.push(`${p}:${v}`);
        }
        if (!decls.length) continue;
        matched.push({ sel: rule.selectorText, media: media || "-", spec: spec(rule.selectorText), decls: decls.join("; ") });
      }
    };
    walk(rules, null);
  }
  lines.push(`匹配到 ${matched.length} 条声明规则：`);
  for (const m of matched) {
    lines.push(`  [${m.spec.join(",")}] @media(${m.media})  ${m.sel}`);
    lines.push(`        ${m.decls}`);
  }
  const cs = getComputedStyle(target);
  lines.push(`最终计算值: gtc="${cs.gridTemplateColumns}" autoFlow=${cs.gridAutoFlow} autoCols=${cs.gridAutoColumns} margin=${cs.marginLeft}/${cs.marginRight} padding=${cs.paddingLeft} overflowX=${cs.overflowX} w=${Math.round(target.getBoundingClientRect().width)}`);
  const cards = [...document.querySelectorAll(".ai-hotspot-card")].map((c) => Math.round(c.getBoundingClientRect().width));
  lines.push(`各热点卡宽度: ${JSON.stringify(cards)}`);
  return lines;
});
out.forEach((l) => note(l));

await browser.close();
await server.close();
await writeFile(resolve(ROOT, "outputs", "_uiaudit_grid_rules.txt"), log.join("\n"), "utf8");
