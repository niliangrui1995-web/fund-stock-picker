import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { verifyLeverageDashboard } from "./verify-leverage-dashboard.mjs";

const payloadPath = new URL("../public/data/leverage-dashboard.json", import.meta.url);
const manifestPath = new URL("../public/data/leverage-dashboard.manifest.json", import.meta.url);

async function readPublishedPackage() {
  const [payloadText, manifestText] = await Promise.all([
    readFile(payloadPath, "utf8"),
    readFile(manifestPath, "utf8"),
  ]);
  return {
    payload: JSON.parse(payloadText),
    manifest: JSON.parse(manifestText),
  };
}

function serializePackage(payload, manifest) {
  const payloadText = JSON.stringify(payload);
  manifest.payload_sha256 = createHash("sha256").update(payloadText, "utf8").digest("hex");
  return { payloadText, manifestText: JSON.stringify(manifest) };
}

function clonePackage(value) {
  return JSON.parse(JSON.stringify(value));
}

function addPost2017Gap(payload) {
  const gap = payload.records.find((record) => record.date > "2017-01-03");
  assert.ok(gap, "测试包缺少 2017-01-03 后记录。");
  gap.denominator_market_cap_yi = null;
  gap.market_cap_source = "eastmoney_post2017_vendor_unverified";
  gap.market_cap_review_status = "unavailable";
  gap.ratio_pct = null;
  return gap;
}

function promotePre2017ToOfficialRawChain(payload, manifest) {
  const pre2017Records = payload.records.filter((record) => record.date < "2017-01-03");
  assert.ok(pre2017Records.length > 0, "测试包缺少 2017-01-03 前记录。");
  for (const record of pre2017Records) {
    record.denominator_market_cap_yi = 1000000;
    record.market_cap_source = "official_exchange_pre2017_raw_chain_audited";
    record.market_cap_review_status = "official_exchange_pre2017_raw_chain_audited";
    record.ratio_pct = (record.total_margin_yi / record.denominator_market_cap_yi) * 100;
  }

  const ratioRecords = payload.records.filter((record) => record.ratio_pct !== null);
  const post2017Records = payload.records.filter((record) => record.date >= "2017-01-03");
  payload.provenance.ratio_available = true;
  payload.provenance.ratio_unavailable_reason = null;
  payload.provenance.ratio_data_range = {
    start: ratioRecords[0]?.date,
    end: ratioRecords[ratioRecords.length - 1]?.date,
  };
  payload.provenance.ratio_scope_warning =
    "2011-08-03 至 2016-12-30 分母已通过交易所原始链准出；但分子为 DFCF 厂商两融余额，financial-evidence-audit 对该聚合比值为 UNSUPPORTED_RATIO_CONTRACT，不能称为正式财务比例或严格证券类别匹配。";
  payload.provenance.official_pre2017_chain_status = "available";
  payload.provenance.official_pre2017_unavailable_reason = null;

  manifest.market_cap.ratio_available = true;
  manifest.market_cap.ratio_data_range = payload.provenance.ratio_data_range;
  manifest.market_cap.ratio_missing_records =
    payload.records.length - ratioRecords.length;
  manifest.market_cap.ratio_review_status =
    "mixed_official_pre2017_raw_chain_audited_eastmoney_vendor_unverified";
  manifest.market_cap.reason =
    "前段分母使用交易所原始链；后段分母仅为东方财富 Choice 厂商口径，未经交易所复核或完整审计。全段聚合比例不是正式 financial-evidence-audit 准出指标。";
  manifest.market_cap.scope_definition =
    "分子为 DFCF 两市融资余额厂商口径，可能含非 A 股融资标的；2011-08-03 至 2016-12-30 的分母仅在官方原始链、DFCF 日期绑定和独立审计均通过时启用；2017-01-03 起分母为东方财富 Choice RPT_VALUEMARKET / TRADE_MARKET_CODE=000300，未经交易所复核和完整审计。全段均不能称为严格证券类别匹配或正式财务比例。";
  manifest.market_cap.source_segments = [
    {
      start: pre2017Records[0]?.date,
      end: pre2017Records[pre2017Records.length - 1]?.date,
      market_cap_source: "official_exchange_pre2017_raw_chain_audited",
      market_cap_review_status: "official_exchange_pre2017_raw_chain_audited",
      ratio_available: true,
      reason: "分母原始链通过交易所哈希、日期和 Decimal 校验。",
    },
    {
      start: "2017-01-03",
      end: post2017Records[post2017Records.length - 1]?.date,
      market_cap_source: "eastmoney_post2017_vendor_unverified",
      market_cap_review_status: "eastmoney_vendor_unverified",
      ratio_available: true,
      reason: null,
    },
  ];
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
}

