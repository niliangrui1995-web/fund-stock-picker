import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { loadQuarterConfig, ROOT } from "./quarter-config.mjs";
import { evaluatePurchaseLimitSnapshotFreshness } from "./purchase-limit-freshness.mjs";
import { normalizeStockCode, verifyLiveStockDeeplinks } from "./verify-stock-deeplinks.mjs";
import { verifyPortfolioRelease } from "./verify-portfolio-index.mjs";

const DEFAULT_LIVE_ORIGIN = "https://fund.niliangrui.cloud";
const LIVE_ORIGIN = (process.env.LIVE_RELEASE_ORIGIN || DEFAULT_LIVE_ORIGIN).replace(/\/+$/, "");
const CACHE_BUST = process.env.LIVE_RELEASE_CACHE_BUST || Date.now().toString();
const RELEASE_CHECK_PATH = "seo/quarter-release-check.json";
const HOMEPAGE_PATH = "/";
const INDEPENDENT_PAGE_PATHS = ["/research", "/leverage", "/concentration", "/methodology"];
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
  const { text } = await fetchTextWithHeaders(url, label);
  return text;
}

async function fetchTextWithHeaders(url, label) {
  const response = await fetchReleaseBytes(url, label);
  return {
    ...response,
    text: new TextDecoder().decode(response.bytes),
  };
}

export async function fetchReleaseBytes(url, label) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "accept-encoding": "identity",
      "cache-control": "no-cache",
      pragma: "no-cache",
    },
  });

  if (!response.ok) {
    throw new Error(`${label} returned ${response.status} ${response.statusText}`);
  }

  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    headers: response.headers,
  };
}

async function fetchJson(url, label) {
  const { text } = await fetchTextWithHeaders(url, label);
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
    ["portfolioRelease.manifestPath", expected.portfolioManifestPath],
    ["portfolioRelease.report", expected.report],
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
    "portfolioRelease.manifestPath",
    "portfolioRelease.releaseId",
    "portfolioRelease.manifestSha256",
    "portfolioRelease.report",
    "portfolioRelease.stockShardCount",
    "portfolioRelease.fundDetailShardCount",
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

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function compareReleaseBytes(localBytes, liveBytes) {
  const localSha256 = sha256(localBytes);
  const liveSha256 = sha256(liveBytes);
  return {
    localSha256,
    liveSha256,
    matches: localSha256 === liveSha256,
  };
}

function cacheHeaderMatches(header, expected) {
  const value = String(header ?? "").toLowerCase();
  if (expected === "no-cache") return /(?:^|,)\s*no-cache\b/.test(value);
  return /\bpublic\b/.test(value)
    && /\bmax-age=604800\b/.test(value)
    && /\bstale-while-revalidate=86400\b/.test(value)
    && !/\bno-cache\b/.test(value);
}

function portfolioBrowserPath(quarterConfig) {
  return `data/fund-portfolio-index-${quarterConfig.slug}.manifest.json`;
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), Math.max(1, items.length));
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index]);
    }
  }));
  return results;
}

export async function verifyDeclaredPortfolioShards(manifest, {
  concurrency = 8,
  fetchBytes = fetchTextWithHeaders,
  recordCheck = addCheck,
  urlFor = liveUrl,
} = {}) {
  const groups = [
    ["stock", Object.entries(manifest?.shards ?? {})],
    ["fund detail", Object.entries(manifest?.fundDetailShards ?? {})],
  ];
  const entries = groups.flatMap(([kind, groupEntries]) =>
    groupEntries.map(([key, metadata]) => ({ kind, key, metadata })),
  );
  const failures = [];
  for (const [kind, groupEntries] of groups) {
    if (groupEntries.length === 0) failures.push(`${kind}: manifest has no declared shards`);
  }

  const results = await mapWithConcurrency(entries, concurrency, async ({ kind, key, metadata }) => {
    if (!metadata?.path || !metadata?.sha256) {
      return `${kind} ${key}: manifest does not declare a path and SHA-256`;
    }
    const browserPath = `data/${metadata.path}`;
    try {
      const response = await fetchBytes(
        urlFor(browserPath),
        `live portfolio ${kind} shard ${metadata.path}`,
      );
      const liveHash = sha256(response.bytes);
      const entryFailures = [];
      if (liveHash !== metadata.sha256) {
        entryFailures.push(`SHA-256 declared=${metadata.sha256}, live=${liveHash}`);
      }
      const cacheControl = response.headers.get("cache-control");
      if (!cacheHeaderMatches(cacheControl, "release")) {
        entryFailures.push(`Cache-Control=${cacheControl ?? "missing"}`);
      }
      return entryFailures.length > 0
        ? `${kind} ${metadata.path}: ${entryFailures.join(", ")}`
        : null;
    } catch (error) {
      return `${kind} ${metadata.path}: ${error.message}`;
    }
  });
  failures.push(...results.filter(Boolean));
  recordCheck(
    `all ${entries.length} declared live portfolio shards match SHA-256 and cache policy`,
    failures.length === 0,
    failures.length === 0 ? `checked=${entries.length}` : failures.join("; "),
  );
  return { checked: entries.length, failures };
}

