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
import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type AccessMode = "offExchange" | "onExchange";

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

type StockRecord = {
  code: string;
  name: string;
  fundCount: number;
  activeFundCount: number;
  onExchangeFundCount?: number;
  excludedIndexFundCount: number;
  totalMarketValueWan: number | null;
  onExchangeTotalMarketValueWan?: number | null;
  maxRatioPercent: number;
  onExchangeMaxRatioPercent?: number;
  topByRatio: FundRecord[];
  topByValue: FundRecord[];
  topOnExchangeByRatio?: FundRecord[];
};

type PopularStock = Pick<
  StockRecord,
  "code" | "name" | "fundCount" | "activeFundCount" | "maxRatioPercent"
>;

type FundStockIndex = {
  meta: {
    report: string;
    generatedAt: string;
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
  fundHoldings?: Record<string, HoldingRecord[]>;
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

const japaneseStockNamePattern =
  /东京|丰田|索尼|日立|三菱|任天堂|软银|本田|东京电子|三井|住友|瑞穗|武田|迅销|基恩士|信越|村田|电装|佳能|尼康|日本/;
const koreanStockNamePattern =
  /三星电子|SK海力士|现代汽车|起亚|LG|NAVER|Kakao|浦项|POSCO|Celltrion|韩华|韩国电力/;

const numberFormatter = new Intl.NumberFormat("zh-CN");
const valueFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 2,
});
const FUND_STOCK_DATA_URL = "data/fund-stock-index-2026q1.json?v=20260527-cache-refresh";

function normalize(input: string) {
  return input.trim().replace(/\s+/g, "").toLowerCase();
}

function stockMarketBucket(code: string, name = ""): MarketBucket {
  const normalized = code.trim().toUpperCase();
  if (/^\d{5}$/.test(normalized)) return "hk";
  if (/^\d{4}\.(T|JP)$/.test(normalized)) return "jp";
  if (/^\d{6}\.(KS|KQ)$/.test(normalized)) return "kr";
  if (/^[A-Z]{1,5}([.-][A-Z]{1,2})?$/.test(normalized)) return "us";
  if (/^\d{4}$/.test(normalized)) return japaneseStockNamePattern.test(name) ? "jp" : "other";
  if (/^\d{6}$/.test(normalized) && koreanStockNamePattern.test(name)) return "kr";
  if (/^A\d+$/.test(normalized)) return "a";
  if (/^\d{6}$/.test(normalized)) return "a";
  return "other";
}

function isOverseasStockCode(code: string, name = "") {
  return stockMarketBucket(code, name) !== "a";
}

function marketLabel(code: string, name = "") {
  const bucket = stockMarketBucket(code, name);
  if (bucket === "hk") return "港股";
  if (bucket === "jp") return "日股";
  if (bucket === "kr") return "韩股";
  if (bucket === "us") return "美股";
  return bucket === "other" ? "其他" : "A股";
}

