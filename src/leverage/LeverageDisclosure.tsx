import type { LeverageDashboardPayload, LeverageManifest } from "./types";

interface LeverageDisclosureProps {
  payload: LeverageDashboardPayload;
  manifest: LeverageManifest;
}

const MARKET_CAP_SOURCES = [
  "official_exchange_pre2017_raw_chain_audited",
  "pre2017_official_unavailable",
  // 兼容已发布的旧静态包；新构建器不会再生成这个来源值。
  "pre2017_official_pending",
  "eastmoney_post2017_vendor_unverified",
] as const;

interface MarketCapSourceSegment {
  marketCapSource: (typeof MARKET_CAP_SOURCES)[number];
  start: string;
  end: string;
  reviewStatus: string | null;
  ratioAvailable: boolean | null;
}

function ratioRangeText(payload: LeverageDashboardPayload): string {
  const range = payload.provenance.ratio_data_range;
  if (range === null || range.start === null || range.end === null) {
    return "";
  }
  return `${range.start} 至 ${range.end}`;
}

function asSourceSegment(value: unknown): MarketCapSourceSegment | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  return isMarketCapSource(record.market_cap_source) &&
    typeof record.start === "string" &&
    typeof record.end === "string" &&
    (record.market_cap_review_status === undefined ||
      record.market_cap_review_status === null ||
      typeof record.market_cap_review_status === "string") &&
    (record.ratio_available === undefined || typeof record.ratio_available === "boolean")
    ? {
        marketCapSource: record.market_cap_source,
        start: record.start,
        end: record.end,
        reviewStatus:
          typeof record.market_cap_review_status === "string"
            ? record.market_cap_review_status
            : null,
        ratioAvailable:
          typeof record.ratio_available === "boolean" ? record.ratio_available : null,
      }
    : null;
}

function isMarketCapSource(
  value: unknown,
): value is (typeof MARKET_CAP_SOURCES)[number] {
  return MARKET_CAP_SOURCES.some((source) => source === value);
}

function marketCapSourceSegments(manifest: LeverageManifest): MarketCapSourceSegment[] {
  return manifest.market_cap.source_segments
    .map(asSourceSegment)
    .filter((segment): segment is MarketCapSourceSegment => segment !== null);
}

function hasAuditedPre2017Segment(manifest: LeverageManifest): boolean {
  return marketCapSourceSegments(manifest)
    .some(
      (segment) =>
        segment.marketCapSource === "official_exchange_pre2017_raw_chain_audited" &&
        segment.reviewStatus === "official_exchange_pre2017_raw_chain_audited" &&
        segment.ratioAvailable === true,
    );
}

function marketCapSourceSummary(manifest: LeverageManifest): string {
  const segments = marketCapSourceSegments(manifest);
  if (hasAuditedPre2017Segment(manifest)) {
    return "市值来源：交易所历史数据（2011–2016）· 东方财富 Choice（2017 年起）。";
  }
  if (segments.some((segment) => segment.marketCapSource === "pre2017_official_unavailable")) {
    return "市值来源：2011–2016 暂缺 · 东方财富 Choice（2017 年起）。";
  }
  return "市值来源：2011–2016 待更新 · 东方财富 Choice（2017 年起）。";
}

export function LeverageDisclosure({ payload, manifest }: LeverageDisclosureProps) {
  const ratioAvailable = payload.provenance.ratio_available;
  const ratioRange = ratioRangeText(payload);
  const fullRange = `${manifest.data_range.start} 至 ${manifest.data_range.end}`;

  return (
    <aside className="leverage-disclosure" aria-label="数据说明">
      <details>
        <summary>
          <span>数据说明</span>
          <small>来源与范围</small>
        </summary>
        <div className="leverage-disclosure-content">
          <p>融资数据：东方财富；指数数据：通达信。</p>
          <p>数据范围：{fullRange}。</p>
          {ratioAvailable && ratioRange !== "" && ratioRange !== fullRange && (
            <p>比例范围：{ratioRange}。</p>
          )}
          {!ratioAvailable && <p>融资余额占市值：暂不可用。</p>}
          <p>{marketCapSourceSummary(manifest)}</p>
          <p>计算方式：融资余额 ÷ 沪深 A 股市值。</p>
          <p className="leverage-disclosure-warning">
            融资余额变化用于观察市场杠杆，不代表涨跌判断。
          </p>
          <p className="leverage-disclosure-warning">仅供趋势参考，不构成投资建议。</p>
        </div>
      </details>
    </aside>
  );
}
