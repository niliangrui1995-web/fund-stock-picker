import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { buildQuarterConfig, loadQuarterConfig, ROOT } from "./quarter-config.mjs";
import { evaluatePurchaseLimitSnapshotFreshness } from "./purchase-limit-freshness.mjs";
import {
  indirectExposureReleaseEvidence,
  loadQuarterPayload,
  portfolioReleaseEvidence,
  releaseCheckManifest,
  validateQuarterPayload,
} from "./build_seo_pages.mjs";

const execFileAsync = promisify(execFile);
const TARGET = Object.freeze({ year: 2026, quarter: 2 });
const TARGET_EXPECTED = Object.freeze({
  report: "2026Q2",
  slug: "2026q2",
  cutoffDate: "2026-06-30",
  sourceStockCsv: "outputs/holdings_stock_2026q2.csv",
  runSummaryJson: "outputs/run_summary_2026q2.json",
  overseasAiPositionDetailsCsv: "outputs/overseas_ai_position_details_2026q2.csv",
  fundStockIndexJson: "public/data/fund-stock-index-2026q2.json",
  releaseCheckJson: "public/seo/quarter-release-check.json",
});
const REQUIRED_MANIFEST_FIELDS = [
  "version",
  "report",
  "cutoffDate",
  "dataPath",
  "dataFileName",
  "dataMeta.report",
  "dataMeta.cutoffDate",
  "dataMeta.generatedAt",
  "dataMeta.sourceFile",
  "dataMeta.purchaseLimitCount",
  "dataMeta.purchaseLimitFetchedAt",
  "dataMeta.purchaseLimitSource",
  "dataMeta.purchaseLimitNetValueDates",
  "dataMeta.fundInvestmentSourceRows",
  "dataMeta.indirectExposureRows",
  "dataMeta.stockCount",
  "dataMeta.overseasStockCount",
  "dataMeta.shippedStockScope",
  "dataMeta.shippedStockCount",
  "indirectExposureAudit.path",
  "indirectExposureAudit.fileName",
  "indirectExposureAudit.requiredMappings",
  "portfolioRelease.manifestPath",
  "portfolioRelease.releaseId",
  "portfolioRelease.manifestSha256",
  "portfolioRelease.report",
  "portfolioRelease.stockShardCount",
  "portfolioRelease.fundDetailShardCount",
  "seo.siteUrl",
  "seo.lastmod",
  "seo.stockPageCount",
  "seo.sampleStock",
  "seo.staticFiles",
  "checks.reportMatchesData",
  "checks.cutoffDateMatchesData",
  "checks.seoUsesConfiguredDataFile",
  "checks.hasFundInvestmentSourceRows",
  "checks.hasIndirectExposureRows",
  "checks.hasRequiredIndirectExposureMappings",
  "checks.hasIndirectExposureAuditFile",
  "checks.auditCoversRequiredIndirectMappings",
];

process.chdir(ROOT);

const checks = [];

function normalizeRelative(filePath) {
  return String(filePath ?? "").replace(/\\/g, "/");
}

function getValue(source, keyPath) {
  return keyPath.split(".").reduce((value, key) => value?.[key], source);
}

function formatValue(value) {
  return value === undefined ? "undefined" : JSON.stringify(value);
}

function addCheck(label, passed, details = "") {
  checks.push({ label, passed, details, severity: passed ? "ok" : "fail" });
}

function addWarning(label, details = "") {
  checks.push({ label, passed: true, details, severity: "warn" });
}

function addGroupedCheck(label, mismatches) {
  addCheck(label, mismatches.length === 0, mismatches.slice(0, 8).join("; "));
}

function addFreshnessCheck(label, freshness) {
  if (freshness.status === "warn") {
    addWarning(label, freshness.message);
    return;
  }
  addCheck(label, freshness.passed, freshness.message);
}

function compareExact(actual, expected) {
  return Object.entries(expected)
    .map(([key, expectedValue]) => {
      const actualValue = actual[key];
      return Object.is(actualValue, expectedValue)
        ? null
        : `${key}: expected ${formatValue(expectedValue)}, got ${formatValue(actualValue)}`;
    })
    .filter(Boolean);
}

