import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { verifyTradingConcentrationDashboard } from "./verify-trading-concentration-dashboard.mjs";

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}

async function readPublishedPackage() {
  const dataDirectory = new URL("../public/data/", import.meta.url);
  const [payloadText, manifestText] = await Promise.all([
    readFile(new URL("trading-concentration-dashboard.json", dataDirectory), "utf8"),
    readFile(new URL("trading-concentration-dashboard.manifest.json", dataDirectory), "utf8"),
  ]);
  return { payload: JSON.parse(payloadText), manifest: JSON.parse(manifestText) };
}

function buildAiChainPackage(payload, manifest) {
  delete payload.ai_chain_series;
  delete manifest.ai_chain_series;
  const records = payload.records.filter((record) => record.date >= "2025-01-01");
  payload.ai_chain_series = {
    name: "AI产业链成交额占比",
    field: "ai_chain_amount_pct",
    start_date: "2025-01-01",
    definition: "AI 产业链活跃成分成交额 / 同日全A等权 AMOUNT × 100%。",
    active_stock_rule: "close > 0 且 amount > 0 且 volume > 0。",
    universe: {
      workbook: "watchlists/AI产业链.xlsx",
      sheet: "AI产业链",
      code_column: "B",
      code_count: 377,
      codes_sha256: "a".repeat(64),
    },
    records: records.map((record) => ({
      date: record.date,
      ai_chain_amount_pct: 10,
      ai_chain_amount_yi: record.market_amount_yi * 0.1,
      ai_chain_active_stock_count: 1,
    })),
  };
  manifest.ai_chain_series = {
    name: "AI产业链成交额占比",
    field: "ai_chain_amount_pct",
    start_date: "2025-01-01",
    data_range: { start: records[0]?.date, end: records[records.length - 1]?.date },
    records: records.length,
    missing_output_records: 0,
    formula: "sum(ai_chain_active_stock.amount) / sh880008.day.amount × 100",
    active_stock_rule: "close > 0 且 amount > 0 且 volume > 0。",
    universe: {
      workbook_path: "D:\\vcp_hunter\\产业链投研\\watchlists\\AI产业链.xlsx",
      workbook_sha256: "b".repeat(64),
      sheet: "AI产业链",
      code_column: "B",
      input_code_count: 377,
      resolved_code_count: 377,
      resolved_code_sha256: "a".repeat(64),
      non_stock_code_rows_excluded: 0,
      code_aliases: [{ source_code: "430139", resolved_code: "920139", source: "北交所代码映射" }],
      tdx_candidate_file_count: 377,
    },
  };
  const payloadText = JSON.stringify(payload);
  manifest.payload_sha256 = sha256(payloadText);
  return { payload, manifest, payloadText };
}

async function withTemporaryPackage(payload, manifest, verify) {
  const dataDirectory = await mkdtemp(join(tmpdir(), "trading-concentration-dashboard-"));
  try {
    const payloadText = JSON.stringify(payload);
    manifest.payload_sha256 = sha256(payloadText);
    await Promise.all([
      writeFile(join(dataDirectory, "trading-concentration-dashboard.json"), payloadText, "utf8"),
      writeFile(join(dataDirectory, "trading-concentration-dashboard.manifest.json"), JSON.stringify(manifest), "utf8"),
    ]);
    return await verify(dataDirectory);
  } finally {
    await rm(dataDirectory, { recursive: true, force: true });
  }
}

test("已发布交易集中度数据包满足 SHA、分段和 C5 反算契约", async () => {
  const result = await verifyTradingConcentrationDashboard();
  assert.ok(result.records > 3000);
  assert.ok(result.start >= "2013-01-01");
  assert.ok(result.end >= result.start);
  assert.match(result.payloadSha256, /^[a-f0-9]{64}$/);
});

test("Node 校验器兼容没有 AI 子序列的历史包", async () => {
  const { payload, manifest } = await readPublishedPackage();
  delete payload.ai_chain_series;
  delete manifest.ai_chain_series;

  const result = await withTemporaryPackage(
    payload,
    manifest,
    (dataDirectory) => verifyTradingConcentrationDashboard({ dataDirectory }),
  );

  assert.equal(result.aiChainRecords, 0);
});

test("Node 校验器拒绝未覆盖已有 chinext_close 的创业板指输入范围", async () => {
  const { payload, manifest } = await readPublishedPackage();
  const outputChinextDates = payload.records
    .filter((record) => record.chinext_close !== null)
    .map((record) => record.date);
  const staleEnd = outputChinextDates.at(-2);
  assert.ok(staleEnd, "测试数据至少需要两条非空 chinext_close 记录。");
  manifest.comparison_index_input.data_range.end = staleEnd;

  await assert.rejects(
    withTemporaryPackage(
      payload,
      manifest,
      (dataDirectory) => verifyTradingConcentrationDashboard({ dataDirectory }),
    ),
    /创业板指输入日期范围未覆盖 chinext_close 输出/,
  );
});

