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
import aiBattleHotspotsData from "../config/ai-battle-hotspots.json";
import { fundQuarter } from "./fundQuarter";

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
  "code" | "name" | "fundCount" | "activeFundCount" | "maxRatioPercent"
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

type AiBattleHotspot = {
  code: string;
  label: string;
  track: string;
  thesis: string;
  evidence: string;
  homepageQuickEntry?: boolean;
};

const japaneseStockNamePattern =
  /东京|丰田|索尼|日立|三菱|任天堂|软银|本田|东京电子|三井|住友|瑞穗|武田|迅销|基恩士|信越|村田|电装|佳能|尼康|日本/;
const koreanStockNamePattern =
  /三星电子|SK海力士|现代汽车|起亚|LG|NAVER|Kakao|浦项|POSCO|Celltrion|韩华|韩国电力/;

const numberFormatter = new Intl.NumberFormat("zh-CN");
const valueFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 2,
});
const FUND_STOCK_DATA_URL = fundQuarter.dataUrl;
const aiBattleHotspots = aiBattleHotspotsData as AiBattleHotspot[];
const homepageQuickHotspots = aiBattleHotspots.filter((hotspot) => hotspot.homepageQuickEntry);

function getInitialQuery() {
  const stockCode = getInitialSearchParam("stock");
  const query = getInitialSearchParam("q");
  return query || stockCode || "";
}

