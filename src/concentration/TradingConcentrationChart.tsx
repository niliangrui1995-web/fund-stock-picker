import { useEffect, useRef } from "react";
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

import { buildConcentrationChartOption } from "./concentrationChartOption";
import type { AiChainSeries, ConcentrationRecord } from "./types";

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
    chartRef.current?.setOption(buildConcentrationChartOption(records, aiChainSeries), {
      notMerge: true,
      lazyUpdate: true,
    });
  }, [aiChainSeries, records]);

  return (
    <div className="concentration-chart-wrap">
      <div
        ref={elementRef}
        className="concentration-chart-canvas"
        role="img"
        aria-label={aiChainSeries
          ? "C5、AI产业链成交额占比与创业板指趋势图"
          : "成交活跃 A 股前百分之五个股成交额占比与创业板指双轴趋势图"}
      />
    </div>
  );
}
