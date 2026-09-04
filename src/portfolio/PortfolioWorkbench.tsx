import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { canonicalizeSecurityCode, getSecurityIdentity } from "../securityIdentity";
import { PortfolioActionDialog, type PortfolioAction } from "./PortfolioActionDialog";
import { PortfolioFundResults, formatPercent } from "./PortfolioFundResults";

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
  fundHoldingsUrl: string;
  fetchImpl?: typeof fetch;
  afterResultsReady?: ReactNode;
  focusResult?: boolean;
  onResultFocused?(): void;
  onLeaveGuard?(guard: (action: () => void, trigger: HTMLElement | null) => void): void;
  onResearchContextChange?(context: { stockCodes: string[]; isTemporary: boolean; name: string }): void;
  useResearch?: (options: UsePortfolioResearchOptions) => PortfolioResearchModel;
}

function normalizeStockSearchTerm(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function formatPickerStock(stock: PortfolioStockOption): string {
  return `${stock.name} · ${stock.code}`;
}

type QdiiHolding = {
  securityId: string;
  rank: number;
  stockCode: string;
  stockName: string;
  ratioPercent: number;
  holdingType: string;
};

type QdiiH1Detail = {
  status: "available";
  fundCode: string;
  fundName: string;
  report: string;
  cutoffDate: string;
  sourceUrl: string;
  sourceTitle: string;
  equityHoldings: QdiiHolding[];
  fundInvestments: QdiiHolding[];
};

type QdiiH1Payload = {
  fundCodeAliases: Record<string, string>;
  fundStatuses: Record<string, { status?: string; reason?: string }>;
  fundHoldings: Record<string, QdiiH1Detail>;
};

type QdiiDetailState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "available"; detail: QdiiH1Detail }
  | { kind: "status"; reason: string }
  | { kind: "missing" }
  | { kind: "error"; reason: string };

const qdiiPayloadCache = new Map<typeof fetch, Map<string, Promise<QdiiH1Payload>>>();

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeQdiiHolding(value: unknown): QdiiHolding | null {
  if (!isObject(value) || typeof value.securityId !== "string" || typeof value.stockName !== "string") return null;
  if (!Number.isInteger(value.rank) || (value.rank as number) < 1 || typeof value.ratioPercent !== "number" || !Number.isFinite(value.ratioPercent)) return null;
  return {
    securityId: value.securityId,
    rank: value.rank as number,
    stockCode: typeof value.stockCode === "string" ? value.stockCode : "",
    stockName: value.stockName,
    ratioPercent: value.ratioPercent,
    holdingType: typeof value.holdingType === "string" ? value.holdingType : "基金投资",
  };
}

function normalizeQdiiDetail(value: unknown): QdiiH1Detail | null {
  if (!isObject(value) || value.status !== "available" || typeof value.fundCode !== "string" || typeof value.fundName !== "string") return null;
  if (!Array.isArray(value.equityHoldings) || !Array.isArray(value.fundInvestments)) return null;
  const equityHoldings = value.equityHoldings.map(normalizeQdiiHolding);
  const fundInvestments = value.fundInvestments.map(normalizeQdiiHolding);
  if (
    equityHoldings.some((holding) => holding === null) ||
    fundInvestments.some((holding) => holding === null) ||
    fundInvestments.length > 10
  ) return null;
  return {
    status: "available",
    fundCode: value.fundCode,
    fundName: value.fundName,
    report: typeof value.report === "string" ? value.report : "2026H1",
    cutoffDate: typeof value.cutoffDate === "string" ? value.cutoffDate : "",
    sourceUrl: typeof value.sourceUrl === "string" ? value.sourceUrl : "",
    sourceTitle: typeof value.sourceTitle === "string" ? value.sourceTitle : "证监会基金电子披露平台中期报告",
    equityHoldings: equityHoldings as QdiiHolding[],
    fundInvestments: fundInvestments as QdiiHolding[],
  };
}

