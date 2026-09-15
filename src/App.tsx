import {
  ArrowUpDown,
  BarChart3,
  CalendarDays,
  Database,
  Loader2,
  MessageSquareText,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { FormEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from "react";import { Component, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import aiBattleHotspotsData from "../config/ai-battle-hotspots.json";
import { fundQuarter } from "./fundQuarter";
import { installInputModalityTracking } from "./inputModality";
import { appPagePath, pageFromLegacyHash, pageFromPathname, type AppPage } from "./pageRoute";
import { PortfolioWorkbench } from "./portfolio/PortfolioWorkbench";
import { stockLogoFiles } from "./generated/stockLogoFiles";
import { canonicalizeSecurityCode, getSecurityIdentity, getSecurityMarket, SECURITY_IDENTITY_REVISION } from "./securityIdentity";

type AccessMode = "offExchange" | "onExchange";

const LazyLeverageDashboard = lazy(() =>
  import("./leverage/LeverageDashboard").then(({ LeverageDashboard }) => ({
    default: LeverageDashboard,
  })),
);
const LazyTradingConcentrationDashboard = lazy(() =>
  import("./concentration/TradingConcentrationDashboard").then(({ TradingConcentrationDashboard }) => ({
    default: TradingConcentrationDashboard,
  })),
);
const LazyLeverageMarketSummary = lazy(() =>
  import("./leverage/LeverageMarketSummary").then(({ LeverageMarketSummary }) => ({
    default: LeverageMarketSummary,
  })),
);

function MarketSummaryFallback() {
  return (
    <section className="leverage-market-summary" aria-label="市场环境" role="status" aria-live="polite">
      <h3>市场环境</h3>
      <p>摘要暂不可用</p>
      <a className="leverage-market-summary-link" href={appPagePath("leverage")} aria-label="打开完整两融数据看板">
        查看两融
      </a>
    </section>
  );
}

class MarketSummaryBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? <MarketSummaryFallback /> : this.props.children;
  }
}

type FundRecord = {
  fundCode: string;
  fundName: string;
  fundType: string;
  ratioPercent: number;
  marketValueWan: number | null;
  sharesWan: number;
  purchaseStatus?: string;
  redemptionStatus?: string;
  minPurchase?: string;
  dailyPurchaseLimit?: string;
  fundVariantCount?: number;
  fundVariantCodes?: string[];
  fundDisplayName?: string;
};

type IndirectExposureRecord = FundRecord & {
  sourceCode: string;
  sourceName: string;
  targetCode: string;
  targetName: string;
  exposureType: string;
  exposureTypeLabel: string;
  leverageMultiple?: number | null;
  estimatedRatioPercent?: number | null;
  matchReason?: string;
};

type StockRecord = {
  code: string;
  name: string;
  aliases?: string[];
  marketLabel?: string;
  exchange?: string;
  identityStatus?: "verified" | "disclosed" | "pending";
  offExchangeFundCount?: number;
  portfolioOnExchangeFundCount?: number;
  fundCount: number;
  activeFundCount: number;
  onExchangeFundCount?: number;
  excludedIndexFundCount: number;
  totalMarketValueWan: number | null;
  onExchangeTotalMarketValueWan?: number | null;
  maxRatioPercent: number;
  onExchangeMaxRatioPercent?: number;
  indirectExposureFundCount?: number;
  indirectExposureShareClassCount?: number;
  indirectExposureMaxEstimatedRatioPercent?: number;
  topByRatio: FundRecord[];
  topByValue: FundRecord[];
  topOnExchangeByRatio?: FundRecord[];
  topIndirectExposureByRatio?: IndirectExposureRecord[];
};

type PopularStock = Pick<
  StockRecord,
  "code" | "name" | "fundCount" | "activeFundCount" | "maxRatioPercent" | "aliases" | "marketLabel" | "exchange" | "identityStatus" | "offExchangeFundCount" | "portfolioOnExchangeFundCount"
>;

type FundStockIndex = {
  meta: {
    report: string;
    generatedAt: string;
    sourceFile?: string;
    sourceRows: number;
    stockCount: number;
    defaultRankingLabel: string;
    alternateRankingLabel: string;
    cutoffDate: string;
    fundCount?: number;
    holdingRows?: number;
    popularScope?: string;
    popularScopeLabel?: string;
    overseasStockCount?: number;
    totalStockCount?: number;
    shippedStockScope?: string;
    shippedStockCount?: number;
  };
  popularStocks: PopularStock[];
  stocks: StockRecord[];
};

const popularMarketFilters = [
  { key: "us", label: "美股" },
  { key: "jp", label: "日股" },
  { key: "kr", label: "韩股" },
  { key: "hk", label: "香港" },
  { key: "other", label: "其他" },
] as const;

type PopularMarketFilter = (typeof popularMarketFilters)[number]["key"];
type MarketBucket = PopularMarketFilter | "a";

type AiBattleHotspot = {
  code: string;
  label: string;
  track: string;
  thesis: string;
  evidence: string;
  homepageQuickEntry?: boolean;
};

const numberFormatter = new Intl.NumberFormat("zh-CN");
const valueFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 2,
});
const FUND_STOCK_DATA_URL = `${fundQuarter.dataUrl}&identity=${SECURITY_IDENTITY_REVISION}`;
const QDII_HOLDINGS_URL = `${fundQuarter.qdiiHoldingsUrl}&identity=${SECURITY_IDENTITY_REVISION}`;
const STOCK_SEARCH_LIST_ID = "stock-search-suggestions";

function getDialogFocusableElements(container: HTMLElement | null) {
  if (!container) return [];

  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => element.getAttribute("aria-hidden") !== "true" && element.getClientRects().length > 0);
}

const aiBattleHotspots = aiBattleHotspotsData as AiBattleHotspot[];
const homepageQuickHotspots = aiBattleHotspots.filter((hotspot) => hotspot.homepageQuickEntry);

function getInitialQuery() {
  const stockCode = getInitialSearchParam("stock");
  const query = getInitialSearchParam("q");
  return query || stockCode || "";
}

function getInitialSelectedCode() {
  const code = getInitialSearchParam("stock");
  return code ? canonicalizeSecurityCode(code) : null;
}

function getInitialPage(): AppPage {
  if (typeof window === "undefined") {
    return "research";
  }

  const routePage = pageFromPathname(window.location.pathname);
  return routePage === "research" ? pageFromLegacyHash(window.location.hash) ?? routePage : routePage;
}

