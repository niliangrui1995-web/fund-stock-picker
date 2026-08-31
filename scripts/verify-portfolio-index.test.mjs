import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { verifyPortfolioRelease } from "./verify-portfolio-index.mjs";

const REPORT = "2026Q2";
const RELEASE_ID = "2026q2-fixture-release";
const GENERATED_AT = "2026-08-28T14:27:57.812753";
const DETAIL_RULE = "sha256(fundFamilyKey UTF-8) 的前 2 位十六进制字符";
const DETAIL_KEY = createHash("sha256").update("示例基金家族", "utf8").digest("hex").slice(0, 2);

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function fixtures() {
  const profile = {
    fundFamilyKey: "示例基金家族",
    fundCode: "000001",
    fundName: "示例基金A",
    fundDisplayName: "示例基金",
    fundType: "QDII-普通股票",
    fundVariantCodes: ["000001", "000002"],
    isOnExchangeFund: false,
    view: "offExchange",
    detailShardKey: DETAIL_KEY,
  };
  const shard = {
    schemaVersion: "1",
    releaseId: RELEASE_ID,
    report: REPORT,
    cutoffDate: "2026-06-30",
    generatedAt: GENERATED_AT,
    stock: { code: "NVDA", name: "NVIDIA" },
    fundProfiles: { [profile.fundFamilyKey]: profile },
    directEdges: [{
      fundFamilyKey: profile.fundFamilyKey,
      targetCode: "NVDA",
      targetName: "NVIDIA",
      ratioPercent: 4.2,
      isOnExchangeFund: false,
    }],
    indirectEdges: [{
      fundFamilyKey: profile.fundFamilyKey,
      targetCode: "NVDA",
      targetName: "NVIDIA",
      sourceCode: "NVDL",
      sourceName: "NVDL",
      sourceRatioPercent: 3.8,
      leverageMultiple: 2,
      estimatedRatioPercent: 7.6,
      matchReason: "fixture",
      isOnExchangeFund: false,
    }],
    coverage: {
      directIneligibleByReason: {},
      directInputRows: 1,
      directPublishedEdges: 1,
      indirectCandidateRows: 1,
      ineligibleByReason: {},
      ineligibleCandidateRows: 0,
      qualifiedIndirectEdges: 1,
      unmappedNotCountedAsZero: "未映射或不合格的间接产品不按 0% 计入。",
    },
    integrity: { algorithm: "SHA-256", encoding: "UTF-8" },
  };
  const detail = {
    schemaVersion: "1",
    releaseId: RELEASE_ID,
    report: REPORT,
    cutoffDate: "2026-06-30",
    generatedAt: GENERATED_AT,
    fundFamilyKeyHashPrefix: DETAIL_KEY,
    fundDetails: {
      [profile.fundFamilyKey]: {
        fundFamilyKey: profile.fundFamilyKey,
        detailStatus: "available",
        detailFundCode: "000001",
        holdings: [{ rank: 1, stockCode: "NVDA", stockName: "NVIDIA", ratioPercent: 4.2 }],
      },
    },
    integrity: { algorithm: "SHA-256", encoding: "UTF-8" },
  };
  return { profile, shard, detail };
}

