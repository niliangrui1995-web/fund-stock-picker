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
