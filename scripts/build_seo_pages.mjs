import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const SITE_URL = "https://fund.niliangrui.cloud";
const DATA_PATH = path.join("public", "data", "fund-stock-index-2026q1.json");
const STOCKS_DIR = path.join("public", "stocks");
const SEO_DIR = path.join("public", "seo");
const LASTMOD = process.env.SEO_LASTMOD || new Date().toISOString().slice(0, 10);

const targetCodes = [
  "NVDA",
  "TSM",
  "00700",
  "09988",
  "GOOGL",
  "AVGO",
  "ASML",
  "MSFT",
  "AAPL",
  "AMZN",
  "TSLA",
  "005930",
  "META",
  "AMD",
];

const valueFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 2,
});
const integerFormatter = new Intl.NumberFormat("zh-CN");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatWan(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "未披露";
  }
  if (value >= 10000) {
    return `${valueFormatter.format(value / 10000)} 亿元`;
  }
  return `${valueFormatter.format(value)} 万元`;
}

function slugFor(code) {
  return String(code).trim().toLowerCase().replace(/[^0-9a-z]+/g, "-");
}

function fundDisplayName(fund) {
  return fund.fundVariantCount && fund.fundVariantCount > 1 && fund.fundDisplayName
    ? fund.fundDisplayName
    : fund.fundName;
}

function uniqueFundCodes(fund) {
  return Array.from(new Set([fund.fundCode, ...(fund.fundVariantCodes ?? [])].filter(Boolean)));
}

function fundRows(funds) {
  if (!funds?.length) {
    return `<tr><td colspan="5" class="empty-row">暂无该口径持仓记录</td></tr>`;
  }

  return funds
    .slice(0, 5)
    .map((fund, index) => {
      const codes = uniqueFundCodes(fund).join(" / ");
      return `<tr>
        <td><span class="rank">${index + 1}</span></td>
        <td>
          <strong>${escapeHtml(fundDisplayName(fund))}</strong>
          <small>${escapeHtml(codes)}</small>
        </td>
        <td>${escapeHtml(fund.fundType || "未分类")}</td>
        <td><b>${valueFormatter.format(fund.ratioPercent)}%</b></td>
        <td>${escapeHtml(formatWan(fund.marketValueWan))}</td>
      </tr>`;
    })
    .join("\n");
}

