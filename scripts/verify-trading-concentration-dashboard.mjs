import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultDataDirectory = resolve(projectRoot, "public", "data");
const SHA256_RE = /^[a-f0-9]{64}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UTC_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function isCodeAliasList(value) {
  return Array.isArray(value) && value.every(
    (item) => isObject(item)
      && typeof item.source_code === "string"
      && /^\d{6}$/.test(item.source_code)
      && typeof item.resolved_code === "string"
      && /^\d{6}$/.test(item.resolved_code)
      && isNonEmptyString(item.source),
  );
}

function baseNameFromPath(value) {
  const pathParts = value.replace(/\\/g, "/").split("/").filter(Boolean);
  return pathParts[pathParts.length - 1] ?? "";
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

function isValidUtcTimestamp(value) {
  if (typeof value !== "string" || !UTC_TIMESTAMP_RE.test(value)) return false;
  return isValidDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value));
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
  assert(record.denominator_source === "sh880008", `第 ${index + 1} 条记录分母来源不一致。`);
  const expectedScope = record.date < "2022-08-02" ? "sh_sz_active_a" : "sh_sz_bj_active_a";
  assert(record.numerator_scope === expectedScope, `第 ${index + 1} 条记录北交所纳入口径不一致。`);
}

function validateAiChainSeries(aiChainSeries, legacyRecords) {
  assert(isObject(aiChainSeries), "AI 产业链子序列不是对象。");
  assert(
    aiChainSeries.name === "AI产业链成交额占比"
      && aiChainSeries.field === "ai_chain_amount_pct"
      && aiChainSeries.start_date === "2025-01-01"
      && Array.isArray(aiChainSeries.records),
    "AI 产业链子序列名称、字段、起始日或记录结构无效。",
  );
  assert(
    isNonEmptyString(aiChainSeries.definition) && isNonEmptyString(aiChainSeries.active_stock_rule),
    "AI 产业链子序列缺少定义或活跃成分规则。",
  );
  assert(
    isObject(aiChainSeries.universe)
      && isNonEmptyString(aiChainSeries.universe.workbook)
      && isNonEmptyString(aiChainSeries.universe.sheet)
      && isNonEmptyString(aiChainSeries.universe.code_column)
      && Number.isInteger(aiChainSeries.universe.code_count)
      && aiChainSeries.universe.code_count > 0
      && typeof aiChainSeries.universe.codes_sha256 === "string"
      && SHA256_RE.test(aiChainSeries.universe.codes_sha256),
    "AI 产业链子序列宇宙快照无效。",
  );

  const expectedRecords = legacyRecords.filter((record) => record.date >= "2025-01-01");
  if (aiChainSeries.records.length > 0) {
    assert(
      aiChainSeries.records.length === expectedRecords.length,
      "AI 产业链子序列未完整覆盖起始日后的分母交易日。",
    );
  }
  let missingOutputRecords = 0;
  for (const [index, record] of aiChainSeries.records.entries()) {
    const legacyRecord = expectedRecords[index];
    assert(isObject(record) && legacyRecord !== undefined, `AI 产业链 records[${index}] 无效。`);
    assert(
      isValidDate(record.date) && record.date === legacyRecord.date,
      `AI 产业链 records[${index}] 日期未与分母交易日对齐。`,
    );
    assert(
      isNonNegativeInteger(record.ai_chain_active_stock_count),
      `AI 产业链 records[${index}] 活跃成分数量无效。`,
    );
    const amount = record.ai_chain_amount_yi;
    const percentage = record.ai_chain_amount_pct;
    if (amount === null || percentage === null) {
      assert(
        amount === null && percentage === null && record.ai_chain_active_stock_count === 0,
        `AI 产业链 records[${index}] 缺口字段不一致。`,
      );
      missingOutputRecords += 1;
      continue;
    }
    assert(
      typeof amount === "number"
        && Number.isFinite(amount)
        && amount > 0
        && typeof percentage === "number"
        && Number.isFinite(percentage)
        && percentage > 0
        && percentage <= 100
        && Number.isInteger(record.ai_chain_active_stock_count)
        && record.ai_chain_active_stock_count > 0
        && record.ai_chain_active_stock_count <= legacyRecord.active_stock_count
        && record.ai_chain_active_stock_count <= aiChainSeries.universe.code_count,
      `AI 产业链 records[${index}] 成交额、占比或活跃成分数量无效。`,
    );
    const recomputedPercentage = (amount / legacyRecord.market_amount_yi) * 100;
    assert(
      Math.abs(recomputedPercentage - percentage) <= 0.0002,
      `AI 产业链 records[${index}] 未使用同日全A等权 AMOUNT 分母反算。`,
    );
  }
  return { expectedRecords, missingOutputRecords };
}

