import type {
  LeverageDashboardPayload,
  LeverageIndexCode,
  LeverageManifest,
  MarketCapReviewStatus,
  MarketCapSource,
  ValidationResult,
} from "./types";

const SOURCE_SWITCH_DATE = "2017-01-03";
const FIRST_MARGIN_DATE = "2011-08-03";
const PRE2017_LAST_DATE = "2016-12-30";
const DFCF_SAMPLE_STATUS = "dfcf_vendor_only_unverified_by_exchange";
const VENDOR_SOURCE = "eastmoney_post2017_vendor_unverified";
const VENDOR_REVIEW_STATUS = "eastmoney_vendor_unverified";
const OFFICIAL_PRE2017_SOURCE = "official_exchange_pre2017_raw_chain_audited";
const OFFICIAL_PRE2017_REVIEW_STATUS = "official_exchange_pre2017_raw_chain_audited";
const PRE2017_UNAVAILABLE_SOURCE = "pre2017_official_unavailable";
const LEGACY_PRE2017_SOURCE = "pre2017_official_pending";
const UNAVAILABLE_REVIEW_STATUS = "unavailable";
const LEGACY_MIXED_RATIO_REVIEW_STATUS =
  "mixed_pre2017_pending_eastmoney_vendor_unverified";
const AUDITED_MIXED_RATIO_REVIEW_STATUS =
  "mixed_official_pre2017_raw_chain_audited_eastmoney_vendor_unverified";
const OFFICIAL_UNAVAILABLE_MIXED_RATIO_REVIEW_STATUS =
  "mixed_official_pre2017_unavailable_eastmoney_vendor_unverified";
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
  totalMargin: number;
  denominatorMarketCap: number | null;
  source: MarketCapSource;
  reviewStatus: MarketCapReviewStatus;
  ratio: number | null;
}

type Pre2017Mode = "audited" | "unavailable";

interface RecordCoverage {
  firstDate: string;
  lastDate: string;
  pre2017LastDate: string;
  pre2017Mode: Pre2017Mode;
  pre2017Source: MarketCapSource;
  hasPost2017Ratio: boolean;
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

function hasConsistentRatio(
  totalMargin: number,
  denominatorMarketCap: number,
  ratio: number,
): boolean {
  const expected = (totalMargin / denominatorMarketCap) * 100;
  const scale = Math.max(1, Math.abs(expected), Math.abs(ratio));
  return Math.abs(expected - ratio) <= scale * SUM_TOLERANCE;
}

function isKnownSource(value: unknown): value is MarketCapSource {
  return (
    value === null ||
    value === OFFICIAL_PRE2017_SOURCE ||
    value === PRE2017_UNAVAILABLE_SOURCE ||
    value === LEGACY_PRE2017_SOURCE ||
    value === VENDOR_SOURCE
  );
}

function isKnownReviewStatus(value: unknown): value is MarketCapReviewStatus {
  return (
    value === null ||
    value === OFFICIAL_PRE2017_REVIEW_STATUS ||
    value === UNAVAILABLE_REVIEW_STATUS ||
    value === VENDOR_REVIEW_STATUS
  );
}

function isLegacyVendorWarning(value: unknown): boolean {
  return isNonEmptyString(value) &&
    value.includes("未经交易所复核") &&
    value.includes("未经完整审计") &&
    value.includes("非 A 股");
}

function hasAuditedPre2017Warning(value: unknown): boolean {
  return isNonEmptyString(value) &&
    value.includes("DFCF") &&
    value.includes("UNSUPPORTED_RATIO_CONTRACT") &&
    value.includes("严格证券类别匹配");
}

function hasRequiredScopeDefinition(value: unknown): boolean {
  return isNonEmptyString(value) &&
    value.includes("DFCF") &&
    value.includes("非 A 股") &&
    value.includes("东方财富") &&
    value.includes("未经交易所复核") &&
    value.includes("完整审计");
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
      if (source === VENDOR_SOURCE) {
        return failure("2017-01-03 前不得使用东方财富市值或比例。");
      }

      if (source === OFFICIAL_PRE2017_SOURCE) {
        if (
          denominatorMarketCap === null ||
          denominatorMarketCap <= 0 ||
          ratio === null ||
          ratio < 0 ||
          reviewStatus !== OFFICIAL_PRE2017_REVIEW_STATUS ||
          !hasConsistentRatio(recordValue.total_margin_yi, denominatorMarketCap, ratio)
        ) {
          return failure("2017-01-03 前官方市值或比例数据无效。");
        }
      } else if (
        (source !== LEGACY_PRE2017_SOURCE && source !== PRE2017_UNAVAILABLE_SOURCE) ||
        denominatorMarketCap !== null ||
        ratio !== null ||
        reviewStatus !== UNAVAILABLE_REVIEW_STATUS
      ) {
        return failure("2017-01-03 前市值或比例数据来源无效。");
      }
    } else {
      if (
        source !== VENDOR_SOURCE ||
        (reviewStatus !== VENDOR_REVIEW_STATUS &&
          reviewStatus !== UNAVAILABLE_REVIEW_STATUS) ||
        (ratio === null &&
          (denominatorMarketCap !== null || reviewStatus !== UNAVAILABLE_REVIEW_STATUS))
      ) {
        return failure("比例数据来源或审查状态无效。");
      }
    }

