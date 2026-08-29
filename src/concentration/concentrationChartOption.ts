import type { EChartsOption } from "echarts";

import type { ConcentrationRecord } from "./types";

type TimeValue = [string, number | null];

export interface ChinextComparisonSeries {
  baseDate: string | null;
  baseClose: number | null;
  data: TimeValue[];
}

export function buildChinextComparisonSeries(records: ConcentrationRecord[]): ChinextComparisonSeries {
  const baseRecord = records.find((record) => record.chinext_close !== null);
  if (!baseRecord || baseRecord.chinext_close === null) {
    return {
      baseDate: null,
      baseClose: null,
      data: records.map((record) => [record.date, null]),
    };
  }
  const baseClose = baseRecord.chinext_close;
  return {
    baseDate: baseRecord.date,
    baseClose,
    data: records.map((record) => [
      record.date,
      record.chinext_close === null ? null : (record.chinext_close / baseClose) * 100,
    ]),
  };
}

function dateFromTooltipParams(params: unknown): string | null {
  const candidates = Array.isArray(params) ? params : [params];
  for (const candidate of candidates) {
    if (typeof candidate !== "object" || candidate === null) {
      continue;
    }
    const item = candidate as Record<string, unknown>;
    if (typeof item.axisValueLabel === "string" && /^\d{4}-\d{2}-\d{2}/.test(item.axisValueLabel)) {
      return item.axisValueLabel.slice(0, 10);
    }
    if (typeof item.axisValue === "string" && /^\d{4}-\d{2}-\d{2}/.test(item.axisValue)) {
      return item.axisValue.slice(0, 10);
    }
  }
  return null;
}

function tooltipText(
  recordsByDate: Map<string, ConcentrationRecord>,
  comparison: ChinextComparisonSeries,
  params: unknown,
): string {
  const date = dateFromTooltipParams(params);
  const record = date === null ? undefined : recordsByDate.get(date);
  if (!record) {
    return "";
  }
  const scope = record.numerator_scope === "sh_sz_bj_active_a" ? "沪深北" : "沪深";
  const comparisonClose = record.chinext_close;
  const comparisonValue =
    comparisonClose === null || comparison.baseClose === null
      ? null
      : (comparisonClose / comparison.baseClose) * 100;
  return [
    `<strong>${record.date}</strong>`,
    `前 5% 成交额占比：${record.c5_pct.toFixed(2)}%`,
    `创业板指：收盘 ${comparisonClose === null ? "暂无" : comparisonClose.toFixed(2)}；对比值 ${comparisonValue === null ? "暂无" : comparisonValue.toFixed(2)}`,
    `对比基准：${comparison.baseDate === null ? "暂无" : `${comparison.baseDate} = 100`}`,
    `前 5% 成交额：${record.top5_amount_yi.toFixed(0)} 亿元`,
    `市场成交额：${record.market_amount_yi.toFixed(0)} 亿元`,
    `成交活跃 A 股：${record.active_stock_count.toLocaleString("zh-CN")} 只`,
    `统计范围：${scope}（前 ${record.top5_stock_count.toLocaleString("zh-CN")} 只）`,
  ].join("<br/>");
}

export function buildConcentrationChartOption(records: ConcentrationRecord[]): EChartsOption {
  const recordsByDate = new Map(records.map((record) => [record.date, record]));
  const comparison = buildChinextComparisonSeries(records);
  return {
    animation: false,
    color: ["#cb5d32", "#3f6fbb"],
    legend: {
      top: 10,
      left: 18,
      itemWidth: 16,
      itemHeight: 3,
      textStyle: { color: "#526178", fontSize: 11 },
    },
    grid: { left: 18, right: 18, top: 52, bottom: 46, containLabel: true },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross", label: { backgroundColor: "#253247" } },
      formatter: (params: unknown) => tooltipText(recordsByDate, comparison, params),
    },
    xAxis: {
      type: "time",
      boundaryGap: false,
      axisLine: { lineStyle: { color: "#cbd5e1" } },
      axisLabel: { color: "#64748b", hideOverlap: true },
    },
    yAxis: [
      {
        type: "value",
        name: "C5（%）",
        position: "left",
        min: (value: { min: number }) => Math.max(0, Math.floor(value.min - 2)),
        splitLine: { lineStyle: { color: "rgba(71, 85, 105, 0.12)" } },
        axisLine: { show: true, lineStyle: { color: "#64748b" } },
        axisLabel: { color: "#64748b", formatter: (value: number) => `${value.toFixed(0)}%` },
      },
      {
        type: "value",
        name: "创业板指（基准=100）",
        position: "right",
        splitLine: { show: false },
        axisLine: { show: true, lineStyle: { color: "#64748b" } },
        axisLabel: { color: "#64748b", formatter: (value: number) => value.toFixed(0) },
      },
    ],
    dataZoom: [
      { type: "inside", filterMode: "none" },
      {
        type: "slider",
        filterMode: "none",
        height: 16,
        bottom: 4,
        borderColor: "rgba(71, 85, 105, 0.18)",
        fillerColor: "rgba(203, 93, 50, 0.16)",
      },
    ],
    series: [
      {
        type: "line",
        name: "C5",
        data: records.map((record) => [record.date, record.c5_pct]),
        yAxisIndex: 0,
        showSymbol: false,
        connectNulls: false,
        sampling: "lttb",
        lineStyle: { width: 2.7 },
        areaStyle: { color: "rgba(203, 93, 50, 0.08)" },
        emphasis: { focus: "series" },
        markLine: {
          symbol: "none",
          silent: true,
          lineStyle: { color: "rgba(71, 85, 105, 0.42)", type: "dashed" },
          label: { color: "#64748b", fontSize: 10 },
          data: [
            { xAxis: "2016-01-26", label: { formatter: "分母切换" } },
            { xAxis: "2022-08-02", label: { formatter: "北交所纳入" } },
          ],
        },
      },
      {
        type: "line",
        name: "创业板指",
        data: comparison.data,
        yAxisIndex: 1,
        showSymbol: false,
        connectNulls: false,
        sampling: "lttb",
        lineStyle: { width: 2.1 },
        emphasis: { focus: "series" },
      },
    ],
  } as unknown as EChartsOption;
}
