import {
  ArrowUpDown,
  BarChart3,
  CalendarDays,
  Database,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type RankMode = "ratio" | "value";

type FundRecord = {
  fundCode: string;
  fundName: string;
  fundType: string;
  reportPeriod: string;
  cutoffDate: string;
  ratio: number;
  ratioPercent: number;
  marketValueWan: number | null;
  sharesWan: number;
  purchaseStatus?: string;
  redemptionStatus?: string;
  minPurchase?: string;
  dailyPurchaseLimit?: string;
  tradeStatusText?: string;
  fundVariantCount?: number;
};

type StockRecord = {
  code: string;
  name: string;
  fundCount: number;
  activeFundCount: number;
  excludedIndexFundCount: number;
  totalMarketValueWan: number | null;
  maxRatioPercent: number;
  topByRatio: FundRecord[];
  topByValue: FundRecord[];
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
  };
  popularStocks: PopularStock[];
  stocks: StockRecord[];
  fundHoldings?: Record<string, HoldingRecord[]>;
};

const numberFormatter = new Intl.NumberFormat("zh-CN");
const valueFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 2,
});

function normalize(input: string) {
  return input.trim().replace(/\s+/g, "").toLowerCase();
}

function isOverseasStockCode(code: string) {
  return !/^\d{6}$/.test(code.trim());
}

