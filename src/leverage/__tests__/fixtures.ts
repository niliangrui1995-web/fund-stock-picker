import { createHash } from "node:crypto";
import type { LeverageRecord } from "../types";

export const fixtureRecords: LeverageRecord[] = [
  {
    date: "2011-08-03",
    sh_margin_yi: 100,
    sz_margin_yi: 80,
    total_margin_yi: 180,
    denominator_market_cap_yi: null,
    market_cap_source: "pre2017_official_pending",
    market_cap_review_status: "unavailable",
    ratio_pct: null,
    index_000001_close: 3000,
    index_399106_close: 10000,
    index_399006_close: 2000,
  },
  {
    date: "2016-12-30",
    sh_margin_yi: 100,
    sz_margin_yi: 80,
    total_margin_yi: 180,
    denominator_market_cap_yi: null,
    market_cap_source: "pre2017_official_pending",
    market_cap_review_status: "unavailable",
    ratio_pct: null,
    index_000001_close: 3000,
    index_399106_close: 10000,
    index_399006_close: 2000,
  },
  {
    date: "2017-01-03",
    sh_margin_yi: 101,
    sz_margin_yi: 81,
    total_margin_yi: 182,
    denominator_market_cap_yi: 12000,
    market_cap_source: "eastmoney_post2017_vendor_unverified",
    market_cap_review_status: "eastmoney_vendor_unverified",
    ratio_pct: 1.51666667,
    index_000001_close: 3010,
    index_399106_close: 10100,
    index_399006_close: null,
  },
];

export const fixtureRecordsWithNullRatio = [
  fixtureRecords[0],
  fixtureRecords[1],
  {
    ...fixtureRecords[2],
    denominator_market_cap_yi: null,
    market_cap_source: "eastmoney_post2017_vendor_unverified",
    market_cap_review_status: "unavailable",
    ratio_pct: null,
  },
];

export const officialPre2017FixtureRecords: LeverageRecord[] = [
  {
    ...fixtureRecords[0],
    denominator_market_cap_yi: 10000,
    market_cap_source: "official_exchange_pre2017_raw_chain_audited",
    market_cap_review_status: "official_exchange_pre2017_raw_chain_audited",
    ratio_pct: 1.8,
  },
  {
    ...fixtureRecords[1],
    denominator_market_cap_yi: 10000,
    market_cap_source: "official_exchange_pre2017_raw_chain_audited",
    market_cap_review_status: "official_exchange_pre2017_raw_chain_audited",
    ratio_pct: 1.8,
  },
  fixtureRecords[2],
];

// 新厂商前段仍由现有生产类型限制；测试夹具故意保留原始 JSON 值，
// 以验证校验器先拒绝、再在实现后接受该发布契约。
export const mxPre2017FixtureRecords = officialPre2017FixtureRecords.map((record) =>
  record.date < "2017-01-03"
    ? {
        ...record,
        market_cap_source: "mx_pre2017_vendor_unverified",
        market_cap_review_status: "mx_vendor_unverified",
      }
    : record,
) as unknown as LeverageRecord[];

export const fixtureRecordsWithout399006 = fixtureRecords.map((record) => ({
  ...record,
  index_399006_close: null,
}));

export const fixtureRecordsWithDelayed399006 = fixtureRecords.map((record) => ({
  ...record,
  index_399006_close: record.date === "2017-01-03" ? 2010 : null,
}));

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function makeDfcfInputHashes() {
  return {
    "dfcf_sse_margin.csv": "a".repeat(64),
    "dfcf_szse_margin.csv": "b".repeat(64),
    "dfcf_margin_balances.csv": "c".repeat(64),
  };
}

export function makeValidPayloadText(records = fixtureRecords): string {
  return JSON.stringify({
    schema_version: "1",
    generated_at_beijing: "2026-08-13T09:00:00+08:00",
    records,
    provenance: {
      ratio_available: true,
      ratio_unavailable_reason: null,
      ratio_scope_warning:
        "东方财富 Choice 厂商口径／未经交易所复核、未经完整审计；分子可能含非 A 股融资标的。",
      ratio_data_range: { start: "2017-01-03", end: "2017-01-03" },
      source_switch_date: "2017-01-03",
    },
  });
}

