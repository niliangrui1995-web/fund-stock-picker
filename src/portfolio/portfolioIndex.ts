import type {
  FundFamilyProfile,
  PortfolioDetailManifestShard,
  PortfolioDetailRecord,
  PortfolioDetailShard,
  PortfolioFundHoldingDetail,
  PortfolioManifest,
  PortfolioManifestCoverage,
  PortfolioManifestShard,
  PortfolioShard,
  PortfolioShardCoverage,
  ReasonCountMap,
} from "./types";

const BUILDER_VERSION = "fund-portfolio-index-v1";
const FUND_FAMILY_RULE_VERSION = "fund-family-key-v1";
const VIEW_RULE_VERSION = "is-on-exchange-fund-v1";
const DETAIL_RULE = "sha256(fundFamilyKey UTF-8) 的前 2 位十六进制字符";
const UNMAPPED_DISCLOSURE = "未映射或不合格的间接产品不按 0% 计入。";
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const DETAIL_PREFIX_PATTERN = /^[a-f0-9]{2}$/;
const FORMULA_TOLERANCE = 0.005000001;
const FALLBACK_ORIGIN = "https://portfolio.local";

type JsonObject = Record<string, unknown>;

export interface LoadedPortfolioIndex {
  manifestUrl: string;
  manifest: PortfolioManifest;
  shards: PortfolioShard[];
}

interface ManifestContext {
  parsedUrl: URL;
  dataBaseUrl: URL;
  expectedReport: string;
  fetchUrl: string;
}

interface StockShardContext {
  manifest: PortfolioManifest;
  stockCode: string;
  metadata: PortfolioManifestShard;
}

interface DetailShardContext {
  manifest: PortfolioManifest;
  prefix: string;
  metadata: PortfolioDetailManifestShard;
}

interface PendingStockShard {
  cacheKey: string;
  shard: PortfolioShard;
  fromCache: boolean;
}

const stockShardCache = new Map<string, PortfolioShard>();
const detailShardCache = new Map<string, PortfolioDetailShard>();

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function quarterCutoff(report: string): string | null {
  const match = /^(\d{4})Q([1-4])$/.exec(report);
  if (match === null) return null;
  const [, year, quarter] = match;
  return {
    "1": `${year}-03-31`,
    "2": `${year}-06-30`,
    "3": `${year}-09-30`,
    "4": `${year}-12-31`,
  }[quarter] ?? null;
}

function assertCondition(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new Error(reason);
}

function exactKeys(value: JsonObject, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function validateReasonMap(value: unknown, label: string): ReasonCountMap {
  assertCondition(isObject(value), `${label} 必须为原因计数对象。`);
  for (const [reason, count] of Object.entries(value)) {
    assertCondition(isNonEmptyString(reason) && isNonNegativeInteger(count), `${label} 包含非法原因或计数。`);
  }
  return value as ReasonCountMap;
}

function sumReasonMap(value: ReasonCountMap): number {
  return Object.values(value).reduce((total, count) => total + count, 0);
}

function validateIntegrity(value: unknown, label: string) {
  assertCondition(
    isObject(value) &&
      value.algorithm === "SHA-256" &&
      value.encoding === "UTF-8",
    `${label}完整性字段无效。`,
  );
}

function releaseMetadataMatches(value: JsonObject, manifest: PortfolioManifest): boolean {
  return (
    value.schemaVersion === "1" &&
    value.releaseId === manifest.releaseId &&
    value.report === manifest.report &&
    value.cutoffDate === manifest.cutoffDate &&
    value.generatedAt === manifest.generatedAt
  );
}

function stockFileStem(stockCode: string): string {
  const utf8Hex = Array.from(new TextEncoder().encode(stockCode))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `stock-${utf8Hex}`;
}

function expectedStockPath(manifest: PortfolioManifest, stockCode: string): string {
  return `fund-portfolio-index-${manifest.report.toLowerCase()}/${manifest.releaseId}/${stockFileStem(stockCode)}.json`;
}

function expectedDetailPath(manifest: PortfolioManifest, prefix: string): string {
  return `fund-portfolio-index-${manifest.report.toLowerCase()}/${manifest.releaseId}/fund-details/${prefix}.json`;
}

function assertSafeStockCode(stockCode: string) {
  assertCondition(
      stockCode.length > 0 &&
      stockCode.trim() === stockCode &&
      !/[\u0000-\u001f\u007f]/.test(stockCode),
    `股票代码 ${stockCode || "(空)"} 不安全。`,
  );
}

function runtimeOrigin(): string {
  return typeof globalThis.location?.origin === "string"
    ? globalThis.location.origin
    : FALLBACK_ORIGIN;
}

function resolveManifestContext(manifestUrl: string): ManifestContext {
  assertCondition(isNonEmptyString(manifestUrl), "组合 manifest URL 无效。");
  const origin = runtimeOrigin();
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(manifestUrl, origin);
  } catch {
    throw new Error("组合 manifest URL 无效。");
  }
  assertCondition(parsedUrl.origin === origin, "组合 manifest 必须使用当前站点同源 URL。");
  assertCondition(parsedUrl.username === "" && parsedUrl.password === "" && parsedUrl.hash === "", "组合 manifest URL 无效。");
  const match = /\/fund-portfolio-index-(\d{4}q[1-4])\.manifest\.json$/i.exec(parsedUrl.pathname);
  assertCondition(match !== null, "组合 manifest URL 未包含有效季度。");
  return {
    parsedUrl,
    dataBaseUrl: new URL(".", parsedUrl),
    expectedReport: match[1].toUpperCase(),
    fetchUrl: manifestUrl,
  };
}

