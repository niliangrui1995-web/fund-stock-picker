export interface LeverageChartAdapter {
  setOption(
    option: unknown,
    options: {
      notMerge: boolean;
      lazyUpdate: boolean;
      replaceMerge: ["series", "yAxis"];
    },
  ): void;
  resize(): void;
  dispose(): void;
}

export interface LeverageChartLifecycle {
  attach(element: HTMLDivElement): LeverageChartAdapter;
  update(option: unknown): void;
  resize(): void;
  dispose(): void;
}

export function createLeverageChartLifecycle(
  createChart: (element: HTMLDivElement) => LeverageChartAdapter,
): LeverageChartLifecycle {
  let chart: LeverageChartAdapter | null = null;

  return {
    attach(element) {
      if (chart === null) {
        chart = createChart(element);
      }
      return chart;
    },
    update(option) {
      chart?.setOption(option, {
        notMerge: false,
        lazyUpdate: true,
        replaceMerge: ["series", "yAxis"],
      });
    },
    resize() {
      chart?.resize();
    },
    dispose() {
      const activeChart = chart;
      chart = null;
      activeChart?.dispose();
    },
  };
}