export function makeValidManifestText(
  payloadText = makeValidPayloadText(),
): string {
  const payload = JSON.parse(payloadText) as { records: LeverageRecord[] };
  const records = payload.records;

  return JSON.stringify({
    schema_version: "1",
    payload_sha256: sha256(payloadText),
    payload_records: records.length,
    data_range: {
      start: records[0]?.date ?? "",
      end: records[records.length - 1]?.date ?? "",
    },
    dfcf: {
      dfcf_only: true,
      exchange_requests: 0,
      sample_status: "dfcf_vendor_only_unverified_by_exchange",
      inputs: makeDfcfInputHashes(),
    },
    market_cap: {
      reporting_eligible: false,
      ratio_available: true,
      ratio_review_status: "mixed_pre2017_pending_eastmoney_vendor_unverified",
      reason: "2017-01-03 起的比例为东方财富 Choice 厂商未审计描述性比例。",
      ratio_data_range: { start: "2017-01-03", end: "2017-01-03" },
      ratio_missing_records: records.filter((record) => record.ratio_pct === null).length,
      source_switch_date: "2017-01-03",
      source_segments: [
        {
          market_cap_source: "pre2017_official_pending",
          market_cap_review_status: "unavailable",
          ratio_available: false,
          start: "2011-08-03",
          end: "2016-12-30",
        },
        {
          market_cap_source: "eastmoney_post2017_vendor_unverified",
          market_cap_review_status: "eastmoney_vendor_unverified",
          ratio_available: true,
          start: "2017-01-03",
          end: "2017-01-03",
        },
      ],
      scope_definition:
        "分子为 DFCF 厂商口径融资余额，分母为东方财富 Choice 厂商未审计市值。",
    },
    indices: makeIndexManifest(),
  });
}

export function makeOfficialPre2017PayloadText(
  records = officialPre2017FixtureRecords,
): string {
  return JSON.stringify({
    schema_version: "1",
    generated_at_beijing: "2026-08-14T11:40:51+08:00",
    records,
    provenance: {
      ratio_available: true,
      ratio_unavailable_reason: null,
      ratio_scope_warning:
        "2011-08-03 至 2016-12-30 分母已通过交易所原始链准出；但分子为 DFCF 厂商两融余额，financial-evidence-audit 对该聚合比值为 UNSUPPORTED_RATIO_CONTRACT，不能称为正式财务比例或严格证券类别匹配。",
      ratio_data_range: { start: "2011-08-03", end: "2017-01-03" },
      source_switch_date: "2017-01-03",
      official_pre2017_chain_status: "available",
      official_pre2017_unavailable_reason: null,
    },
  });
}

