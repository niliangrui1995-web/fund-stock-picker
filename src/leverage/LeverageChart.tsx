import { useEffect, useMemo, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

import type { DerivedSeries } from "./deriveLeverageSeries";
import {
  createLeverageChartLifecycle,
  type LeverageChartLifecycle,
} from "./leverageChartLifecycle";
import { buildLeverageChartOption } from "./leverageChartOption";
import type { LeverageMetric } from "./types";
import { ChartDataTable } from "../charts/ChartDataTable";
import { LEVERAGE_INDEX_COLORS, LEVERAGE_INDEX_LABELS, LEVERAGE_METRIC_LABELS } from "./leverageLabels";

echarts.use([
  LineChart,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

interface LeverageChartProps {
  metric: LeverageMetric;
  derived: DerivedSeries;
}

export function LeverageChart({ metric, derived }: LeverageChartProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const lifecycleRef = useRef<LeverageChartLifecycle | null>(null);
  const tableRows = useMemo(() => {
    const indexPoints = derived.indices.map((index) => new Map(index.points.map((point) => [point.date, point])));
    return derived.main.map((point) => ({
      date: point.date,
      values: [
        `${point.value.toFixed(2)}${metric === "margin" ? " 亿元" : "%"}`,
        ...indexPoints.flatMap((points) => {
          const indexPoint = points.get(point.date);
          return [
            indexPoint?.rawClose == null ? "暂无" : indexPoint.rawClose.toFixed(2),
            indexPoint?.normalized == null ? "暂无" : indexPoint.normalized.toFixed(2),
          ];
        }),
      ],
    }));
  }, [derived, metric]);

  useEffect(() => {
    const element = elementRef.current;
    if (element === null) {
      return undefined;
    }

    const lifecycle = createLeverageChartLifecycle((target) =>
      echarts.init(target, undefined, { renderer: "canvas" }),
    );
    lifecycleRef.current = lifecycle;
    lifecycle.attach(element);

    const resize = () => lifecycle.resize();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    observer?.observe(element);
    window.addEventListener("resize", resize);

    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      lifecycle.dispose();
      if (lifecycleRef.current === lifecycle) {
        lifecycleRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    lifecycleRef.current?.update(
      buildLeverageChartOption({ metric, derived }) as unknown as EChartsOption,
    );
  }, [derived, metric]);

  return (
    <div className="leverage-chart-wrap">
      <ul className="leverage-chart-legend" aria-label="当前显示曲线；可在上方对比指数中选择">
        <li><span aria-hidden="true" style={{ backgroundColor: "#e35d6a" }} />{LEVERAGE_METRIC_LABELS[metric]}</li>
        {derived.indices.map((index) => (
          <li key={index.code}>
            <span aria-hidden="true" style={{ backgroundColor: LEVERAGE_INDEX_COLORS[index.code] }} />
            {LEVERAGE_INDEX_LABELS[index.code]}
          </li>
        ))}
      </ul>
      <div
        ref={elementRef}
        className="leverage-chart-canvas"
        role="img"
        aria-label={`${LEVERAGE_METRIC_LABELS[metric]}与指数走势；历史数值可在下方数据表查询`}
      />
      {derived.main.length === 0 && (
        <div className="leverage-chart-empty" role="status">
          {derived.unavailableReason ?? "当前区间暂无数据。"}
        </div>
      )}
      {derived.unavailableIndexCodes.length > 0 && (
        <p className="leverage-chart-note">
          暂无指数数据：{derived.unavailableIndexCodes.join("、")}
        </p>
      )}
      {derived.unavailableReason !== null && derived.indices.length === 0 && derived.main.length > 0 && (
        <p className="leverage-chart-note">{derived.unavailableReason}</p>
      )}
      <ChartDataTable
        title={LEVERAGE_METRIC_LABELS[metric]}
        columns={[
          LEVERAGE_METRIC_LABELS[metric],
          ...derived.indices.flatMap((index) => [
            `${LEVERAGE_INDEX_LABELS[index.code]}收盘`,
            `${LEVERAGE_INDEX_LABELS[index.code]}对比值（${derived.baseDate ?? "暂无基准"} = 100）`,
          ]),
        ]}
        rows={tableRows}
      />
    </div>
  );
}
