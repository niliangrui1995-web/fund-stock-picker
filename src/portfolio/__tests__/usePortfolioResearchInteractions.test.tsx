// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PORTFOLIO_STORAGE_KEY } from "../portfolioStorage";
import { usePortfolioResearch, type PortfolioResearchModel } from "../usePortfolioResearch";
import { savedBasket } from "./fixtures";

vi.mock("../portfolioIndex", () => ({
  loadPortfolioIndex: vi.fn(() => new Promise(() => {})),
  loadPortfolioFundDetails: vi.fn(),
}));

const stocks = [
  { code: "NVDA", name: "英伟达" },
  { code: "TSM", name: "台积电" },
  { code: "MSFT", name: "微软" },
];
type Selection = { code: string; requestId: number; trigger: HTMLElement | null };
let current: PortfolioResearchModel;
let container: HTMLDivElement;
let root: Root;

function Probe({ selection }: { selection?: Selection }) {
  current = usePortfolioResearch({ stocks, manifestUrl: "/portfolio.json", temporarySelection: selection });
  return <p>{current.draft.stockCodes.join(",")}</p>;
}

async function render(selection?: Selection) {
  await act(async () => root.render(<Probe selection={selection} />));
}

function temporary(code: string, requestId = 1): Selection {
  return { code, requestId, trigger: null };
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  window.localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("单股查询与组合编辑的模型边界", () => {
  it("连续临时单股查询无需保存，不写存储或阻断离开", async () => {
    const write = vi.spyOn(Storage.prototype, "setItem");
    await render(temporary("NVDA"));
    await render(temporary("TSM", 2));
    await render(temporary("NVDA", 3));
    expect(current.draft.stockCodes).toEqual(["NVDA"]);
    expect(current.isTemporary).toBe(true);
    expect(current.dirty).toBe(false);
    expect(current.pendingAction).toBeNull();
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
    const leave = vi.fn();
    await act(async () => current.requestLeave(leave, null));
    expect(leave).toHaveBeenCalledOnce();
    expect(write).not.toHaveBeenCalled();
  });

  it("首次从空草稿添加股票获得短默认名，可直接保存且不覆盖重名组合", async () => {
    const existing = [
      savedBasket({ id: "original-1", name: "英伟达组合", stockCodes: ["TSM"] }),
      savedBasket({ id: "original-2", name: "英伟达组合（2）", stockCodes: ["MSFT"] }),
    ];
    window.localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, activeBasketId: null, baskets: existing }));
    await render();
    await act(async () => current.addStock("NVDA"));
    expect(current.draft.name).toContain("英伟达");
    expect(current.draft.name.length).toBeLessThanOrEqual(40);
    expect(existing.some((basket) => basket.name === current.draft.name)).toBe(false);
    expect(current.isTemporary).toBe(false);
    expect(current.dirty).toBe(true);
    let saved = false;
    await act(async () => { saved = current.saveActive(); });
    expect(saved).toBe(true);
    const store = JSON.parse(window.localStorage.getItem(PORTFOLIO_STORAGE_KEY)!);
    expect(store.baskets).toHaveLength(3);
    expect(store.baskets.slice(0, 2)).toEqual(existing);
    expect(store.baskets[2].stockCodes).toEqual(["NVDA"]);
    expect(current.dirty).toBe(false);
  });

  it.each([
    ["添加股票", (model: PortfolioResearchModel) => model.addStock("TSM")],
    ["删除股票", (model: PortfolioResearchModel) => model.removeStock("NVDA")],
    ["重命名", (model: PortfolioResearchModel) => model.renameActive("芯片观察")],
  ] as const)("%s 后退出临时语义，取消离开仍保留真实修改", async (_label, edit) => {
    await render(temporary("NVDA"));
    await act(async () => edit(current));
    expect(current.isTemporary).toBe(false);
    expect(current.dirty).toBe(true);
    const edited = { name: current.draft.name, stockCodes: [...current.draft.stockCodes] };
    const leave = vi.fn();
    await act(async () => current.requestLeave(leave, null));
    expect(current.pendingAction?.kind).toBe("leave");
    expect(leave).not.toHaveBeenCalled();
    await act(async () => current.resolveUnsavedDecision("cancel"));
    expect(current.pendingAction).toBeNull();
    expect(current.draft).toEqual(edited);
    expect(current.dirty).toBe(true);
    expect(window.localStorage.getItem(PORTFOLIO_STORAGE_KEY)).toBeNull();
  });

  it("临时单股转多股使用可保存默认名，新单股请求先保护组合且取消不丢内容", async () => {
    await render(temporary("NVDA"));
    await act(async () => current.addStock("TSM"));
    expect(current.draft.name).not.toBe("临时研究");
    expect(current.draft.name).toContain("英伟达");
    await render(temporary("MSFT", 2));
    expect(current.pendingAction?.kind).toBe("temporary");
    expect(current.draft.stockCodes).toEqual(["NVDA", "TSM"]);
    await act(async () => current.resolveUnsavedDecision("cancel"));
    expect(current.draft.stockCodes).toEqual(["NVDA", "TSM"]);
    await act(async () => current.removeStock("TSM"));
    expect(current.isTemporary).toBe(false);
    let saved = false;
    await act(async () => { saved = current.saveActive(); });
    expect(saved).toBe(true);
    expect(current.baskets[0].stockCodes).toEqual(["NVDA"]);
  });

  it("无效添加和未改变内容的操作不会把单股查询变成脏组合", async () => {
    await render(temporary("NVDA"));
    await act(async () => current.addStock("NVDA"));
    await act(async () => current.addStock("UNKNOWN"));
    await act(async () => current.removeStock("TSM"));
    await act(async () => current.renameActive(current.draft.name));
    expect(current.draft.stockCodes).toEqual(["NVDA"]);
    expect(current.isTemporary).toBe(true);
    expect(current.dirty).toBe(false);
  });

  it("自定义名称在继续增删股票后保留，保存失败不会执行待离开动作", async () => {
    await render(temporary("NVDA"));
    await act(async () => current.renameActive("我的芯片观察"));
    await act(async () => current.addStock("TSM"));
    await act(async () => current.removeStock("NVDA"));
    expect(current.draft.name).toBe("我的芯片观察");
    const leave = vi.fn();
    await act(async () => current.requestLeave(leave, null));
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota exceeded"); });
    await act(async () => current.resolveUnsavedDecision("save"));
    expect(current.pendingAction?.kind).toBe("leave");
    expect(current.dirty).toBe(true);
    expect(current.draft.stockCodes).toEqual(["TSM"]);
    expect(current.saveError).not.toBeNull();
    expect(leave).not.toHaveBeenCalled();
    write.mockRestore();
    await act(async () => current.resolveUnsavedDecision("save"));
    expect(leave).toHaveBeenCalledOnce();
    expect(current.baskets[0].name).toBe("我的芯片观察");
    expect(current.pendingAction).toBeNull();
    expect(current.dirty).toBe(false);
  });
});


