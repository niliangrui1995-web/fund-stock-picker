import { describe, expect, it } from "vitest";

import { aggregatePortfolioResults } from "../aggregatePortfolioResults";
import type {
  DirectEdge,
  FundFamilyProfile,
  PortfolioShard,
  QualifiedIndirectEdge,
} from "../types";

const DISCLOSURE = "未映射或不合格的间接产品不按 0% 计入。";

function profile(
  fundFamilyKey: string,
  fundCode: string,
  isOnExchangeFund = false,
): FundFamilyProfile {
  return {
    fundFamilyKey,
    fundCode,
    fundName: fundFamilyKey,
    fundDisplayName: fundFamilyKey,
    fundType: isOnExchangeFund ? "ETF-海外股票" : "QDII-普通股票",
    fundVariantCodes: [fundCode],
    isQdii: !isOnExchangeFund,
    isOnExchangeFund,
    view: isOnExchangeFund ? "onExchange" : "offExchange",
    detailShardKey: "aa",
  };
}

function shard(input: {
  code: string;
  name: string;
  profiles: FundFamilyProfile[];
  directEdges?: DirectEdge[];
  indirectEdges?: QualifiedIndirectEdge[];
  directRejected?: number;
  indirectRejected?: number;
}): PortfolioShard {
  const directEdges = input.directEdges ?? [];
  const indirectEdges = input.indirectEdges ?? [];
  const directRejected = input.directRejected ?? 0;
  const indirectRejected = input.indirectRejected ?? 0;
  return {
    schemaVersion: "1",
    releaseId: "2026q2-fixture-release",
    report: "2026Q2",
    cutoffDate: "2026-06-30",
    generatedAt: "2026-08-28T00:00:00",
    stock: { code: input.code, name: input.name },
    fundProfiles: Object.fromEntries(
      input.profiles.map((item) => [item.fundFamilyKey, item]),
    ),
    directEdges,
    indirectEdges,
    coverage: {
      directInputRows: directEdges.length + directRejected,
      directPublishedEdges: directEdges.length,
      directIneligibleByReason:
        directRejected > 0 ? { non_positive_direct_ratio: directRejected } : {},
      indirectCandidateRows: indirectEdges.length + indirectRejected,
      qualifiedIndirectEdges: indirectEdges.length,
      ineligibleCandidateRows: indirectRejected,
      ineligibleByReason:
        indirectRejected > 0 ? { non_positive_leverage: indirectRejected } : {},
      unmappedNotCountedAsZero: DISCLOSURE,
    },
    integrity: { algorithm: "SHA-256", encoding: "UTF-8" },
  };
}

function direct(
  fund: FundFamilyProfile,
  targetCode: string,
  targetName: string,
  ratioPercent: number,
): DirectEdge {
  return {
    fundFamilyKey: fund.fundFamilyKey,
    targetCode,
    targetName,
    ratioPercent,
    isOnExchangeFund: fund.isOnExchangeFund,
  };
}

function indirect(
  fund: FundFamilyProfile,
  targetCode: string,
  targetName: string,
  sourceCode: string,
  sourceRatioPercent: number,
  estimatedRatioPercent: number,
  leverageMultiple = 2,
): QualifiedIndirectEdge {
  return {
    fundFamilyKey: fund.fundFamilyKey,
    targetCode,
    targetName,
    sourceCode,
    sourceName: sourceCode,
    sourceRatioPercent,
    leverageMultiple,
    estimatedRatioPercent,
    matchReason: "fixture mapping",
    isOnExchangeFund: fund.isOnExchangeFund,
  };
}

