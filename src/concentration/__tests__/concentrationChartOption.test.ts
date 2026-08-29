import { describe, expect, it } from "vitest";

import { buildChinextComparisonSeries, buildConcentrationChartOption } from "../concentrationChartOption";
import type { ConcentrationRecord } from "../types";

const records: ConcentrationRecord[] = [
  {
    date: "2024-01-02",
    chinext_close: null,
    c5_pct: 42,
    top5_amount_yi: 42,
    market_amount_yi: 100,
    active_stock_count: 20,
    top5_stock_count: 1,
    denominator_source: "sh880005",
    numerator_scope: "sh_sz_bj_active_a",
  },
  {
    date: "2024-01-03",
    chinext_close: 2_000,
    c5_pct: 43,
    top5_amount_yi: 43,
    market_amount_yi: 100,
    active_stock_count: 20,
    top5_stock_count: 1,
    denominator_source: "sh880005",
    numerator_scope: "sh_sz_bj_active_a",
  },
  {
    date: "2024-01-04",
    chinext_close: 2_200,
    c5_pct: 44,
    top5_amount_yi: 44,
    market_amount_yi: 100,
    active_stock_count: 20,
    top5_stock_count: 1,
    denominator_source: "sh880005",
    numerator_scope: "sh_sz_bj_active_a",
  },
];

describe("交易集中度图表配置", () => {
  it("把 C5 放在左轴、创业板指归一化后放在右轴，并保留指数缺口", () => {
    const comparison = buildChinextComparisonSeries(records);
    const option = buildConcentrationChartOption(records) as unknown as {
      yAxis: Array<Record<string, unknown>>;
      series: Array<{ name: string; yAxisIndex: number; data: Array<[string, number | null]>; connectNulls: boolean }>;
      tooltip: { formatter: (params: unknown) => string };
    };

    expect(comparison.baseDate).toBe("2024-01-03");
    expect(comparison.baseClose).toBe(2_000);
    expect(comparison.data[0]).toEqual(["2024-01-02", null]);
    expect(comparison.data[1]).toEqual(["2024-01-03", 100]);
    expect(comparison.data[2]?.[1]).toBeCloseTo(110, 8);
    expect(option.yAxis).toHaveLength(2);
    expect(option.yAxis[0]).toMatchObject({ name: "C5（%）", position: "left" });
    expect(option.yAxis[1]).toMatchObject({ name: "创业板指（基准=100）", position: "right" });
    expect(option.series).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "C5", yAxisIndex: 0 }),
        expect.objectContaining({ name: "创业板指", yAxisIndex: 1, data: comparison.data, connectNulls: false }),
      ]),
    );
    const tooltip = option.tooltip.formatter([{ axisValue: "2024-01-04" }]);
    expect(tooltip).toContain("创业板指：收盘 2200.00；对比值 110.00");
    expect(tooltip).toContain("对比基准：2024-01-03 = 100");
  });
});