describe("多个页面保存组合", () => {
  it("较早打开的页面不能覆盖另一页面新保存的组合，检查后可重试保留两者", async () => {
    let other: PortfolioResearchModel;
    function OtherPage() {
      other = usePortfolioResearch({ stocks, manifestUrl: "/portfolio.json" });
      return null;
    }
    const otherContainer = document.createElement("div");
    document.body.appendChild(otherContainer);
    const otherRoot = createRoot(otherContainer);
    try {
      await render();
      await act(async () => otherRoot.render(<OtherPage />));
      await act(async () => other.addStock("NVDA"));
      await act(async () => { expect(other.saveAs("页面 A 组合")).toBe(true); });
      const savedByOther = window.localStorage.getItem(PORTFOLIO_STORAGE_KEY);
      await act(async () => current.addStock("TSM"));
      await act(async () => { expect(current.saveAs("页面 B 组合")).toBe(false); });
      expect(window.localStorage.getItem(PORTFOLIO_STORAGE_KEY)).toBe(savedByOther);
      expect(current.draft.stockCodes).toEqual(["TSM"]);
      expect(current.dirty).toBe(true);
      expect(current.saveError).toContain("其他页面已更新");
      expect(current.baskets.map((basket) => basket.name)).toEqual(["页面 A 组合"]);
      await act(async () => { expect(current.saveAs("页面 B 组合")).toBe(true); });
      const saved = JSON.parse(window.localStorage.getItem(PORTFOLIO_STORAGE_KEY)!);
      expect(saved.baskets.map((basket: { name: string }) => basket.name)).toEqual(["页面 A 组合", "页面 B 组合"]);
      expect(current.dirty).toBe(false);
    } finally {
      await act(async () => otherRoot.unmount());
      otherContainer.remove();
    }
  });

  it("另一页面修改当前组合时保留草稿和离开保护，另存为保留两个版本", async () => {
    const original = savedBasket({ stockCodes: ["NVDA"] });
    window.localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, activeBasketId: original.id, baskets: [original] }));
    await render();
    await act(async () => current.addStock("TSM"));
    const remote = { ...original, stockCodes: ["MSFT"], updatedAt: "2026-09-05T00:00:00.000Z" };
    const remoteStore = JSON.stringify({ schemaVersion: 1, activeBasketId: remote.id, baskets: [remote] });
    window.localStorage.setItem(PORTFOLIO_STORAGE_KEY, remoteStore);
    const leave = vi.fn();
    await act(async () => current.requestLeave(leave, null));
    await act(async () => current.resolveUnsavedDecision("save"));
    expect(leave).not.toHaveBeenCalled();
    expect(current.pendingAction?.kind).toBe("leave");
    expect(current.draft.stockCodes).toEqual(["NVDA", "TSM"]);
    expect(current.dirty).toBe(true);
    expect(window.localStorage.getItem(PORTFOLIO_STORAGE_KEY)).toBe(remoteStore);
    await act(async () => current.resolveUnsavedDecision("cancel"));
    await act(async () => { expect(current.saveAs("本页副本")).toBe(true); });
    const saved = JSON.parse(window.localStorage.getItem(PORTFOLIO_STORAGE_KEY)!);
    expect(saved.baskets[0]).toEqual(remote);
    expect(saved.baskets[1].stockCodes).toEqual(["NVDA", "TSM"]);
  });

  it("当前组合被另一页面删除后仍可将保留的草稿保存为新组合", async () => {
    const original = savedBasket({ stockCodes: ["NVDA"] });
    window.localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, activeBasketId: original.id, baskets: [original] }));
    await render();
    await act(async () => current.addStock("TSM"));
    window.localStorage.removeItem(PORTFOLIO_STORAGE_KEY);
    await act(async () => { expect(current.saveActive()).toBe(false); });
    expect(window.localStorage.getItem(PORTFOLIO_STORAGE_KEY)).toBeNull();
    expect(current.activeBasketId).toBeNull();
    expect(current.draft.stockCodes).toEqual(["NVDA", "TSM"]);
    await act(async () => { expect(current.saveActive()).toBe(true); });
    expect(current.baskets).toHaveLength(1);
    expect(current.baskets[0].id).not.toBe(original.id);
    expect(current.baskets[0].stockCodes).toEqual(["NVDA", "TSM"]);
  });

  it("写前无法读取最新记录时不覆盖存储并保留草稿", async () => {
    await render();
    await act(async () => current.addStock("NVDA"));
    const write = vi.spyOn(Storage.prototype, "setItem");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("read denied"); });
    await act(async () => { expect(current.saveActive()).toBe(false); });
    expect(write).not.toHaveBeenCalled();
    expect(current.draft.stockCodes).toEqual(["NVDA"]);
    expect(current.dirty).toBe(true);
    expect(current.saveError).toContain("无法读取");
  });
});