function validateAiChainManifest(aiChainManifest, aiChainSeries, missingOutputRecords) {
  assert(isObject(aiChainManifest), "AI 产业链发布清单子序列不是对象。");
  const expectedStart = aiChainSeries.records[0]?.date ?? null;
  const expectedEnd = aiChainSeries.records[aiChainSeries.records.length - 1]?.date ?? null;
  assert(
    aiChainManifest.name === aiChainSeries.name
      && aiChainManifest.field === aiChainSeries.field
      && aiChainManifest.start_date === aiChainSeries.start_date
      && isObject(aiChainManifest.data_range)
      && aiChainManifest.data_range.start === expectedStart
      && aiChainManifest.data_range.end === expectedEnd
      && Number.isInteger(aiChainManifest.records)
      && aiChainManifest.records >= 0
      && aiChainManifest.records === aiChainSeries.records.length
      && isNonNegativeInteger(aiChainManifest.missing_output_records)
      && isNonEmptyString(aiChainManifest.formula)
      && aiChainManifest.formula.includes("sh880008.day.amount")
      && aiChainManifest.active_stock_rule === aiChainSeries.active_stock_rule,
    "AI 产业链发布清单子序列口径或记录数无效。",
  );
  assert(
    aiChainManifest.missing_output_records === missingOutputRecords,
    "AI 产业链发布清单缺口统计不一致。",
  );
  const universe = aiChainManifest.universe;
  assert(
    isObject(universe)
      && isNonEmptyString(universe.workbook_path)
      && typeof universe.workbook_sha256 === "string"
      && SHA256_RE.test(universe.workbook_sha256)
      && universe.sheet === aiChainSeries.universe.sheet
      && universe.code_column === aiChainSeries.universe.code_column
      && Number.isInteger(universe.input_code_count)
      && universe.input_code_count > 0
      && Number.isInteger(universe.resolved_code_count)
      && universe.resolved_code_count > 0
      && universe.input_code_count === universe.resolved_code_count
      && typeof universe.resolved_code_sha256 === "string"
      && SHA256_RE.test(universe.resolved_code_sha256)
      && isNonNegativeInteger(universe.non_stock_code_rows_excluded)
      && isCodeAliasList(universe.code_aliases)
      && Number.isInteger(universe.tdx_candidate_file_count)
      && universe.tdx_candidate_file_count > 0,
    "AI 产业链发布清单宇宙快照无效。",
  );
  assert(
    aiChainSeries.universe.code_count === universe.input_code_count
      && aiChainSeries.universe.code_count === universe.resolved_code_count
      && aiChainSeries.universe.codes_sha256 === universe.resolved_code_sha256
      && aiChainSeries.universe.code_count === universe.tdx_candidate_file_count
      && baseNameFromPath(aiChainSeries.universe.workbook) === baseNameFromPath(universe.workbook_path),
    "AI 产业链 payload 与 manifest 宇宙快照不一致。",
  );
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
  const hasPayloadAiChainSeries = hasOwn(payload, "ai_chain_series");
  const hasManifestAiChainSeries = hasOwn(manifest, "ai_chain_series");
  assert(
    hasPayloadAiChainSeries === hasManifestAiChainSeries,
    "AI 产业链子序列必须同时存在于 payload 与 manifest。",
  );
  if (hasPayloadAiChainSeries) {
    const { missingOutputRecords } = validateAiChainSeries(payload.ai_chain_series, payload.records);
    validateAiChainManifest(manifest.ai_chain_series, payload.ai_chain_series, missingOutputRecords);
  }
  assert(
    isObject(manifest.data_range) &&
      manifest.data_range.start === payload.records[0].date &&
      manifest.data_range.end === payload.records[payload.records.length - 1].date,
    "manifest data_range 不匹配。",
  );
  assert(
    Array.isArray(manifest.denominator_segments) &&
      manifest.denominator_segments.length === 1 &&
      manifest.denominator_segments[0]?.start === "2013-01-01" &&
      manifest.denominator_segments[0]?.end === manifest.data_range.end &&
      manifest.denominator_segments[0]?.source === "sh880008" &&
      manifest.denominator_segments[0]?.formula === "sh880008.day.amount",
    "manifest 统一分母说明缺失。",
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
      isNonEmptyString(manifest.comparison_index_input.path) &&
      Number.isInteger(manifest.comparison_index_input.bytes) &&
      manifest.comparison_index_input.bytes > 0 &&
      typeof manifest.comparison_index_input.sha256 === "string" &&
      SHA256_RE.test(manifest.comparison_index_input.sha256) &&
      isValidUtcTimestamp(manifest.comparison_index_input.last_write_time_utc) &&
      isObject(manifest.comparison_index_input.data_range) &&
      isValidDate(manifest.comparison_index_input.data_range.start) &&
      isValidDate(manifest.comparison_index_input.data_range.end) &&
      manifest.comparison_index_input.data_range.start <= manifest.comparison_index_input.data_range.end,
    "manifest 创业板指输入说明缺失或无效。",
  );
  const outputChinextDates = payload.records
    .filter((record) => record.chinext_close !== null)
    .map((record) => record.date);
  assert(
    outputChinextDates.length === 0
      || (manifest.comparison_index_input.data_range.start <= outputChinextDates[0]
        && manifest.comparison_index_input.data_range.end >= outputChinextDates.at(-1)),
    "manifest 创业板指输入日期范围未覆盖 chinext_close 输出。",
  );
  const missingComparisonIndexRecords = payload.records.filter((record) => record.chinext_close === null).length;
  assert(
    Number.isInteger(manifest.comparison_index_input.missing_output_records) &&
      manifest.comparison_index_input.missing_output_records === missingComparisonIndexRecords,
    "manifest 创业板指缺口统计不一致。",
  );
  assert(
    typeof manifest.scope_warning === "string" &&
      manifest.scope_warning.includes("sh880008.day.amount") &&
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
    aiChainRecords: hasPayloadAiChainSeries ? payload.ai_chain_series.records.length : 0,
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
