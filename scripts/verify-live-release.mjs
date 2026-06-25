import { readFile } from "node:fs/promises";
import path from "node:path";

import { loadQuarterConfig, ROOT } from "./quarter-config.mjs";
import { evaluatePurchaseLimitSnapshotFreshness } from "./purchase-limit-freshness.mjs";
import { normalizeStockCode, verifyLiveStockDeeplinks } from "./verify-stock-deeplinks.mjs";

const DEFAULT_LIVE_ORIGIN = "https://fund.niliangrui.cloud";
const LIVE_ORIGIN = (process.env.LIVE_RELEASE_ORIGIN || DEFAULT_LIVE_ORIGIN).replace(/\/+$/, "");
const CACHE_BUST = process.env.LIVE_RELEASE_CACHE_BUST || Date.now().toString();
const RELEASE_CHECK_PATH = "seo/quarter-release-check.json";
const HOMEPAGE_PATH = "/";
const HOTSPOTS_PATH = path.join(ROOT, "config", "ai-battle-hotspots.json");
const INDEX_HTML_PATH = path.join(ROOT, "index.html");
const PURCHASE_LIMIT_META_FIELDS = [
  "purchaseLimitCount",
  "purchaseLimitFetchedAt",
  "purchaseLimitSource",
  "purchaseLimitNetValueDates",
];

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

function comparableValue(value) {
  return value && typeof value === "object" ? JSON.stringify(value) : value;
}

function valuesEqual(left, right) {
  return Object.is(comparableValue(left), comparableValue(right));
}

function addCheck(label, passed, details = "") {
  checks.push({ label, passed, details, severity: passed ? "ok" : "fail" });
}

function addWarning(label, details = "") {
  checks.push({ label, passed: true, details, severity: "warn" });
}

function addFreshnessCheck(label, freshness) {
  if (freshness.status === "warn") {
    addWarning(label, freshness.message);
    return;
  }
  addCheck(label, freshness.passed, freshness.message);
}

function liveUrl(browserPath) {
  const url = new URL(String(browserPath).replace(/^\/+/, ""), `${LIVE_ORIGIN}/`);
  url.searchParams.set("verify-live-release", CACHE_BUST);
  return url;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function fetchText(url, label) {
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

  return response.text();
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
    ["checks.hasFundInvestmentSourceRows", true],
    ["checks.hasIndirectExposureRows", true],
    ["checks.hasRequiredIndirectExposureMappings", true],
    ["checks.hasIndirectExposureAuditFile", true],
    ["checks.auditCoversRequiredIndirectMappings", true],
    ["indirectExposureAudit.path", expected.auditPath],
  ]
    .map(([keyPath, expectedValue]) => {
      const actualValue = getValue(manifest, keyPath);
      return valuesEqual(actualValue, expectedValue)
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
    ...PURCHASE_LIMIT_META_FIELDS.map((field) => `dataMeta.${field}`),
    "dataMeta.fundInvestmentSourceRows",
    "dataMeta.indirectExposureRows",
    "dataMeta.stockCount",
    "dataMeta.overseasStockCount",
    "dataMeta.shippedStockScope",
    "dataMeta.shippedStockCount",
    "indirectExposureAudit.path",
    "indirectExposureAudit.fileName",
    "indirectExposureAudit.requiredMappings",
    "seo.siteUrl",
    "seo.lastmod",
    "seo.stockPageCount",
    "seo.sampleStock.code",
    "seo.sampleStock.path",
    "checks.reportMatchesData",
    "checks.cutoffDateMatchesData",
    "checks.seoUsesConfiguredDataFile",
    "checks.hasFundInvestmentSourceRows",
    "checks.hasIndirectExposureRows",
    "checks.hasRequiredIndirectExposureMappings",
    "checks.hasIndirectExposureAuditFile",
    "checks.auditCoversRequiredIndirectMappings",
  ];

  return fields
    .map((field) => {
      const localValue = getValue(localManifest, field);
      const liveValue = getValue(liveManifest, field);
      return valuesEqual(localValue, liveValue)
        ? null
        : `${field}: local ${formatValue(localValue)}, live ${formatValue(liveValue)}`;
    })
    .filter(Boolean);
}

function getHtmlAttribute(tag, name) {
  const match = new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i").exec(tag);
  return match?.[2] ?? "";
}

function extractScriptSources(html) {
  const sources = Array.from(html.matchAll(/<script\b[^>]*>/gi))
    .map(([tag]) => {
      const src = getHtmlAttribute(tag, "src");
      const type = getHtmlAttribute(tag, "type").toLowerCase();
      return src && (!type || type === "module" || src.split("?")[0].endsWith(".js")) ? src : null;
    })
    .filter(Boolean);

  return Array.from(new Set(sources));
}

function getMetaContent(html, attributeName, attributeValue) {
  const expectedValue = attributeValue.toLowerCase();
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    if (getHtmlAttribute(tag, attributeName).toLowerCase() === expectedValue) {
      return getHtmlAttribute(tag, "content");
    }
  }
  return "";
}

