import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

import { buildChinextComparisonSeries, buildConcentrationChartOption } from "./concentrationChartOption";
import type { AiChainSeries, ConcentrationRecord } from "./types";
import { ChartDataTable } from "../charts/ChartDataTable";

echarts.use([
  LineChart,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
  CanvasRenderer,
]);

export function TradingConcentrationChart({
  records,
  aiChainSeries,
}: {
  records: ConcentrationRecord[];
  aiChainSeries?: AiChainSeries;
}) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const [hiddenSeries, setHiddenSeries] = useState<string[]>([]);
  const series = [
    { name: "C5", color: "#cb5d32" },
    { name: "创业板指", color: "#3f6fbb" },
    ...(aiChainSeries ? [{ name: aiChainSeries.name, color: "#16836f" }] : []),
  ];
  const tableData = useMemo(() => {
    const comparison = buildChinextComparisonSeries(records);
    const aiByDate = new Map(aiChainSeries?.records.map((record) => [record.date, record]));
    return {
      baseDate: comparison.baseDate,
      rows: records.map((record, index) => {
        const ai = aiByDate.get(record.date);
        return {
          date: record.date,
          values: [
            `${record.c5_pct.toFixed(2)}%`,
            `${record.top5_amount_yi.toFixed(2)} 亿元`,
            `${record.market_amount_yi.toFixed(2)} 亿元`,
            `${record.active_stock_count.toLocaleString("zh-CN")} 只`,
            `${record.top5_stock_count.toLocaleString("zh-CN")} 只`,
            record.chinext_close === null ? "暂无" : record.chinext_close.toFixed(2),
            comparison.data[index][1]?.toFixed(2) ?? "暂无",
            ...(aiChainSeries ? [
              ai?.ai_chain_amount_pct == null ? "暂无" : `${ai.ai_chain_amount_pct.toFixed(2)}%`,
              ai?.ai_chain_amount_yi == null ? "暂无" : `${ai.ai_chain_amount_yi.toFixed(2)} 亿元`,
              ai ? `${ai.ai_chain_active_stock_count.toLocaleString("zh-CN")} 只` : "暂无",
            ] : []),
          ],
        };
      }),
    };
  }, [aiChainSeries, records]);

  useEffect(() => {
    const element = elementRef.current;
    if (element === null) {
      return undefined;
    }
    const chart = echarts.init(element, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    const resize = () => chart.resize();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    observer?.observe(element);
    window.addEventListener("resize", resize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      chart.dispose();
      if (chartRef.current === chart) {
        chartRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const option = buildConcentrationChartOption(records, aiChainSeries);
    chartRef.current?.setOption({
      ...option,
      legend: { show: false, selected: Object.fromEntries(series.map((item) => [item.name, !hiddenSeries.includes(item.name)])) },
    }, {
      notMerge: true,
      lazyUpdate: true,
    });
  }, [aiChainSeries, records, hiddenSeries]);

  return (
    <div className="concentration-chart-wrap">
      <fieldset className="concentration-series-controls">
        <legend>显示曲线</legend>
        {series.map((item) => {
          const checked = !hiddenSeries.includes(item.name);
          const isLastVisible = checked && series.filter((candidate) => !hiddenSeries.includes(candidate.name)).length === 1;
          return (
            <label key={item.name}>
              <input
                type="checkbox"
                checked={checked}
                disabled={isLastVisible}
                onChange={() => setHiddenSeries((hidden) => checked ? [...hidden, item.name] : hidden.filter((name) => name !== item.name))}
              />
              <span aria-hidden="true" style={{ backgroundColor: item.color }} />
              {item.name}
            </label>
          );
        })}
      </fieldset>
      <div
        ref={elementRef}
        className="concentration-chart-canvas"
        role="img"
        aria-label={aiChainSeries
          ? "C5、AI产业链成交额占比与创业板指趋势图；历史数值可在下方数据表查询"
          : "成交活跃 A 股前百分之五个股成交额占比与创业板指双轴趋势图；历史数值可在下方数据表查询"}
      />
      <ChartDataTable
        title="交易集中度"
        columns={[
          "C5", "前 5% 个股成交额", "全A等权成交额（AMOUNT）", "成交活跃 A 股", "前 5% 个股数量", "创业板指收盘",
          `创业板指对比值（${tableData.baseDate ?? "暂无基准"} = 100）`,
          ...(aiChainSeries ? [aiChainSeries.name, "AI 产业链成交额", "AI 产业链活跃成分"] : []),
        ]}
        rows={tableData.rows}
      />
    </div>
  );
}
