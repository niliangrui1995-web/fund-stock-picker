import { describe, expect, it } from "vitest";

import { buildChinextComparisonSeries, buildConcentrationChartOption } from "../concentrationChartOption";
import type { AiChainSeries, ConcentrationRecord } from "../types";

const records: ConcentrationRecord[] = [
  {
    date: "2025-01-02",
    chinext_close: null,
    c5_pct: 42,
    top5_amount_yi: 42,
    market_amount_yi: 100,
    active_stock_count: 20,
    top5_stock_count: 1,
    denominator_source: "sh880008",
    numerator_scope: "sh_sz_bj_active_a",
  },
  {
    date: "2025-01-03",
    chinext_close: 2_000,
    c5_pct: 43,
    top5_amount_yi: 43,
    market_amount_yi: 100,
    active_stock_count: 20,
    top5_stock_count: 1,
    denominator_source: "sh880008",
    numerator_scope: "sh_sz_bj_active_a",
  },
  {
    date: "2025-01-04",
    chinext_close: 2_200,
    c5_pct: 44,
    top5_amount_yi: 44,
    market_amount_yi: 100,
    active_stock_count: 20,
    top5_stock_count: 1,
    denominator_source: "sh880008",
    numerator_scope: "sh_sz_bj_active_a",
  },
];

const aiChainSeries: AiChainSeries = {
  name: "AI产业链成交额占比",
  field: "ai_chain_amount_pct",
  start_date: "2025-01-01",
  definition: "AI 产业链活跃成分成交额 / 同日全A等权 AMOUNT × 100%。",
  active_stock_rule: "close > 0 且 amount > 0 且 volume > 0。",
  universe: {
    workbook: "watchlists/AI产业链.xlsx",
    sheet: "AI产业链",
    code_column: "B",
    code_count: 3,
    codes_sha256: "a".repeat(64),
  },
  records: [
    {
      date: "2025-01-02",
      ai_chain_amount_pct: 10,
      ai_chain_amount_yi: 10,
      ai_chain_active_stock_count: 2,
    },
    {
      date: "2025-01-03",
      ai_chain_amount_pct: 12,
      ai_chain_amount_yi: 12,
      ai_chain_active_stock_count: 3,
    },
    {
      date: "2025-01-04",
      ai_chain_amount_pct: null,
      ai_chain_amount_yi: null,
      ai_chain_active_stock_count: 0,
    },
  ],
};

describe("交易集中度图表配置", () => {
  it("把 C5 与 AI 产业链占比放在左轴、创业板指归一化后放在右轴，并保留缺口", () => {
    const comparison = buildChinextComparisonSeries(records);
    const option = buildConcentrationChartOption(records, aiChainSeries) as unknown as {
      yAxis: Array<Record<string, unknown>>;
      series: Array<{ name: string; yAxisIndex: number; data: Array<[string, number | null]>; connectNulls: boolean }>;
      tooltip: { formatter: (params: unknown) => string };
    };

    expect(comparison.baseDate).toBe("2025-01-03");
    expect(comparison.baseClose).toBe(2_000);
    expect(comparison.data[0]).toEqual(["2025-01-02", null]);
    expect(comparison.data[1]).toEqual(["2025-01-03", 100]);
    expect(comparison.data[2]?.[1]).toBeCloseTo(110, 8);
    expect(option.yAxis).toHaveLength(2);
    expect(option.yAxis[0]).toMatchObject({ name: "成交额占比（%）", position: "left" });
    expect(option.yAxis[1]).toMatchObject({ name: "创业板指（基准=100）", position: "right" });
    expect(option.series).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "C5", yAxisIndex: 0 }),
        expect.objectContaining({ name: "创业板指", yAxisIndex: 1, data: comparison.data, connectNulls: false }),
        expect.objectContaining({
          name: "AI产业链成交额占比",
          yAxisIndex: 0,
          data: [
            ["2025-01-02", 10],
            ["2025-01-03", 12],
            ["2025-01-04", null],
          ],
          connectNulls: false,
        }),
      ]),
    );
    const tooltip = option.tooltip.formatter([{ axisValue: "2025-01-03" }]);
    expect(tooltip).toContain("创业板指：收盘 2000.00；对比值 100.00");
    expect(tooltip).toContain("对比基准：2025-01-03 = 100");
    expect(tooltip).toContain("AI产业链成交额占比：12.00%");
    expect(tooltip).toContain("AI 产业链成交额：12 亿元");
    expect(tooltip).toContain("AI 产业链活跃成分：3 只");
  });

  it("旧包没有 AI 子序列时保持双线图", () => {
    const option = buildConcentrationChartOption(records) as unknown as {
      series: Array<{ name: string }>;
    };

    expect(option.series.map((series) => series.name)).toEqual(["C5", "创业板指"]);
  });
});
