// @vitest-environment jsdom
import { act, type ComponentProps } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PortfolioWorkbench } from "../PortfolioWorkbench";
import { aggregatePortfolioResults } from "../aggregatePortfolioResults";
import { loadPortfolioIndex } from "../portfolioIndex";
import { PORTFOLIO_STORAGE_KEY } from "../portfolioStorage";
import type { AvailablePortfolioDetailRecord, PortfolioFundHoldingDetail } from "../types";
import { usePortfolioResearch, type AggregatedFundResult, type PortfolioResearchModel } from "../usePortfolioResearch";
import { App } from "../../App";

vi.mock("../portfolioIndex", () => ({
  loadPortfolioIndex: vi.fn(),
  loadPortfolioFundDetails: vi.fn(),
}));

vi.mock("../aggregatePortfolioResults", () => ({
  aggregatePortfolioResults: vi.fn(),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const originalShowModal = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");

function fund(index: number, onExchange = false): AggregatedFundResult {
  return {
    fundFamilyKey: `基金-${index}`,
    fundCode: String(index).padStart(6, "0"),
    fundName: `基金 ${index}`,
    fundDisplayName: `基金 ${index}`,
    fundType: onExchange ? "ETF" : "混合型",
    fundVariantCodes: [String(index).padStart(6, "0")],
    isQdii: false,
    isOnExchangeFund: onExchange,
    view: onExchange ? "onExchange" : "offExchange",
    detailShardKey: "aa",
    directRatioPercent: 100 - index / 100,
    indirectEstimatedRatioPercent: 0,
    totalEstimatedExposurePercent: 100 - index / 100,
    contributions: [{
      targetCode: "NVDA",
      targetName: "英伟达",
      directRatioPercent: 100 - index / 100,
      indirectEstimatedRatioPercent: 0,
      indirectSources: [],
    }],
  };
}

function availableDetailRecord(fundValue: AggregatedFundResult, count: number): AvailablePortfolioDetailRecord {
  const holdings = Array.from({ length: count }, (_, index) => ({
    rank: index + 1,
    stockCode: `Q2-${index + 1}`,
    stockName: `季度持仓 ${index + 1}`,
    ratioPercent: 10 - index / 10,
  })) as [PortfolioFundHoldingDetail, ...PortfolioFundHoldingDetail[]];
  return {
    fundFamilyKey: fundValue.fundFamilyKey,
    detailStatus: "available",
    detailFundCode: fundValue.fundCode,
    holdings,
  };
}

function qdiiPayload() {
  return {
    fundCodeAliases: { "000001": "000001" },
    fundStatuses: { "000001": { status: "available" } },
    fundHoldings: {
      "000001": {
        status: "available",
        fundCode: "000001",
        fundName: "QDII 测试基金",
        report: "2026H1",
        cutoffDate: "2026-06-30",
        sourceUrl: "https://example.test/official-report.pdf",
        sourceTitle: "官方中期报告",
        equityHoldings: Array.from({ length: 12 }, (_, index) => ({
          securityId: `EQUITY-${index + 1}`,
          rank: index + 1,
          stockCode: `US${index + 1}`,
          stockName: `完整权益 ${index + 1}`,
          ratioPercent: 5 - index / 10,
          holdingType: "权益投资",
        })),
        fundInvestments: [
          {
            securityId: "REPORT-FUND-001",
            rank: 1,
            stockCode: "",
            stockName: "未披露代码 ETF",
            ratioPercent: 1.23,
            holdingType: "ETF",
          },
          {
            securityId: "REPORT-FUND-002",
            rank: 2,
            stockCode: "FUND2",
            stockName: "基金投资 2",
            ratioPercent: 0.98,
            holdingType: "基金投资",
          },
        ],
      },
    },
  };
}

function model(overrides: Partial<PortfolioResearchModel> = {}): PortfolioResearchModel {
  return {
    draft: { name: "临时研究", stockCodes: ["NVDA"] },
    activeBasketId: null,
    baskets: [],
    isTemporary: true,
    dirty: false,
    status: "ready",
    error: null,
    recoveryReason: null,
    saveError: null,
    manifest: null,
    results: {
      offExchange: Array.from({ length: 51 }, (_, index) => fund(index + 1)),
      onExchange: [fund(99, true)],
      coverage: {
        selectedStockCodes: ["NVDA"],
        directExcludedRows: 0,
        ineligibleIndirectCandidateRows: 0,
        ineligibleByReason: {},
        hasSelectedIndirectCoverageLimit: false,
        disclosure: "未映射或不合格的间接产品不按 0% 计入。",
      },
    },
    pendingAction: null,
    detail: { kind: "idle" },
    create: vi.fn(),
    addStock: vi.fn(),
    removeStock: vi.fn(),
    saveActive: vi.fn(),
    saveAs: vi.fn(),
    renameActive: vi.fn(),
    requestSwitch: vi.fn(),
    requestDelete: vi.fn(),
    requestLeave: vi.fn(),
    resolveUnsavedDecision: vi.fn(),
    retry: vi.fn(),
    openDetail: vi.fn(),
    retryDetail: vi.fn(),
    closeDetail: vi.fn(),
    ...overrides,
  };
}

const currentStocks = [
  { code: "NVDA", name: "英伟达" },
  { code: "TSM", name: "台积电" },
];

function actualResults(selectedStockCodes: string[]) {
  return {
    offExchange: [],
    onExchange: [],
    coverage: {
      selectedStockCodes,
      directExcludedRows: 0,
      ineligibleIndirectCandidateRows: 0,
      ineligibleByReason: {},
      hasSelectedIndirectCoverageLimit: false,
      disclosure: "测试披露。",
    },
  };
}

const appIndexPayload = {
  meta: {
    report: "2026Q2",
    generatedAt: "2026-08-28T00:00:00+08:00",
    sourceRows: 0,
    stockCount: 2,
    defaultRankingLabel: "占基金净值比例",
    alternateRankingLabel: "持仓市值",
    cutoffDate: "2026-06-30",
  },
  popularStocks: [],
  stocks: currentStocks.map((stock) => ({
    ...stock,
    fundCount: 0,
    activeFundCount: 0,
    excludedIndexFundCount: 0,
    totalMarketValueWan: null,
    maxRatioPercent: 0,
    topByRatio: [],
    topByValue: [],
  })),
};

async function renderDirtyApp(): Promise<HTMLInputElement> {
  window.history.replaceState(null, "", "/research?stock=NVDA");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => appIndexPayload,
  }));
  await act(async () => {
    root.render(<App />);
    await Promise.resolve();
  });
  await act(async () => { await Promise.resolve(); });
  const picker = container.querySelector<HTMLInputElement>('[aria-label="检索添加股票"]');
  if (picker === null) throw new Error("缺少组合股票检索框");
  await setSearchInput(picker, "TSM");
  const pickerSuggestion = container.querySelector<HTMLElement>('#portfolio-stock-search-suggestions [role="option"]');
  if (pickerSuggestion === null) throw new Error("缺少组合股票检索建议");
  await act(async () => pickerSuggestion.click());
  const addButton = Array.from(container.querySelectorAll(".portfolio-stock-search-field button")).find((button) => button.textContent === "加入组合") as HTMLButtonElement | undefined;
  if (addButton === undefined) throw new Error("缺少添加股票按钮");
  await act(async () => addButton.click());
  const input = container.querySelector<HTMLInputElement>('[aria-label="搜索股票名称或代码"]');
  if (input === null) throw new Error("缺少搜索输入框");
  return input;
}

