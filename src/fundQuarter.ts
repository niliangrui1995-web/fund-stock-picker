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
    cutoffDate: cutoffDateByQuarter[config.quarter as 1 | 2 | 3 | 4],
    dataPath,
    dataFileName,
    dataUrl: `/${dataPath}?v=${slug}`,
    holdingsUrl: `/data/fund-holdings-${slug}.json?v=${slug}`,
    releaseCheckUrl: `seo/quarter-release-check.json?v=${slug}`,
  };
}

export const fundQuarter = buildQuarterConfig(rawQuarterConfig);
