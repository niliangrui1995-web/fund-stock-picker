import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const DETAIL_RULE = "sha256(fundFamilyKey UTF-8) 的前 2 位十六进制字符";
const EPSILON = 0.005000001;
const BUILDER_VERSION = "fund-portfolio-index-v1";
const FUND_FAMILY_RULE_VERSION = "fund-family-key-v1";
const VIEW_CLASSIFICATION_RULE_VERSION = "is-on-exchange-fund-v1";
const UNMAPPED_DISCLOSURE = "未映射或不合格的间接产品不按 0% 计入。";
const SHARD_COVERAGE_FIELDS = new Set([
  "directIneligibleByReason",
  "directInputRows",
  "directPublishedEdges",
  "indirectCandidateRows",
  "ineligibleByReason",
  "ineligibleCandidateRows",
  "qualifiedIndirectEdges",
  "unmappedNotCountedAsZero",
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function stockFileStem(stockCode) {
  return `stock-${Buffer.from(stockCode, "utf8").toString("hex")}`;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNonNegativeFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function reasonMapError(value, label) {
  if (!isPlainObject(value)) return `${label} 必须为 reason -> 非负整数对象`;
  for (const [reason, count] of Object.entries(value)) {
    if (!isNonEmptyString(reason) || !isNonNegativeInteger(count)) {
      return `${label} 包含非法 reason 或计数`;
    }
  }
  return null;
}

function sumReasonMap(reasonMap) {
  return Object.values(reasonMap).reduce((total, count) => total + count, 0);
}

function addReasonMap(target, source) {
  for (const [reason, count] of Object.entries(source)) {
    target[reason] = (target[reason] ?? 0) + count;
  }
}

function sameReasonMap(left, right) {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key]);
}

function shardCoverageError(coverage, shard) {
  if (!isPlainObject(coverage)) return "coverage 不是对象";
  const keys = Object.keys(coverage);
  if (keys.length !== SHARD_COVERAGE_FIELDS.size || keys.some((key) => !SHARD_COVERAGE_FIELDS.has(key))) {
    return "coverage 字段不符合股票分片固定 schema";
  }
  for (const field of ["directInputRows", "directPublishedEdges", "indirectCandidateRows", "ineligibleCandidateRows", "qualifiedIndirectEdges"]) {
    if (!isNonNegativeInteger(coverage[field])) return `coverage.${field} 必须为非负整数`;
  }
  for (const field of ["directIneligibleByReason", "ineligibleByReason"]) {
    const error = reasonMapError(coverage[field], `coverage.${field}`);
    if (error) return error;
  }
  if (coverage.unmappedNotCountedAsZero !== UNMAPPED_DISCLOSURE) return "coverage 未映射披露文本不一致";
  if (coverage.directPublishedEdges !== shard.directEdges.length || coverage.qualifiedIndirectEdges !== shard.indirectEdges.length) {
    return "coverage 已发布边数与股票分片边数组不一致";
  }
  if (coverage.directPublishedEdges + sumReasonMap(coverage.directIneligibleByReason) > coverage.directInputRows
    || coverage.indirectCandidateRows < coverage.qualifiedIndirectEdges + coverage.ineligibleCandidateRows
    || coverage.ineligibleCandidateRows !== sumReasonMap(coverage.ineligibleByReason)) {
    return "coverage 输入、已发布或 reason 合计不一致";
  }
  return null;
}

function fail(reason, checkedShards, details = {}) {
  return { ok: false, reason, checkedShards, ...details };
}

function safeRelativePath(relativePath) {
  if (!isNonEmptyString(relativePath) || relativePath.includes("\\")) {
    return false;
  }
  const normalized = path.posix.normalize(relativePath);
  return !path.posix.isAbsolute(relativePath)
    && normalized === relativePath
    && !relativePath.split("/").includes("..")
    && !relativePath.split("/").includes(".");
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function matchesReleaseMetadata(payload, manifest) {
  return payload?.schemaVersion === "1"
    && payload?.releaseId === manifest.releaseId
    && payload?.report === manifest.report
    && payload?.cutoffDate === manifest.cutoffDate
    && payload?.generatedAt === manifest.generatedAt
    && payload?.integrity?.algorithm === "SHA-256"
    && payload?.integrity?.encoding === "UTF-8";
}

function validManifest(manifest, report) {
  if (!isPlainObject(manifest)) return "manifest 不是对象";
  if (manifest.schemaVersion !== "1") return "manifest.schemaVersion 必须为 \"1\"";
  if (!isNonEmptyString(manifest.releaseId) || !/^[a-z0-9]+-[a-z0-9-]+$/i.test(manifest.releaseId)) {
    return "manifest.releaseId 缺失或格式不安全";
  }
  if (manifest.report !== report || !/^\d{4}Q[1-4]$/.test(manifest.report)) {
    return `manifest.report 与请求季度不一致（期望 ${report}）`;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(manifest.cutoffDate) || Number.isNaN(Date.parse(`${manifest.cutoffDate}T00:00:00Z`))) {
    return "manifest.cutoffDate 无效";
  }
  if (!isNonEmptyString(manifest.generatedAt) || Number.isNaN(Date.parse(manifest.generatedAt))) {
    return "manifest.generatedAt 无效";
  }
  for (const field of ["source", "sourceFile", "fundInvestmentSourceFile", "disclosure", "auditPath"]) {
    if (!isNonEmptyString(manifest[field])) return `manifest.${field} 缺失`;
  }
  if (manifest.builderVersion !== BUILDER_VERSION) return "manifest.builderVersion 不符合固定契约";
  if (manifest.fundFamilyRuleVersion !== FUND_FAMILY_RULE_VERSION) return "manifest.fundFamilyRuleVersion 不符合固定契约";
  if (manifest.viewClassificationRuleVersion !== VIEW_CLASSIFICATION_RULE_VERSION) return "manifest.viewClassificationRuleVersion 不符合固定契约";
  if (manifest.publishStatus !== "complete") return "manifest.publishStatus 必须为 complete";
  if (!isNonNegativeInteger(manifest.inputHoldingRows) || !isNonNegativeInteger(manifest.fundInvestmentSourceRows)) {
    return "manifest.inputHoldingRows 与 fundInvestmentSourceRows 必须为非负整数";
  }
  if (manifest.fundDetailShardRule !== DETAIL_RULE || manifest.fundDetailDisplayLimit !== 10) {
    return "manifest 基金详情分片规则或展示上限不符合固定契约";
  }
  if (!manifest.disclosure.includes("未出现不代表未持有") || !manifest.disclosure.includes("最多展示 10 条")) {
    return "manifest 披露文本缺少组合发布边界";
  }
  if (manifest.auditPath !== `public/seo/indirect-exposure-audit-${report.toLowerCase()}.md`) {
    return "manifest.auditPath 与报告期不一致";
  }
  if (!isPlainObject(manifest.coverage) || !isPlainObject(manifest.shards) || !isPlainObject(manifest.fundDetailShards)) {
    return "manifest.coverage、shards 或 fundDetailShards 缺失";
  }
  if (Object.keys(manifest.shards).length === 0 || Object.keys(manifest.fundDetailShards).length === 0) {
    return "manifest 不得发布空分片集合";
  }
  return null;
}

function validProfile(profile, fundFamilyKey, detailShardKeys) {
  if (!isPlainObject(profile) || profile.fundFamilyKey !== fundFamilyKey) return "基金 profile 与键不一致";
  for (const field of ["fundCode", "fundName", "fundDisplayName", "fundType", "detailShardKey"]) {
    if (!isNonEmptyString(profile[field])) return `基金 profile.${field} 缺失`;
  }
  if (!Array.isArray(profile.fundVariantCodes) || profile.fundVariantCodes.length === 0 || profile.fundVariantCodes.some((code) => !isNonEmptyString(code))) {
    return "基金 profile.fundVariantCodes 无效";
  }
  if (new Set(profile.fundVariantCodes).size !== profile.fundVariantCodes.length) return "基金 profile.fundVariantCodes 重复";
  if (typeof profile.isOnExchangeFund !== "boolean") return "基金 profile.isOnExchangeFund 必须为布尔值";
  const expectedView = profile.isOnExchangeFund ? "onExchange" : "offExchange";
  if (profile.view !== expectedView) return "基金 profile.view 与场内分类不一致";
  if (!/^[a-f0-9]{2}$/.test(profile.detailShardKey) || !detailShardKeys.has(profile.detailShardKey)) {
    return "基金 profile.detailShardKey 未映射到 manifest 详情分片";
  }
  if (profile.detailShardKey !== sha256(Buffer.from(fundFamilyKey, "utf8")).slice(0, 2)) {
    return "基金 profile.detailShardKey 不等于 fundFamilyKey 的 SHA-256 前缀";
  }
  return null;
}

function profileComparable(profile) {
  return {
    fundCode: profile.fundCode,
    fundName: profile.fundName,
    fundDisplayName: profile.fundDisplayName,
    fundType: profile.fundType,
    fundVariantCodes: profile.fundVariantCodes,
    isOnExchangeFund: profile.isOnExchangeFund,
    view: profile.view,
    detailShardKey: profile.detailShardKey,
  };
}

function validHolding(holding) {
  if (!isPlainObject(holding) || !Number.isInteger(holding.rank) || holding.rank < 1) return false;
  if (!isNonEmptyString(holding.stockCode) || !isNonEmptyString(holding.stockName) || !isNonNegativeFiniteNumber(holding.ratioPercent)) return false;
  return (holding.marketValueWan === undefined || holding.marketValueWan === null || isNonNegativeFiniteNumber(holding.marketValueWan))
    && (holding.sharesWan === undefined || isNonNegativeFiniteNumber(holding.sharesWan));
}

async function readJsonWithHash(publicDataDir, relativePath, expectedHash) {
  if (!safeRelativePath(relativePath)) throw new Error(`不安全的相对分片路径：${relativePath}`);
  const absolutePath = path.resolve(publicDataDir, relativePath);
  const dataRoot = `${path.resolve(publicDataDir)}${path.sep}`;
  if (!absolutePath.startsWith(dataRoot)) throw new Error(`分片路径越出 public/data：${relativePath}`);
  const bytes = await readFile(absolutePath);
  const actualHash = sha256(bytes);
  if (!HASH_PATTERN.test(expectedHash ?? "") || actualHash !== expectedHash) {
    throw new Error(`分片 SHA-256 不匹配：${relativePath}`);
  }
  try {
    return { payload: JSON.parse(bytes.toString("utf8")), sha256: actualHash };
  } catch (error) {
    throw new Error(`分片 JSON 无法解析：${relativePath}（${error.message}）`);
  }
}

/**
 * 校验 Task 1 发布的组合 manifest、股票分片及基金详情分片。
 * 任一契约失败均返回 ok=false；调用方不得将部分结果视为可发布。
 */
export async function verifyPortfolioRelease({ publicDataDir, report }) {
  const checkedShards = { stock: 0, fundDetails: 0 };
  const dataDir = path.resolve(publicDataDir ?? path.join(ROOT, "public", "data"));
  const normalizedReport = String(report ?? "");
  const slug = normalizedReport.toLowerCase();
  const manifestRelativePath = `fund-portfolio-index-${slug}.manifest.json`;
  let manifestBytes;
  let manifest;

  try {
    manifestBytes = await readFile(path.join(dataDir, manifestRelativePath));
    manifest = JSON.parse(manifestBytes.toString("utf8"));
  } catch (error) {
    return fail(`无法读取组合 manifest ${manifestRelativePath}：${error.message}`, checkedShards);
  }

  const manifestError = validManifest(manifest, normalizedReport);
  if (manifestError) return fail(manifestError, checkedShards);

  const manifestSha256 = sha256(manifestBytes);
  const detailShardKeys = new Set(Object.keys(manifest.fundDetailShards));
  const profiles = new Map();
  const expectedDetails = new Map();
  let directEdgeCount = 0;
  let indirectEdgeCount = 0;
  const aggregateCoverage = {
    directInputRows: 0,
    directPublishedEdges: 0,
    indirectCandidateRows: 0,
    qualifiedIndirectEdges: 0,
    directIneligibleByReason: {},
    ineligibleByReason: {},
  };

  try {
    for (const [stockCode, entry] of Object.entries(manifest.shards)) {
      if (!isPlainObject(entry) || !HASH_PATTERN.test(entry.sha256 ?? "") || !isNonNegativeInteger(entry.directEdgeCount) || !isNonNegativeInteger(entry.qualifiedIndirectEdgeCount)) {
        return fail(`股票分片 ${stockCode} 的 manifest 条目无效`, checkedShards);
      }
      const expectedPath = `fund-portfolio-index-${slug}/${manifest.releaseId}/${stockFileStem(stockCode)}.json`;
      if (entry.path !== expectedPath) return fail(`股票分片 ${stockCode} 路径不符合 releaseId 契约`, checkedShards);

      const { payload: shard } = await readJsonWithHash(dataDir, entry.path, entry.sha256);
      checkedShards.stock += 1;
      if (!matchesReleaseMetadata(shard, manifest)) return fail(`股票分片 ${stockCode} 的发布元数据不一致`, checkedShards);
      if (!isPlainObject(shard.stock) || shard.stock.code !== stockCode || !isNonEmptyString(shard.stock.name)) {
        return fail(`股票分片 ${stockCode} 的目标代码或名称不一致`, checkedShards);
      }
      if (!isPlainObject(shard.fundProfiles) || !Array.isArray(shard.directEdges) || !Array.isArray(shard.indirectEdges) || !isPlainObject(shard.coverage)) {
        return fail(`股票分片 ${stockCode} 缺少 profile、边或 coverage`, checkedShards);
      }
      if (shard.directEdges.length !== entry.directEdgeCount || shard.indirectEdges.length !== entry.qualifiedIndirectEdgeCount) {
        return fail(`股票分片 ${stockCode} 的边数与 manifest 不一致`, checkedShards);
      }
      const coverageError = shardCoverageError(shard.coverage, shard);
      if (coverageError) return fail(`股票分片 ${stockCode}：${coverageError}`, checkedShards);

      for (const [fundFamilyKey, profile] of Object.entries(shard.fundProfiles)) {
        const profileError = validProfile(profile, fundFamilyKey, detailShardKeys);
        if (profileError) return fail(`股票分片 ${stockCode}：${profileError}`, checkedShards);
        const comparable = profileComparable(profile);
        const previous = profiles.get(fundFamilyKey);
        if (previous && !sameJson(previous, comparable)) {
          return fail(`基金家族 ${fundFamilyKey} 跨股票分片 profile 或分类不一致`, checkedShards);
        }
        profiles.set(fundFamilyKey, comparable);
        expectedDetails.set(fundFamilyKey, profile.detailShardKey);
      }

      const directKeys = new Set();
      for (const edge of shard.directEdges) {
        if (!isPlainObject(edge) || edge.targetCode !== stockCode || !isNonEmptyString(edge.targetName) || !isPositiveFiniteNumber(edge.ratioPercent)) {
          return fail(`股票分片 ${stockCode} 存在无效直接边`, checkedShards);
        }
        const profile = shard.fundProfiles[edge.fundFamilyKey];
        if (!profile || typeof edge.isOnExchangeFund !== "boolean" || edge.isOnExchangeFund !== profile.isOnExchangeFund) {
          return fail(`股票分片 ${stockCode} 直接边的基金分类不一致`, checkedShards);
        }
        const key = `${edge.fundFamilyKey}\u0000${edge.targetCode}`;
        if (directKeys.has(key)) return fail(`股票分片 ${stockCode} 存在重复直接边去重键`, checkedShards);
        directKeys.add(key);
      }

      const indirectKeys = new Set();
      for (const edge of shard.indirectEdges) {
        if (!isPlainObject(edge)
          || edge.targetCode !== stockCode
          || !isNonEmptyString(edge.targetName)
          || !isNonEmptyString(edge.sourceCode)
          || !isNonEmptyString(edge.sourceName)
          || !isNonEmptyString(edge.matchReason)
          || !isPositiveFiniteNumber(edge.sourceRatioPercent)
          || !isPositiveFiniteNumber(edge.leverageMultiple)
          || !isPositiveFiniteNumber(edge.estimatedRatioPercent)) {
          return fail(`股票分片 ${stockCode} 存在无效间接边`, checkedShards);
        }
        if (Math.abs(edge.sourceRatioPercent * edge.leverageMultiple - edge.estimatedRatioPercent) > EPSILON) {
          return fail(`股票分片 ${stockCode} 的 sourceRatioPercent 与估算公式不一致`, checkedShards);
        }
        const profile = shard.fundProfiles[edge.fundFamilyKey];
        if (!profile || typeof edge.isOnExchangeFund !== "boolean" || edge.isOnExchangeFund !== profile.isOnExchangeFund) {
          return fail(`股票分片 ${stockCode} 间接边的基金分类不一致`, checkedShards);
        }
        const key = `${edge.fundFamilyKey}\u0000${edge.targetCode}\u0000${edge.sourceCode}`;
        if (indirectKeys.has(key)) return fail(`股票分片 ${stockCode} 存在重复间接边去重键`, checkedShards);
        indirectKeys.add(key);
      }
      directEdgeCount += shard.directEdges.length;
      indirectEdgeCount += shard.indirectEdges.length;
      aggregateCoverage.directInputRows += shard.coverage.directInputRows;
      aggregateCoverage.directPublishedEdges += shard.coverage.directPublishedEdges;
      aggregateCoverage.indirectCandidateRows += shard.coverage.indirectCandidateRows;
      aggregateCoverage.qualifiedIndirectEdges += shard.coverage.qualifiedIndirectEdges;
      addReasonMap(aggregateCoverage.directIneligibleByReason, shard.coverage.directIneligibleByReason);
      addReasonMap(aggregateCoverage.ineligibleByReason, shard.coverage.ineligibleByReason);
    }

    const detailFamilies = new Set();
    let availableDetails = 0;
    let unavailableDetails = 0;
    for (const [detailKey, entry] of Object.entries(manifest.fundDetailShards)) {
      if (!/^[a-f0-9]{2}$/.test(detailKey) || !isPlainObject(entry) || !HASH_PATTERN.test(entry.sha256 ?? "") || !isNonNegativeInteger(entry.fundFamilyCount)) {
        return fail(`基金详情分片 ${detailKey} 的 manifest 条目无效`, checkedShards);
      }
      const expectedPath = `fund-portfolio-index-${slug}/${manifest.releaseId}/fund-details/${detailKey}.json`;
      if (entry.path !== expectedPath) return fail(`基金详情分片 ${detailKey} 路径不符合 releaseId 契约`, checkedShards);
      const { payload: detailShard } = await readJsonWithHash(dataDir, entry.path, entry.sha256);
      checkedShards.fundDetails += 1;
      if (!matchesReleaseMetadata(detailShard, manifest) || detailShard.fundFamilyKeyHashPrefix !== detailKey || !isPlainObject(detailShard.fundDetails)) {
        return fail(`基金详情分片 ${detailKey} 的发布元数据或前缀不一致`, checkedShards);
      }
      const detailEntries = Object.entries(detailShard.fundDetails);
      if (detailEntries.length !== entry.fundFamilyCount) return fail(`基金详情分片 ${detailKey} 的家族数与 manifest 不一致`, checkedShards);
      for (const [fundFamilyKey, detail] of detailEntries) {
        if (!isPlainObject(detail) || detail.fundFamilyKey !== fundFamilyKey || expectedDetails.get(fundFamilyKey) !== detailKey || detailFamilies.has(fundFamilyKey)) {
          return fail(`基金详情分片 ${detailKey} 与 profile 的映射不一致`, checkedShards);
        }
        detailFamilies.add(fundFamilyKey);
        if (detail.detailStatus === "available") {
          if (!isNonEmptyString(detail.detailFundCode) || !Array.isArray(detail.holdings) || detail.holdings.length === 0 || detail.holdings.length > manifest.fundDetailDisplayLimit || detail.holdings.some((holding) => !validHolding(holding))) {
            return fail(`基金详情分片 ${detailKey} 的 available 详情无效`, checkedShards);
          }
          availableDetails += 1;
        } else if (detail.detailStatus === "not_captured_in_current_stock_detail_rows") {
          if (!isNonEmptyString(detail.detailMessage) || detail.holdings !== undefined) {
            return fail(`基金详情分片 ${detailKey} 的未采集详情状态无效`, checkedShards);
          }
          unavailableDetails += 1;
        } else {
          return fail(`基金详情分片 ${detailKey} 的 detailStatus 无效`, checkedShards);
        }
      }
    }

    if (detailFamilies.size !== expectedDetails.size || [...expectedDetails.keys()].some((key) => !detailFamilies.has(key))) {
      return fail("基金详情分片未覆盖所有发布的基金 profile", checkedShards);
    }
    const coverage = manifest.coverage;
    for (const field of ["directIneligibleByReason", "ineligibleByReason", "unmappedByReason"]) {
      const error = reasonMapError(coverage[field], `manifest.coverage.${field}`);
      if (error) return fail(error, checkedShards);
    }
    const countChecks = [
      ["stockShardCount", checkedShards.stock],
      ["fundDetailShardCount", checkedShards.fundDetails],
      ["directPublishedEdges", directEdgeCount],
      ["qualifiedIndirectEdges", indirectEdgeCount],
      ["directInputRows", aggregateCoverage.directInputRows],
      ["fundDetailFamilyCount", detailFamilies.size],
      ["fundDetailAvailableFamilyCount", availableDetails],
      ["fundDetailNotCapturedFamilyCount", unavailableDetails],
    ];
    for (const [field, actual] of countChecks) {
      if (!isNonNegativeInteger(coverage[field]) || coverage[field] !== actual) {
        return fail(`manifest.coverage.${field} 与实际分片不一致`, checkedShards);
      }
    }
    if (!isNonNegativeInteger(coverage.indirectCandidateRows) || coverage.indirectCandidateRows !== aggregateCoverage.indirectCandidateRows
      || !isNonNegativeInteger(coverage.unmappedCandidateRows)
      || coverage.unmappedCandidateRows !== sumReasonMap(coverage.unmappedByReason)
      || !sameReasonMap(coverage.directIneligibleByReason, aggregateCoverage.directIneligibleByReason)
      || !sameReasonMap(coverage.ineligibleByReason, aggregateCoverage.ineligibleByReason)
      || coverage.unmappedNotCountedAsZero !== UNMAPPED_DISCLOSURE) {
      return fail("manifest.coverage 的来源、排除或未映射披露不符合契约", checkedShards);
    }
  } catch (error) {
    return fail(error.message, checkedShards);
  }

  return {
    ok: true,
    reason: "组合发布包校验通过",
    checkedShards,
    manifestPath: manifestRelativePath,
    manifestSha256,
    releaseId: manifest.releaseId,
    report: manifest.report,
    stockShardCount: checkedShards.stock,
    fundDetailShardCount: checkedShards.fundDetails,
  };
}

async function main() {
  const report = process.argv[2] ?? "2026Q2";
  const result = await verifyPortfolioRelease({
    publicDataDir: path.join(ROOT, "public", "data"),
    report,
  });
  if (!result.ok) {
    console.error(`组合发布包校验失败：${result.reason}`);
    process.exitCode = 1;
    return;
  }
  console.log(`组合发布包校验通过：${result.report}；manifest=${result.manifestPath}；releaseId=${result.releaseId}；manifestSha256=${result.manifestSha256}；股票分片=${result.stockShardCount}；详情分片=${result.fundDetailShardCount}`);
}

if (process.argv[1] && import.meta.url === new URL(`file:${process.argv[1].replace(/\\/g, "/")}`).href) {
  main().catch((error) => {
    console.error(`组合发布包校验失败：${error.message}`);
    process.exitCode = 1;
  });
}
