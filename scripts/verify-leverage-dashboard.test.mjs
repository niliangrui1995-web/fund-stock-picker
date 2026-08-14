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

test("允许 2017-01-03 后单日精确同日市值缺口", async () => {
  const published = await readPublishedPackage();
  const payload = clonePackage(published.payload);
  const manifest = clonePackage(published.manifest);
  addPost2017Gap(payload);
  manifest.market_cap.ratio_missing_records += 1;
  const serialized = serializePackage(payload, manifest);

  const summary = verifyLeverageDashboard(serialized.payloadText, serialized.manifestText);

  assert.equal(summary.ratioAvailable, true);
  assert.equal(summary.ratioMissingRecords, published.manifest.market_cap.ratio_missing_records + 1);
  assert.equal(summary.firstRatioDate, "2017-01-03");
  assert.equal(summary.lastRatioDate, published.payload.records[published.payload.records.length - 1].date);
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