async function writeRelease(mutator = () => {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "portfolio-release-"));
  const stockRelativePath = `fund-portfolio-index-2026q2/${RELEASE_ID}/stock-4e564441.json`;
  const detailRelativePath = `fund-portfolio-index-2026q2/${RELEASE_ID}/fund-details/${DETAIL_KEY}.json`;
  const { shard, detail } = fixtures();
  const manifest = {
    schemaVersion: "1",
    releaseId: RELEASE_ID,
    report: REPORT,
    cutoffDate: "2026-06-30",
    generatedAt: GENERATED_AT,
    builderVersion: "fund-portfolio-index-v1",
    fundFamilyRuleVersion: "fund-family-key-v1",
    viewClassificationRuleVersion: "is-on-exchange-fund-v1",
    publishStatus: "complete",
    inputHoldingRows: 1,
    source: "current-quarter-public-stock-detail-rows",
    sourceFile: "holdings_stock_2026q2.csv",
    fundInvestmentSourceFile: "holdings_fund_investment_2026q2.csv",
    fundInvestmentSourceRows: 0,
    disclosure: "仅覆盖当前季度已采集的公开股票持仓明细；未出现不代表未持有。基金详情最多展示 10 条，不能代表基金完整组合或实时仓位。",
    auditPath: "public/seo/indirect-exposure-audit-2026q2.md",
    fundDetailShardRule: DETAIL_RULE,
    fundDetailDisplayLimit: 10,
    coverage: {
      directIneligibleByReason: {}, directInputRows: 1, directPublishedEdges: 1,
      fundDetailAvailableFamilyCount: 1, fundDetailFamilyCount: 1, fundDetailNotCapturedFamilyCount: 0,
      fundDetailShardCount: 1, indirectCandidateRows: 1, ineligibleByReason: {}, qualifiedIndirectEdges: 1,
      stockShardCount: 1, unmappedByReason: {}, unmappedCandidateRows: 0,
      unmappedNotCountedAsZero: "未映射或不合格的间接产品不按 0% 计入。",
    },
    shards: { NVDA: { path: stockRelativePath, sha256: "", directEdgeCount: 1, qualifiedIndirectEdgeCount: 1 } },
    fundDetailShards: { [DETAIL_KEY]: { path: detailRelativePath, sha256: "", fundFamilyCount: 1 } },
  };
  const context = { root, manifest, shard, detail, stockRelativePath, detailRelativePath };
  await mutator(context);
  const stockPath = path.join(root, stockRelativePath);
  const detailPath = path.join(root, detailRelativePath);
  await mkdir(path.dirname(stockPath), { recursive: true });
  await mkdir(path.dirname(detailPath), { recursive: true });
  await writeFile(stockPath, stringify(shard), "utf8");
  await writeFile(detailPath, stringify(detail), "utf8");
  manifest.shards.NVDA.sha256 = digest(await readFile(stockPath));
  manifest.fundDetailShards[DETAIL_KEY].sha256 = digest(await readFile(detailPath));
  await writeFile(path.join(root, "fund-portfolio-index-2026q2.manifest.json"), stringify(manifest), "utf8");
  return context;
}

async function removeRelease(context) {
  await rm(context.root, { recursive: true, force: true });
}

test("接受与 Task 1 契约一致的完整发布包", async () => {
  const context = await writeRelease();
  try {
    const result = await verifyPortfolioRelease({ publicDataDir: context.root, report: REPORT });
    assert.equal(result.ok, true, result.reason);
    assert.deepEqual(result.checkedShards, { stock: 1, fundDetails: 1 });
  } finally {
    await removeRelease(context);
  }
});

test("拒绝已修改但 manifest 哈希未同步的字节", async () => {
  const context = await writeRelease();
  try {
    await writeFile(path.join(context.root, context.stockRelativePath), '{"tampered":true}\n', "utf8");
    const result = await verifyPortfolioRelease({ publicDataDir: context.root, report: REPORT });
    assert.equal(result.ok, false);
    assert.match(result.reason, /SHA-256/);
  } finally {
    await removeRelease(context);
  }
});

test("拒绝同步哈希后仍季度不一致的股票分片", async () => {
  const context = await writeRelease(({ shard }) => { shard.report = "2026Q1"; });
  try {
    const result = await verifyPortfolioRelease({ publicDataDir: context.root, report: REPORT });
    assert.equal(result.ok, false);
    assert.match(result.reason, /发布元数据/);
  } finally {
    await removeRelease(context);
  }
});

test("拒绝重复直接边去重键", async () => {
  const context = await writeRelease(({ shard, manifest }) => {
    shard.directEdges.push({ ...shard.directEdges[0] });
    manifest.shards.NVDA.directEdgeCount = 2;
    shard.coverage.directInputRows = 2;
    shard.coverage.directPublishedEdges = 2;
    manifest.coverage.directInputRows = 2;
    manifest.coverage.directPublishedEdges = 2;
  });
  try {
    const result = await verifyPortfolioRelease({ publicDataDir: context.root, report: REPORT });
    assert.equal(result.ok, false);
    assert.match(result.reason, /重复直接边/);
  } finally {
    await removeRelease(context);
  }
});

test("拒绝零值数值边", async () => {
  const context = await writeRelease(({ shard }) => { shard.indirectEdges[0].estimatedRatioPercent = 0; });
  try {
    const result = await verifyPortfolioRelease({ publicDataDir: context.root, report: REPORT });
    assert.equal(result.ok, false);
    assert.match(result.reason, /无效间接边/);
  } finally {
    await removeRelease(context);
  }
});

