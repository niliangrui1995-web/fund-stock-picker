import { describe, expect, it, vi } from "vitest";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import { DataZoomComponent, GridComponent, LegendComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

import { createLeverageChartLifecycle } from "../leverageChartLifecycle";

echarts.use([LineChart, DataZoomComponent, GridComponent, LegendComponent, SVGRenderer]);

function seriesOption(names: string[]): EChartsOption {
  return {
    xAxis: { type: "time" },
    yAxis: { type: "value" },
    legend: { data: names },
    dataZoom: [{ type: "inside" }],
    series: names.map((name, index) => ({
      type: "line",
      name,
      data: [["2020-01-01", index]],
    })),
  };
}

interface ResolvedChartOptionForTest {
  series: Array<{ name?: unknown }>;
  dataZoom: Array<{ start?: unknown; end?: unknown }>;
  legend: Array<{ selected?: Record<string, boolean> }>;
}

describe("leverage chart lifecycle", () => {
  it("只初始化一次，更新时以合并 setOption 保留缩放和图例交互，再在卸载时释放", () => {
    const setOption = vi.fn();
    const resize = vi.fn();
    const dispose = vi.fn();
    const createChart = vi.fn(() => ({ setOption, resize, dispose }));
    const lifecycle = createLeverageChartLifecycle(createChart);
    const element = {} as HTMLDivElement;

    lifecycle.attach(element);
    lifecycle.attach(element);
    lifecycle.update({ series: ["initial"] });
    lifecycle.update({ series: ["updated"] });
    lifecycle.resize();
    lifecycle.dispose();

    expect(createChart).toHaveBeenCalledTimes(1);
    expect(setOption).toHaveBeenNthCalledWith(1, { series: ["initial"] }, {
      notMerge: false,
      lazyUpdate: true,
      replaceMerge: ["series"],
    });
    expect(setOption).toHaveBeenNthCalledWith(2, { series: ["updated"] }, {
      notMerge: false,
      lazyUpdate: true,
      replaceMerge: ["series"],
    });
    expect(resize).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it("真实 ECharts 更新在取消指数后替换旧序列，而不残留已取消曲线", () => {
    const chart = echarts.init(null, undefined, {
      renderer: "svg",
      ssr: true,
      width: 320,
      height: 180,
    });
    const lifecycle = createLeverageChartLifecycle(() => ({
      setOption: (option, options) => chart.setOption(option as EChartsOption, options),
      resize: () => chart.resize(),
      dispose: () => chart.dispose(),
    }));

    lifecycle.attach({} as HTMLDivElement);
    lifecycle.update(seriesOption(["主指标", "000001", "399106", "399006"]));
    chart.dispatchAction({ type: "dataZoom", start: 23, end: 81 });
    chart.dispatchAction({ type: "legendUnSelect", name: "399006" });
    lifecycle.update(seriesOption(["主指标", "399006"]));

    const currentOption = chart.getOption() as unknown as ResolvedChartOptionForTest;
    expect(currentOption.series.map((series) => series.name)).toEqual([
      "主指标",
      "399006",
    ]);
    expect(currentOption.dataZoom.map((zoom) => [zoom.start, zoom.end])).toEqual([
      [23, 81],
    ]);
    expect(currentOption.legend[0]?.selected?.["399006"]).toBe(false);
    lifecycle.dispose();
  });
});
