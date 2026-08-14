// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../LeverageDashboard", async () => {
  const { createElement } = await import("react");
  return {
    LeverageDashboard: () =>
      createElement("div", { "data-testid": "loaded-leverage-dashboard" }, "两融独立页面已加载"),
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
  document.body.innerHTML = "";
});

describe("独立页面导航", () => {
  it("/research 只呈现研究页，并提供三个真实页面链接", async () => {
    await renderAt("/research");

    expect(container.querySelector('[data-page="research"]')).not.toBeNull();
    expect(container.querySelector(".search-zone")).not.toBeNull();
    expect(container.querySelector(".methodology-section")).toBeNull();
    expect(container.querySelector('[data-testid="loaded-leverage-dashboard"]')).toBeNull();
    expect(navigationLink("研究").getAttribute("href")).toBe("/research");
    expect(navigationLink("两融").getAttribute("href")).toBe("/leverage");
    expect(navigationLink("方法论").getAttribute("href")).toBe("/methodology");
    expect(navigationLink("研究").getAttribute("aria-current")).toBe("page");
    expect(navigationLink("两融").hasAttribute("aria-current")).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("/leverage 只按需加载两融页面，不读取基金持仓数据", async () => {
    await renderAt("/leverage");

    expect(container.querySelector('[data-page="leverage"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="loaded-leverage-dashboard"]')).not.toBeNull();
    expect(container.querySelector(".search-zone")).toBeNull();
    expect(container.querySelector(".methodology-section")).toBeNull();
    expect(navigationLink("两融").getAttribute("aria-current")).toBe("page");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("/methodology 只呈现方法论页面，不读取基金持仓数据", async () => {
    await renderAt("/methodology");

    expect(container.querySelector('[data-page="methodology"]')).not.toBeNull();
    expect(container.querySelector(".methodology-section")).not.toBeNull();
    expect(container.querySelector(".search-zone")).toBeNull();
    expect(container.querySelector('[data-testid="loaded-leverage-dashboard"]')).toBeNull();
    expect(navigationLink("方法论").getAttribute("aria-current")).toBe("page");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("兼容旧 #leverage 书签并规范到 /leverage", async () => {
    await renderAt("/#leverage");

    expect(container.querySelector('[data-testid="loaded-leverage-dashboard"]')).not.toBeNull();
    expect(window.location.pathname).toBe("/leverage");
    expect(window.location.hash).toBe("");
  });
});