test("拒绝同步 SHA 后 coverage 或 reason map 与公开包汇总不一致", async () => {
  const wrongAggregate = await writeRelease(({ shard }) => { shard.coverage.directInputRows = 999999; });
  try {
    const result = await verifyPortfolioRelease({ publicDataDir: wrongAggregate.root, report: REPORT });
    assert.equal(result.ok, false);
    assert.match(result.reason, /directInputRows/);
  } finally {
    await removeRelease(wrongAggregate);
  }

  const directConservationBypass = await writeRelease(({ shard, manifest }) => {
    shard.directEdges.push({ ...shard.directEdges[0] }, { ...shard.directEdges[0] });
    shard.coverage.directInputRows = 3;
    shard.coverage.directPublishedEdges = 3;
    shard.coverage.directIneligibleByReason = { non_positive_direct_ratio: 1 };
    manifest.shards.NVDA.directEdgeCount = 3;
    manifest.coverage.directInputRows = 3;
    manifest.coverage.directPublishedEdges = 3;
    manifest.coverage.directIneligibleByReason = { non_positive_direct_ratio: 1 };
  });
  try {
    const result = await verifyPortfolioRelease({ publicDataDir: directConservationBypass.root, report: REPORT });
    assert.equal(result.ok, false);
    assert.match(result.reason, /coverage 输入、已发布或 reason 合计不一致/);
  } finally {
    await removeRelease(directConservationBypass);
  }

  const invalidReason = await writeRelease(({ shard }) => { shard.coverage.directIneligibleByReason = { fabricated: -7 }; });
  try {
    const result = await verifyPortfolioRelease({ publicDataDir: invalidReason.root, report: REPORT });
    assert.equal(result.ok, false);
    assert.match(result.reason, /reason/);
  } finally {
    await removeRelease(invalidReason);
  }

  const invalidIneligibleReason = await writeRelease(({ shard }) => {
    shard.coverage.ineligibleByReason = { fractional: 1.5 };
    shard.coverage.ineligibleCandidateRows = 1;
  });
  try {
    const result = await verifyPortfolioRelease({ publicDataDir: invalidIneligibleReason.root, report: REPORT });
    assert.equal(result.ok, false);
    assert.match(result.reason, /reason/);
  } finally {
    await removeRelease(invalidIneligibleReason);
  }
});

test("拒绝固定版本、输入计数、全局 reason 与 unmapped 统计篡改", async () => {
  const wrongVersion = await writeRelease(({ manifest }) => {
    manifest.builderVersion = "other";
    manifest.fundFamilyRuleVersion = "other";
    manifest.viewClassificationRuleVersion = "other";
    manifest.inputHoldingRows = 1.5;
  });
  try {
    const result = await verifyPortfolioRelease({ publicDataDir: wrongVersion.root, report: REPORT });
    assert.equal(result.ok, false);
    assert.match(result.reason, /builderVersion/);
  } finally {
    await removeRelease(wrongVersion);
  }

  const fractionalInput = await writeRelease(({ manifest }) => { manifest.inputHoldingRows = 1.5; });
  try {
    const result = await verifyPortfolioRelease({ publicDataDir: fractionalInput.root, report: REPORT });
    assert.equal(result.ok, false);
    assert.match(result.reason, /非负整数/);
  } finally {
    await removeRelease(fractionalInput);
  }

  const invalidGlobalReason = await writeRelease(({ manifest }) => {
    manifest.coverage.unmappedByReason = { ignored_product: 1 };
    manifest.coverage.unmappedCandidateRows = 2;
  });
  try {
    const result = await verifyPortfolioRelease({ publicDataDir: invalidGlobalReason.root, report: REPORT });
    assert.equal(result.ok, false);
    assert.match(result.reason, /未映射/);
  } finally {
    await removeRelease(invalidGlobalReason);
  }
});

test("拒绝同步 SHA 后的间接公式与重复间接边", async () => {
  const formula = await writeRelease(({ shard }) => { shard.indirectEdges[0].estimatedRatioPercent = 7.7; });
  try {
    const result = await verifyPortfolioRelease({ publicDataDir: formula.root, report: REPORT });
    assert.equal(result.ok, false);
    assert.match(result.reason, /估算公式/);
  } finally {
    await removeRelease(formula);
  }

  const duplicate = await writeRelease(({ shard, manifest }) => {
    shard.indirectEdges.push({ ...shard.indirectEdges[0] });
    shard.coverage.indirectCandidateRows = 2;
    shard.coverage.qualifiedIndirectEdges = 2;
    manifest.shards.NVDA.qualifiedIndirectEdgeCount = 2;
    manifest.coverage.indirectCandidateRows = 2;
    manifest.coverage.qualifiedIndirectEdges = 2;
  });
  try {
    const result = await verifyPortfolioRelease({ publicDataDir: duplicate.root, report: REPORT });
    assert.equal(result.ok, false);
    assert.match(result.reason, /重复间接边/);
  } finally {
    await removeRelease(duplicate);
  }
});

