import type { LeverageManifest, LeverageMetric, LeverageRecord } from "./types";

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
  return value === null || !Number.isFinite(value) ? "N/A" : numberFormatter.format(value);
}

function formatMetric(metric: LeverageMetric, value: number | null): string {
  const rendered = formatNumber(value);
  if (rendered === "N/A") {
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
    return "较前一可用日 N/A";
  }

  const delta = current - previous;
  const sign = delta > 0 ? "+" : "";
  if (metric === "ratio") {
    return `较前一可用日 ${sign}${numberFormatter.format(delta)} 个百分点`;
  }

  const relative = previous === 0 ? null : (delta / previous) * 100;
  return relative === null
    ? `较前一共同日 ${sign}${numberFormatter.format(delta)} 亿元`
    : `较前一共同日 ${sign}${numberFormatter.format(delta)} 亿元（${sign}${numberFormatter.format(relative)}%）`;
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
        <span>{metric === "margin" ? "两市融资余额" : "沪深融资余额／沪深 A 股市值"}</span>
        <strong>{formatMetric(metric, currentValue)}</strong>
        <small>{changeText(metric, currentValue, previousValue)}</small>
      </article>
      <article className="leverage-summary-card">
        <span>沪市融资余额</span>
        <strong>{formatMetric("margin", currentRecord?.sh_margin_yi ?? null)}</strong>
        <small>与深市按同一 DFCF 日期合计</small>
      </article>
      <article className="leverage-summary-card">
        <span>深市融资余额</span>
        <strong>{formatMetric("margin", currentRecord?.sz_margin_yi ?? null)}</strong>
        <small>DFCF 厂商口径／未经交易所复核</small>
      </article>
      <article className="leverage-summary-card leverage-summary-status">
        <span>共同数据截止日</span>
        <strong>{dataEndDate || "N/A"}</strong>
        <small>{dfcfAuditPass ? "DFCF 审计标记通过" : "DFCF 审计标记异常"}</small>
      </article>
    </section>
  );
}
