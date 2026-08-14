import type {
  LeverageIndexCode,
  LeverageMetric,
  LeverageRecord,
} from "./types";

export interface DeriveRequest {
  records: LeverageRecord[];
  metric: LeverageMetric;
  indexCodes: LeverageIndexCode[];
  startDate: string;
  endDate: string;
}

export interface DerivedSeries {
  main: Array<{ date: string; value: number }>;
  indices: Array<{
    code: LeverageIndexCode;
    points: Array<{
      date: string;
      rawClose: number | null;
      normalized: number | null;
    }>;
  }>;
  unavailableIndexCodes: LeverageIndexCode[];
  baseDate: string | null;
  unavailableReason: string | null;
}

const INDEX_CODES: LeverageIndexCode[] = ["000001", "399106", "399006"];

const INDEX_CLOSE_FIELDS: Record<
  LeverageIndexCode,
  "index_000001_close" | "index_399106_close" | "index_399006_close"
> = {
  "000001": "index_000001_close",
  "399106": "index_399106_close",
  "399006": "index_399006_close",
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isKnownIndexCode(value: unknown): value is LeverageIndexCode {
  return typeof value === "string" && INDEX_CODES.includes(value as LeverageIndexCode);
}

function selectedIndexCodes(indexCodes: LeverageIndexCode[]): LeverageIndexCode[] {
  const selected: LeverageIndexCode[] = [];
  const seen = new Set<LeverageIndexCode>();

  for (const code of indexCodes) {
    if (!isKnownIndexCode(code) || seen.has(code)) {
      continue;
    }

    seen.add(code);
    selected.push(code);
  }

  return selected;
}

function closeFor(record: LeverageRecord, code: LeverageIndexCode): number | null {
  return record[INDEX_CLOSE_FIELDS[code]];
}

function inRequestedDateRange(record: LeverageRecord, request: DeriveRequest): boolean {
  return record.date >= request.startDate && record.date <= request.endDate;
}

function valueForMetric(record: LeverageRecord, metric: LeverageMetric): number | null {
  if (metric === "margin") {
    return isFiniteNumber(record.total_margin_yi) ? record.total_margin_yi : null;
  }

  return isFiniteNumber(record.ratio_pct) ? record.ratio_pct : null;
}

function normalize(rawClose: number, baseClose: number): number {
  return Number(((rawClose / baseClose) * 100).toFixed(8));
}

export function deriveLeverageSeries(request: DeriveRequest): DerivedSeries {
  const mainRecords = request.records.filter(
    (record) =>
      inRequestedDateRange(record, request) &&
      valueForMetric(record, request.metric) !== null,
  );
  const main = mainRecords.map((record) => ({
    date: record.date,
    value: valueForMetric(record, request.metric) as number,
  }));

  if (main.length === 0) {
    return {
      main: [],
      indices: [],
      unavailableIndexCodes: [],
      baseDate: null,
      unavailableReason: "所选时间范围没有可用的主指标数据。",
    };
  }

  const requestedIndexCodes = selectedIndexCodes(request.indexCodes);
  if (requestedIndexCodes.length === 0) {
    return {
      main,
      indices: [],
      unavailableIndexCodes: [],
      baseDate: null,
      unavailableReason: null,
    };
  }

  const unavailableIndexCodes = requestedIndexCodes.filter(
    (code) => !mainRecords.some((record) => isFiniteNumber(closeFor(record, code))),
  );
  const availableIndexCodes = requestedIndexCodes.filter(
    (code) => !unavailableIndexCodes.includes(code),
  );

  if (availableIndexCodes.length === 0) {
    return {
      main,
      indices: [],
      unavailableIndexCodes,
      baseDate: null,
      unavailableReason: "所选指数在当前范围没有可用数据。",
    };
  }

  let baseRecord: LeverageRecord | null = null;
  for (const record of mainRecords) {
    const isCommonPositiveCloseDate = availableIndexCodes.every((code) => {
      const close = closeFor(record, code);
      return isFiniteNumber(close) && close > 0;
    });

    if (
      isCommonPositiveCloseDate &&
      (baseRecord === null || record.date < baseRecord.date)
    ) {
      baseRecord = record;
    }
  }

  if (baseRecord === null) {
    return {
      main,
      indices: [],
      unavailableIndexCodes,
      baseDate: null,
      unavailableReason: "所选指数暂无可比数据。",
    };
  }

  const baseCloses = new Map<LeverageIndexCode, number>();
  for (const code of availableIndexCodes) {
    baseCloses.set(code, closeFor(baseRecord, code) as number);
  }

  return {
    main,
    indices: availableIndexCodes.map((code) => {
      const baseClose = baseCloses.get(code) as number;

      return {
        code,
        points: mainRecords.map((record) => {
          const close = closeFor(record, code);
          const rawClose = isFiniteNumber(close) ? close : null;

          return {
            date: record.date,
            rawClose,
            normalized: rawClose === null ? null : normalize(rawClose, baseClose),
          };
        }),
      };
    }),
    unavailableIndexCodes,
    baseDate: baseRecord.date,
    unavailableReason: null,
  };
}
