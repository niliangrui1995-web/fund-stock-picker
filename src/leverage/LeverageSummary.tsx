import type { LeverageMetric, LeverageRecord } from "./types";
import { LEVERAGE_METRIC_LABELS } from "./leverageLabels";

interface LeverageSummaryProps {
  metric: LeverageMetric;
  currentRecord: LeverageRecord | null;
  previousRecord: LeverageRecord | null;
  ratioAvailable: boolean;
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

/**
 * 两融摘要卡组。
 *
 * 每张卡只承担一个互不重复的信息：
 *   1. 主卡——当前选中口径的数值 + 统计日 + 环比（原先与顶部「融资余额」KPI 卡重复，已合并为这一张）
 *   2. 沪市融资余额   3. 深市融资余额
 *   4. 另一口径（选中「融资余额」时给占市值比，反之给余额）
 *   5. 上证指数收盘价（图表中作为对比基准的指数，首屏给出读数便于对照）
 */
export function LeverageSummary({
  metric,
  currentRecord,
  previousRecord,
  ratioAvailable,
}: LeverageSummaryProps) {
  const currentValue = metricValue(currentRecord, metric);
  const previousValue = metricValue(previousRecord, metric);
  const otherMetric: LeverageMetric = metric === "margin" ? "ratio" : "margin";
  const otherValue = metricValue(currentRecord, otherMetric);
  const indexClose = currentRecord?.index_000001_close ?? null;

  return (
    <section className="leverage-summary-grid" aria-label="两融摘要">
      <article className="leverage-summary-card leverage-summary-primary">
        <span>{LEVERAGE_METRIC_LABELS[metric]}</span>
        <strong>{formatMetric(metric, currentValue)}</strong>
        <small>统计日：{currentRecord?.date ?? "暂无"}</small>
        <small>{changeText(metric, currentValue, previousValue)}</small>
      </article>
      <article className="leverage-summary-card">
        <span>沪市融资余额</span>
        <strong>{formatMetric("margin", currentRecord?.sh_margin_yi ?? null)}</strong>
        <small>沪市口径</small>
      </article>
      <article className="leverage-summary-card">
        <span>深市融资余额</span>
        <strong>{formatMetric("margin", currentRecord?.sz_margin_yi ?? null)}</strong>
        <small>深市口径</small>
      </article>
      <article className="leverage-summary-card">
        <span>{LEVERAGE_METRIC_LABELS[otherMetric]}</span>
        <strong>{formatMetric(otherMetric, otherValue)}</strong>
        <small>
          {otherMetric === "ratio"
            ? ratioAvailable
              ? "已校准口径"
              : "部分区间暂无"
            : "沪深两市合计"}
        </small>
      </article>
      <article className="leverage-summary-card">
        <span>上证指数</span>
        <strong>{indexClose === null ? "暂无" : numberFormatter.format(indexClose)}</strong>
        <small>收盘价{currentRecord ? ` · ${currentRecord.date}` : ""}</small>
      </article>
    </section>
  );
}
