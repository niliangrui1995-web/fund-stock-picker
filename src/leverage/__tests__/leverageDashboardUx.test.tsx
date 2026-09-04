// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LeverageDashboard } from "../LeverageDashboard";
import { loadLeveragePackage } from "../leveragePackageLoader";
import { makeValidManifestText, makeValidPayloadText } from "./fixtures";

vi.mock("../leveragePackageLoader", () => ({ loadLeveragePackage: vi.fn() }));
vi.mock("../LeverageChart", () => ({ LeverageChart: () => <div data-testid="chart" /> }));
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const payloadText = makeValidPayloadText();
const success = { ok: true as const, payload: JSON.parse(payloadText), manifest: JSON.parse(makeValidManifestText(payloadText)) };

beforeEach(() => {
  vi.mocked(loadLeveragePackage).mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("两融摘要和恢复流程", () => {
  it("校验失败先阻断，用户重新加载后校验成功才展示图表", async () => {
    vi.mocked(loadLeveragePackage).mockResolvedValueOnce({ ok: false, reason: "发布包 SHA-256 校验失败。" }).mockResolvedValueOnce(success);
    await act(async () => root.render(<LeverageDashboard />));
    expect(container.textContent).toContain("数据包未通过校验");
    expect(container.querySelector('[data-testid="chart"]')).toBeNull();
    await act(async () => container.querySelector<HTMLButtonElement>(".dashboard-retry-button")!.click());
    expect(loadLeveragePackage).toHaveBeenCalledTimes(2);
    expect(container.querySelector('[data-testid="chart"]')).not.toBeNull();
    expect(container.textContent).not.toContain("校验失败");
  });

  it("历史结束日改变统计日和数值，数据包最新交易日保持独立", async () => {
    vi.mocked(loadLeveragePackage).mockResolvedValueOnce(success);
    await act(async () => root.render(<LeverageDashboard />));
    const endDate = container.querySelectorAll<HTMLInputElement>('.leverage-date-range input')[1];
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setValue.call(endDate, "2016-12-30");
      endDate.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(container.querySelector(".leverage-summary-primary")?.textContent).toContain("180.00 亿元");
    expect(container.querySelector(".leverage-summary-primary")?.textContent).toContain("统计日：2016-12-30");
    expect(container.querySelector(".leverage-package-date")?.textContent).toContain("最新交易日：2017-01-03");
    expect(container.querySelector(".leverage-disclosure-essential")?.closest("details")).toBeNull();
  });
});
