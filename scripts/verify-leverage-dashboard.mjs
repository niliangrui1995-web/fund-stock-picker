import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_SWITCH_DATE = "2017-01-03";
const FIRST_MARGIN_DATE = "2011-08-03";
const PRE_2017_SOURCE = "pre2017_official_pending";
const PRE_2017_REVIEW_STATUS = "unavailable";
const POST_2017_SOURCE = "eastmoney_post2017_vendor_unverified";
const POST_2017_REVIEW_STATUS = "eastmoney_vendor_unverified";
const DFCF_INPUT_FILENAMES = [
  "dfcf_sse_margin.csv",
  "dfcf_szse_margin.csv",
  "dfcf_margin_balances.csv",
];
const INDEX_CODES = ["000001", "399106", "399006"];
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dataDirectory = process.env.LEVERAGE_DASHBOARD_DATA_DIR
  ? resolve(process.env.LEVERAGE_DASHBOARD_DATA_DIR)
  : resolve(projectRoot, "public", "data");
const payloadPath = resolve(dataDirectory, "leverage-dashboard.json");
const manifestPath = resolve(dataDirectory, "leverage-dashboard.manifest.json");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isFiniteNumberOrNull(value) {
  return value === null || isFiniteNumber(value);
}

function isValidDate(value) {
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

function assertDateRange(value, label, expectedStart, expectedEnd) {
  assert(isObject(value), `${label}必须是日期范围对象。`);
  assert(isValidDate(value.start) && isValidDate(value.end), `${label}日期无效。`);
  assert(value.start <= value.end, `${label}起止日期顺序无效。`);
  assert(value.start === expectedStart && value.end === expectedEnd, `${label}与记录分段不一致。`);
}

function parseRatioDataRange(value, label) {
  if (value === null) {
    return { kind: "null" };
  }

  assert(isObject(value), `${label}必须是日期范围对象或 null。`);
  if (value.start === null || value.end === null) {
    assert(value.start === null && value.end === null, `${label}的空日期范围必须两端均为 null。`);
    return { kind: "empty" };
  }

  assert(isValidDate(value.start) && isValidDate(value.end), `${label}日期无效。`);
  assert(value.start <= value.end, `${label}起止日期顺序无效。`);
  return { kind: "dates", start: value.start, end: value.end };
}

function assertMatchingRatioDataRanges(payloadRange, manifestRange) {
  assert(payloadRange.kind === manifestRange.kind, "发布包和发布清单的比例数据范围不一致。");
  if (payloadRange.kind === "dates" && manifestRange.kind === "dates") {
    assert(
      payloadRange.start === manifestRange.start && payloadRange.end === manifestRange.end,
      "发布包和发布清单的比例数据范围不一致。",
    );
  }
}

function assertSegment(segment, expected, index) {
  assert(isObject(segment), `市值来源分段 ${index + 1} 无效。`);
  assert(segment.start === expected.start && segment.end === expected.end, `市值来源分段 ${index + 1} 日期不一致。`);
  assert(
    segment.market_cap_source === expected.source &&
      segment.market_cap_review_status === expected.reviewStatus &&
      segment.ratio_available === expected.ratioAvailable,
    `市值来源分段 ${index + 1} 口径不一致。`,
  );
}

function assertIndexMetadata(indices) {
  assert(isObject(indices), "指数元数据无效。");
  for (const code of INDEX_CODES) {
    const index = indices[code];
    assert(isObject(index), `指数 ${code} 元数据缺失。`);
    assert(typeof index.source === "string" && index.source.trim(), `指数 ${code} 来源无效。`);
    assert(
      isValidDate(index.first_date) &&
        isValidDate(index.last_date) &&
        index.first_date <= index.last_date,
      `指数 ${code} 日期范围无效。`,
    );
    assert(typeof index.sha256 === "string" && SHA256_PATTERN.test(index.sha256), `指数 ${code} SHA-256 无效。`);
  }
}

function assertDfcfManifest(dfcf) {
  assert(isObject(dfcf), "DFCF 审计元数据无效。");
  assert(dfcf.dfcf_only === true, "DFCF 审计未满足 dfcf_only=true。");
  assert(dfcf.exchange_requests === 0, "DFCF 审计未满足 exchange_requests=0。");
  assert(
    dfcf.sample_status === "dfcf_vendor_only_unverified_by_exchange",
    "DFCF 样本状态无效。",
  );
  assert(isObject(dfcf.inputs), "DFCF 输入哈希缺失。");
  for (const filename of DFCF_INPUT_FILENAMES) {
    assert(
      typeof dfcf.inputs[filename] === "string" && SHA256_PATTERN.test(dfcf.inputs[filename]),
      `DFCF 输入 ${filename} 的 SHA-256 无效。`,
    );
  }
}

function validateRecords(records) {
  assert(Array.isArray(records) && records.length > 0, "发布包记录为空。");

  let previousDate = null;
  let pre2017Count = 0;
  let post2017Count = 0;
  let pre2017LastDate = null;
  let post2017FirstDate = null;
  const ratioRecords = [];

  for (const [index, record] of records.entries()) {
    assert(isObject(record), `第 ${index + 1} 条记录不是对象。`);
    assert(isValidDate(record.date), `第 ${index + 1} 条记录日期无效。`);
    assert(
      previousDate === null || record.date > previousDate,
      "发布包记录日期必须严格升序且唯一。",
    );
    previousDate = record.date;

    for (const field of ["sh_margin_yi", "sz_margin_yi", "total_margin_yi"]) {
      assert(isFiniteNumber(record[field]) && record[field] >= 0, `第 ${index + 1} 条融资余额字段 ${field} 无效。`);
    }
    const expectedTotal = record.sh_margin_yi + record.sz_margin_yi;
    const balanceTolerance = Math.max(1, Math.abs(expectedTotal), Math.abs(record.total_margin_yi)) * 1e-6;
    assert(
      Math.abs(record.total_margin_yi - expectedTotal) <= balanceTolerance,
      `第 ${index + 1} 条两市融资余额合计不一致。`,
    );

    for (const field of [
      "denominator_market_cap_yi",
      "ratio_pct",
      "index_000001_close",
      "index_399106_close",
      "index_399006_close",
    ]) {
      assert(isFiniteNumberOrNull(record[field]), `第 ${index + 1} 条字段 ${field} 无效。`);
    }

    if (record.date < SOURCE_SWITCH_DATE) {
      pre2017Count += 1;
      pre2017LastDate = record.date;
      assert(
        record.ratio_pct === null &&
          record.denominator_market_cap_yi === null &&
          record.market_cap_source === PRE_2017_SOURCE &&
          record.market_cap_review_status === PRE_2017_REVIEW_STATUS,
        "2017-01-03 前市值或比例必须为 N/A，且只能标记为待定交易所分段。",
      );
      continue;
    }

    post2017Count += 1;
    post2017FirstDate ??= record.date;
    assert(
      record.market_cap_source === POST_2017_SOURCE,
      "2017-01-03 及以后市值来源必须为东方财富厂商分段。",
    );

    if (record.ratio_pct === null) {
      assert(
        record.denominator_market_cap_yi === null &&
          record.market_cap_review_status === PRE_2017_REVIEW_STATUS,
        "2017-01-03 及以后缺少精确同日市值时，比例和分母必须为 N/A。",
      );
      continue;
    }

    assert(record.ratio_pct >= 0, "2017-01-03 及以后比例数值无效。");
    assert(
      isFiniteNumber(record.denominator_market_cap_yi) && record.denominator_market_cap_yi > 0,
      "2017-01-03 及以后非空比例必须有正数分母。",
    );
    assert(
      record.market_cap_review_status === POST_2017_REVIEW_STATUS,
      "2017-01-03 及以后非空比例的市值审查状态无效。",
    );
    const impliedRatio = (record.total_margin_yi / record.denominator_market_cap_yi) * 100;
    assert(
      Math.abs(record.ratio_pct - impliedRatio) <= 1e-6,
      `第 ${index + 1} 条比例未与同日两融余额和市值分母一致。`,
    );
    ratioRecords.push(record);
  }

  assert(records[0].date === FIRST_MARGIN_DATE, `两融余额起点必须为 ${FIRST_MARGIN_DATE}。`);
  assert(pre2017Count > 0 && post2017Count > 0, "市值来源前后分段不完整。");
  assert(pre2017LastDate === "2016-12-30", "交易所市值待定分段终点应为 2016-12-30。");
  assert(post2017FirstDate === SOURCE_SWITCH_DATE, `东方财富市值分段必须从 ${SOURCE_SWITCH_DATE} 开始。`);

  return {
    firstDate: records[0].date,
    lastDate: records[records.length - 1].date,
    pre2017Count,
    post2017Count,
    pre2017LastDate,
    ratioRecords,
  };
}

export function verifyLeverageDashboard(payloadText, manifestText) {
  const payloadHash = createHash("sha256").update(payloadText, "utf8").digest("hex");
  let payload;
  let manifest;
  try {
    payload = JSON.parse(payloadText);
  } catch {
    throw new Error("leverage-dashboard.json 不是有效 JSON。");
  }
  try {
    manifest = JSON.parse(manifestText);
  } catch {
    throw new Error("leverage-dashboard.manifest.json 不是有效 JSON。");
  }

  assert(isObject(payload) && payload.schema_version === "1", "发布包 schema_version 必须为 1。");
  assert(isObject(manifest) && manifest.schema_version === "1", "发布清单 schema_version 必须为 1。");
  assert(manifest.payload_sha256 === payloadHash, "发布包 SHA-256 与清单不一致。");
  assert(typeof payload.generated_at_beijing === "string" && payload.generated_at_beijing.trim(), "发布包生成时间无效。");
  assert(manifest.payload_records === payload.records.length, "发布清单记录数与发布包不一致。");

  const recordSummary = validateRecords(payload.records);
  assertDateRange(manifest.data_range, "发布清单数据范围", recordSummary.firstDate, recordSummary.lastDate);
  assertDfcfManifest(manifest.dfcf);
  assertIndexMetadata(manifest.indices);

  assert(isObject(payload.provenance), "发布包比例元数据无效。");
  assert(isObject(manifest.market_cap), "发布清单市值元数据无效。");
  assert(typeof payload.provenance.ratio_available === "boolean", "发布包比例可用标记无效。");
  assert(
    manifest.market_cap.ratio_available === payload.provenance.ratio_available,
    "发布包和发布清单的比例可用标记不一致。",
  );
  assert(manifest.market_cap.reporting_eligible === false, "未审计比例不得标记为正式报告可用。");
  assert(payload.provenance.source_switch_date === SOURCE_SWITCH_DATE, "发布包市值来源切换日期无效。");
  assert(manifest.market_cap.source_switch_date === SOURCE_SWITCH_DATE, "发布清单市值来源切换日期无效。");
  assert(
    typeof payload.provenance.ratio_scope_warning === "string" &&
      payload.provenance.ratio_scope_warning.includes("未经交易所复核") &&
      payload.provenance.ratio_scope_warning.includes("未经完整审计"),
    "比例未审计口径提示无效。",
  );
  const payloadRatioRange = parseRatioDataRange(
    payload.provenance.ratio_data_range,
    "发布包比例数据范围",
  );
  const manifestRatioRange = parseRatioDataRange(
    manifest.market_cap.ratio_data_range,
    "发布清单比例数据范围",
  );
  assertMatchingRatioDataRanges(payloadRatioRange, manifestRatioRange);
  const ratioAvailable = payload.provenance.ratio_available;
  const firstRatioDate = recordSummary.ratioRecords[0]?.date ?? null;
  const lastRatioDate = recordSummary.ratioRecords[recordSummary.ratioRecords.length - 1]?.date ?? null;

  if (ratioAvailable) {
    assert(
      payload.provenance.ratio_unavailable_reason === null,
      "比例可用时不应写不可用原因。",
    );
    assert(
      recordSummary.ratioRecords.length > 0 &&
        payloadRatioRange.kind === "dates" &&
        manifestRatioRange.kind === "dates",
      "比例可用时必须至少有一条精确同日比例及其日期范围。",
    );
    assert(
      payloadRatioRange.start === firstRatioDate &&
        payloadRatioRange.end === lastRatioDate &&
        manifestRatioRange.start === firstRatioDate &&
        manifestRatioRange.end === lastRatioDate,
      "比例数据范围必须等于实际非空比例的首末日期。",
    );
  } else {
    assert(
      typeof payload.provenance.ratio_unavailable_reason === "string" &&
        payload.provenance.ratio_unavailable_reason.trim(),
      "比例不可用时必须说明原因。",
    );
    assert(recordSummary.ratioRecords.length === 0, "比例不可用时不得包含比例数值。");
    assert(
      payloadRatioRange.kind !== "dates" && manifestRatioRange.kind !== "dates",
      "比例不可用时比例日期范围必须两端为 null。",
    );
  }
  assert(
    manifest.market_cap.ratio_missing_records ===
      payload.records.length - recordSummary.ratioRecords.length,
    "发布清单比例缺失记录数与实际 N/A 记录不一致。",
  );
  assert(
    manifest.market_cap.ratio_review_status === "mixed_pre2017_pending_eastmoney_vendor_unverified",
    "发布清单比例审查状态无效。",
  );
  assert(Array.isArray(manifest.market_cap.source_segments) && manifest.market_cap.source_segments.length === 2, "市值来源分段必须恰好为两段。");
  assertSegment(
    manifest.market_cap.source_segments[0],
    {
      start: recordSummary.firstDate,
      end: recordSummary.pre2017LastDate,
      source: PRE_2017_SOURCE,
      reviewStatus: PRE_2017_REVIEW_STATUS,
      ratioAvailable: false,
    },
    0,
  );
  assertSegment(
    manifest.market_cap.source_segments[1],
    {
      start: SOURCE_SWITCH_DATE,
      end: recordSummary.lastDate,
      source: POST_2017_SOURCE,
      reviewStatus: POST_2017_REVIEW_STATUS,
      ratioAvailable: true,
    },
    1,
  );

  return {
    firstDate: recordSummary.firstDate,
    lastDate: recordSummary.lastDate,
    recordCount: payload.records.length,
    ratioAvailable,
    firstRatioDate,
    lastRatioDate,
    ratioMissingRecords: payload.records.length - recordSummary.ratioRecords.length,
  };
}

async function run() {
  const [payloadText, manifestText] = await Promise.all([
    readFile(payloadPath, "utf8"),
    readFile(manifestPath, "utf8"),
  ]);
  const summary = verifyLeverageDashboard(payloadText, manifestText);
  const ratioDescription = summary.ratioAvailable
    ? `比例非空范围 ${summary.firstRatioDate} 至 ${summary.lastRatioDate}，允许精确同日市值缺口。`
    : "比例当前全部为 N/A。";
  console.log(
    `两融发布包校验通过：${summary.recordCount.toLocaleString("zh-CN")} 条，${summary.firstDate} 至 ${summary.lastDate}；${ratioDescription}`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    const reason = error instanceof Error ? error.message : "未知错误。";
    console.error(`两融发布包校验失败：${reason}`);
    process.exitCode = 1;
  });
}