function getInitialSearchParam(name: string) {
  if (typeof window === "undefined") {
    return "";
  }

  return new URLSearchParams(window.location.search).get(name)?.trim() ?? "";
}

function normalize(input: string) {
  return input.trim().replace(/\s+/g, "").toLowerCase();
}

// 只请求构建时确认存在的本地图标；未收录的证券直接使用文字占位，避免首次渲染产生 404。
// 个别文件使用供应商后缀命名，保留显式映射以继续显示已有品牌图标。
const localLogoFileAliases: Record<string, string> = {
  "285a": "285ajp",
  "6981": "mur",
};

function localStockLogoUrl(code: string) {
  const normalizedCode = normalizeStockCode(code).toLowerCase();
  if (!normalizedCode) return null;
  const filename = localLogoFileAliases[normalizedCode] ?? normalizedCode;
  return stockLogoFiles.has(filename) ? `/stock-logos/${filename}.png` : null;
}

export function stockLogoSources(code: string) {
  const localUrl = localStockLogoUrl(code);
  return localUrl ? [localUrl] : [];
}

function stockMarketBucket(code: string, name = ""): MarketBucket {
  return getSecurityMarket(code, name);
}

function isOverseasStockCode(code: string, name = "") {
  return stockMarketBucket(code, name) !== "a";
}

function marketLabel(code: string, name = "") {
  return getSecurityIdentity(code, name).marketLabel;
}

function stockFundCountLabel(stock: PopularStock | StockRecord) {
  return typeof stock.offExchangeFundCount === "number"
    ? `${numberFormatter.format(stock.offExchangeFundCount)} 只场外基金`
    : `${numberFormatter.format(stock.activeFundCount)} 只主动基金（摘要口径）`;
}

function hasWanValue(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeStockCode(code: string) {
  return canonicalizeSecurityCode(code).replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

function StockLogo({
  code,
  name,
  size = "sm",
}: {
  code: string;
  name: string;
  size?: "sm" | "lg";
}) {
  const sources = useMemo(() => stockLogoSources(code), [code]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const src = sources[sourceIndex];

  useEffect(() => {
    setSourceIndex(0);
    setFailed(false);
  }, [sources]);

  const initials = useMemo(() => {
    const clean = code.replace(/[^0-9A-Za-z]/g, "").replace(/^0+/, "");
    const fallback = name.replace(/\s+/g, "").slice(0, 2);
    return clean ? clean.slice(0, 2).toUpperCase() : fallback || "?";
  }, [code, name]);

  const gradientClass = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      hash = code.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % 5;
    return `stock-logo-fallback-grad-${index}`;
  }, [code]);

  if (failed || !src) {
    return (
      <span className={`stock-logo stock-logo-fallback ${gradientClass} ${size === "lg" ? "large" : ""}`}>
        {initials}
      </span>
    );
  }

  return (
    <span className={`stock-logo ${size === "lg" ? "large" : ""}`}>
      <img
        alt={`${name} 品牌图标`}
        src={src}
        loading={size === "lg" ? "eager" : "lazy"}
        fetchPriority={size === "lg" ? "high" : "auto"}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => {
          if (sourceIndex < sources.length - 1) {
            setSourceIndex((current) => current + 1);
          } else {
            setFailed(true);
          }
        }}
      />
    </span>
  );
}

