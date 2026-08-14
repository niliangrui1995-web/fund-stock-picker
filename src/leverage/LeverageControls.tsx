import type { ChangeEvent } from "react";

import type { LeverageDateRange, LeveragePeriod } from "./leverageDateRange";
import type { LeverageIndexCode, LeverageMetric } from "./types";

export type { LeveragePeriod } from "./leverageDateRange";

interface LeverageControlsProps {
  metric: LeverageMetric;
  ratioAvailable: boolean;
  ratioUnavailableReason: string | null;
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
  { code: "000001", label: "上证指数 000001" },
  { code: "399106", label: "深证综指 399106" },
  { code: "399006", label: "创业板指 399006" },
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
  ratioUnavailableReason,
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
    <section className="leverage-controls" aria-label="两融图表控制项">
      <div className="leverage-control-group leverage-control-metric">
        <span className="leverage-control-label">主指标</span>
        <div className="leverage-segmented-control" role="group" aria-label="主指标">
          <button
            type="button"
            className={metric === "margin" ? "is-active" : ""}
            aria-pressed={metric === "margin"}
            onClick={() => onMetricChange("margin")}
          >
            两市融资余额（亿元）
          </button>
          <button
            type="button"
            className={metric === "ratio" ? "is-active" : ""}
            aria-pressed={metric === "ratio"}
            disabled={!ratioAvailable}
            title={ratioAvailable ? undefined : ratioUnavailableReason ?? "比例数据暂不可用"}
            onClick={() => onMetricChange("ratio")}
          >
            沪深融资余额／沪深 A 股市值（%）
          </button>
        </div>
        {!ratioAvailable && (
          <p className="leverage-control-hint" role="status">
            比例暂不可用：{ratioUnavailableReason ?? "发布包未提供可用比例记录。"}
          </p>
        )}
      </div>

      <div className="leverage-control-group">
        <span className="leverage-control-label">叠加指数</span>
        <div className="leverage-index-toggle-group" role="group" aria-label="叠加指数">
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
                {unavailable && <small>当前范围 N/A</small>}
              </label>
            );
          })}
        </div>
      </div>

      <div className="leverage-control-group leverage-control-period">
        <span className="leverage-control-label">
          观察区间 {period === "custom" && <em>自定义区间</em>}
        </span>
        <div className="leverage-period-toggle-group" role="group" aria-label="观察区间">
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
            <span>起始</span>
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
            <span>截止</span>
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
        <p className="leverage-control-hint">
          手动日期会切换至自定义区间；点击预设会覆盖手动日期。
        </p>
      </div>
    </section>
  );
}
