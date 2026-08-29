// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../concentrationPackageLoader", () => ({
  loadConcentrationPackage: vi.fn(),
}));

import { TradingConcentrationDashboard } from "../TradingConcentrationDashboard";
import { loadConcentrationPackage } from "../concentrationPackageLoader";

let container: HTMLDivElement;
let root: Root;

async function renderDashboard() {
  await act(async () => {
    root.render(<TradingConcentrationDashboard />);
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.mocked(loadConcentrationPackage).mockReset();
  document.body.innerHTML = '<div id="test-root"></div>';
  container = document.querySelector("#test-root") as HTMLDivElement;
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  vi.clearAllMocks();
  document.body.innerHTML = "";
});

describe("TradingConcentrationDashboard 错误语义", () => {
  it.each([
    ["transport rejection", "网络连接失败。"],
    ["HTTP rejection", "交易集中度静态数据包不存在或无法读取。"],
    ["body read rejection", "交易集中度响应正文读取失败。"],
  ])("%s 显示数据读取失败及原始原因", async (_source, reason) => {
    vi.mocked(loadConcentrationPackage).mockRejectedValueOnce(new Error(reason));

    await renderDashboard();

    expect(container.querySelector("h2")?.textContent).toBe("数据读取失败");
    expect(container.querySelector("p")?.textContent).toBe(reason);
  });

  it("validator 返回失败时显示数据包未通过校验及校验原因", async () => {
    const reason = "交易集中度发布包 SHA-256 校验失败。";
    vi.mocked(loadConcentrationPackage).mockResolvedValueOnce({ ok: false, reason });

    await renderDashboard();

    expect(container.querySelector("h2")?.textContent).toBe("数据包未通过校验");
    expect(container.querySelector("p")?.textContent).toBe(reason);
  });
});
