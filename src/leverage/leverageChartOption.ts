import type { DerivedSeries } from "./deriveLeverageSeries";
import type { LeverageIndexCode, LeverageMetric } from "./types";

type TimeValue = [string, number | null];

export interface LeverageChartOption {
  animation: boolean;
  color: string[];
  grid: { left: number; right: number; top: number; bottom: number; containLabel: boolean };
  legend: { top: number; data: string[]; textStyle: { color: string } };
  tooltip: {
    trigger: "axis";
    axisPointer: { type: "cross"; label: { backgroundColor: string } };
    formatter: (params: unknown) => string;
  };
  xAxis: {
    type: "time";
    boundaryGap: false;
    axisLine: { lineStyle: { color: string } };
    axisLabel: {
      color: string;
      hideOverlap: boolean;
      formatter: (value: string | number) => string;
    };
  };
  yAxis: Array<{
    type: "value";
    name: string;
    position: "left" | "right";
    splitLine: { lineStyle: { color: string } };
    axisLine: { show: boolean; lineStyle: { color: string } };
    axisLabel: { color: string; formatter: (value: number) => string };
  }>;
  dataZoom: Array<{
    type: "inside" | "slider";
    filterMode: "none";
    height?: number;
    bottom?: number;
    borderColor?: string;
    fillerColor?: string;
  }>;
  series: Array<{
    type: "line";
    name: string;
    yAxisIndex: number;
    data: TimeValue[];
    showSymbol: false;
    connectNulls: false;
    sampling: "lttb";
    lineStyle: { width: number; type?: "solid" | "dashed" };
    emphasis: { focus: "series" };
  }>;
}

export interface LeverageTooltipRequest {
  metric: LeverageMetric;
  derived: DerivedSeries;
  date: string;
}

const INDEX_LABELS: Record<LeverageIndexCode, string> = {
  "000001": "上证指数 000001",
  "399106": "深证综指 399106",
  "399006": "创业板指 399006",
};

function metricLabel(metric: LeverageMetric): string {
  return metric === "margin" ? "两市融资余额" : "沪深融资余额／沪深 A 股市值";
}

function formatFixed(value: number | null, digits = 2): string {
  return value === null || !Number.isFinite(value) ? "N/A" : value.toFixed(digits);
}

function formatMainValue(metric: LeverageMetric, value: number | null): string {
  const rendered = formatFixed(value);
  if (rendered === "N/A") {
    return rendered;
  }

  return metric === "margin" ? `${rendered} 亿元` : `${rendered}%`;
}

function dateText(value: unknown): string | null {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  if (typeof value !== "number" && typeof value !== "string") {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${parsed.getFullYear()}-${month}-${day}`;
}

function axisTooltipDate(params: unknown): string | null {
  const candidates = Array.isArray(params) ? params : [params];
  for (const candidate of candidates) {
    if (typeof candidate !== "object" || candidate === null) {
      continue;
    }
    const item = candidate as Record<string, unknown>;
    const label = dateText(item.axisValueLabel) ?? dateText(item.axisValue);
    if (label !== null) {
      return label;
    }
  }
  return null;
}

export function formatLeverageTooltip({
  metric,
  derived,
  date,
}: LeverageTooltipRequest): string {
  const main = derived.main.find((point) => point.date === date);
  const lines = [
    `<strong>${date}</strong>`,
    `${metricLabel(metric)}：${formatMainValue(metric, main?.value ?? null)}`,
  ];

  for (const indexSeries of derived.indices) {
    const point = indexSeries.points.find((candidate) => candidate.date === date);
    lines.push(
      `${INDEX_LABELS[indexSeries.code]}：原始收盘 ${formatFixed(point?.rawClose ?? null)}；归一化 ${formatFixed(point?.normalized ?? null)}`,
    );
  }

  if (derived.baseDate !== null) {
    lines.push(`共同基期：${derived.baseDate} = 100`);
  }

  return lines.join("<br/>");
}

function numberAxisFormatter(metric: LeverageMetric): (value: number) => string {
  return (value) => {
    if (!Number.isFinite(value)) {
      return "N/A";
    }
    return metric === "margin" ? value.toFixed(0) : `${value.toFixed(1)}%`;
  };
}

function timeAxisFormatter(value: string | number): string {
  return dateText(value) ?? "";
}

export function buildLeverageChartOption({
  metric,
  derived,
}: {
  metric: LeverageMetric;
  derived: DerivedSeries;
}): LeverageChartOption {
  const mainName = metricLabel(metric);
  const series: LeverageChartOption["series"] = [
    {
      type: "line",
      name: mainName,
      yAxisIndex: 0,
      data: derived.main.map((point) => [point.date, point.value]),
      showSymbol: false,
      connectNulls: false,
      sampling: "lttb",
      lineStyle: { width: 2.6 },
      emphasis: { focus: "series" },
    },
  ];

  for (const indexSeries of derived.indices) {
    series.push({
      type: "line",
      name: INDEX_LABELS[indexSeries.code],
      yAxisIndex: 1,
      data: indexSeries.points.map((point) => [point.date, point.normalized]),
      showSymbol: false,
      connectNulls: false,
      sampling: "lttb",
      lineStyle: { width: 1.6, type: "dashed" },
      emphasis: { focus: "series" },
    });
  }

  const yAxis: LeverageChartOption["yAxis"] = [
    {
      type: "value",
      name: metric === "margin" ? "两市融资余额（亿元）" : "沪深融资余额／沪深 A 股市值（%）",
      position: "left",
      splitLine: { lineStyle: { color: "rgba(71, 85, 105, 0.12)" } },
      axisLine: { show: true, lineStyle: { color: "#64748b" } },
      axisLabel: { color: "#64748b", formatter: numberAxisFormatter(metric) },
    },
  ];

  if (derived.indices.length > 0) {
    yAxis.push({
      type: "value",
      name: "指数归一化（共同基期=100）",
      position: "right",
      splitLine: { lineStyle: { color: "transparent" } },
      axisLine: { show: true, lineStyle: { color: "#64748b" } },
      axisLabel: { color: "#64748b", formatter: (value) => value.toFixed(0) },
    });
  }

  return {
    animation: false,
    color: ["#e35d6a", "#4757c8", "#1c9f8a", "#d98633"],
    grid: { left: 18, right: 18, top: 50, bottom: 44, containLabel: true },
    legend: {
      top: 4,
      data: series.map((item) => item.name),
      textStyle: { color: "#475569" },
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross", label: { backgroundColor: "#243047" } },
      formatter: (params) => {
        const date = axisTooltipDate(params);
        return date === null ? "" : formatLeverageTooltip({ metric, derived, date });
      },
    },
    xAxis: {
      type: "time",
      boundaryGap: false,
      axisLine: { lineStyle: { color: "#cbd5e1" } },
      axisLabel: { color: "#64748b", hideOverlap: true, formatter: timeAxisFormatter },
    },
    yAxis,
    dataZoom: [
      { type: "inside", filterMode: "none" },
      {
        type: "slider",
        filterMode: "none",
        height: 16,
        bottom: 4,
        borderColor: "rgba(71, 85, 105, 0.18)",
        fillerColor: "rgba(71, 87, 200, 0.14)",
      },
    ],
    series,
  };
}
