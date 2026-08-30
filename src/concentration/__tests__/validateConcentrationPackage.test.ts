import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { validateConcentrationPackage } from "../validateConcentrationPackage";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const payloadPath = resolve(projectRoot, "public", "data", "trading-concentration-dashboard.json");
const manifestPath = resolve(projectRoot, "public", "data", "trading-concentration-dashboard.manifest.json");

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

async function readPackage() {
  const [payloadText, manifestText] = await Promise.all([
    readFile(payloadPath, "utf8"),
    readFile(manifestPath, "utf8"),
  ]);
  return {
    payload: JSON.parse(payloadText) as { records: Array<Record<string, unknown>>; ai_chain_series?: unknown },
    manifest: JSON.parse(manifestText) as Record<string, unknown>,
  };
}

function buildAiChainPackage(
  payload: { records: Array<Record<string, unknown>>; ai_chain_series?: unknown },
  manifest: Record<string, unknown>,
) {
  delete payload.ai_chain_series;
  delete manifest.ai_chain_series;
  const records = payload.records.filter((record) => typeof record.date === "string" && record.date >= "2025-01-01");
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
    records: records.map((record) => {
      const marketAmount = record.market_amount_yi;
      if (typeof marketAmount !== "number") {
        throw new Error("测试数据缺少 market_amount_yi。");
      }
      return {
        date: record.date,
        ai_chain_amount_pct: 10,
        ai_chain_amount_yi: marketAmount * 0.1,
        ai_chain_active_stock_count: 1,
      };
    }),
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

describe("交易集中度前端发布包校验器", () => {
  it("拒绝被篡改的 SHA", async () => {
    const [payloadText, manifestText] = await Promise.all([
      readFile(payloadPath, "utf8"),
      readFile(manifestPath, "utf8"),
    ]);
    const manifest = JSON.parse(manifestText) as Record<string, unknown>;
    manifest.payload_sha256 = "0".repeat(64);

    await expect(validateConcentrationPackage(payloadText, JSON.stringify(manifest))).resolves.toMatchObject({
      ok: false,
      reason: "交易集中度发布包 SHA-256 校验失败。",
    });
  });

  it("拒绝与切换日期不一致的分子范围", async () => {
    const [payloadText, manifestText] = await Promise.all([
      readFile(payloadPath, "utf8"),
      readFile(manifestPath, "utf8"),
    ]);
    const payload = JSON.parse(payloadText) as { records: Array<Record<string, unknown>> };
    const record = payload.records.find((item) => item.date === "2022-08-02");
    if (!record) {
      throw new Error("测试数据缺少北交所纳入日。");
    }
    record.numerator_scope = "sh_sz_active_a";

    await expect(validateConcentrationPackage(JSON.stringify(payload), manifestText)).resolves.toMatchObject({
      ok: false,
      reason: expect.stringContaining("北交所纳入口径不一致"),
    });
  });

  it("拒绝无效的创业板指收盘价", async () => {
    const [payloadText, manifestText] = await Promise.all([
      readFile(payloadPath, "utf8"),
      readFile(manifestPath, "utf8"),
    ]);
    const payload = JSON.parse(payloadText) as { records: Array<Record<string, unknown>> };
    const record = payload.records[0];
    if (!record) {
      throw new Error("测试数据缺少首条记录。");
    }
    record.chinext_close = 0;

    await expect(validateConcentrationPackage(JSON.stringify(payload), manifestText)).resolves.toMatchObject({
      ok: false,
      reason: expect.stringContaining("chinext_close 无效"),
    });
  });

  it("兼容 payload 与 manifest 都没有 AI 子序列的旧包", async () => {
    const { payload, manifest } = await readPackage();
    delete payload.ai_chain_series;
    delete manifest.ai_chain_series;
    const payloadText = JSON.stringify(payload);
    manifest.payload_sha256 = sha256(payloadText);

    await expect(validateConcentrationPackage(payloadText, JSON.stringify(manifest))).resolves.toMatchObject({
      ok: true,
    });
  });

  it("接受同日分母反算一致且记录完整的 AI 子序列", async () => {
    const { payload, manifest } = await readPackage();
    const fixture = buildAiChainPackage(payload, manifest);

    const result = await validateConcentrationPackage(fixture.payloadText, JSON.stringify(fixture.manifest));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.ai_chain_series?.records.length).toBe(
      result.payload.records.filter((record) => record.date >= "2025-01-01").length,
    );
    expect(result.manifest.ai_chain_series?.records).toBe(result.payload.ai_chain_series?.records.length);
  });

  it("拒绝仅在一侧出现或与同日分母不一致的 AI 子序列", async () => {
    const { payload, manifest } = await readPackage();
    const fixture = buildAiChainPackage(payload, manifest);
    delete fixture.manifest.ai_chain_series;

    await expect(validateConcentrationPackage(fixture.payloadText, JSON.stringify(fixture.manifest))).resolves.toMatchObject({
      ok: false,
      reason: "AI 产业链子序列必须同时存在于 payload 与 manifest。",
    });

    const mismatchSource = await readPackage();
    const mismatch = buildAiChainPackage(mismatchSource.payload, mismatchSource.manifest);
    const aiChainSeries = mismatch.payload.ai_chain_series as {
      records: Array<{ ai_chain_amount_pct: number }>;
    };
    aiChainSeries.records[0]!.ai_chain_amount_pct = 11;
    const mismatchPayloadText = JSON.stringify(mismatch.payload);
    mismatch.manifest.payload_sha256 = sha256(mismatchPayloadText);

    await expect(validateConcentrationPackage(mismatchPayloadText, JSON.stringify(mismatch.manifest))).resolves.toMatchObject({
      ok: false,
      reason: expect.stringContaining("未使用同日全A等权 AMOUNT 分母反算"),
    });
  });

  it("拒绝 null 子序列和不成对的 AI 缺口字段", async () => {
    const nullSource = await readPackage();
    nullSource.payload.ai_chain_series = null;
    nullSource.manifest.ai_chain_series = null;
    const nullPayloadText = JSON.stringify(nullSource.payload);
    nullSource.manifest.payload_sha256 = sha256(nullPayloadText);

    await expect(validateConcentrationPackage(nullPayloadText, JSON.stringify(nullSource.manifest))).resolves.toMatchObject({
      ok: false,
      reason: "AI 产业链子序列不是对象。",
    });

    const partialSource = await readPackage();
    const partialFixture = buildAiChainPackage(partialSource.payload, partialSource.manifest);
    const partialSeries = partialFixture.payload.ai_chain_series as {
      records: Array<{ ai_chain_amount_pct: number | null }>;
    };
    partialSeries.records[0]!.ai_chain_amount_pct = null;
    const partialPayloadText = JSON.stringify(partialFixture.payload);
    partialFixture.manifest.payload_sha256 = sha256(partialPayloadText);

    await expect(validateConcentrationPackage(partialPayloadText, JSON.stringify(partialFixture.manifest))).resolves.toMatchObject({
      ok: false,
      reason: expect.stringContaining("缺口字段不一致"),
    });
  });

  it("接受空记录和全缺口 AI 子序列，并交叉核验代码列与计数", async () => {
    const emptySource = await readPackage();
    const emptyFixture = buildAiChainPackage(emptySource.payload, emptySource.manifest);
    const emptySeries = emptyFixture.payload.ai_chain_series as { records: unknown[] };
    const emptyManifest = emptyFixture.manifest.ai_chain_series as {
      data_range: { start: string | null; end: string | null };
      records: number;
      missing_output_records: number;
    };
    emptySeries.records = [];
    emptyManifest.data_range = { start: null, end: null };
    emptyManifest.records = 0;
    emptyManifest.missing_output_records = 0;
    const emptyPayloadText = JSON.stringify(emptyFixture.payload);
    emptyFixture.manifest.payload_sha256 = sha256(emptyPayloadText);

    await expect(validateConcentrationPackage(emptyPayloadText, JSON.stringify(emptyFixture.manifest))).resolves.toMatchObject({
      ok: true,
    });

    const nullSource = await readPackage();
    const nullFixture = buildAiChainPackage(nullSource.payload, nullSource.manifest);
    const nullSeries = nullFixture.payload.ai_chain_series as {
      records: Array<{
        ai_chain_amount_pct: number | null;
        ai_chain_amount_yi: number | null;
        ai_chain_active_stock_count: number;
      }>;
    };
    nullSeries.records = nullSeries.records.map((record) => ({
      ...record,
      ai_chain_amount_pct: null,
      ai_chain_amount_yi: null,
      ai_chain_active_stock_count: 0,
    }));
    const nullManifest = nullFixture.manifest.ai_chain_series as { missing_output_records: number };
    nullManifest.missing_output_records = nullSeries.records.length;
    const nullPayloadText = JSON.stringify(nullFixture.payload);
    nullFixture.manifest.payload_sha256 = sha256(nullPayloadText);

    await expect(validateConcentrationPackage(nullPayloadText, JSON.stringify(nullFixture.manifest))).resolves.toMatchObject({
      ok: true,
    });

    const columnSource = await readPackage();
    const columnFixture = buildAiChainPackage(columnSource.payload, columnSource.manifest);
    const columnSeries = columnFixture.payload.ai_chain_series as { universe: { code_column: string } };
    columnSeries.universe.code_column = "代码";
    const columnPayloadText = JSON.stringify(columnFixture.payload);
    columnFixture.manifest.payload_sha256 = sha256(columnPayloadText);

    await expect(validateConcentrationPackage(columnPayloadText, JSON.stringify(columnFixture.manifest))).resolves.toMatchObject({
      ok: false,
      reason: "AI 产业链发布清单宇宙快照无效。",
    });
  });
});
