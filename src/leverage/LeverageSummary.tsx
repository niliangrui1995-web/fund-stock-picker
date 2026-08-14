import type { LeverageManifest, LeverageMetric, LeverageRecord } from "./types";
import { LEVERAGE_METRIC_LABELS } from "./leverageLabels";

interface LeverageSummaryProps {
  metric: LeverageMetric;
  currentRecord: LeverageRecord | null;
  previousRecord: LeverageRecord | null;
  dataEndDate: string;
  manifest: LeverageManifest;
}

const numberFormatter = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatNumber(value: number | null): string {
  return value === null || !Number.isFinite(value) ? "暂无" : numberFormatter.format(value);
}

function formatMetric(metric: LeverageMetric, value: number | null): string {
  const rendered = formatNumber(value);
  if (rendered === "暂无") {
    return rendered;
  }
  return metric === "margin" ? `${rendered} 亿元` : `${rendered}%`;
}

function metricValue(record: LeverageRecord | null, metric: LeverageMetric): number | null {
  if (record === null) {
    return null;
  }
  return metric === "margin" ? record.total_margin_yi : record.ratio_pct;
}

function changeText(
  metric: LeverageMetric,
  current: number | null,
  previous: number | null,
): string {
  if (current === null || previous === null) {
    return "暂无对比";
  }

  const delta = current - previous;
  const sign = delta > 0 ? "+" : "";
  if (metric === "ratio") {
    return `较上次数据 ${sign}${numberFormatter.format(delta)} 个百分点`;
  }

  const relative = previous === 0 ? null : (delta / previous) * 100;
  return relative === null
    ? `较上次数据 ${sign}${numberFormatter.format(delta)} 亿元`
    : `较上次数据 ${sign}${numberFormatter.format(delta)} 亿元（${sign}${numberFormatter.format(relative)}%）`;
}

export function LeverageSummary({
  metric,
  currentRecord,
  previousRecord,
  dataEndDate,
  manifest,
}: LeverageSummaryProps) {
  const currentValue = metricValue(currentRecord, metric);
  const previousValue = metricValue(previousRecord, metric);
  const dfcfAuditPass = manifest.dfcf.dfcf_only && manifest.dfcf.exchange_requests === 0;

  return (
    <section className="leverage-summary-grid" aria-label="两融摘要">
      <article className="leverage-summary-card leverage-summary-primary">
        <span>{LEVERAGE_METRIC_LABELS[metric]}</span>
        <strong>{formatMetric(metric, currentValue)}</strong>
        <small>{changeText(metric, currentValue, previousValue)}</small>
      </article>
      <article className="leverage-summary-card">
        <span>沪市</span>
        <strong>{formatMetric("margin", currentRecord?.sh_margin_yi ?? null)}</strong>
        <small>融资余额</small>
      </article>
      <article className="leverage-summary-card">
        <span>深市</span>
        <strong>{formatMetric("margin", currentRecord?.sz_margin_yi ?? null)}</strong>
        <small>融资余额</small>
      </article>
      <article className="leverage-summary-card leverage-summary-status">
        <span>数据更新至</span>
        <strong>{dataEndDate || "暂无"}</strong>
        <small>{dfcfAuditPass ? "数据已更新" : "待确认"}</small>
      </article>
    </section>
  );
}