function compareKeyPaths(actual, expected) {
  return Object.entries(expected)
    .map(([keyPath, expectedValue]) => {
      const actualValue = getValue(actual, keyPath);
      return Object.is(actualValue, expectedValue)
        ? null
        : `${keyPath}: expected ${formatValue(expectedValue)}, got ${formatValue(actualValue)}`;
    })
    .filter(Boolean);
}

function messageMissingTerms(message, terms) {
  const normalizedMessage = normalizeRelative(message);
  return terms.filter((term) => !normalizedMessage.includes(normalizeRelative(term)));
}

function addMessageCheck(label, message, requiredTerms) {
  const missingTerms = messageMissingTerms(message, requiredTerms);
  addCheck(
    label,
    missingTerms.length === 0,
    missingTerms.length === 0
      ? ""
      : `message ${formatValue(message)} is missing ${missingTerms.map(formatValue).join(", ")}`,
  );
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(path.join(ROOT, filePath), "utf8"));
}

function nodeQuarterSnapshot(quarterConfig) {
  return {
    report: quarterConfig.report,
    slug: quarterConfig.slug,
    cutoffDate: quarterConfig.cutoffDate,
    sourceStockCsv: normalizeRelative(quarterConfig.paths.sourceStockCsv),
    runSummaryJson: normalizeRelative(quarterConfig.paths.runSummaryJson),
    overseasAiPositionDetailsCsv: normalizeRelative(quarterConfig.paths.overseasAiPositionDetailsCsv),
    fundStockIndexJson: normalizeRelative(quarterConfig.paths.fundStockIndexJson),
    releaseCheckJson: normalizeRelative(quarterConfig.paths.releaseCheckJson),
  };
}

async function pythonQuarterSnapshot() {
  const code = `
import json
import sys
from pathlib import Path

root = Path(${JSON.stringify(ROOT)})
sys.path.insert(0, str(root / "scripts"))

from quarter_config import FundQuarterConfig

quarter = FundQuarterConfig(year=${TARGET.year}, quarter=${TARGET.quarter}, root=root)
print(json.dumps({
    "report": quarter.report,
    "slug": quarter.slug,
    "cutoffDate": quarter.cutoff_date,
    "sourceStockCsv": quarter.source_stock_csv_relative.as_posix(),
    "runSummaryJson": quarter.run_summary_json_relative.as_posix(),
    "overseasAiPositionDetailsCsv": quarter.overseas_ai_detail_csv_relative.as_posix(),
    "fundStockIndexJson": quarter.fund_stock_index_json_relative.as_posix(),
}, ensure_ascii=False))
`;
  const python = process.env.PYTHON || "python";
  const { stdout } = await execFileAsync(python, ["-c", code], { cwd: ROOT, windowsHide: true });
  return JSON.parse(stdout);
}

function inMemoryPreflightPayload(quarterConfig) {
  return {
    meta: {
      report: quarterConfig.report,
      cutoffDate: quarterConfig.cutoffDate,
      generatedAt: "preflight-only",
      sourceFile: path.posix.basename(TARGET_EXPECTED.sourceStockCsv),
      purchaseLimitCount: 0,
      purchaseLimitFetchedAt: "preflight-only",
      purchaseLimitSource: "preflight-only",
      purchaseLimitNetValueDates: ["preflight-only"],
      fundInvestmentSourceRows: 0,
      indirectExposureRows: 0,
      stockCount: 0,
      overseasStockCount: 0,
      shippedStockScope: "preflight-only",
      shippedStockCount: 0,
    },
  };
}

function missingManifestFields(manifest) {
  return REQUIRED_MANIFEST_FIELDS.filter((field) => getValue(manifest, field) === undefined);
}

