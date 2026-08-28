import { describe, expect, it } from "vitest";

import { deriveMarketComparison } from "../deriveTwentyDayComparison";
import type { LeverageRecord } from "../types";

function record(day: number, margin = 100 + day, index = 3000 + day): LeverageRecord {
  return { date: `2026-01-${String(day).padStart(2, "0")}`, sh_margin_yi: 0, sz_margin_yi: 0, total_margin_yi: margin, denominator_market_cap_yi: null, market_cap_source: null, market_cap_review_status: null, ratio_pct: null, index_000001_close: index, index_399106_close: null, index_399006_close: null };
}

describe("deriveMarketComparison", () => {
  it("保留最后二十个共同交易日且不改变输入", () => {
    const records = Array.from({ length: 23 }, (_, index) => record(index + 1));
    records[22] = { ...records[22], index_000001_close: null };
    const snapshot = JSON.stringify(records);
    const result = deriveMarketComparison(records);
    expect(result.kind).toBe("available");
    if (result.kind === "available") {
      expect(result.commonDayCount).toBe(20);
      expect(result.startDate).toBe("2026-01-03");
      expect(result.endDate).toBe("2026-01-22");
      expect(result.marginStartNormalized).toBe(100);
      expect(result.indexStartNormalized).toBe(100);
    }
    expect(JSON.stringify(records)).toBe(snapshot);
  });

  it("2–19 天可用，少于两天、负值和零融资基期不可用", () => {
    expect(deriveMarketComparison([record(1), record(2)]).kind).toBe("available");
    expect(deriveMarketComparison([record(1)]).kind).toBe("unavailable");
    expect(deriveMarketComparison([record(1, -1), record(2)]).kind).toBe("unavailable");
    expect(deriveMarketComparison([record(1, 0), record(2)]).kind).toBe("unavailable");
  });

  it("过滤无效共同日后保留 2–19 日的实际区间", () => {
    const result = deriveMarketComparison([
      record(1, 100, 3000),
      { ...record(2, 110, 0), index_000001_close: 0 },
      { ...record(3, Number.POSITIVE_INFINITY, 3060), total_margin_yi: Number.POSITIVE_INFINITY },
      record(4, 120, 3120),
    ]);

    expect(result).toMatchObject({
      kind: "available",
      startDate: "2026-01-01",
      endDate: "2026-01-04",
      commonDayCount: 2,
      marginEndNormalized: 120,
      indexEndNormalized: 104,
      marginChangePercent: 20,
      indexChangePercent: 4,
      differencePercentagePoints: 16,
    });
  });

  it("不会把无效指数、NaN 或仅一个有效共同日伪装为可用比较", () => {
    expect(
      deriveMarketComparison([
        { ...record(1), index_000001_close: null },
        { ...record(2, Number.NaN, 3100), total_margin_yi: Number.NaN },
        record(3, 130, 3200),
      ]),
    ).toMatchObject({ kind: "unavailable" });
  });

  it("输入有限但归一化溢出时关闭摘要，而不输出 Infinity", () => {
    const result = deriveMarketComparison([
      record(1, Number.MIN_VALUE, 3000),
      record(2, Number.MAX_VALUE, 3030),
    ]);

    expect(result).toMatchObject({ kind: "unavailable" });
  });
});
