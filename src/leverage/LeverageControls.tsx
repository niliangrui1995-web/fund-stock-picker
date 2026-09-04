import type { ChangeEvent } from "react";

import type { LeverageDateRange, LeveragePeriod } from "./leverageDateRange";
import { LEVERAGE_INDEX_LABELS, LEVERAGE_METRIC_LABELS } from "./leverageLabels";
import type { LeverageIndexCode, LeverageMetric } from "./types";

export type { LeveragePeriod } from "./leverageDateRange";

interface LeverageControlsProps {
  metric: LeverageMetric;
  ratioAvailable: boolean;
  indexCodes: LeverageIndexCode[];
  unavailableIndexCodes: LeverageIndexCode[];
  period: LeveragePeriod;
  startDate: string;
  endDate: string;
  minDate: string;
  maxDate: string;
  onMetricChange: (metric: LeverageMetric) => void;
  onIndexCodesChange: (indexCodes: LeverageIndexCode[]) => void;
  onPeriodChange: (period: Exclude<LeveragePeriod, "custom">) => void;
  onDateRangeChange: (range: LeverageDateRange) => void;
}

const INDEX_OPTIONS: Array<{ code: LeverageIndexCode; label: string }> = [
  { code: "000001", label: LEVERAGE_INDEX_LABELS["000001"] },
  { code: "399106", label: LEVERAGE_INDEX_LABELS["399106"] },
  { code: "399006", label: LEVERAGE_INDEX_LABELS["399006"] },
];

const PERIOD_OPTIONS: Array<{
  value: Exclude<LeveragePeriod, "custom">;
  label: string;
}> = [
  { value: "1y", label: "近 1 年" },
  { value: "3y", label: "近 3 年" },
  { value: "5y", label: "近 5 年" },
  { value: "10y", label: "近 10 年" },
  { value: "all", label: "全部" },
];

function toggleIndexCode(
  selected: LeverageIndexCode[],
  code: LeverageIndexCode,
): LeverageIndexCode[] {
  return selected.includes(code)
    ? selected.filter((candidate) => candidate !== code)
    : [...selected, code];
}

function nextDateRange(
  field: "startDate" | "endDate",
  event: ChangeEvent<HTMLInputElement>,
  startDate: string,
  endDate: string,
): LeverageDateRange {
  const nextValue = event.target.value;
  return field === "startDate"
    ? { startDate: nextValue || startDate, endDate }
    : { startDate, endDate: nextValue || endDate };
}

export function LeverageControls({
  metric,
  ratioAvailable,
  indexCodes,
  unavailableIndexCodes,
  period,
  startDate,
  endDate,
  minDate,
  maxDate,
  onMetricChange,
  onIndexCodesChange,
  onPeriodChange,
  onDateRangeChange,
}: LeverageControlsProps) {
  return (
    <section className="leverage-controls" aria-label="两融图表设置">
      <div className="leverage-control-group leverage-control-metric">
        <span className="leverage-control-label">查看</span>
        <div className="leverage-segmented-control" role="group" aria-label="查看指标">
          <button
            type="button"
            className={metric === "margin" ? "is-active" : ""}
            aria-pressed={metric === "margin"}
            onClick={() => onMetricChange("margin")}
          >
            {LEVERAGE_METRIC_LABELS.margin}
          </button>
          <button
            type="button"
            className={metric === "ratio" ? "is-active" : ""}
            aria-pressed={metric === "ratio"}
            disabled={!ratioAvailable}
            title={ratioAvailable ? undefined : "暂无可用比例数据"}
            onClick={() => onMetricChange("ratio")}
          >
            {LEVERAGE_METRIC_LABELS.ratio}
          </button>
        </div>
        {!ratioAvailable && (
          <p className="leverage-control-hint" role="status">
            暂无可用比例数据
          </p>
        )}
      </div>

      <div className="leverage-control-group">
        <span className="leverage-control-label">对比指数</span>
        <div className="leverage-index-toggle-group" role="group" aria-label="对比指数">
          {INDEX_OPTIONS.map((option) => {
            const selected = indexCodes.includes(option.code);
            const unavailable = unavailableIndexCodes.includes(option.code);
            return (
              <label
                key={option.code}
                className={`leverage-index-toggle ${selected ? "is-active" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onIndexCodesChange(toggleIndexCode(indexCodes, option.code))}
                />
                <span className="leverage-toggle-mark" aria-hidden="true" />
                <span>{option.label}</span>
                {unavailable && <small>暂无数据</small>}
              </label>
            );
          })}
        </div>
      </div>

      <div className="leverage-control-group leverage-control-period">
        <span className="leverage-control-label">
          时间范围 {period === "custom" && <em>自定义</em>}
        </span>
        <div className="leverage-period-toggle-group" role="group" aria-label="时间范围">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={period === option.value ? "is-active" : ""}
              aria-pressed={period === option.value}
              onClick={() => onPeriodChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="leverage-date-range" aria-label="手动日期范围">
          <label>
            <span>从</span>
            <input
              type="date"
              value={startDate}
              min={minDate}
              max={endDate || maxDate}
              onChange={(event) =>
                onDateRangeChange(nextDateRange("startDate", event, startDate, endDate))
              }
            />
          </label>
          <span className="leverage-date-separator" aria-hidden="true">至</span>
          <label>
            <span>到</span>
            <input
              type="date"
              value={endDate}
              min={startDate || minDate}
              max={maxDate}
              onChange={(event) =>
                onDateRangeChange(nextDateRange("endDate", event, startDate, endDate))
              }
            />
          </label>
        </div>
      </div>
    </section>
  );
}