describe("aggregatePortfolioResults", () => {
  it("保留前十外直接命中并把两只股票的不同间接来源合计为 13.54%", () => {
    const rankEleven = profile("第十一名基金", "110011");
    const audited = profile("审计杠杆基金", "164212", true);
    const mixed = profile("直接与间接混合基金", "000001");
    const hynix = shard({
      code: "000660",
      name: "SK海力士",
      profiles: [rankEleven, audited, mixed],
      directEdges: [
        direct(rankEleven, "000660", "SK海力士", 1.2),
        direct(mixed, "000660", "SK海力士", 2.5),
      ],
      indirectEdges: [
        indirect(audited, "000660", "SK海力士", "7709.HK", 4.87, 9.74),
        // 防御性重复：同一 family/target/source 不得重复进入合计。
        indirect(audited, "000660", "SK海力士", "7709.HK", 4.87, 9.74),
        indirect(mixed, "000660", "SK海力士", "MIXED", 1, 2),
      ],
    });
    const samsung = shard({
      code: "005930",
      name: "三星电子",
      profiles: [audited],
      indirectEdges: [
        indirect(audited, "005930", "三星电子", "7711.HK", 1.9, 3.8),
      ],
    });

    const result = aggregatePortfolioResults({
      selectedStockCodes: ["000660", "005930"],
      shards: [hynix, samsung],
    });

    expect(result.offExchange.some((fund) => fund.fundFamilyKey === "第十一名基金")).toBe(true);
    const auditedResult = result.onExchange.find(
      (fund) => fund.fundFamilyKey === audited.fundFamilyKey,
    );
    expect(auditedResult?.directRatioPercent).toBe(0);
    expect(auditedResult?.indirectEstimatedRatioPercent).toBeCloseTo(13.54, 8);
    expect(auditedResult?.totalEstimatedExposurePercent).toBeCloseTo(13.54, 8);
    expect(auditedResult?.contributions.map((item) => item.targetCode)).toEqual([
      "000660",
      "005930",
    ]);

    const mixedResult = result.offExchange.find(
      (fund) => fund.fundFamilyKey === mixed.fundFamilyKey,
    );
    expect(mixedResult).toMatchObject({
      directRatioPercent: 2.5,
      indirectEstimatedRatioPercent: 2,
      totalEstimatedExposurePercent: 4.5,
    });
  });

  it("同一直接或间接键只取较高的确定性代表，不把来源占比再次相加", () => {
    const fund = profile("多份额基金", "000010");
    const input = shard({
      code: "NVDA",
      name: "英伟达",
      profiles: [fund],
      directEdges: [
        direct(fund, "NVDA", "英伟达", 3),
        direct(fund, "NVDA", "英伟达", 4),
      ],
      indirectEdges: [
        indirect(fund, "NVDA", "英伟达", "NVDL", 5, 10),
        indirect(fund, "NVDA", "英伟达", "NVDL", 6, 12),
        indirect(fund, "NVDA", "英伟达", "NVDU", 2, 4),
      ],
    });

    const result = aggregatePortfolioResults({
      selectedStockCodes: ["NVDA", "NVDA"],
      shards: [input],
    }).offExchange[0];

    expect(result.directRatioPercent).toBe(4);
    expect(result.indirectEstimatedRatioPercent).toBe(16);
    expect(result.totalEstimatedExposurePercent).toBe(20);
    expect(result.contributions[0]?.indirectSources).toHaveLength(2);
  });

  it("排除零负数和非有限边，并返回所选分片覆盖缺口而不伪装为 0%", () => {
    const fund = profile("非法候选基金", "000020");
    const invalid = shard({
      code: "TSM",
      name: "台积电",
      profiles: [fund],
      directEdges: [
        direct(fund, "TSM", "台积电", 0),
        direct(fund, "TSM", "台积电", -1),
        direct(fund, "TSM", "台积电", Number.POSITIVE_INFINITY),
      ],
      indirectEdges: [
        indirect(fund, "TSM", "台积电", "ZERO", 1, 0, 2),
        indirect(fund, "TSM", "台积电", "BAD-MULTIPLE", 1, 2, 0),
        indirect(fund, "TSM", "台积电", "INFINITE", 1, Number.POSITIVE_INFINITY),
        indirect(fund, "TSM", "台积电", "BAD-FORMULA", 1, 3, 2),
      ],
      directRejected: 2,
      indirectRejected: 3,
    });

    const result = aggregatePortfolioResults({
      selectedStockCodes: ["TSM"],
      shards: [invalid],
    });

    expect(result.offExchange).toEqual([]);
    expect(result.onExchange).toEqual([]);
    expect(result.coverage).toEqual({
      selectedStockCodes: ["TSM"],
      directExcludedRows: 2,
      ineligibleIndirectCandidateRows: 3,
      ineligibleByReason: { non_positive_leverage: 3 },
      hasSelectedIndirectCoverageLimit: true,
      disclosure: DISCLOSURE,
    });
  });

  it("两个视图互斥并按总暴露、直接暴露、基金代码稳定排序", () => {
    const codeFirst = profile("代码优先", "000001");
    const codeSecond = profile("代码次序", "000003");
    const lowerDirect = profile("直接较低", "000002");
    const exchange = profile("场内 ETF", "510300", true);
    const input = shard({
      code: "AAPL",
      name: "苹果",
      profiles: [codeFirst, codeSecond, lowerDirect, exchange],
      directEdges: [
        direct(codeFirst, "AAPL", "苹果", 3),
        direct(codeSecond, "AAPL", "苹果", 3),
        direct(lowerDirect, "AAPL", "苹果", 2),
        direct(exchange, "AAPL", "苹果", 1),
      ],
      indirectEdges: [
        indirect(codeFirst, "AAPL", "苹果", "S1", 1, 2),
        indirect(codeSecond, "AAPL", "苹果", "S2", 1, 2),
        indirect(lowerDirect, "AAPL", "苹果", "S3", 1, 3),
      ],
    });

    const result = aggregatePortfolioResults({
      selectedStockCodes: ["AAPL"],
      shards: [input],
    });

    expect(result.offExchange.map((fund) => fund.fundCode)).toEqual([
      "000001",
      "000003",
      "000002",
    ]);
    expect(result.onExchange.map((fund) => fund.fundCode)).toEqual(["510300"]);
    expect(
      result.offExchange.some((fund) =>
        result.onExchange.some((other) => other.fundFamilyKey === fund.fundFamilyKey),
      ),
    ).toBe(false);
  });
});
