// 一次性诊断：dev server 首屏各阶段耗时（不属于发布流程）。
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

// 仓库根目录：由脚本自身位置推导，避免硬编码绝对路径。
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PORT = 5203;
const BASE = `http://127.0.0.1:${PORT}`;
const log = [];
const note = (...a) => log.push(a.join(" "));

const t0 = Date.now();
const server = await createServer({
  root: ROOT,
  server: { host: "127.0.0.1", port: PORT, strictPort: true },
  logLevel: "info",
});
await server.listen();
note(`server.listen 完成: ${Date.now() - t0} ms`);

async function timed(label, url) {
  const s = Date.now();
  try {
    const res = await fetch(BASE + url, { signal: AbortSignal.timeout(180000) });
    const body = await res.text();
    note(`${label.padEnd(28)} ${String(Date.now() - s).padStart(7)} ms  status=${res.status} bytes=${body.length}`);
    return body;
  } catch (e) {
    note(`${label.padEnd(28)} 失败: ${e.message}`);
    return "";
  }
}

await timed("GET /", "/");
await timed("GET /research", "/research");
await timed("GET /src/main.tsx", "/src/main.tsx");
const appJs = await timed("GET /src/App.tsx", "/src/App.tsx");
await timed("GET /src/styles.css", "/src/styles.css");
await timed("GET /src/portfolio/PortfolioWorkbench.tsx", "/src/portfolio/PortfolioWorkbench.tsx");
await timed("GET /src/leverage/LeverageMarketSummary.tsx", "/src/leverage/LeverageMarketSummary.tsx");

// 第二次请求应命中转换缓存
note("--- 二次请求（应命中缓存）---");
await timed("GET / (2nd)", "/");
await timed("GET /src/App.tsx (2nd)", "/src/App.tsx");

note(`App.tsx 前 300 字符: ${appJs.slice(0, 300).replace(/\n/g, "\\n")}`);

await server.close();
await writeFile(resolve(ROOT, "outputs", "_uiaudit_dev_timing.txt"), log.join("\n"), "utf8");