export function makeOfficialPre2017ManifestText(
  payloadText = makeOfficialPre2017PayloadText(),
): string {
  const manifest = JSON.parse(makeValidManifestText(payloadText));
  manifest.market_cap.ratio_review_status =
    "mixed_official_pre2017_raw_chain_audited_eastmoney_vendor_unverified";
  manifest.market_cap.reason =
    "前段分母使用交易所原始链；后段分母仅为东方财富 Choice 厂商口径，未经交易所复核或完整审计。全段聚合比例不是正式 financial-evidence-audit 准出指标。";
  manifest.market_cap.ratio_data_range = { start: "2011-08-03", end: "2017-01-03" };
  manifest.market_cap.ratio_missing_records = 0;
  manifest.market_cap.source_segments = [
    {
      market_cap_source: "official_exchange_pre2017_raw_chain_audited",
      market_cap_review_status: "official_exchange_pre2017_raw_chain_audited",
      ratio_available: true,
      start: "2011-08-03",
      end: "2016-12-30",
      reason: "分母原始链通过交易所哈希、日期和 Decimal 校验。",
    },
    {
      market_cap_source: "eastmoney_post2017_vendor_unverified",
      market_cap_review_status: "eastmoney_vendor_unverified",
      ratio_available: true,
      start: "2017-01-03",
      end: "2017-01-03",
      reason: null,
    },
  ];
  manifest.market_cap.scope_definition =
    "分子为 DFCF 两市融资余额厂商口径，可能含非 A 股融资标的；2011-08-03 至 2016-12-30 的分母仅在官方原始链、DFCF 日期绑定和独立审计均通过时启用；2017-01-03 起分母为东方财富 Choice RPT_VALUEMARKET / TRADE_MARKET_CODE=000300，未经交易所复核和完整审计。全段均不能称为严格证券类别匹配或正式财务比例。";
  manifest.market_cap.official_pre2017 = {
    available: true,
    reason: null,
    table_sha256: "d".repeat(64),
    raw_chain_status: "pass",
    financial_evidence_audit: {
      applicable: false,
      status: "N/A",
      reason_code: "UNSUPPORTED_RATIO_CONTRACT",
    },
  };
  manifest.description =
    "DFCF 两融余额与三指数静态数据包；两融余额下降仅为去杠杆压力代理，不证明强平、底部或反弹。";
  return JSON.stringify(manifest);
}

export function makeMxPre2017PayloadText(
  records = mxPre2017FixtureRecords,
): string {
  return JSON.stringify({
    schema_version: "1",
    generated_at_beijing: "2026-08-23T22:00:00+08:00",
    records,
    provenance: {
      ratio_available: true,
      ratio_unavailable_reason: null,
      ratio_scope_warning:
        "2011-08-03 至 2016-12-30 分母为东方财富妙想厂商数据，2017-01-03 起分母为东方财富 Choice 厂商数据；二者均未经交易所复核、未经完整审计，分子可能含非 A 股融资标的，不能称为正式财务比例或严格证券类别匹配。",
      ratio_data_range: { start: "2011-08-03", end: "2017-01-03" },
      source_switch_date: "2017-01-03",
      mx_pre2017_chain_status: "available",
      mx_pre2017_unavailable_reason: null,
    },
  });
}

export function makeMxPre2017ManifestText(
  payloadText = makeMxPre2017PayloadText(),
): string {
  const manifest = JSON.parse(makeValidManifestText(payloadText));
  manifest.market_cap.ratio_review_status =
    "mixed_mx_pre2017_vendor_unverified_eastmoney_vendor_unverified";
  manifest.market_cap.reason =
    "2011–2016 分母为东方财富妙想厂商数据；2017 年起分母为东方财富 Choice 厂商数据。全段均未经交易所复核和完整审计。";
  manifest.market_cap.ratio_data_range = { start: "2011-08-03", end: "2017-01-03" };
  manifest.market_cap.ratio_missing_records = 0;
  manifest.market_cap.source_segments = [
    {
      market_cap_source: "mx_pre2017_vendor_unverified",
      market_cap_review_status: "mx_vendor_unverified",
      ratio_available: true,
      start: "2011-08-03",
      end: "2016-12-30",
      reason: "东方财富妙想厂商数据，未经交易所复核或完整审计。",
    },
    {
      market_cap_source: "eastmoney_post2017_vendor_unverified",
      market_cap_review_status: "eastmoney_vendor_unverified",
      ratio_available: true,
      start: "2017-01-03",
      end: "2017-01-03",
      reason: "东方财富 Choice 厂商数据，未经交易所复核或完整审计。",
    },
  ];
  manifest.market_cap.scope_definition =
    "分子为 DFCF 两市融资余额厂商口径，可能含非 A 股融资标的；2011-08-03 至 2016-12-30 分母为东方财富妙想厂商数据，2017-01-03 起分母为东方财富 Choice 厂商数据。两段均未经交易所复核和完整审计，全段均不能称为严格证券类别匹配或正式财务比例。";
  manifest.market_cap.mx_pre2017 = {
    available: true,
    reason: null,
    table_sha256: "e".repeat(64),
    raw_response_sha256: "f".repeat(64),
    date_contract_status: "pass",
    financial_evidence_audit: {
      applicable: false,
      status: "N/A",
      reason_code: "UNSUPPORTED_RATIO_CONTRACT",
    },
  };
  return JSON.stringify(manifest);
}

