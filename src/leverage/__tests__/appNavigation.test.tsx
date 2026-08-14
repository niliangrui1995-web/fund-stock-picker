// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../LeverageDashboard", async () => {
  const { createElement } = await import("react");
  return {
    LeverageDashboard: () =>
      createElement("div", { "data-testid": "loaded-leverage-dashboard" }, "两融按需模块已加载"),
  };
});

import { App } from "../../App";

const fundPayload = {
  meta: {
    report: "2026Q2",
    generatedAt: "2026-08-14T00:00:00+08:00",
    sourceRows: 0,
    stockCount: 0,
    defaultRankingLabel: "占基金净值比例",
    alternateRankingLabel: "持仓市值",
    cutoffDate: "2026-06-30",
  },
  popularStocks: [],
  stocks: [],
};

let root: Root;
let container: HTMLDivElement;

async function flushReactWork() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

function navigationButton(label: string) {
  const button = Array.from(container.querySelectorAll(".topbar-nav button")).find(
    (element) => element.textContent === label,
  );
  if (button === undefined) {
    throw new Error(`未找到导航按钮：${label}`);
  }
  return button;
}

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  document.body.innerHTML = '<div id="test-root"></div>';
  container = document.querySelector("#test-root") as HTMLDivElement;
  root = createRoot(container);
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => fundPayload,
    }),
  );
});

afterEach(async () => {
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("页面栏目导航", () => {
  it("在研究后插入两融锚点，并在首次进入前仅显示本机入口卡", async () => {
    await act(async () => root.render(<App />));
    await flushReactWork();

    const markup = container.innerHTML;
    const researchPosition = markup.indexOf(">研究<");
    const leveragePosition = markup.indexOf(">两融<");
    const methodologyPosition = markup.indexOf(">方法论<");

    expect(researchPosition).toBeGreaterThanOrEqual(0);
    expect(leveragePosition).toBeGreaterThan(researchPosition);
    expect(methodologyPosition).toBeGreaterThan(leveragePosition);
    expect(markup.indexOf('id="leverage"')).toBeLessThan(markup.indexOf('id="methodology"'));
    expect(container.querySelector(".leverage-entry-card")).not.toBeNull();
    expect(container.querySelector("button.leverage-entry-card")?.textContent).toContain("打开两融市场观察");
    expect(container.querySelector('[data-testid="loaded-leverage-dashboard"]')).toBeNull();
  });

  it("点击入口卡后按需加载，并平滑滚动到两融锚点", async () => {
    await act(async () => root.render(<App />));
    await flushReactWork();

    const entryCard = container.querySelector("button.leverage-entry-card");
    expect(entryCard).not.toBeNull();
    await act(async () => {
      entryCard?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushReactWork();
    await flushReactWork();

    expect(container.querySelector('[data-testid="loaded-leverage-dashboard"]')).not.toBeNull();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
  });

  it("初始 #leverage 按需加载面板", async () => {
    window.history.replaceState(null, "", "/#leverage");

    await act(async () => root.render(<App />));
    await flushReactWork();
    await flushReactWork();

    expect(container.querySelector('[data-testid="loaded-leverage-dashboard"]')).not.toBeNull();
    expect(container.querySelector(".leverage-entry-card")).toBeNull();
  });

  it("点击两融后加载，离开后回访仍保留已加载实例", async () => {
    await act(async () => root.render(<App />));
    await flushReactWork();

    await act(async () => {
      navigationButton("两融").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushReactWork();
    await flushReactWork();
    expect(container.querySelector('[data-testid="loaded-leverage-dashboard"]')).not.toBeNull();

    await act(async () => {
      navigationButton("方法论").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushReactWork();
    expect(container.querySelector('[data-testid="loaded-leverage-dashboard"]')).not.toBeNull();

    await act(async () => {
      navigationButton("两融").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushReactWork();
    expect(container.querySelector('[data-testid="loaded-leverage-dashboard"]')).not.toBeNull();
  });
});