function cacheBustedUrl(source, baseUrl) {
  const url = new URL(source, baseUrl);
  url.searchParams.set("verify-live-release", CACHE_BUST);
  return url;
}

function dataMetaMismatches(dataPayload, manifest) {
  const meta = dataPayload?.meta ?? {};
  return [
    ["meta.report", manifest.report, meta.report],
    ["meta.cutoffDate", manifest.cutoffDate, meta.cutoffDate],
    ["meta.generatedAt", manifest.dataMeta?.generatedAt, meta.generatedAt],
    ["meta.sourceFile", manifest.dataMeta?.sourceFile, meta.sourceFile],
    ...PURCHASE_LIMIT_META_FIELDS.map((field) => [
      `meta.${field}`,
      manifest.dataMeta?.[field],
      meta[field],
    ]),
    ["meta.fundInvestmentSourceRows", manifest.dataMeta?.fundInvestmentSourceRows, meta.fundInvestmentSourceRows],
    ["meta.indirectExposureRows", manifest.dataMeta?.indirectExposureRows, meta.indirectExposureRows],
    ["meta.stockCount", manifest.dataMeta?.stockCount, meta.stockCount],
    ["meta.overseasStockCount", manifest.dataMeta?.overseasStockCount, meta.overseasStockCount],
    ["meta.shippedStockScope", manifest.dataMeta?.shippedStockScope, meta.shippedStockScope],
    ["meta.shippedStockCount", manifest.dataMeta?.shippedStockCount, meta.shippedStockCount],
  ]
    .map(([label, expectedValue, actualValue]) =>
      valuesEqual(expectedValue, actualValue)
        ? null
        : `${label}: expected ${formatValue(expectedValue)}, got ${formatValue(actualValue)}`,
    )
    .filter(Boolean);
}

function purchaseLimitManifestMismatches(manifest) {
  const meta = manifest?.dataMeta ?? {};
  const mismatches = [];
  if (meta.purchaseLimitCount === undefined || meta.purchaseLimitCount === null) {
    mismatches.push("dataMeta.purchaseLimitCount is missing");
  }
  if (!meta.purchaseLimitFetchedAt) {
    mismatches.push("dataMeta.purchaseLimitFetchedAt is missing");
  }
  if (!meta.purchaseLimitSource) {
    mismatches.push("dataMeta.purchaseLimitSource is missing");
  }
  if (!Array.isArray(meta.purchaseLimitNetValueDates) || meta.purchaseLimitNetValueDates.length === 0) {
    mismatches.push("dataMeta.purchaseLimitNetValueDates is missing");
  }
  return mismatches;
}