export function makeMxPre2017UnavailablePayloadText(): string {
  const payload = JSON.parse(makeMxPre2017PayloadText());
  for (const record of payload.records) {
    if (record.date < "2017-01-03") {
      record.denominator_market_cap_yi = null;
      record.market_cap_source = "pre2017_mx_vendor_unavailable";
      record.market_cap_review_status = "unavailable";
      record.ratio_pct = null;
    }
  }
  payload.provenance.ratio_data_range = { start: "2017-01-03", end: "2017-01-03" };
  payload.provenance.mx_pre2017_chain_status = "unavailable";
  payload.provenance.mx_pre2017_unavailable_reason = "东方财富妙想前段市值链当前不可用。";
  return JSON.stringify(payload);
}

export function makeMxPre2017UnavailableManifestText(
  payloadText = makeMxPre2017UnavailablePayloadText(),
): string {
  const manifest = JSON.parse(makeMxPre2017ManifestText(payloadText));
  manifest.market_cap.ratio_review_status =
    "mixed_mx_pre2017_unavailable_eastmoney_vendor_unverified";
  manifest.market_cap.reason = "东方财富妙想前段市值链当前不可用；2017 年起仍使用东方财富 Choice 厂商数据。";
  manifest.market_cap.ratio_data_range = { start: "2017-01-03", end: "2017-01-03" };
  manifest.market_cap.ratio_missing_records = 2;
  manifest.market_cap.source_segments[0] = {
    market_cap_source: "pre2017_mx_vendor_unavailable",
    market_cap_review_status: "unavailable",
    ratio_available: false,
    start: "2011-08-03",
    end: "2016-12-30",
    reason: "东方财富妙想前段市值链当前不可用。",
  };
  manifest.market_cap.mx_pre2017 = {
    available: false,
    reason: "东方财富妙想前段市值链当前不可用。",
    table_sha256: null,
    raw_response_sha256: null,
    date_contract_status: "blocked",
    financial_evidence_audit: {
      applicable: false,
      status: "N/A",
      reason_code: "UNSUPPORTED_RATIO_CONTRACT",
    },
  };
  return JSON.stringify(manifest);
}

export function makeOfficialPre2017UnavailablePayloadText(): string {
  const payload = JSON.parse(makeOfficialPre2017PayloadText());
  for (const record of payload.records) {
    record.denominator_market_cap_yi = null;
    record.ratio_pct = null;
    if (record.date < "2017-01-03") {
      record.market_cap_source = "pre2017_official_unavailable";
    }
    record.market_cap_review_status = "unavailable";
  }
  payload.provenance.ratio_available = false;
  payload.provenance.ratio_unavailable_reason = "官方前段市值链当前不可用，比例模式已禁用。";
  payload.provenance.ratio_scope_warning =
    "DFCF 分子与东方财富 Choice 厂商市值口径；未经交易所复核、未经完整审计；分子可能含非 A 股融资标的。";
  payload.provenance.ratio_data_range = { start: null, end: null };
  payload.provenance.official_pre2017_chain_status = "unavailable";
  payload.provenance.official_pre2017_unavailable_reason =
    "官方前段市值链当前不可用。";
  return JSON.stringify(payload);
}

