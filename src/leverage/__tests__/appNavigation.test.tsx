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

function installFeedbackTurnstile() {
  const challengeCallbacks: Array<(token: string) => void> = [];
  const render = vi.fn((
    _container: HTMLElement,
    options: { callback: (token: string) => void },
  ) => {
    challengeCallbacks.push(options.callback);
    return `feedback-widget-${challengeCallbacks.length}`;
  });
  vi.stubGlobal("turnstile", {
    render,
    reset: () => undefined,
    remove: () => undefined,
  });
  return {
    render,
    completeLatest(token = "test-feedback-token") {
      const completeChallenge = challengeCallbacks[challengeCallbacks.length - 1];
      if (completeChallenge === undefined) throw new Error("Turnstile 尚未渲染");
      completeChallenge(token);
    },
  };
}

async function openFeedbackDialog(
  turnstile: ReturnType<typeof installFeedbackTurnstile>,
  { completeChallenge = true } = {},
) {
  const trigger = container.querySelector<HTMLButtonElement>('[aria-label="打开意见反馈"]');
  if (trigger === null) throw new Error("缺少意见反馈入口");
  await act(async () => trigger.click());
  await flushReactWork();
  if (completeChallenge) {
    await act(async () => turnstile.completeLatest());
  }
}

async function setFormControlValue(control: HTMLInputElement | HTMLTextAreaElement, value: string) {
  await act(async () => {
    const prototype = control instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(control, value);
    control.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function submitFeedback() {
  const contact = container.querySelector<HTMLInputElement>('.feedback-form input[required]');
  const message = container.querySelector<HTMLTextAreaElement>('.feedback-form textarea[required]');
  const form = container.querySelector<HTMLFormElement>(".feedback-form");
  if (contact === null || message === null || form === null) throw new Error("反馈表单不完整");
  await setFormControlValue(contact, "reader@example.com");
  await setFormControlValue(message, "测试反馈内容");
  await act(async () => form.requestSubmit());
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
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
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

  it("成功反馈关闭后重新打开会创建新的 Turnstile 并允许再次提交", async () => {
    const turnstile = installFeedbackTurnstile();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    }));
    await renderAt("/methodology");
    await openFeedbackDialog(turnstile);
    await submitFeedback();
    await flushReactWork();

    expect(container.querySelector(".feedback-success")).not.toBeNull();
    const done = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent === "完成",
    );
    if (done === undefined) throw new Error("缺少反馈完成按钮");
    await act(async () => done.click());

    await openFeedbackDialog(turnstile, { completeChallenge: false });
    expect(container.querySelector(".feedback-success")).toBeNull();
    expect(container.querySelector<HTMLInputElement>('.feedback-form input[required]')?.value).toBe("");
    expect(container.querySelector<HTMLTextAreaElement>('.feedback-form textarea[required]')?.value).toBe("");
    expect(turnstile.render).toHaveBeenCalledTimes(2);
    const submit = container.querySelector<HTMLButtonElement>(".feedback-submit");
    expect(submit?.disabled).toBe(true);

    await act(async () => turnstile.completeLatest("second-feedback-token"));
    expect(submit?.disabled).toBe(false);
    await submitFeedback();
    await flushReactWork();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(container.querySelector(".feedback-success")).not.toBeNull();
  });

  it.each(["Escape", "关闭按钮", "遮罩"] as const)(
    "反馈提交期间可通过 %s 关闭并取消请求",
    async (closeMethod) => {
      const turnstile = installFeedbackTurnstile();
      let requestSignal: AbortSignal | undefined;
      vi.stubGlobal("fetch", vi.fn((_url: string, options?: RequestInit) => new Promise((_resolve, reject) => {
        requestSignal = options?.signal ?? undefined;
        requestSignal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      })));
      await renderAt("/methodology");
      await openFeedbackDialog(turnstile);
      await submitFeedback();

      await act(async () => {
        if (closeMethod === "Escape") {
          document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
          return;
        }
        const selector = closeMethod === "关闭按钮"
          ? '.feedback-dialog [aria-label="关闭意见反馈"]'
          : ".feedback-backdrop";
        const close = container.querySelector<HTMLButtonElement>(selector);
        if (close === null) throw new Error(`缺少反馈${closeMethod}`);
        close.click();
      });

      expect(container.querySelector('[role="dialog"][aria-labelledby="feedback-title"]')).toBeNull();
      expect(requestSignal).toBeInstanceOf(AbortSignal);
      expect(requestSignal?.aborted).toBe(true);
    },
  );

  it("关闭提交中的反馈后，旧请求完成不会覆盖重新打开的会话", async () => {
    const turnstile = installFeedbackTurnstile();
    const requests: Array<{
      signal: AbortSignal | undefined;
      resolve: (response: { ok: boolean; json(): Promise<{ ok: boolean }> }) => void;
    }> = [];
    vi.stubGlobal("fetch", vi.fn((_url: string, options?: RequestInit) => new Promise((resolve) => {
      requests.push({ signal: options?.signal ?? undefined, resolve });
    })));
    await renderAt("/methodology");
    await openFeedbackDialog(turnstile);
    await submitFeedback();

    const close = container.querySelector<HTMLButtonElement>('.feedback-dialog [aria-label="关闭意见反馈"]');
    if (close === null) throw new Error("缺少反馈关闭按钮");
    await act(async () => close.click());
    expect(requests[0]?.signal?.aborted).toBe(true);

    await openFeedbackDialog(turnstile);
    await submitFeedback();
    expect(requests).toHaveLength(2);

    await act(async () => requests[0]?.resolve({ ok: true, json: async () => ({ ok: true }) }));
    await flushReactWork();
    expect(container.querySelector(".feedback-success")).toBeNull();
    expect(container.querySelector(".feedback-form")).not.toBeNull();

    await act(async () => requests[1]?.resolve({ ok: true, json: async () => ({ ok: true }) }));
    await flushReactWork();
    expect(container.querySelector(".feedback-success")).not.toBeNull();
  });
});
