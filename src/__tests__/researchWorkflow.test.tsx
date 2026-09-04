// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let allowSwitch = true;
const leaveGuard = vi.fn((action: () => void) => { if (allowSwitch) action(); });

vi.mock("../portfolio/PortfolioWorkbench", async () => {
  const { createElement, useEffect } = await import("react");
  return {
    PortfolioWorkbench: ({ temporarySelection, onLeaveGuard, onResearchContextChange }: {
      temporarySelection: { code: string } | null;
      onLeaveGuard: (guard: typeof leaveGuard) => void;
      onResearchContextChange: (context: { stockCodes: string[]; isTemporary: boolean; name: string }) => void;
    }) => {
      useEffect(() => onLeaveGuard(leaveGuard), [onLeaveGuard]);
      useEffect(() => {
        if (temporarySelection) onResearchContextChange({ stockCodes: [temporarySelection.code], isTemporary: true, name: "" });
      }, [temporarySelection, onResearchContextChange]);
      return createElement("div", { "data-testid": "accepted-research" }, temporarySelection?.code ?? "等待选择");
    },
  };
});

import { App } from "../App";

const stock = (code: string, name: string, offExchangeFundCount: number, aliases: string[] = []) => ({
  code, name, aliases, offExchangeFundCount, exchange: "NASDAQ", identityStatus: "verified",
  fundCount: 55, activeFundCount: 31, excludedIndexFundCount: 0, totalMarketValueWan: null,
  maxRatioPercent: 12, topByRatio: [], topByValue: [],
});
const payload = {
  meta: { report: "2026Q2", generatedAt: "2026-09-05", sourceRows: 2, stockCount: 2, cutoffDate: "2026-06-30" },
  stocks: [stock("NVDA", "英伟达", 39, ["NVDAUS", "NVDAUW", "NVDAUSEquity"]), stock("AMD", "超威半导体", 12)],
  popularStocks: [],
};
let root: Root;
let container: HTMLDivElement;
let fetchMock: ReturnType<typeof vi.fn>;

async function settle() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}
async function renderAt(path = "/research") {
  window.history.replaceState(null, "", path);
  await act(async () => root.render(<App />));
  await settle();
}
async function query(value: string) {
  const input = container.querySelector<HTMLInputElement>('[aria-label="搜索股票名称或代码"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  });
  return input;
}
async function chooseFirst() {
  await act(async () => container.querySelector<HTMLLIElement>('[role="option"]')!.click());
  await settle();
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  allowSwitch = true;
  leaveGuard.mockClear();
  document.body.innerHTML = '<div id="root"></div>';
  container = document.querySelector("#root")!;
  root = createRoot(container);
  fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(async () => {
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("研究入口与上下文", () => {
  it("已核实别名返回一个标准证券并显示与结果同口径的场外计数", async () => {
    await renderAt();
    await query("NVDA.UW");
    const options = container.querySelectorAll('[role="option"]');
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain("39 只场外基金");
    await chooseFirst();
    expect(container.querySelector('[data-testid="accepted-research"]')?.textContent).toBe("NVDA");
    expect(container.querySelector(".research-current-context")?.textContent).toContain("英伟达");
  });

  it("拒绝切换时顶部当前对象和工作台保留原研究", async () => {
    await renderAt("/research?stock=NVDA");
    allowSwitch = false;
    await query("AMD");
    await chooseFirst();
    expect(leaveGuard).toHaveBeenCalled();
    expect(container.querySelector('[data-testid="accepted-research"]')?.textContent).toBe("NVDA");
    expect(container.querySelector(".research-current-context")?.textContent).toContain("英伟达");
    expect(container.querySelector(".research-current-context")?.textContent).not.toContain("超威");
  });

  it("零匹配显示清空入口并保留当前研究", async () => {
    await renderAt("/research?stock=NVDA");
    await query("不存在的证券XYZ");
    expect(container.querySelector(".research-search-empty")?.textContent).toContain("未找到");
    expect(container.querySelector('[data-testid="accepted-research"]')?.textContent).toBe("NVDA");
    await act(async () => container.querySelector<HTMLButtonElement>(".research-search-empty button")!.click());
    expect(container.querySelector<HTMLInputElement>('[role="combobox"]')?.value).toBe("");
  });

  it("旧别名深链使用标准证券，工作台位于默认折叠的发现区之前", async () => {
    await renderAt("/research?stock=NVDAUSEquity");
    expect(container.querySelector('[data-testid="accepted-research"]')?.textContent).toBe("NVDA");
    const workspace = container.querySelector(".workspace")!;
    const discovery = container.querySelector<HTMLDetailsElement>(".research-discovery")!;
    expect(workspace.compareDocumentPosition(discovery) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(discovery.open).toBe(false);
  });

  it("主索引网络失败后可在页面内重新加载", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new Error("Failed to fetch"));
    await renderAt();
    const retry = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "重新加载")!;
    expect(retry).toBeTruthy();
    await act(async () => retry.click());
    await settle();
    expect(container.querySelector('[data-testid="accepted-research"]')).not.toBeNull();
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ cache: "reload" });
  });
});
