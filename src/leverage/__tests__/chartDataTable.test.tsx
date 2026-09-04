// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ChartDataTable } from "../../charts/ChartDataTable";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const rows = [
  { date: "2026-09-01", values: ["42.00%", "暂无"] },
  { date: "2026-09-03", values: ["43.00%", "2000.00"] },
];

beforeEach(async () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<ChartDataTable title="成交额" columns={["C5", "指数收盘"]} rows={rows} />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("图表逐日数据表", () => {
  it("使用原生日期、按钮与表头，按真实记录切换交易日并保留缺失值", async () => {
    const buttons = container.querySelectorAll("button");
    expect(container.querySelector("caption")?.textContent).toContain("2026-09-03");
    expect(container.querySelectorAll('th[scope="row"]')).toHaveLength(2);
    expect(buttons[1].disabled).toBe(true);
    await act(async () => buttons[0].click());
    expect(container.querySelector("caption")?.textContent).toContain("2026-09-01");
    expect(container.querySelector("tbody")?.textContent).toContain("暂无");
    expect(buttons[0].disabled).toBe(true);
    await act(async () => buttons[1].click());
    expect(container.querySelector("caption")?.textContent).toContain("2026-09-03");
  });

  it("定位没有记录的日期时明确提示，不插值伪造数据", async () => {
    const input = container.querySelector("input") as HTMLInputElement;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setValue.call(input, "2026-09-02");
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.querySelector("[role=status]")?.textContent).toContain("所选日期无记录");
    expect(container.querySelector("caption")?.textContent).toContain("2026-09-01");
    expect(container.querySelector("tbody")?.textContent).toContain("42.00%");
  });
});