export function makeOfficialPre2017UnavailableManifestText(
  payloadText = makeOfficialPre2017UnavailablePayloadText(),
): string {
  const payload = JSON.parse(payloadText);
  const manifest = JSON.parse(makeOfficialPre2017ManifestText(payloadText));
  manifest.market_cap.ratio_available = false;
  manifest.market_cap.ratio_review_status =
    "mixed_official_pre2017_unavailable_eastmoney_vendor_unverified";
  manifest.market_cap.reason = "官方前段市值链当前不可用，比例模式已禁用。";
  manifest.market_cap.ratio_data_range = { start: null, end: null };
  manifest.market_cap.ratio_missing_records = payload.records.length;
  manifest.market_cap.source_segments = [
    {
      market_cap_source: "pre2017_official_unavailable",
      market_cap_review_status: "unavailable",
      ratio_available: false,
      start: "2011-08-03",
      end: "2016-12-30",
      reason: "官方前段市值链当前不可用。",
    },
    {
      market_cap_source: "eastmoney_post2017_vendor_unverified",
      market_cap_review_status: "unavailable",
      ratio_available: false,
      start: "2017-01-03",
      end: "2017-01-03",
      reason: "官方前段市值链当前不可用，比例模式已禁用。",
    },
  ];
  manifest.market_cap.official_pre2017 = {
    available: false,
    reason: "官方前段市值链当前不可用。",
    table_sha256: null,
    raw_chain_status: "blocked",
    financial_evidence_audit: {
      applicable: false,
      status: "N/A",
      reason_code: "UNSUPPORTED_RATIO_CONTRACT",
    },
  };
  return JSON.stringify(manifest);
}

export function makeIndexManifest() {
  const entry = {
    source: "本地 TDX 厂商日线（用于三指数收盘价；未做交易所或指数编制方原始链复核）",
    first_date: "2011-08-03",
    last_date: "2017-01-03",
    sha256: "b".repeat(64),
    sha256_covers_through: "2017-01-03",
    source_snapshot_hash_status: "recorded" as const,
  };
  return {
    "000001": { ...entry, path: "fixture/000001.day" },
    "399106": { ...entry, path: "fixture/399106.day" },
    "399006": { ...entry, path: "fixture/399006.day" },
  };
}

export function makeManifestWithPayloadHash(
  payloadHash: string,
  payloadText = makeValidPayloadText(),
): string {
  const manifest = JSON.parse(makeValidManifestText(payloadText));
  manifest.payload_sha256 = payloadHash;
  return JSON.stringify(manifest);
}

export function makeManifestWithDfcfFlags(
  dfcfOnly: boolean,
  exchangeRequests: number,
  payloadText = makeValidPayloadText(),
): string {
  const manifest = JSON.parse(makeValidManifestText(payloadText));
  manifest.dfcf.dfcf_only = dfcfOnly;
  manifest.dfcf.exchange_requests = exchangeRequests;
  return JSON.stringify(manifest);
}

export function makePayloadWithRatio(): string {
  return JSON.stringify({
    schema_version: "1",
    generated_at_beijing: "2026-08-13T09:00:00+08:00",
    records: fixtureRecordsWithNullRatio,
    provenance: {
      ratio_available: false,
      ratio_unavailable_reason: "当前没有可用的厂商市值比例数据。",
      ratio_scope_warning:
        "东方财富 Choice 厂商口径／未经交易所复核、未经完整审计；分子可能含非 A 股融资标的。",
      ratio_data_range: { start: null, end: null },
      source_switch_date: "2017-01-03",
    },
  });
}

export function makeManifestWithRatioUnavailable(
  payloadText = makePayloadWithRatio(),
): string {
  const manifest = JSON.parse(makeValidManifestText(payloadText));
  manifest.market_cap.reporting_eligible = false;
  manifest.market_cap.ratio_available = false;
  manifest.market_cap.ratio_review_status =
    "mixed_pre2017_pending_eastmoney_vendor_unverified";
  manifest.market_cap.reason = "当前没有可用的厂商市值比例数据。";
  manifest.market_cap.ratio_data_range = { start: null, end: null };
  manifest.market_cap.ratio_missing_records = fixtureRecordsWithNullRatio.length;
  manifest.market_cap.source_segments[1].market_cap_review_status = "unavailable";
  manifest.market_cap.source_segments[1].ratio_available = false;
  return JSON.stringify(manifest);
}