function stockPage(stock, meta) {
  const slug = slugFor(stock.code);
  const canonical = `${SITE_URL}/stocks/${slug}/`;
  const appUrl = `/?q=${encodeURIComponent(stock.code)}`;
  const title = `${stock.name}（${stock.code}）被哪些国内基金重仓？${meta.report} 公募持仓穿透`;
  const description = `${stock.name}（${stock.code}）${meta.report} 被 ${stock.activeFundCount} 只场外基金持有，最高净值占比 ${valueFormatter.format(stock.maxRatioPercent)}%，场内 ETF/LOF 持仓基金 ${stock.onExchangeFundCount ?? 0} 只。`;

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${canonical}" />
    <link rel="stylesheet" href="/seo/stock-page.css" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="出海钱眼" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${SITE_URL}/og-image.svg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${SITE_URL}/og-image.svg" />
  </head>
  <body>
    <main class="page-shell">
      <nav class="topbar" aria-label="站点导航">
        <a class="brand" href="/">出海钱眼</a>
        <span>${escapeHtml(meta.report)} · 数据截至 ${escapeHtml(meta.cutoffDate)}</span>
      </nav>

      <section class="hero">
        <p class="eyebrow">海外股票基金持仓穿透</p>
        <h1>${escapeHtml(stock.name)}（${escapeHtml(stock.code)}）被哪些国内基金重仓？</h1>
        <p class="lead">${escapeHtml(description)}本页仅展示公开基金定期报告快照，不构成投资建议或基金推荐。</p>
        <div class="actions">
          <a class="primary-action" href="${appUrl}">打开完整查询</a>
          <button class="secondary-action share-action" type="button" data-share-url="${canonical}" data-share-title="${escapeHtml(title)}">分享页面</button>
        </div>
      </section>

      <section class="metric-grid" aria-label="持仓概览">
        <article>
          <span>场外持有基金</span>
          <strong>${integerFormatter.format(stock.activeFundCount)}</strong>
        </article>
        <article>
          <span>场内 ETF/LOF</span>
          <strong>${integerFormatter.format(stock.onExchangeFundCount ?? 0)}</strong>
        </article>
        <article>
          <span>场外最高净值占比</span>
          <strong>${valueFormatter.format(stock.maxRatioPercent)}%</strong>
        </article>
        <article>
          <span>场外持仓市值</span>
          <strong>${escapeHtml(formatWan(stock.totalMarketValueWan))}</strong>
        </article>
      </section>

      <section class="table-section">
        <div class="section-heading">
          <p>按净值占比排序</p>
          <h2>场外基金前 5 名</h2>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>排名</th>
                <th>基金</th>
                <th>类型</th>
                <th>净值占比</th>
                <th>持仓市值</th>
              </tr>
            </thead>
            <tbody>${fundRows(stock.topByRatio)}</tbody>
          </table>
        </div>
      </section>

      <section class="table-section">
        <div class="section-heading">
          <p>ETF / LOF / 封闭基金口径</p>
          <h2>场内基金前 5 名</h2>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>排名</th>
                <th>基金</th>
                <th>类型</th>
                <th>净值占比</th>
                <th>持仓市值</th>
              </tr>
            </thead>
            <tbody>${fundRows(stock.topOnExchangeByRatio ?? [])}</tbody>
          </table>
        </div>
      </section>

      <section class="notice">
        <h2>数据和风险提示</h2>
        <p>数据来自公开基金持仓明细整理，当前快照为 ${escapeHtml(meta.report)}，截至 ${escapeHtml(meta.cutoffDate)}。基金持仓、申购赎回、费率和限额可能存在披露滞后或实时变化，请以基金管理人、销售机构及监管披露文件为准。</p>
        <p>本页仅用于信息展示和研究参考，不构成投资建议、基金推荐、销售邀约或收益承诺。基金有风险，投资需谨慎。</p>
      </section>
    </main>
    <script src="/seo/share.js" defer></script>
  </body>
</html>
`;
}

function stockPageCss() {
  return `:root {
  color: #171b20;
  background: #f5f7fa;
  font-family: "PingFang SC", "Microsoft YaHei UI", system-ui, sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  --ink: #171b20;
  --muted: #637083;
  --line: #dde4ee;
  --surface: #ffffff;
  --surface-soft: #f8fafc;
  --accent: #ff3b30;
  --accent-soft: rgba(255, 59, 48, 0.08);
  --shadow: 0 16px 44px rgba(15, 23, 42, 0.08);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background:
    radial-gradient(circle at 8% 10%, rgba(255, 59, 48, 0.06), transparent 36%),
    linear-gradient(180deg, #f7f9fc 0%, #eff3f7 100%);
}

a {
  color: inherit;
}

button {
  font: inherit;
}

.page-shell {
  width: min(1120px, calc(100% - 32px));
  margin: 0 auto;
  padding: 22px 0 56px;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
  color: var(--muted);
  font-size: 14px;
}

.brand {
  color: var(--ink);
  font-size: 18px;
  font-weight: 900;
  text-decoration: none;
}

.hero {
  padding: 48px 0 30px;
}

.eyebrow,
.section-heading p {
  margin: 0 0 10px;
  color: var(--accent);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 1.3px;
  text-transform: uppercase;
}

h1 {
  max-width: 900px;
  margin: 0;
  color: var(--ink);
  font-size: clamp(34px, 7vw, 66px);
  line-height: 1.05;
  letter-spacing: 0;
}

.lead {
  max-width: 760px;
  margin: 18px 0 0;
  color: var(--muted);
  font-size: 18px;
  line-height: 1.8;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
}

.primary-action,
.secondary-action {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  padding: 0 18px;
  font-weight: 800;
}

.primary-action {
  border: 1px solid #161a20;
  background: #161a20;
  color: #fff;
  text-decoration: none;
}

.secondary-action {
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
}

.metric-grid article,
.table-section,
.notice {
  border: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.86);
  box-shadow: var(--shadow);
}

.metric-grid article {
  min-height: 112px;
  padding: 20px;
  border-radius: 8px;
}

.metric-grid span {
  display: block;
  color: var(--muted);
  font-size: 13px;
}

.metric-grid strong {
  display: block;
  margin-top: 10px;
  color: var(--ink);
  font-size: 28px;
  line-height: 1.1;
}

.table-section,
.notice {
  margin-top: 18px;
  border-radius: 8px;
  padding: 22px;
}

.section-heading {
  margin-bottom: 14px;
}

.section-heading h2,
.notice h2 {
  margin: 0;
  color: var(--ink);
  font-size: 24px;
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  min-width: 760px;
  border-collapse: collapse;
}

th,
td {
  border-top: 1px solid var(--line);
  padding: 15px 12px;
  text-align: left;
  vertical-align: top;
}

th {
  color: var(--muted);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0.7px;
}

td strong,
td b {
  color: var(--ink);
}

td small {
  display: block;
  margin-top: 5px;
  color: var(--muted);
  font-family: "JetBrains Mono", ui-monospace, monospace;
  font-size: 12px;
}

.rank {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 900;
}

.empty-row {
  color: var(--muted);
}

.notice p {
  margin: 12px 0 0;
  color: var(--muted);
  line-height: 1.8;
}

.share-copied {
  border-color: rgba(22, 163, 74, 0.35);
  color: #15803d;
}

@media (max-width: 820px) {
  .topbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .hero {
    padding-top: 34px;
  }

  .lead {
    font-size: 16px;
  }

  .metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .page-shell {
    width: min(100% - 24px, 1120px);
  }

  .metric-grid {
    grid-template-columns: 1fr;
  }

  .table-section,
  .notice {
    padding: 16px;
  }
}
`;
}

function shareJs() {
  return `const buttons = document.querySelectorAll(".share-action");

for (const button of buttons) {
  button.addEventListener("click", async () => {
    const url = button.dataset.shareUrl || window.location.href;
    const title = button.dataset.shareTitle || document.title;

    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }

      await navigator.clipboard.writeText(url);
      const originalText = button.textContent;
      button.textContent = "已复制链接";
      button.classList.add("share-copied");
      window.setTimeout(() => {
        button.textContent = originalText || "分享页面";
        button.classList.remove("share-copied");
      }, 1800);
    } catch {
      button.textContent = "复制失败";
      window.setTimeout(() => {
        button.textContent = "分享页面";
      }, 1800);
    }
  });
}
`;
}

function ogImage() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f8fafc"/>
      <stop offset="1" stop-color="#eef2f7"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="115" cy="105" r="170" fill="#ff3b30" opacity="0.08"/>
  <rect x="72" y="72" width="1056" height="486" rx="28" fill="#ffffff" stroke="#dde4ee"/>
  <text x="112" y="158" fill="#ff3b30" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="28" font-weight="800" letter-spacing="5">POSITION INTELLIGENCE</text>
  <text x="112" y="265" fill="#171b20" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="78" font-weight="900">出海钱眼</text>
  <text x="112" y="352" fill="#171b20" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="48" font-weight="800">海外股票基金持仓穿透查询</text>
  <text x="112" y="432" fill="#637083" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="30">输入海外股票，反查国内基金重仓持有情况</text>
  <text x="112" y="506" fill="#637083" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="24">fund.niliangrui.cloud</text>
</svg>
`;
}

