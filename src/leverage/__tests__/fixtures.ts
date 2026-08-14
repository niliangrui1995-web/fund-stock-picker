import { createHash } from "node:crypto";
import type { LeverageRecord } from "../types";

export const fixtureRecords: LeverageRecord[] = [
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
  {
    ...fixtureRecords[1],
    denominator_market_cap_yi: null,
    market_cap_source: "eastmoney_post2017_vendor_unverified",
    market_cap_review_status: "unavailable",
    ratio_pct: null,
  },
];

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
  const payload = JSON.parse(payloadText) as {
    records: Array<{ date: string }>;
  };
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
      ratio_missing_records: 1,
      source_switch_date: "2017-01-03",
      source_segments: [
        {
          market_cap_source: "pre2017_official_pending",
          start: "2011-08-03",
          end: "2016-12-30",
        },
        {
          market_cap_source: "eastmoney_post2017_vendor_unverified",
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

export function makeIndexManifest() {
  const entry = {
    source: "TDX 本地当前数据",
    first_date: "2016-12-30",
    last_date: "2017-01-03",
    sha256: "b".repeat(64),
  };
  return { "000001": entry, "399106": entry, "399006": entry };
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
  return JSON.stringify(manifest);
}
