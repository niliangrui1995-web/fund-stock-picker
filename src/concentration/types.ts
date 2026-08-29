export type DenominatorSource = "sh000002_plus_sz399107" | "sh880005";
export type NumeratorScope = "sh_sz_active_a" | "sh_sz_bj_active_a";

export interface ConcentrationRecord {
  date: string;
  chinext_close: number | null;
  c5_pct: number;
  top5_amount_yi: number;
  market_amount_yi: number;
  active_stock_count: number;
  top5_stock_count: number;
  denominator_source: DenominatorSource;
  numerator_scope: NumeratorScope;
}

export interface ConcentrationDashboardPayload {
  schema_version: "1";
  generated_at_beijing: string;
  records: ConcentrationRecord[];
  provenance: {
    evidence_level: "market_data_vendor";
    source: string;
    metric_name: string;
    definition: string;
    active_stock_rule: string;
    comparison_index: {
      code: "399006";
      name: "创业板指";
      field: "chinext_close";
      value: "收盘价";
    };
    raw_data_copied: false;
    scope_warning: string;
  };
}

export interface ConcentrationManifest {
  schema_version: "1";
  generated_at_beijing: string;
  payload_sha256: string;
  csv_sha256: string;
  payload_records: number;
  data_range: { start: string; end: string };
  evidence_level: "market_data_vendor";
  source: string;
  raw_data_copied: false;
  scope_warning: string;
  comparison_index_input: {
    code: "399006";
    name: "创业板指";
    field: "chinext_close";
    value: "收盘价";
    price_scale: "close / 100";
    source: "通达信本地盘后 .day 日线";
    path: string;
    bytes: number;
    sha256: string;
    last_write_time_utc: string;
    data_range: { start: string; end: string };
    missing_output_records: number;
  };
  denominator_segments: Array<{
    start: string;
    end: string | null;
    source: DenominatorSource;
    formula: string;
  }>;
  numerator_segments: Array<{
    start: string;
    end: string | null;
    scope: NumeratorScope;
  }>;
  omitted_dates: Array<{ date: string; reason: string }>;
}

export type ConcentrationValidationResult =
  | { ok: true; payload: ConcentrationDashboardPayload; manifest: ConcentrationManifest }
  | { ok: false; reason: string };
