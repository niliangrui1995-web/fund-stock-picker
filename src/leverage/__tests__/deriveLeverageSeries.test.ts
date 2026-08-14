import { describe, expect, it } from "vitest";

import type { LeverageIndexCode } from "../types";
import {
  fixtureRecords,
  fixtureRecordsWithDelayed399006,
  fixtureRecordsWithout399006,
} from "./fixtures";
import { deriveLeverageSeries } from "../deriveLeverageSeries";

describe("deriveLeverageSeries", () => {
  it("以所选范围第一个全部可用共同日归一化为 100，并对缺失收盘价断线", () => {
    const result = deriveLeverageSeries({
      records: fixtureRecords,
      metric: "margin",
      indexCodes: ["000001", "399006"],
      startDate: "2016-12-30",
      endDate: "2017-01-03",
    });

    expect(result.baseDate).toBe("2016-12-30");
    expect(result.main).toEqual([
      { date: "2016-12-30", value: 180 },
      { date: "2017-01-03", value: 182 },
    ]);
    expect(result.indices).toEqual([
      {
        code: "000001",
        points: [
          { date: "2016-12-30", rawClose: 3000, normalized: 100 },
          { date: "2017-01-03", rawClose: 3010, normalized: 100.33333333 },
        ],
      },
      {
        code: "399006",
        points: [
          { date: "2016-12-30", rawClose: 2000, normalized: 100 },
          { date: "2017-01-03", rawClose: null, normalized: null },
        ],
      },
    ]);
    expect(result.unavailableIndexCodes).toEqual([]);
    expect(result.unavailableReason).toBeNull();
  });

  it("比例只使用非空比例日期，2017 年前的融资余额不能替代比例", () => {
    const result = deriveLeverageSeries({
      records: fixtureRecords,
      metric: "ratio",
      indexCodes: ["000001"],
      startDate: "2016-12-30",
      endDate: "2017-01-03",
    });

    expect(result.main).toEqual([{ date: "2017-01-03", value: 1.51666667 }]);
    expect(result.baseDate).toBe("2017-01-03");
    expect(result.indices[0].points).toEqual([
      { date: "2017-01-03", rawClose: 3010, normalized: 100 },
    ]);
  });

  it("完全缺失的单个指数不会阻断其他可用指数", () => {
    const result = deriveLeverageSeries({
      records: fixtureRecordsWithout399006,
      metric: "margin",
      indexCodes: ["399006", "000001"],
      startDate: "2016-12-30",
      endDate: "2017-01-03",
    });

    expect(result.unavailableIndexCodes).toEqual(["399006"]);
    expect(result.indices.map((series) => series.code)).toEqual(["000001"]);
    expect(result.baseDate).toBe("2016-12-30");
    expect(result.unavailableReason).toBeNull();
  });

  it("所有已选指数都缺失时保留主指标并给出中文原因", () => {
    const result = deriveLeverageSeries({
      records: fixtureRecordsWithout399006,
      metric: "margin",
      indexCodes: ["399006"],
      startDate: "2016-12-30",
      endDate: "2017-01-03",
    });

    expect(result.main).toHaveLength(2);
    expect(result.indices).toEqual([]);
    expect(result.unavailableIndexCodes).toEqual(["399006"]);
    expect(result.baseDate).toBeNull();
    expect(result.unavailableReason).toBe("所选指数在当前范围没有可用数据。");
  });

  it("没有选择指数时正常返回主指标，不产生不可用原因", () => {
    const result = deriveLeverageSeries({
      records: fixtureRecords,
      metric: "margin",
      indexCodes: [],
      startDate: "2016-12-30",
      endDate: "2017-01-03",
    });

    expect(result.main).toHaveLength(2);
    expect(result.indices).toEqual([]);
    expect(result.unavailableIndexCodes).toEqual([]);
    expect(result.baseDate).toBeNull();
    expect(result.unavailableReason).toBeNull();
  });

  it("仅改变日期范围会改变基期，双指数首日缺失会延后至共同可用日", () => {
    const fullRange = deriveLeverageSeries({
      records: fixtureRecords,
      metric: "margin",
      indexCodes: ["000001"],
      startDate: "2016-12-30",
      endDate: "2017-01-03",
    });
    const narrowedRange = deriveLeverageSeries({
      records: fixtureRecords,
      metric: "margin",
      indexCodes: ["000001"],
      startDate: "2017-01-03",
      endDate: "2017-01-03",
    });
    const delayedCommonBase = deriveLeverageSeries({
      records: fixtureRecordsWithDelayed399006,
      metric: "margin",
      indexCodes: ["000001", "399006"],
      startDate: "2016-12-30",
      endDate: "2017-01-03",
    });

    expect(fullRange.baseDate).toBe("2016-12-30");
    expect(narrowedRange.baseDate).toBe("2017-01-03");
    expect(delayedCommonBase.baseDate).toBe("2017-01-03");
    expect(delayedCommonBase.indices[0].points[1].normalized).toBe(100);
    expect(delayedCommonBase.indices[1].points[1].normalized).toBe(100);
  });

  it("没有主指标记录时返回固定中文原因，不尝试填补比例", () => {
    const result = deriveLeverageSeries({
      records: fixtureRecords,
      metric: "ratio",
      indexCodes: ["000001"],
      startDate: "2016-12-30",
      endDate: "2016-12-30",
    });

    expect(result).toEqual({
      main: [],
      indices: [],
      unavailableIndexCodes: [],
      baseDate: null,
      unavailableReason: "所选时间范围没有可用的主指标数据。",
    });
  });

  it("不修改输入，并稳定忽略未知或重复的指数代码", () => {
    const request = {
      records: fixtureRecords.map((record) => ({ ...record })),
      metric: "margin" as const,
      indexCodes: ["000001", "000001", "unknown-index"] as unknown as LeverageIndexCode[],
      startDate: "2016-12-30",
      endDate: "2017-01-03",
    };
    const snapshot = JSON.parse(JSON.stringify(request));

    const result = deriveLeverageSeries(request);

    expect(request).toEqual(snapshot);
    expect(result.indices.map((series) => series.code)).toEqual(["000001"]);
    expect(result.unavailableIndexCodes).toEqual([]);
  });
});
