// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../LeverageDashboard", async () => {
  const { createElement } = await import("react");
  return {
    LeverageDashboard: () =>
      createElement("div", { "data-testid": "loaded-leverage-dashboard" }, "两融独立页面已加载"),
  };
});

vi.mock("../../concentration/TradingConcentrationDashboard", async () => {
  const { createElement } = await import("react");
  return {
    TradingConcentrationDashboard: () =>
      createElement("div", { "data-testid": "loaded-concentration-dashboard" }, "交易集中度独立页面已加载"),
  };
});

vi.mock("../LeverageMarketSummary", async () => {
  const { createElement } = await import("react");
  return {
    LeverageMarketSummary: () =>
      createElement("div", { "data-testid": "loaded-market-summary" }, "市场环境摘要已加载"),
  };
});

const portfolioLeaveGuard = vi.fn<(action: () => void, trigger: HTMLElement | null) => void>();
let renderReadyResults = false;

vi.mock("../../portfolio/PortfolioWorkbench", async () => {
  const { createElement, useEffect } = await import("react");
  return {
    PortfolioWorkbench: ({
      onLeaveGuard,
      afterResultsReady,
    }: {
      onLeaveGuard?: (guard: typeof portfolioLeaveGuard) => void;
      afterResultsReady?: ReactNode;
    }) => {
      useEffect(() => {
        onLeaveGuard?.(portfolioLeaveGuard);
      }, [onLeaveGuard]);
      return createElement(
        "div",
        { "data-testid": "portfolio-workbench" },
        "组合工作台",
        renderReadyResults ? afterResultsReady : null,
      );
    },
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

async function renderAt(path: string) {
  window.history.replaceState(null, "", path);
  await act(async () => root.render(<App />));
  await flushReactWork();
  await flushReactWork();
}

function navigationLink(label: string) {
  const link = Array.from(container.querySelectorAll<HTMLAnchorElement>(".topbar-nav a")).find(
    (element) => element.textContent === label,
  );
  if (link === undefined) {
    throw new Error(`未找到导航链接：${label}`);
  }
  return link;
}

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  document.body.innerHTML = '<div id="test-root"></div>';
  container = document.querySelector("#test-root") as HTMLDivElement;
  root = createRoot(container);
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
  portfolioLeaveGuard.mockReset();
  renderReadyResults = false;
  document.body.innerHTML = "";
});

describe("独立页面导航", () => {
  it("/research 只呈现研究页，并提供四个真实页面链接", async () => {
    await renderAt("/research");

    expect(container.querySelector('[data-page="research"]')).not.toBeNull();
    expect(container.querySelector(".search-zone")).not.toBeNull();
    expect(container.querySelector(".methodology-section")).toBeNull();
    expect(container.querySelector('[data-testid="loaded-leverage-dashboard"]')).toBeNull();
    expect(container.querySelector('[data-testid="loaded-concentration-dashboard"]')).toBeNull();
    expect(container.querySelector('[data-testid="loaded-market-summary"]')).toBeNull();
    expect(navigationLink("研究").getAttribute("href")).toBe("/research");
    expect(navigationLink("两融").getAttribute("href")).toBe("/leverage");
    expect(navigationLink("交易集中度").getAttribute("href")).toBe("/concentration");
    expect(navigationLink("方法论").getAttribute("href")).toBe("/methodology");
    expect(navigationLink("研究").getAttribute("aria-current")).toBe("page");
    expect(navigationLink("两融").hasAttribute("aria-current")).toBe(false);
    expect(navigationLink("交易集中度").hasAttribute("aria-current")).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("研究页仅在组合结果 ready 槽位中加载市场环境摘要", async () => {
    renderReadyResults = true;
    await renderAt("/research");

    expect(container.querySelector('[data-testid="portfolio-workbench"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="loaded-market-summary"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="loaded-leverage-dashboard"]')).toBeNull();
    expect(container.querySelector('[data-testid="loaded-concentration-dashboard"]')).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("/leverage 只按需加载两融页面，不读取基金持仓数据", async () => {
    await renderAt("/leverage");

    expect(container.querySelector('[data-page="leverage"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="loaded-leverage-dashboard"]')).not.toBeNull();
    expect(container.querySelector(".search-zone")).toBeNull();
    expect(container.querySelector(".methodology-section")).toBeNull();
    expect(container.querySelector('[data-testid="loaded-market-summary"]')).toBeNull();
    expect(container.querySelector('[data-testid="loaded-concentration-dashboard"]')).toBeNull();
    expect(navigationLink("两融").getAttribute("aria-current")).toBe("page");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("/concentration 只按需加载交易集中度页面，不读取基金持仓数据", async () => {
    await renderAt("/concentration");

    expect(container.querySelector('[data-page="concentration"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="loaded-concentration-dashboard"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="loaded-leverage-dashboard"]')).toBeNull();
    expect(container.querySelector(".search-zone")).toBeNull();
    expect(container.querySelector(".methodology-section")).toBeNull();
    expect(navigationLink("交易集中度").getAttribute("aria-current")).toBe("page");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("/methodology 只呈现方法论页面，不读取基金持仓数据", async () => {
    await renderAt("/methodology");

    expect(container.querySelector('[data-page="methodology"]')).not.toBeNull();
    expect(container.querySelector(".methodology-section")).not.toBeNull();
    expect(container.querySelector(".search-zone")).toBeNull();
    expect(container.querySelector('[data-testid="loaded-leverage-dashboard"]')).toBeNull();
    expect(container.querySelector('[data-testid="loaded-concentration-dashboard"]')).toBeNull();
    expect(navigationLink("方法论").getAttribute("aria-current")).toBe("page");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("兼容旧 #leverage 书签并规范到 /leverage", async () => {
    await renderAt("/#leverage");

    expect(container.querySelector('[data-testid="loaded-leverage-dashboard"]')).not.toBeNull();
    expect(window.location.pathname).toBe("/leverage");
    expect(window.location.hash).toBe("");
  });

  it("研究页有未保存组合时，顶部导航会先交给组合离开保护", async () => {
    await renderAt("/research");

    const leverageLink = navigationLink("两融");
    await act(async () => {
      leverageLink.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(portfolioLeaveGuard).toHaveBeenCalledTimes(1);
    expect(portfolioLeaveGuard.mock.calls[0]?.[0]).toBeTypeOf("function");
    expect(portfolioLeaveGuard.mock.calls[0]?.[1]).toBe(leverageLink);
  });

  it("研究页查询参数变更为默认研究 URL 时也会先交给组合离开保护", async () => {
    await renderAt("/research?stock=NVDA");

    const researchLink = navigationLink("研究");
    await act(async () => {
      researchLink.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });

    expect(portfolioLeaveGuard).toHaveBeenCalledTimes(1);
    expect(portfolioLeaveGuard.mock.calls[0]?.[1]).toBe(researchLink);
  });
});
