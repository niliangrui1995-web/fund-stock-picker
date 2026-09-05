// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as echarts from "echarts/core";
import { SVGRenderer } from "echarts/renderers";

import { TradingConcentrationChart } from "../TradingConcentrationChart";
import type { ConcentrationRecord } from "../types";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("echarts/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("echarts/core")>();
  return {
    ...actual,
    init: vi.fn(() => actual.init(null, undefined, { renderer: "svg", ssr: true, width: 600, height: 300 })),
  };
});

echarts.use([SVGRenderer]);

const records: ConcentrationRecord[] = Array.from({ length: 10 }, (_, index) => ({
  date: `2026-08-${String(index + 10).padStart(2, "0")}`,
  chinext_close: 2000 + index * 10,
  c5_pct: 40 + index,
  top5_amount_yi: 40 + index,
  market_amount_yi: 100,
  active_stock_count: 20,
  top5_stock_count: 1,
  denominator_source: "sh880008",
  numerator_scope: "sh_sz_bj_active_a",
}));

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

it("勾选曲线保留真实 ECharts 缩放，数据区间变化才重置缩放并保留曲线选择", async () => {
  await act(async () => root.render(<TradingConcentrationChart records={records} />));
  const chart = vi.mocked(echarts.init).mock.results[0].value as echarts.ECharts;
  const zoomRange = () => (chart.getOption().dataZoom as Array<{ start: number; end: number }>)
    .map((zoom) => [zoom.start, zoom.end]);
  const selected = () => (chart.getOption().legend as Array<{ selected: Record<string, boolean> }>)[0].selected;
  const chinextToggle = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1];

  chart.dispatchAction({ type: "dataZoom", start: 40, end: 70 });
  await act(async () => chinextToggle.click());
  expect(selected()["创业板指"]).toBe(false);
  expect(zoomRange()).toEqual([[40, 70], [40, 70]]);

  await act(async () => chinextToggle.click());
  expect(selected()["创业板指"]).toBe(true);
  expect(zoomRange()).toEqual([[40, 70], [40, 70]]);

  await act(async () => chinextToggle.click());
  await act(async () => root.render(<TradingConcentrationChart records={records.slice(-5)} />));
  expect(zoomRange()).toEqual([[0, 100], [0, 100]]);
  expect(selected()["创业板指"]).toBe(false);
  expect(echarts.init).toHaveBeenCalledTimes(1);
});