function resolveDeclaredAssetUrl(context: ManifestContext, relativePath: string): string {
  let resolved: URL;
  try {
    resolved = new URL(relativePath, context.dataBaseUrl);
  } catch {
    throw new Error("组合数据分片路径无效。");
  }
  assertCondition(
    resolved.origin === context.parsedUrl.origin &&
      resolved.username === "" &&
      resolved.password === "" &&
      resolved.search === "" &&
      resolved.hash === "" &&
      resolved.pathname === `${context.dataBaseUrl.pathname}${relativePath}`,
    "组合数据分片路径不是同源安全相对路径。",
  );
  return resolved.pathname;
}

function throwIfAborted(signal: AbortSignal) {
  if (!signal.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  throw new DOMException("操作已取消。", "AbortError");
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : isObject(error) && error.name === "AbortError";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  assertCondition(globalThis.crypto?.subtle !== undefined, "浏览器不支持 SHA-256 校验。");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function familyPrefix(fundFamilyKey: string): Promise<string> {
  const encoded = new TextEncoder().encode(fundFamilyKey);
  return (await sha256Hex(encoded.buffer)).slice(0, 2);
}

function parseJsonBytes(bytes: ArrayBuffer, label: string): unknown {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label}不是有效 UTF-8。`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${label} JSON 解析失败。`);
  }
}

async function fetchBytes(
  url: string,
  signal: AbortSignal,
  fetchImpl: typeof fetch,
  label: string,
): Promise<ArrayBuffer> {
  throwIfAborted(signal);
  const response = await fetchImpl(url, { cache: "no-cache", signal });
  throwIfAborted(signal);
  assertCondition(response.ok, `${label}请求失败（HTTP ${response.status}）。`);
  const bytes = await response.arrayBuffer();
  throwIfAborted(signal);
  return bytes;
}

