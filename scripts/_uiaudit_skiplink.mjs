// 一次性验证：跳转链接是否真正落到导航之后的正文标题（不属于发布流程）。
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { chromium } from "playwright";

// 仓库根目录：由脚本自身位置推导，避免硬编码绝对路径。
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = 5209;
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
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: "light" });
const page = await context.newPage();

for (const path of ["/research", "/leverage", "/concentration", "/methodology"]) {
  await page.goto(BASE + path, { waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(3500);
  const href = await page.evaluate(() => document.querySelector("a.skip-link")?.getAttribute("href") ?? null);
  await page.evaluate(() => document.querySelector("a.skip-link")?.focus());
  const focusedBefore = await page.evaluate(() => document.activeElement?.className ?? "none");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => {
    const a = document.activeElement;
    const topbarBottom = document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? -1;
    const r = a?.getBoundingClientRect();
    const insideViewport = r ? r.top >= 0 && r.bottom <= window.innerHeight + 1 : false;
    return {
      tag: a?.tagName ?? "none",
      id: a?.id ?? "",
      text: (a?.textContent ?? "").trim().slice(0, 16),
      topbarBottom: Math.round(topbarBottom),
      top: r ? Math.round(r.top) : null,
      insideViewport,
      scrollY: Math.round(window.scrollY),
    };
  });
  const ok = after.id && after.top !== null && after.top >= after.topbarBottom;
  note(`${path}  href=${href}  链接获得焦点=${focusedBefore === "skip-link"}  回车后焦点=<${after.tag} id="${after.id}"> "${after.text}"  元素top=${after.top} 导航底边=${after.topbarBottom}  落在导航下方=${ok ? "是 ✅" : "否 ❌"}  scrollY=${after.scrollY}`);
}

await browser.close();
await server.close();
await writeFile(resolve(ROOT, "outputs", "_uiaudit_skiplink.txt"), log.join("\n"), "utf8");
