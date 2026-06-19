import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadQuarterConfig } from "./quarter-config.mjs";

const SITE_URL = "https://fund.niliangrui.cloud";
const STOCKS_DIR = path.join("public", "stocks");
const SEO_DIR = path.join("public", "seo");
const LASTMOD = process.env.SEO_LASTMOD || new Date().toISOString().slice(0, 10);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toBrowserPath(filePath) {
  return filePath.replace(/\\/g, "/").replace(/^public\//, "");
}

function fileNameFromBrowserPath(filePath) {
  const normalized = toBrowserPath(filePath);
  const parts = normalized.split("/");
  return parts[parts.length - 1] || normalized;
}

function sitemap() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${LASTMOD}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;
}

function ogImage(report) {
  return `<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#f7fbff"/>
      <stop offset="0.55" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#eef5ff"/>
    </linearGradient>
    <linearGradient id="nav" x1="0" x2="1">
      <stop offset="0" stop-color="#0d1524"/>
      <stop offset="1" stop-color="#172947"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="72" y="72" width="1056" height="72" rx="10" fill="url(#nav)"/>
  <rect x="104" y="93" width="116" height="30" rx="7" fill="#f01824"/>
  <text x="124" y="115" fill="#ffffff" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="16" font-weight="900">出海钱眼</text>
  <text x="244" y="116" fill="#ffffff" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="24" font-weight="900">基金持仓穿透</text>
  <rect x="72" y="166" width="680" height="94" rx="10" fill="#ffffff" stroke="#dce5ef"/>
  <rect x="776" y="166" width="352" height="94" rx="10" fill="#ffffff" stroke="#dce5ef"/>
  <text x="112" y="204" fill="#64748b" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="20" font-weight="700">全球股票 / 指数 / ETF</text>
  <text x="112" y="239" fill="#0d1524" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="34" font-weight="900">公募基金持仓穿透查询</text>
  <text x="808" y="205" fill="#64748b" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="20" font-weight="700">数据期</text>
  <text x="808" y="239" fill="#0d1524" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="34" font-weight="900">${escapeHtml(report)}</text>
  <rect x="72" y="292" width="320" height="222" rx="10" fill="#ffffff" stroke="#dce5ef"/>
  <rect x="408" y="292" width="720" height="222" rx="10" fill="#ffffff" stroke="#dce5ef"/>
  <rect x="72" y="292" width="320" height="64" rx="10" fill="#101d31"/>
  <text x="104" y="333" fill="#ffffff" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="24" font-weight="900">海外热门</text>
  <circle cx="122" cy="408" r="24" fill="#eef5ff" stroke="#d9e4ef"/>
  <text x="166" y="401" fill="#0d1524" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="24" font-weight="900">股票品牌图标</text>
  <text x="166" y="436" fill="#64748b" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="19">基金覆盖、权重、交易状态</text>
  <text x="448" y="352" fill="#1769e8" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="20" font-weight="800">当前海外标的</text>
  <text x="448" y="407" fill="#0d1524" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="48" font-weight="900">谁在重仓这只股票？</text>
  <rect x="448" y="442" width="168" height="42" rx="21" fill="#fff0f1"/>
  <text x="484" y="470" fill="#f01824" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="20" font-weight="900">场外样本</text>
  <rect x="634" y="442" width="168" height="42" rx="21" fill="#eef5ff"/>
  <text x="670" y="470" fill="#1769e8" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="20" font-weight="900">场内样本</text>
  <text x="72" y="570" fill="#64748b" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="24">fund.niliangrui.cloud</text>
</svg>
`;
}

function releaseCheckManifest(quarterConfig, payload) {
  const dataPath = toBrowserPath(quarterConfig.paths.fundStockIndexJson);

  return `${JSON.stringify(
    {
      version: 1,
      report: quarterConfig.report,
      cutoffDate: quarterConfig.cutoffDate,
      dataPath,
      dataFileName: fileNameFromBrowserPath(dataPath),
      dataMeta: {
        report: payload.meta.report,
        cutoffDate: payload.meta.cutoffDate,
        generatedAt: payload.meta.generatedAt,
        sourceFile: payload.meta.sourceFile,
        stockCount: payload.meta.stockCount,
        overseasStockCount: payload.meta.overseasStockCount,
        shippedStockScope: payload.meta.shippedStockScope,
        shippedStockCount: payload.meta.shippedStockCount,
      },
      seo: {
        siteUrl: SITE_URL,
        lastmod: LASTMOD,
        stockPageCount: 0,
        sampleStock: null,
        staticFiles: ["og-image.svg", "sitemap.xml", "robots.txt"],
      },
      checks: {
        reportMatchesData: payload.meta.report === quarterConfig.report,
        cutoffDateMatchesData: payload.meta.cutoffDate === quarterConfig.cutoffDate,
        seoUsesConfiguredDataFile: true,
      },
    },
    null,
    2,
  )}\n`;
}

async function main() {
  const quarterConfig = await loadQuarterConfig();
  const dataPath = quarterConfig.paths.fundStockIndexJson;
  const payload = JSON.parse(await readFile(dataPath, "utf8"));
  if (payload?.meta?.report !== quarterConfig.report) {
    throw new Error(
      `Configured quarter is ${quarterConfig.report}, but ${dataPath} contains ${payload?.meta?.report || "unknown"}.`,
    );
  }
  if (payload?.meta?.cutoffDate !== quarterConfig.cutoffDate) {
    throw new Error(
      `Configured cutoffDate is ${quarterConfig.cutoffDate}, but ${dataPath} contains ${payload?.meta?.cutoffDate || "unknown"}.`,
    );
  }

  await rm(STOCKS_DIR, { recursive: true, force: true });
  await mkdir(SEO_DIR, { recursive: true });
  await rm(path.join(SEO_DIR, "stock-page.css"), { force: true });
  await rm(path.join(SEO_DIR, "share.js"), { force: true });

  await writeFile(quarterConfig.paths.releaseCheckJson, releaseCheckManifest(quarterConfig, payload), "utf8");
  await writeFile(path.join("public", "og-image.svg"), ogImage(quarterConfig.report), "utf8");
  await writeFile(path.join("public", "sitemap.xml"), sitemap(), "utf8");
  await writeFile(
    path.join("public", "robots.txt"),
    `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${SITE_URL}/sitemap.xml
`,
    "utf8",
  );

  console.log("Generated release assets without static stock pages.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