function hasWanValue(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatWan(value: number | null | undefined) {
  if (!hasWanValue(value)) {
    return "未披露";
  }
  if (value >= 10000) {
    return `${valueFormatter.format(value / 10000)} 亿`;
  }
  return `${valueFormatter.format(value)} 万`;
}

function tradeStatusTone(status?: string) {
  if (!status) return "neutral";
  if (/暂停|停止|封闭|终止|不可|失败/.test(status)) return "blocked";
  if (/限制|限大额/.test(status)) return "limited";
  if (/开放/.test(status)) return "open";
  return "neutral";
}

type HoldingRecord = {
  rank?: number;
  stockCode: string;
  stockName: string;
  ratioPercent: number;
  marketValueWan?: number | null;
  sharesWan?: number;
};

function normalizeStockCode(code: string) {
  return code.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

function uniqueFundCodes(fundCode: string, fundVariantCodes?: string[]) {
  return Array.from(new Set([fundCode, ...(fundVariantCodes ?? [])].filter(Boolean)));
}

function displayFundName(fund: FundRecord) {
  return fund.fundVariantCount && fund.fundVariantCount > 1 && fund.fundDisplayName
    ? fund.fundDisplayName
    : fund.fundName;
}

function supportsHoverPointer() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return true;
  }

  if (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) {
    return false;
  }

  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function FundHoldingsHoverCard({
  fundCode,
  fundVariantCodes,
  fundName,
  holdings,
  currentSearchStockCode,
  x,
  y,
  onClose,
}: {
  fundCode: string;
  fundVariantCodes?: string[];
  fundName: string;
  holdings: HoldingRecord[];
  currentSearchStockCode: string | null;
  x: number;
  y: number;
  onClose: () => void;
}) {
  const maxRatio = useMemo(() => Math.max(...holdings.map((h) => h.ratioPercent), 1), [holdings]);
  const currentStockCode = useMemo(
    () => (currentSearchStockCode ? normalizeStockCode(currentSearchStockCode) : ""),
    [currentSearchStockCode],
  );
  const currentHolding = useMemo(() => {
    if (!currentStockCode) return null;
    return holdings.find((h) => normalizeStockCode(h.stockCode) === currentStockCode) ?? null;
  }, [currentStockCode, holdings]);
  const fundCodes = useMemo(
    () => uniqueFundCodes(fundCode, fundVariantCodes),
    [fundCode, fundVariantCodes],
  );
  const topHolding = holdings[0] ?? null;
  const viewportWidth = typeof window === "undefined" ? 1200 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 800 : window.innerHeight;
  const isMobilePanel = viewportWidth <= 720;
  const cardWidth = Math.min(368, viewportWidth - 24);
  const rowCount = Math.min(holdings.length, 10);
  const estimatedHeight = 226 + rowCount * 40 + (currentHolding ? 48 : 0);
  const visibleHeight = Math.min(estimatedHeight, viewportHeight - 24);
  const cardLeft = Math.max(12, Math.min(x + 18, viewportWidth - cardWidth - 12));
  const cardTop = Math.max(12, Math.min(y + 12, viewportHeight - visibleHeight - 12));
  const cardStyle = isMobilePanel
    ? {
        position: "fixed" as const,
        left: "12px",
        right: "12px",
        bottom: "12px",
        zIndex: 10000,
        pointerEvents: "auto" as const,
      }
    : {
        position: "fixed" as const,
        left: `${cardLeft}px`,
        top: `${cardTop}px`,
        zIndex: 9999,
        pointerEvents: "none" as const,
      };

  return (
    <>
      {isMobilePanel && (
        <button
          type="button"
          className="fund-holdings-backdrop"
          aria-label="关闭基金持仓卡片"
          onClick={onClose}
        />
      )}
      <div
        className={`fund-holdings-hover-card ${isMobilePanel ? "mobile-panel" : ""}`}
        role={isMobilePanel ? "dialog" : undefined}
        aria-modal={isMobilePanel ? true : undefined}
        style={cardStyle}
      >
      <div className="hover-card-header">
        <div className="hover-card-fund-info">
          <div className="hover-card-fund-name" title={fundName}>
            {fundName}
          </div>
          <div className="hover-card-meta-line">
            <span>基金代码</span>
            <strong className="hover-card-fund-codes">{fundCodes.join(" / ")}</strong>
          </div>
        </div>
        <button
          type="button"
          className="hover-card-close"
          aria-label="关闭基金持仓卡片"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      
      <div className="hover-card-body">
        <div className="hover-card-summary">
          <div>
            <span>持仓股票</span>
            <strong>{holdings.length ? `${holdings.length} 只` : "--"}</strong>
          </div>
          <div>
            <span>最高占比</span>
            <strong>{topHolding ? `${valueFormatter.format(topHolding.ratioPercent)}%` : "--"}</strong>
          </div>
        </div>

        {currentHolding && (
          <div className="hover-card-target-strip">
            <span>当前查询</span>
            <strong>{currentHolding.stockName}</strong>
            <b>{valueFormatter.format(currentHolding.ratioPercent)}%</b>
          </div>
        )}

        <div className="hover-card-title-row">
          <span>前十大持仓股</span>
          <span>占净值</span>
        </div>
        <div className="hover-card-holdings-list">
          {holdings && holdings.length > 0 ? (
            holdings.map((h, index) => {
              const isCurrentTarget =
                !!currentStockCode && normalizeStockCode(h.stockCode) === currentStockCode;
              const widthPercent = Math.min((h.ratioPercent / maxRatio) * 100, 100);
              
              return (
                <div
                  key={h.stockCode}
                  className={`hover-card-holding-row ${isCurrentTarget ? "row-highlight" : ""}`}
                >
                  <span className="holding-rank">{h.rank || index + 1}</span>
                  <div className="holding-main">
                    <div className="holding-name-line">
                      <span className="holding-stock-name">{h.stockName}</span>
                      <span className="holding-stock-code">{h.stockCode}</span>
                      {isCurrentTarget && <span className="target-badge">查询标的</span>}
                    </div>
                    <div className="holding-progress-bar">
                      <div
                        className="holding-progress-fill"
                        style={{ width: `${widthPercent}%` }}
                      />
                    </div>
                  </div>
                  <span className="holding-stock-ratio">
                    {valueFormatter.format(h.ratioPercent)}%
                  </span>
                </div>
              );
            })
          ) : (
            <p className="no-holdings-msg">该基金暂无持仓记录</p>
          )}
        </div>
      </div>
      </div>
    </>
  );
}

function findMatches(stocks: StockRecord[], query: string) {
  const needle = normalize(query);
  if (!needle) {
    return [];
  }

  return stocks
    .map((stock) => {
      const code = normalize(stock.code);
      const name = normalize(stock.name);
      let score = 0;

      if (code === needle || name === needle) score = 1000;
      else if (code.startsWith(needle) || name.startsWith(needle)) score = 700;
      else if (code.includes(needle) || name.includes(needle)) score = 400;

      return { stock, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.stock.activeFundCount - a.stock.activeFundCount)
    .slice(0, 8)
    .map((item) => item.stock);
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <section className="metric">
      <div className="metric-icon">{icon}</div>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </section>
  );
}

function AccessToggle({
  accessMode,
  onChange,
}: {
  accessMode: AccessMode;
  onChange: (mode: AccessMode) => void;
}) {
  return (
    <div className="segmented" aria-label="基金交易场景">
      <button
        className={accessMode === "offExchange" ? "active" : ""}
        onClick={() => onChange("offExchange")}
        type="button"
      >
        <SlidersHorizontal size={16} />
        场外
      </button>
      <button
        className={accessMode === "onExchange" ? "active" : ""}
        onClick={() => onChange("onExchange")}
        type="button"
      >
        <BarChart3 size={16} />
        场内
      </button>
    </div>
  );
}

function ResultTable({
  funds,
  accessMode,
  onHoverFund,
}: {
  funds: FundRecord[];
  accessMode: AccessMode;
  onHoverFund: (
    fund: { fundCode: string; fundVariantCodes?: string[]; fundName: string; x: number; y: number } | null,
  ) => void;
}) {
  const maxVal = useMemo(() => Math.max(...funds.map((f) => f.marketValueWan ?? 0), 1), [funds]);
  const maxRatio = useMemo(() => Math.max(...funds.map(f => f.ratioPercent), 1), [funds]);

  if (!funds.length) {
    return (
      <div className="table-empty">
        暂无{accessMode === "onExchange" ? "场内" : "场外"}基金持仓记录
      </div>
    );
  }

  return (
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
          </tr>
        </thead>
        <tbody>
          {funds.map((fund, index) => {
            const ratioWidth = Math.min((fund.ratioPercent / maxRatio) * 100, 100);
            const valueWidth = hasWanValue(fund.marketValueWan)
              ? Math.min((fund.marketValueWan / maxVal) * 100, 100)
              : 0;
            const fundCodes = uniqueFundCodes(fund.fundCode, fund.fundVariantCodes);
            const fundName = displayFundName(fund);

            return (
              <tr key={`${fund.fundCode}-${fund.fundName}`}>
                <td>
                  <span className={`rank rank-${index + 1}`}>{index + 1}</span>
                </td>
                <td
                  onMouseEnter={(e) => {
                    if (!supportsHoverPointer()) return;
                    onHoverFund({
                      fundCode: fund.fundCode,
                      fundVariantCodes: fund.fundVariantCodes,
                      fundName,
                      x: e.clientX,
                      y: e.clientY,
                    });
                  }}
                  onMouseMove={(e) => {
                    if (!supportsHoverPointer()) return;
                    onHoverFund({
                      fundCode: fund.fundCode,
                      fundVariantCodes: fund.fundVariantCodes,
                      fundName,
                      x: e.clientX,
                      y: e.clientY,
                    });
                  }}
                  onMouseLeave={() => {
                    if (!supportsHoverPointer()) return;
                    onHoverFund(null);
                  }}
                  onClick={(e) => {
                    onHoverFund({
                      fundCode: fund.fundCode,
                      fundVariantCodes: fund.fundVariantCodes,
                      fundName,
                      x: e.clientX,
                      y: e.clientY,
                    });
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    onHoverFund({
                      fundCode: fund.fundCode,
                      fundVariantCodes: fund.fundVariantCodes,
                      fundName,
                      x: 24,
                      y: 24,
                    });
                  }}
                  tabIndex={0}
                  aria-label={`查看 ${fundName} 前十大持仓`}
                  style={{ cursor: "help" }}
                >
                  <div className="fund-name" title={fund.fundName}>{fundName}</div>
                  <div className="fund-code">
                    <span className="fund-code-list">{fundCodes.join(" / ")}</span>
                  </div>
                  <div className="fund-trade-row">
                    <span className={`trade-pill ${tradeStatusTone(fund.purchaseStatus)}`}>
                      {fund.purchaseStatus || "申购 --"}
                    </span>
                    <span className={`trade-pill ${tradeStatusTone(fund.redemptionStatus)}`}>
                      {fund.redemptionStatus || "赎回 --"}
                    </span>
                    {fund.dailyPurchaseLimit ? (
                      <span className="trade-limit">日限 {fund.dailyPurchaseLimit}</span>
                    ) : null}
                    {fund.minPurchase ? (
                      <span className="trade-limit">起购 {fund.minPurchase}</span>
                    ) : null}
                  </div>
                </td>
                <td>
                  <span className="fund-type-badge">{fund.fundType || "未分类"}</span>
                </td>
                <td className="strong">
                  <div className="table-metric-cell">
                    <span className="metric-num">
                      {valueFormatter.format(fund.ratioPercent)}%
                    </span>
                    <div className="table-progress-track">
                      <div
                        className="table-progress-fill"
                        style={{ width: `${ratioWidth}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td>
                  <div className="table-metric-cell cell-passive">
                    <span className="metric-num-passive">
                      {formatWan(fund.marketValueWan)}
                    </span>
                    <div className="table-progress-track passive-track">
                      <div
                        className="table-progress-fill passive-fill"
                        style={{ width: `${valueWidth}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="shares-cell">{valueFormatter.format(fund.sharesWan)} 万股</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
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
}: {
  stock: PopularStock | StockRecord;
  onSelect: () => void;
}) {
  return (
    <button className="candidate" onClick={onSelect} type="button">
      <span className="candidate-main">
        <span className="candidate-title-row">
          <strong>{stock.name}</strong>
          <span className="market-badge">{marketLabel(stock.code, stock.name)}</span>
        </span>
        <em>{stock.code}</em>
      </span>
      <span>
        {stock.activeFundCount} 只场外基金
        <small>最高 {valueFormatter.format(stock.maxRatioPercent)}%</small>
      </span>
    </button>
  );
}

function EmptyState({ loading, error }: { loading: boolean; error: string | null }) {
  if (loading) {
    return (
      <section className="empty-state">
        <Database size={28} />
        <h2>正在载入持仓索引</h2>
        <p>读取本地 2026Q1 基金股票持仓数据。</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="empty-state error">
        <Database size={28} />
        <h2>数据载入失败</h2>
        <p>{error}</p>
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

function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && status !== "submitting") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, status]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setErrorText("");

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact,
          message,
          website,
          page: window.location.href,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "反馈发送失败，请稍后再试。");
      }

      setStatus("success");
      setContact("");
      setMessage("");
      setWebsite("");
    } catch (submitError) {
      setStatus("error");
      setErrorText(submitError instanceof Error ? submitError.message : "反馈发送失败，请稍后再试。");
    }
  }

  return (
    <div className="feedback-layer" role="presentation">
      <button
        type="button"
        className="feedback-backdrop"
        aria-label="关闭意见反馈"
        onClick={() => status !== "submitting" && onClose()}
      />
      <section className="feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
        <div className="feedback-dialog-header">
          <div>
            <p className="eyeline">FEEDBACK</p>
            <h2 id="feedback-title">意见反馈</h2>
          </div>
          <button type="button" className="feedback-close" aria-label="关闭意见反馈" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {status === "success" ? (
          <div className="feedback-success">
            <MessageSquareText size={26} />
            <strong>已收到</strong>
            <p>我会在邮箱里查看你的反馈。</p>
            <button type="button" onClick={onClose}>完成</button>
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
              留言或意见建议
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={1200}
                placeholder="哪里不好用、数据哪里不对、想加什么功能，都可以写在这里。"
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
            {status === "error" && <p className="feedback-error">{errorText}</p>}
            <button type="submit" className="feedback-submit" disabled={status === "submitting"}>
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
  const [data, setData] = useState<FundStockIndex | null>(null);
  const [query, setQuery] = useState("");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [accessMode, setAccessMode] = useState<AccessMode>("offExchange");
  const [popularMarketFilter, setPopularMarketFilter] = useState<PopularMarketFilter | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Track hovered fund information for Hover Card portal display
  const [hoveredFund, setHoveredFund] = useState<{
    fundCode: string;
    fundVariantCodes?: string[];
    fundName: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    let mounted = true;

    // 使用相对路径，防止部署在子目录时请求到根目录的 404 错误
    fetch(FUND_STOCK_DATA_URL, { cache: "no-cache" })
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
    };
  }, []);

  const matches = useMemo(() => findMatches(data?.stocks ?? [], query), [data, query]);

  const selectedStock = useMemo(() => {
    if (!data) return null;
    const fromSelectedCode = data.stocks.find((stock) => stock.code === selectedCode);
    if (fromSelectedCode) return fromSelectedCode;
    return matches[0] ?? null;
  }, [data, matches, selectedCode]);

  const resultFunds = selectedStock
    ? accessMode === "offExchange"
      ? selectedStock.topByRatio
      : selectedStock.topOnExchangeByRatio ?? []
    : [];
  const selectedFundCount = selectedStock
    ? accessMode === "offExchange"
      ? selectedStock.activeFundCount
      : selectedStock.onExchangeFundCount ?? 0
    : 0;
  const selectedMaxRatio = selectedStock
    ? accessMode === "offExchange"
      ? selectedStock.maxRatioPercent
      : selectedStock.onExchangeMaxRatioPercent ?? 0
    : 0;
  const selectedMarketValue = selectedStock
    ? accessMode === "offExchange"
      ? selectedStock.totalMarketValueWan
      : selectedStock.onExchangeTotalMarketValueWan
    : null;
  const accessLabel = accessMode === "offExchange" ? "场外" : "场内";

  const popularSuggestions = useMemo(() => {
    const source = data?.popularStocks ?? [];
    if (!popularMarketFilter) return source;
    return source.filter((stock) => stockMarketBucket(stock.code, stock.name) === popularMarketFilter);
  }, [data, popularMarketFilter]);

  function chooseStock(stock: PopularStock | StockRecord) {
    setHoveredFund(null);
    setSelectedCode(stock.code);
    setQuery(stock.name);
  }

  const fundHoldingsMap = data?.fundHoldings ?? {};

  useEffect(() => {
    if (!hoveredFund) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setHoveredFund(null);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hoveredFund]);

  // 修复 UI 锁定 Bug：只有在真正处于 loading 且没有发生加载错误时，才显示骨架屏。
  // 如果加载失败，解除 isAppLoading，进入 EmptyState 显示红色的错误载入面板，方便用户排查。
  const isAppLoading = loading && !error;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">
          <span>出海钱眼</span>
          基金持仓穿透
        </div>
        <div className="topbar-meta">
          <span>
            <CalendarDays size={16} />
            {data?.meta.report ?? "2026Q1"}
          </span>
          <span>
            <Database size={16} />
            {data
              ? `${numberFormatter.format(data.meta.overseasStockCount ?? data.meta.stockCount)} 海外标的`
              : "载入中"}
          </span>
        </div>
      </header>

      <section className="search-zone">
        <div className="intro">
          <div className="terminal-kicker">POSITION INTELLIGENCE</div>
          <h1>人出不去 就钱出去</h1>
          <p>
            输入美股或全球龙头，先看场外基金真重仓，也能切到场内 ETF / LOF。
          </p>
        </div>

        <div className="command-panel">
          <div className="panel-status">
            <span>GLOBAL SCAN READY</span>
            <i />
          </div>
          <form className="search-box" onSubmit={(event) => event.preventDefault()}>
            <Search size={22} />
            <input
              aria-label="搜索股票名称或代码"
              placeholder="NVDA / 00700 / 腾讯"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelectedCode(null);
                setHoveredFund(null);
              }}
            />
            <button type="button" onClick={() => matches[0] && chooseStock(matches[0])}>
              <Search size={18} />
              查询
            </button>
          </form>
          <div className="data-strip" aria-label="数据概览">
            <span>{data ? numberFormatter.format(data.meta.sourceRows) : "--"} 大陆公募持仓</span>
            <span>美股优先 · 港股兼容</span>
            <span>
              {data ? numberFormatter.format(data.meta.overseasStockCount ?? data.meta.stockCount) : "--"} 海外标的
            </span>
          </div>
        </div>
      </section>

      <section className={`workspace ${selectedStock ? "has-selection" : "no-selection"}`}>
        <aside className="left-panel" aria-label="股票候选">
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
          <div className="candidate-list">
            {isAppLoading ? (
              [1, 2, 3, 4, 5].map((i) => <SkeletonCandidate key={i} />)
            ) : popularSuggestions.length ? (
              popularSuggestions.map((stock) => (
                <CandidateButton
                  key={stock.code}
                  stock={stock}
                  onSelect={() => chooseStock(stock)}
                />
              ))
            ) : (
              <p className="no-match">{popularMarketFilter ? "暂无该市场热门标的。" : "暂无热门标的。"}</p>
            )}
          </div>
        </aside>

        <section className="results-panel">
          {isAppLoading ? (
            <SkeletonResults />
          ) : selectedStock ? (
            <>
              <div className="result-header">
                <div>
                  <p className="eyeline">
                    {isOverseasStockCode(selectedStock.code, selectedStock.name) ? "当前海外标的" : "当前标的"}
                  </p>
                  <h2>
                    {selectedStock.name}
                    <span>{selectedStock.code}</span>
                  </h2>
                </div>
                <AccessToggle accessMode={accessMode} onChange={setAccessMode} />
              </div>

              <div className="metrics-grid">
                <MetricCard
                  icon={<ShieldCheck size={20} />}
                  label={`${accessLabel}基金覆盖`}
                  value={`${numberFormatter.format(selectedFundCount)} 只`}
                />
                <MetricCard
                  icon={<SlidersHorizontal size={20} />}
                  label="最高净值占比"
                  value={`${valueFormatter.format(selectedMaxRatio)}%`}
                />
                <MetricCard
                  icon={<BarChart3 size={20} />}
                  label={`${accessLabel}持仓市值`}
                  value={formatWan(selectedMarketValue)}
                />
              </div>

              <div className="section-title">
                <h3>前 10 名{accessLabel}基金</h3>
                <span>
                  <ArrowUpDown size={15} />
                  {accessMode === "offExchange"
                    ? "剔除指数和 ETF，按净值占比排序"
                    : "ETF / LOF 等场内品种，按净值占比排序"}
                </span>
              </div>

              <ResultTable funds={resultFunds} accessMode={accessMode} onHoverFund={setHoveredFund} />
            </>
          ) : (
            <EmptyState loading={false} error={error} />
          )}
        </section>
      </section>

      <footer className="compliance-disclaimer">
        <strong>免责声明</strong>
        <p>
          本页面基于公开基金定期报告、基金持仓明细及申赎状态整理，仅供信息展示和研究参考，不构成任何投资建议、基金推荐、销售邀约或收益承诺。基金持仓、申购赎回、费率和限额可能存在披露滞后或实时变化，请以基金管理人、基金销售机构及监管披露文件为准。基金有风险，投资需谨慎。
        </p>
      </footer>

      {hoveredFund && (
        <FundHoldingsHoverCard
          fundCode={hoveredFund.fundCode}
          fundVariantCodes={hoveredFund.fundVariantCodes}
          fundName={hoveredFund.fundName}
          holdings={fundHoldingsMap[hoveredFund.fundCode] || []}
          currentSearchStockCode={selectedStock?.code || null}
          x={hoveredFund.x}
          y={hoveredFund.y}
          onClose={() => setHoveredFund(null)}
        />
      )}

      <button
        type="button"
        className="feedback-trigger"
        aria-label="打开意见反馈"
        onClick={() => setFeedbackOpen(true)}
      >
        <MessageSquareText size={17} />
        意见反馈
      </button>
      <FeedbackDialog open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </main>
  );
}