function getInitialSelectedCode() {
  return getInitialSearchParam("stock") || null;
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

function financialLogoSymbol(code: string, name = "") {
  const normalized = code.trim().toUpperCase();

  if (/^\d{5}$/.test(normalized)) {
    return `${normalized.replace(/^0(?=\d{4}$)/, "")}.HK`;
  }
  if (/^\d{4}\.(T|JP)$/.test(normalized)) {
    return normalized.replace(/\.JP$/, ".T");
  }
  if (/^\d{6}\.(KS|KQ)$/.test(normalized)) {
    return normalized;
  }
  if (/^\d{4}$/.test(normalized)) {
    if (/台积电|台積電|台湾|臺灣/.test(name)) return `${normalized}.TW`;
    return `${normalized}.T`;
  }
  if (/^\d{6}$/.test(normalized) && koreanStockNamePattern.test(name)) {
    return `${normalized}.KS`;
  }
  return normalized;
}

function remoteStockLogoUrl(code: string, name = "") {
  return `https://financialmodelingprep.com/image-stock/${encodeURIComponent(financialLogoSymbol(code, name))}.png`;
}

function eodLogoPath(code: string, name = "") {
  const normalized = code.trim().toUpperCase();

  if (/^\d{5}$/.test(normalized)) {
    return `HK/${normalized.replace(/^0(?=\d{4}$)/, "")}.png`;
  }
  if (/^\d{4}\.(T|JP)$/.test(normalized)) {
    return `TSE/${normalized.slice(0, 4)}.png`;
  }
  if (/^\d{6}\.(KS|KQ)$/.test(normalized)) {
    return `KO/${normalized.slice(0, 6)}.png`;
  }
  if (/^\d{4}$/.test(normalized)) {
    if (/台积电|台積電|台湾|臺灣/.test(name)) return `TW/${normalized}.png`;
    return `TSE/${normalized}.png`;
  }
  if (/^\d{6}$/.test(normalized) && koreanStockNamePattern.test(name)) {
    return `KO/${normalized}.png`;
  }
  if (/^[A-Z]{1,5}([.-][A-Z]{1,2})?$/.test(normalized)) {
    return `US/${normalized}.png`;
  }
  return "";
}

function eodStockLogoUrl(code: string, name = "") {
  const logoPath = eodLogoPath(code, name);
  return logoPath ? `https://eodhd.com/img/logos/${logoPath}` : "";
}

function localStockLogoUrl(code: string) {
  return `stock-logos/${normalizeStockCode(code).toLowerCase()}.png`;
}

function stockLogoSources(code: string, name = "") {
  return Array.from(
    new Set(
      [localStockLogoUrl(code), remoteStockLogoUrl(code, name), eodStockLogoUrl(code, name)].filter(Boolean),
    ),
  );
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

function formatPercent(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${valueFormatter.format(value)}%`
    : "未估算";
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

function StockLogo({
  code,
  name,
  size = "sm",
}: {
  code: string;
  name: string;
  size?: "sm" | "lg";
}) {
  const sources = useMemo(() => stockLogoSources(code, name), [code, name]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [failed, setFailed] = useState(false);
  const src = sources[sourceIndex];

  useEffect(() => {
    setSourceIndex(0);
    setFailed(false);
  }, [sources]);

  if (failed || !src) return null;

  return (
    <span className={`stock-logo ${size === "lg" ? "large" : ""}`}>
      <img
        alt={`${name} 品牌图标`}
        src={src}
        loading="lazy"
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
            <th>交易状态</th>
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
                <td>
                  <div className="status-stack">
                    <span className={`trade-pill ${tradeStatusTone(fund.purchaseStatus)}`}>
                      {fund.purchaseStatus || "申购 --"}
                    </span>
                    <span className={`trade-pill ${tradeStatusTone(fund.redemptionStatus)}`}>
                      {fund.redemptionStatus || "赎回 --"}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function IndirectExposureTable({
  exposures,
  onHoverFund,
}: {
  exposures: IndirectExposureRecord[];
  onHoverFund: (
    fund: { fundCode: string; fundVariantCodes?: string[]; fundName: string; x: number; y: number } | null,
  ) => void;
}) {
  const maxRawRatio = useMemo(() => Math.max(...exposures.map((f) => f.ratioPercent), 1), [exposures]);
  const maxEstimatedRatio = useMemo(
    () => Math.max(...exposures.map((f) => f.estimatedRatioPercent ?? f.ratioPercent), 1),
    [exposures],
  );

  if (!exposures.length) {
    return null;
  }

  return (
    <div className="indirect-exposure-panel" aria-labelledby="indirect-exposure-title">
      <div className="section-title section-title-spaced">
        <h3 id="indirect-exposure-title">间接 / 杠杆 ETF 暴露</h3>
        <span>
          <ArrowUpDown size={15} />
          不并入正股直接持仓，按估算经济暴露排序
        </span>
      </div>
      <p className="indirect-note">
        这里展示基金持有的海外个股杠杆 ETF / ETP / ETN 等产品。原占净值来自基金披露，估算暴露按产品杠杆倍数折算，仅作方向性穿透。
      </p>
      <div className="table-wrap indirect-table-wrap">
        <table>
          <thead>
            <tr>
              <th>排名</th>
              <th>基金</th>
              <th>杠杆产品</th>
              <th>原占净值</th>
              <th>估算暴露</th>
              <th>持仓市值</th>
              <th>交易状态</th>
            </tr>
          </thead>
          <tbody>
            {exposures.map((fund, index) => {
              const rawWidth = Math.min((fund.ratioPercent / maxRawRatio) * 100, 100);
              const estimatedRatio = fund.estimatedRatioPercent ?? null;
              const estimatedWidth =
                typeof estimatedRatio === "number"
                  ? Math.min((estimatedRatio / maxEstimatedRatio) * 100, 100)
                  : rawWidth;
              const fundCodes = uniqueFundCodes(fund.fundCode, fund.fundVariantCodes);
              const fundName = displayFundName(fund);

              return (
                <tr key={`${fund.fundCode}-${fund.sourceCode}-${fund.sourceName}`}>
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
                  </td>
                  <td>
                    <div className="indirect-product-name" title={fund.sourceName}>{fund.sourceName}</div>
                    <div className="indirect-product-code">
                      <span>{fund.sourceCode}</span>
                      <span className="leverage-pill">
                        {fund.leverageMultiple ? `${valueFormatter.format(fund.leverageMultiple)}x` : "杠杆"}
                      </span>
                    </div>
                  </td>
                  <td className="strong">
                    <div className="table-metric-cell">
                      <span className="metric-num">{valueFormatter.format(fund.ratioPercent)}%</span>
                      <div className="table-progress-track">
                        <div className="table-progress-fill" style={{ width: `${rawWidth}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="strong">
                    <div className="table-metric-cell">
                      <span className="metric-num estimated-num">{formatPercent(estimatedRatio)}</span>
                      <div className="table-progress-track">
                        <div className="table-progress-fill estimated-fill" style={{ width: `${estimatedWidth}%` }} />
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="table-metric-cell cell-passive">
                      <span className="metric-num-passive">{formatWan(fund.marketValueWan)}</span>
                    </div>
                  </td>
                  <td>
                    <div className="status-stack">
                      <span className={`trade-pill ${tradeStatusTone(fund.purchaseStatus)}`}>
                        {fund.purchaseStatus || "申购 --"}
                      </span>
                      <span className={`trade-pill ${tradeStatusTone(fund.redemptionStatus)}`}>
                        {fund.redemptionStatus || "赎回 --"}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
  onSelect: () => void;
  selected?: boolean;
}) {
  return (
    <button className={`candidate ${selected ? "selected" : ""}`} onClick={onSelect} type="button">
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
        <p>读取本地 {fundQuarter.report} 基金股票持仓数据。</p>
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
  const [query, setQuery] = useState(getInitialQuery);
  const [selectedCode, setSelectedCode] = useState<string | null>(getInitialSelectedCode);
  const [accessMode, setAccessMode] = useState<AccessMode>("offExchange");
  const [popularMarketFilter, setPopularMarketFilter] = useState<PopularMarketFilter | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<"research" | "methodology">("research");
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
    const normalizedSelectedCode = selectedCode ? normalizeStockCode(selectedCode) : "";
    const fromSelectedCode = normalizedSelectedCode
      ? data.stocks.find((stock) => normalizeStockCode(stock.code) === normalizedSelectedCode)
      : null;
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
  const selectedIndirectExposures = selectedStock?.topIndirectExposureByRatio ?? [];
  const selectedIndirectExposureCount =
    selectedStock?.indirectExposureFundCount ?? selectedIndirectExposures.length;
  const accessLabel = accessMode === "offExchange" ? "场外" : "场内";

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

  function chooseStock(stock: PopularStock | StockRecord) {
    setHoveredFund(null);
    setSelectedCode(stock.code);
    setQuery(stock.name);
  }

  function changeAccessMode(mode: AccessMode) {
    setHoveredFund(null);
    setAccessMode(mode);
  }

  function scrollToPageSection(sectionId: "research" | "methodology") {
    setActiveSection(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
        <nav className="topbar-nav" aria-label="当前功能区">
          <button
            type="button"
            className={activeSection === "research" ? "active" : ""}
            aria-current={activeSection === "research" ? "page" : undefined}
            onClick={() => scrollToPageSection("research")}
          >
            研究
          </button>
          <button
            type="button"
            className={activeSection === "methodology" ? "active" : ""}
            aria-current={activeSection === "methodology" ? "page" : undefined}
            onClick={() => scrollToPageSection("methodology")}
          >
            方法论
          </button>
        </nav>
        <div className="topbar-meta">
          <span>
            <CalendarDays size={16} />
            {data?.meta.report ?? fundQuarter.report}
          </span>
          <span>
            <Database size={16} />
            {data
              ? `${numberFormatter.format(data.meta.overseasStockCount ?? data.meta.stockCount)} 海外标的`
              : "载入中"}
          </span>
        </div>
      </header>

      <section id="research" className="search-zone">
        <div className="command-panel">
          <div className="panel-status">
            <span>全球股票 / 指数 / ETF</span>
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
        </div>

        <div className="recent-panel" aria-label="快速查询">
          <div className="panel-status">
            <span>AI 存储热点</span>
          </div>
          <div className="recent-chips">
            {quickStocks.length ? (
              quickStocks.map((stock) => (
                <button key={stock.code} type="button" onClick={() => chooseStock(stock)}>
                  {stock.code}
                </button>
              ))
            ) : (
              <span>数据载入中</span>
            )}
          </div>
        </div>

        <div className="summary-card" aria-label="基金数据总览">
          <span>全市场基金总数</span>
          <strong>{data ? numberFormatter.format(data.meta.fundCount ?? data.meta.sourceRows) : "--"} 只</strong>
          <small>覆盖中外市场</small>
        </div>
      </section>

      <section className="ai-hotspot-section" aria-labelledby="ai-hotspot-title">
        <div className="ai-hotspot-head">
          <div>
            <p className="eyeline">AI 战报热点</p>
            <h2 id="ai-hotspot-title">最近高频标的一键穿透</h2>
          </div>
          <span>
            邮件战报热点 + {data?.meta.report ?? fundQuarter.report} 基金持仓
          </span>
        </div>
        <div className="ai-hotspot-grid">
          {aiBattleHotspotCards.length ? (
            aiBattleHotspotCards.map(({ hotspot, stock }) => {
              const isActive = normalizeStockCode(selectedStock?.code ?? "") === normalizeStockCode(stock.code);

              return (
                <article key={hotspot.code} className={`ai-hotspot-card ${isActive ? "active" : ""}`}>
                  <button
                    type="button"
                    className="ai-hotspot-main"
                    aria-label={`查看 ${hotspot.label} 的基金持仓穿透结果`}
                    onClick={() => chooseStock(stock)}
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
                    <span className="hotspot-thesis">{hotspot.thesis}</span>
                    <span className="hotspot-metrics">
                      <span>
                        <small>场外基金</small>
                        <b>{numberFormatter.format(stock.activeFundCount)} 只</b>
                      </span>
                      <span>
                        <small>最高占比</small>
                        <b>{valueFormatter.format(stock.maxRatioPercent)}%</b>
                      </span>
                    </span>
                  </button>
                </article>
              );
            })
          ) : (
            <div className="ai-hotspot-empty">热点入口载入中</div>
          )}
        </div>
      </section>

      <section className="selected-context" aria-label="当前研究上下文">
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

      <section className={`workspace ${selectedStock ? "has-selection" : "no-selection"}`}>
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
                  onSelect={() => chooseStock(stock)}
                  selected={selectedStock?.code === stock.code}
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
                  <div className="result-title-row">
                    <StockLogo code={selectedStock.code} name={selectedStock.name} size="lg" />
                    <h2>
                      {selectedStock.name}
                      <span>{selectedStock.code}</span>
                    </h2>
                  </div>
                  <div className="result-tags">
                    <span>{marketLabel(selectedStock.code, selectedStock.name)}</span>
                    <span>{data?.meta.report ?? fundQuarter.report}</span>
                    <span>{accessLabel}持仓</span>
                  </div>
                </div>
                <AccessToggle accessMode={accessMode} onChange={changeAccessMode} />
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
                <h3>前 10 名{accessLabel}基金持仓明细</h3>
                <span>
                  <ArrowUpDown size={15} />
                  {accessMode === "offExchange"
                    ? "剔除指数和 ETF，按净值占比排序"
                    : "ETF / LOF 等场内品种，按净值占比排序"}
                </span>
              </div>

              <ResultTable funds={resultFunds} accessMode={accessMode} onHoverFund={setHoveredFund} />
              {selectedIndirectExposureCount > 0 ? (
                <IndirectExposureTable
                  exposures={selectedIndirectExposures}
                  onHoverFund={setHoveredFund}
                />
              ) : null}
            </>
          ) : (
            <EmptyState loading={false} error={error} />
          )}
        </section>
      </section>

      <section id="methodology" className="methodology-section" aria-labelledby="methodology-title">
        <div className="methodology-head">
          <span>方法论</span>
          <h2 id="methodology-title">基金持仓穿透口径</h2>
          <p>
            数据期为 {data?.meta.report ?? fundQuarter.report}，截至 {data?.meta.cutoffDate ?? fundQuarter.cutoffDate}。页面优先展示海外标的在公募基金披露持仓中的覆盖、权重和可交易状态。
          </p>
        </div>
        <div className="methodology-grid">
          <article>
            <strong>场外样本</strong>
            <p>剔除指数、ETF、ETF 联接等被动跟踪基金，保留主动基金里对单只股票的高权重表达。</p>
          </article>
          <article>
            <strong>场内样本</strong>
            <p>ETF、LOF、封闭式基金和 REIT 单独归入场内视图，便于和场外主动配置分开判断。</p>
          </article>
          <article>
            <strong>间接暴露</strong>
            <p>海外个股杠杆 ETF/ETP/ETN 通过名称和配置映射回正股，单独展示原始占比和估算经济暴露。</p>
          </article>
          <article>
            <strong>排序规则</strong>
            <p>默认按个股占基金净值比例排序；持仓市值缺失时保留披露状态，不用估算值替代。</p>
          </article>
          <article>
            <strong>份额合并</strong>
            <p>同一基金的 A/C、币种、前后端份额合并展示，同时保留全部基金代码供回查。</p>
          </article>
        </div>
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
