// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LeverageMarketSummary } from "../LeverageMarketSummary";

let node: HTMLDivElement; let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  document.body.innerHTML = "<div></div>";
  node = document.querySelector("div")!;
  root = createRoot(node);
});
afterEach(async () => { await act(async () => root.unmount()); });
function loaded(records: Array<{ date: string; total_margin_yi: number; index_000001_close: number | null }>) {
  return { payload: { records } } as never;
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("LeverageMarketSummary", () => {
  it("加载期间与可用摘要分别呈现，并提供可访问的完整看板链接", async () => {
    let resolveLoad: ((value: ReturnType<typeof loaded>) => void) | undefined;
    const load = vi.fn(() => new Promise<ReturnType<typeof loaded>>((resolve) => { resolveLoad = resolve; }));
    await act(async () => { root.render(<LeverageMarketSummary load={load} />); });
    expect(node.textContent).toContain("正在加载市场环境摘要");
    expect(node.querySelector('[role="status"]')).not.toBeNull();

    await act(async () => { resolveLoad?.(loaded([
      { date: "2026-01-01", total_margin_yi: 100, index_000001_close: 3000 },
      { date: "2026-01-02", total_margin_yi: 110, index_000001_close: 3030 },
    ])); });
    await settle();

    expect(node.textContent).toContain("融资余额：100 → 110.00（10.00%）");
    expect(node.textContent).toContain("不证明其造成");
    const link = node.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/leverage");
    expect(link?.getAttribute("aria-label")).toBe("打开完整两融数据看板");
    expect(link?.className).toContain("leverage-market-summary-link");
  });

  it.each([
    ["验证失败", vi.fn().mockResolvedValue(null)],
    ["网络失败", vi.fn().mockRejectedValue(new Error("network"))],
    ["共同日不足", vi.fn().mockResolvedValue(loaded([{ date: "2026-01-01", total_margin_yi: 100, index_000001_close: 3000 }]))],
    ["零融资基期", vi.fn().mockResolvedValue(loaded([
      { date: "2026-01-01", total_margin_yi: 0, index_000001_close: 3000 },
      { date: "2026-01-02", total_margin_yi: 100, index_000001_close: 3030 },
    ]))],
  ])("%s 时非阻断地降级并保留完整看板入口", async (_caseName, load) => {
    await act(async () => { root.render(<LeverageMarketSummary load={load} />); });
    await settle();
    expect(node.textContent).toContain("市场环境摘要暂不可用");
    expect(node.querySelector("a")?.getAttribute("href")).toBe("/leverage");
  });

  it("卸载时取消请求，迟到响应不会提交状态", async () => {
    let resolveLoad: ((value: ReturnType<typeof loaded>) => void) | undefined;
    let signal: AbortSignal | undefined;
    const load = vi.fn((nextSignal: AbortSignal) => {
      signal = nextSignal;
      return new Promise<ReturnType<typeof loaded>>((resolve) => { resolveLoad = resolve; });
    });
    await act(async () => { root.render(<LeverageMarketSummary load={load} />); });
    await act(async () => { root.unmount(); });
    expect(signal?.aborted).toBe(true);
    await act(async () => { resolveLoad?.(loaded([
      { date: "2026-01-01", total_margin_yi: 100, index_000001_close: 3000 },
      { date: "2026-01-02", total_margin_yi: 110, index_000001_close: 3030 },
    ])); });
    expect(node.textContent).toBe("");
  });
});