function printResult(currentQuarter, targetQuarter, targetDataExists) {
  console.log(`Quarter preflight target: ${targetQuarter.report} (${targetQuarter.cutoffDate})`);
  console.log(`Current configured release: ${currentQuarter.report} (${currentQuarter.cutoffDate})`);
  console.log(`Target frontend data file: ${TARGET_EXPECTED.fundStockIndexJson}`);
  console.log(`Target data file present: ${targetDataExists ? "yes" : "no, pending by design"}`);
  console.log("No files written.");
  console.log("");

  for (const check of checks) {
    const prefix = check.severity === "warn" ? "[WARN]" : check.passed ? "[OK]" : "[FAIL]";
    const details = check.details && (!check.passed || check.severity === "warn") ? ` - ${check.details}` : "";
    console.log(`${prefix} ${check.label}${details}`);
  }

  const failedChecks = checks.filter((check) => !check.passed);
  if (failedChecks.length > 0) {
    console.error("");
    console.error(`2026Q2 quarter preflight failed: ${failedChecks.length} check(s) did not pass.`);
    process.exitCode = 1;
    return;
  }

  console.log("");
  console.log("2026Q2 quarter preflight guard is ready; config/fund-quarter.json was not changed.");
}

async function main() {
  const currentQuarter = await loadQuarterConfig();
  const targetQuarter = buildQuarterConfig(TARGET);
  const targetSnapshot = nodeQuarterSnapshot(targetQuarter);

  addCheck(
    "config/fund-quarter.json is set to the 2026Q2 release target",
    currentQuarter.report === targetQuarter.report && currentQuarter.cutoffDate === targetQuarter.cutoffDate,
    `current config is ${currentQuarter.report} (${currentQuarter.cutoffDate})`,
  );
  addGroupedCheck("Node quarter-config.mjs derives the 2026Q2 names", compareExact(targetSnapshot, TARGET_EXPECTED));

  try {
    const pythonSnapshot = await pythonQuarterSnapshot();
    addGroupedCheck(
      "Python quarter_config.py matches the Node 2026Q2 derivation",
      compareExact(pythonSnapshot, {
        report: TARGET_EXPECTED.report,
        slug: TARGET_EXPECTED.slug,
        cutoffDate: TARGET_EXPECTED.cutoffDate,
        sourceStockCsv: TARGET_EXPECTED.sourceStockCsv,
        runSummaryJson: TARGET_EXPECTED.runSummaryJson,
        overseasAiPositionDetailsCsv: TARGET_EXPECTED.overseasAiPositionDetailsCsv,
        fundStockIndexJson: TARGET_EXPECTED.fundStockIndexJson,
      }),
    );
  } catch (error) {
    addCheck("Python quarter_config.py matches the Node 2026Q2 derivation", false, error.message);
  }

  const targetDataPath = path.join(ROOT, targetQuarter.paths.fundStockIndexJson);
  const targetDataExists = await exists(targetDataPath);
  let targetPayload = null;
  let portfolioRelease = null;

  try {
    const currentReleaseManifest = await readJson(TARGET_EXPECTED.releaseCheckJson);
    addFreshnessCheck(
      "current public/seo/quarter-release-check.json purchase-limit snapshot is fresh enough for the 2026-06-30 cutover",
      evaluatePurchaseLimitSnapshotFreshness(currentReleaseManifest.dataMeta, {
        asOfDate: TARGET_EXPECTED.cutoffDate,
        releaseLabel: TARGET_EXPECTED.report,
        snapshotPath: TARGET_EXPECTED.releaseCheckJson,
      }),
    );
  } catch (error) {
    addCheck(
      "current public/seo/quarter-release-check.json purchase-limit snapshot is fresh enough for the 2026-06-30 cutover",
      false,
      error.message,
    );
  }

  if (targetDataExists) {
    try {
      targetPayload = await loadQuarterPayload(targetQuarter);
      validateQuarterPayload(targetQuarter, targetPayload);
      addCheck("existing 2026Q2 frontend data meta matches the target quarter", true);
      addFreshnessCheck(
        "existing 2026Q2 frontend data purchase-limit snapshot is fresh enough for the 2026-06-30 cutover",
        evaluatePurchaseLimitSnapshotFreshness(targetPayload.meta, {
          asOfDate: TARGET_EXPECTED.cutoffDate,
          releaseLabel: TARGET_EXPECTED.report,
          snapshotPath: TARGET_EXPECTED.fundStockIndexJson,
        }),
      );
      portfolioRelease = await portfolioReleaseEvidence(targetQuarter);
      addCheck(
        "existing 2026Q2 portfolio release passes the shared local verifier",
        true,
        `releaseId=${portfolioRelease.releaseId}; manifest=${portfolioRelease.manifestPath}; sha256=${portfolioRelease.manifestSha256}; stockShards=${portfolioRelease.stockShardCount}; detailShards=${portfolioRelease.fundDetailShardCount}`,
      );
    } catch (error) {
      addCheck("existing 2026Q2 frontend data meta matches the target quarter", false, error.message);
      addCheck("existing 2026Q2 portfolio release passes the shared local verifier", false, error.message);
    }
  } else {
    try {
      await loadQuarterPayload(targetQuarter);
      addCheck("missing 2026Q2 frontend data fails with an actionable message", false, "load unexpectedly succeeded");
    } catch (error) {
      addMessageCheck("missing 2026Q2 frontend data fails with an actionable message", error.message, [
        TARGET_EXPECTED.report,
        TARGET_EXPECTED.slug,
        TARGET_EXPECTED.cutoffDate,
        TARGET_EXPECTED.fundStockIndexJson,
      ]);
    }
  }

  const manifestPayload = targetPayload ?? inMemoryPreflightPayload(targetQuarter);
  const indirectExposure = await indirectExposureReleaseEvidence(targetQuarter, manifestPayload);
  indirectExposure.portfolioRelease = portfolioRelease;
  const manifest = JSON.parse(releaseCheckManifest(targetQuarter, manifestPayload, indirectExposure));
  addGroupedCheck(
    "release manifest builder keeps all required fields",
    missingManifestFields(manifest).map((field) => `missing ${field}`),
  );
  addGroupedCheck(
    "release manifest builder carries the 2026Q2 target values",
    compareKeyPaths(manifest, {
      report: TARGET_EXPECTED.report,
      cutoffDate: TARGET_EXPECTED.cutoffDate,
      dataPath: "data/fund-stock-index-2026q2.json",
      dataFileName: "fund-stock-index-2026q2.json",
      "dataMeta.report": TARGET_EXPECTED.report,
      "dataMeta.cutoffDate": TARGET_EXPECTED.cutoffDate,
      "indirectExposureAudit.path": "seo/indirect-exposure-audit-2026q2.md",
      "indirectExposureAudit.fileName": "indirect-exposure-audit-2026q2.md",
      "checks.reportMatchesData": true,
      "checks.cutoffDateMatchesData": true,
      "checks.seoUsesConfiguredDataFile": true,
      "portfolioRelease.manifestPath": "data/fund-portfolio-index-2026q2.manifest.json",
      "portfolioRelease.report": TARGET_EXPECTED.report,
    }),
  );

  try {
    validateQuarterPayload(targetQuarter, {
      ...manifestPayload,
      meta: { ...manifestPayload.meta, report: "2026Q1" },
    });
    addCheck("wrong-report error names the 2026Q2 target and data file", false, "validation unexpectedly succeeded");
  } catch (error) {
    addMessageCheck("wrong-report error names the 2026Q2 target and data file", error.message, [
      "Configured quarter is 2026Q2",
      "2026Q1",
      TARGET_EXPECTED.fundStockIndexJson,
    ]);
  }

  try {
    validateQuarterPayload(targetQuarter, {
      ...manifestPayload,
      meta: { ...manifestPayload.meta, cutoffDate: "2026-03-31" },
    });
    addCheck("wrong-cutoff error names the 2026-06-30 target and data file", false, "validation unexpectedly succeeded");
  } catch (error) {
    addMessageCheck("wrong-cutoff error names the 2026-06-30 target and data file", error.message, [
      "Configured cutoffDate is 2026-06-30",
      "2026-03-31",
      TARGET_EXPECTED.fundStockIndexJson,
    ]);
  }

  printResult(currentQuarter, targetQuarter, targetDataExists);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
