import type { LeverageDashboardPayload, LeverageManifest } from "./types";

interface LeverageDisclosureProps {
  payload: LeverageDashboardPayload;
  manifest: LeverageManifest;
}

const MARKET_CAP_SOURCES = [
  "pre2017_official_pending",
  "eastmoney_post2017_vendor_unverified",
] as const;

interface MarketCapSourceSegment {
  marketCapSource: (typeof MARKET_CAP_SOURCES)[number];
  start: string;
  end: string;
}

function ratioRangeText(payload: LeverageDashboardPayload): string {
  const range = payload.provenance.ratio_data_range;
  if (range === null || range.start === null || range.end === null) {
    return "N/A";
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
    typeof record.end === "string"
    ? {
        marketCapSource: record.market_cap_source,
        start: record.start,
        end: record.end,
      }
    : null;
}

function isMarketCapSource(
  value: unknown,
): value is (typeof MARKET_CAP_SOURCES)[number] {
  return MARKET_CAP_SOURCES.some((source) => source === value);
}

function formatMarketCapSource(segment: MarketCapSourceSegment): string {
  const description =
    segment.marketCapSource === "pre2017_official_pending"
      ? "交易所历史市值段待准出（比例 N/A）"
      : "东方财富Choice厂商市值／未经交易所复核、未经完整审计";
  return `${segment.start} 至 ${segment.end}：${description}`;
}

function marketCapSourceText(manifest: LeverageManifest): string[] {
  const segments = manifest.market_cap.source_segments
    .map(asSourceSegment)
    .filter((segment): segment is MarketCapSourceSegment => segment !== null);
  return segments.length > 0
    ? segments.map(formatMarketCapSource)
    : ["N/A"];
}

function marketCapReviewText(manifest: LeverageManifest): string {
  const eligibility = manifest.market_cap.reporting_eligible ? "正式报告资格：是" : "正式报告资格：否";
  if (manifest.market_cap.ratio_review_status === "mixed_pre2017_pending_eastmoney_vendor_unverified") {
    return `2017 年前交易所历史市值段待准出；2017-01-03 起为东方财富Choice厂商未复核／未完整审计口径；${eligibility}`;
  }
  return `${manifest.market_cap.ratio_review_status || "N/A"}；${eligibility}`;
}

export function LeverageDisclosure({ payload, manifest }: LeverageDisclosureProps) {
  const ratioAvailable = payload.provenance.ratio_available;
  const payloadHash = manifest.payload_sha256.slice(0, 12);
  const sourceSegments = marketCapSourceText(manifest);

  return (
    <aside className="leverage-disclosure" aria-label="数据口径与风险披露">
      <div className="leverage-disclosure-heading">
        <span>数据口径</span>
        <strong>离线静态包</strong>
      </div>

      <dl className="leverage-disclosure-list">
        <div>
          <dt>两融余额</dt>
          <dd>DFCF 厂商口径／未经交易所复核</dd>
        </div>
        <div>
          <dt>指数收盘</dt>
          <dd>本地 TDX 当前数据，非交易所官方统计</dd>
        </div>
        <div>
          <dt>完整数据范围</dt>
          <dd>{manifest.data_range.start} 至 {manifest.data_range.end}</dd>
        </div>
        <div>
          <dt>比例可用区间</dt>
          <dd>{ratioAvailable ? ratioRangeText(payload) : "N/A"}</dd>
        </div>
        <div>
          <dt>市值分母来源</dt>
          <dd className="leverage-disclosure-source-list">
            {sourceSegments.map((source) => <span key={source}>{source}</span>)}
          </dd>
        </div>
        <div>
          <dt>审查状态</dt>
          <dd>{marketCapReviewText(manifest)}</dd>
        </div>
        <div>
          <dt>发布包校验</dt>
          <dd>SHA-256 {payloadHash}…</dd>
        </div>
      </dl>

      <div className="leverage-disclosure-notes">
        <p>
          比例仅自 2017-01-03 起采用东方财富Choice厂商口径，未经交易所复核／完整审计；2011–2016 年比例为 N/A。
        </p>
        <p>
          分子可能包含非 A 股融资标的；本指标仅作描述性比例展示，不代表资产类别完全匹配的估值口径。
        </p>
        <p>
          融资余额升降仅反映杠杆使用或去杠杆压力代理，不能据此证明强制平仓、爆仓、市场底或必然反弹。
        </p>
        {!ratioAvailable && (
          <p className="leverage-disclosure-warning">
            比例模式已禁用：{payload.provenance.ratio_unavailable_reason ?? "发布包未给出可用比例。"}
          </p>
        )}
      </div>
    </aside>
  );
}