async function verifyLivePortfolioRelease(quarterConfig) {
  const localResult = await verifyPortfolioRelease({
    publicDataDir: path.join(ROOT, "public", "data"),
    report: quarterConfig.report,
  });
  addCheck(
    "local portfolio release passes the shared verifier",
    localResult.ok,
    localResult.ok
      ? `releaseId=${localResult.releaseId}; manifest=${localResult.manifestPath}; sha256=${localResult.manifestSha256}; stockShards=${localResult.stockShardCount}; detailShards=${localResult.fundDetailShardCount}`
      : localResult.reason,
  );
  if (!localResult.ok) return;

  const manifestPath = portfolioBrowserPath(quarterConfig);
  let livePortfolioManifest;
  try {
    const response = await fetchTextWithHeaders(liveUrl(manifestPath), `live portfolio manifest ${manifestPath}`);
    const liveManifestSha256 = sha256(response.bytes);
    livePortfolioManifest = JSON.parse(response.text);
    addCheck(`live portfolio manifest ${manifestPath} is reachable`, true);
    addCheck(
      "live portfolio manifest bytes match the locally verified manifest",
      liveManifestSha256 === localResult.manifestSha256,
      `local=${localResult.manifestSha256}; live=${liveManifestSha256}`,
    );
    addCheck(
      "live portfolio manifest uses no-cache",
      cacheHeaderMatches(response.headers.get("cache-control"), "no-cache"),
      `Cache-Control=${response.headers.get("cache-control") ?? "missing"}`,
    );
  } catch (error) {
    addCheck(`live portfolio manifest ${manifestPath} is reachable`, false, error.message);
    return;
  }

  addCheck(
    "live portfolio manifest release metadata matches the local verified release",
    livePortfolioManifest?.schemaVersion === "1"
      && livePortfolioManifest?.releaseId === localResult.releaseId
      && livePortfolioManifest?.report === quarterConfig.report
      && livePortfolioManifest?.cutoffDate === quarterConfig.cutoffDate
      && livePortfolioManifest?.publishStatus === "complete",
    `releaseId=${formatValue(livePortfolioManifest?.releaseId)}; report=${formatValue(livePortfolioManifest?.report)}; cutoffDate=${formatValue(livePortfolioManifest?.cutoffDate)}`,
  );

  await verifyDeclaredPortfolioShards(livePortfolioManifest);
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

function expectedHomepageQuickHotspots(hotspots) {
  return (hotspots ?? []).filter((hotspot) => hotspot?.homepageQuickEntry);
}

function expectedHomepageHotspots(hotspots) {
  return hotspots ?? [];
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
    portfolioManifestPath: portfolioBrowserPath(quarterConfig),
  };

  const localManifestPath = path.join(ROOT, quarterConfig.paths.releaseCheckJson);
  const localManifestBytes = await readFile(localManifestPath);
  const localManifest = JSON.parse(new TextDecoder().decode(localManifestBytes));
  const localManifestMismatches = manifestMismatches(localManifest, expected);
  addGroupedCheck("local config matches public/seo/quarter-release-check.json", localManifestMismatches);
  addGroupedCheck("local release manifest declares purchase limit snapshot", purchaseLimitManifestMismatches(localManifest));
  addFreshnessCheck(
    "local release manifest purchase-limit snapshot is fresh enough on the verification date",
    evaluatePurchaseLimitSnapshotFreshness(localManifest.dataMeta, {
      releaseLabel: expected.report,
      snapshotPath: "public/seo/quarter-release-check.json",
    }),
  );

  let liveManifest = null;
  try {
    const response = await fetchTextWithHeaders(
      liveUrl(RELEASE_CHECK_PATH),
      "live quarter-release-check.json",
    );
    liveManifest = JSON.parse(response.text);
    const comparison = compareReleaseBytes(localManifestBytes, response.bytes);
    addCheck("live seo/quarter-release-check.json is reachable", true);
    addCheck(
      "live quarter-release-check bytes match the local release",
      comparison.matches,
      `local=${comparison.localSha256}; live=${comparison.liveSha256}`,
    );
  } catch (error) {
    addCheck("live seo/quarter-release-check.json is reachable", false, error.message);
    printResult(expected, localManifest, liveManifest);
    return;
  }

  addGroupedCheck("live manifest matches local config", manifestMismatches(liveManifest, expected));
  addGroupedCheck("live release manifest declares purchase limit snapshot", purchaseLimitManifestMismatches(liveManifest));
  addFreshnessCheck(
    "live release manifest purchase-limit snapshot is fresh enough on the verification date",
    evaluatePurchaseLimitSnapshotFreshness(liveManifest.dataMeta, {
      releaseLabel: expected.report,
      snapshotPath: `${LIVE_ORIGIN}/${RELEASE_CHECK_PATH}`,
    }),
  );
  addGroupedCheck(
    "live manifest matches local release fingerprint",
    releaseFingerprintDiffs(localManifest, liveManifest),
  );
  await verifyLivePortfolioRelease(quarterConfig);

  const liveDataPath = toBrowserPath(liveManifest.dataPath);
  const liveDataFileName = path.posix.basename(liveDataPath);
  addCheck(
    "live frontend data file name matches configured quarter",
    liveManifest.dataFileName === expected.dataFileName && liveDataFileName === expected.dataFileName,
    `expected ${expected.dataFileName}, got dataFileName=${formatValue(liveManifest.dataFileName)}, path=${formatValue(liveManifest.dataPath)}`,
  );

  let liveData = null;
  try {
    const [localDataBytes, response] = await Promise.all([
      readFile(path.join(ROOT, quarterConfig.paths.fundStockIndexJson)),
      fetchTextWithHeaders(liveUrl(liveDataPath), `live data file ${liveDataPath}`),
    ]);
    liveData = JSON.parse(response.text);
    const comparison = compareReleaseBytes(localDataBytes, response.bytes);
    addCheck(`live data file ${liveDataPath} is reachable`, true);
    addCheck(
      "live main fund-stock-index bytes match the local release",
      comparison.matches,
      `local=${comparison.localSha256}; live=${comparison.liveSha256}`,
    );
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
  const homepageQuickHotspots = expectedHomepageQuickHotspots(localHotspots);
  addCheck(
    "local homepage AI battle hotspots are configured",
    homepageHotspots.length > 0,
    "config/ai-battle-hotspots.json has no AI battle hotspots",
  );
  addCheck(
    "local homepage AI storage quick hotspots are configured",
    homepageQuickHotspots.length > 0,
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

  for (const pagePath of INDEPENDENT_PAGE_PATHS) {
    try {
      await fetchText(liveUrl(pagePath), `live independent page ${pagePath}`);
      addCheck(`live independent page ${pagePath} is reachable`, true);
    } catch (error) {
      addCheck(`live independent page ${pagePath} is reachable`, false, error.message);
    }
  }

  if (homepageHtml) {
    addGroupedCheck(
      "live homepage HTML carries promoted AI storage descriptions",
      homepageDescriptionMismatches({ localHtml: localIndexHtml, homepageHtml, quickHotspots: homepageQuickHotspots }),
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

const isMainModule = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