test("拒绝缺失的 release 元数据", async () => {
  const context = await writeRelease(({ manifest }) => { delete manifest.builderVersion; });
  try {
    const result = await verifyPortfolioRelease({ publicDataDir: context.root, report: REPORT });
    assert.equal(result.ok, false);
    assert.match(result.reason, /builderVersion/);
  } finally {
    await removeRelease(context);
  }
});

test("拒绝存在于 manifest 但不等于家族 SHA-256 前缀的 detailShardKey", async () => {
  const context = await writeRelease(({ shard, manifest }) => {
    manifest.fundDetailShards.bb = {
      path: `fund-portfolio-index-2026q2/${RELEASE_ID}/fund-details/bb.json`,
      sha256: "a".repeat(64),
      fundFamilyCount: 0,
    };
    shard.fundProfiles["示例基金家族"].detailShardKey = "bb";
  });
  try {
    const result = await verifyPortfolioRelease({ publicDataDir: context.root, report: REPORT });
    assert.equal(result.ok, false);
    assert.match(result.reason, /SHA-256/);
  } finally {
    await removeRelease(context);
  }
});

test("拒绝同步 SHA 后的详情家族、数量和状态内容错配", async () => {
  const wrongFamily = await writeRelease(({ detail }) => {
    detail.fundDetails.伪造家族 = { ...detail.fundDetails.示例基金家族, fundFamilyKey: "伪造家族" };
    delete detail.fundDetails.示例基金家族;
  });
  try {
    const result = await verifyPortfolioRelease({ publicDataDir: wrongFamily.root, report: REPORT });
    assert.equal(result.ok, false);
    assert.match(result.reason, /映射/);
  } finally {
    await removeRelease(wrongFamily);
  }

  const wrongCount = await writeRelease(({ manifest }) => { manifest.fundDetailShards[DETAIL_KEY].fundFamilyCount = 0; });
  try {
    const result = await verifyPortfolioRelease({ publicDataDir: wrongCount.root, report: REPORT });
    assert.equal(result.ok, false);
    assert.match(result.reason, /家族数/);
  } finally {
    await removeRelease(wrongCount);
  }

  const wrongStatus = await writeRelease(({ detail }) => {
    detail.fundDetails.示例基金家族.detailStatus = "not_captured_in_current_stock_detail_rows";
  });
  try {
    const result = await verifyPortfolioRelease({ publicDataDir: wrongStatus.root, report: REPORT });
    assert.equal(result.ok, false);
    assert.match(result.reason, /未采集详情状态/);
  } finally {
    await removeRelease(wrongStatus);
  }
});

test("拒绝路径穿越和不正确的 release 目录", async () => {
  const traversal = await writeRelease(({ manifest }) => { manifest.shards.NVDA.path = "../outside.json"; });
  try {
    const result = await verifyPortfolioRelease({ publicDataDir: traversal.root, report: REPORT });
    assert.equal(result.ok, false);
    assert.match(result.reason, /路径/);
  } finally {
    await removeRelease(traversal);
  }

  const wrongRelease = await writeRelease(({ manifest }) => {
    manifest.fundDetailShards[DETAIL_KEY].path = `fund-portfolio-index-2026q2/${RELEASE_ID}/${DETAIL_KEY}.json`;
  });
  try {
    const result = await verifyPortfolioRelease({ publicDataDir: wrongRelease.root, report: REPORT });
    assert.equal(result.ok, false);
    assert.match(result.reason, /路径/);
  } finally {
    await removeRelease(wrongRelease);
  }
});

test("Cloudflare 单 splat 缓存规则覆盖嵌套 release 与 fund-details 路径", async () => {
  const headers = (await readFile(path.join(process.cwd(), "public", "_headers"), "utf8")).replaceAll("\r\n", "\n");
  const rule = "/data/fund-portfolio-index-:quarter/*";
  assert.ok(headers.includes(`${rule}\n  Cache-Control: public, max-age=604800, stale-while-revalidate=86400`));
  assert.equal((rule.match(/\*/g) ?? []).length, 1, "Cloudflare _headers 规则只能使用一个 splat");
  const matcher = /^\/data\/fund-portfolio-index-[^/]+\/.*$/;
  assert.equal(matcher.test(`/data/fund-portfolio-index-2026q2/${RELEASE_ID}/stock-4e564441.json`), true);
  assert.equal(matcher.test(`/data/fund-portfolio-index-2026q2/${RELEASE_ID}/fund-details/${DETAIL_KEY}.json`), true);
  assert.equal(matcher.test("/data/fund-portfolio-index-2026q2.manifest.json"), false);
  assert.match(headers, /\/data\/fund-portfolio-index-\*\.manifest\.json\r?\n  Cache-Control: no-cache/);
});