function purchaseLimitSnapshotSummary(meta) {
  const fetchedAt = meta?.purchaseLimitFetchedAt || "N/A";
  const netValueDates = Array.isArray(meta?.purchaseLimitNetValueDates)
    ? meta.purchaseLimitNetValueDates.join(", ")
    : meta?.purchaseLimitNetValueDates || "N/A";
  const rowCount = meta?.purchaseLimitCount ?? "N/A";
  return `fetchedAt=${fetchedAt}; netValueDates=${netValueDates || "N/A"}; rows=${rowCount}`;
}

function requiredIndirectExposureMappings(manifest) {
  return (manifest?.indirectExposureAudit?.requiredMappings ?? []).filter(
    (mapping) => mapping?.sourceCode && mapping?.targetCode,
  );
}

function indirectExposureDataMismatches(stockPayload, requiredMappings) {
  if (requiredMappings.length === 0) {
    return ["indirectExposureAudit.requiredMappings is missing"];
  }

  return requiredMappings
    .map((mapping) => {
      const liveStock = stockByNormalizedCode(stockPayload, mapping.targetCode);
      if (!liveStock) {
        return `${mapping.targetCode} is missing from the live frontend data file`;
      }
      const hasMapping = (liveStock.topIndirectExposureByRatio ?? []).some(
        (row) =>
          row?.sourceCode === mapping.sourceCode
          && normalizeStockCode(row?.targetCode ?? liveStock.code) === normalizeStockCode(mapping.targetCode),
      );
      return hasMapping
        ? null
        : `${mapping.sourceCode} -> ${mapping.targetCode} is missing from live indirect exposure rows`;
    })
    .filter(Boolean);
}

function indirectExposureAuditMismatches(auditText, requiredMappings) {
  if (requiredMappings.length === 0) {
    return ["indirectExposureAudit.requiredMappings is missing"];
  }

  const lines = auditText.split(/\r?\n/);
  return requiredMappings
    .map((mapping) => {
      const hasAuditLine = lines.some(
        (line) => line.includes(mapping.sourceCode) && line.includes(mapping.targetCode),
      );
      return hasAuditLine
        ? null
        : `${mapping.sourceCode} -> ${mapping.targetCode} is missing from live indirect exposure audit`;
    })
    .filter(Boolean);
}

function addGroupedCheck(label, mismatches) {
  addCheck(label, mismatches.length === 0, mismatches.slice(0, 6).join("; "));
}

function stockByNormalizedCode(payload, code) {
  const expectedCode = normalizeStockCode(code);
  return (payload?.stocks ?? []).find((stock) => normalizeStockCode(stock.code) === expectedCode) ?? null;
}

function expectedHomepageHotspots(hotspots) {
  return (hotspots ?? []).filter((hotspot) => hotspot?.homepageQuickEntry);
}

function homepageDescriptionMismatches({ localHtml, homepageHtml, quickHotspots }) {
  const descriptions = [
    { label: "description", attributeName: "name", attributeValue: "description" },
    { label: "og:description", attributeName: "property", attributeValue: "og:description" },
    { label: "twitter:description", attributeName: "name", attributeValue: "twitter:description" },
  ];
  const mismatches = [];
  const requiredHomepageTerms = Array.from(
    new Set(["AI 存储", "热点入口", ...quickHotspots.map((hotspot) => hotspot.code).filter(Boolean)]),
  );

  for (const description of descriptions) {
    const expected = getMetaContent(localHtml, description.attributeName, description.attributeValue);
    const actual = getMetaContent(homepageHtml, description.attributeName, description.attributeValue);
    if (!expected) {
      mismatches.push(`local index.html is missing ${description.label}`);
    } else if (actual !== expected) {
      mismatches.push(`${description.label}: expected ${formatValue(expected)}, got ${formatValue(actual)}`);
    }
    for (const text of requiredHomepageTerms) {
      if (!actual.includes(text)) {
        mismatches.push(`${description.label} is missing ${formatValue(text)}`);
      }
    }
  }

  return mismatches;
}