function findMatches(stocks: StockRecord[], query: string) {
  const needle = normalize(query);
  const canonicalNeedle = normalize(canonicalizeSecurityCode(query));
  if (!needle) {
    return [];
  }

  return stocks
    .map((stock) => {
      const code = normalize(stock.code);
      const name = normalize(stock.name);
      const aliases = (stock.aliases ?? []).map(normalize);
      let score = 0;

      if (code === canonicalNeedle || code === needle || name === needle || aliases.includes(needle)) score = 1000;
      else if (code.startsWith(needle) || name.startsWith(needle)) score = 700;
      else if (code.includes(needle) || name.includes(needle) || aliases.some((alias) => alias.includes(needle))) score = 400;

      return { stock, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || (b.stock.offExchangeFundCount ?? b.stock.activeFundCount) - (a.stock.offExchangeFundCount ?? a.stock.activeFundCount))
    .slice(0, 8)
    .map((item) => item.stock);
}

function SkeletonCandidate() {
  return (
    <div className="candidate skeleton">
      <span>
        <strong className="skeleton-line skeleton-title-width" />
        <em className="skeleton-line skeleton-code-width" />
      </span>
      <span>
        <span className="skeleton-line skeleton-metric-width" />
      </span>
    </div>
  );
}

function SkeletonResults() {
  return (
    <>
      <div className="result-header">
        <div>
          <p className="eyeline">正在载入重仓分析...</p>
          <h2 className="skeleton-line skeleton-title-width-large" />
        </div>
      </div>
      
      <div className="metrics-grid">
        {[1, 2, 3].map((i) => (
          <div key={i} className="metric skeleton">
            <div className="metric-icon skeleton-icon" />
            <div>
              <p className="skeleton-line skeleton-metric-label" />
              <strong className="skeleton-line skeleton-metric-value" />
            </div>
          </div>
        ))}
      </div>
      
      <div className="section-title">
        <h3>前 10 名筛后基金</h3>
        <span>正在核算最新仓位明细...</span>
      </div>
      
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>排名</th>
              <th>基金</th>
              <th>类型</th>
              <th>净值占比</th>
              <th>持仓市值</th>
              <th>持股数</th>
              <th>交易状态</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((i) => (
              <tr key={i} className="skeleton-row">
                <td><span className="rank skeleton-rank" /></td>
                <td>
                  <div className="skeleton-line skeleton-fund-name" />
                  <div className="skeleton-line skeleton-fund-code" />
                </td>
                <td><div className="skeleton-line skeleton-badge" /></td>
                <td><div className="skeleton-line skeleton-bar" /></td>
                <td><div className="skeleton-line skeleton-bar-short" /></td>
                <td><div className="skeleton-line skeleton-bar-short" /></td>
                <td><div className="skeleton-line skeleton-badge" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CandidateButton({
  stock,
  onSelect,
  selected = false,
}: {
  stock: PopularStock | StockRecord;
  onSelect: (trigger: HTMLButtonElement) => void;
  selected?: boolean;
}) {
  return (
    <button className={`candidate ${selected ? "selected" : ""}`} onClick={(event) => onSelect(event.currentTarget)} type="button">
      <span className="candidate-identity">
        <StockLogo code={stock.code} name={stock.name} />
        <span className="candidate-main">
          <span className="candidate-title-row">
            <strong>{stock.name}</strong>
            <span className="market-badge">{marketLabel(stock.code, stock.name)}</span>
          </span>
          <em>{stock.code}</em>
        </span>
      </span>
      <span>
        {stockFundCountLabel(stock)}
        <small>{stock.identityStatus === "pending" ? "代码身份待核对" : stock.exchange || stock.code}</small>
      </span>
    </button>
  );
}

function EmptyState({ loading, error, onRetry }: { loading: boolean; error: string | null; onRetry?: () => void }) {
  if (loading) {
    return (
      <section className="empty-state">
        <Database size={28} />
        <h2>正在载入持仓索引</h2>
        <p>读取本地 {fundQuarter.report} 基金股票持仓数据。</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="empty-state error">
        <Database size={28} />
        <h2>数据载入失败</h2>
        <p>请检查网络后重试。</p>
        {onRetry && <button type="button" className="research-primary-action" onClick={onRetry}>重新加载</button>}
        <details><summary>错误详情</summary><p>{error}</p></details>
      </section>
    );
  }

  return (
    <section className="empty-state">
      <Search size={28} />
      <h2>输入海外股票名称或代码</h2>
      <p>例如：英伟达、NVDA、台积电、TSM、腾讯控股、00700。</p>
    </section>
  );
}

// 未选择任何标的时，结果区此前只剩孤立工具栏，缺少"下一步做什么"的引导。
// 这里提供一条最短使用路径，并把热门标的做成一步直达入口。
function IdleGuide({ quickStocks, onSelect }: {
  quickStocks: PopularStock[];
  onSelect: (stock: PopularStock, trigger: HTMLElement) => void;
}) {
  const steps = [
    { title: "搜索标的", detail: "输入美股、港股、日股、韩股名称或代码" },
    { title: "对比穿透结果", detail: "按总估算经济暴露查看场外基金与场内 ETF" },
    { title: "保存组合深挖", detail: "组合最多 10 只股票，仅保存在本浏览器" },
  ];

  return (
    <section className="idle-guide" aria-label="开始使用指南">
      <div className="idle-guide-copy">
        <h3>从一次搜索开始</h3>
        <p>查询单只海外股票被哪些公募基金重仓，或组合多只股票定位共同持有人。</p>
      </div>
      <ol className="idle-guide-steps">
        {steps.map((step, index) => (
          <li key={step.title}>
            <span className="idle-guide-step-index">{index + 1}</span>
            <span>
              <strong>{step.title}</strong>
              <small>{step.detail}</small>
            </span>
          </li>
        ))}
      </ol>
      {quickStocks.length > 0 && (
        <div className="idle-guide-quick">
          <span>试试热门标的</span>
          <div className="idle-guide-chips">
            {quickStocks.map((stock) => (
              <button
                key={stock.code}
                type="button"
                onClick={(event) => onSelect(stock, event.currentTarget)}
              >
                {stock.code}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function LeverageModuleFallback() {
  return (
    <div className="leverage-entry-card" role="status" aria-live="polite">
      <span className="leverage-entry-kicker">两融</span>
      <span className="leverage-entry-copy">
        <span className="leverage-entry-title">正在加载数据</span>
        <span className="leverage-entry-description">请稍候。</span>
      </span>
    </div>
  );
}

function ConcentrationModuleFallback() {
  return (
    <div className="leverage-entry-card" role="status" aria-live="polite">
      <span className="leverage-entry-kicker">交易集中度</span>
      <span className="leverage-entry-copy">
        <span className="leverage-entry-title">正在加载数据</span>
        <span className="leverage-entry-description">请稍候。</span>
      </span>
    </div>
  );
}

type TurnstileRenderOptions = {
  sitekey: string;
  action: string;
  size: "compact";
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
};

type TurnstileApi = {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SITEKEY = "0x4AAAAAAEer-1lAw8ypwkb7";
const TURNSTILE_SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let turnstileScriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstileApi(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileScriptPromise) return turnstileScriptPromise;

  turnstileScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.onload = () => {
      if (window.turnstile) {
        resolve(window.turnstile);
      } else {
        turnstileScriptPromise = null;
        reject(new Error("安全验证组件未能初始化。"));
      }
    };
    script.onerror = () => {
      turnstileScriptPromise = null;
      reject(new Error("安全验证组件加载失败。"));
    };
    document.head.appendChild(script);
  });

  return turnstileScriptPromise;
}

function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorText, setErrorText] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileError, setTurnstileError] = useState("");
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);
  const submitControllerRef = useRef<AbortController | null>(null);
  const submitAttemptRef = useRef(0);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    setContact("");
    setMessage("");
    setWebsite("");
    setStatus("idle");
    setErrorText("");
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const focusFrame = window.requestAnimationFrame(() => {
      (closeButtonRef.current ?? dialogRef.current)?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }

      if (event.key !== "Tab") return;

      const focusableElements = getDialogFocusableElements(dialogRef.current);
      if (!focusableElements.length) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => () => {
    submitAttemptRef.current += 1;
    submitControllerRef.current?.abort();
    submitControllerRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) return;

    let active = true;
    setTurnstileToken("");
    setTurnstileError("");

    void loadTurnstileApi()
      .then((turnstile) => {
        const container = turnstileContainerRef.current;
        if (!active || !container) return;

        turnstileWidgetIdRef.current = turnstile.render(container, {
          sitekey: TURNSTILE_SITEKEY,
          action: "feedback",
          size: "compact",
          callback: (token) => {
            if (active) {
              setTurnstileToken(token);
              setTurnstileError("");
            }
          },
          "expired-callback": () => {
            if (active) setTurnstileToken("");
          },
          "error-callback": () => {
            if (active) {
              setTurnstileToken("");
              setTurnstileError("安全验证暂不可用，请刷新页面后重试。");
            }
          },
        });
      })
      .catch(() => {
        if (active) setTurnstileError("安全验证加载失败，请刷新页面后重试。");
      });

    return () => {
      active = false;
      const widgetId = turnstileWidgetIdRef.current;
      if (widgetId) window.turnstile?.remove(widgetId);
      turnstileWidgetIdRef.current = null;
      turnstileContainerRef.current?.replaceChildren();
    };
  }, [open]);

  if (!open) return null;

  function resetTurnstile() {
    setTurnstileToken("");
    const widgetId = turnstileWidgetIdRef.current;
    if (widgetId) window.turnstile?.reset(widgetId);
  }

  function closeDialog() {
    submitAttemptRef.current += 1;
    submitControllerRef.current?.abort();
    submitControllerRef.current = null;
    setContact("");
    setMessage("");
    setWebsite("");
    setStatus("idle");
    setErrorText("");
    setTurnstileToken("");
    setTurnstileError("");
    onCloseRef.current();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!turnstileToken) {
      setStatus("error");
      setErrorText("请先完成人机验证。");
      return;
    }

    setStatus("submitting");
    setErrorText("");
    submitControllerRef.current?.abort();
    const controller = new AbortController();
    const attemptId = submitAttemptRef.current + 1;
    submitAttemptRef.current = attemptId;
    submitControllerRef.current = controller;

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contact,
          message,
          website,
          page: window.location.href,
          turnstileToken,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "反馈发送失败，请稍后再试。");
      }
      if (controller.signal.aborted || attemptId !== submitAttemptRef.current) return;

      setStatus("success");
      setContact("");
      setMessage("");
      setWebsite("");
      resetTurnstile();
    } catch (submitError) {
      if (controller.signal.aborted || attemptId !== submitAttemptRef.current) return;
      setStatus("error");
      setErrorText(submitError instanceof Error ? submitError.message : "反馈发送失败，请稍后再试。");
      resetTurnstile();
    } finally {
      if (attemptId === submitAttemptRef.current && submitControllerRef.current === controller) {
        submitControllerRef.current = null;
      }
    }
  }

  return (
    <div className="feedback-layer" role="presentation">
      <button
        type="button"
        className="feedback-backdrop"
        aria-label="关闭意见反馈"
        onClick={closeDialog}
      />
      <section
        ref={dialogRef}
        className="feedback-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-title"
        tabIndex={-1}
      >
        <div className="feedback-dialog-header">
          <div>
            <h2 id="feedback-title">意见反馈</h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="feedback-close"
            aria-label="关闭意见反馈"
            onClick={closeDialog}
          >
            <X size={18} />
          </button>
        </div>

        {status === "success" ? (
          <div className="feedback-success">
            <MessageSquareText size={26} />
            <strong>已收到</strong>
            <p>感谢反馈。</p>
            <button type="button" onClick={closeDialog}>完成</button>
          </div>
        ) : (
          <form className="feedback-form" onSubmit={handleSubmit}>
            <label>
              联系方式
              <input
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                maxLength={120}
                placeholder="手机或邮箱"
                required
              />
            </label>
            <label>
              留言
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={1200}
                placeholder="问题或建议"
                required
              />
            </label>
            <label className="feedback-honeypot" aria-hidden="true">
              Website
              <input
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
              />
            </label>
            <div className="feedback-turnstile" aria-live="polite">
              <div ref={turnstileContainerRef} />
              {!turnstileToken && !turnstileError && <p>正在加载安全验证…</p>}
              {turnstileError && <p className="feedback-error">{turnstileError}</p>}
            </div>
            {status === "error" && <p className="feedback-error">{errorText}</p>}
            <button
              type="submit"
              className="feedback-submit"
              disabled={status === "submitting" || !turnstileToken}
            >
              {status === "submitting" ? <Loader2 size={17} className="spin" /> : <Send size={17} />}
              {status === "submitting" ? "发送中" : "发送反馈"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

export function App() {
  const page = getInitialPage();
  const isResearchPage = page === "research";
  const [data, setData] = useState<FundStockIndex | null>(null);
  const [query, setQuery] = useState(getInitialQuery);
  const [selectedCode, setSelectedCode] = useState<string | null>(getInitialSelectedCode);
  const [popularMarketFilter, setPopularMarketFilter] = useState<PopularMarketFilter | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const [researchContext, setResearchContext] = useState<{ stockCodes: string[]; isTemporary: boolean; name: string } | null>(null);
  const [portfolioEditorOpen, setPortfolioEditorOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState<number | null>(null);
  const [hotspotsExpanded, setHotspotsExpanded] = useState(false);
  const [resultFocusRequest, setResultFocusRequest] = useState<"initial" | "selection" | null>(
    () => (getInitialSelectedCode() || getInitialQuery() ? "initial" : null),
  );
  const [temporarySelection, setTemporarySelection] = useState<{
    code: string;
    requestId: number;
    trigger: HTMLElement | null;
  } | null>(() => {
    const code = getInitialSelectedCode();
    return code ? { code, requestId: 0, trigger: null } : null;
  });
  const searchPanelRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suppressNextSearchFocusRef = useRef(false);
  const researchLeaveGuardRef = useRef<((action: () => void, trigger: HTMLElement | null) => void) | null>(null);
  const temporarySelectionRequestIdRef = useRef(0);
  const initialQueryHandledRef = useRef(false);
  const feedbackTriggerRef = useRef<HTMLButtonElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => installInputModalityTracking(), []);

  useEffect(() => {
    if (!isResearchPage) {
      setLoading(false);
      return;
    }

    let mounted = true;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    // 季度与证券身份修订号共同更新缓存版本；普通访问复用索引，失败重试时强制重新加载。
    fetch(FUND_STOCK_DATA_URL, { signal: controller.signal, ...(retryToken > 0 ? { cache: "reload" as const } : {}) })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`数据文件请求失败 (HTTP ${response.status})。请检查服务器是否正常运行。`);
        }
        return response.json() as Promise<FundStockIndex>;
      })
      .then((payload) => {
        if (!mounted) return;
        setData(payload);
      })
      .catch((fetchError: Error) => {
        if (!mounted) return;
        console.error("【FundTrace 核心数据载入错误】:", fetchError);
        setError(fetchError.message || "未知的数据读取错误");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [isResearchPage, retryToken]);

  useEffect(() => {
    if (typeof window === "undefined" || pageFromPathname(window.location.pathname) !== "research") {
      return;
    }

    const legacyPage = pageFromLegacyHash(window.location.hash);
    if (legacyPage) {
      window.history.replaceState(null, "", `${appPagePath(legacyPage)}${window.location.search}`);
    }
  }, []);

  const matches = useMemo(() => findMatches(data?.stocks ?? [], query), [data, query]);

  // 搜索建议：输入时在搜索框下方实时给出前 5 条匹配，缩短"输入 → 选中标的"的操作路径。
  const suggestionItems = useMemo(() => matches.slice(0, 5), [matches]);
  const showSuggestions =
    suggestionsOpen && query.trim().length > 0 && suggestionItems.length > 0;

  useEffect(() => {
    if (!showSuggestions) return;

    function handlePointerDown(event: PointerEvent) {
      if (!searchPanelRef.current?.contains(event.target as Node)) {
        setSuggestionsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [showSuggestions]);

  const selectedStock = useMemo(() => {
    if (!data) return null;
    const normalizedSelectedCode = selectedCode ? normalizeStockCode(selectedCode) : "";
    const fromSelectedCode = normalizedSelectedCode
      ? data.stocks.find((stock) => normalizeStockCode(stock.code) === normalizedSelectedCode)
      : null;
    return fromSelectedCode ?? null;
  }, [data, selectedCode]);

  const handleResearchContextChange = useCallback((context: { stockCodes: string[]; isTemporary: boolean; name: string }) => {
    setResearchContext(context);
    setSelectedCode(context.isTemporary && context.stockCodes.length === 1 ? context.stockCodes[0] : null);
  }, []);

  const registerLeaveGuard = useCallback((guard: (action: () => void, trigger: HTMLElement | null) => void) => {
    researchLeaveGuardRef.current = guard;
  }, []);

  const returnToSearch = useCallback(() => {
    setPortfolioEditorOpen(false);
    setSuggestionsOpen(false);
    suppressNextSearchFocusRef.current = true;
    window.requestAnimationFrame(() => {
      const input = searchInputRef.current;
      if (!input) return;
      input.focus({ preventScroll: true });
      input.select();
      const bounds = input.getBoundingClientRect();
      const topbarBottom = document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 0;
      if (bounds.top < topbarBottom || bounds.bottom > window.innerHeight) {
        input.scrollIntoView({ behavior: "auto", block: "center" });
      }
    });
  }, []);

  function clearSearch() {
    setQuery("");
    setSuggestionsOpen(false);
    setActiveSuggestionIndex(null);
    suppressNextSearchFocusRef.current = true;
    searchInputRef.current?.focus({ preventScroll: true });
  }

  const popularSuggestions = useMemo(() => {
    const source = data?.popularStocks ?? [];
    if (!popularMarketFilter) return source;
    return source.filter((stock) => stockMarketBucket(stock.code, stock.name) === popularMarketFilter);
  }, [data, popularMarketFilter]);
  const quickStocks = useMemo(() => {
    if (!data) return [];

    const preferredStocks = homepageQuickHotspots
      .map((hotspot) =>
        data.stocks.find(
          (stock) => normalizeStockCode(stock.code) === normalizeStockCode(hotspot.code),
        ),
      )
      .filter((stock): stock is StockRecord => Boolean(stock));
    const preferredCodes = new Set(preferredStocks.map((stock) => normalizeStockCode(stock.code)));
    const fallbackStocks = data.popularStocks.filter(
      (stock) => !preferredCodes.has(normalizeStockCode(stock.code)),
    );

    return [...preferredStocks, ...fallbackStocks].slice(0, 5);
  }, [data]);
  const aiBattleHotspotCards = useMemo(() => {
    if (!data) return [];

    return aiBattleHotspots
      .map((hotspot) => {
        const stock = data.stocks.find(
          (item) => normalizeStockCode(item.code) === normalizeStockCode(hotspot.code),
        );
        return stock ? { hotspot, stock } : null;
      })
      .filter((item): item is { hotspot: AiBattleHotspot; stock: StockRecord } => item !== null);
  }, [data]);

  function chooseStock(stock: PopularStock | StockRecord, trigger: HTMLElement | null = null, focusResult = true) {
    setSuggestionsOpen(false);
    setActiveSuggestionIndex(null);
    suppressNextSearchFocusRef.current = true;
    const commitSelection = () => {
      setSelectedCode(stock.code);
      setQuery(stock.code);
      setPortfolioEditorOpen(false);
      setResultFocusRequest(focusResult ? "selection" : null);
      temporarySelectionRequestIdRef.current += 1;
      setTemporarySelection({
        code: stock.code,
        requestId: temporarySelectionRequestIdRef.current,
        trigger,
      });
      if (!focusResult) {
        window.requestAnimationFrame(() => {
          searchInputRef.current?.focus({ preventScroll: true });
          searchInputRef.current?.select();
        });
      }
    };
    const leaveGuard = researchLeaveGuardRef.current;
    if (leaveGuard) leaveGuard(commitSelection, trigger);
    else commitSelection();
  }

  useEffect(() => {
    if (!data || initialQueryHandledRef.current) return;
    initialQueryHandledRef.current = true;
    const initialCode = getInitialSelectedCode();
    if (initialCode && !data.stocks.some((stock) => stock.code === initialCode)) {
      setSelectedCode(null);
      setTemporarySelection(null);
      setResultFocusRequest(null);
      setSuggestionsOpen(true);
      window.requestAnimationFrame(() => searchInputRef.current?.focus({ preventScroll: true }));
    } else if (!initialCode && getInitialQuery()) {
      const initialMatches = findMatches(data.stocks, getInitialQuery());
      if (initialMatches.length === 1) chooseStock(initialMatches[0]);
      else if (initialMatches.length > 1) {
        setResultFocusRequest(null);
        setSuggestionsOpen(true);
        window.requestAnimationFrame(() => searchInputRef.current?.focus({ preventScroll: true }));
      }
    }
  }, [data]);

  function selectSearchSuggestion(index: number | null, trigger: HTMLElement | null = null, focusResult = false) {
    const exactCodes = matches.filter((stock) => normalize(stock.code) === normalize(query));
    const stock = index !== null
      ? suggestionItems[index]
      : exactCodes.length === 1 ? exactCodes[0] : matches.length === 1 ? matches[0] : null;
    if (stock) chooseStock(stock, trigger, focusResult);
    else if (matches.length > 0) {
      setSuggestionsOpen(true);
      searchInputRef.current?.focus({ preventScroll: true });
    }
  }

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      setSuggestionsOpen(false);
      setActiveSuggestionIndex(null);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!suggestionItems.length) return;

      event.preventDefault();
      setSuggestionsOpen(true);
      setActiveSuggestionIndex((current) => {
        if (current === null) return event.key === "ArrowDown" ? 0 : suggestionItems.length - 1;
        if (event.key === "ArrowDown") return Math.min(current + 1, suggestionItems.length - 1);
        return Math.max(current - 1, 0);
      });
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      selectSearchSuggestion(activeSuggestionIndex, searchInputRef.current ?? event.currentTarget, true);
    }
  }

  function restoreDialogTrigger(trigger: HTMLElement | null) {
    window.requestAnimationFrame(() => {
      if (trigger?.isConnected) trigger.focus();
    });
  }

  function closeFeedbackDialog() {
    setFeedbackOpen(false);
    restoreDialogTrigger(feedbackTriggerRef.current);
  }

  function handleTopNavigation(event: ReactMouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!isResearchPage || event.currentTarget.href === window.location.href) return;

    const leaveGuard = researchLeaveGuardRef.current;
    if (!leaveGuard) return;

    event.preventDefault();
    const destination = event.currentTarget.href;
    leaveGuard(() => window.location.assign(destination), event.currentTarget);
  }

  // 修复 UI 锁定 Bug：只有在真正处于 loading 且没有发生加载错误时，才显示骨架屏。
  // 如果加载失败，解除 isAppLoading，进入 EmptyState 显示红色的错误载入面板，方便用户排查。
  const isAppLoading = loading && !error;
  const disclaimerText =
    page === "leverage" || page === "concentration"
      ? "仅供研究，不构成投资建议。"
      : "持仓非实时；仅供研究，不构成投资建议。";

  // 跳转链接原本指向 #main-content —— 也就是它自己的祖先 <main>，
  // 回车后焦点落到 main 上，紧接着再按 Tab 又回到跳转链接本身，形成自指循环，
  // 而顶部导航仍在 <main> 内部，等于"跳过了但没跳过"。
  // 改为指向各页紧随导航之后的正文标题（这些标题已加 tabIndex={-1} 可编程聚焦）。
  const skipTarget =
    page === "leverage"
      ? "#leverage-dashboard-title"
      : page === "concentration"
        ? "#concentration-dashboard-title"
        : page === "methodology"
          ? "#methodology-title"
          : "#research-title";

  return (
    <main className="app-shell" data-page={page} id="main-content" tabIndex={-1}>
      <a className="skip-link" href={skipTarget}>
        跳到主要内容
      </a>
      {/* 每个路由页面唯一 h1：页面此前缺少 h1 语义层级，影响 SEO 与读屏导航 */}
      <h1 className="visually-hidden">
        {page === "leverage"
          ? "两融数据看板"
          : page === "concentration"
            ? "A股交易集中度"
          : page === "methodology"
            ? "基金持仓穿透方法论"
            : "海外股票基金持仓查询与基金重仓股穿透"}
      </h1>
      <header className="topbar">
        <div className="brand-mark">
          <span>出海钱眼</span>
        </div>
        <nav className="topbar-nav" aria-label="当前功能区">
          <a
            href={appPagePath("research")}
            className={page === "research" ? "active" : ""}
            aria-current={page === "research" ? "page" : undefined}
            onClick={handleTopNavigation}
          >
            基金穿透
          </a>
          <a
            href={appPagePath("leverage")}
            className={page === "leverage" ? "active" : ""}
            aria-current={page === "leverage" ? "page" : undefined}
            onClick={handleTopNavigation}
          >
            两融
          </a>
          <a
            href={appPagePath("concentration")}
            className={page === "concentration" ? "active" : ""}
            aria-current={page === "concentration" ? "page" : undefined}
            onClick={handleTopNavigation}
          >
            交易集中度
          </a>
          <a
            href={appPagePath("methodology")}
            className={page === "methodology" ? "active" : ""}
            aria-current={page === "methodology" ? "page" : undefined}
            onClick={handleTopNavigation}
          >
            方法论
          </a>
        </nav>
        <div className="topbar-meta">
          <span>
            <CalendarDays size={16} />
            {page === "leverage"
              ? "市场数据"
              : page === "concentration"
                ? "成交额集中度"
                : data?.meta.report ?? fundQuarter.report}
          </span>
          <span>
            <Database size={16} />
            {page === "research"
              ? data
                ? `${numberFormatter.format(data.meta.overseasStockCount ?? data.meta.stockCount)} 海外标的`
                : "载入中"
              : page === "leverage"
                ? "融资与指数"
                : page === "concentration"
                  ? "通达信日线"
                : "基金持仓口径"}
          </span>
        </div>
      </header>

      {page === "research" && (
      <>
      <section className="research-intro" aria-labelledby="research-title">
        <div>
          <h2 id="research-title" tabIndex={-1}>{portfolioEditorOpen ? "组合找基金" : "股票找基金"}</h2>
          <p>{data?.meta.report ?? fundQuarter.report} · 持仓截至 {data?.meta.cutoffDate ?? fundQuarter.cutoffDate}</p>
        </div>
        <a href={appPagePath("methodology")} onClick={handleTopNavigation}>数据口径</a>
      </section>
      <section className="search-zone research-search-zone" aria-label="基金持仓研究" hidden={portfolioEditorOpen}>
        <div className="command-panel" ref={searchPanelRef}>
          <form
            className="search-box"
            onSubmit={(event) => {
              event.preventDefault();
              selectSearchSuggestion(activeSuggestionIndex, searchInputRef.current ?? event.currentTarget);
            }}
          >
            <Search size={22} />
            <input
              ref={searchInputRef}
              role="combobox"
              aria-label="搜索股票名称或代码"
              aria-autocomplete="list"
              aria-expanded={showSuggestions}
              aria-controls={showSuggestions ? STOCK_SEARCH_LIST_ID : undefined}
              aria-activedescendant={
                showSuggestions && activeSuggestionIndex !== null
                  ? `${STOCK_SEARCH_LIST_ID}-${activeSuggestionIndex}`
                  : undefined
              }
              aria-haspopup="listbox"
              aria-describedby="stock-search-hint"
              placeholder="NVDA / 00700 / 腾讯"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSuggestionsOpen(true);
                setActiveSuggestionIndex(null);
              }}
              onFocus={() => {
                if (suppressNextSearchFocusRef.current) {
                  suppressNextSearchFocusRef.current = false;
                  return;
                }
                if (query.trim() && suggestionItems.length) {
                  setSuggestionsOpen(true);
                  setActiveSuggestionIndex(null);
                }
              }}
              onBlur={() => {
                setSuggestionsOpen(false);
                setActiveSuggestionIndex(null);
              }}
              onKeyDown={handleSearchKeyDown}
              autoComplete="off"
            />
            {query && <button type="button" className="research-clear-search" aria-label="清空搜索" onClick={clearSearch}><X size={18} /></button>}
            <button
              type="submit"
              className="research-search-submit"
              disabled={!matches[0]}
            >
              <Search size={18} />
              查看基金
            </button>
          </form>
          {showSuggestions && (
            <ul id={STOCK_SEARCH_LIST_ID} className="search-suggestions" role="listbox" aria-label="搜索建议">
              {suggestionItems.map((stock, index) => (
                <li
                  key={stock.code}
                  id={`${STOCK_SEARCH_LIST_ID}-${index}`}
                  className={`search-suggestion ${activeSuggestionIndex === index ? "active" : ""}`}
                  role="option"
                  aria-selected={activeSuggestionIndex === index}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectSearchSuggestion(index, searchInputRef.current)}
                >
                  <span className="suggestion-name">{stock.name}</span>
                  <span className="suggestion-code">{stock.code}</span>
                  <span className="suggestion-meta">
                    {marketLabel(stock.code, stock.name)} ·{" "}
                    {stockFundCountLabel(stock)}{stock.exchange ? ` · ${stock.exchange}` : ""}
                    {stock.identityStatus === "pending" ? " · 代码身份待核对" : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p id="stock-search-hint" className="visually-hidden">输入名称或代码，用上下键选择，回车查看基金。</p>
          {!isAppLoading && !error && query.trim() && matches.length === 0 && (
            <div className="research-search-empty" role="status">
              <p>未找到“{query}”。试试代码或名称，如 NVDA。</p>
              <button type="button" onClick={clearSearch}>重新搜索</button>
            </div>
          )}
        </div>

      </section>

      {researchContext && researchContext.stockCodes.length > 0 && (
        <p className={`research-current-context${selectedStock?.identityStatus === "pending" ? "" : " visually-hidden"}`} aria-live="polite">
          当前研究：{researchContext.isTemporary ? (selectedStock?.name ?? researchContext.stockCodes[0]) : (researchContext.name || "未命名组合")} · {researchContext.stockCodes.length} 只股票
          {selectedStock?.exchange ? ` · ${selectedStock.exchange}` : ""}
          {selectedStock?.identityStatus === "pending" ? " · 身份待核对，仅对应此代码版本" : ""}
        </p>
      )}
      <section className={`workspace ${selectedStock ? "has-selection" : "no-selection"}`}>


        <section className="results-panel">
          {isAppLoading ? (
            <SkeletonResults />
          ) : error ? (
            <EmptyState loading={false} error={error} onRetry={() => setRetryToken((value) => value + 1)} />
          ) : (
            <>
              {(researchContext?.stockCodes.length ?? 0) === 0 && (
                <IdleGuide
                  quickStocks={quickStocks}
                  onSelect={(stock, trigger) => chooseStock(stock, trigger)}
                />
              )}
              <PortfolioWorkbench
              stocks={data?.stocks ?? []}
              report={data?.meta.report ?? fundQuarter.report}
              cutoffDate={data?.meta.cutoffDate ?? fundQuarter.cutoffDate}
              manifestUrl={fundQuarter.portfolioManifestUrl}
              fundHoldingsUrl={QDII_HOLDINGS_URL}
              temporarySelection={temporarySelection}
              focusResult={resultFocusRequest !== null}
              onResultFocused={() => setResultFocusRequest(null)}
              onLeaveGuard={registerLeaveGuard}
              onResearchContextChange={handleResearchContextChange}
              onEditorOpenChange={setPortfolioEditorOpen}
              onSearchRequest={returnToSearch}
              afterResultsReady={
                <details className="research-market-details">
                  <summary>市场环境 · 两融</summary>
                <MarketSummaryBoundary>
                  <Suspense fallback={<MarketSummaryFallback />}>
                    <LazyLeverageMarketSummary />
                  </Suspense>
                </MarketSummaryBoundary>
                </details>
              }
            />
            </>
          )}
        </section>
      </section>

      <section className="research-discovery">
        <div className="research-discovery-body">
        {/* 未选标的时空态引导已提供同样的热门入口，这里不再重复渲染同一排芯片 */}
        {(researchContext?.stockCodes.length ?? 0) === 0 ? null : (
        <div className="recent-panel" aria-label="快速查询">
          <div className="panel-status">
            <span>AI 存储热点</span>
          </div>
          <div className="recent-chips">
            {quickStocks.length ? (
              quickStocks.map((stock) => (
                <button key={stock.code} type="button" onClick={(event) => chooseStock(stock, event.currentTarget)}>
                  {stock.code}
                </button>
              ))
            ) : (
              <span>数据载入中</span>
            )}
          </div>
        </div>
        )}

        <div className="summary-card" aria-label="基金数据总览">
          <span>覆盖基金</span>
          <strong>{data ? numberFormatter.format(data.meta.fundCount ?? data.meta.sourceRows) : "--"} 只</strong>
        </div>
      <section
        className={`ai-hotspot-section${hotspotsExpanded ? "" : " is-collapsed"}`}
        aria-labelledby="ai-hotspot-title"
      >
        <div className="ai-hotspot-head">
          <div>
            <h2 id="ai-hotspot-title">AI 热点</h2>
          </div>
        </div>
        <div id="ai-hotspot-grid" className="ai-hotspot-grid">
          {aiBattleHotspotCards.length ? (
            aiBattleHotspotCards.map(({ hotspot, stock }) => {
              const isActive = normalizeStockCode(selectedStock?.code ?? "") === normalizeStockCode(stock.code);

              return (
                <article key={hotspot.code} className={`ai-hotspot-card ${isActive ? "active" : ""}`}>
                  <button
                    type="button"
                    className="ai-hotspot-main"
                    aria-label={`查看 ${hotspot.label} 的基金持仓穿透结果`}
                    onClick={(event) => chooseStock(stock, event.currentTarget)}
                  >
                    <span className="hotspot-kicker">
                      <span>{hotspot.track}</span>
                      <span>{marketLabel(stock.code, stock.name)}</span>
                    </span>
                    <span className="hotspot-title-row">
                      <StockLogo code={stock.code} name={stock.name} />
                      <span>
                        <strong>{hotspot.label}</strong>
                        <em>{stock.code}</em>
                      </span>
                    </span>
                    <span className="hotspot-metrics">
                      <span>
                        <small>{typeof stock.offExchangeFundCount === "number" ? "场外基金" : "主动基金（摘要）"}</small>
                        <b>{numberFormatter.format(stock.offExchangeFundCount ?? stock.activeFundCount)} 只</b>
                      </span>
                      <span>
                        <small>市场</small>
                        <b>{stock.exchange || marketLabel(stock.code, stock.name)}</b>
                      </span>
                    </span>
                  </button>
                  <details className="hotspot-note"><summary>研究线索</summary><p>{hotspot.thesis}</p></details>
                </article>
              );
            })
          ) : (
            <div className="ai-hotspot-empty">热点入口载入中</div>
          )}
        </div>
        {aiBattleHotspotCards.length > 3 && (
          <button
            type="button"
            className="ai-hotspot-expand-toggle"
            aria-expanded={hotspotsExpanded}
            aria-controls="ai-hotspot-grid"
            onClick={() => setHotspotsExpanded((current) => !current)}
          >
            {hotspotsExpanded ? "收起" : `更多热点（${aiBattleHotspotCards.length - 3}）`}
          </button>
        )}
      </section>

        <aside className="left-panel" aria-label="股票候选">
          <div className="left-panel-top">
            <div className="panel-heading">
              <h2>{data?.meta.popularScopeLabel ?? "海外热门"}</h2>
              <span>{isAppLoading ? "载入中..." : `${popularSuggestions.length} 项`}</span>
            </div>
            <div className="market-shortcuts" aria-label="海外热门市场筛选">
              {popularMarketFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  className={`market-shortcut ${popularMarketFilter === filter.key ? "active" : ""}`}
                  aria-pressed={popularMarketFilter === filter.key}
                  onClick={() =>
                    setPopularMarketFilter((current) => (current === filter.key ? null : filter.key))
                  }
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          <div className="candidate-list">
            {isAppLoading ? (
              [1, 2, 3, 4, 5].map((i) => <SkeletonCandidate key={i} />)
            ) : popularSuggestions.length ? (
              popularSuggestions.map((stock) => (
                <CandidateButton
                  key={stock.code}
                  stock={stock}
                  onSelect={(trigger) => chooseStock(stock, trigger)}
                  selected={selectedStock?.code === stock.code}
                />
              ))
            ) : (
              <p className="no-match">{popularMarketFilter ? "暂无该市场热门标的。" : "暂无热门标的。"}</p>
            )}
          </div>
        </aside>
        </div>
      </section>
      <section className="research-data-overview">
      <section className="selected-context" aria-label="数据范围与覆盖">
        <div>
          <span>数据期</span>
          <strong>{data?.meta.report ?? fundQuarter.report}</strong>
        </div>
        <div>
          <span>数据截至</span>
          <strong>{data?.meta.cutoffDate ?? "载入中"}</strong>
        </div>
        <div>
          <span>海外标的</span>
          <strong>
            {data ? numberFormatter.format(data.meta.overseasStockCount ?? data.meta.stockCount) : "--"} 只
          </strong>
        </div>
        <div>
          <span>持仓明细</span>
          <strong>{data ? numberFormatter.format(data.meta.holdingRows ?? data.meta.sourceRows) : "--"} 条</strong>
        </div>
      </section>

      </section>

      </>
      )}

      {page === "leverage" && (
        <section className="leverage-section" aria-label="两融数据">
          <Suspense fallback={<LeverageModuleFallback />}>
            <LazyLeverageDashboard />
          </Suspense>
        </section>
      )}

      {page === "concentration" && (
        <section className="leverage-section" aria-label="交易集中度数据">
          <Suspense fallback={<ConcentrationModuleFallback />}>
            <LazyTradingConcentrationDashboard />
          </Suspense>
        </section>
      )}

      {page === "methodology" && (
      <section className="methodology-section" aria-labelledby="methodology-title">
        <div className="methodology-head">
          <h2 id="methodology-title" tabIndex={-1}>数据口径</h2>
          <p>
            {data?.meta.report ?? fundQuarter.report} · 截至 {data?.meta.cutoffDate ?? fundQuarter.cutoffDate}。未披露不代表未持有。
          </p>
        </div>
        <div className="methodology-grid">
          <article>
            <strong>场外基金</strong>
            <p>非场内主动、指数基金及 ETF 联接。场外不等于主动管理。</p>
          </article>
          <article>
            <strong>场内基金</strong>
            <p>ETF、LOF、封闭式基金及上市 REIT，不含非上市的 REITs 主题基金。</p>
          </article>
          <article>
            <strong>暴露估算</strong>
            <p>总暴露 = 直接持仓 + 已识别间接暴露。缺失映射不代表零持仓。</p>
          </article>
          <article>
            <strong>排序规则</strong>
            <p>总暴露 ↓ → 直接暴露 ↓ → 基金代码 ↑。数值为期末估算。</p>
          </article>
          <article>
            <strong>份额合并</strong>
            <p>A/C、币种等份额按基金家族去重，不重复相加。</p>
          </article>
          <article>
            <strong>证券身份</strong>
            <p>仅合并已核实别名；未核实的标记待核对，原文可回查。</p>
          </article>
        </div>
        <details className="methodology-details">
          <summary>完整口径</summary>
          <dl>
            <dt>披露范围</dt>
            <dd>普通基金为季度前十大股票；QDII 为中期报告完整权益持仓，基金与 ETF 投资仅含报告前十项。</dd>
            <dt>间接暴露</dt>
            <dd>仅计入已识别且合格的正向杠杆 ETF/ETP/ETN：产品原占比 × 杠杆倍数。展开基金构成可查看来源和份额代码，估算不代表实时仓位或收益。</dd>
            <dt>分类与计数</dt>
            <dd>场内、场外互斥，按交易场景分类，与主动、指数管理方式分开。搜索计数与未筛选的单股结果同口径；同基金的不同份额仅计一次。</dd>
          </dl>
        </details>
      </section>
      )}

      <footer className="compliance-disclaimer">
        <p>{disclaimerText}</p>
        {page === "research" || page === "methodology" ? <details><summary>使用须知</summary><p>持仓、申赎、费率及限额可能滞后，请以基金公司和监管最新披露为准。本页不构成基金推荐、销售邀约或收益承诺。</p></details> : null}
      </footer>

      <button
        ref={feedbackTriggerRef}
        type="button"
        className="feedback-trigger"
        aria-label="打开意见反馈"
        onClick={() => setFeedbackOpen(true)}
      >
        <MessageSquareText size={17} />
        意见反馈
      </button>
      <FeedbackDialog open={feedbackOpen} onClose={closeFeedbackDialog} />
    </main>
  );
}
