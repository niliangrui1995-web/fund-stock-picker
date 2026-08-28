import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { AggregatedFundResult, PortfolioView } from "./types";
import {
  usePortfolioResearch,
  type PortfolioResearchModel,
  type PortfolioStockOption,
  type UsePortfolioResearchOptions,
} from "./usePortfolioResearch";
import "./portfolio.css";

const PAGE_SIZE = 50;
const STOCK_SEARCH_RESULT_LIMIT = 12;
const STOCK_SEARCH_LIST_ID = "portfolio-stock-search-suggestions";

export interface PortfolioWorkbenchProps {
  stocks: PortfolioStockOption[];
  report: string;
  cutoffDate: string;
  temporaryStockCode?: string | null;
  temporarySelection?: { code: string; requestId: number; trigger: HTMLElement | null } | null;
  manifestUrl: string;
  fetchImpl?: typeof fetch;
  afterResultsReady?: ReactNode;
  focusResult?: boolean;
  onResultFocused?(): void;
  onLeaveGuard?(guard: (action: () => void, trigger: HTMLElement | null) => void): void;
  useResearch?: (options: UsePortfolioResearchOptions) => PortfolioResearchModel;
}

function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 2 }).format(value)}%`;
}

function normalizeStockSearchTerm(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function formatPickerStock(stock: PortfolioStockOption): string {
  return `${stock.name} · ${stock.code}`;
}

function DetailDialog({
  model,
  onClose,
}: {
  model: PortfolioResearchModel;
  onClose(): void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (model.detail.kind === "idle") return;
    const frame = window.requestAnimationFrame(() => closeRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? []);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [model, model.detail]);

  if (model.detail.kind === "idle") return null;
  const fund = model.detail.fund;
  return (
    <div className="portfolio-dialog-backdrop" role="presentation">
      <section ref={dialogRef} className="portfolio-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="portfolio-detail-title">
        <div className="portfolio-dialog-heading">
          <div>
            <p>基金持仓详情</p>
            <h3 id="portfolio-detail-title">{fund.fundDisplayName}</h3>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="关闭基金持仓详情">关闭</button>
        </div>
        {model.detail.kind === "loading" ? <p role="status">正在加载基金详情…</p> : null}
        {model.detail.kind === "available" ? (
          <ol className="portfolio-detail-holdings">
            {model.detail.record.holdings.slice(0, 10).map((holding) => (
              <li key={`${holding.rank}-${holding.stockCode}`}>
                <span>{holding.rank}</span>
                <strong>{holding.stockName}</strong>
                <code>{holding.stockCode}</code>
                <b>{formatPercent(holding.ratioPercent)}</b>
              </li>
            ))}
          </ol>
        ) : null}
        {model.detail.kind === "notCaptured" ? (
          <p className="portfolio-detail-not-captured">{model.detail.message} 未出现不代表未持有，也不代表基金没有持仓。</p>
        ) : null}
        {model.detail.kind === "unavailable" ? (
          <div className="portfolio-detail-error" role="alert">
            <p>{model.detail.reason}</p>
            <button type="button" onClick={model.retryDetail}>重试详情</button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function UnsavedDialog({ model }: { model: PortfolioResearchModel }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (model.pendingAction === null) return;
    const frame = window.requestAnimationFrame(() => cancelRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        model.resolveUnsavedDecision("cancel");
      }
      if (event.key !== "Tab") return;
      const items = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [model, model.pendingAction]);

  if (model.pendingAction === null) return null;
  return (
    <div className="portfolio-dialog-backdrop" role="presentation">
      <section ref={dialogRef} className="portfolio-unsaved-dialog" role="dialog" aria-modal="true" aria-labelledby="portfolio-unsaved-title">
        <h3 id="portfolio-unsaved-title">组合更改尚未保存</h3>
        <p>请先选择保存、放弃或取消，避免丢失当前草稿。</p>
        <div className="portfolio-dialog-actions">
          <button type="button" onClick={() => model.resolveUnsavedDecision("save")}>保存</button>
          <button type="button" onClick={() => model.resolveUnsavedDecision("discard")}>放弃</button>
          <button ref={cancelRef} type="button" onClick={() => model.resolveUnsavedDecision("cancel")}>取消</button>
        </div>
      </section>
    </div>
  );
}

function FundRow({
  fund,
  index,
  model,
  onOpenDetail,
}: {
  fund: AggregatedFundResult;
  index: number;
  model: PortfolioResearchModel;
  onOpenDetail(fund: AggregatedFundResult, trigger: HTMLButtonElement): void;
}) {
  return (
    <article className="portfolio-fund-row">
      <div className="portfolio-fund-head">
        <span className="portfolio-rank">{index + 1}</span>
        <div>
          <h4>{fund.fundDisplayName}</h4>
          <p>{fund.fundCode} · {fund.fundType}</p>
        </div>
        <button type="button" onClick={(event) => onOpenDetail(fund, event.currentTarget)} aria-label={`查看 ${fund.fundDisplayName} 基金详情`}>查看详情</button>
      </div>
      <div className="portfolio-contributions" aria-label={`${fund.fundDisplayName} 的股票贡献`}>
        {fund.contributions.map((contribution) => (
          <span key={contribution.targetCode}>
            {contribution.targetName} {contribution.targetCode}：直接 {formatPercent(contribution.directRatioPercent)}，间接估算 {formatPercent(contribution.indirectEstimatedRatioPercent)}
          </span>
        ))}
      </div>
      <dl className="portfolio-exposure-grid">
        <div><dt>直接合计</dt><dd>{formatPercent(fund.directRatioPercent)}</dd></div>
        <div><dt>间接估算合计</dt><dd>{formatPercent(fund.indirectEstimatedRatioPercent)}</dd></div>
        <div><dt>总估算经济暴露</dt><dd>{formatPercent(fund.totalEstimatedExposurePercent)}</dd></div>
      </dl>
    </article>
  );
}

export function PortfolioWorkbench(props: PortfolioWorkbenchProps) {
  const researchHook = props.useResearch ?? usePortfolioResearch;
  const model = researchHook({
    stocks: props.stocks,
    manifestUrl: props.manifestUrl,
    temporaryStockCode: props.temporaryStockCode,
    temporarySelection: props.temporarySelection ?? undefined,
    fetchImpl: props.fetchImpl,
  });
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerCode, setPickerCode] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerActiveIndex, setPickerActiveIndex] = useState<number | null>(null);
  const [view, setView] = useState<PortfolioView>("offExchange");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const tabRefs = useRef<Record<PortfolioView, HTMLButtonElement | null>>({ offExchange: null, onExchange: null });
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => setVisibleCount(PAGE_SIZE), [model.results, view]);

  useEffect(() => {
    if (!props.focusResult) return;
    const frame = window.requestAnimationFrame(() => {
      if (headingRef.current && typeof headingRef.current.scrollIntoView === "function") {
        headingRef.current.scrollIntoView({ behavior: "auto", block: "start", inline: "nearest" });
      }
      headingRef.current?.focus({ preventScroll: true });
      props.onResultFocused?.();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [props.focusResult, props.onResultFocused]);

  useEffect(() => {
    props.onLeaveGuard?.(model.requestLeave);
  }, [model.requestLeave, props.onLeaveGuard]);

  const selectedOptions = model.draft.stockCodes.map((code) => props.stocks.find((stock) => stock.code === code) ?? { code, name: code });
  const availableStocks = useMemo(
    () => props.stocks.filter((stock) => !model.draft.stockCodes.includes(stock.code)),
    [model.draft.stockCodes, props.stocks],
  );
  const normalizedPickerQuery = normalizeStockSearchTerm(pickerQuery);
  const pickerMatches = useMemo(() => {
    const matches = normalizedPickerQuery
      ? availableStocks.filter((stock) => (
        normalizeStockSearchTerm(stock.code).includes(normalizedPickerQuery)
        || normalizeStockSearchTerm(stock.name).includes(normalizedPickerQuery)
        || normalizeStockSearchTerm(formatPickerStock(stock)).includes(normalizedPickerQuery)
      ))
      : availableStocks;
    return matches.slice(0, STOCK_SEARCH_RESULT_LIMIT);
  }, [availableStocks, normalizedPickerQuery]);
  const explicitlySelectedStock = availableStocks.find((stock) => stock.code === pickerCode);
  const exactCodeStock = normalizedPickerQuery
    ? availableStocks.find((stock) => normalizeStockSearchTerm(stock.code) === normalizedPickerQuery)
    : undefined;
  const exactNameMatches = normalizedPickerQuery
    ? availableStocks.filter((stock) => normalizeStockSearchTerm(stock.name) === normalizedPickerQuery)
    : [];
  const exactDisplayStock = normalizedPickerQuery
    ? availableStocks.find((stock) => normalizeStockSearchTerm(formatPickerStock(stock)) === normalizedPickerQuery)
    : undefined;
  const exactQueryStock = exactCodeStock ?? exactDisplayStock ?? (exactNameMatches.length === 1 ? exactNameMatches[0] : undefined);
  const pickerStock = explicitlySelectedStock ?? exactQueryStock;
  const pickerListVisible = pickerOpen && model.draft.stockCodes.length < 10 && pickerMatches.length > 0;
  const pickerNoMatchVisible = pickerOpen && model.draft.stockCodes.length < 10 && normalizedPickerQuery.length > 0 && pickerMatches.length === 0;
  const pickerActiveDescendant = pickerListVisible && pickerActiveIndex !== null && pickerMatches[pickerActiveIndex]
    ? `portfolio-stock-search-option-${pickerMatches[pickerActiveIndex].code}`
    : undefined;

  useEffect(() => {
    if (!pickerActiveDescendant) return;
    const option = document.getElementById(pickerActiveDescendant);
    if (option && typeof option.scrollIntoView === "function") option.scrollIntoView({ block: "nearest" });
  }, [pickerActiveDescendant]);

  const selectPickerStock = (stock: PortfolioStockOption) => {
    setPickerCode(stock.code);
    setPickerQuery(formatPickerStock(stock));
    setPickerOpen(false);
    setPickerActiveIndex(null);
  };
  const resetPicker = () => {
    setPickerQuery("");
    setPickerCode("");
    setPickerOpen(false);
    setPickerActiveIndex(null);
  };
  const onPickerKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Tab") {
      setPickerOpen(false);
      setPickerActiveIndex(null);
      return;
    }
    if (event.key === "ArrowDown") {
      if (pickerMatches.length === 0) return;
      event.preventDefault();
      setPickerOpen(true);
      setPickerActiveIndex((current) => current === null ? 0 : Math.min(current + 1, pickerMatches.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      if (pickerMatches.length === 0) return;
      event.preventDefault();
      setPickerOpen(true);
      setPickerActiveIndex((current) => current === null ? pickerMatches.length - 1 : Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      const activeStock = pickerActiveIndex === null ? pickerStock : pickerMatches[pickerActiveIndex];
      if (activeStock) {
        event.preventDefault();
        selectPickerStock(activeStock);
      }
      return;
    }
    if (event.key === "Escape" && pickerOpen) {
      event.preventDefault();
      setPickerOpen(false);
      setPickerActiveIndex(null);
    }
  };

  const switchTab = (next: PortfolioView) => {
    setView(next);
    window.requestAnimationFrame(() => tabRefs.current[next]?.focus());
  };
  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      switchTab(view === "offExchange" ? "onExchange" : "offExchange");
    } else if (event.key === "Home") {
      event.preventDefault();
      switchTab("offExchange");
    } else if (event.key === "End") {
      event.preventDefault();
      switchTab("onExchange");
    }
  };
  const openDetail = (fund: AggregatedFundResult, trigger: HTMLButtonElement) => {
    detailTriggerRef.current = trigger;
    model.openDetail(fund);
  };
  const closeDetail = () => {
    model.closeDetail();
    const trigger = detailTriggerRef.current;
    window.requestAnimationFrame(() => {
      if (trigger?.isConnected) trigger.focus();
    });
  };

  return (
    <section className="portfolio-workbench" aria-label="多股票组合研究工作台">
      <div className="portfolio-status" aria-live="polite">
        {model.saveError ?? model.recoveryReason ?? ""}
      </div>
      <header className="portfolio-header">
        <div>
          <p className="portfolio-kicker">{model.isTemporary ? "临时单股票研究" : "股票组合研究"}</p>
          <h2 ref={headingRef} className="portfolio-result-focus" tabIndex={-1}>{model.draft.name || "未命名组合"}</h2>
          <p>{props.report} · 截至 {props.cutoffDate} · {model.draft.stockCodes.length} / 10 只 · 保存在当前浏览器</p>
        </div>
        <div className="portfolio-actions">
          <button type="button" onClick={(event) => model.create(event.currentTarget)}>新建</button>
          <button type="button" disabled={model.draft.stockCodes.length === 0} onClick={model.saveActive}>保存更改</button>
          <button type="button" disabled={model.draft.stockCodes.length === 0} onClick={() => model.saveAs(model.draft.name)}>另存为</button>
          <button type="button" disabled={model.activeBasketId === null} onClick={(event) => model.requestDelete(model.activeBasketId!, event.currentTarget)}>删除</button>
        </div>
      </header>

      <div className="portfolio-editor">
        <label>
          组合名称
          <input value={model.draft.name} maxLength={40} onChange={(event) => model.renameActive(event.target.value)} placeholder="输入组合名称" />
        </label>
        <label>
          切换已保存组合
          <select value={model.activeBasketId ?? ""} onChange={(event) => {
            if (event.target.value) model.requestSwitch(event.target.value, event.currentTarget);
          }}>
            <option value="">临时或未命名草稿</option>
            {model.baskets.map((basket) => <option key={basket.id} value={basket.id}>{basket.name}</option>)}
          </select>
        </label>
        <div className="portfolio-stock-search-field">
          <label htmlFor="portfolio-stock-search">添加股票</label>
          <div className="portfolio-stock-picker">
            <input
              id="portfolio-stock-search"
              type="search"
              role="combobox"
              aria-label="检索添加股票"
              aria-autocomplete="list"
              aria-controls={pickerListVisible ? STOCK_SEARCH_LIST_ID : undefined}
              aria-expanded={pickerListVisible}
              aria-activedescendant={pickerActiveDescendant}
              aria-describedby="portfolio-stock-search-hint"
              value={pickerQuery}
              disabled={model.draft.stockCodes.length >= 10}
              placeholder="输入代码或中文名称"
              onFocus={() => setPickerOpen(true)}
              onBlur={() => {
                setPickerOpen(false);
                setPickerActiveIndex(null);
              }}
              onChange={(event) => {
                setPickerQuery(event.target.value);
                setPickerCode("");
                setPickerOpen(true);
                setPickerActiveIndex(null);
              }}
              onKeyDown={onPickerKeyDown}
            />
            {pickerListVisible ? (
              <ul id={STOCK_SEARCH_LIST_ID} className="portfolio-stock-search-results" role="listbox" aria-label="匹配股票">
                {pickerMatches.map((stock, index) => (
                  <li
                    id={`portfolio-stock-search-option-${stock.code}`}
                    key={stock.code}
                    className="portfolio-stock-search-option"
                    role="option"
                    aria-selected={pickerActiveIndex === index}
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => selectPickerStock(stock)}
                  >
                    <strong>{stock.name} · </strong>
                    <code>{stock.code}</code>
                  </li>
                ))}
              </ul>
            ) : null}
            {pickerNoMatchVisible ? (
              <p className="portfolio-stock-search-empty" role="status">未找到匹配股票</p>
            ) : null}
          </div>
          <p id="portfolio-stock-search-hint" className="portfolio-stock-search-hint">支持股票代码、中文名称或名称片段检索</p>
        </div>
        <button type="button" className="portfolio-add-stock" disabled={!pickerStock || model.draft.stockCodes.length >= 10} onClick={() => {
          if (!pickerStock) return;
          model.addStock(pickerStock.code);
          resetPicker();
        }}>添加到组合</button>
      </div>
      <div className="portfolio-chips" aria-label="已选股票">
        {selectedOptions.map((stock) => (
          <span key={stock.code}>{stock.name} · {stock.code}<button type="button" onClick={() => model.removeStock(stock.code)} aria-label={`移除 ${stock.name} ${stock.code}`}>移除</button></span>
        ))}
      </div>

      {model.draft.stockCodes.length >= 10 ? <p className="portfolio-limit" role="status">已达到每个组合最多 10 只股票的上限，请先移除一只再添加。</p> : null}

      {model.draft.stockCodes.length === 0 ? <p className="portfolio-empty">请从上方搜索、热门标的或组合选择器添加股票后开始研究。</p> : null}
      {model.status === "loading" ? <p className="portfolio-loading" role="status">正在校验并加载完整组合结果…</p> : null}
      {model.status === "blocked" ? <div className="portfolio-blocked" role="alert"><p>{model.error}</p><button type="button" onClick={model.retry}>重试组合数据</button></div> : null}
      {model.status === "ready" && model.results ? (
        <div className={`portfolio-ready-layout${props.afterResultsReady ? " has-aside" : ""}`}>
          <div className="portfolio-result-main">
            <div className="portfolio-tabs" role="tablist" aria-label="基金结果分类">
            <button ref={(node) => { tabRefs.current.offExchange = node; }} id="portfolio-tab-off-exchange" type="button" role="tab" aria-selected={view === "offExchange"} aria-controls="portfolio-panel-off-exchange" tabIndex={view === "offExchange" ? 0 : -1} onClick={() => setView("offExchange")} onKeyDown={onTabKeyDown}>场外基金</button>
            <button ref={(node) => { tabRefs.current.onExchange = node; }} id="portfolio-tab-on-exchange" type="button" role="tab" aria-selected={view === "onExchange"} aria-controls="portfolio-panel-on-exchange" tabIndex={view === "onExchange" ? 0 : -1} onClick={() => setView("onExchange")} onKeyDown={onTabKeyDown}>场内 ETF / LOF</button>
            </div>
            {(["offExchange", "onExchange"] as const).map((panelView) => {
              const panelRows = model.results?.[panelView] ?? [];
              const isActive = panelView === view;
              return (
                <section
                  key={panelView}
                  id={`portfolio-panel-${panelView === "offExchange" ? "off-exchange" : "on-exchange"}`}
                  role="tabpanel"
                  aria-labelledby={`portfolio-tab-${panelView === "offExchange" ? "off-exchange" : "on-exchange"}`}
                  tabIndex={0}
                  hidden={!isActive}
                >
                  {panelRows.length === 0 ? <p className="portfolio-empty">该分类暂无匹配基金。</p> : panelRows.slice(0, visibleCount).map((fund, index) => <FundRow key={fund.fundFamilyKey} fund={fund} index={index} model={model} onOpenDetail={openDetail} />)}
                  {isActive && visibleCount < panelRows.length ? <button type="button" className="portfolio-load-more" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>加载更多（剩余 {panelRows.length - visibleCount} 条）</button> : null}
                </section>
              );
            })}
            <aside className="portfolio-disclosure">
              <strong>总估算经济暴露排序说明</strong>
              <p>这是公开披露期末、当前已采集公开股票持仓明细的方向性穿透估算，不等同于基金直接持有正股，不是实时持仓或投资建议。</p>
              <p>数据来源：{model.manifest?.source ?? "当前季度已采集公开股票持仓明细"}；发布季度 {model.manifest?.report ?? props.report}。公式：直接持仓 + 已识别正向杠杆 ETP 的间接估算。{model.results.coverage.disclosure} 未出现不代表未持有。基金详情最多展示 10 条。</p>
            </aside>
          </div>
          {props.afterResultsReady ? <aside className="portfolio-ready-aside">{props.afterResultsReady}</aside> : null}
        </div>
      ) : null}
      <UnsavedDialog model={model} />
      <DetailDialog model={model} onClose={closeDetail} />
    </section>
  );
}