async function setSearchInput(input: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function HookProbe({
  temporarySelection,
}: {
  temporarySelection?: { code: string; requestId: number; trigger: HTMLElement | null };
}) {
  const research = usePortfolioResearch({
    stocks: currentStocks,
    manifestUrl: "/data/fund-portfolio-index-2026q2.manifest.json?v=2026q2",
    temporarySelection,
  });
  return (
    <div>
      <button type="button" onClick={() => research.addStock("TSM")}>添加 TSM</button>
      <button type="button" onClick={() => research.requestLeave(() => undefined, null)}>离开研究</button>
      <button type="button" onClick={() => research.addStock("NVDA")}>添加 NVDA</button>
      <button type="button" onClick={() => research.resolveUnsavedDecision("discard")}>放弃草稿</button>
      <p data-testid="hook-draft">{research.draft.stockCodes.join(",")}</p>
      <p data-testid="hook-pending">{research.pendingAction?.kind ?? ""}</p>
      <p data-testid="hook-status">{research.status}</p>
      <p data-testid="hook-results">{research.results?.coverage.selectedStockCodes.join(",") ?? ""}</p>
    </div>
  );
}

async function render(
  research: PortfolioResearchModel,
  additionalProps: Partial<ComponentProps<typeof PortfolioWorkbench>> = {},
) {
  await act(async () => {
    root.render(
      <PortfolioWorkbench
        stocks={[
          { code: "NVDA", name: "英伟达" },
          { code: "TSM", name: "台积电" },
        ]}
        report="2026Q2"
        cutoffDate="2026-06-30"
        manifestUrl="/data/fund-portfolio-index-2026q2.manifest.json?v=2026q2"
        fundHoldingsUrl="/data/qdii-fund-holdings-2026h1.json?v=2026q2-qdii-h1"
        useResearch={() => research}
        {...additionalProps}
      />,
    );
  });
}

beforeEach(() => {
  // jsdom has no modal dialog implementation; native focus trapping is covered by browser QA.
  if (!originalShowModal) Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value(this: HTMLDialogElement) { this.open = true; } });
  document.body.innerHTML = '<div id="root"></div>';
  container = document.querySelector("#root") as HTMLDivElement;
  root = createRoot(container);
  vi.mocked(loadPortfolioIndex).mockResolvedValue({ manifest: {} } as never);
  vi.mocked(aggregatePortfolioResults).mockImplementation(({ selectedStockCodes }) => actualResults(selectedStockCodes));
});