function homepageHotspotMismatches({ homepagePayload, hotspot, code, stockPayload }) {
  if (!hotspot) {
    return [`${code} is missing from config/ai-battle-hotspots.json`];
  }

  const mismatches = [];
  const requiredHomepageText = [hotspot.label, hotspot.track, hotspot.thesis];

  if (!homepagePayload) {
    mismatches.push("live homepage script assets were not available");
  } else {
    if (!homepagePayload.includes("ai-hotspot-card")) {
      mismatches.push("live homepage bundle is missing the AI hotspot card renderer");
    }
    for (const text of requiredHomepageText) {
      if (text && !homepagePayload.includes(text)) {
        mismatches.push(`live homepage bundle is missing ${formatValue(text)}`);
      }
    }
  }

  const liveStock = stockByNormalizedCode(stockPayload, hotspot.code);
  if (!liveStock) {
    mismatches.push(`${hotspot.code} is missing from the live frontend data file`);
  } else {
    if (!Number.isFinite(liveStock.activeFundCount)) {
      mismatches.push(`${hotspot.code} is missing activeFundCount in the live frontend data file`);
    }
    if (!Number.isFinite(liveStock.maxRatioPercent)) {
      mismatches.push(`${hotspot.code} is missing maxRatioPercent in the live frontend data file`);
    }
  }

  return mismatches;
}

