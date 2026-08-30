export type DenominatorSource = "sh880008";
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

export interface AiChainRecord {
  date: string;
  ai_chain_amount_pct: number | null;
  ai_chain_amount_yi: number | null;
  ai_chain_active_stock_count: number;
}

export interface AiChainSeries {
  name: "AI产业链成交额占比";
  field: "ai_chain_amount_pct";
  start_date: "2025-01-01";
  records: AiChainRecord[];
  definition: string;
  active_stock_rule: string;
  universe: {
    workbook: string;
    sheet: string;
    code_column: string;
    code_count: number;
    codes_sha256: string;
  };
}

export interface ConcentrationDashboardPayload {
  schema_version: "1";
  generated_at_beijing: string;
  records: ConcentrationRecord[];
  ai_chain_series?: AiChainSeries;
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

export interface AiChainManifestSeries {
  name: "AI产业链成交额占比";
  field: "ai_chain_amount_pct";
  start_date: "2025-01-01";
  data_range: { start: string | null; end: string | null };
  records: number;
  missing_output_records: number;
  formula: string;
  active_stock_rule: string;
  universe: {
    workbook_path: string;
    workbook_sha256: string;
    sheet: string;
    code_column: string;
    input_code_count: number;
    resolved_code_count: number;
    resolved_code_sha256: string;
    non_stock_code_rows_excluded: number;
    code_aliases: Array<{
      source_code: string;
      resolved_code: string;
      source: string;
    }>;
    tdx_candidate_file_count: number;
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
  ai_chain_series?: AiChainManifestSeries;
}

export type ConcentrationValidationResult =
  | { ok: true; payload: ConcentrationDashboardPayload; manifest: ConcentrationManifest }
  | { ok: false; reason: string };
