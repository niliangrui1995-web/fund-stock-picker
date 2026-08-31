import { describe, expect, it, vi } from "vitest";

import { fundQuarter } from "../../fundQuarter";
import {
  loadPortfolioFundDetails,
  loadPortfolioIndex,
} from "../portfolioIndex";
import type {
  FundFamilyProfile,
  PortfolioDetailRecord,
  PortfolioDetailShard,
  PortfolioManifest,
  PortfolioShard,
} from "../types";

const MANIFEST_URL = "/data/fund-portfolio-index-2026q2.manifest.json?v=2026q2";
const DISCLOSURE = "未映射或不合格的间接产品不按 0% 计入。";
let releaseSequence = 0;

async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const copied = new Uint8Array(bytes.byteLength);
  copied.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copied.buffer);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function sha256Text(text: string): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(text));
}

function stockFileStem(stockCode: string): string {
  return `stock-${Array.from(new TextEncoder().encode(stockCode), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function findSamePrefixFamilyKey(familyKey: string): Promise<string> {
  const prefix = (await sha256Text(familyKey)).slice(0, 2);
  for (let index = 0; index < 10_000; index += 1) {
    const candidate = `${familyKey}-同前缀-${index}`;
    if ((await sha256Text(candidate)).startsWith(prefix)) return candidate;
  }
  throw new Error("未找到同 hash-prefix 的测试家族键");
}

function response(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

type PackageFixture = Awaited<ReturnType<typeof makePackage>>;

async function makePackage(input?: {
  detailRecord?: PortfolioDetailRecord;
  familyKey?: string;
}): Promise<{
  manifest: PortfolioManifest;
  manifestText: string;
  stockTexts: Record<string, string>;
  detailText: string;
  stockUrls: Record<string, string>;
  detailUrl: string;
  familyKey: string;
}> {
  releaseSequence += 1;
  const releaseId = `2026q2-fixture-${releaseSequence}`;
  const familyKey = input?.familyKey ?? `夹具基金-${releaseSequence}`;
  const prefix = (await sha256Text(familyKey)).slice(0, 2);
  const profile: FundFamilyProfile = {
    fundFamilyKey: familyKey,
    fundCode: "000001",
    fundName: familyKey,
    fundDisplayName: familyKey,
    fundType: "QDII-普通股票",
    fundVariantCodes: ["000001"],
    isQdii: true,
    isOnExchangeFund: false,
    view: "offExchange",
    detailShardKey: prefix,
  };
  const makeShard = (code: string, name: string, ratioPercent: number): PortfolioShard => ({
    schemaVersion: "1",
    releaseId,
    report: "2026Q2",
    cutoffDate: "2026-06-30",
    generatedAt: "2026-08-28T00:00:00",
    stock: { code, name },
    fundProfiles: { [familyKey]: profile },
    directEdges: [{
      fundFamilyKey: familyKey,
      targetCode: code,
      targetName: name,
      ratioPercent,
      isOnExchangeFund: false,
    }],
    indirectEdges: [],
    coverage: {
      directInputRows: 1,
      directPublishedEdges: 1,
      directIneligibleByReason: {},
      indirectCandidateRows: 0,
      qualifiedIndirectEdges: 0,
      ineligibleCandidateRows: 0,
      ineligibleByReason: {},
      unmappedNotCountedAsZero: DISCLOSURE,
    },
    integrity: { algorithm: "SHA-256", encoding: "UTF-8" },
  });
  const shards = {
    "000660": makeShard("000660", "SK海力士", 2),
    "005930": makeShard("005930", "三星电子", 3),
  };
  const stockTexts = Object.fromEntries(
    Object.entries(shards).map(([code, value]) => [code, JSON.stringify(value)]),
  );
  const detailRecord: PortfolioDetailRecord = input?.detailRecord ?? {
    fundFamilyKey: familyKey,
    detailStatus: "available",
    detailFundCode: "000001",
    holdings: [{
      rank: 1,
      stockCode: "00700",
      stockName: "腾讯控股",
      ratio: 0.08,
      ratioPercent: 8,
      marketValueWan: 100,
      sharesWan: 2,
    }],
  };
  const detailShard: PortfolioDetailShard = {
    schemaVersion: "1",
    releaseId,
    report: "2026Q2",
    cutoffDate: "2026-06-30",
    generatedAt: "2026-08-28T00:00:00",
    fundFamilyKeyHashPrefix: prefix,
    fundDetails: { [familyKey]: detailRecord },
    integrity: { algorithm: "SHA-256", encoding: "UTF-8" },
  };
  const detailText = JSON.stringify(detailShard);
  const stockPaths = Object.fromEntries(
    Object.keys(shards).map((code) => [
      code,
      `fund-portfolio-index-2026q2/${releaseId}/${stockFileStem(code)}.json`,
    ]),
  );
  const detailPath = `fund-portfolio-index-2026q2/${releaseId}/fund-details/${prefix}.json`;
  const manifest: PortfolioManifest = {
    schemaVersion: "1",
    releaseId,
    report: "2026Q2",
    cutoffDate: "2026-06-30",
    generatedAt: "2026-08-28T00:00:00",
    builderVersion: "fund-portfolio-index-v1",
    fundFamilyRuleVersion: "fund-family-key-v1",
    viewClassificationRuleVersion: "is-on-exchange-fund-v1",
    publishStatus: "complete",
    inputHoldingRows: 2,
    source: "current-quarter-public-stock-detail-rows",
    sourceFile: "fixture.csv",
    fundInvestmentSourceFile: "fixture-fund-investment.csv",
    fundInvestmentSourceRows: 0,
    disclosure: "仅覆盖当前季度已采集的公开股票持仓明细；未出现不代表未持有。基金详情最多展示 10 条，不能代表基金完整组合或实时仓位。",
    auditPath: "public/seo/indirect-exposure-audit-2026q2.md",
    fundDetailShardRule: "sha256(fundFamilyKey UTF-8) 的前 2 位十六进制字符",
    fundDetailDisplayLimit: 10,
    coverage: {
      directInputRows: 2,
      directPublishedEdges: 2,
      directIneligibleByReason: {},
      indirectCandidateRows: 0,
      qualifiedIndirectEdges: 0,
      ineligibleByReason: {},
      unmappedCandidateRows: 0,
      unmappedByReason: {},
      unmappedNotCountedAsZero: DISCLOSURE,
      stockShardCount: 2,
      fundDetailShardCount: 1,
      fundDetailFamilyCount: 1,
      fundDetailAvailableFamilyCount:
        detailRecord.detailStatus === "available" ? 1 : 0,
      fundDetailNotCapturedFamilyCount:
        detailRecord.detailStatus === "not_captured_in_current_stock_detail_rows" ? 1 : 0,
    },
    shards: {
      "000660": {
        path: stockPaths["000660"],
        sha256: await sha256Text(stockTexts["000660"]),
        directEdgeCount: 1,
        qualifiedIndirectEdgeCount: 0,
      },
      "005930": {
        path: stockPaths["005930"],
        sha256: await sha256Text(stockTexts["005930"]),
        directEdgeCount: 1,
        qualifiedIndirectEdgeCount: 0,
      },
    },
    fundDetailShards: {
      [prefix]: {
        path: detailPath,
        sha256: await sha256Text(detailText),
        fundFamilyCount: 1,
      },
    },
  };
  return {
    manifest,
    manifestText: JSON.stringify(manifest),
    stockTexts,
    detailText,
    stockUrls: Object.fromEntries(
      Object.entries(stockPaths).map(([code, path]) => [code, `/data/${path}`]),
    ),
    detailUrl: `/data/${detailPath}`,
    familyKey,
  };
}

function packageFetch(fixture: PackageFixture) {
  return vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = String(input);
    if (url === MANIFEST_URL) return response(fixture.manifestText);
    const code = Object.entries(fixture.stockUrls).find(([, value]) => value === url)?.[0];
    if (code) return response(fixture.stockTexts[code]);
    if (url === fixture.detailUrl) return response(fixture.detailText);
    return response("not found", 404);
  });
}

async function mutateStockShard(
  fixture: PackageFixture,
  stockCode: string,
  mutate: (shard: PortfolioShard) => void,
) {
  const shard = JSON.parse(fixture.stockTexts[stockCode]) as PortfolioShard;
  mutate(shard);
  fixture.stockTexts[stockCode] = JSON.stringify(shard);
  fixture.manifest.shards[stockCode].sha256 = await sha256Text(
    fixture.stockTexts[stockCode],
  );
  fixture.manifestText = JSON.stringify(fixture.manifest);
}

describe("portfolioIndex", () => {
  it("使用季度化 manifest URL，fresh manifest 与验证后分片缓存加载完整选择", async () => {
    expect(fundQuarter.portfolioManifestUrl).toBe(
      `/data/fund-portfolio-index-${fundQuarter.slug}.manifest.json?v=${fundQuarter.assetVersion}`,
    );
    expect(fundQuarter.qdiiHoldingsUrl).toBe(
      `/data/qdii-fund-holdings-${fundQuarter.year}h1.json?v=${fundQuarter.assetVersion}`,
    );
    const fixture = await makePackage();
    const fetchImpl = packageFetch(fixture);
    const controller = new AbortController();

    const first = await loadPortfolioIndex({
      manifestUrl: MANIFEST_URL,
      selectedStockCodes: ["000660", "000660", "005930"],
      signal: controller.signal,
      fetchImpl: fetchImpl as typeof fetch,
    });
    const second = await loadPortfolioIndex({
      manifestUrl: MANIFEST_URL,
      selectedStockCodes: ["000660", "005930"],
      signal: controller.signal,
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(first.shards.map((item) => item.stock.code)).toEqual(["000660", "005930"]);
    expect(second.manifest.releaseId).toBe(fixture.manifest.releaseId);
    expect(fetchImpl.mock.calls.filter(([url]) => url === MANIFEST_URL)).toHaveLength(2);
    expect(fetchImpl.mock.calls.filter(([url]) => url === fixture.stockUrls["000660"])).toHaveLength(1);
    for (const [, options] of fetchImpl.mock.calls) {
      expect(options).toEqual({ cache: "no-cache", signal: controller.signal });
    }
  });

  it("空选择、超过十只或 manifest 未声明代码均失败关闭", async () => {
    const fixture = await makePackage();
    const fetchImpl = packageFetch(fixture);
    const signal = new AbortController().signal;

    await expect(loadPortfolioIndex({
      manifestUrl: MANIFEST_URL,
      selectedStockCodes: [],
      signal,
      fetchImpl: fetchImpl as typeof fetch,
    })).rejects.toThrow("至少选择 1 只");
    await expect(loadPortfolioIndex({
      manifestUrl: MANIFEST_URL,
      selectedStockCodes: Array.from({ length: 11 }, (_, index) => `S${index}`),
      signal,
      fetchImpl: fetchImpl as typeof fetch,
    })).rejects.toThrow("最多选择 10 只");
    await expect(loadPortfolioIndex({
      manifestUrl: MANIFEST_URL,
      selectedStockCodes: ["UNKNOWN"],
      signal,
      fetchImpl: fetchImpl as typeof fetch,
    })).rejects.toThrow("UNKNOWN");
  });

  it("任一所选股票 HTTP 失败时指出代码并拒绝整个组合", async () => {
    const fixture = await makePackage();
    const baseFetch = packageFetch(fixture);
    let failSecondShard = true;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input) === fixture.stockUrls["005930"] && failSecondShard
        ? response("missing", 404)
        : baseFetch(input, init),
    );

    await expect(loadPortfolioIndex({
      manifestUrl: MANIFEST_URL,
      selectedStockCodes: ["000660", "005930"],
      signal: new AbortController().signal,
      fetchImpl: fetchImpl as typeof fetch,
    })).rejects.toThrow(/组合数据分片.*005930/);

    failSecondShard = false;
    await expect(loadPortfolioIndex({
      manifestUrl: MANIFEST_URL,
      selectedStockCodes: ["000660", "005930"],
      signal: new AbortController().signal,
      fetchImpl: fetchImpl as typeof fetch,
    })).resolves.toMatchObject({ shards: [{ stock: { code: "000660" } }, { stock: { code: "005930" } }] });
    expect(fetchImpl.mock.calls.filter(([url]) => url === fixture.stockUrls["000660"])).toHaveLength(2);
  });

  it("拒绝原始字节篡改、错误 release path、重复边和跨分片 profile 冲突", async () => {
    const tampered = await makePackage();
    tampered.stockTexts["000660"] += " ";
    await expect(loadPortfolioIndex({
      manifestUrl: MANIFEST_URL,
      selectedStockCodes: ["000660"],
      signal: new AbortController().signal,
      fetchImpl: packageFetch(tampered) as typeof fetch,
    })).rejects.toThrow(/SHA-256/);

    const wrongPath = await makePackage();
    wrongPath.manifest.shards["000660"].path = "../escape.json";
    wrongPath.manifestText = JSON.stringify(wrongPath.manifest);
    await expect(loadPortfolioIndex({
      manifestUrl: MANIFEST_URL,
      selectedStockCodes: ["000660"],
      signal: new AbortController().signal,
      fetchImpl: packageFetch(wrongPath) as typeof fetch,
    })).rejects.toThrow(/路径/);

    const duplicate = await makePackage();
    const duplicateShard = JSON.parse(duplicate.stockTexts["000660"]) as PortfolioShard;
    duplicateShard.directEdges.push({ ...duplicateShard.directEdges[0] });
    duplicateShard.coverage.directInputRows = 2;
    duplicateShard.coverage.directPublishedEdges = 2;
    duplicate.stockTexts["000660"] = JSON.stringify(duplicateShard);
    duplicate.manifest.shards["000660"].directEdgeCount = 2;
    duplicate.manifest.shards["000660"].sha256 = await sha256Text(duplicate.stockTexts["000660"]);
    duplicate.manifestText = JSON.stringify(duplicate.manifest);
    await expect(loadPortfolioIndex({
      manifestUrl: MANIFEST_URL,
      selectedStockCodes: ["000660"],
      signal: new AbortController().signal,
      fetchImpl: packageFetch(duplicate) as typeof fetch,
    })).rejects.toThrow(/重复直接边/);

    const conflict = await makePackage();
    const conflictShard = JSON.parse(conflict.stockTexts["005930"]) as PortfolioShard;
    conflictShard.fundProfiles[conflict.familyKey].fundName = "冲突名称";
    conflict.stockTexts["005930"] = JSON.stringify(conflictShard);
    conflict.manifest.shards["005930"].sha256 = await sha256Text(conflict.stockTexts["005930"]);
    conflict.manifestText = JSON.stringify(conflict.manifest);
    await expect(loadPortfolioIndex({
      manifestUrl: MANIFEST_URL,
      selectedStockCodes: ["000660", "005930"],
      signal: new AbortController().signal,
      fetchImpl: packageFetch(conflict) as typeof fetch,
    })).rejects.toThrow(/跨股票分片/);
  });

  it("abort 在读取字节后仍取消且不把分片写入缓存", async () => {
    const fixture = await makePackage();
    const controller = new AbortController();
    let abortingShardReads = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === MANIFEST_URL) return response(fixture.manifestText);
      if (url === fixture.stockUrls["000660"] && abortingShardReads++ === 0) {
        const bytes = new TextEncoder().encode(fixture.stockTexts["000660"]);
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => {
            controller.abort();
            return bytes.buffer;
          },
        } as Response;
      }
      return response(fixture.stockTexts["000660"]);
    });

    await expect(loadPortfolioIndex({
      manifestUrl: MANIFEST_URL,
      selectedStockCodes: ["000660"],
      signal: controller.signal,
      fetchImpl: fetchImpl as typeof fetch,
    })).rejects.toMatchObject({ name: "AbortError" });

    await expect(loadPortfolioIndex({
      manifestUrl: MANIFEST_URL,
      selectedStockCodes: ["000660"],
      signal: new AbortController().signal,
      fetchImpl: fetchImpl as typeof fetch,
    })).resolves.toMatchObject({ shards: [{ stock: { code: "000660" } }] });
    expect(abortingShardReads).toBe(2);
  });

  it("abort 在请求前和请求中均原样保留 AbortError", async () => {
    const before = new AbortController();
    before.abort();
    const beforeFetch = vi.fn();
    await expect(loadPortfolioIndex({
      manifestUrl: MANIFEST_URL,
      selectedStockCodes: ["000660"],
      signal: before.signal,
      fetchImpl: beforeFetch as unknown as typeof fetch,
    })).rejects.toMatchObject({ name: "AbortError" });
    expect(beforeFetch).not.toHaveBeenCalled();

    const during = new AbortController();
    const duringFetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), {
          once: true,
        });
      }),
    );
    const pending = loadPortfolioIndex({
      manifestUrl: MANIFEST_URL,
      selectedStockCodes: ["000660"],
      signal: during.signal,
      fetchImpl: duringFetch as typeof fetch,
    });
    during.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("manifest 改为新的不可变 release 后不复用旧分片缓存", async () => {
    const first = await makePackage();
    const second = await makePackage();
    let current = first;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === MANIFEST_URL) return response(current.manifestText);
      for (const fixture of [first, second]) {
        const code = Object.entries(fixture.stockUrls).find(([, path]) => path === url)?.[0];
        if (code) return response(fixture.stockTexts[code]);
      }
      return response("missing", 404);
    });

    await loadPortfolioIndex({
      manifestUrl: MANIFEST_URL,
      selectedStockCodes: ["000660"],
      signal: new AbortController().signal,
      fetchImpl: fetchImpl as typeof fetch,
    });
    current = second;
    await loadPortfolioIndex({
      manifestUrl: MANIFEST_URL,
      selectedStockCodes: ["000660"],
      signal: new AbortController().signal,
      fetchImpl: fetchImpl as typeof fetch,
    });

    expect(fetchImpl.mock.calls.filter(([url]) => url === first.stockUrls["000660"])).toHaveLength(1);
    expect(fetchImpl.mock.calls.filter(([url]) => url === second.stockUrls["000660"])).toHaveLength(1);
  });

  it("接受 manifest 精确声明的 BA/LN 股票代码并使用安全分片路径", async () => {
    const fixture = await makePackage();
    const oldCode = "000660";
    const newCode = "BA/LN";
    const shard = JSON.parse(fixture.stockTexts[oldCode]) as PortfolioShard;
    shard.stock.code = newCode;
    shard.directEdges[0].targetCode = newCode;
    fixture.stockTexts[newCode] = JSON.stringify(shard);
    delete fixture.stockTexts[oldCode];
    const path = `fund-portfolio-index-2026q2/${fixture.manifest.releaseId}/${stockFileStem(newCode)}.json`;
    fixture.manifest.shards[newCode] = {
      ...fixture.manifest.shards[oldCode],
      path,
      sha256: await sha256Text(fixture.stockTexts[newCode]),
    };
    delete fixture.manifest.shards[oldCode];
    fixture.stockUrls[newCode] = `/data/${path}`;
    delete fixture.stockUrls[oldCode];
    fixture.manifestText = JSON.stringify(fixture.manifest);

    await expect(loadPortfolioIndex({
      manifestUrl: MANIFEST_URL,
      selectedStockCodes: [newCode],
      signal: new AbortController().signal,
      fetchImpl: packageFetch(fixture) as typeof fetch,
    })).resolves.toMatchObject({ shards: [{ stock: { code: newCode } }] });
  });

  it("拒绝 malformed manifest、错误 schema/cutoff/count 和跨 origin URL", async () => {
    const malformedFetch = vi.fn(async () => response("{"));
    await expect(loadPortfolioIndex({
      manifestUrl: MANIFEST_URL,
      selectedStockCodes: ["000660"],
      signal: new AbortController().signal,
      fetchImpl: malformedFetch as typeof fetch,
    })).rejects.toThrow(/manifest JSON/);

    for (const mutate of [
      (manifest: Record<string, unknown>) => { manifest.schemaVersion = "2"; },
      (manifest: Record<string, unknown>) => { manifest.cutoffDate = "2026-06-29"; },
      (manifest: Record<string, unknown>) => {
        (manifest.coverage as Record<string, unknown>).stockShardCount = 999;
      },
    ]) {
      const fixture = await makePackage();
      mutate(fixture.manifest as unknown as Record<string, unknown>);
      fixture.manifestText = JSON.stringify(fixture.manifest);
      await expect(loadPortfolioIndex({
        manifestUrl: MANIFEST_URL,
        selectedStockCodes: ["000660"],
        signal: new AbortController().signal,
        fetchImpl: packageFetch(fixture) as typeof fetch,
      })).rejects.toThrow();
    }

    await expect(loadPortfolioIndex({
      manifestUrl: "https://evil.example/data/fund-portfolio-index-2026q2.manifest.json",
      selectedStockCodes: ["000660"],
      signal: new AbortController().signal,
      fetchImpl: vi.fn() as unknown as typeof fetch,
    })).rejects.toThrow(/同源/);
  });

  it("拒绝已同步 SHA 的错误分片 release、coverage 与间接公式", async () => {
    const wrongRelease = await makePackage();
    await mutateStockShard(wrongRelease, "000660", (shard) => {
      shard.releaseId = "2026q2-wrong-release";
    });
    await expect(loadPortfolioIndex({
      manifestUrl: MANIFEST_URL,
      selectedStockCodes: ["000660"],
      signal: new AbortController().signal,
      fetchImpl: packageFetch(wrongRelease) as typeof fetch,
    })).rejects.toThrow(/发布元数据/);

    const wrongCoverage = await makePackage();
    await mutateStockShard(wrongCoverage, "000660", (shard) => {
      shard.coverage.directInputRows = 0;
    });
    await expect(loadPortfolioIndex({
      manifestUrl: MANIFEST_URL,
      selectedStockCodes: ["000660"],
      signal: new AbortController().signal,
      fetchImpl: packageFetch(wrongCoverage) as typeof fetch,
    })).rejects.toThrow(/coverage/);

    const wrongFormula = await makePackage();
    await mutateStockShard(wrongFormula, "000660", (shard) => {
      const profile = shard.fundProfiles[wrongFormula.familyKey];
      shard.indirectEdges = [{
        fundFamilyKey: wrongFormula.familyKey,
        targetCode: "000660",
        targetName: "SK海力士",
        sourceCode: "7709.HK",
        sourceName: "Leveraged Hynix",
        sourceRatioPercent: 4.87,
        leverageMultiple: 2,
        estimatedRatioPercent: 99,
        matchReason: "fixture mapping",
        isOnExchangeFund: profile.isOnExchangeFund,
      }];
      shard.coverage.indirectCandidateRows = 1;
      shard.coverage.qualifiedIndirectEdges = 1;
    });
    wrongFormula.manifest.shards["000660"].qualifiedIndirectEdgeCount = 1;
    wrongFormula.manifest.shards["000660"].sha256 = await sha256Text(wrongFormula.stockTexts["000660"]);
    wrongFormula.manifestText = JSON.stringify(wrongFormula.manifest);
    await expect(loadPortfolioIndex({
      manifestUrl: MANIFEST_URL,
      selectedStockCodes: ["000660"],
      signal: new AbortController().signal,
      fetchImpl: packageFetch(wrongFormula) as typeof fetch,
    })).rejects.toThrow(/公式/);
  });

  it("拒绝数值型 fundFamilyKey，即使存在同名字符串 profile 且 SHA 已同步", async () => {
    const numericDirect = await makePackage({ familyKey: "42" });
    await mutateStockShard(numericDirect, "000660", (shard) => {
      (shard.directEdges[0] as unknown as { fundFamilyKey: unknown }).fundFamilyKey = 42;
    });
    await expect(loadPortfolioIndex({
      manifestUrl: MANIFEST_URL,
      selectedStockCodes: ["000660"],
      signal: new AbortController().signal,
      fetchImpl: packageFetch(numericDirect) as typeof fetch,
    })).rejects.toThrow(/无效直接边/);

    const numericIndirect = await makePackage({ familyKey: "42" });
    await mutateStockShard(numericIndirect, "000660", (shard) => {
      shard.directEdges = [];
      shard.indirectEdges = [{
        fundFamilyKey: 42,
        targetCode: "000660",
        targetName: "SK海力士",
        sourceCode: "7709.HK",
        sourceName: "Leveraged Hynix",
        sourceRatioPercent: 4.87,
        leverageMultiple: 2,
        estimatedRatioPercent: 9.74,
        matchReason: "fixture mapping",
        isOnExchangeFund: false,
      } as unknown as (typeof shard.indirectEdges)[number]];
      shard.coverage.directInputRows = 0;
      shard.coverage.directPublishedEdges = 0;
      shard.coverage.indirectCandidateRows = 1;
      shard.coverage.qualifiedIndirectEdges = 1;
    });
    numericIndirect.manifest.shards["000660"].directEdgeCount = 0;
    numericIndirect.manifest.shards["000660"].qualifiedIndirectEdgeCount = 1;
    numericIndirect.manifestText = JSON.stringify(numericIndirect.manifest);
    await expect(loadPortfolioIndex({
      manifestUrl: MANIFEST_URL,
      selectedStockCodes: ["000660"],
      signal: new AbortController().signal,
      fetchImpl: packageFetch(numericIndirect) as typeof fetch,
    })).rejects.toThrow(/无效间接边/);
  });

  it("拒绝借用普通对象继承属性的 profile 查找和缺失场内布尔值", async () => {
    for (const inheritedKey of ["toString", "constructor", "__proto__"]) {
      const fixture = await makePackage();
      await mutateStockShard(fixture, "000660", (shard) => {
        shard.fundProfiles = {};
        shard.directEdges = [{
          fundFamilyKey: inheritedKey,
          targetCode: "000660",
          targetName: "SK海力士",
          ratioPercent: 2,
        } as unknown as (typeof shard.directEdges)[number]];
      });

      await expect(loadPortfolioIndex({
        manifestUrl: MANIFEST_URL,
        selectedStockCodes: ["000660"],
        signal: new AbortController().signal,
        fetchImpl: packageFetch(fixture) as typeof fetch,
      })).rejects.toThrow(/无效直接边/);
    }

    const indirect = await makePackage();
    await mutateStockShard(indirect, "000660", (shard) => {
      shard.fundProfiles = {};
      shard.directEdges = [];
      shard.indirectEdges = [{
        fundFamilyKey: "toString",
        targetCode: "000660",
        targetName: "SK海力士",
        sourceCode: "7709.HK",
        sourceName: "Leveraged Hynix",
        sourceRatioPercent: 4.87,
        leverageMultiple: 2,
        estimatedRatioPercent: 9.74,
        matchReason: "fixture mapping",
      } as unknown as (typeof shard.indirectEdges)[number]];
      shard.coverage.directInputRows = 0;
      shard.coverage.directPublishedEdges = 0;
      shard.coverage.indirectCandidateRows = 1;
      shard.coverage.qualifiedIndirectEdges = 1;
    });
    indirect.manifest.shards["000660"].directEdgeCount = 0;
    indirect.manifest.shards["000660"].qualifiedIndirectEdgeCount = 1;
    indirect.manifestText = JSON.stringify(indirect.manifest);
    await expect(loadPortfolioIndex({
      manifestUrl: MANIFEST_URL,
      selectedStockCodes: ["000660"],
      signal: new AbortController().signal,
      fetchImpl: packageFetch(indirect) as typeof fetch,
    })).rejects.toThrow(/无效间接边/);
  });

  it("拒绝已同步 SHA 的 malformed 股票 JSON", async () => {
    const fixture = await makePackage();
    fixture.stockTexts["000660"] = "{";
    fixture.manifest.shards["000660"].sha256 = await sha256Text("{");
    fixture.manifestText = JSON.stringify(fixture.manifest);

    await expect(loadPortfolioIndex({
      manifestUrl: MANIFEST_URL,
      selectedStockCodes: ["000660"],
      signal: new AbortController().signal,
      fetchImpl: packageFetch(fixture) as typeof fetch,
    })).rejects.toThrow(/组合数据分片.*JSON/);
  });

  it("按 hash-prefix 返回 available 与 not-captured 联合，失败绝不伪造空持仓", async () => {
    const available = await makePackage();
    const availableFetch = packageFetch(available);
    const detail = await loadPortfolioFundDetails({
      manifestUrl: MANIFEST_URL,
      manifest: available.manifest,
      fundFamilyKey: available.familyKey,
      signal: new AbortController().signal,
      fetchImpl: availableFetch as typeof fetch,
    });
    expect(detail).toMatchObject({ detailStatus: "available", detailFundCode: "000001" });
    if (detail.detailStatus === "available") {
      expect(detail.holdings).toHaveLength(1);
    }
    await loadPortfolioFundDetails({
      manifestUrl: MANIFEST_URL,
      manifest: available.manifest,
      fundFamilyKey: available.familyKey,
      signal: new AbortController().signal,
      fetchImpl: availableFetch as typeof fetch,
    });
    expect(availableFetch.mock.calls.filter(([url]) => url === available.detailUrl)).toHaveLength(1);

    const missingMessage = "当前已采集公开股票明细未包含可展开详情；这不代表基金没有持仓。";
    const notCapturedFamily = `未采集家族-${releaseSequence + 1}`;
    const notCaptured = await makePackage({
      familyKey: notCapturedFamily,
      detailRecord: {
        fundFamilyKey: notCapturedFamily,
        detailStatus: "not_captured_in_current_stock_detail_rows",
        detailMessage: missingMessage,
      },
    });
    const notCapturedResult = await loadPortfolioFundDetails({
      manifestUrl: MANIFEST_URL,
      manifest: notCaptured.manifest,
      fundFamilyKey: notCaptured.familyKey,
      signal: new AbortController().signal,
      fetchImpl: packageFetch(notCaptured) as typeof fetch,
    });
    expect(notCapturedResult).toEqual({
      fundFamilyKey: notCaptured.familyKey,
      detailStatus: "not_captured_in_current_stock_detail_rows",
      detailMessage: missingMessage,
    });

    const unavailable = await makePackage();
    const failedFetch = vi.fn(async () => response("missing", 404));
    await expect(loadPortfolioFundDetails({
      manifestUrl: MANIFEST_URL,
      manifest: unavailable.manifest,
      fundFamilyKey: unavailable.familyKey,
      signal: new AbortController().signal,
      fetchImpl: failedFetch as typeof fetch,
    })).rejects.toThrow("详情暂时不可用");
  });

  it("详情分片不含所请求家族时失败不缓存，连续调用必须重新抓取", async () => {
    const fixture = await makePackage();
    const samePrefixFamilyKey = await findSamePrefixFamilyKey(fixture.familyKey);
    const detailShard = JSON.parse(fixture.detailText) as PortfolioDetailShard;
    const originalRecord = detailShard.fundDetails[fixture.familyKey];
    delete detailShard.fundDetails[fixture.familyKey];
    detailShard.fundDetails[samePrefixFamilyKey] = {
      ...originalRecord,
      fundFamilyKey: samePrefixFamilyKey,
    };
    fixture.detailText = JSON.stringify(detailShard);
    const prefix = Object.keys(fixture.manifest.fundDetailShards)[0];
    fixture.manifest.fundDetailShards[prefix].sha256 = await sha256Text(fixture.detailText);
    const fetchImpl = packageFetch(fixture);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(loadPortfolioFundDetails({
        manifestUrl: MANIFEST_URL,
        manifest: fixture.manifest,
        fundFamilyKey: fixture.familyKey,
        signal: new AbortController().signal,
        fetchImpl: fetchImpl as typeof fetch,
      })).rejects.toThrow(/详情暂时不可用.*未包含基金家族/);
    }
    expect(fetchImpl.mock.calls.filter(([url]) => url === fixture.detailUrl)).toHaveLength(2);
  });

  it("详情读取字节后取消不会缓存，后续成功调用必须重新抓取", async () => {
    const fixture = await makePackage();
    const controller = new AbortController();
    let detailReads = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url !== fixture.detailUrl) return response("not found", 404);
      detailReads += 1;
      if (detailReads === 1) {
        const bytes = new TextEncoder().encode(fixture.detailText);
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => {
            controller.abort();
            return bytes.buffer;
          },
        } as Response;
      }
      return response(fixture.detailText);
    });

    await expect(loadPortfolioFundDetails({
      manifestUrl: MANIFEST_URL,
      manifest: fixture.manifest,
      fundFamilyKey: fixture.familyKey,
      signal: controller.signal,
      fetchImpl: fetchImpl as typeof fetch,
    })).rejects.toMatchObject({ name: "AbortError" });
    await expect(loadPortfolioFundDetails({
      manifestUrl: MANIFEST_URL,
      manifest: fixture.manifest,
      fundFamilyKey: fixture.familyKey,
      signal: new AbortController().signal,
      fetchImpl: fetchImpl as typeof fetch,
    })).resolves.toMatchObject({ fundFamilyKey: fixture.familyKey });
    expect(detailReads).toBe(2);
  });

  it("拒绝超过 10 条或映射到错误家族的详情", async () => {
    const overLimit = await makePackage();
    const detailShard = JSON.parse(overLimit.detailText) as PortfolioDetailShard;
    const record = detailShard.fundDetails[overLimit.familyKey];
    if (record.detailStatus !== "available") throw new Error("fixture 必须可用");
    record.holdings = Array.from({ length: 11 }, (_, index) => ({
      ...record.holdings[0],
      rank: index + 1,
    })) as typeof record.holdings;
    overLimit.detailText = JSON.stringify(detailShard);
    const prefix = Object.keys(overLimit.manifest.fundDetailShards)[0];
    overLimit.manifest.fundDetailShards[prefix].sha256 = await sha256Text(overLimit.detailText);
    await expect(loadPortfolioFundDetails({
      manifestUrl: MANIFEST_URL,
      manifest: overLimit.manifest,
      fundFamilyKey: overLimit.familyKey,
      signal: new AbortController().signal,
      fetchImpl: packageFetch(overLimit) as typeof fetch,
    })).rejects.toThrow("详情暂时不可用");

    const wrongFamily = await makePackage();
    const wrongDetailShard = JSON.parse(wrongFamily.detailText) as PortfolioDetailShard;
    wrongDetailShard.fundDetails = {};
    wrongFamily.detailText = JSON.stringify(wrongDetailShard);
    const wrongPrefix = Object.keys(wrongFamily.manifest.fundDetailShards)[0];
    wrongFamily.manifest.fundDetailShards[wrongPrefix].fundFamilyCount = 0;
    wrongFamily.manifest.fundDetailShards[wrongPrefix].sha256 = await sha256Text(wrongFamily.detailText);
    await expect(loadPortfolioFundDetails({
      manifestUrl: MANIFEST_URL,
      manifest: wrongFamily.manifest,
      fundFamilyKey: wrongFamily.familyKey,
      signal: new AbortController().signal,
      fetchImpl: packageFetch(wrongFamily) as typeof fetch,
    })).rejects.toThrow("详情暂时不可用");
  });

  it("拒绝详情原始字节篡改、错误 schema 与错误 release", async () => {
    const tampered = await makePackage();
    tampered.detailText += " ";
    await expect(loadPortfolioFundDetails({
      manifestUrl: MANIFEST_URL,
      manifest: tampered.manifest,
      fundFamilyKey: tampered.familyKey,
      signal: new AbortController().signal,
      fetchImpl: packageFetch(tampered) as typeof fetch,
    })).rejects.toThrow(/详情暂时不可用.*SHA-256/);

    for (const mutate of [
      (detail: PortfolioDetailShard) => {
        (detail as unknown as { schemaVersion: string }).schemaVersion = "2";
      },
      (detail: PortfolioDetailShard) => {
        detail.releaseId = "2026q2-wrong-release";
      },
    ]) {
      const fixture = await makePackage();
      const detail = JSON.parse(fixture.detailText) as PortfolioDetailShard;
      mutate(detail);
      fixture.detailText = JSON.stringify(detail);
      const prefix = Object.keys(fixture.manifest.fundDetailShards)[0];
      fixture.manifest.fundDetailShards[prefix].sha256 = await sha256Text(fixture.detailText);
      await expect(loadPortfolioFundDetails({
        manifestUrl: MANIFEST_URL,
        manifest: fixture.manifest,
        fundFamilyKey: fixture.familyKey,
        signal: new AbortController().signal,
        fetchImpl: packageFetch(fixture) as typeof fetch,
      })).rejects.toThrow("详情暂时不可用");
    }
  });

  it("拒绝已同步 SHA 的 malformed 详情 JSON 和错误详情路径", async () => {
    const malformed = await makePackage();
    malformed.detailText = "{";
    const malformedPrefix = Object.keys(malformed.manifest.fundDetailShards)[0];
    malformed.manifest.fundDetailShards[malformedPrefix].sha256 = await sha256Text("{");
    await expect(loadPortfolioFundDetails({
      manifestUrl: MANIFEST_URL,
      manifest: malformed.manifest,
      fundFamilyKey: malformed.familyKey,
      signal: new AbortController().signal,
      fetchImpl: packageFetch(malformed) as typeof fetch,
    })).rejects.toThrow(/详情暂时不可用.*JSON/);

    const wrongPath = await makePackage();
    const wrongPrefix = Object.keys(wrongPath.manifest.fundDetailShards)[0];
    wrongPath.manifest.fundDetailShards[wrongPrefix].path = "../detail.json";
    await expect(loadPortfolioFundDetails({
      manifestUrl: MANIFEST_URL,
      manifest: wrongPath.manifest,
      fundFamilyKey: wrongPath.familyKey,
      signal: new AbortController().signal,
      fetchImpl: packageFetch(wrongPath) as typeof fetch,
    })).rejects.toThrow(/详情暂时不可用.*路径/);
  });
});