function marketLabel(code: string) {
  const normalized = code.trim().toUpperCase();
  if (/^\d{5}$/.test(normalized)) return "港股";
  if (/^[A-Z][A-Z0-9.-]*$/.test(normalized)) return "美股";
  return isOverseasStockCode(normalized) ? "海外" : "A股";
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

function FundHoldingsHoverCard({
  fundCode,
  fundName,
  holdings,
  currentSearchStockCode,
  x,
  y,
}: {
  fundCode: string;
  fundName: string;
  holdings: HoldingRecord[];
  currentSearchStockCode: string | null;
  x: number;
  y: number;
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
  const topHolding = holdings[0] ?? null;
  const viewportWidth = typeof window === "undefined" ? 1200 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 800 : window.innerHeight;
  const cardWidth = Math.min(368, viewportWidth - 24);
  const rowCount = Math.min(holdings.length, 10);
  const estimatedHeight = 226 + rowCount * 40 + (currentHolding ? 48 : 0);
  const visibleHeight = Math.min(estimatedHeight, viewportHeight - 24);
  const cardLeft = Math.max(12, Math.min(x + 18, viewportWidth - cardWidth - 12));
  const cardTop = Math.max(12, Math.min(y + 12, viewportHeight - visibleHeight - 12));
  
  return (
    <div
      className="fund-holdings-hover-card"
      style={{
        position: "fixed",
        left: `${cardLeft}px`,
        top: `${cardTop}px`,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      <div className="hover-card-header">
        <div className="hover-card-fund-info">
          <div className="hover-card-fund-name" title={fundName}>
            {fundName}
          </div>
          <div className="hover-card-meta-line">
            <span>基金代码</span>
            <strong>{fundCode}</strong>
          </div>
        </div>
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

function RankingToggle({
  rankMode,
  onChange,
}: {
  rankMode: RankMode;
  onChange: (mode: RankMode) => void;
}) {
  return (
    <div className="segmented" aria-label="排名口径">
      <button
        className={rankMode === "ratio" ? "active" : ""}
        onClick={() => onChange("ratio")}
        type="button"
      >
        <SlidersHorizontal size={16} />
        净值占比
      </button>
      <button
        className={rankMode === "value" ? "active" : ""}
        onClick={() => onChange("value")}
        type="button"
      >
        <BarChart3 size={16} />
        持仓市值
      </button>
    </div>
  );
}

function ResultTable({
  funds,
  rankMode,
  onHoverFund,
}: {
  funds: FundRecord[];
  rankMode: RankMode;
  onHoverFund: (fund: { fundCode: string; fundName: string; x: number; y: number } | null) => void;
}) {
  const maxVal = useMemo(() => Math.max(...funds.map((f) => f.marketValueWan ?? 0), 1), [funds]);
  const maxRatio = useMemo(() => Math.max(...funds.map(f => f.ratioPercent), 1), [funds]);

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>排名</th>
            <th>基金</th>
            <th>类型</th>
            <th>{rankMode === "ratio" ? "净值占比" : "持仓市值"}</th>
            <th>{rankMode === "ratio" ? "持仓市值" : "净值占比"}</th>
            <th>持股数</th>
          </tr>
        </thead>
        <tbody>
          {funds.map((fund, index) => {
            const ratioWidth = Math.min((fund.ratioPercent / maxRatio) * 100, 100);
            const valueWidth = hasWanValue(fund.marketValueWan)
              ? Math.min((fund.marketValueWan / maxVal) * 100, 100)
              : 0;
            const activeWidth = rankMode === "ratio" ? ratioWidth : valueWidth;
            const passiveWidth = rankMode === "ratio" ? valueWidth : ratioWidth;

            return (
              <tr key={`${fund.fundCode}-${fund.fundName}`}>
                <td>
                  <span className={`rank rank-${index + 1}`}>{index + 1}</span>
                </td>
                <td
                  onMouseEnter={(e) => {
                    onHoverFund({
                      fundCode: fund.fundCode,
                      fundName: fund.fundName,
                      x: e.clientX,
                      y: e.clientY,
                    });
                  }}
                  onMouseMove={(e) => {
                    onHoverFund({
                      fundCode: fund.fundCode,
                      fundName: fund.fundName,
                      x: e.clientX,
                      y: e.clientY,
                    });
                  }}
                  onMouseLeave={() => {
                    onHoverFund(null);
                  }}
                  style={{ cursor: "help" }}
                >
                  <div className="fund-name" title={fund.fundName}>{fund.fundName}</div>
                  <div className="fund-code">
                    {fund.fundCode}
                    {fund.fundVariantCount && fund.fundVariantCount > 1 ? (
                      <span className="fund-variant-note">已合并 {fund.fundVariantCount} 类份额</span>
                    ) : null}
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
                      {rankMode === "ratio"
                        ? `${valueFormatter.format(fund.ratioPercent)}%`
                        : formatWan(fund.marketValueWan)}
                    </span>
                    <div className="table-progress-track">
                      <div
                        className="table-progress-fill"
                        style={{ width: `${activeWidth}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td>
                  <div className="table-metric-cell cell-passive">
                    <span className="metric-num-passive">
                      {rankMode === "ratio"
                        ? formatWan(fund.marketValueWan)
                        : `${valueFormatter.format(fund.ratioPercent)}%`}
                    </span>
                    <div className="table-progress-track passive-track">
                      <div
                        className="table-progress-fill passive-fill"
                        style={{ width: `${passiveWidth}%` }}
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
  selected,
  onSelect,
}: {
  stock: PopularStock | StockRecord;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button className={`candidate ${selected ? "selected" : ""}`} onClick={onSelect} type="button">
      <span className="candidate-main">
        <span className="candidate-title-row">
          <strong>{stock.name}</strong>
          <span className="market-badge">{marketLabel(stock.code)}</span>
        </span>
        <em>{stock.code}</em>
      </span>
      <span>
        {stock.activeFundCount} 只筛后基金
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

export function App() {
  const [data, setData] = useState<FundStockIndex | null>(null);
  const [query, setQuery] = useState("");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [rankMode, setRankMode] = useState<RankMode>("ratio");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Track hovered fund information for Hover Card portal display
  const [hoveredFund, setHoveredFund] = useState<{
    fundCode: string;
    fundName: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    let mounted = true;

    // 使用相对路径，防止部署在子目录时请求到根目录的 404 错误
    fetch("data/fund-stock-index-2026q1.json")
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
    ? rankMode === "ratio"
      ? selectedStock.topByRatio
      : selectedStock.topByValue
    : [];

  const suggestions = query.trim() ? matches : data?.popularStocks ?? [];

  function chooseStock(stock: PopularStock | StockRecord) {
    setSelectedCode(stock.code);
    setQuery(stock.name);
  }

  const fundHoldingsMap = data?.fundHoldings ?? {};

  // 修复 UI 锁定 Bug：只有在真正处于 loading 且没有发生加载错误时，才显示骨架屏。
  // 如果加载失败，解除 isAppLoading，进入 EmptyState 显示红色的错误载入面板，方便用户排查。
  const isAppLoading = loading && !error;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-mark">
          <span>FUNDTRACE</span>
          持仓穿透
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
            输入美股或全球龙头，从大陆公募里剔除指数和 ETF，锁定真正重仓它的前 10 只基金。
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
            <h2>{query.trim() ? "匹配股票" : data?.meta.popularScopeLabel ?? "海外热门"}</h2>
            <span>{isAppLoading ? "载入中..." : `${suggestions.length} 项`}</span>
          </div>
          <div className="candidate-list">
            {isAppLoading ? (
              [1, 2, 3, 4, 5].map((i) => <SkeletonCandidate key={i} />)
            ) : suggestions.length ? (
              suggestions.map((stock) => (
                <CandidateButton
                  key={stock.code}
                  stock={stock}
                  selected={stock.code === selectedStock?.code}
                  onSelect={() => chooseStock(stock)}
                />
              ))
            ) : (
              <p className="no-match">未找到匹配标的，试试证券代码或简称。</p>
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
                  <p className="eyeline">{isOverseasStockCode(selectedStock.code) ? "当前海外标的" : "当前标的"}</p>
                  <h2>
                    {selectedStock.name}
                    <span>{selectedStock.code}</span>
                  </h2>
                </div>
                <RankingToggle rankMode={rankMode} onChange={setRankMode} />
              </div>

              <div className="metrics-grid">
                <MetricCard
                  icon={<ShieldCheck size={20} />}
                  label="大陆基金覆盖"
                  value={`${numberFormatter.format(selectedStock.activeFundCount)} 只`}
                />
                <MetricCard
                  icon={<SlidersHorizontal size={20} />}
                  label="最高净值占比"
                  value={`${valueFormatter.format(selectedStock.maxRatioPercent)}%`}
                />
                <MetricCard
                  icon={<BarChart3 size={20} />}
                  label="筛后持仓市值"
                  value={formatWan(selectedStock.totalMarketValueWan)}
                />
              </div>

              <div className="section-title">
                <h3>前 10 名筛后基金</h3>
                <span>
                  <ArrowUpDown size={15} />
                  {rankMode === "ratio" ? "剔除指数和 ETF，按净值占比排序" : "剔除指数和 ETF，按持仓市值排序"}
                </span>
              </div>

              <ResultTable funds={resultFunds} rankMode={rankMode} onHoverFund={setHoveredFund} />
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
          fundName={hoveredFund.fundName}
          holdings={fundHoldingsMap[hoveredFund.fundCode] || []}
          currentSearchStockCode={selectedStock?.code || null}
          x={hoveredFund.x}
          y={hoveredFund.y}
        />
      )}
    </main>
  );
}
