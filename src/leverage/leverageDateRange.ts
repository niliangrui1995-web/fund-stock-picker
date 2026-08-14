import type { LeverageRecord } from "./types";

export type LeveragePeriod = "1y" | "3y" | "5y" | "10y" | "all" | "custom";

export interface LeverageDateRange {
  startDate: string;
  endDate: string;
}

interface ResolveLeverageDateRangeRequest {
  records: LeverageRecord[];
  period: LeveragePeriod;
  customRange: LeverageDateRange | null;
}

function isDateRange(value: LeverageDateRange | null): value is LeverageDateRange {
  return value !== null && value.startDate <= value.endDate;
}

function startDateForPeriod(
  records: LeverageRecord[],
  period: Exclude<LeveragePeriod, "custom">,
): string | null {
  const first = records[0];
  const last = records[records.length - 1];
  if (first === undefined || last === undefined || period === "all") {
    return first?.date ?? null;
  }

  const years = Number.parseInt(period, 10);
  const targetDate = new Date(`${last.date}T00:00:00Z`);
  targetDate.setUTCFullYear(targetDate.getUTCFullYear() - years);
  const target = targetDate.toISOString().slice(0, 10);
  return records.find((record) => record.date >= target)?.date ?? first.date;
}

export function resolveLeverageDateRange({
  records,
  period,
  customRange,
}: ResolveLeverageDateRangeRequest): LeverageDateRange | null {
  const last = records[records.length - 1];
  if (last === undefined) {
    return null;
  }

  if (period === "custom") {
    return isDateRange(customRange) ? customRange : null;
  }

  const startDate = startDateForPeriod(records, period);
  return startDate === null ? null : { startDate, endDate: last.date };
}