function printResult(expected, localManifest, liveManifest, liveData = null) {
  console.log(`Live release origin: ${LIVE_ORIGIN}`);
  console.log(`Expected release: ${expected.report} (${expected.cutoffDate})`);
  console.log(`Expected frontend data file: ${expected.dataFileName}`);
  console.log("");

  for (const check of checks) {
    const prefix = check.severity === "warn" ? "[WARN]" : check.passed ? "[OK]" : "[FAIL]";
    const details = check.details && (!check.passed || check.severity === "warn") ? ` - ${check.details}` : "";
    console.log(`${prefix} ${check.label}${details}`);
  }

  const failedChecks = checks.filter((check) => !check.passed);
  console.log("");
  console.log(`Local manifest generatedAt: ${localManifest?.dataMeta?.generatedAt ?? "N/A"}`);
  console.log(`Live manifest generatedAt: ${liveManifest?.dataMeta?.generatedAt ?? "N/A"}`);
  console.log(`Current live purchase limit snapshot: ${purchaseLimitSnapshotSummary(liveData?.meta ?? liveManifest?.dataMeta)}`);
  console.log(`Local manifest purchase limit snapshot: ${purchaseLimitSnapshotSummary(localManifest?.dataMeta)}`);
  console.log(`Live manifest purchase limit snapshot: ${purchaseLimitSnapshotSummary(liveManifest?.dataMeta)}`);

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
    auditPath: `seo/indirect-exposure-audit-${quarterConfig.slug}.md`,
  };

  const localManifestPath = path.join(ROOT, quarterConfig.paths.releaseCheckJson);
  const localManifest = await readJson(localManifestPath);
  const localManifestMismatches = manifestMismatches(localManifest, expected);
  addGroupedCheck("local config matches public/seo/quarter-release-check.json", localManifestMismatches);
  addGroupedCheck("local release manifest declares purchase limit snapshot", purchaseLimitManifestMismatches(localManifest));
  addFreshnessCheck(
    "local release manifest purchase-limit snapshot is fresh enough for the configured cutoff",
    evaluatePurchaseLimitSnapshotFreshness(localManifest.dataMeta, {
      asOfDate: expected.cutoffDate,
      releaseLabel: expected.report,
      snapshotPath: "public/seo/quarter-release-check.json",
    }),
  );

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
  addGroupedCheck("live release manifest declares purchase limit snapshot", purchaseLimitManifestMismatches(liveManifest));
  addFreshnessCheck(
    "live release manifest purchase-limit snapshot is fresh enough for the configured cutoff",
    evaluatePurchaseLimitSnapshotFreshness(liveManifest.dataMeta, {
      asOfDate: expected.cutoffDate,
      releaseLabel: expected.report,
      snapshotPath: `${LIVE_ORIGIN}/${RELEASE_CHECK_PATH}`,
    }),
  );
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
  const requiredMappings = requiredIndirectExposureMappings(liveManifest);
  addCheck(
    "live release manifest declares required indirect exposure mappings",
    requiredMappings.length > 0,
    "indirectExposureAudit.requiredMappings is missing",
  );
  addGroupedCheck(
    "live data keeps required indirect exposure mappings",
    indirectExposureDataMismatches(liveData, requiredMappings),
  );

  const liveAuditPath = liveManifest?.indirectExposureAudit?.path;
  let liveAudit = "";
  if (!liveAuditPath) {
    addCheck("live indirect exposure audit is reachable", false, "indirectExposureAudit.path is missing");
  } else {
    try {
      liveAudit = await fetchText(liveUrl(liveAuditPath), `live indirect exposure audit ${liveAuditPath}`);
      addCheck(`live indirect exposure audit ${liveAuditPath} is reachable`, true);
    } catch (error) {
      addCheck(`live indirect exposure audit ${liveAuditPath} is reachable`, false, error.message);
    }
  }
  if (liveAudit) {
    addGroupedCheck(
      "live indirect exposure audit covers required mappings",
      indirectExposureAuditMismatches(liveAudit, requiredMappings),
    );
  }

  const [localHotspots, localIndexHtml] = await Promise.all([
    readJson(HOTSPOTS_PATH),
    readFile(INDEX_HTML_PATH, "utf8"),
  ]);
  const homepageHotspots = expectedHomepageHotspots(localHotspots);
  addCheck(
    "local homepage AI storage quick hotspots are configured",
    homepageHotspots.length > 0,
    "config/ai-battle-hotspots.json has no homepageQuickEntry hotspots",
  );
  let homepagePayload = "";
  let homepageHtml = "";
  const homepageUrl = liveUrl(HOMEPAGE_PATH);

  try {
    homepageHtml = await fetchText(homepageUrl, "live homepage /");
    addCheck("live homepage / is reachable", true);
  } catch (error) {
    addCheck("live homepage / is reachable", false, error.message);
  }

  if (homepageHtml) {
    addGroupedCheck(
      "live homepage HTML carries promoted AI storage descriptions",
      homepageDescriptionMismatches({ localHtml: localIndexHtml, homepageHtml, quickHotspots: homepageHotspots }),
    );

    const scriptSources = extractScriptSources(homepageHtml);
    if (scriptSources.length === 0) {
      addCheck("live homepage script assets are reachable", false, "no script src assets found on live homepage");
    } else {
      const scriptPayloads = [];
      const scriptErrors = [];

      for (const source of scriptSources) {
        const scriptUrl = cacheBustedUrl(source, homepageUrl);
        try {
          scriptPayloads.push(await fetchText(scriptUrl, `live homepage script ${scriptUrl.pathname}`));
        } catch (error) {
          scriptErrors.push(error.message);
        }
      }

      addCheck("live homepage script assets are reachable", scriptErrors.length === 0, scriptErrors.join("; "));
      if (scriptErrors.length === 0) {
        homepagePayload = [homepageHtml, ...scriptPayloads].join("\n");
      }
    }
  }

  for (const hotspot of homepageHotspots) {
    addGroupedCheck(
      `live homepage shows AI hotspot ${hotspot.label}`,
      homepageHotspotMismatches({ homepagePayload, hotspot, code: hotspot.code, stockPayload: liveData }),
    );
  }

  const liveStockDeeplinkResults = await verifyLiveStockDeeplinks({
    liveOrigin: LIVE_ORIGIN,
    stockPayload: liveData,
  });
  for (const result of liveStockDeeplinkResults) {
    addCheck(
      `live legacy ${result.requestPath} lands on /?stock=${result.code}`,
      result.passed,
      result.details,
    );
  }

  printResult(expected, localManifest, liveManifest, liveData);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
