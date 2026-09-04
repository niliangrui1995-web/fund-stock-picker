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
  "mx_pre2017_vendor_unverified",
  "pre2017_mx_vendor_unavailable",
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

function hasMxPre2017Segment(manifest: LeverageManifest): boolean {
  return marketCapSourceSegments(manifest)
    .some(
      (segment) =>
        segment.marketCapSource === "mx_pre2017_vendor_unverified" &&
        segment.reviewStatus === "mx_vendor_unverified" &&
        segment.ratioAvailable === true,
    );
}

function marketCapSourceSummary(manifest: LeverageManifest): string {
  const segments = marketCapSourceSegments(manifest);
  if (hasAuditedPre2017Segment(manifest)) {
    return "市值来源：交易所历史数据（2011–2016）· 东方财富 Choice（2017 年起）。";
  }
  if (hasMxPre2017Segment(manifest)) {
    return "市值来源：东方财富妙想厂商数据（2011–2016）· 东方财富 Choice（2017 年起）。";
  }
  if (segments.some(
    (segment) =>
      segment.marketCapSource === "pre2017_official_unavailable" ||
      segment.marketCapSource === "pre2017_mx_vendor_unavailable",
  )) {
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
      <div className="leverage-disclosure-essential">
        <p>融资余额反映市场杠杆，不预示涨跌；占市值比例 = 融资余额 ÷ 沪深 A 股市值。</p>
        {ratioAvailable && <p className="leverage-disclosure-warning">厂商分段未经交易所复核；融资余额可能含非 A 股标的，跨来源占比不可直接比较。</p>}
      </div>
      <details>
        <summary>数据说明</summary>
        <div className="leverage-disclosure-content">
          <p>数据包更新日：{payload.generated_at_beijing.slice(0, 10)}；已通过校验。</p>
          <p>融资数据：东方财富；指数数据：通达信。</p>
          <p>数据范围：{fullRange}。</p>
          {ratioAvailable && ratioRange !== "" && ratioRange !== fullRange && (
            <p>比例范围：{ratioRange}。</p>
          )}
          {!ratioAvailable && <p>融资余额占市值：暂不可用。</p>}
          <p>{marketCapSourceSummary(manifest)}</p>
          <p>该聚合比值不是正式财务比例，也不代表分子与分母的证券类别完全匹配。</p>
          <p>仅供趋势参考，不构成投资建议。</p>
        </div>
      </details>
    </aside>
  );
}
