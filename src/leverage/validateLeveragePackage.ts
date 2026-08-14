import type {
  LeverageDashboardPayload,
  LeverageIndexCode,
  LeverageManifest,
  MarketCapReviewStatus,
  MarketCapSource,
  ValidationResult,
} from "./types";

const SOURCE_SWITCH_DATE = "2017-01-03";
const DFCF_SAMPLE_STATUS = "dfcf_vendor_only_unverified_by_exchange";
const VENDOR_SOURCE = "eastmoney_post2017_vendor_unverified";
const VENDOR_REVIEW_STATUS = "eastmoney_vendor_unverified";
const PRE_2017_SOURCE = "pre2017_official_pending";
const UNAVAILABLE_REVIEW_STATUS = "unavailable";
const MIXED_RATIO_REVIEW_STATUS =
  "mixed_pre2017_pending_eastmoney_vendor_unverified";
const INDEX_CODES: LeverageIndexCode[] = ["000001", "399106", "399006"];
const DFCF_INPUT_FILENAMES = [
  "dfcf_sse_margin.csv",
  "dfcf_szse_margin.csv",
  "dfcf_margin_balances.csv",
] as const;
const SHA256_RE = /^[a-f0-9]{64}$/;
const SUM_TOLERANCE = 1e-6;

type JsonObject = Record<string, unknown>;

interface DateRange {
  start: string;
  end: string;
}

type ParsedRatioDataRange =
  | { kind: "dates"; range: DateRange }
  | { kind: "empty-object" }
  | { kind: "overall-null" };

interface CheckedRecord {
  date: string;
  denominatorMarketCap: number | null;
  source: MarketCapSource;
  reviewStatus: MarketCapReviewStatus;
  ratio: number | null;
}