function sitemap(stockUrls) {
  const urls = [
    { loc: `${SITE_URL}/`, priority: "1.0" },
    ...stockUrls.map((loc) => ({ loc, priority: "0.8" })),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${LASTMOD}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${url.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;
}

async function main() {
  const payload = JSON.parse(await readFile(DATA_PATH, "utf8"));
  const stocksByCode = new Map(payload.stocks.map((stock) => [stock.code.toUpperCase(), stock]));
  const selectedStocks = targetCodes.map((code) => stocksByCode.get(code)).filter(Boolean);

  if (selectedStocks.length !== targetCodes.length) {
    const missing = targetCodes.filter((code) => !stocksByCode.has(code));
    throw new Error(`Missing SEO stock records: ${missing.join(", ")}`);
  }

  await rm(STOCKS_DIR, { recursive: true, force: true });
  await mkdir(STOCKS_DIR, { recursive: true });
  await mkdir(SEO_DIR, { recursive: true });

  const stockUrls = [];
  for (const stock of selectedStocks) {
    const slug = slugFor(stock.code);
    const pageDir = path.join(STOCKS_DIR, slug);
    await mkdir(pageDir, { recursive: true });
    await writeFile(path.join(pageDir, "index.html"), stockPage(stock, payload.meta), "utf8");
    stockUrls.push(`${SITE_URL}/stocks/${slug}/`);
  }

  await writeFile(path.join(SEO_DIR, "stock-page.css"), stockPageCss(), "utf8");
  await writeFile(path.join(SEO_DIR, "share.js"), shareJs(), "utf8");
  await writeFile(path.join("public", "og-image.svg"), ogImage(), "utf8");
  await writeFile(path.join("public", "sitemap.xml"), sitemap(stockUrls), "utf8");
  await writeFile(
    path.join("public", "robots.txt"),
    `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${SITE_URL}/sitemap.xml
`,
    "utf8",
  );

  console.log(`Generated ${selectedStocks.length} SEO stock pages and sitemap.xml`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
