import { copyFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { loadQuarterConfig } from "./quarter-config.mjs";
import { verifyPortfolioRelease } from "./verify-portfolio-index.mjs";

const SITE_URL = "https://fund.niliangrui.cloud";
const STOCKS_DIR = path.join("public", "stocks");
const SEO_DIR = path.join("public", "seo");
const LASTMOD = process.env.SEO_LASTMOD || new Date().toISOString().slice(0, 10);
const REQUIRED_INDIRECT_EXPOSURE_MAPPINGS = [
  { sourceCode: "7709.HK", targetCode: "000660" },
  { sourceCode: "7747.HK", targetCode: "005930" },
];

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

function indirectExposureAuditBrowserPath(quarterConfig) {
  return `seo/indirect-exposure-audit-${quarterConfig.slug}.md`;
}

function stockHasRequiredIndirectMapping(payload, mapping) {
  const stock = (payload?.stocks ?? []).find((item) => item?.code === mapping.targetCode);
  return (stock?.topIndirectExposureByRatio ?? []).some(
    (row) => row?.sourceCode === mapping.sourceCode && row?.targetCode === mapping.targetCode,
  );
}

function auditHasRequiredIndirectMapping(auditText, mapping) {
  return auditText
    .split(/\r?\n/)
    .some((line) => line.includes(mapping.sourceCode) && line.includes(mapping.targetCode));
}

export async function indirectExposureReleaseEvidence(quarterConfig, payload) {
  const auditPath = indirectExposureAuditBrowserPath(quarterConfig);
  let auditText = "";
  let auditFileExists = false;

  try {
    auditText = await readFile(path.join("public", auditPath), "utf8");
    auditFileExists = true;
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  return {
    auditPath,
    requiredMappings: REQUIRED_INDIRECT_EXPOSURE_MAPPINGS,
    hasFundInvestmentSourceRows: Number.isFinite(payload?.meta?.fundInvestmentSourceRows)
      && payload.meta.fundInvestmentSourceRows > 0,
    hasIndirectExposureRows: Number.isFinite(payload?.meta?.indirectExposureRows)
      && payload.meta.indirectExposureRows > 0,
    hasRequiredMappings: REQUIRED_INDIRECT_EXPOSURE_MAPPINGS.every((mapping) =>
      stockHasRequiredIndirectMapping(payload, mapping),
    ),
    auditFileExists,
    auditCoversRequiredMappings: auditFileExists
      && REQUIRED_INDIRECT_EXPOSURE_MAPPINGS.every((mapping) =>
        auditHasRequiredIndirectMapping(auditText, mapping),
      ),
  };
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

export function releaseCheckManifest(quarterConfig, payload, indirectExposure) {
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
        purchaseLimitCount: payload.meta.purchaseLimitCount,
        purchaseLimitFetchedAt: payload.meta.purchaseLimitFetchedAt,
        purchaseLimitSource: payload.meta.purchaseLimitSource,
        purchaseLimitNetValueDates: payload.meta.purchaseLimitNetValueDates,
        fundInvestmentSourceRows: payload.meta.fundInvestmentSourceRows,
        indirectExposureRows: payload.meta.indirectExposureRows,
        stockCount: payload.meta.stockCount,
        overseasStockCount: payload.meta.overseasStockCount,
        shippedStockScope: payload.meta.shippedStockScope,
        shippedStockCount: payload.meta.shippedStockCount,
      },
      indirectExposureAudit: {
        path: indirectExposure.auditPath,
        fileName: path.posix.basename(indirectExposure.auditPath),
        requiredMappings: indirectExposure.requiredMappings,
      },
      portfolioRelease: indirectExposure.portfolioRelease,
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
        hasFundInvestmentSourceRows: indirectExposure.hasFundInvestmentSourceRows,
        hasIndirectExposureRows: indirectExposure.hasIndirectExposureRows,
        hasRequiredIndirectExposureMappings: indirectExposure.hasRequiredMappings,
        hasIndirectExposureAuditFile: indirectExposure.auditFileExists,
        auditCoversRequiredIndirectMappings: indirectExposure.auditCoversRequiredMappings,
      },
    },
    null,
    2,
  )}\n`;
}

export async function portfolioReleaseEvidence(quarterConfig) {
  const result = await verifyPortfolioRelease({
    publicDataDir: path.join("public", "data"),
    report: quarterConfig.report,
  });
  if (!result.ok) {
    throw new Error(`组合发布包未通过本地校验：${result.reason}`);
  }
  return {
    manifestPath: result.manifestPath.replace(/^/, "data/"),
    releaseId: result.releaseId,
    manifestSha256: result.manifestSha256,
    report: result.report,
    stockShardCount: result.stockShardCount,
    fundDetailShardCount: result.fundDetailShardCount,
  };
}

export async function loadQuarterPayload(quarterConfig) {
  const dataPath = quarterConfig.paths.fundStockIndexJson;
  let payloadText = "";

  try {
    payloadText = await readFile(dataPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(
        `Configured quarter is ${quarterConfig.report} (${quarterConfig.cutoffDate}), but ${dataPath} is missing. Generate ${quarterConfig.slug} frontend data before running npm run seo/build.`,
      );
    }
    throw error;
  }

  try {
    return JSON.parse(payloadText);
  } catch (error) {
    throw new Error(`${dataPath} is not valid JSON for ${quarterConfig.report} (${quarterConfig.cutoffDate}): ${error.message}`);
  }
}

export function validateQuarterPayload(quarterConfig, payload, dataPath = quarterConfig.paths.fundStockIndexJson) {
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

  const meta = payload.meta;
  for (const field of ["generatedAt", "sourceFile", "purchaseLimitFetchedAt", "purchaseLimitSource", "shippedStockScope"]) {
    if (typeof meta[field] !== "string" || meta[field].trim().length === 0) {
      throw new Error(`${dataPath} meta.${field} must be a non-empty string.`);
    }
  }
  if (Number.isNaN(Date.parse(meta.generatedAt))) {
    throw new Error(`${dataPath} meta.generatedAt must be a valid date-time.`);
  }

  for (const field of [
    "sourceRows",
    "fundInvestmentSourceRows",
    "stockCount",
    "totalStockCount",
    "purchaseLimitCount",
    "indirectExposureRows",
    "overseasStockCount",
    "shippedStockCount",
  ]) {
    if (!Number.isInteger(meta[field]) || meta[field] < 0) {
      throw new Error(`${dataPath} meta.${field} must be a non-negative integer.`);
    }
  }
  if (
    !Array.isArray(meta.purchaseLimitNetValueDates)
    || meta.purchaseLimitNetValueDates.length === 0
    || meta.purchaseLimitNetValueDates.some((value) => typeof value !== "string" || value.trim().length === 0)
  ) {
    throw new Error(`${dataPath} meta.purchaseLimitNetValueDates must be a non-empty string array.`);
  }
  if (!["all", "overseas"].includes(meta.shippedStockScope)) {
    throw new Error(`${dataPath} meta.shippedStockScope must be "all" or "overseas".`);
  }

  if (!Array.isArray(payload.popularStocks)) {
    throw new Error(`${dataPath} popularStocks must be an array.`);
  }
  if (!Array.isArray(payload.stocks) || payload.stocks.length === 0) {
    throw new Error(`${dataPath} stocks must be a non-empty array.`);
  }
  const stockCodes = new Set();
  for (const [index, stock] of payload.stocks.entries()) {
    if (typeof stock?.code !== "string" || stock.code.trim().length === 0) {
      throw new Error(`${dataPath} stocks[${index}].code must be a non-empty string.`);
    }
    if (stockCodes.has(stock.code)) {
      throw new Error(`${dataPath} contains duplicate stock code ${stock.code}.`);
    }
    stockCodes.add(stock.code);
    if (typeof stock?.name !== "string" || stock.name.trim().length === 0) {
      throw new Error(`${dataPath} stocks[${index}].name must be a non-empty string.`);
    }
    for (const field of ["fundCount", "activeFundCount", "excludedIndexFundCount"]) {
      if (!Number.isInteger(stock[field]) || stock[field] < 0) {
        throw new Error(`${dataPath} stocks[${index}].${field} must be a non-negative integer.`);
      }
    }
    if (stock.activeFundCount > stock.fundCount) {
      throw new Error(`${dataPath} stocks[${index}].activeFundCount cannot exceed fundCount.`);
    }
    if (
      stock.totalMarketValueWan !== null
      && (!Number.isFinite(stock.totalMarketValueWan) || stock.totalMarketValueWan < 0)
    ) {
      throw new Error(`${dataPath} stocks[${index}].totalMarketValueWan must be null or non-negative.`);
    }
    if (!Number.isFinite(stock.maxRatioPercent) || stock.maxRatioPercent < 0) {
      throw new Error(`${dataPath} stocks[${index}].maxRatioPercent must be non-negative and finite.`);
    }
    for (const field of ["topByRatio", "topByValue"]) {
      if (!Array.isArray(stock[field])) {
        throw new Error(`${dataPath} stocks[${index}].${field} must be an array.`);
      }
    }
  }
  const popularCodes = new Set();
  for (const [index, stock] of payload.popularStocks.entries()) {
    if (typeof stock?.code !== "string" || stock.code.trim().length === 0) {
      throw new Error(`${dataPath} popularStocks[${index}].code must be a non-empty string.`);
    }
    if (!stockCodes.has(stock.code)) {
      throw new Error(`${dataPath} popularStocks[${index}].code must exist in stocks.`);
    }
    if (popularCodes.has(stock.code)) {
      throw new Error(`${dataPath} contains duplicate popular stock code ${stock.code}.`);
    }
    popularCodes.add(stock.code);
    if (typeof stock?.name !== "string" || stock.name.trim().length === 0) {
      throw new Error(`${dataPath} popularStocks[${index}].name must be a non-empty string.`);
    }
    for (const field of ["fundCount", "activeFundCount"]) {
      if (!Number.isInteger(stock[field]) || stock[field] < 0) {
        throw new Error(`${dataPath} popularStocks[${index}].${field} must be a non-negative integer.`);
      }
    }
    if (stock.activeFundCount > stock.fundCount) {
      throw new Error(`${dataPath} popularStocks[${index}].activeFundCount cannot exceed fundCount.`);
    }
    if (!Number.isFinite(stock.maxRatioPercent) || stock.maxRatioPercent < 0) {
      throw new Error(`${dataPath} popularStocks[${index}].maxRatioPercent must be non-negative and finite.`);
    }
  }
  if (meta.stockCount !== payload.stocks.length) {
    throw new Error(`${dataPath} meta.stockCount must equal stocks.length.`);
  }
  if (meta.shippedStockCount !== payload.stocks.length) {
    throw new Error(`${dataPath} meta.shippedStockCount must equal stocks.length.`);
  }
  if (meta.totalStockCount < meta.stockCount) {
    throw new Error(`${dataPath} meta.totalStockCount must be at least meta.stockCount.`);
  }
  if (meta.shippedStockScope === "overseas" && meta.overseasStockCount !== payload.stocks.length) {
    throw new Error(`${dataPath} meta.overseasStockCount must equal stocks.length for overseas scope.`);
  }
  if (meta.shippedStockScope === "all" && meta.totalStockCount !== payload.stocks.length) {
    throw new Error(`${dataPath} meta.totalStockCount must equal stocks.length for all scope.`);
  }
}

export async function publishTextFiles(entries, {
  copyPath = copyFile,
  removePath = rm,
  renamePath = rename,
  writePath = writeFile,
} = {}) {
  const token = randomUUID();
  const targets = entries.map((entry) => path.resolve(entry.path));
  if (new Set(targets).size !== targets.length) {
    throw new Error("SEO 发布事务不能包含重复目标文件。");
  }
  const artifacts = entries.map((entry) => {
    const target = path.resolve(entry.path);
    const basename = path.basename(target);
    const parent = path.dirname(target);
    return {
      content: entry.content,
      encoding: entry.encoding ?? "utf8",
      target,
      stage: path.join(parent, `.${basename}.stage-${token}`),
      backup: path.join(parent, `.${basename}.rollback-${token}`),
      hadTarget: false,
    };
  });
  const published = [];
  let preserveBackups = false;

  try {
    for (const artifact of artifacts) {
      await mkdir(path.dirname(artifact.target), { recursive: true });
      await writePath(artifact.stage, artifact.content, artifact.encoding);
      try {
        await copyPath(artifact.target, artifact.backup);
        artifact.hadTarget = true;
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }

    try {
      for (const artifact of artifacts) {
        await renamePath(artifact.stage, artifact.target);
        published.push(artifact);
      }
    } catch (publishError) {
      const rollbackErrors = [];
      for (const artifact of [...published].reverse()) {
        try {
          if (artifact.hadTarget) {
            await renamePath(artifact.backup, artifact.target);
          } else {
            await removePath(artifact.target, { force: true });
          }
        } catch (rollbackError) {
          rollbackErrors.push(
            `${artifact.target}: ${rollbackError.message}; backup=${artifact.backup}`,
          );
        }
      }
      if (rollbackErrors.length > 0) {
        preserveBackups = true;
        throw new Error(
          `SEO 发布失败且部分文件无法回滚：${rollbackErrors.join("; ")}`,
          { cause: publishError },
        );
      }
      throw publishError;
    }
  } finally {
    await Promise.allSettled(
      artifacts.flatMap((artifact) => [
        artifact.stage,
        ...(preserveBackups ? [] : [artifact.backup]),
      ])
        .map((artifactPath) => removePath(artifactPath, { force: true })),
    );
  }
}

async function main() {
  const quarterConfig = await loadQuarterConfig();
  const dataPath = quarterConfig.paths.fundStockIndexJson;
  const payload = await loadQuarterPayload(quarterConfig);
  validateQuarterPayload(quarterConfig, payload, dataPath);

  const indirectExposure = await indirectExposureReleaseEvidence(quarterConfig, payload);
  indirectExposure.portfolioRelease = await portfolioReleaseEvidence(quarterConfig);
  await publishTextFiles([
    {
      path: quarterConfig.paths.releaseCheckJson,
      content: releaseCheckManifest(quarterConfig, payload, indirectExposure),
    },
    { path: path.join("public", "og-image.svg"), content: ogImage(quarterConfig.report) },
    { path: path.join("public", "sitemap.xml"), content: sitemap() },
    {
      path: path.join("public", "robots.txt"),
      content: `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${SITE_URL}/sitemap.xml
`,
    },
  ]);

  await rm(STOCKS_DIR, { recursive: true, force: true });
  await rm(path.join(SEO_DIR, "stock-page.css"), { force: true });
  await rm(path.join(SEO_DIR, "share.js"), { force: true });

  console.log("Generated release assets without static stock pages.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