function failure(reason: string): ValidationResult {
  return { ok: false, reason };
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isFiniteNumberOrNull(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
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

function parseDateRange(value: unknown): DateRange | null {
  if (!isObject(value) || !isValidDate(value.start) || !isValidDate(value.end)) {
    return null;
  }

  if (value.start > value.end) {
    return null;
  }

  return { start: value.start, end: value.end };
}

function parseRatioDataRange(value: unknown): ParsedRatioDataRange | null {
  if (value === null) {
    return { kind: "overall-null" };
  }

  if (!isObject(value)) {
    return null;
  }

  if (value.start === null && value.end === null) {
    return { kind: "empty-object" };
  }

  const range = parseDateRange(value);
  return range === null ? null : { kind: "dates", range };
}

function ratioRangesMatch(
  left: ParsedRatioDataRange,
  right: ParsedRatioDataRange,
): boolean {
  if (left.kind !== right.kind) {
    return false;
  }

  return (
    left.kind !== "dates" ||
    (right.kind === "dates" &&
      left.range.start === right.range.start &&
      left.range.end === right.range.end)
  );
}

function hasConsistentTotal(shMargin: number, szMargin: number, totalMargin: number): boolean {
  const expected = shMargin + szMargin;
  const scale = Math.max(1, Math.abs(expected), Math.abs(totalMargin));
  return Math.abs(expected - totalMargin) <= scale * SUM_TOLERANCE;
}

function isKnownSource(value: unknown): value is MarketCapSource {
  return value === null || value === PRE_2017_SOURCE || value === VENDOR_SOURCE;
}

function isKnownReviewStatus(value: unknown): value is MarketCapReviewStatus {
  return (
    value === null ||
    value === UNAVAILABLE_REVIEW_STATUS ||
    value === VENDOR_REVIEW_STATUS
  );
}

function isVendorWarning(value: unknown): boolean {
  return (
    isNonEmptyString(value) &&
    value.includes("未经交易所复核") &&
    value.includes("未经完整审计") &&
    value.includes("非 A 股")
  );
}

async function calculateSha256(text: string): Promise<string | null> {
  if (!globalThis.crypto?.subtle) {
    return null;
  }

  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function validateIndices(value: unknown): boolean {
  if (!isObject(value)) {
    return false;
  }

  return INDEX_CODES.every((code) => {
    const entry = value[code];
    if (!isObject(entry)) {
      return false;
    }

    return (
      isNonEmptyString(entry.source) &&
      isValidDate(entry.first_date) &&
      isValidDate(entry.last_date) &&
      entry.first_date <= entry.last_date &&
      typeof entry.sha256 === "string" &&
      SHA256_RE.test(entry.sha256)
    );
  });
}

function validateDfcf(value: unknown): boolean {
  if (!isObject(value)) {
    return false;
  }

  const inputs = value.inputs;
  if (value.dfcf_only !== true || value.exchange_requests !== 0) {
    return false;
  }

  if (value.sample_status !== DFCF_SAMPLE_STATUS || !isObject(inputs)) {
    return false;
  }

  return DFCF_INPUT_FILENAMES.every((filename) => {
    const input = inputs[filename];
    return typeof input === "string" && SHA256_RE.test(input);
  });
}

function validateRecordBasics(records: unknown[]): CheckedRecord[] | ValidationResult {
  let previousDate: string | null = null;
  const checked: CheckedRecord[] = [];

  for (const recordValue of records) {
    if (!isObject(recordValue) || !isValidDate(recordValue.date)) {
      return failure("发布包记录日期无效。");
    }

    if (previousDate !== null && recordValue.date <= previousDate) {
      return failure("发布包记录日期必须严格递增且唯一。");
    }
    previousDate = recordValue.date;

    if (
      !isFiniteNumber(recordValue.sh_margin_yi) ||
      !isFiniteNumber(recordValue.sz_margin_yi) ||
      !isFiniteNumber(recordValue.total_margin_yi) ||
      recordValue.sh_margin_yi < 0 ||
      recordValue.sz_margin_yi < 0 ||
      recordValue.total_margin_yi < 0
    ) {
      return failure("融资余额字段无效。");
    }

    if (
      !hasConsistentTotal(
        recordValue.sh_margin_yi,
        recordValue.sz_margin_yi,
        recordValue.total_margin_yi,
      )
    ) {
      return failure("两市融资余额合计不一致。");
    }

    if (
      !isFiniteNumberOrNull(recordValue.denominator_market_cap_yi) ||
      !isFiniteNumberOrNull(recordValue.ratio_pct) ||
      !isFiniteNumberOrNull(recordValue.index_000001_close) ||
      !isFiniteNumberOrNull(recordValue.index_399106_close) ||
      !isFiniteNumberOrNull(recordValue.index_399006_close)
    ) {
      return failure("市值或指数数值字段无效。");
    }

    if (
      !isKnownSource(recordValue.market_cap_source) ||
      !isKnownReviewStatus(recordValue.market_cap_review_status)
    ) {
      return failure("比例数据来源或审查状态无效。");
    }

    const source = recordValue.market_cap_source;
    const reviewStatus = recordValue.market_cap_review_status;
    const denominatorMarketCap = recordValue.denominator_market_cap_yi;
    const ratio = recordValue.ratio_pct;

    if (recordValue.date < SOURCE_SWITCH_DATE) {
      if (
        denominatorMarketCap !== null ||
        ratio !== null ||
        source !== PRE_2017_SOURCE ||
        reviewStatus !== UNAVAILABLE_REVIEW_STATUS
      ) {
        return failure("2017-01-03 前不得使用东方财富市值或比例。");
      }
    } else if (
      source !== VENDOR_SOURCE ||
      (reviewStatus !== VENDOR_REVIEW_STATUS &&
        reviewStatus !== UNAVAILABLE_REVIEW_STATUS) ||
      (ratio === null &&
        (denominatorMarketCap !== null || reviewStatus !== UNAVAILABLE_REVIEW_STATUS))
    ) {
      return failure("比例数据来源或审查状态无效。");
    }

    checked.push({
      date: recordValue.date,
      denominatorMarketCap,
      source,
      reviewStatus,
      ratio,
    });
  }

  return checked;
}

function isValidationFailure(value: CheckedRecord[] | ValidationResult): value is ValidationResult {
  return !Array.isArray(value);
}

function validateRatioMetadata(
  payloadProvenance: JsonObject,
  marketCap: JsonObject,
):
  | { ratioAvailable: boolean; ratioRange: DateRange | null }
  | ValidationResult {
  if (payloadProvenance.source_switch_date !== SOURCE_SWITCH_DATE) {
    return failure("市值来源切换日期无效。");
  }

  if (!isVendorWarning(payloadProvenance.ratio_scope_warning)) {
    return failure("比例未审计口径提示无效。");
  }

  if (typeof payloadProvenance.ratio_available !== "boolean") {
    return failure("比例可用标记无效。");
  }

  if (marketCap.source_switch_date !== SOURCE_SWITCH_DATE) {
    return failure("市值来源切换日期无效。");
  }

  if (marketCap.reporting_eligible !== false) {
    return failure("市值审计标记无效。");
  }

  if (
    typeof marketCap.ratio_available !== "boolean" ||
    marketCap.ratio_available !== payloadProvenance.ratio_available ||
    !isNonEmptyString(marketCap.scope_definition) ||
    !Array.isArray(marketCap.source_segments) ||
    marketCap.source_segments.length === 0
  ) {
    return failure("市值发布元数据无效。");
  }

  if (
    !isFiniteNumber(marketCap.ratio_missing_records) ||
    !Number.isInteger(marketCap.ratio_missing_records) ||
    marketCap.ratio_missing_records < 0 ||
    (marketCap.reason !== null && !isNonEmptyString(marketCap.reason))
  ) {
    return failure("市值发布元数据无效。");
  }

  const ratioAvailable = payloadProvenance.ratio_available;
  const payloadRange = parseRatioDataRange(payloadProvenance.ratio_data_range);
  const manifestRange = parseRatioDataRange(marketCap.ratio_data_range);

  if (
    payloadRange === null ||
    manifestRange === null ||
    !ratioRangesMatch(payloadRange, manifestRange)
  ) {
    return failure("比例数据范围与发布清单不一致。");
  }

  if (ratioAvailable) {
    if (
      payloadProvenance.ratio_unavailable_reason !== null ||
      payloadRange.kind !== "dates" ||
      payloadRange.range.start < SOURCE_SWITCH_DATE ||
      marketCap.ratio_review_status !== MIXED_RATIO_REVIEW_STATUS
    ) {
      return failure("市值审查状态无效。");
    }
  } else if (
    !isNonEmptyString(payloadProvenance.ratio_unavailable_reason) ||
    payloadRange.kind === "dates" ||
    marketCap.ratio_review_status !== MIXED_RATIO_REVIEW_STATUS ||
    !isNonEmptyString(marketCap.reason)
  ) {
    return failure("市值审查状态无效。");
  }

  return {
    ratioAvailable,
    ratioRange: payloadRange.kind === "dates" ? payloadRange.range : null,
  };
}

function isRatioMetadataFailure(
  value:
    | { ratioAvailable: boolean; ratioRange: DateRange | null }
    | ValidationResult,
): value is ValidationResult {
  return "ok" in value;
}

export async function validateLeveragePackage(
  payloadText: string,
  manifestText: string,
): Promise<ValidationResult> {
  let payloadValue: unknown;
  let manifestValue: unknown;

  try {
    payloadValue = JSON.parse(payloadText);
  } catch {
    return failure("发布包 JSON 解析失败。");
  }

  try {
    manifestValue = JSON.parse(manifestText);
  } catch {
    return failure("发布清单 JSON 解析失败。");
  }

  if (!isObject(payloadValue) || payloadValue.schema_version !== "1") {
    return failure("发布包 schema_version 无效。");
  }
  if (!isObject(manifestValue) || manifestValue.schema_version !== "1") {
    return failure("发布清单 schema_version 无效。");
  }

  const payloadHash = await calculateSha256(payloadText);
  if (payloadHash === null) {
    return failure("浏览器不支持 SHA-256 校验。");
  }
  if (manifestValue.payload_sha256 !== payloadHash) {
    return failure("发布包 SHA-256 校验失败。");
  }

  if (!isNonEmptyString(payloadValue.generated_at_beijing)) {
    return failure("发布包生成时间无效。");
  }
  if (!Array.isArray(payloadValue.records) || payloadValue.records.length === 0) {
    return failure("发布包记录为空。");
  }
  if (!isObject(payloadValue.provenance)) {
    return failure("发布包比例元数据无效。");
  }

  const checkedRecords = validateRecordBasics(payloadValue.records);
  if (isValidationFailure(checkedRecords)) {
    return checkedRecords;
  }

  if (
    !Number.isInteger(manifestValue.payload_records) ||
    manifestValue.payload_records !== checkedRecords.length
  ) {
    return failure("发布清单记录数或数据范围无效。");
  }

  const dataRange = parseDateRange(manifestValue.data_range);
  if (
    dataRange === null ||
    dataRange.start !== checkedRecords[0].date ||
    dataRange.end !== checkedRecords[checkedRecords.length - 1]?.date
  ) {
    return failure("发布清单记录数或数据范围无效。");
  }

  if (!validateDfcf(manifestValue.dfcf)) {
    return failure("DFCF 审计标记无效。");
  }
  if (!isObject(manifestValue.market_cap)) {
    return failure("市值发布元数据无效。");
  }
  if (!validateIndices(manifestValue.indices)) {
    return failure("指数来源元数据无效。");
  }

  const ratioMetadata = validateRatioMetadata(
    payloadValue.provenance,
    manifestValue.market_cap,
  );
  if (isRatioMetadataFailure(ratioMetadata)) {
    return ratioMetadata;
  }

  const nonNullRatios = checkedRecords.filter(
    (record): record is CheckedRecord & { ratio: number } => record.ratio !== null,
  );
  if (!ratioMetadata.ratioAvailable && nonNullRatios.length > 0) {
    return failure("比例不可用时不得包含比例数值。");
  }
  if (ratioMetadata.ratioAvailable && nonNullRatios.length === 0) {
    return failure("比例可用但没有有效比例记录。");
  }

  for (const record of nonNullRatios) {
    if (
      ratioMetadata.ratioRange === null ||
      record.date < ratioMetadata.ratioRange.start ||
      record.date > ratioMetadata.ratioRange.end
    ) {
      return failure("比例日期不在声明的数据范围内。");
    }
    if (record.denominatorMarketCap === null || record.denominatorMarketCap <= 0) {
      return failure("比例分母无效。");
    }
    if (record.source !== VENDOR_SOURCE || record.reviewStatus !== VENDOR_REVIEW_STATUS) {
      return failure("比例数据来源或审查状态无效。");
    }
    if (record.ratio < 0) {
      return failure("比例数值无效。");
    }
  }

  const ratioMissingRecords = checkedRecords.length - nonNullRatios.length;
  if (manifestValue.market_cap.ratio_missing_records !== ratioMissingRecords) {
    return failure("比例缺失记录数无效。");
  }

  return {
    ok: true,
    payload: payloadValue as unknown as LeverageDashboardPayload,
    manifest: manifestValue as unknown as LeverageManifest,
  };
}
