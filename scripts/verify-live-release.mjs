import { readFile } from "node:fs/promises";
import path from "node:path";

import { loadQuarterConfig, ROOT } from "./quarter-config.mjs";

const DEFAULT_LIVE_ORIGIN = "https://fund.niliangrui.cloud";
const LIVE_ORIGIN = (process.env.LIVE_RELEASE_ORIGIN || DEFAULT_LIVE_ORIGIN).replace(/\/+$/, "");
const CACHE_BUST = process.env.LIVE_RELEASE_CACHE_BUST || Date.now().toString();
const RELEASE_CHECK_PATH = "seo/quarter-release-check.json";

const checks = [];

function toBrowserPath(filePath) {
  return String(filePath ?? "").replace(/\\/g, "/").replace(/^public\//, "");
}

function getValue(source, keyPath) {
  return keyPath.split(".").reduce((value, key) => value?.[key], source);
}

function formatValue(value) {
  return value === undefined ? "undefined" : JSON.stringify(value);
}

function addCheck(label, passed, details = "") {
  checks.push({ label, passed, details });
}

function liveUrl(browserPath) {
  const url = new URL(String(browserPath).replace(/^\/+/, ""), `${LIVE_ORIGIN}/`);
  url.searchParams.set("verify-live-release", CACHE_BUST);
  return url;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function fetchJson(url, label) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "cache-control": "no-cache",
      pragma: "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`${label} returned ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${label} did not return valid JSON: ${error.message}`);
  }
}

function manifestMismatches(manifest, expected) {
  return [
    ["report", expected.report],
    ["cutoffDate", expected.cutoffDate],
    ["dataPath", expected.dataPath],
    ["dataFileName", expected.dataFileName],
    ["dataMeta.report", expected.report],
    ["dataMeta.cutoffDate", expected.cutoffDate],
    ["checks.reportMatchesData", true],
    ["checks.cutoffDateMatchesData", true],
    ["checks.seoUsesConfiguredDataFile", true],
  ]
    .map(([keyPath, expectedValue]) => {
      const actualValue = getValue(manifest, keyPath);
      return Object.is(actualValue, expectedValue)
        ? null
        : `${keyPath}: expected ${formatValue(expectedValue)}, got ${formatValue(actualValue)}`;
    })
    .filter(Boolean);
}

function releaseFingerprintDiffs(localManifest, liveManifest) {
  const fields = [
    "version",
    "report",
    "cutoffDate",
    "dataPath",
    "dataFileName",
    "dataMeta.report",
    "dataMeta.cutoffDate",
    "dataMeta.generatedAt",
    "dataMeta.sourceFile",
    "dataMeta.stockCount",
    "dataMeta.overseasStockCount",
    "dataMeta.shippedStockScope",
    "dataMeta.shippedStockCount",
    "seo.siteUrl",
    "seo.lastmod",
    "seo.stockPageCount",
    "seo.sampleStock.code",
    "seo.sampleStock.path",
    "checks.reportMatchesData",
    "checks.cutoffDateMatchesData",
    "checks.seoUsesConfiguredDataFile",
  ];

  return fields
    .map((field) => {
      const localValue = getValue(localManifest, field);
      const liveValue = getValue(liveManifest, field);
      return Object.is(localValue, liveValue)
        ? null
        : `${field}: local ${formatValue(localValue)}, live ${formatValue(liveValue)}`;
    })
    .filter(Boolean);
}

function dataMetaMismatches(dataPayload, manifest) {
  const meta = dataPayload?.meta ?? {};
  return [
    ["meta.report", manifest.report, meta.report],
    ["meta.cutoffDate", manifest.cutoffDate, meta.cutoffDate],
    ["meta.generatedAt", manifest.dataMeta?.generatedAt, meta.generatedAt],
    ["meta.sourceFile", manifest.dataMeta?.sourceFile, meta.sourceFile],
    ["meta.stockCount", manifest.dataMeta?.stockCount, meta.stockCount],
    ["meta.overseasStockCount", manifest.dataMeta?.overseasStockCount, meta.overseasStockCount],
    ["meta.shippedStockScope", manifest.dataMeta?.shippedStockScope, meta.shippedStockScope],
    ["meta.shippedStockCount", manifest.dataMeta?.shippedStockCount, meta.shippedStockCount],
  ]
    .map(([label, expectedValue, actualValue]) =>
      Object.is(expectedValue, actualValue)
        ? null
        : `${label}: expected ${formatValue(expectedValue)}, got ${formatValue(actualValue)}`,
    )
    .filter(Boolean);
}