function validateManifestCoverage(value: unknown): PortfolioManifestCoverage {
  const keys = [
    "directIneligibleByReason",
    "directInputRows",
    "directPublishedEdges",
    "fundDetailAvailableFamilyCount",
    "fundDetailFamilyCount",
    "fundDetailNotCapturedFamilyCount",
    "fundDetailShardCount",
    "indirectCandidateRows",
    "ineligibleByReason",
    "qualifiedIndirectEdges",
    "stockShardCount",
    "unmappedByReason",
    "unmappedCandidateRows",
    "unmappedNotCountedAsZero",
  ] as const;
  assertCondition(isObject(value) && exactKeys(value, keys), "manifest coverage 字段无效。");
  for (const field of [
    "directInputRows",
    "directPublishedEdges",
    "fundDetailAvailableFamilyCount",
    "fundDetailFamilyCount",
    "fundDetailNotCapturedFamilyCount",
    "fundDetailShardCount",
    "indirectCandidateRows",
    "qualifiedIndirectEdges",
    "stockShardCount",
    "unmappedCandidateRows",
  ] as const) {
    assertCondition(isNonNegativeInteger(value[field]), `manifest coverage.${field} 必须为非负整数。`);
  }
  const directReasons = validateReasonMap(value.directIneligibleByReason, "manifest coverage.directIneligibleByReason");
  validateReasonMap(value.ineligibleByReason, "manifest coverage.ineligibleByReason");
  const unmappedReasons = validateReasonMap(value.unmappedByReason, "manifest coverage.unmappedByReason");
  assertCondition(value.unmappedNotCountedAsZero === UNMAPPED_DISCLOSURE, "manifest 未映射披露文本不一致。");
  assertCondition(
    (value.directPublishedEdges as number) + sumReasonMap(directReasons) <=
      (value.directInputRows as number),
    "manifest 直接边 coverage 不守恒。",
  );
  assertCondition(
    (value.qualifiedIndirectEdges as number) <= (value.indirectCandidateRows as number),
    "manifest 间接边 coverage 不守恒。",
  );
  assertCondition(
    sumReasonMap(unmappedReasons) === value.unmappedCandidateRows,
    "manifest 未映射 coverage 不守恒。",
  );
  assertCondition(
    (value.fundDetailAvailableFamilyCount as number) +
      (value.fundDetailNotCapturedFamilyCount as number) ===
      value.fundDetailFamilyCount,
    "manifest 基金详情 coverage 不守恒。",
  );
  return value as unknown as PortfolioManifestCoverage;
}

function validateManifestStockEntries(
  value: unknown,
  manifest: PortfolioManifest,
): Record<string, PortfolioManifestShard> {
  assertCondition(isObject(value) && Object.keys(value).length > 0, "manifest 股票分片声明为空。");
  const shards = Object.create(null) as Record<string, PortfolioManifestShard>;
  for (const [stockCode, metadata] of Object.entries(value)) {
    assertSafeStockCode(stockCode);
    assertCondition(isObject(metadata), `股票分片 ${stockCode} 声明无效。`);
    assertCondition(
      metadata.path === expectedStockPath(manifest, stockCode),
      `股票分片 ${stockCode} 路径不符合 releaseId 契约。`,
    );
    assertCondition(
      typeof metadata.sha256 === "string" && SHA256_PATTERN.test(metadata.sha256),
      `股票分片 ${stockCode} SHA-256 声明无效。`,
    );
    assertCondition(
      isNonNegativeInteger(metadata.directEdgeCount) &&
        isNonNegativeInteger(metadata.qualifiedIndirectEdgeCount),
      `股票分片 ${stockCode} 边数声明无效。`,
    );
    shards[stockCode] = metadata as unknown as PortfolioManifestShard;
  }
  return shards;
}

function validateManifestDetailEntries(
  value: unknown,
  manifest: PortfolioManifest,
): Record<string, PortfolioDetailManifestShard> {
  assertCondition(isObject(value) && Object.keys(value).length > 0, "manifest 基金详情分片声明为空。");
  const detailShards = Object.create(null) as Record<string, PortfolioDetailManifestShard>;
  for (const [prefix, metadata] of Object.entries(value)) {
    assertCondition(DETAIL_PREFIX_PATTERN.test(prefix) && isObject(metadata), `基金详情分片 ${prefix} 声明无效。`);
    assertCondition(
      metadata.path === expectedDetailPath(manifest, prefix),
      `基金详情分片 ${prefix} 路径不符合 releaseId 契约。`,
    );
    assertCondition(
      typeof metadata.sha256 === "string" && SHA256_PATTERN.test(metadata.sha256),
      `基金详情分片 ${prefix} SHA-256 声明无效。`,
    );
    assertCondition(isNonNegativeInteger(metadata.fundFamilyCount), `基金详情分片 ${prefix} 家族数声明无效。`);
    detailShards[prefix] = metadata as unknown as PortfolioDetailManifestShard;
  }
  return detailShards;
}

