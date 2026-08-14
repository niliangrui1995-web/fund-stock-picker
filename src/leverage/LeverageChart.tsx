import { useEffect, useRef } from "react";
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
      <div
        ref={elementRef}
        className="leverage-chart-canvas"
        role="img"
        aria-label="融资余额与指数走势"
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
    </div>
  );
}