function addGroupedCheck(label, mismatches) {
  addCheck(label, mismatches.length === 0, mismatches.slice(0, 6).join("; "));
}

function printResult(expected, localManifest, liveManifest) {
  console.log(`Live release origin: ${LIVE_ORIGIN}`);
  console.log(`Expected release: ${expected.report} (${expected.cutoffDate})`);
  console.log(`Expected frontend data file: ${expected.dataFileName}`);
  console.log("");

  for (const check of checks) {
    const prefix = check.passed ? "[OK]" : "[FAIL]";
    const details = check.details && !check.passed ? ` - ${check.details}` : "";
    console.log(`${prefix} ${check.label}${details}`);
  }

  const failedChecks = checks.filter((check) => !check.passed);
  console.log("");
  console.log(`Local manifest generatedAt: ${localManifest?.dataMeta?.generatedAt ?? "N/A"}`);
  console.log(`Live manifest generatedAt: ${liveManifest?.dataMeta?.generatedAt ?? "N/A"}`);

  if (failedChecks.length > 0) {
    console.error("");
    console.error(`Live release check failed: ${failedChecks.length} check(s) did not pass.`);
    process.exitCode = 1;
    return;
  }

  console.log("");
  console.log(`Live site is serving the current ${expected.report} release artifacts.`);
}

async function main() {
  const quarterConfig = await loadQuarterConfig();
  const expected = {
    report: quarterConfig.report,
    cutoffDate: quarterConfig.cutoffDate,
    dataPath: toBrowserPath(quarterConfig.paths.fundStockIndexJson),
    dataFileName: path.posix.basename(toBrowserPath(quarterConfig.paths.fundStockIndexJson)),
  };

  const localManifestPath = path.join(ROOT, quarterConfig.paths.releaseCheckJson);
  const localManifest = await readJson(localManifestPath);
  const localManifestMismatches = manifestMismatches(localManifest, expected);
  addGroupedCheck("local config matches public/seo/quarter-release-check.json", localManifestMismatches);

  let liveManifest = null;
  try {
    liveManifest = await fetchJson(liveUrl(RELEASE_CHECK_PATH), "live quarter-release-check.json");
    addCheck("live seo/quarter-release-check.json is reachable", true);
  } catch (error) {
    addCheck("live seo/quarter-release-check.json is reachable", false, error.message);
    printResult(expected, localManifest, liveManifest);
    return;
  }

  addGroupedCheck("live manifest matches local config", manifestMismatches(liveManifest, expected));
  addGroupedCheck(
    "live manifest matches local release fingerprint",
    releaseFingerprintDiffs(localManifest, liveManifest),
  );

  const liveDataPath = toBrowserPath(liveManifest.dataPath);
  const liveDataFileName = path.posix.basename(liveDataPath);
  addCheck(
    "live frontend data file name matches configured quarter",
    liveManifest.dataFileName === expected.dataFileName && liveDataFileName === expected.dataFileName,
    `expected ${expected.dataFileName}, got dataFileName=${formatValue(liveManifest.dataFileName)}, path=${formatValue(liveManifest.dataPath)}`,
  );

  let liveData = null;
  try {
    liveData = await fetchJson(liveUrl(liveDataPath), `live data file ${liveDataPath}`);
    addCheck(`live data file ${liveDataPath} is reachable`, true);
  } catch (error) {
    addCheck(`live data file ${liveDataPath} is reachable`, false, error.message);
    printResult(expected, localManifest, liveManifest);
    return;
  }

  addGroupedCheck("live data meta matches live release manifest", dataMetaMismatches(liveData, liveManifest));

  printResult(expected, localManifest, liveManifest);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
