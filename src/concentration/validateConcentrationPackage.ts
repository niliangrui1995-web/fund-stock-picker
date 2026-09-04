import type {
  AiChainManifestSeries,
  AiChainRecord,
  AiChainSeries,
  ConcentrationDashboardPayload,
  ConcentrationManifest,
  ConcentrationRecord,
  ConcentrationValidationResult,
  DenominatorSource,
  NumeratorScope,
} from "./types";

const SHA256_RE = /^[a-f0-9]{64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UTC_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/;
const BEIJING_UNIVERSE_SWITCH_DATE = "2022-08-02";

type JsonObject = Record<string, unknown>;

function failure(reason: string): ConcentrationValidationResult {
  return { ok: false, reason };
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: JsonObject, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function baseNameFromPath(value: string): string {
  const pathParts = value.replace(/\\/g, "/").split("/").filter(Boolean);
  return pathParts[pathParts.length - 1] ?? "";
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isCodeAliasList(value: unknown): boolean {
  return Array.isArray(value) && value.every(
    (item) => isObject(item)
      && typeof item.source_code === "string"
      && /^\d{6}$/.test(item.source_code)
      && typeof item.resolved_code === "string"
      && /^\d{6}$/.test(item.resolved_code)
      && isNonEmptyString(item.source),
  );
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidUtcTimestamp(value: unknown): value is string {
  return typeof value === "string"
    && UTC_TIMESTAMP_RE.test(value)
    && isValidDate(value.slice(0, 10))
    && Number.isFinite(Date.parse(value));
}

function isDenominatorSource(value: unknown): value is DenominatorSource {
  return value === "sh880008";
}

function isNumeratorScope(value: unknown): value is NumeratorScope {
  return value === "sh_sz_active_a" || value === "sh_sz_bj_active_a";
}

async function calculateSha256(text: string): Promise<string | null> {
  if (!globalThis.crypto?.subtle) {
    return null;
  }
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseRecord(value: unknown, index: number): ConcentrationRecord | string {
  if (!isObject(value)) {
    return `records[${index}] 不是对象。`;
  }
  if (!isValidDate(value.date)) {
    return `records[${index}].date 无效。`;
  }
  if (!("chinext_close" in value)) {
    return `records[${index}].chinext_close 缺失。`;
  }
  if (value.chinext_close !== null && (!isFiniteNumber(value.chinext_close) || value.chinext_close <= 0)) {
    return `records[${index}].chinext_close 无效。`;
  }
  if (
    !isFiniteNumber(value.c5_pct) ||
    !isFiniteNumber(value.top5_amount_yi) ||
    !isFiniteNumber(value.market_amount_yi) ||
    value.c5_pct < 0 ||
    value.top5_amount_yi < 0 ||
    value.market_amount_yi <= 0
  ) {
    return `records[${index}] 的 C5 或成交额无效。`;
  }
  if (!isPositiveInteger(value.active_stock_count) || !isPositiveInteger(value.top5_stock_count)) {
    return `records[${index}] 的股票数量无效。`;
  }
  if (value.top5_stock_count !== Math.ceil(value.active_stock_count * 0.05)) {
    return `records[${index}] 的前 5% 股票数量不一致。`;
  }
  if (!isDenominatorSource(value.denominator_source) || !isNumeratorScope(value.numerator_scope)) {
    return `records[${index}] 的分子或分母口径无效。`;
  }
  if (value.denominator_source !== "sh880008") {
    return `records[${index}] 的分母来源不一致。`;
  }
  const expectedScope = value.date < BEIJING_UNIVERSE_SWITCH_DATE ? "sh_sz_active_a" : "sh_sz_bj_active_a";
  if (value.numerator_scope !== expectedScope) {
    return `records[${index}] 的北交所纳入口径不一致。`;
  }
  const recomputedC5 = (value.top5_amount_yi / value.market_amount_yi) * 100;
  if (Math.abs(recomputedC5 - value.c5_pct) > 0.0002) {
    return `records[${index}] 的 C5 与成交额字段不一致。`;
  }
  return value as unknown as ConcentrationRecord;
}

function parseAiChainSeries(
  value: unknown,
  legacyRecords: ConcentrationRecord[],
): AiChainSeries | string {
  if (!isObject(value)) {
    return "AI 产业链子序列不是对象。";
  }
  if (
    value.name !== "AI产业链成交额占比" ||
    value.field !== "ai_chain_amount_pct" ||
    value.start_date !== "2025-01-01" ||
    !Array.isArray(value.records)
  ) {
    return "AI 产业链子序列名称、字段、起始日或记录结构无效。";
  }
  if (!isNonEmptyString(value.definition) || !isNonEmptyString(value.active_stock_rule)) {
    return "AI 产业链子序列缺少定义或活跃成分规则。";
  }
  if (
    !isObject(value.universe) ||
    !isNonEmptyString(value.universe.workbook) ||
    !isNonEmptyString(value.universe.sheet) ||
    !isNonEmptyString(value.universe.code_column) ||
    !isPositiveInteger(value.universe.code_count) ||
    typeof value.universe.codes_sha256 !== "string" ||
    !SHA256_RE.test(value.universe.codes_sha256)
  ) {
    return "AI 产业链子序列宇宙快照无效。";
  }

  const expectedRecords = legacyRecords.filter((record) => record.date >= "2025-01-01");
  if (value.records.length > 0 && value.records.length !== expectedRecords.length) {
    return "AI 产业链子序列未完整覆盖起始日后的分母交易日。";
  }

  const records: AiChainRecord[] = [];
  let missingOutputRecords = 0;
  for (const [index, item] of value.records.entries()) {
    const legacyRecord = expectedRecords[index];
    if (!legacyRecord || !isObject(item)) {
      return `AI 产业链 records[${index}] 无效。`;
    }
    if (!isValidDate(item.date) || item.date !== legacyRecord.date) {
      return `AI 产业链 records[${index}] 日期未与分母交易日对齐。`;
    }
    if (!isNonNegativeInteger(item.ai_chain_active_stock_count)) {
      return `AI 产业链 records[${index}] 活跃成分数量无效。`;
    }
    const amount = item.ai_chain_amount_yi;
    const percentage = item.ai_chain_amount_pct;
    if (amount === null || percentage === null) {
      if (amount !== null || percentage !== null || item.ai_chain_active_stock_count !== 0) {
        return `AI 产业链 records[${index}] 缺口字段不一致。`;
      }
      missingOutputRecords += 1;
    } else {
      if (
        !isFiniteNumber(amount) ||
        !isFiniteNumber(percentage) ||
        amount <= 0 ||
        percentage <= 0 ||
        percentage > 100 ||
        !isPositiveInteger(item.ai_chain_active_stock_count) ||
        item.ai_chain_active_stock_count > legacyRecord.active_stock_count ||
        item.ai_chain_active_stock_count > value.universe.code_count
      ) {
        return `AI 产业链 records[${index}] 成交额、占比或活跃成分数量无效。`;
      }
      const recomputedPercentage = (amount / legacyRecord.market_amount_yi) * 100;
      if (Math.abs(recomputedPercentage - percentage) > 0.0002) {
        return `AI 产业链 records[${index}] 未使用同日全A等权 AMOUNT 分母反算。`;
      }
    }
    records.push(item as unknown as AiChainRecord);
  }
  return value as unknown as AiChainSeries;
}

function parsePayload(value: unknown): ConcentrationDashboardPayload | string {
  if (!isObject(value) || value.schema_version !== "1" || !Array.isArray(value.records)) {
    return "发布包结构或 schema_version 无效。";
  }
  if (!isObject(value.provenance) || value.provenance.evidence_level !== "market_data_vendor") {
    return "发布包来源证据等级无效。";
  }
  if (
    !isObject(value.provenance.comparison_index) ||
    value.provenance.comparison_index.code !== "399006" ||
    value.provenance.comparison_index.field !== "chinext_close" ||
    value.provenance.comparison_index.value !== "收盘价"
  ) {
    return "发布包创业板指说明无效。";
  }
  if (value.provenance.raw_data_copied !== false) {
    return "发布包必须声明未复制原始日线。";
  }
  const records: ConcentrationRecord[] = [];
  let previousDate: string | null = null;
  for (const [index, item] of value.records.entries()) {
    const record = parseRecord(item, index);
    if (typeof record === "string") {
      return record;
    }
    if (previousDate !== null && record.date <= previousDate) {
      return "发布包日期必须严格递增。";
    }
    previousDate = record.date;
    records.push(record);
  }
  if (!records.length) {
    return "发布包没有可用日度记录。";
  }
  if (hasOwn(value, "ai_chain_series")) {
    const aiChainSeries = parseAiChainSeries(value.ai_chain_series, records);
    if (typeof aiChainSeries === "string") {
      return aiChainSeries;
    }
  }
  return value as unknown as ConcentrationDashboardPayload;
}

function parseAiChainManifest(
  value: unknown,
  aiChainSeries: AiChainSeries,
): AiChainManifestSeries | string {
  if (!isObject(value)) {
    return "AI 产业链发布清单子序列不是对象。";
  }
  const expectedStart = aiChainSeries.records[0]?.date ?? null;
  const expectedEnd = aiChainSeries.records[aiChainSeries.records.length - 1]?.date ?? null;
  if (
    value.name !== aiChainSeries.name ||
    value.field !== aiChainSeries.field ||
    value.start_date !== aiChainSeries.start_date ||
    !isObject(value.data_range) ||
    value.data_range.start !== expectedStart ||
    value.data_range.end !== expectedEnd ||
    !isNonNegativeInteger(value.records) ||
    value.records !== aiChainSeries.records.length ||
    !isNonNegativeInteger(value.missing_output_records) ||
    !isNonEmptyString(value.formula) ||
    !value.formula.includes("sh880008.day.amount") ||
    value.active_stock_rule !== aiChainSeries.active_stock_rule
  ) {
    return "AI 产业链发布清单子序列口径或记录数无效。";
  }
  const missingOutputRecords = aiChainSeries.records.filter(
    (record) => record.ai_chain_amount_pct === null,
  ).length;
  if (value.missing_output_records !== missingOutputRecords) {
    return "AI 产业链发布清单缺口统计不一致。";
  }
  if (
    !isObject(value.universe) ||
    !isNonEmptyString(value.universe.workbook_path) ||
    typeof value.universe.workbook_sha256 !== "string" ||
    !SHA256_RE.test(value.universe.workbook_sha256) ||
    value.universe.sheet !== aiChainSeries.universe.sheet ||
    value.universe.code_column !== aiChainSeries.universe.code_column ||
    !isPositiveInteger(value.universe.input_code_count) ||
    !isPositiveInteger(value.universe.resolved_code_count) ||
    value.universe.input_code_count !== value.universe.resolved_code_count ||
    typeof value.universe.resolved_code_sha256 !== "string" ||
    !SHA256_RE.test(value.universe.resolved_code_sha256) ||
    !isNonNegativeInteger(value.universe.non_stock_code_rows_excluded) ||
    !isCodeAliasList(value.universe.code_aliases) ||
    !isPositiveInteger(value.universe.tdx_candidate_file_count)
  ) {
    return "AI 产业链发布清单宇宙快照无效。";
  }
  if (
    aiChainSeries.universe.code_count !== value.universe.input_code_count ||
    aiChainSeries.universe.code_count !== value.universe.resolved_code_count ||
    aiChainSeries.universe.codes_sha256 !== value.universe.resolved_code_sha256 ||
    aiChainSeries.universe.code_count !== value.universe.tdx_candidate_file_count ||
    baseNameFromPath(aiChainSeries.universe.workbook) !== baseNameFromPath(value.universe.workbook_path)
  ) {
    return "AI 产业链 payload 与 manifest 宇宙快照不一致。";
  }
  return value as unknown as AiChainManifestSeries;
}

function parseManifest(value: unknown, payload: ConcentrationDashboardPayload): ConcentrationManifest | string {
  const records = payload.records;
  if (!isObject(value) || value.schema_version !== "1") {
    return "发布清单 schema_version 无效。";
  }
  if (value.evidence_level !== "market_data_vendor" || value.raw_data_copied !== false) {
    return "发布清单来源或原始数据边界无效。";
  }
  if (typeof value.payload_sha256 !== "string" || !SHA256_RE.test(value.payload_sha256)) {
    return "发布清单 payload SHA-256 无效。";
  }
  if (!isPositiveInteger(value.payload_records) || value.payload_records !== records.length) {
    return "发布清单记录数不一致。";
  }
  const lastRecord = records[records.length - 1];
  if (!isObject(value.data_range) || value.data_range.start !== records[0]?.date || value.data_range.end !== lastRecord?.date) {
    return "发布清单日期范围不一致。";
  }
  if (!Array.isArray(value.denominator_segments) || !Array.isArray(value.numerator_segments)) {
    return "发布清单分段信息无效。";
  }
  const [denominatorSegment] = value.denominator_segments;
  if (
    value.denominator_segments.length !== 1 ||
    !isObject(denominatorSegment) ||
    denominatorSegment.start !== "2013-01-01" ||
    denominatorSegment.end !== lastRecord?.date ||
    denominatorSegment.source !== "sh880008" ||
    denominatorSegment.formula !== "sh880008.day.amount"
  ) {
    return "发布清单分母口径不一致。";
  }
  const comparisonIndexInput = value.comparison_index_input;
  if (
    !isObject(comparisonIndexInput) ||
    comparisonIndexInput.code !== "399006" ||
    comparisonIndexInput.name !== "创业板指" ||
    comparisonIndexInput.field !== "chinext_close" ||
    comparisonIndexInput.value !== "收盘价" ||
    comparisonIndexInput.price_scale !== "close / 100" ||
    comparisonIndexInput.source !== "通达信本地盘后 .day 日线" ||
    !isNonEmptyString(comparisonIndexInput.path) ||
    !isPositiveInteger(comparisonIndexInput.bytes) ||
    typeof comparisonIndexInput.sha256 !== "string" ||
    !SHA256_RE.test(comparisonIndexInput.sha256) ||
    !isValidUtcTimestamp(comparisonIndexInput.last_write_time_utc) ||
    !isObject(comparisonIndexInput.data_range) ||
    !isValidDate(comparisonIndexInput.data_range.start) ||
    !isValidDate(comparisonIndexInput.data_range.end) ||
    comparisonIndexInput.data_range.start > comparisonIndexInput.data_range.end ||
    !isNonNegativeInteger(comparisonIndexInput.missing_output_records)
  ) {
    return "发布清单创业板指输入说明无效。";
  }
  const missingComparisonIndexRecords = records.filter((record) => record.chinext_close === null).length;
  if (comparisonIndexInput.missing_output_records !== missingComparisonIndexRecords) {
    return "发布清单创业板指缺口统计不一致。";
  }
  const outputChinextDates = records
    .filter((record) => record.chinext_close !== null)
    .map((record) => record.date);
  const lastOutputChinextDate = outputChinextDates[outputChinextDates.length - 1];
  if (
    outputChinextDates.length > 0
    && (comparisonIndexInput.data_range.start > outputChinextDates[0]
      || comparisonIndexInput.data_range.end < lastOutputChinextDate)
  ) {
    return "发布清单创业板指输入日期范围未覆盖 chinext_close 输出。";
  }
  if (typeof value.scope_warning !== "string" || !value.scope_warning.trim()) {
    return "发布清单缺少口径提示。";
  }
  const hasPayloadAiChainSeries = hasOwn(payload as unknown as JsonObject, "ai_chain_series");
  const hasManifestAiChainSeries = hasOwn(value, "ai_chain_series");
  if (hasPayloadAiChainSeries !== hasManifestAiChainSeries) {
    return "AI 产业链子序列必须同时存在于 payload 与 manifest。";
  }
  if (hasPayloadAiChainSeries) {
    const aiChainSeries = payload.ai_chain_series;
    if (aiChainSeries === undefined) {
      return "AI 产业链子序列无效。";
    }
    const aiChainManifest = parseAiChainManifest(value.ai_chain_series, aiChainSeries);
    if (typeof aiChainManifest === "string") {
      return aiChainManifest;
    }
  }
  return value as unknown as ConcentrationManifest;
}

export async function validateConcentrationPackage(
  payloadText: string,
  manifestText: string,
): Promise<ConcentrationValidationResult> {
  let payloadValue: unknown;
  let manifestValue: unknown;
  try {
    payloadValue = JSON.parse(payloadText);
    manifestValue = JSON.parse(manifestText);
  } catch {
    return failure("交易集中度静态数据包不是有效 JSON。");
  }

  const payload = parsePayload(payloadValue);
  if (typeof payload === "string") {
    return failure(payload);
  }
  const manifest = parseManifest(manifestValue, payload);
  if (typeof manifest === "string") {
    return failure(manifest);
  }
  const payloadHash = await calculateSha256(payloadText);
  if (payloadHash === null) {
    return failure("浏览器不支持 SHA-256 校验。");
  }
  if (manifest.payload_sha256 !== payloadHash) {
    return failure("交易集中度发布包 SHA-256 校验失败。");
  }
  return { ok: true, payload, manifest };
}