export function validatePortfolioManifest(
  value: unknown,
  context: { manifestUrl: string },
): PortfolioManifest {
  assertCondition(isObject(value), "组合 manifest 不是对象。");
  const urlContext = resolveManifestContext(context.manifestUrl);
  assertCondition(value.schemaVersion === "1", "组合 manifest schemaVersion 无效。");
  assertCondition(isNonEmptyString(value.releaseId) && /^[a-z0-9]+-[a-z0-9-]+$/i.test(value.releaseId), "组合 manifest releaseId 无效。");
  assertCondition(value.report === urlContext.expectedReport, "组合 manifest 报告期与请求季度不一致。");
  assertCondition(quarterCutoff(value.report as string) === value.cutoffDate && isValidDate(value.cutoffDate), "组合 manifest 截止日无效。");
  assertCondition(isNonEmptyString(value.generatedAt) && !Number.isNaN(Date.parse(value.generatedAt)), "组合 manifest 生成时间无效。");
  assertCondition(value.builderVersion === BUILDER_VERSION, "组合 manifest builderVersion 无效。");
  assertCondition(value.fundFamilyRuleVersion === FUND_FAMILY_RULE_VERSION, "组合 manifest 基金家族规则版本无效。");
  assertCondition(value.viewClassificationRuleVersion === VIEW_RULE_VERSION, "组合 manifest 分类规则版本无效。");
  assertCondition(value.publishStatus === "complete", "组合 manifest 未完整发布。");
  assertCondition(isNonNegativeInteger(value.inputHoldingRows) && isNonNegativeInteger(value.fundInvestmentSourceRows), "组合 manifest 输入行数无效。");
  for (const field of ["source", "sourceFile", "fundInvestmentSourceFile", "disclosure", "auditPath"] as const) {
    assertCondition(isNonEmptyString(value[field]), `组合 manifest ${field} 缺失。`);
  }
  assertCondition(
    (value.disclosure as string).includes("未出现不代表未持有") &&
      (value.disclosure as string).includes("最多展示 10 条"),
    "组合 manifest 披露边界无效。",
  );
  assertCondition(value.auditPath === `public/seo/indirect-exposure-audit-${urlContext.expectedReport.toLowerCase()}.md`, "组合 manifest 审计路径无效。");
  assertCondition(value.fundDetailShardRule === DETAIL_RULE && value.fundDetailDisplayLimit === 10, "组合 manifest 详情规则或上限无效。");

  const provisional = value as unknown as PortfolioManifest;
  const coverage = validateManifestCoverage(value.coverage);
  const shards = validateManifestStockEntries(value.shards, provisional);
  const fundDetailShards = validateManifestDetailEntries(value.fundDetailShards, provisional);
  assertCondition(coverage.stockShardCount === Object.keys(shards).length, "manifest 股票分片数与声明不一致。");
  assertCondition(coverage.fundDetailShardCount === Object.keys(fundDetailShards).length, "manifest 基金详情分片数与声明不一致。");
  assertCondition(
    Object.values(fundDetailShards).reduce((total, item) => total + item.fundFamilyCount, 0) ===
      coverage.fundDetailFamilyCount,
    "manifest 基金详情家族数与声明不一致。",
  );
  return { ...provisional, coverage, shards, fundDetailShards };
}

function validateShardCoverage(value: unknown, shard: JsonObject): PortfolioShardCoverage {
  const keys = [
    "directIneligibleByReason",
    "directInputRows",
    "directPublishedEdges",
    "indirectCandidateRows",
    "ineligibleByReason",
    "ineligibleCandidateRows",
    "qualifiedIndirectEdges",
    "unmappedNotCountedAsZero",
  ] as const;
  assertCondition(isObject(value) && exactKeys(value, keys), "股票分片 coverage 字段无效。");
  for (const field of [
    "directInputRows",
    "directPublishedEdges",
    "indirectCandidateRows",
    "ineligibleCandidateRows",
    "qualifiedIndirectEdges",
  ] as const) {
    assertCondition(isNonNegativeInteger(value[field]), `股票分片 coverage.${field} 必须为非负整数。`);
  }
  const directReasons = validateReasonMap(value.directIneligibleByReason, "股票分片 directIneligibleByReason");
  const indirectReasons = validateReasonMap(value.ineligibleByReason, "股票分片 ineligibleByReason");
  assertCondition(value.unmappedNotCountedAsZero === UNMAPPED_DISCLOSURE, "股票分片未映射披露文本不一致。");
  assertCondition(
    Array.isArray(shard.directEdges) && value.directPublishedEdges === shard.directEdges.length &&
      Array.isArray(shard.indirectEdges) && value.qualifiedIndirectEdges === shard.indirectEdges.length,
    "股票分片 coverage 已发布边数不一致。",
  );
  assertCondition(
    (value.directPublishedEdges as number) + sumReasonMap(directReasons) <=
      (value.directInputRows as number),
    "股票分片直接边 coverage 不守恒。",
  );
  assertCondition(
    value.ineligibleCandidateRows === sumReasonMap(indirectReasons) &&
      (value.indirectCandidateRows as number) >=
        (value.qualifiedIndirectEdges as number) +
          (value.ineligibleCandidateRows as number),
    "股票分片间接边 coverage 不守恒。",
  );
  return value as unknown as PortfolioShardCoverage;
}

