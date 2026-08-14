export type LeverageMetric = "margin" | "ratio";
export type LeverageIndexCode = "000001" | "399106" | "399006";
export type MarketCapSource =
  | "official_exchange_pre2017_raw_chain_audited"
  | "pre2017_official_unavailable"
  // 兼容已发布的旧静态包；新构建器不会再生成这个来源值。
  | "pre2017_official_pending"
  | "eastmoney_post2017_vendor_unverified"
  | null;
export type MarketCapReviewStatus =
  | "official_exchange_pre2017_raw_chain_audited"
  | "unavailable"
  | "eastmoney_vendor_unverified"
  | null;
export type MarketCapRatioReviewStatus =
  | "mixed_pre2017_pending_eastmoney_vendor_unverified"
  | "mixed_official_pre2017_raw_chain_audited_eastmoney_vendor_unverified"
  | "mixed_official_pre2017_unavailable_eastmoney_vendor_unverified";
export type LeverageRatioDataRange =
  | { start: string; end: string }
  | { start: null; end: null }
  | null;

export interface DfcfInputHashes {
  "dfcf_sse_margin.csv": string;
  "dfcf_szse_margin.csv": string;
  "dfcf_margin_balances.csv": string;
}

export interface LeverageRecord {
  date: string;
  sh_margin_yi: number;
  sz_margin_yi: number;
  total_margin_yi: number;
  denominator_market_cap_yi: number | null;
  market_cap_source: MarketCapSource;
  market_cap_review_status: MarketCapReviewStatus;
  ratio_pct: number | null;
  index_000001_close: number | null;
  index_399106_close: number | null;
  index_399006_close: number | null;
}

export interface MarketCapSourceSegment {
  start: string;
  end: string;
  market_cap_source: MarketCapSource;
  market_cap_review_status?: MarketCapReviewStatus;
  ratio_available?: boolean;
  reason?: string | null;
}

export interface OfficialPre2017MarketCapMetadata {
  available: boolean;
  reason: string | null;
  table_sha256: string | null;
  raw_chain_status: "pass" | "blocked";
  financial_evidence_audit: {
    applicable: false;
    status: "N/A";
    reason_code: "UNSUPPORTED_RATIO_CONTRACT";
  };
}

export interface LeverageDashboardPayload {
  schema_version: "1";
  generated_at_beijing: string;
  records: LeverageRecord[];
  provenance: {
    ratio_available: boolean;
    ratio_unavailable_reason: string | null;
    ratio_scope_warning: string;
    ratio_data_range: LeverageRatioDataRange;
    source_switch_date: "2017-01-03";
    official_pre2017_chain_status?: "available" | "unavailable";
    official_pre2017_unavailable_reason?: string | null;
  };
}

export interface LeverageManifest {
  schema_version: "1";
  payload_sha256: string;
  payload_records: number;
  data_range: { start: string; end: string };
  dfcf: {
    dfcf_only: boolean;
    exchange_requests: number;
    sample_status: string;
    inputs: DfcfInputHashes;
  };
  market_cap: {
    reporting_eligible: false;
    ratio_available: boolean;
    ratio_review_status: MarketCapRatioReviewStatus;
    reason: string | null;
    ratio_data_range: LeverageRatioDataRange;
    ratio_missing_records: number;
    source_switch_date: "2017-01-03";
    source_segments: MarketCapSourceSegment[];
    scope_definition: string;
    official_pre2017?: OfficialPre2017MarketCapMetadata;
  };
  indices: Record<
    LeverageIndexCode,
    {
      source: string;
      first_date: string;
      last_date: string;
      sha256: string;
    }
  >;
  description?: string;
}

export type ValidationResult =
  | { ok: true; payload: LeverageDashboardPayload; manifest: LeverageManifest }
  | { ok: false; reason: string };
