import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultDataDirectory = resolve(projectRoot, "public", "data");
const SHA256_RE = /^[a-f0-9]{64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidDate(value) {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

function validateRecord(record, index, previousDate) {
  assert(isObject(record), `第 ${index + 1} 条记录不是对象。`);
  assert(isValidDate(record.date), `第 ${index + 1} 条记录日期无效。`);
  assert(previousDate === null || record.date > previousDate, "日度记录必须严格递增。");
  assert("chinext_close" in record, `第 ${index + 1} 条记录 chinext_close 缺失。`);
  assert(
    record.chinext_close === null || (typeof record.chinext_close === "number" && Number.isFinite(record.chinext_close) && record.chinext_close > 0),
    `第 ${index + 1} 条记录 chinext_close 无效。`,
  );
  for (const field of ["c5_pct", "top5_amount_yi", "market_amount_yi"]) {
    assert(
      typeof record[field] === "number" && Number.isFinite(record[field]),
      `第 ${index + 1} 条记录 ${field} 无效。`,
    );
  }
  assert(record.c5_pct >= 0 && record.top5_amount_yi >= 0 && record.market_amount_yi > 0, `第 ${index + 1} 条记录成交额或 C5 不合法。`);
  assert(
    Number.isInteger(record.active_stock_count) && record.active_stock_count > 0,
    `第 ${index + 1} 条记录 active_stock_count 无效。`,
  );
  assert(
    record.top5_stock_count === Math.ceil(record.active_stock_count * 0.05),
    `第 ${index + 1} 条记录 top5_stock_count 不等于 ceil(5% × N)。`,
  );
  const recomputed = (record.top5_amount_yi / record.market_amount_yi) * 100;
  assert(Math.abs(recomputed - record.c5_pct) <= 0.0002, `第 ${index + 1} 条记录 C5 反算不一致。`);
  const expectedDenominator = record.date < "2016-01-26" ? "sh000002_plus_sz399107" : "sh880005";
  assert(record.denominator_source === expectedDenominator, `第 ${index + 1} 条记录分母分段不一致。`);
  const expectedScope = record.date < "2022-08-02" ? "sh_sz_active_a" : "sh_sz_bj_active_a";
  assert(record.numerator_scope === expectedScope, `第 ${index + 1} 条记录北交所纳入口径不一致。`);
}

export async function verifyTradingConcentrationDashboard({ dataDirectory = defaultDataDirectory } = {}) {
  const directory = resolve(dataDirectory);
  const payloadPath = resolve(directory, "trading-concentration-dashboard.json");
  const manifestPath = resolve(directory, "trading-concentration-dashboard.manifest.json");
  const [payloadText, manifestText] = await Promise.all([
    readFile(payloadPath, "utf8"),
    readFile(manifestPath, "utf8"),
  ]);
  const payload = JSON.parse(payloadText);
  const manifest = JSON.parse(manifestText);
  assert(isObject(payload) && payload.schema_version === "1", "payload schema_version 无效。");
  assert(isObject(manifest) && manifest.schema_version === "1", "manifest schema_version 无效。");
  assert(manifest.payload_sha256 === sha256(payloadText), "manifest payload SHA-256 不匹配。");
  assert(typeof manifest.csv_sha256 === "string" && SHA256_RE.test(manifest.csv_sha256), "manifest CSV SHA-256 无效。");
  assert(manifest.evidence_level === "market_data_vendor", "发布包证据等级不是 market_data_vendor。");
  assert(manifest.raw_data_copied === false && payload?.provenance?.raw_data_copied === false, "发布包不得复制原始日线。" );
  assert(Array.isArray(payload.records) && payload.records.length > 0, "payload records 为空。");
  assert(manifest.payload_records === payload.records.length, "manifest payload_records 不匹配。");

  let previousDate = null;
  for (const [index, record] of payload.records.entries()) {
    validateRecord(record, index, previousDate);
    previousDate = record.date;
  }
  assert(
    isObject(manifest.data_range) &&
      manifest.data_range.start === payload.records[0].date &&
      manifest.data_range.end === payload.records[payload.records.length - 1].date,
    "manifest data_range 不匹配。",
  );
  assert(
    Array.isArray(manifest.denominator_segments) &&
      manifest.denominator_segments.some((segment) => segment?.start === "2013-01-01" && segment?.end === "2016-01-25") &&
      manifest.denominator_segments.some((segment) => segment?.start === "2016-01-26"),
    "manifest 分母切换说明缺失。",
  );
  assert(
    Array.isArray(manifest.numerator_segments) &&
      manifest.numerator_segments.some((segment) => segment?.start === "2022-08-02" && segment?.scope === "sh_sz_bj_active_a"),
    "manifest 北交所纳入说明缺失。",
  );
  assert(
    isObject(manifest.comparison_index_input) &&
      manifest.comparison_index_input.code === "399006" &&
      manifest.comparison_index_input.name === "创业板指" &&
      manifest.comparison_index_input.field === "chinext_close" &&
      manifest.comparison_index_input.value === "收盘价" &&
      manifest.comparison_index_input.price_scale === "close / 100" &&
      manifest.comparison_index_input.source === "通达信本地盘后 .day 日线" &&
      isObject(manifest.comparison_index_input.data_range) &&
      isValidDate(manifest.comparison_index_input.data_range.start) &&
      isValidDate(manifest.comparison_index_input.data_range.end) &&
      manifest.comparison_index_input.data_range.start <= manifest.comparison_index_input.data_range.end,
    "manifest 创业板指输入说明缺失或无效。",
  );
  const missingComparisonIndexRecords = payload.records.filter((record) => record.chinext_close === null).length;
  assert(
    Number.isInteger(manifest.comparison_index_input.missing_output_records) &&
      manifest.comparison_index_input.missing_output_records === missingComparisonIndexRecords,
    "manifest 创业板指缺口统计不一致。",
  );
  assert(
    typeof manifest.scope_warning === "string" &&
      manifest.scope_warning.includes("2016-01-26") &&
      manifest.scope_warning.includes("2022-08-02") &&
      manifest.scope_warning.includes("不插值"),
    "manifest 口径边界提示不完整。",
  );

  return {
    dataDirectory: directory,
    records: payload.records.length,
    start: payload.records[0].date,
    end: payload.records[payload.records.length - 1].date,
    payloadSha256: manifest.payload_sha256,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await verifyTradingConcentrationDashboard({
      dataDirectory: process.env.TRADING_CONCENTRATION_DATA_DIR || defaultDataDirectory,
    });
    console.log(`交易集中度发布包校验通过：${result.records} 条，${result.start} 至 ${result.end}，SHA-256=${result.payloadSha256}`);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "未知错误。";
    console.error(`交易集中度发布包校验失败：${reason}`);
    process.exitCode = 1;
  }
}
