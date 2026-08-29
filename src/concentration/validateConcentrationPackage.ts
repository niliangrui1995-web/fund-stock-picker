import type {
  ConcentrationDashboardPayload,
  ConcentrationManifest,
  ConcentrationRecord,
  ConcentrationValidationResult,
  DenominatorSource,
  NumeratorScope,
} from "./types";

const SHA256_RE = /^[a-f0-9]{64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DENOMINATOR_SWITCH_DATE = "2016-01-26";
const BEIJING_UNIVERSE_SWITCH_DATE = "2022-08-02";

type JsonObject = Record<string, unknown>;

function failure(reason: string): ConcentrationValidationResult {
  return { ok: false, reason };
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
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

function isDenominatorSource(value: unknown): value is DenominatorSource {
  return value === "sh000002_plus_sz399107" || value === "sh880005";
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
  const expectedDenominator =
    value.date < DENOMINATOR_SWITCH_DATE ? "sh000002_plus_sz399107" : "sh880005";
  if (value.denominator_source !== expectedDenominator) {
    return `records[${index}] 的分母切换日期不一致。`;
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
  return value as unknown as ConcentrationDashboardPayload;
}

function parseManifest(value: unknown, records: ConcentrationRecord[]): ConcentrationManifest | string {
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
  if (
    !isObject(value.comparison_index_input) ||
    value.comparison_index_input.code !== "399006" ||
    value.comparison_index_input.name !== "创业板指" ||
    value.comparison_index_input.field !== "chinext_close" ||
    value.comparison_index_input.value !== "收盘价" ||
    value.comparison_index_input.price_scale !== "close / 100" ||
    value.comparison_index_input.source !== "通达信本地盘后 .day 日线" ||
    !isObject(value.comparison_index_input.data_range) ||
    !isValidDate(value.comparison_index_input.data_range.start) ||
    !isValidDate(value.comparison_index_input.data_range.end) ||
    value.comparison_index_input.data_range.start > value.comparison_index_input.data_range.end ||
    !isNonNegativeInteger(value.comparison_index_input.missing_output_records)
  ) {
    return "发布清单创业板指输入说明无效。";
  }
  const missingComparisonIndexRecords = records.filter((record) => record.chinext_close === null).length;
  if (value.comparison_index_input.missing_output_records !== missingComparisonIndexRecords) {
    return "发布清单创业板指缺口统计不一致。";
  }
  if (typeof value.scope_warning !== "string" || !value.scope_warning.trim()) {
    return "发布清单缺少口径提示。";
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
  const manifest = parseManifest(manifestValue, payload.records);
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