function normalizeQdiiPayload(value: unknown): QdiiH1Payload {
  if (!isObject(value) || !isObject(value.fundCodeAliases) || !isObject(value.fundStatuses) || !isObject(value.fundHoldings)) {
    throw new Error("QDII 半年度持仓数据格式无效。");
  }
  const aliases = Object.fromEntries(Object.entries(value.fundCodeAliases).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  const statuses = Object.fromEntries(Object.entries(value.fundStatuses).filter((entry): entry is [string, { status?: string; reason?: string }] => isObject(entry[1])));
  const holdings = Object.fromEntries(Object.entries(value.fundHoldings).map(([code, detail]) => [code, normalizeQdiiDetail(detail)]).filter((entry): entry is [string, QdiiH1Detail] => entry[1] !== null));
  return { fundCodeAliases: aliases, fundStatuses: statuses, fundHoldings: holdings };
}

function loadQdiiPayload(url: string, fetchImpl?: typeof fetch): Promise<QdiiH1Payload> {
  const client = fetchImpl ?? fetch;
  let cache = qdiiPayloadCache.get(client);
  if (!cache) {
    cache = new Map<string, Promise<QdiiH1Payload>>();
    qdiiPayloadCache.set(client, cache);
  }
  const existing = cache.get(url);
  if (existing) return existing;
  const pending = client(url)
    .then((response) => {
      if (!response.ok) throw new Error(`QDII 半年度持仓请求失败 (HTTP ${response.status})`);
      return response.json();
    })
    .then(normalizeQdiiPayload)
    .catch((error: unknown) => {
      cache?.delete(url);
      throw error;
    });
  cache.set(url, pending);
  return pending;
}

function isQdiiFund(fund: AggregatedFundResult | null): boolean {
  return fund !== null && (fund.isQdii || /QDII/i.test(`${fund.fundName} ${fund.fundType}`));
}

function useQdiiH1Detail(
  fund: AggregatedFundResult | null,
  url: string,
  fetchImpl?: typeof fetch,
  retryToken = 0,
): QdiiDetailState {
  const [state, setState] = useState<QdiiDetailState>({ kind: "idle" });
  const fundCodes = fund ? [fund.fundCode, ...fund.fundVariantCodes].join("\u0000") : "";
  const qdii = isQdiiFund(fund);

  useEffect(() => {
    if (!qdii || fund === null) {
      setState({ kind: "idle" });
      return;
    }
    let cancelled = false;
    setState({ kind: "loading" });
    void loadQdiiPayload(url, fetchImpl).then((payload) => {
      if (cancelled) return;
      const codes = [fund.fundCode, ...fund.fundVariantCodes];
      for (const code of codes) {
        const canonicalCode = payload.fundCodeAliases[code] ?? code;
        const detail = payload.fundHoldings[canonicalCode];
        if (detail) {
          setState({ kind: "available", detail });
          return;
        }
      }
      const status = codes.map((code) => payload.fundStatuses[code]).find(Boolean);
      if (status?.reason) {
        setState({ kind: "status", reason: status.reason });
        return;
      }
      setState({ kind: "missing" });
    }).catch((error: unknown) => {
      if (cancelled) return;
      setState({ kind: "error", reason: error instanceof Error ? error.message : "QDII 半年度持仓暂时不可用。" });
    });
    return () => { cancelled = true; };
  }, [fetchImpl, fund, fundCodes, qdii, retryToken, url]);
  return state;
}

type DetailHolding = Omit<QdiiHolding, "securityId" | "holdingType"> & { securityId?: string; holdingType?: string };
type DetailSort = "ratio" | "name" | "report";

function filterHoldings(holdings: DetailHolding[], query: string, selectedCodes: Set<string> | null, sort: DetailSort): DetailHolding[] {
  const needle = normalizeStockSearchTerm(query).replace(/\s+/g, "");
  return holdings.map((holding, originalIndex) => ({ holding, originalIndex })).filter(({ holding }) => {
    const identity = getSecurityIdentity(holding.stockCode, holding.stockName);
    const matchesSelection = !selectedCodes || selectedCodes.has(canonicalizeSecurityCode(holding.stockCode));
    const searchText = [holding.stockCode, holding.stockName, identity.name, ...identity.aliases].join(" ").toLocaleLowerCase().replace(/\s+/g, "");
    return matchesSelection && (!needle || searchText.includes(needle));
  }).sort((left, right) => {
    if (sort === "ratio") return right.holding.ratioPercent - left.holding.ratioPercent || left.originalIndex - right.originalIndex;
    if (sort === "name") return getSecurityIdentity(left.holding.stockCode, left.holding.stockName).name.localeCompare(getSecurityIdentity(right.holding.stockCode, right.holding.stockName).name, "zh-CN") || left.originalIndex - right.originalIndex;
    return left.originalIndex - right.originalIndex;
  }).map(({ holding }) => holding);
}

function HoldingList({ holdings }: { holdings: DetailHolding[] }) {
  return (
    <ol className="portfolio-detail-holdings">
      {holdings.map((holding, index) => {
        const identity = getSecurityIdentity(holding.stockCode, holding.stockName);
        const displayName = identity.identityStatus === "verified" ? identity.name : holding.stockName;
        return <li key={holding.securityId ?? `${holding.rank}-${holding.stockCode}-${index}`}>
          <span className="portfolio-display-rank" aria-label={`展示序号 ${index + 1}`}>{index + 1}</span>
          <div className="portfolio-holding-name"><strong>{displayName}{holding.holdingType === "ETF" ? "（ETF）" : holding.holdingType === "基金投资" ? "（基金）" : ""}</strong><details><summary>原文 · 序号 {holding.rank}</summary><p>{holding.stockName} · {holding.stockCode || "未披露代码"}</p></details></div>
          <code>{identity.identityStatus === "verified" ? identity.code : holding.stockCode || "报告未披露代码"}</code>
          <b>{formatPercent(holding.ratioPercent)}</b>
        </li>;
      })}
    </ol>
  );
}

function DetailDialog({
  model,
  onClose,
  fundHoldingsUrl,
  fetchImpl,
}: {
  model: PortfolioResearchModel;
  onClose(): void;
  fundHoldingsUrl: string;
  fetchImpl?: typeof fetch;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState("");
  const [onlySelected, setOnlySelected] = useState(false);
  const [sort, setSort] = useState<DetailSort>("ratio");
  const [qdiiRetryToken, setQdiiRetryToken] = useState(0);

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
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [href], [tabindex]:not([tabindex="-1"])',
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
  }, [model.detail.kind === "idle"]);

  const fund = model.detail.kind === "idle" ? null : model.detail.fund;
  useEffect(() => {
    setQuery("");
    setOnlySelected(false);
    setSort("ratio");
  }, [fund?.fundFamilyKey]);
  const qdiiFund = isQdiiFund(fund);
  const qdiiDetail = useQdiiH1Detail(fund, fundHoldingsUrl, fetchImpl, qdiiRetryToken);
  const selectedCodes = onlySelected ? new Set([
    ...model.draft.stockCodes.map(canonicalizeSecurityCode),
    ...(fund?.contributions.flatMap((contribution) => contribution.indirectSources.map((source) => canonicalizeSecurityCode(source.sourceCode))) ?? []),
  ]) : null;
  const filteredEquities = qdiiDetail.kind === "available" ? filterHoldings(qdiiDetail.detail.equityHoldings, query, selectedCodes, sort) : [];
  const filteredInvestments = qdiiDetail.kind === "available" ? filterHoldings(qdiiDetail.detail.fundInvestments, query, selectedCodes, sort) : [];
  const filteredOrdinary = model.detail.kind === "available" ? filterHoldings(model.detail.record.holdings.slice(0, 10), query, selectedCodes, sort) : [];
  const resetFilters = () => { setQuery(""); setOnlySelected(false); };
  if (model.detail.kind === "idle" || fund === null) return null;
  return (
    <div className="portfolio-dialog-backdrop" role="presentation">
      <section ref={dialogRef} className="portfolio-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="portfolio-detail-title">
        <div className="portfolio-detail-toolbar">
        <div className="portfolio-dialog-heading">
          <div>
            <h3 id="portfolio-detail-title">{fund.fundDisplayName}</h3>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="关闭基金持仓详情">关闭</button>
        </div>
        <div className="portfolio-detail-filters">
          <label>查找<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="名称或代码" /></label>
          <label>排序<select value={sort} onChange={(event) => setSort(event.target.value as DetailSort)}><option value="ratio">净值占比 ↓</option><option value="name">名称</option><option value="report">报告顺序</option></select></label>
          <label className="portfolio-detail-filter-check"><input type="checkbox" checked={onlySelected} onChange={(event) => setOnlySelected(event.target.checked)} />仅研究标的</label>
        </div>
        </div>
        <div className="portfolio-detail-body">
        {model.detail.kind === "loading" && qdiiDetail.kind !== "available" ? <p role="status">加载持仓…</p> : null}
        {qdiiDetail.kind === "loading" ? <p className="portfolio-detail-scope" role="status">加载中期持仓…</p> : null}
        {qdiiDetail.kind === "available" ? (
          <div className="portfolio-qdii-detail">
            <p className="portfolio-detail-scope">{qdiiDetail.detail.report} · {qdiiDetail.detail.cutoffDate} · 期末披露，非实时持仓。</p>
            <h4>权益投资 · 完整披露</h4>
            <p className="portfolio-detail-match-count" role="status">显示 {filteredEquities.length} / {qdiiDetail.detail.equityHoldings.length} 条</p>
            {filteredEquities.length ? <HoldingList holdings={filteredEquities} /> : qdiiDetail.detail.equityHoldings.length ? <p className="portfolio-detail-not-captured">无匹配权益。<button type="button" onClick={resetFilters}>清除筛选</button></p> : <p className="portfolio-detail-not-captured">未披露权益明细，不代表没有其他资产。</p>}
            <h4>基金 / ETF · 仅前十项</h4>
            <p className="portfolio-detail-match-count">显示 {filteredInvestments.length} / {qdiiDetail.detail.fundInvestments.length} 条</p>
            {filteredInvestments.length ? <HoldingList holdings={filteredInvestments} /> : qdiiDetail.detail.fundInvestments.length ? <p className="portfolio-detail-not-captured">无匹配基金 / ETF。</p> : <p className="portfolio-detail-not-captured">未披露基金 / ETF 明细。</p>}
            {qdiiDetail.detail.sourceUrl ? <a className="portfolio-detail-source" href={qdiiDetail.detail.sourceUrl} target="_blank" rel="noreferrer" title={qdiiDetail.detail.sourceTitle}>官方报告</a> : null}
          </div>
        ) : null}
        {qdiiDetail.kind === "status" ? <p className="portfolio-detail-not-captured">{qdiiDetail.reason}</p> : null}
        {qdiiDetail.kind === "missing" ? <p className="portfolio-detail-not-captured">未匹配中期明细，不代表没有持仓。</p> : null}
        {qdiiDetail.kind === "error" ? <div className="portfolio-detail-error" role="alert"><p>中期持仓加载失败，请重试。</p><button type="button" onClick={() => setQdiiRetryToken((token) => token + 1)}>重试中期持仓</button><details><summary>错误详情</summary><p>{qdiiDetail.reason}</p></details></div> : null}
        {model.detail.kind === "available" && (!qdiiFund || qdiiDetail.kind === "status" || qdiiDetail.kind === "missing" || qdiiDetail.kind === "error") ? (
          <div><p className="portfolio-detail-scope">{model.manifest?.report ?? "当前报告期"} · 份额 {model.detail.record.detailFundCode} · 已采集季度股票，最多十条。未出现不代表未持有。</p><p className="portfolio-detail-match-count" role="status">显示 {filteredOrdinary.length} / {Math.min(10, model.detail.record.holdings.length)} 条</p>{filteredOrdinary.length ? <HoldingList holdings={filteredOrdinary} /> : <p className="portfolio-detail-not-captured">无匹配持仓。<button type="button" onClick={resetFilters}>清除筛选</button></p>}</div>
        ) : null}
        {model.detail.kind === "notCaptured" && qdiiDetail.kind !== "available" && qdiiDetail.kind !== "loading" ? (
          <p className="portfolio-detail-not-captured">{model.detail.message} 未出现不代表未持有。</p>
        ) : null}
        {model.detail.kind === "unavailable" && qdiiDetail.kind !== "available" && qdiiDetail.kind !== "loading" ? (
          <div className="portfolio-detail-error" role="alert">
            <p>{model.detail.reason}</p>
            <button type="button" onClick={model.retryDetail}>重试详情</button>
          </div>
        ) : null}
        <details className="portfolio-detail-filter-hint"><summary>详情口径</summary><p>列表序号为当前展示顺序；报告原序号与名称可逐条展开。“仅研究标的”包含已识别的相关间接产品。以上均为期末披露，未出现不代表未持有。</p></details>
        </div>
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
        <h3 id="portfolio-unsaved-title">有未保存更改</h3>
        <p>离开前保存当前组合？</p>
        {model.saveError ? <p className="portfolio-action-error" role="alert">{model.saveError}</p> : null}
        <div className="portfolio-dialog-actions">
          <button type="button" className="portfolio-primary" onClick={() => model.resolveUnsavedDecision("save")}>保存</button>
          <button type="button" onClick={() => model.resolveUnsavedDecision("discard")}>放弃</button>
          <button ref={cancelRef} type="button" onClick={() => model.resolveUnsavedDecision("cancel")}>取消</button>
        </div>
      </section>
    </div>
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
  const [action, setAction] = useState<PortfolioAction | null>(null);
  const tabRefs = useRef<Record<PortfolioView, HTMLButtonElement | null>>({ offExchange: null, onExchange: null });
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => setVisibleCount(PAGE_SIZE), [model.results, view]);

  useEffect(() => {
    if (!props.focusResult || model.status !== "ready") return;
    const frame = window.requestAnimationFrame(() => {
      if (headingRef.current && typeof headingRef.current.scrollIntoView === "function") {
        headingRef.current.scrollIntoView({ behavior: "auto", block: "start", inline: "nearest" });
      }
      headingRef.current?.focus({ preventScroll: true });
      props.onResultFocused?.();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [props.focusResult, props.onResultFocused, model.status]);

  useEffect(() => {
    props.onLeaveGuard?.(model.requestLeave);
  }, [model.requestLeave, props.onLeaveGuard]);

  useEffect(() => {
    props.onResearchContextChange?.({ stockCodes: model.draft.stockCodes, isTemporary: model.isTemporary, name: model.draft.name });
  }, [model.draft.stockCodes, model.draft.name, model.isTemporary, props.onResearchContextChange]);

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
        || stock.aliases?.some((alias) => normalizeStockSearchTerm(alias).includes(normalizedPickerQuery))
      ))
      : availableStocks;
    return matches.slice(0, STOCK_SEARCH_RESULT_LIMIT);
  }, [availableStocks, normalizedPickerQuery]);
  const explicitlySelectedStock = availableStocks.find((stock) => stock.code === pickerCode);
  const exactCodeStock = normalizedPickerQuery
    ? availableStocks.find((stock) => normalizeStockSearchTerm(stock.code) === normalizedPickerQuery || stock.aliases?.some((alias) => normalizeStockSearchTerm(alias) === normalizedPickerQuery))
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
      <div className={`portfolio-status${model.saveError ? " has-error" : ""}`} aria-live="polite">
        <strong className={model.activeBasketId && !model.dirty ? "portfolio-saved" : "portfolio-unsaved"}>{model.activeBasketId && !model.dirty ? "已保存" : "未保存"}</strong>
        {model.saveError ? <span>{model.saveError}</span> : model.recoveryReason ? <details><summary>恢复说明</summary><p>{model.recoveryReason}</p></details> : null}
      </div>
      <header className="portfolio-header">
        <div>
          <p className="portfolio-kicker">{model.isTemporary && model.draft.stockCodes.length === 1 ? "单股" : "组合"} · {model.draft.stockCodes.length} / 10 只</p>
          <h2>{model.draft.name || "未命名组合"}</h2>
        </div>
        <div className="portfolio-actions">
          <button type="button" className="portfolio-primary" disabled={model.draft.stockCodes.length === 0 || (model.activeBasketId !== null && !model.dirty)} onClick={model.saveActive}>{model.activeBasketId ? "保存更改" : "保存组合"}</button>
          <button type="button" onClick={(event) => model.create(event.currentTarget)}>新建</button>
          <button type="button" disabled={model.draft.stockCodes.length === 0} onClick={(event) => setAction({ kind: "saveAs", trigger: event.currentTarget })}>另存为</button>
          <details className="portfolio-more-actions"><summary>更多</summary><button type="button" className="portfolio-danger" disabled={model.activeBasketId === null} onClick={(event) => setAction({ kind: "delete", trigger: event.currentTarget })}>删除组合</button></details>
        </div>
      </header>

      <div className="portfolio-editor">
        <label>
          组合名称
          <input value={model.draft.name} maxLength={40} onChange={(event) => model.renameActive(event.target.value)} placeholder="输入组合名称" />
        </label>
        <label>
          本机组合
          <select id="saved-portfolio-select" value={model.activeBasketId ?? ""} onChange={(event) => {
            if (event.target.value) model.requestSwitch(event.target.value, event.currentTarget);
          }}>
            <option value="">未保存草稿</option>
            {model.baskets.map((basket) => <option key={basket.id} value={basket.id}>{basket.name}</option>)}
          </select>
        </label>
        <div className="portfolio-stock-search-field">
          <label htmlFor="portfolio-stock-search">加入当前组合</label>
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
              placeholder="名称或代码"
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
          <p id="portfolio-stock-search-hint" className="portfolio-visually-hidden">选择后追加到当前组合，保留已选股票。支持代码、名称与已确认别名。</p>
          <button type="button" className="portfolio-add-stock" disabled={!pickerStock || model.draft.stockCodes.length >= 10} onClick={() => {
            if (!pickerStock) return;
            model.addStock(pickerStock.code);
            resetPicker();
          }}>加入组合</button>
        </div>
      </div>
      <div className="portfolio-chips" aria-label="已选股票">
        {selectedOptions.map((stock) => (
          <span key={stock.code}>{stock.name} · {stock.code}<button type="button" onClick={() => model.removeStock(stock.code)} aria-label={`移除 ${stock.name} ${stock.code}`}>移除</button></span>
        ))}
      </div>

      {model.draft.stockCodes.length >= 10 ? <p className="portfolio-limit" role="status">已满 10 只，请先移除一只再添加。</p> : null}

      {model.draft.stockCodes.length === 0 ? <p className="portfolio-empty">添加股票，查看持有它们的基金。</p> : null}
      {model.status === "loading" ? <p className="portfolio-loading" role="status">校验并加载结果…</p> : null}
      {model.status === "blocked" ? <div className="portfolio-blocked" role="alert"><p>{model.error}</p><button type="button" onClick={model.retry}>重试</button></div> : null}
      {model.status === "ready" && model.results ? (
        <div className={`portfolio-ready-layout${props.afterResultsReady ? " has-aside" : ""}`}>
          <div className="portfolio-result-main">
            <div className="portfolio-results-heading">
              <div><h3 ref={headingRef} className="portfolio-result-focus" tabIndex={-1}>{selectedOptions.length === 1 ? `${selectedOptions[0].name} · ${selectedOptions[0].code}` : model.draft.name || "当前组合"} 的基金</h3></div>
              <button type="button" className="portfolio-return-editor" onClick={() => {
                const input = document.getElementById("portfolio-stock-search");
                input?.scrollIntoView({ behavior: "auto", block: "center" });
                input?.focus({ preventScroll: true });
              }}>编辑组合</button>
            </div>
            <div className="portfolio-tabs" role="tablist" aria-label="基金结果分类">
            <button ref={(node) => { tabRefs.current.offExchange = node; }} id="portfolio-tab-off-exchange" type="button" role="tab" aria-selected={view === "offExchange"} aria-controls="portfolio-panel-off-exchange" tabIndex={view === "offExchange" ? 0 : -1} onClick={() => setView("offExchange")} onKeyDown={onTabKeyDown}>场外基金（{model.results.offExchange.length}）</button>
            <button ref={(node) => { tabRefs.current.onExchange = node; }} id="portfolio-tab-on-exchange" type="button" role="tab" aria-selected={view === "onExchange"} aria-controls="portfolio-panel-on-exchange" tabIndex={view === "onExchange" ? 0 : -1} onClick={() => setView("onExchange")} onKeyDown={onTabKeyDown}>场内 ETF / LOF（{model.results.onExchange.length}）</button>
            </div>
            <p className="portfolio-result-summary">占基金净值 · 期末披露，非实时持仓 · 未披露不代表未持有。</p>
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
                  <p className="portfolio-result-count" role={isActive ? "status" : undefined}>显示 {Math.min(visibleCount, panelRows.length)} / {panelRows.length} 只</p>
                  {panelRows.length === 0 ? <p className="portfolio-empty">该分类暂无匹配基金。未出现不代表未持有。</p> : <PortfolioFundResults funds={panelRows.slice(0, visibleCount)} report={model.manifest?.report ?? props.report} cutoffDate={model.manifest?.cutoffDate ?? props.cutoffDate} onOpenDetail={openDetail} />}
                  {isActive && visibleCount < panelRows.length ? <button type="button" className="portfolio-load-more" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>更多（{panelRows.length - visibleCount}）</button> : null}
                </section>
              );
            })}
            <details className="portfolio-disclosure">
              <summary>计算口径</summary>
              <p>场内 / 场外按交易场景分类，均可能包含主动或指数产品；同一基金家族的不同份额只计一只。</p>
              <p>总估算暴露 = 直接持仓 + 已识别正向杠杆 ETP 间接估算。间接估算 = 产品原占比 × 杠杆倍数，来源为已披露基金 / ETF 投资及已核实产品映射。估算不等同于直接持有正股，也不构成投资建议。总估算暴露相同时，按直接暴露降序、基金代码升序。</p>
              <p>{model.manifest?.report ?? props.report} · 截至 {model.manifest?.cutoffDate ?? props.cutoffDate} · 来源：{model.manifest?.source ?? "已采集公开股票持仓明细"}。{model.results.coverage.disclosure}</p>
              <p>普通基金详情最多十条；QDII 权益展示中期报告全部已披露明细，基金 / ETF 仅前十项。未披露或未采集不代表未持有。</p>
            </details>
          </div>
          {props.afterResultsReady ? <aside className="portfolio-ready-aside">{props.afterResultsReady}</aside> : null}
        </div>
      ) : null}
      {action ? <PortfolioActionDialog action={action} model={model} onClose={() => setAction(null)} /> : null}
      <UnsavedDialog model={model} />
      <DetailDialog
        model={model}
        onClose={closeDetail}
        fundHoldingsUrl={props.fundHoldingsUrl}
        fetchImpl={props.fetchImpl}
      />
    </section>
  );
}