function demoteOfficialPre2017ToUnavailable(payload, manifest) {
  for (const record of payload.records) {
    record.denominator_market_cap_yi = null;
    record.ratio_pct = null;
    record.market_cap_review_status = "unavailable";
    if (record.date < "2017-01-03") {
      record.market_cap_source = "pre2017_official_unavailable";
    }
  }

  payload.provenance.ratio_available = false;
  payload.provenance.ratio_unavailable_reason = "官方前段市值链当前不可用，比例模式已禁用。";
  payload.provenance.ratio_scope_warning =
    "DFCF 分子与东方财富 Choice 厂商市值口径；未经交易所复核、未经完整审计；分子可能含非 A 股融资标的。";
  payload.provenance.ratio_data_range = { start: null, end: null };
  payload.provenance.official_pre2017_chain_status = "unavailable";
  payload.provenance.official_pre2017_unavailable_reason = "官方前段市值链当前不可用。";

  manifest.market_cap.ratio_available = false;
  manifest.market_cap.ratio_review_status =
    "mixed_official_pre2017_unavailable_eastmoney_vendor_unverified";
  manifest.market_cap.reason = "官方前段市值链当前不可用，比例模式已禁用。";
  manifest.market_cap.ratio_data_range = { start: null, end: null };
  manifest.market_cap.ratio_missing_records = payload.records.length;
  manifest.market_cap.source_segments = [
    {
      start: payload.records[0]?.date,
      end: "2016-12-30",
      market_cap_source: "pre2017_official_unavailable",
      market_cap_review_status: "unavailable",
      ratio_available: false,
      reason: "官方前段市值链当前不可用。",
    },
    {
      start: "2017-01-03",
      end: payload.records[payload.records.length - 1]?.date,
      market_cap_source: "eastmoney_post2017_vendor_unverified",
      market_cap_review_status: "unavailable",
      ratio_available: false,
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
}

test("允许 2017-01-03 后单日精确同日市值缺口", async () => {
  const published = await readPublishedPackage();
  const payload = clonePackage(published.payload);
  const manifest = clonePackage(published.manifest);
  addPost2017Gap(payload);
  manifest.market_cap.ratio_missing_records += 1;
  const expectedRatioRecords = payload.records.filter((record) => record.ratio_pct !== null);
  const serialized = serializePackage(payload, manifest);

  const summary = verifyLeverageDashboard(serialized.payloadText, serialized.manifestText);

  assert.equal(summary.ratioAvailable, true);
  assert.equal(summary.ratioMissingRecords, published.manifest.market_cap.ratio_missing_records + 1);
  assert.equal(summary.firstRatioDate, expectedRatioRecords[0]?.date ?? null);
  assert.equal(
    summary.lastRatioDate,
    expectedRatioRecords[expectedRatioRecords.length - 1]?.date ?? null,
  );
});

test("允许 2011–2016 官方原始链已审计分母，并将比例范围前移至首个同日记录", async () => {
  const published = await readPublishedPackage();
  const payload = clonePackage(published.payload);
  const manifest = clonePackage(published.manifest);
  promotePre2017ToOfficialRawChain(payload, manifest);
  const expectedRatioRecords = payload.records.filter((record) => record.ratio_pct !== null);
  const serialized = serializePackage(payload, manifest);

  const summary = verifyLeverageDashboard(serialized.payloadText, serialized.manifestText);

  assert.equal(summary.firstRatioDate, payload.records[0]?.date ?? null);
  assert.equal(summary.ratioMissingRecords, payload.records.length - expectedRatioRecords.length);
});

test("拒绝前段官方原始链审计状态伪造", async () => {
  const published = await readPublishedPackage();
  const payload = clonePackage(published.payload);
  const manifest = clonePackage(published.manifest);
  promotePre2017ToOfficialRawChain(payload, manifest);
  manifest.market_cap.official_pre2017.raw_chain_status = "blocked";
  const serialized = serializePackage(payload, manifest);

  assert.throws(
    () => verifyLeverageDashboard(serialized.payloadText, serialized.manifestText),
    /官方前段原始链审计元数据无效/,
  );
});

test("拒绝官方前段混入不可用来源", async () => {
  const published = await readPublishedPackage();
  const payload = clonePackage(published.payload);
  const manifest = clonePackage(published.manifest);
  promotePre2017ToOfficialRawChain(payload, manifest);
  const changed = payload.records.find((record) => record.date === "2016-12-30");
  assert.ok(changed, "测试包缺少 2016-12-30 前段记录。");
  changed.denominator_market_cap_yi = null;
  changed.market_cap_source = "pre2017_official_unavailable";
  changed.market_cap_review_status = "unavailable";
  changed.ratio_pct = null;
  const serialized = serializePackage(payload, manifest);

  assert.throws(
    () => verifyLeverageDashboard(serialized.payloadText, serialized.manifestText),
    /2017-01-03 前市值来源分段不得混用/,
  );
});

test("接受官方前段不可用的临时 QA 包并要求专用审查状态", async () => {
  const published = await readPublishedPackage();
  const payload = clonePackage(published.payload);
  const manifest = clonePackage(published.manifest);
  promotePre2017ToOfficialRawChain(payload, manifest);
  demoteOfficialPre2017ToUnavailable(payload, manifest);
  const serialized = serializePackage(payload, manifest);

  const summary = verifyLeverageDashboard(serialized.payloadText, serialized.manifestText);

  assert.equal(summary.ratioAvailable, false);
  assert.equal(summary.ratioMissingRecords, payload.records.length);
});

test("拒绝官方前段不可用却删除专用元数据的伪装包", async () => {
  const published = await readPublishedPackage();
  const payload = clonePackage(published.payload);
  const manifest = clonePackage(published.manifest);
  promotePre2017ToOfficialRawChain(payload, manifest);
  demoteOfficialPre2017ToUnavailable(payload, manifest);
  delete payload.provenance.official_pre2017_chain_status;
  delete payload.provenance.official_pre2017_unavailable_reason;
  delete manifest.market_cap.official_pre2017;
  manifest.market_cap.ratio_review_status =
    "mixed_pre2017_pending_eastmoney_vendor_unverified";
  const serialized = serializePackage(payload, manifest);

  assert.throws(
    () => verifyLeverageDashboard(serialized.payloadText, serialized.manifestText),
    /官方前段市值元数据无效/,
  );
});

test("拒绝 2017 年后缺口伪装成非东方财富来源", async () => {
  const published = await readPublishedPackage();
  const payload = clonePackage(published.payload);
  const manifest = clonePackage(published.manifest);
  const gap = addPost2017Gap(payload);
  gap.market_cap_source = "pre2017_official_pending";
  manifest.market_cap.ratio_missing_records += 1;
  const serialized = serializePackage(payload, manifest);

  assert.throws(
    () => verifyLeverageDashboard(serialized.payloadText, serialized.manifestText),
    /市值来源必须为东方财富厂商分段/,
  );
});

test("拒绝比例缺失记录数与实际 N/A 不一致", async () => {
  const published = await readPublishedPackage();
  const payload = clonePackage(published.payload);
  const manifest = clonePackage(published.manifest);
  addPost2017Gap(payload);
  const serialized = serializePackage(payload, manifest);

  assert.throws(
    () => verifyLeverageDashboard(serialized.payloadText, serialized.manifestText),
    /比例缺失记录数与实际 N\/A 记录不一致/,
  );
});