    checked.push({
      date: recordValue.date,
      totalMargin: recordValue.total_margin_yi,
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

function validateRecordCoverage(
  records: CheckedRecord[],
): RecordCoverage | ValidationResult {
  if (records[0]?.date !== FIRST_MARGIN_DATE) {
    return failure(`两融余额起点必须为 ${FIRST_MARGIN_DATE}。`);
  }

  let pre2017LastDate: string | null = null;
  let pre2017Mode: Pre2017Mode | null = null;
  let pre2017Source: MarketCapSource | null = null;
  let post2017FirstDate: string | null = null;
  let hasPre2017 = false;
  let hasPost2017 = false;
  let hasPost2017Ratio = false;

  for (const record of records) {
    if (record.date < SOURCE_SWITCH_DATE) {
      hasPre2017 = true;
      pre2017LastDate = record.date;
      const mode: Pre2017Mode =
        record.source === OFFICIAL_PRE2017_SOURCE ? "audited" : "unavailable";
      if (pre2017Mode !== null && pre2017Mode !== mode) {
        return failure("2017-01-03 前市值来源分段不得混用。");
      }
      if (pre2017Source !== null && pre2017Source !== record.source) {
        return failure("2017-01-03 前市值来源分段不得混用。");
      }
      pre2017Mode = mode;
      pre2017Source = record.source;
      continue;
    }

    hasPost2017 = true;
    post2017FirstDate ??= record.date;
    hasPost2017Ratio ||= record.ratio !== null;
  }

  if (
    !hasPre2017 ||
    !hasPost2017 ||
    pre2017LastDate !== PRE2017_LAST_DATE ||
    post2017FirstDate !== SOURCE_SWITCH_DATE ||
    pre2017Mode === null ||
    pre2017Source === null
  ) {
    return failure("市值来源前后分段不完整。");
  }

  return {
    firstDate: records[0].date,
    lastDate: records[records.length - 1]?.date ?? FIRST_MARGIN_DATE,
    pre2017LastDate,
    pre2017Mode,
    pre2017Source,
    hasPost2017Ratio,
  };
}

function isRecordCoverageFailure(
  value: RecordCoverage | ValidationResult,
): value is ValidationResult {
  return "ok" in value;
}

function usesOfficialPre2017Schema(
  coverage: RecordCoverage,
  payloadProvenance: JsonObject,
  marketCap: JsonObject,
): boolean {
  return coverage.pre2017Mode === "audited" ||
    coverage.pre2017Source === PRE2017_UNAVAILABLE_SOURCE ||
    "official_pre2017_chain_status" in payloadProvenance ||
    "official_pre2017" in marketCap;
}

function validateOfficialPre2017Metadata(
  payloadProvenance: JsonObject,
  marketCap: JsonObject,
  hasAuditedPre2017: boolean,
  usesOfficialSchema: boolean,
): boolean {
  if (!usesOfficialSchema) {
    return true;
  }

  const metadata = marketCap.official_pre2017;
  if (!isObject(metadata)) {
    return false;
  }
  const audit = metadata.financial_evidence_audit;
  if (
    !isObject(audit) ||
    audit.applicable !== false ||
    audit.status !== "N/A" ||
    audit.reason_code !== "UNSUPPORTED_RATIO_CONTRACT"
  ) {
    return false;
  }

  if (hasAuditedPre2017) {
    return (
      payloadProvenance.official_pre2017_chain_status === "available" &&
      payloadProvenance.official_pre2017_unavailable_reason === null &&
      metadata.available === true &&
      metadata.reason === null &&
      typeof metadata.table_sha256 === "string" &&
      SHA256_RE.test(metadata.table_sha256) &&
      metadata.raw_chain_status === "pass"
    );
  }

  return (
    payloadProvenance.official_pre2017_chain_status === "unavailable" &&
    isNonEmptyString(payloadProvenance.official_pre2017_unavailable_reason) &&
    metadata.available === false &&
    isNonEmptyString(metadata.reason) &&
    metadata.table_sha256 === null &&
    metadata.raw_chain_status === "blocked"
  );
}

function validateSourceSegments(
  value: unknown,
  coverage: RecordCoverage,
): boolean {
  if (!Array.isArray(value) || value.length !== 2) {
    return false;
  }

  const segments = value.filter(isObject);
  if (segments.length !== value.length) {
    return false;
  }

  const segmentIsValid = (segment: JsonObject): boolean => {
    if (
      !isValidDate(segment.start) ||
      !isValidDate(segment.end) ||
      segment.start > segment.end ||
      !isKnownSource(segment.market_cap_source)
    ) {
      return false;
    }
    if (
      segment.market_cap_review_status !== undefined &&
      !isKnownReviewStatus(segment.market_cap_review_status)
    ) {
      return false;
    }
    return (
      segment.ratio_available === undefined ||
      typeof segment.ratio_available === "boolean"
    );
  };

  if (!segments.every(segmentIsValid)) {
    return false;
  }

  const expectedPre2017ReviewStatus = coverage.pre2017Mode === "audited"
    ? OFFICIAL_PRE2017_REVIEW_STATUS
    : UNAVAILABLE_REVIEW_STATUS;
  const expectedPre2017RatioAvailable = coverage.pre2017Mode === "audited";
  const expectedPost2017ReviewStatus = coverage.hasPost2017Ratio
    ? VENDOR_REVIEW_STATUS
    : UNAVAILABLE_REVIEW_STATUS;

  return (
    segments[0]?.start === coverage.firstDate &&
    segments[0]?.end === coverage.pre2017LastDate &&
    segments[0]?.market_cap_source === coverage.pre2017Source &&
    segments[0]?.market_cap_review_status === expectedPre2017ReviewStatus &&
    segments[0]?.ratio_available === expectedPre2017RatioAvailable &&
    segments[1]?.start === SOURCE_SWITCH_DATE &&
    segments[1]?.end === coverage.lastDate &&
    segments[1]?.market_cap_source === VENDOR_SOURCE &&
    segments[1]?.market_cap_review_status === expectedPost2017ReviewStatus &&
    segments[1]?.ratio_available === coverage.hasPost2017Ratio
  );
}

function validateRatioMetadata(
  payloadProvenance: JsonObject,
  marketCap: JsonObject,
  coverage: RecordCoverage,
):
  | { ratioAvailable: boolean; ratioRange: DateRange | null }
  | ValidationResult {
  if (payloadProvenance.source_switch_date !== SOURCE_SWITCH_DATE) {
    return failure("市值来源切换日期无效。");
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
    !validateSourceSegments(
      marketCap.source_segments,
      coverage,
    )
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
  const hasAuditedPre2017 = coverage.pre2017Mode === "audited";
  const officialSchema = usesOfficialPre2017Schema(
    coverage,
    payloadProvenance,
    marketCap,
  );
  const expectedReviewStatus = officialSchema
    ? hasAuditedPre2017
      ? AUDITED_MIXED_RATIO_REVIEW_STATUS
      : OFFICIAL_UNAVAILABLE_MIXED_RATIO_REVIEW_STATUS
    : LEGACY_MIXED_RATIO_REVIEW_STATUS;
  const validScopeWarning = hasAuditedPre2017
    ? hasAuditedPre2017Warning(payloadProvenance.ratio_scope_warning) &&
      hasRequiredScopeDefinition(marketCap.scope_definition)
    : isLegacyVendorWarning(payloadProvenance.ratio_scope_warning);
  if (
    !validScopeWarning ||
    !validateOfficialPre2017Metadata(
      payloadProvenance,
      marketCap,
      hasAuditedPre2017,
      officialSchema,
    )
  ) {
    return failure("比例未审计口径提示无效。");
  }
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
      marketCap.ratio_review_status !== expectedReviewStatus
    ) {
      return failure("市值审查状态无效。");
    }
  } else if (
    !isNonEmptyString(payloadProvenance.ratio_unavailable_reason) ||
    payloadRange.kind === "dates" ||
    marketCap.ratio_review_status !== expectedReviewStatus ||
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
  const coverage = validateRecordCoverage(checkedRecords);
  if (isRecordCoverageFailure(coverage)) {
    return coverage;
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
    coverage,
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
    const expectedSource = record.date < SOURCE_SWITCH_DATE
      ? OFFICIAL_PRE2017_SOURCE
      : VENDOR_SOURCE;
    const expectedReviewStatus = record.date < SOURCE_SWITCH_DATE
      ? OFFICIAL_PRE2017_REVIEW_STATUS
      : VENDOR_REVIEW_STATUS;
    if (
      record.source !== expectedSource ||
      record.reviewStatus !== expectedReviewStatus
    ) {
      return failure("比例数据来源或审查状态无效。");
    }
    if (record.ratio < 0) {
      return failure("比例数值无效。");
    }
    if (!hasConsistentRatio(record.totalMargin, record.denominatorMarketCap, record.ratio)) {
      return failure("比例未与同日两融余额和市值分母一致。");
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