function validateProfile(
  value: unknown,
  familyKey: string,
  manifest: PortfolioManifest,
): FundFamilyProfile {
  assertCondition(
    isNonEmptyString(familyKey) &&
      isObject(value) &&
      value.fundFamilyKey === familyKey,
    `基金家族 ${familyKey || "(空)"} profile 与键不一致。`,
  );
  for (const field of ["fundCode", "fundName", "fundDisplayName", "fundType", "detailShardKey"] as const) {
    assertCondition(isNonEmptyString(value[field]), `基金家族 ${familyKey} profile.${field} 缺失。`);
  }
  assertCondition(
    Array.isArray(value.fundVariantCodes) &&
      value.fundVariantCodes.length > 0 &&
      value.fundVariantCodes.every(isNonEmptyString) &&
      new Set(value.fundVariantCodes).size === value.fundVariantCodes.length,
    `基金家族 ${familyKey} 份额代码无效。`,
  );
  assertCondition(typeof value.isQdii === "boolean", `基金家族 ${familyKey} QDII 分类无效。`);
  assertCondition(typeof value.isOnExchangeFund === "boolean", `基金家族 ${familyKey} 场内分类无效。`);
  assertCondition(value.view === (value.isOnExchangeFund ? "onExchange" : "offExchange"), `基金家族 ${familyKey} 视图分类冲突。`);
  assertCondition(
    typeof value.detailShardKey === "string" &&
      DETAIL_PREFIX_PATTERN.test(value.detailShardKey) &&
      hasOwn(manifest.fundDetailShards, value.detailShardKey),
    `基金家族 ${familyKey} 详情分片映射无效。`,
  );
  return value as unknown as FundFamilyProfile;
}

