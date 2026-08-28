import type { LeverageRecord } from "./types";

export interface AvailableMarketComparison {
  kind: "available";
  startDate: string;
  endDate: string;
  commonDayCount: number;
  marginStartNormalized: 100;
  marginEndNormalized: number;
  indexStartNormalized: 100;
  indexEndNormalized: number;
  marginChangePercent: number;
  indexChangePercent: number;
  differencePercentagePoints: number;
}

export type MarketComparison =
  | { kind: "unavailable"; reason: string }
  | AvailableMarketComparison;

export function deriveMarketComparison(records: readonly LeverageRecord[]): MarketComparison {
  const common = records.filter((record) => Number.isFinite(record.total_margin_yi) && record.total_margin_yi >= 0 && typeof record.index_000001_close === "number" && Number.isFinite(record.index_000001_close) && record.index_000001_close > 0);
  if (common.length < 2) return { kind: "unavailable", reason: "共同可用交易日不足 2 天。" };
  const selected = common.slice(-20);
  const first = selected[0];
  const last = selected[selected.length - 1];
  if (first.total_margin_yi === 0) return { kind: "unavailable", reason: "区间首日融资余额为 0，无法归一化比较。" };
  const indexStart = first.index_000001_close as number;
  const marginEndNormalized = last.total_margin_yi / first.total_margin_yi * 100;
  const indexEndNormalized = (last.index_000001_close as number) / indexStart * 100;
  const marginChangePercent = marginEndNormalized - 100;
  const indexChangePercent = indexEndNormalized - 100;
  const differencePercentagePoints = marginChangePercent - indexChangePercent;
  if (
    ![
      marginEndNormalized,
      indexEndNormalized,
      marginChangePercent,
      indexChangePercent,
      differencePercentagePoints,
    ].every(Number.isFinite)
  ) {
    return { kind: "unavailable", reason: "归一化计算结果不是有限数值。" };
  }
  return { kind: "available", startDate: first.date, endDate: last.date, commonDayCount: selected.length, marginStartNormalized: 100, marginEndNormalized, indexStartNormalized: 100, indexEndNormalized, marginChangePercent, indexChangePercent, differencePercentagePoints };
}
