import { describe, expect, it } from "vitest";

import type { DerivedSeries } from "../deriveLeverageSeries";
import {
  buildLeverageChartOption,
  formatLeverageTooltip,
} from "../leverageChartOption";

const derived: DerivedSeries = {
  main: [
    { date: "2017-01-03", value: 182 },
    { date: "2017-01-04", value: 180 },
  ],
  indices: [
    {
      code: "000001",
      points: [
        { date: "2017-01-03", rawClose: 3010, normalized: 100 },
        { date: "2017-01-04", rawClose: 3000, normalized: 99.66777409 },
      ],
    },
  ],
  unavailableIndexCodes: [],
  baseDate: "2017-01-03",
  unavailableReason: null,
};

describe("leverage chart option", () => {
  it("将余额置于左轴、归一化指数置于右轴，且不把原始点位混入图形数据", () => {
    const option = buildLeverageChartOption({
      metric: "margin",
      derived,
    });

    expect(option.yAxis).toHaveLength(2);
    expect(option.yAxis[0]).toMatchObject({ name: "两市融资余额（亿元）", position: "left" });
    expect(option.yAxis[1]).toMatchObject({ name: "指数归一化（共同基期=100）", position: "right" });
    expect(option.xAxis).toMatchObject({ type: "time" });
    expect(option.xAxis).not.toHaveProperty("data");
    expect(option.series).toEqual([
      expect.objectContaining({
        name: "两市融资余额",
        yAxisIndex: 0,
        data: [
          ["2017-01-03", 182],
          ["2017-01-04", 180],
        ],
        connectNulls: false,
      }),
      expect.objectContaining({
        name: "上证指数 000001",
        yAxisIndex: 1,
        data: [
          ["2017-01-03", 100],
          ["2017-01-04", 99.66777409],
        ],
        connectNulls: false,
      }),
    ]);
  });

  it("未选指数时隐藏右轴；比例模式保持百分比单位", () => {
    const withoutIndices: DerivedSeries = { ...derived, indices: [], baseDate: null };
    const marginOption = buildLeverageChartOption({
      metric: "margin",
      derived: withoutIndices,
    });
    const ratioOption = buildLeverageChartOption({ metric: "ratio", derived: withoutIndices });

    expect(marginOption.yAxis).toHaveLength(1);
    expect(ratioOption.yAxis[0]).toMatchObject({ name: "沪深融资余额／沪深 A 股市值（%）" });
    expect(ratioOption.series[0]).toMatchObject({
      data: [
        ["2017-01-03", 182],
        ["2017-01-04", 180],
      ],
      yAxisIndex: 0,
    });
  });

  it("提示框同时展示主指标、原始收盘、归一化值与共同基期，缺失值显示 N/A", () => {
    const tooltip = formatLeverageTooltip({
      metric: "margin",
      derived: {
        ...derived,
        indices: [
          {
            code: "000001",
            points: [
              { date: "2017-01-03", rawClose: 3010, normalized: 100 },
              { date: "2017-01-04", rawClose: null, normalized: null },
            ],
          },
        ],
      },
      date: "2017-01-04",
    });

    expect(tooltip).toContain("两市融资余额：180.00 亿元");
    expect(tooltip).toContain("上证指数 000001：原始收盘 N/A；归一化 N/A");
    expect(tooltip).toContain("共同基期：2017-01-03 = 100");
  });
});