export async function validatePortfolioShard(
  value: unknown,
  context: StockShardContext,
): Promise<PortfolioShard> {
  assertCondition(isObject(value), `股票分片 ${context.stockCode} 不是对象。`);
  assertCondition(releaseMetadataMatches(value, context.manifest), `股票分片 ${context.stockCode} 发布元数据不一致。`);
  validateIntegrity(value.integrity, `股票分片 ${context.stockCode} `);
  assertCondition(
    isObject(value.stock) &&
      value.stock.code === context.stockCode &&
      isNonEmptyString(value.stock.name),
    `股票分片 ${context.stockCode} 股票代码或名称不一致。`,
  );
  assertCondition(isObject(value.fundProfiles), `股票分片 ${context.stockCode} fundProfiles 无效。`);
  const profiles = Object.create(null) as Record<string, FundFamilyProfile>;
  for (const [familyKey, profileValue] of Object.entries(value.fundProfiles)) {
    const profile = validateProfile(profileValue, familyKey, context.manifest);
    assertCondition(profile.detailShardKey === await familyPrefix(familyKey), `基金家族 ${familyKey} detailShardKey 与 SHA-256 前缀不一致。`);
    profiles[familyKey] = profile;
  }
  assertCondition(Array.isArray(value.directEdges) && Array.isArray(value.indirectEdges), `股票分片 ${context.stockCode} 边数组无效。`);
  const directKeys = new Set<string>();
  for (const edgeValue of value.directEdges) {
    assertCondition(isObject(edgeValue), `股票分片 ${context.stockCode} 存在无效直接边。`);
    const familyKey = edgeValue.fundFamilyKey;
    const profile = isNonEmptyString(familyKey) && hasOwn(profiles, familyKey)
      ? profiles[familyKey]
      : undefined;
    assertCondition(
      profile !== undefined &&
        profile.fundFamilyKey === familyKey &&
        edgeValue.targetCode === context.stockCode &&
        edgeValue.targetName === value.stock.name &&
        isPositiveFinite(edgeValue.ratioPercent) &&
        typeof edgeValue.isOnExchangeFund === "boolean" &&
        edgeValue.isOnExchangeFund === profile.isOnExchangeFund,
      `股票分片 ${context.stockCode} 存在无效直接边。`,
    );
    const key = `${familyKey}\u0000${edgeValue.targetCode}`;
    assertCondition(!directKeys.has(key), `股票分片 ${context.stockCode} 存在重复直接边。`);
    directKeys.add(key);
  }
  const indirectKeys = new Set<string>();
  for (const edgeValue of value.indirectEdges) {
    assertCondition(isObject(edgeValue), `股票分片 ${context.stockCode} 存在无效间接边。`);
    const familyKey = edgeValue.fundFamilyKey;
    const profile = isNonEmptyString(familyKey) && hasOwn(profiles, familyKey)
      ? profiles[familyKey]
      : undefined;
    assertCondition(
      profile !== undefined &&
        profile.fundFamilyKey === familyKey &&
        edgeValue.targetCode === context.stockCode &&
        edgeValue.targetName === value.stock.name &&
        isNonEmptyString(edgeValue.sourceCode) &&
        isNonEmptyString(edgeValue.sourceName) &&
        isNonEmptyString(edgeValue.matchReason) &&
        isPositiveFinite(edgeValue.sourceRatioPercent) &&
        isPositiveFinite(edgeValue.leverageMultiple) &&
        isPositiveFinite(edgeValue.estimatedRatioPercent) &&
        typeof edgeValue.isOnExchangeFund === "boolean" &&
        edgeValue.isOnExchangeFund === profile.isOnExchangeFund,
      `股票分片 ${context.stockCode} 存在无效间接边。`,
    );
    assertCondition(
      Math.abs(
        (edgeValue.sourceRatioPercent as number) *
          (edgeValue.leverageMultiple as number) -
          (edgeValue.estimatedRatioPercent as number),
      ) <= FORMULA_TOLERANCE,
      `股票分片 ${context.stockCode} 间接估算公式不一致。`,
    );
    const key = `${familyKey}\u0000${edgeValue.targetCode}\u0000${edgeValue.sourceCode}`;
    assertCondition(!indirectKeys.has(key), `股票分片 ${context.stockCode} 存在重复间接边。`);
    indirectKeys.add(key);
  }
  assertCondition(
    value.directEdges.length === context.metadata.directEdgeCount &&
      value.indirectEdges.length === context.metadata.qualifiedIndirectEdgeCount,
    `股票分片 ${context.stockCode} 边数与 manifest 不一致。`,
  );
  const coverage = validateShardCoverage(value.coverage, value);
  return {
    ...(value as unknown as PortfolioShard),
    fundProfiles: profiles,
    coverage,
  };
}

function validateHolding(value: unknown): value is PortfolioFundHoldingDetail {
  if (
    !isObject(value) ||
    !Number.isInteger(value.rank) ||
    (value.rank as number) < 1 ||
    !isNonEmptyString(value.stockCode) ||
    !isNonEmptyString(value.stockName) ||
    !isNonNegativeFinite(value.ratioPercent)
  ) {
    return false;
  }
  return (
    (value.ratio === undefined || isNonNegativeFinite(value.ratio)) &&
    (value.marketValueWan === undefined ||
      value.marketValueWan === null ||
      isNonNegativeFinite(value.marketValueWan)) &&
    (value.sharesWan === undefined || isNonNegativeFinite(value.sharesWan))
  );
}

function validateDetailRecord(value: unknown, familyKey: string): PortfolioDetailRecord {
  assertCondition(isObject(value) && value.fundFamilyKey === familyKey, `基金详情 ${familyKey} 与键不一致。`);
  if (value.detailStatus === "available") {
    assertCondition(
      isNonEmptyString(value.detailFundCode) &&
        value.detailMessage === undefined &&
        Array.isArray(value.holdings) &&
        value.holdings.length >= 1 &&
        value.holdings.length <= 10 &&
        value.holdings.every(validateHolding),
      `基金详情 ${familyKey} 的 available 数据无效。`,
    );
    return value as unknown as PortfolioDetailRecord;
  }
  assertCondition(
    value.detailStatus === "not_captured_in_current_stock_detail_rows" &&
      isNonEmptyString(value.detailMessage) &&
      value.detailFundCode === undefined &&
      value.holdings === undefined,
    `基金详情 ${familyKey} 的未采集状态无效。`,
  );
  return value as unknown as PortfolioDetailRecord;
}

