import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CONFIG_PATH = path.join(ROOT, "config", "fund-quarter.json");

export function buildQuarterConfig(rawConfig) {
  const { year, quarter } = rawConfig;

  if (!Number.isInteger(year) || year < 2000) {
    throw new Error("config/fund-quarter.json must contain an integer year >= 2000.");
  }
  if (![1, 2, 3, 4].includes(quarter)) {
    throw new Error("config/fund-quarter.json quarter must be one of 1, 2, 3, 4.");
  }

  const report = `${year}Q${quarter}`;
  const slug = report.toLowerCase();
  const cutoffDate = {
    1: `${year}-03-31`,
    2: `${year}-06-30`,
    3: `${year}-09-30`,
    4: `${year}-12-31`,
  }[quarter];

  return {
    year,
    quarter,
    report,
    slug,
    cutoffDate,
    paths: {
      sourceStockCsv: path.join("outputs", `holdings_stock_${slug}.csv`),
      runSummaryJson: path.join("outputs", `run_summary_${slug}.json`),
      fundStockIndexJson: path.join("public", "data", `fund-stock-index-${slug}.json`),
      releaseCheckJson: path.join("public", "seo", "quarter-release-check.json"),
    },
  };
}

export async function loadQuarterConfig() {
  const rawConfig = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  return buildQuarterConfig(rawConfig);
}
