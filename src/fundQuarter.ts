import rawQuarterConfig from "../config/fund-quarter.json";

type RawQuarterConfig = {
  year: number;
  quarter: number;
};

function buildQuarterConfig(config: RawQuarterConfig) {
  if (!Number.isInteger(config.year) || config.year < 2000) {
    throw new Error("config/fund-quarter.json must contain an integer year >= 2000.");
  }
  if (![1, 2, 3, 4].includes(config.quarter)) {
    throw new Error("config/fund-quarter.json quarter must be one of 1, 2, 3, 4.");
  }

  const report = `${config.year}Q${config.quarter}`;
  const slug = report.toLowerCase();
  // 2026Q2 主索引叠加了同一截止日的 QDII 中期报告，必须驱逐季度内已缓存的 JSON。
  const assetVersion = config.year === 2026 && config.quarter === 2 ? `${slug}-qdii-h1` : slug;
  const dataPath = `data/fund-stock-index-${slug}.json`;
  const dataFileName = `fund-stock-index-${slug}.json`;
  const cutoffDateByQuarter = {
    1: `${config.year}-03-31`,
    2: `${config.year}-06-30`,
    3: `${config.year}-09-30`,
    4: `${config.year}-12-31`,
  } as const;

  return {
    year: config.year,
    quarter: config.quarter,
    report,
    slug,
    assetVersion,
    cutoffDate: cutoffDateByQuarter[config.quarter as 1 | 2 | 3 | 4],
    dataPath,
    dataFileName,
    dataUrl: `/${dataPath}?v=${assetVersion}`,
    holdingsUrl: `/data/fund-holdings-${slug}.json?v=${assetVersion}`,
    qdiiHoldingsUrl: `/data/qdii-fund-holdings-${config.year}h1.json?v=${assetVersion}`,
    portfolioManifestUrl: `/data/fund-portfolio-index-${slug}.manifest.json?v=${assetVersion}`,
    releaseCheckUrl: `seo/quarter-release-check.json?v=${assetVersion}`,
  };
}

export const fundQuarter = buildQuarterConfig(rawQuarterConfig);