test("Node 校验器接受完整 AI 子序列，并拒绝单边或分母不一致的子序列", async () => {
  const source = await readPublishedPackage();
  const validFixture = buildAiChainPackage(source.payload, source.manifest);
  const result = await withTemporaryPackage(
    validFixture.payload,
    validFixture.manifest,
    (dataDirectory) => verifyTradingConcentrationDashboard({ dataDirectory }),
  );
  assert.ok(result.aiChainRecords > 0);

  const oneSidedSource = await readPublishedPackage();
  const oneSidedFixture = buildAiChainPackage(oneSidedSource.payload, oneSidedSource.manifest);
  delete oneSidedFixture.manifest.ai_chain_series;
  await assert.rejects(
    withTemporaryPackage(
      oneSidedFixture.payload,
      oneSidedFixture.manifest,
      (dataDirectory) => verifyTradingConcentrationDashboard({ dataDirectory }),
    ),
    /必须同时存在于 payload 与 manifest/,
  );

  const mismatchSource = await readPublishedPackage();
  const mismatchFixture = buildAiChainPackage(mismatchSource.payload, mismatchSource.manifest);
  mismatchFixture.payload.ai_chain_series.records[0].ai_chain_amount_pct = 11;
  await assert.rejects(
    withTemporaryPackage(
      mismatchFixture.payload,
      mismatchFixture.manifest,
      (dataDirectory) => verifyTradingConcentrationDashboard({ dataDirectory }),
    ),
    /未使用同日全A等权 AMOUNT 分母反算/,
  );

  const nullSource = await readPublishedPackage();
  nullSource.payload.ai_chain_series = null;
  nullSource.manifest.ai_chain_series = null;
  await assert.rejects(
    withTemporaryPackage(
      nullSource.payload,
      nullSource.manifest,
      (dataDirectory) => verifyTradingConcentrationDashboard({ dataDirectory }),
    ),
    /AI 产业链子序列不是对象/,
  );

  const partialSource = await readPublishedPackage();
  const partialFixture = buildAiChainPackage(partialSource.payload, partialSource.manifest);
  partialFixture.payload.ai_chain_series.records[0].ai_chain_amount_pct = null;
  await assert.rejects(
    withTemporaryPackage(
      partialFixture.payload,
      partialFixture.manifest,
      (dataDirectory) => verifyTradingConcentrationDashboard({ dataDirectory }),
    ),
    /缺口字段不一致/,
  );
});

test("Node 校验器允许空记录或全缺口 AI 子序列，并校验代码列与计数", async () => {
  const emptySource = await readPublishedPackage();
  const emptyFixture = buildAiChainPackage(emptySource.payload, emptySource.manifest);
  emptyFixture.payload.ai_chain_series.records = [];
  emptyFixture.manifest.ai_chain_series.data_range = { start: null, end: null };
  emptyFixture.manifest.ai_chain_series.records = 0;
  emptyFixture.manifest.ai_chain_series.missing_output_records = 0;
  const emptyResult = await withTemporaryPackage(
    emptyFixture.payload,
    emptyFixture.manifest,
    (dataDirectory) => verifyTradingConcentrationDashboard({ dataDirectory }),
  );
  assert.equal(emptyResult.aiChainRecords, 0);

  const nullSource = await readPublishedPackage();
  const nullFixture = buildAiChainPackage(nullSource.payload, nullSource.manifest);
  nullFixture.payload.ai_chain_series.records = nullFixture.payload.ai_chain_series.records.map((record) => ({
    ...record,
    ai_chain_amount_pct: null,
    ai_chain_amount_yi: null,
    ai_chain_active_stock_count: 0,
  }));
  nullFixture.manifest.ai_chain_series.missing_output_records = nullFixture.payload.ai_chain_series.records.length;
  const nullResult = await withTemporaryPackage(
    nullFixture.payload,
    nullFixture.manifest,
    (dataDirectory) => verifyTradingConcentrationDashboard({ dataDirectory }),
  );
  assert.ok(nullResult.aiChainRecords > 0);

  const columnSource = await readPublishedPackage();
  const columnFixture = buildAiChainPackage(columnSource.payload, columnSource.manifest);
  columnFixture.payload.ai_chain_series.universe.code_column = "代码";
  await assert.rejects(
    withTemporaryPackage(
      columnFixture.payload,
      columnFixture.manifest,
      (dataDirectory) => verifyTradingConcentrationDashboard({ dataDirectory }),
    ),
    /AI 产业链发布清单宇宙快照无效/,
  );
});