export async function validatePortfolioDetailShard(
  value: unknown,
  context: DetailShardContext,
): Promise<PortfolioDetailShard> {
  assertCondition(isObject(value), `基金详情分片 ${context.prefix} 不是对象。`);
  assertCondition(
    releaseMetadataMatches(value, context.manifest) &&
      value.fundFamilyKeyHashPrefix === context.prefix,
    `基金详情分片 ${context.prefix} 发布元数据不一致。`,
  );
  validateIntegrity(value.integrity, `基金详情分片 ${context.prefix} `);
  assertCondition(isObject(value.fundDetails), `基金详情分片 ${context.prefix} 内容无效。`);
  const entries = Object.entries(value.fundDetails);
  assertCondition(entries.length === context.metadata.fundFamilyCount, `基金详情分片 ${context.prefix} 家族数与 manifest 不一致。`);
  const fundDetails = Object.create(null) as Record<string, PortfolioDetailRecord>;
  for (const [familyKey, recordValue] of entries) {
    assertCondition(isNonEmptyString(familyKey), "基金详情存在空家族键。");
    assertCondition(await familyPrefix(familyKey) === context.prefix, `基金详情 ${familyKey} hash-prefix 不一致。`);
    fundDetails[familyKey] = validateDetailRecord(recordValue, familyKey);
  }
  return {
    ...(value as unknown as PortfolioDetailShard),
    fundDetails,
  };
}

function comparableProfile(profile: FundFamilyProfile): string {
  return JSON.stringify({
    fundFamilyKey: profile.fundFamilyKey,
    fundCode: profile.fundCode,
    fundName: profile.fundName,
    fundDisplayName: profile.fundDisplayName,
    fundType: profile.fundType,
    fundVariantCodes: profile.fundVariantCodes,
    isQdii: profile.isQdii,
    isOnExchangeFund: profile.isOnExchangeFund,
    view: profile.view,
    detailShardKey: profile.detailShardKey,
  });
}

function validateCrossShardProfiles(shards: PortfolioShard[]) {
  const profiles = new Map<string, string>();
  for (const shard of shards) {
    for (const [familyKey, profile] of Object.entries(shard.fundProfiles)) {
      const comparable = comparableProfile(profile);
      const existing = profiles.get(familyKey);
      assertCondition(
        existing === undefined || existing === comparable,
        `基金家族 ${familyKey} 跨股票分片 profile 或分类不一致。`,
      );
      profiles.set(familyKey, comparable);
    }
  }
}

async function readStockShard(input: {
  context: ManifestContext;
  manifest: PortfolioManifest;
  stockCode: string;
  signal: AbortSignal;
  fetchImpl: typeof fetch;
}): Promise<PendingStockShard> {
  const metadata = input.manifest.shards[input.stockCode];
  const assetUrl = resolveDeclaredAssetUrl(input.context, metadata.path);
  const cacheKey = `${input.context.dataBaseUrl.href}\u0000${input.manifest.releaseId}\u0000${metadata.sha256}\u0000stock:${input.stockCode}`;
  throwIfAborted(input.signal);
  const cached = stockShardCache.get(cacheKey);
  if (cached !== undefined) {
    throwIfAborted(input.signal);
    return { cacheKey, shard: cached, fromCache: true };
  }
  const bytes = await fetchBytes(assetUrl, input.signal, input.fetchImpl, `组合数据分片 ${input.stockCode}`);
  const actualHash = await sha256Hex(bytes);
  throwIfAborted(input.signal);
  assertCondition(actualHash === metadata.sha256, `组合数据分片 ${input.stockCode} SHA-256 校验失败。`);
  const parsed = parseJsonBytes(bytes, `组合数据分片 ${input.stockCode}`);
  throwIfAborted(input.signal);
  const shard = await validatePortfolioShard(parsed, {
    manifest: input.manifest,
    stockCode: input.stockCode,
    metadata,
  });
  throwIfAborted(input.signal);
  return { cacheKey, shard, fromCache: false };
}

