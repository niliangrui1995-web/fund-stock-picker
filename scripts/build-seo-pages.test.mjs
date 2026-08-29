import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { publishTextFiles, validateQuarterPayload } from "./build_seo_pages.mjs";
import { buildQuarterConfig } from "./quarter-config.mjs";

const quarterConfig = buildQuarterConfig({ year: 2026, quarter: 2 });

function validPayload() {
  return {
    meta: {
      report: "2026Q2",
      cutoffDate: "2026-06-30",
      generatedAt: "2026-08-28T14:27:57",
      sourceFile: "holdings_stock_2026q2.csv",
      sourceRows: 1,
      fundInvestmentSourceRows: 0,
      stockCount: 1,
      totalStockCount: 1,
      purchaseLimitCount: 1,
      purchaseLimitFetchedAt: "2026-08-28 14:00:00",
      purchaseLimitSource: "https://example.test/purchase-limits",
      purchaseLimitNetValueDates: ["08-27"],
      indirectExposureRows: 0,
      overseasStockCount: 1,
      shippedStockScope: "overseas",
      shippedStockCount: 1,
    },
    popularStocks: [{
      code: "NVDA",
      name: "NVIDIA",
      fundCount: 2,
      activeFundCount: 1,
      maxRatioPercent: 3.5,
    }],
    stocks: [{
      code: "NVDA",
      name: "NVIDIA",
      fundCount: 2,
      activeFundCount: 1,
      excludedIndexFundCount: 1,
      totalMarketValueWan: 120.5,
      maxRatioPercent: 3.5,
      topByRatio: [],
      topByValue: [],
    }],
  };
}

test("接受结构和关键计数完整的主季度 payload", () => {
  assert.doesNotThrow(() => validateQuarterPayload(quarterConfig, validPayload()));
});

test("拒绝缺少必填主数组的 payload", () => {
  const payload = validPayload();
  delete payload.stocks;

  assert.throws(() => validateQuarterPayload(quarterConfig, payload), /stocks/);
});

test("拒绝缺少关键 meta 字段的 payload", () => {
  const payload = validPayload();
  delete payload.meta.purchaseLimitSource;

  assert.throws(() => validateQuarterPayload(quarterConfig, payload), /purchaseLimitSource/);
});

test("拒绝主数组与 meta 计数不一致的 payload", () => {
  const payload = validPayload();
  payload.meta.stockCount = 2;

  assert.throws(() => validateQuarterPayload(quarterConfig, payload), /stockCount/);
});

test("拒绝空 stocks 以及缺失代码的股票项", () => {
  const emptyPayload = validPayload();
  emptyPayload.stocks = [];
  emptyPayload.popularStocks = [];
  emptyPayload.meta.stockCount = 0;
  emptyPayload.meta.totalStockCount = 0;
  emptyPayload.meta.shippedStockCount = 0;
  assert.throws(() => validateQuarterPayload(quarterConfig, emptyPayload), /stocks/);

  const invalidItemPayload = validPayload();
  invalidItemPayload.stocks[0].code = "";
  assert.throws(() => validateQuarterPayload(quarterConfig, invalidItemPayload), /stocks\[0\]\.code/);
});

test("拒绝缺少前端必需数值或列表字段的股票项", () => {
  const missingCount = validPayload();
  delete missingCount.stocks[0].fundCount;
  assert.throws(() => validateQuarterPayload(quarterConfig, missingCount), /stocks\[0\]\.fundCount/);

  const invalidRatio = validPayload();
  invalidRatio.stocks[0].maxRatioPercent = Number.NaN;
  assert.throws(() => validateQuarterPayload(quarterConfig, invalidRatio), /stocks\[0\]\.maxRatioPercent/);

  const missingRanking = validPayload();
  delete missingRanking.stocks[0].topByRatio;
  assert.throws(() => validateQuarterPayload(quarterConfig, missingRanking), /stocks\[0\]\.topByRatio/);
});

test("拒绝重复股票代码以及不属于 stocks 的热门股票", () => {
  const duplicate = validPayload();
  duplicate.stocks.push({ ...duplicate.stocks[0] });
  duplicate.meta.stockCount = 2;
  duplicate.meta.shippedStockCount = 2;
  duplicate.meta.totalStockCount = 2;
  duplicate.meta.overseasStockCount = 2;
  assert.throws(() => validateQuarterPayload(quarterConfig, duplicate), /duplicate stock code/);

  const outside = validPayload();
  outside.popularStocks[0].code = "AMD";
  assert.throws(() => validateQuarterPayload(quarterConfig, outside), /popularStocks\[0\]\.code/);
});

test("拒绝 shippedStockScope 与公开股票计数关系不一致", () => {
  const overseasMismatch = validPayload();
  overseasMismatch.meta.overseasStockCount = 0;
  assert.throws(() => validateQuarterPayload(quarterConfig, overseasMismatch), /overseasStockCount/);

  const allMismatch = validPayload();
  allMismatch.meta.shippedStockScope = "all";
  allMismatch.meta.totalStockCount = 2;
  assert.throws(() => validateQuarterPayload(quarterConfig, allMismatch), /totalStockCount/);
});

test("SEO 多文件发布中途失败时恢复全部旧资产", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "seo-publish-test-"));
  const first = path.join(tempRoot, "first.txt");
  const second = path.join(tempRoot, "second.txt");
  await writeFile(first, "old first", "utf8");
  await writeFile(second, "old second", "utf8");

  try {
    const { rename } = await import("node:fs/promises");
    await assert.rejects(
      publishTextFiles(
        [
          { path: first, content: "new first" },
          { path: second, content: "new second" },
        ],
        {
          renamePath: async (source, target) => {
            if (target === second && path.basename(source).includes(".stage-")) {
              throw new Error("injected SEO publish failure");
            }
            await rename(source, target);
          },
        },
      ),
      /injected SEO publish failure/,
    );

    assert.equal(await readFile(first, "utf8"), "old first");
    assert.equal(await readFile(second, "utf8"), "old second");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("SEO 回滚失败时保留旧资产备份", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "seo-rollback-test-"));
  const first = path.join(tempRoot, "first.txt");
  const second = path.join(tempRoot, "second.txt");
  await writeFile(first, "old first", "utf8");
  await writeFile(second, "old second", "utf8");

  try {
    const { rename } = await import("node:fs/promises");
    await assert.rejects(
      publishTextFiles(
        [
          { path: first, content: "new first" },
          { path: second, content: "new second" },
        ],
        {
          renamePath: async (source, target) => {
            if (target === second && path.basename(source).includes(".stage-")) {
              throw new Error("injected publish failure");
            }
            if (target === first && path.basename(source).includes(".rollback-")) {
              throw new Error("injected rollback failure");
            }
            await rename(source, target);
          },
        },
      ),
      /无法回滚/,
    );

    const backups = (await readdir(tempRoot)).filter((name) => name.startsWith(".first.txt.rollback-"));
    assert.equal(backups.length, 1);
    assert.equal(await readFile(path.join(tempRoot, backups[0]), "utf8"), "old first");
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});