afterEach(async () => {
  await act(async () => root.unmount());
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
  document.body.innerHTML = "";
  if (!originalShowModal) Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
});

describe("PortfolioWorkbench", () => {
  it("保存状态在保存、修改和还原后同步，另存为默认产生独立副本", async () => {
    window.localStorage.removeItem(PORTFOLIO_STORAGE_KEY);
    await act(async () => {
      root.render(<PortfolioWorkbench stocks={currentStocks} report="2026Q2" cutoffDate="2026-06-30" temporaryStockCode="NVDA" manifestUrl="/portfolio.json" fundHoldingsUrl="/holdings.json" />);
    });
    const getButton = (text: string) => {
      const button = Array.from(container.querySelectorAll("button")).find((item) => item.textContent === text);
      if (!button) throw new Error(`缺少按钮 ${text}`);
      return button;
    };
    expect(container.querySelector(".portfolio-status")?.textContent).toContain("未保存");
    await act(async () => getButton("保存组合").click());
    expect(container.querySelector(".portfolio-status")?.textContent).toContain("已保存");
    expect(getButton("保存更改").disabled).toBe(true);
    const name = container.querySelector<HTMLInputElement>('.portfolio-editor input[placeholder="输入组合名称"]');
    if (!name) throw new Error("缺少组合名称");
    await setSearchInput(name, "修改后的研究");
    expect(getButton("保存更改").disabled).toBe(false);
    expect(container.querySelector(".portfolio-status")?.textContent).toContain("未保存");
    await setSearchInput(name, "临时研究");
    expect(getButton("保存更改").disabled).toBe(true);
    const originalStore = JSON.parse(window.localStorage.getItem(PORTFOLIO_STORAGE_KEY)!);

    await act(async () => getButton("另存为").click());
    const dialog = container.querySelector<HTMLDialogElement>("dialog");
    expect(dialog?.open).toBe(true);
    expect(dialog?.querySelector("input")?.value).toBe("临时研究（副本）");
    await act(async () => getButton("保存副本").click());
    expect(container.querySelector("dialog")).toBeNull();
    const copiedStore = JSON.parse(window.localStorage.getItem(PORTFOLIO_STORAGE_KEY)!);
    expect(copiedStore.baskets).toHaveLength(2);
    expect(copiedStore.baskets[0]).toEqual(originalStore.baskets[0]);
    expect(copiedStore.baskets[1].id).not.toBe(originalStore.baskets[0].id);
    expect(copiedStore.baskets[1].name).toBe("临时研究（副本）");
    expect(copiedStore.baskets[1].stockCodes).toEqual(["NVDA"]);
    expect(getButton("保存更改").disabled).toBe(true);
    const savedSelector = container.querySelector<HTMLSelectElement>("#saved-portfolio-select")!;
    await act(async () => { savedSelector.value = originalStore.baskets[0].id; savedSelector.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(JSON.parse(window.localStorage.getItem(PORTFOLIO_STORAGE_KEY)!).activeBasketId).toBe(originalStore.baskets[0].id);
    await setSearchInput(name, "保存后再切换");
    await act(async () => { savedSelector.value = copiedStore.baskets[1].id; savedSelector.dispatchEvent(new Event("change", { bubbles: true })); });
    await act(async () => getButton("保存").click());
    const switchedStore = JSON.parse(window.localStorage.getItem(PORTFOLIO_STORAGE_KEY)!);
    expect(switchedStore.baskets.find((basket: { id: string }) => basket.id === originalStore.baskets[0].id).name).toBe("保存后再切换");
    expect(switchedStore.activeBasketId).toBe(copiedStore.baskets[1].id);
    window.localStorage.removeItem(PORTFOLIO_STORAGE_KEY);
  });

  it("离开研究时放弃修改会恢复已保存内容，避免再次触发保护或把脏草稿显示为已保存", async () => {
    window.localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, activeBasketId: "saved", baskets: [{ id: "saved", name: "已保存研究", stockCodes: ["NVDA"], createdAt: "2026-08-28T00:00:00.000Z", updatedAt: "2026-08-28T00:00:00.000Z" }] }));
    await act(async () => root.render(<HookProbe />));
    await act(async () => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "添加 TSM")!.click());
    await act(async () => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "离开研究")!.click());
    expect(container.querySelector('[data-testid="hook-pending"]')?.textContent).toBe("leave");
    await act(async () => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "放弃草稿")!.click());
    expect(container.querySelector('[data-testid="hook-draft"]')?.textContent).toBe("NVDA");
    expect(container.querySelector('[data-testid="hook-pending"]')?.textContent).toBe("");
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
    window.localStorage.removeItem(PORTFOLIO_STORAGE_KEY);
  });

  it("删除先显示包含组合名的确认，取消不删除且焦点返回，确认后才写入存储", async () => {
    window.localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1, activeBasketId: "saved", baskets: [{ id: "saved", name: "芯片观察", stockCodes: ["NVDA"], createdAt: "2026-08-28T00:00:00.000Z", updatedAt: "2026-08-28T00:00:00.000Z" }],
    }));
    await act(async () => {
      root.render(<PortfolioWorkbench stocks={currentStocks} report="2026Q2" cutoffDate="2026-06-30" manifestUrl="/portfolio.json" fundHoldingsUrl="/holdings.json" />);
    });
    const more = container.querySelector<HTMLDetailsElement>(".portfolio-more-actions")!;
    more.open = true;
    const deleteButton = more.querySelector<HTMLButtonElement>("button")!;
    await act(async () => { deleteButton.focus(); deleteButton.click(); });
    expect(container.querySelector('[role="alertdialog"]')?.textContent).toContain("删除“芯片观察”？");
    expect(JSON.parse(window.localStorage.getItem(PORTFOLIO_STORAGE_KEY)!).baskets).toHaveLength(1);
    await act(async () => container.querySelector<HTMLButtonElement>('dialog button[type="button"]')!.click());
    expect(container.querySelector("dialog")).toBeNull();
    expect(document.activeElement).toBe(deleteButton);
    expect(JSON.parse(window.localStorage.getItem(PORTFOLIO_STORAGE_KEY)!).baskets).toHaveLength(1);
    await act(async () => deleteButton.click());
    await act(async () => container.querySelector<HTMLButtonElement>('dialog button[type="submit"]')!.click());
    expect(JSON.parse(window.localStorage.getItem(PORTFOLIO_STORAGE_KEY)!).baskets).toHaveLength(0);
    window.localStorage.removeItem(PORTFOLIO_STORAGE_KEY);
  });

  it("比较表按需展开来源、杠杆公式和所有份额代码，保留分类计数与展示进度", async () => {
    const mappedFund = fund(1);
    mappedFund.fundVariantCodes = ["000001", "000002", "000003"];
    mappedFund.indirectEstimatedRatioPercent = 2.46;
    mappedFund.contributions[0].indirectEstimatedRatioPercent = 2.46;
    mappedFund.contributions[0].indirectSources = [{ fundFamilyKey: mappedFund.fundFamilyKey, targetCode: "NVDA", targetName: "英伟达", sourceCode: "NVDL", sourceName: "每日两倍英伟达产品", sourceRatioPercent: 1.23, leverageMultiple: 2, estimatedRatioPercent: 2.46, matchReason: "verified", isOnExchangeFund: false }];
    const data = model();
    data.results!.offExchange = [mappedFund];
    await render(data);
    expect(container.querySelector('.portfolio-fund-table thead th[aria-sort="descending"]')?.textContent).toContain("总估算暴露");
    expect(container.querySelector("#portfolio-tab-off-exchange")?.textContent).toContain("场外基金（1）");
    expect(container.querySelector(".portfolio-result-count")?.textContent).toContain("显示 1 / 1");
    expect(container.querySelector(".portfolio-source-formula")).toBeNull();
    const expand = container.querySelector<HTMLButtonElement>('[role="tabpanel"] .portfolio-row-actions button')!;
    await act(async () => expand.click());
    expect(expand.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector(".portfolio-source-formula")?.textContent).toContain("1.23% × 2 倍 = 间接估算 2.46%");
    expect(container.querySelector(".portfolio-share-codes")?.textContent).toContain("000001、000002、000003");
    expect(container.querySelector(".portfolio-estimate-detail")?.textContent).toContain("未披露不代表未持有");
  });

  it("500 条明细可按别名检索、仅看研究对象与排序，同时保留报告原名及原序号", async () => {
    const qdiiFund = { ...fund(1), isQdii: true };
    const payload = qdiiPayload();
    payload.fundHoldings["000001"].equityHoldings = Array.from({ length: 500 }, (_, index) => ({ securityId: `E-${index}`, rank: index === 1 ? 1 : index + 1, stockCode: index === 1 ? "NVDAUSEquity" : `TEST${index}`, stockName: index === 1 ? "NVIDI A CORP" : `明细 ${index}`, ratioPercent: index === 1 ? 7.37 : 0.01, holdingType: "权益投资" }));
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }));
    await render(model({ detail: { kind: "available", fund: qdiiFund, record: availableDetailRecord(qdiiFund, 10) } }), { fetchImpl: fetchImpl as typeof fetch });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const firstRow = container.querySelector(".portfolio-qdii-detail .portfolio-detail-holdings li");
    expect(firstRow?.textContent).toContain("英伟达");
    expect(firstRow?.querySelector("details")?.textContent).toContain("NVIDI A CORP · NVDAUSEquity");
    expect(firstRow?.querySelector("summary")?.textContent).toContain("原文 · 序号 1");
    expect(firstRow?.querySelector('[aria-label="展示序号 1"]')).not.toBeNull();
    const search = container.querySelector<HTMLInputElement>('.portfolio-detail-filters input[type="search"]')!;
    await setSearchInput(search, "英伟达");
    expect(container.querySelector(".portfolio-detail-match-count")?.textContent).toBe("显示 1 / 500 条");
    expect(container.querySelectorAll(".portfolio-qdii-detail .portfolio-detail-holdings li")).toHaveLength(1);
    await setSearchInput(search, "");
    await act(async () => container.querySelector<HTMLInputElement>('.portfolio-detail-filters input[type="checkbox"]')!.click());
    expect(container.querySelector(".portfolio-detail-match-count")?.textContent).toBe("显示 1 / 500 条");
    await act(async () => container.querySelector<HTMLInputElement>('.portfolio-detail-filters input[type="checkbox"]')!.click());
    const sorter = container.querySelector<HTMLSelectElement>(".portfolio-detail-filters select")!;
    await act(async () => { sorter.value = "report"; sorter.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(container.querySelector(".portfolio-qdii-detail .portfolio-detail-holdings li")?.textContent).toContain("明细 0");
    expect(container.querySelector(".portfolio-detail-toolbar")?.querySelector('[aria-label="关闭基金持仓详情"]')).not.toBeNull();
    expect(container.querySelector(".portfolio-detail-body")?.contains(search)).toBe(false);
  });

  it("显示临时单股票研究、固定披露和完整排序后的前 50 行", async () => {
    await render(model());

    expect(container.textContent).toContain("单股 · 1 / 10 只");
    expect(container.textContent).toContain("本机组合");
    expect(container.querySelector(".portfolio-result-summary")?.textContent).toContain("未披露不代表未持有");
    expect(container.querySelectorAll('[role="tabpanel"]:not([hidden]) .portfolio-fund-row')).toHaveLength(50);
    expect(container.textContent).toContain("更多（1）");
  });

  it("页签可通过键盘互斥切换，并保留各自结果", async () => {
    await render(model());
    const offExchange = container.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]');
    if (offExchange === null) throw new Error("缺少默认页签");
    offExchange.focus();
    await act(async () => {
      offExchange.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });

    const selected = container.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]');
    expect(selected?.textContent).toContain("场内 ETF / LOF");
    expect(container.querySelector('[role="tabpanel"]:not([hidden])')?.textContent).toContain("基金 99");
  });

  it("每个页签都关联存在且可阅读的结果面板", async () => {
    await render(model());
    const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    expect(tabs).toHaveLength(2);
    for (const tab of tabs) {
      const panelId = tab.getAttribute("aria-controls");
      const panel = panelId ? container.querySelector<HTMLElement>(`#${panelId}`) : null;
      expect(panel).not.toBeNull();
      expect(panel?.getAttribute("role")).toBe("tabpanel");
      expect(panel?.getAttribute("tabindex")).toBe("0");
    }
  });

  it("详情三态不会把未采集或失败伪造成无持仓", async () => {
    await render(model({
      detail: {
        kind: "notCaptured",
        fund: fund(1),
        message: "当前已采集公开股票明细未包含详情。",
      },
    }));
    expect(container.textContent).toContain("当前已采集公开股票明细未包含详情。");
    expect(container.textContent).toContain("未出现不代表未持有");
    expect(container.textContent).not.toContain("该基金暂无持仓记录");

    await render(model({
      detail: { kind: "unavailable", fund: fund(1), reason: "详情暂时不可用：网络错误" },
    }));
    expect(container.textContent).toContain("详情暂时不可用");
    expect(container.textContent).not.toContain("该基金暂无持仓记录");
  });

  it("QDII 详情展示中期报告全部权益，并将基金和 ETF 限定为报告前十", async () => {
    const qdiiFund: AggregatedFundResult = {
      ...fund(1),
      fundName: "海外指数基金",
      fundDisplayName: "海外指数基金",
      fundType: "指数型-海外股票",
      isQdii: true,
    };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(qdiiPayload()), { status: 200 }));
    await render(model({
      detail: {
        kind: "available",
        fund: qdiiFund,
        record: availableDetailRecord(qdiiFund, 11),
      },
    }), { fetchImpl: fetchImpl as typeof fetch });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    const richDetail = container.querySelector(".portfolio-qdii-detail");
    expect(richDetail?.textContent).toContain("权益投资 · 完整披露");
    expect(richDetail?.textContent).toContain("基金 / ETF · 仅前十项");
    expect(richDetail?.textContent).toContain("完整权益 12");
    expect(richDetail?.textContent).toContain("未披露代码 ETF（ETF）");
    expect(richDetail?.textContent).toContain("报告未披露代码");
    expect(richDetail?.querySelectorAll(".portfolio-detail-holdings li")).toHaveLength(14);
    expect(fetchImpl).toHaveBeenCalledWith("/data/qdii-fund-holdings-2026h1.json?v=2026q2-qdii-h1");
  });

  it("QDII 详情保留已核验的官方产品名称", async () => {
    const qdiiFund: AggregatedFundResult = {
      ...fund(1),
      fundName: "海外指数基金",
      fundDisplayName: "海外指数基金",
      fundType: "指数型-海外股票",
      isQdii: true,
    };
    const payload = qdiiPayload();
    payload.fundHoldings["000001"].fundInvestments[0].stockName =
      "CSOP SK Hynix Daily 2x Leveraged Product";
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }));
    await render(model({
      detail: {
        kind: "available",
        fund: qdiiFund,
        record: availableDetailRecord(qdiiFund, 11),
      },
    }), { fetchImpl: fetchImpl as typeof fetch });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    const richDetail = container.querySelector(".portfolio-qdii-detail");
    expect(richDetail?.textContent).toContain("CSOP SK Hynix Daily 2x Leveraged Product（ETF）");
    expect(richDetail?.textContent).not.toContain("CSOP SK H ynix Daily 2 x Leveraged Product");
  });

  it("非 QDII 详情仍维持最多十条的主索引契约", async () => {
    const mixedFund = fund(1);
    const fetchImpl = vi.fn();
    await render(model({
      detail: {
        kind: "available",
        fund: mixedFund,
        record: availableDetailRecord(mixedFund, 11),
      },
    }), { fetchImpl: fetchImpl as typeof fetch });

    expect(container.querySelector(".portfolio-qdii-detail")).toBeNull();
    expect(container.querySelectorAll(".portfolio-detail-holdings li")).toHaveLength(10);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("只有完整结果就绪后才渲染预留的右侧摘要入口", async () => {
    const afterResultsReady = <div data-testid="market-summary-slot">市场摘要入口</div>;
    await render(model(), { afterResultsReady });
    expect(container.querySelector('[data-testid="market-summary-slot"]')).not.toBeNull();
    expect(container.querySelector(".portfolio-ready-layout")?.classList.contains("has-aside")).toBe(true);

    await render(model({ status: "blocked", results: null, error: "组合数据暂时不可用。" }), { afterResultsReady });
    expect(container.querySelector('[data-testid="market-summary-slot"]')).toBeNull();
  });

  it("未保存提示框按 Escape 取消，且不擅自放弃草稿", async () => {
    const resolveUnsavedDecision = vi.fn();
    await render(model({
      dirty: true,
      pendingAction: { kind: "leave", action: vi.fn(), trigger: null },
      resolveUnsavedDecision,
    }));
    expect(container.textContent).toContain("有未保存更改");
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });
    expect(resolveUnsavedDecision).toHaveBeenCalledWith("cancel");
  });

  it("当前保存错误优先显示，不会被历史恢复提示遮住", async () => {
    await render(model({
      recoveryReason: "历史本机记录已恢复。",
      saveError: "无法保存到本机，当前研究仍可继续。",
    }));
    expect(container.querySelector(".portfolio-status")?.textContent).toContain("无法保存到本机");
  });

  it("阻断状态提供重试，十只上限和草稿保护都有可读状态", async () => {
    const retry = vi.fn();
    const protectedCreate = vi.fn();
    await render(model({
      draft: { name: "满额组合", stockCodes: ["NVDA", "TSM", "A", "B", "C", "D", "E", "F", "G", "H"] },
      status: "blocked",
      error: "组合数据分片 TSM 暂时不可用。",
      results: null,
      dirty: true,
      retry,
      create: protectedCreate,
    }));
    expect(container.textContent).toContain("已满 10 只");
    expect(container.textContent).toContain("TSM 暂时不可用");
    const retryButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "重试");
    if (retryButton === undefined) throw new Error("缺少重试按钮");
    await act(async () => retryButton.click());
    expect(retry).toHaveBeenCalledTimes(1);
    const createButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "新建");
    if (createButton === undefined) throw new Error("缺少新建按钮");
    await act(async () => createButton.click());
    expect(protectedCreate).toHaveBeenCalledTimes(1);
  });

  it("添加股票支持按中文名称检索，并可用键盘选中后添加", async () => {
    const addStock = vi.fn();
    await render(model({ addStock }));
    const search = container.querySelector<HTMLInputElement>('[aria-label="检索添加股票"]');
    if (search === null) throw new Error("缺少股票检索输入框");

    await setSearchInput(search, "台积");
    const options = Array.from(container.querySelectorAll<HTMLElement>('[role="option"]'));
    expect(options).toHaveLength(1);
    expect(options[0]?.textContent).toContain("台积电 · TSM");
    expect(container.querySelector('[role="listbox"]')?.textContent).not.toContain("英伟达 · NVDA");

    await act(async () => {
      search.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });
    await act(async () => {
      search.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    const addButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "加入组合");
    if (addButton === undefined) throw new Error("缺少添加按钮");
    await act(async () => addButton.click());
    expect(addStock).toHaveBeenCalledWith("TSM");
  });

  it("添加股票支持按代码检索并点击候选项添加", async () => {
    const addStock = vi.fn();
    await render(model({ addStock }));
    const search = container.querySelector<HTMLInputElement>('[aria-label="检索添加股票"]');
    if (search === null) throw new Error("缺少股票检索输入框");

    await setSearchInput(search, "TSM");
    const option = container.querySelector<HTMLElement>('[role="option"]');
    if (option === null) throw new Error("缺少代码检索候选项");
    expect(option.textContent).toContain("台积电 · TSM");
    await act(async () => option.click());
    await act(async () => search.focus());
    expect(container.querySelector('[role="listbox"]')?.textContent).toContain("台积电 · TSM");
    expect(container.textContent).not.toContain("未找到匹配股票");
    const addButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "加入组合");
    if (addButton === undefined) throw new Error("缺少添加按钮");
    await act(async () => addButton.click());
    expect(addStock).toHaveBeenCalledWith("TSM");
  });

  it("同名的多个代码必须在选择候选项后才能添加", async () => {
    const addStock = vi.fn();
    await render(model({ addStock }), {
      stocks: [
        { code: "NVDA", name: "英伟达" },
        { code: "TSM", name: "台积电" },
        { code: "2330", name: "台积电" },
      ],
    });
    const search = container.querySelector<HTMLInputElement>('[aria-label="检索添加股票"]');
    if (search === null) throw new Error("缺少股票检索输入框");

    await setSearchInput(search, "台积电");
    const options = Array.from(container.querySelectorAll<HTMLElement>('[role="option"]'));
    expect(options).toHaveLength(2);
    const addButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "加入组合");
    if (addButton === undefined) throw new Error("缺少添加按钮");
    expect(addButton.disabled).toBe(true);

    await act(async () => options[1]?.click());
    expect(addButton.disabled).toBe(false);
    await act(async () => addButton.click());
    expect(addStock).toHaveBeenCalledWith("2330");
  });

  it("键盘移动到超出可视高度的候选项时会将其滚动到可视区", async () => {
    const originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });
    try {
      await render(model(), {
        stocks: [
          { code: "NVDA", name: "英伟达" },
          ...Array.from({ length: 13 }, (_, index) => ({ code: `TEST-${index}`, name: `测试股票 ${index}` })),
        ],
      });
      const search = container.querySelector<HTMLInputElement>('[aria-label="检索添加股票"]');
      if (search === null) throw new Error("缺少股票检索输入框");
      await act(async () => search.focus());
      expect(container.querySelectorAll('[role="option"]')).toHaveLength(12);

      await act(async () => {
        for (let index = 0; index < 12; index += 1) {
          search.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
        }
      });

      expect(search.getAttribute("aria-activedescendant")).toBe("portfolio-stock-search-option-TEST-11");
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    } finally {
      if (originalScrollIntoView) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", originalScrollIntoView);
      else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    }
  });

  it("键盘 Tab 离开组合检索时关闭候选列表且不拦截焦点移动", async () => {
    await render(model());
    const search = container.querySelector<HTMLInputElement>('[aria-label="检索添加股票"]');
    if (search === null) throw new Error("缺少股票检索输入框");

    await setSearchInput(search, "台积");
    expect(container.querySelector('[role="listbox"]')).not.toBeNull();
    const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    await act(async () => search.dispatchEvent(tab));

    expect(tab.defaultPrevented).toBe(false);
    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });

  it("中文输入法组合确认时不会拦截 Enter 或提前选中股票", async () => {
    await render(model());
    const search = container.querySelector<HTMLInputElement>('[aria-label="检索添加股票"]');
    if (search === null) throw new Error("缺少股票检索输入框");

    await setSearchInput(search, "台积");
    await act(async () => {
      search.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });
    const composingEnter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    Object.defineProperty(composingEnter, "isComposing", { value: true });
    await act(async () => search.dispatchEvent(composingEnter));

    expect(composingEnter.defaultPrevented).toBe(false);
    expect(search.value).toBe("台积");
  });

  it("添加和移除股票使用真实按钮并保留中文可访问名称", async () => {
    const addStock = vi.fn();
    const removeStock = vi.fn();
    await render(model({ addStock, removeStock }));
    const picker = container.querySelector<HTMLInputElement>('[aria-label="检索添加股票"]');
    if (picker === null) throw new Error("缺少股票检索框");
    await setSearchInput(picker, "TSM");
    const pickerSuggestion = container.querySelector<HTMLElement>('#portfolio-stock-search-suggestions [role="option"]');
    if (pickerSuggestion === null) throw new Error("缺少股票检索建议");
    await act(async () => pickerSuggestion.click());
    const addButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "加入组合");
    if (addButton === undefined) throw new Error("缺少添加按钮");
    await act(async () => addButton.click());
    expect(addStock).toHaveBeenCalledWith("TSM");
    const removeButton = container.querySelector<HTMLButtonElement>('[aria-label="移除 英伟达 NVDA"]');
    if (removeButton === null) throw new Error("缺少移除按钮");
    await act(async () => removeButton.click());
    expect(removeStock).toHaveBeenCalledWith("NVDA");
  });

  it("已选股票不会在选择器重复出现，达到十只时给出明确禁用原因", async () => {
    await render(model());
    const picker = container.querySelector<HTMLInputElement>('[aria-label="检索添加股票"]');
    if (picker === null) throw new Error("缺少股票检索框");
    await setSearchInput(picker, "英伟达");
    expect(container.querySelector('#portfolio-stock-search-suggestions')).toBeNull();
    expect(container.textContent).toContain("未找到匹配股票");
    expect(picker.getAttribute("aria-expanded")).toBe("false");
    expect(picker.hasAttribute("aria-controls")).toBe(false);

    await render(model({
      draft: { name: "满额组合", stockCodes: ["NVDA", "TSM", "A", "B", "C", "D", "E", "F", "G", "H"] },
    }));
    expect(container.querySelector<HTMLInputElement>('[aria-label="检索添加股票"]')?.disabled).toBe(true);
    expect(Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "加入组合")?.disabled).toBe(true);
    expect(container.textContent).toContain("请先移除一只再添加");
  });

  it("搜索索引迟到时仍在首次非空范围恢复已保存组合", async () => {
    window.localStorage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      activeBasketId: "saved",
      baskets: [{
        id: "saved",
        name: "延迟恢复组合",
        stockCodes: ["NVDA"],
        createdAt: "2026-08-28T00:00:00.000Z",
        updatedAt: "2026-08-28T00:00:00.000Z",
      }],
    }));
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));

    await act(async () => {
      root.render(<PortfolioWorkbench stocks={[]} report="2026Q2" cutoffDate="2026-06-30" manifestUrl="/data/fund-portfolio-index-2026q2.manifest.json?v=2026q2" fundHoldingsUrl="/data/qdii-fund-holdings-2026h1.json?v=2026q2-qdii-h1" fetchImpl={fetchImpl as typeof fetch} />);
    });
    await act(async () => {
      root.render(<PortfolioWorkbench stocks={[{ code: "NVDA", name: "英伟达" }]} report="2026Q2" cutoffDate="2026-06-30" manifestUrl="/data/fund-portfolio-index-2026q2.manifest.json?v=2026q2" fundHoldingsUrl="/data/qdii-fund-holdings-2026h1.json?v=2026q2-qdii-h1" fetchImpl={fetchImpl as typeof fetch} />);
    });
    await act(async () => { await Promise.resolve(); });

    expect(container.textContent).toContain("延迟恢复组合");
    window.localStorage.removeItem(PORTFOLIO_STORAGE_KEY);
  });

  it("新的临时单股选择会保护脏草稿，并以请求编号允许同一代码再次进入", async () => {
    await act(async () => {
      root.render(<HookProbe temporarySelection={{ code: "NVDA", requestId: 1, trigger: null }} />);
    });
    expect(container.querySelector('[data-testid="hook-draft"]')?.textContent).toBe("NVDA");
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "添加 TSM")?.click();
    });
    expect(container.querySelector('[data-testid="hook-draft"]')?.textContent).toBe("NVDA,TSM");

    await act(async () => {
      root.render(<HookProbe temporarySelection={{ code: "TSM", requestId: 2, trigger: null }} />);
    });
    expect(container.querySelector('[data-testid="hook-pending"]')?.textContent).toBe("temporary");
    expect(container.querySelector('[data-testid="hook-draft"]')?.textContent).toBe("NVDA,TSM");
    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "放弃草稿")?.click();
    });
    expect(container.querySelector('[data-testid="hook-draft"]')?.textContent).toBe("TSM");

    await act(async () => {
      Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "添加 NVDA")?.click();
      root.render(<HookProbe temporarySelection={{ code: "TSM", requestId: 3, trigger: null }} />);
    });
    expect(container.querySelector('[data-testid="hook-pending"]')?.textContent).toBe("temporary");
  });

  it("股票草稿切换的同步渲染不会把旧组合结果冒充为新组合", async () => {
    await act(async () => {
      root.render(<HookProbe temporarySelection={{ code: "NVDA", requestId: 10, trigger: null }} />);
    });
    await act(async () => { await Promise.resolve(); });
    expect(container.querySelector('[data-testid="hook-results"]')?.textContent).toBe("NVDA");

    const addButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "添加 TSM");
    if (addButton === undefined) throw new Error("缺少添加按钮");
    flushSync(() => addButton.click());

    expect(container.querySelector('[data-testid="hook-draft"]')?.textContent).toBe("NVDA,TSM");
    expect(container.querySelector('[data-testid="hook-status"]')?.textContent).toBe("loading");
    expect(container.querySelector('[data-testid="hook-results"]')?.textContent).toBe("");
  });

  it("脏草稿经搜索 Enter 或建议选择取消后，都把焦点还给搜索输入框", async () => {
    const input = await renderDirtyApp();
    await setSearchInput(input, "TSM");
    await act(async () => {
      input.focus();
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    });
    await act(async () => { await new Promise((resolve) => window.requestAnimationFrame(resolve)); });
    expect(container.textContent).toContain("有未保存更改");
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });
    expect(document.activeElement).toBe(input);

    await setSearchInput(input, "TSM");
    const suggestion = container.querySelector<HTMLElement>('[role="option"]');
    if (suggestion === null) throw new Error("缺少搜索建议");
    await act(async () => suggestion.click());
    await act(async () => { await new Promise((resolve) => window.requestAnimationFrame(resolve)); });
    expect(container.textContent).toContain("有未保存更改");
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });
    expect(document.activeElement).toBe(input);
  });
});