export async function loadPortfolioIndex(input: {
  manifestUrl: string;
  selectedStockCodes: string[];
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<LoadedPortfolioIndex> {
  const selectedStockCodes = [...new Set(input.selectedStockCodes)];
  assertCondition(selectedStockCodes.length >= 1, "请至少选择 1 只股票后再计算组合。");
  assertCondition(selectedStockCodes.length <= 10, "每个组合最多选择 10 只股票。");
  selectedStockCodes.forEach(assertSafeStockCode);
  const context = resolveManifestContext(input.manifestUrl);
  const fetchImpl = input.fetchImpl ?? fetch;
  const manifestBytes = await fetchBytes(context.fetchUrl, input.signal, fetchImpl, "组合 manifest");
  const manifestValue = parseJsonBytes(manifestBytes, "组合 manifest");
  throwIfAborted(input.signal);
  const manifest = validatePortfolioManifest(manifestValue, { manifestUrl: input.manifestUrl });
  throwIfAborted(input.signal);
  for (const stockCode of selectedStockCodes) {
    assertCondition(hasOwn(manifest.shards, stockCode), `组合索引尚未发布股票 ${stockCode}。`);
  }

  let pending: PendingStockShard[];
  try {
    pending = await Promise.all(
      selectedStockCodes.map((stockCode) =>
        readStockShard({
          context,
          manifest,
          stockCode,
          signal: input.signal,
          fetchImpl,
        }).catch((error: unknown) => {
          if (isAbortError(error)) throw error;
          throw new Error(`组合数据分片 ${stockCode} 暂时不可用：${errorMessage(error)}`);
        }),
      ),
    );
  } catch (error) {
    throw error;
  }
  throwIfAborted(input.signal);
  const shards = pending.map((item) => item.shard);
  validateCrossShardProfiles(shards);
  throwIfAborted(input.signal);
  for (const item of pending) {
    if (!item.fromCache) stockShardCache.set(item.cacheKey, item.shard);
  }
  throwIfAborted(input.signal);
  return { manifestUrl: input.manifestUrl, manifest, shards };
}

export async function loadPortfolioFundDetails(input: {
  manifestUrl: string;
  manifest: PortfolioManifest;
  fundFamilyKey: string;
  signal: AbortSignal;
  fetchImpl?: typeof fetch;
}): Promise<PortfolioDetailRecord> {
  try {
    assertCondition(isNonEmptyString(input.fundFamilyKey), "基金家族键缺失。");
    const context = resolveManifestContext(input.manifestUrl);
    const verifiedManifest = validatePortfolioManifest(input.manifest, {
      manifestUrl: input.manifestUrl,
    });
    throwIfAborted(input.signal);
    const prefix = await familyPrefix(input.fundFamilyKey);
    throwIfAborted(input.signal);
    const metadata = hasOwn(verifiedManifest.fundDetailShards, prefix)
      ? verifiedManifest.fundDetailShards[prefix]
      : undefined;
    assertCondition(metadata !== undefined, `基金家族 ${input.fundFamilyKey} 没有声明详情分片。`);
    const assetUrl = resolveDeclaredAssetUrl(context, metadata.path);
    const cacheKey = `${context.dataBaseUrl.href}\u0000${verifiedManifest.releaseId}\u0000${metadata.sha256}\u0000detail:${prefix}`;
    let detailShard = detailShardCache.get(cacheKey);
    let shouldCache = false;
    if (detailShard === undefined) {
      const bytes = await fetchBytes(
        assetUrl,
        input.signal,
        input.fetchImpl ?? fetch,
        `基金详情分片 ${prefix}`,
      );
      const actualHash = await sha256Hex(bytes);
      throwIfAborted(input.signal);
      assertCondition(actualHash === metadata.sha256, `基金详情分片 ${prefix} SHA-256 校验失败。`);
      const parsed = parseJsonBytes(bytes, `基金详情分片 ${prefix}`);
      throwIfAborted(input.signal);
      detailShard = await validatePortfolioDetailShard(parsed, {
        manifest: verifiedManifest,
        prefix,
        metadata,
      });
      throwIfAborted(input.signal);
      shouldCache = true;
    }
    throwIfAborted(input.signal);
    const record = hasOwn(detailShard.fundDetails, input.fundFamilyKey)
      ? detailShard.fundDetails[input.fundFamilyKey]
      : undefined;
    assertCondition(record !== undefined, `详情分片未包含基金家族 ${input.fundFamilyKey}。`);
    throwIfAborted(input.signal);
    if (shouldCache) detailShardCache.set(cacheKey, detailShard);
    throwIfAborted(input.signal);
    return record;
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new Error(`详情暂时不可用：${errorMessage(error)}`);
  }
}
