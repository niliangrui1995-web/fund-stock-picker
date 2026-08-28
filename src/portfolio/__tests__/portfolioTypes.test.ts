import { describe, expect, expectTypeOf, it } from "vitest";

import type {
  PortfolioDetailRecord,
  PortfolioFundHoldingDetail,
  PortfolioManifestCoverage,
  PortfolioShardCoverage,
} from "../types";

const holding: PortfolioFundHoldingDetail = {
  rank: 1,
  stockCode: "NVDA",
  stockName: "英伟达",
  ratioPercent: 8.5,
};

const availableDetail: PortfolioDetailRecord = {
  fundFamilyKey: "基金家族",
  detailStatus: "available",
  detailFundCode: "000001",
  holdings: [holding],
};

const notCapturedDetail: PortfolioDetailRecord = {
  fundFamilyKey: "基金家族",
  detailStatus: "not_captured_in_current_stock_detail_rows",
  detailMessage: "当前已采集股票明细未包含该基金详情。",
};

const shardCoverage: PortfolioShardCoverage = {
  directIneligibleByReason: { non_positive_direct_ratio: 1 },
  directInputRows: 3,
  directPublishedEdges: 2,
  indirectCandidateRows: 1,
  ineligibleByReason: {},
  ineligibleCandidateRows: 0,
  qualifiedIndirectEdges: 1,
  unmappedNotCountedAsZero: "未映射或不合格的间接产品不按 0% 计入。",
};

const manifestCoverage: PortfolioManifestCoverage = {
  directIneligibleByReason: { non_positive_direct_ratio: 1 },
  directInputRows: 3,
  directPublishedEdges: 2,
  fundDetailAvailableFamilyCount: 1,
  fundDetailFamilyCount: 1,
  fundDetailNotCapturedFamilyCount: 0,
  fundDetailShardCount: 1,
  indirectCandidateRows: 1,
  ineligibleByReason: {},
  qualifiedIndirectEdges: 1,
  stockShardCount: 1,
  unmappedByReason: { ignored_product: 1 },
  unmappedCandidateRows: 1,
  unmappedNotCountedAsZero: "未映射或不合格的间接产品不按 0% 计入。",
};

// 这些用例必须在编译期失败，防止加载器将“未采集”渲染成空持仓。
// @ts-expect-error available 详情必须含 detailFundCode 和至少一条 holding。
const missingAvailablePayload: PortfolioDetailRecord = {
  fundFamilyKey: "基金家族",
  detailStatus: "available",
};

const notCapturedWithHoldings: PortfolioDetailRecord = {
  fundFamilyKey: "基金家族",
  detailStatus: "not_captured_in_current_stock_detail_rows",
  detailMessage: "未采集。",
  // @ts-expect-error not_captured 详情不得携带 holdings。
  holdings: [holding],
};

// @ts-expect-error 详情持仓排名是发布包中的必填字段。
const holdingWithoutRank: PortfolioFundHoldingDetail = {
  stockCode: "NVDA",
  stockName: "英伟达",
  ratioPercent: 8.5,
};

// @ts-expect-error 分片 coverage 不得遗漏固定字段。
const incompleteShardCoverage: PortfolioShardCoverage = {
  directIneligibleByReason: {},
  directInputRows: 0,
  directPublishedEdges: 0,
  indirectCandidateRows: 0,
  ineligibleByReason: {},
  ineligibleCandidateRows: 0,
  qualifiedIndirectEdges: 0,
};

const manifestCoverageWithShardOnlyField: PortfolioManifestCoverage = {
  ...manifestCoverage,
  // @ts-expect-error manifest 不包含仅属于股票分片的 ineligibleCandidateRows。
  ineligibleCandidateRows: 0,
};

describe("portfolio wire types", () => {
  it("将可用与未采集详情收窄为互斥状态", () => {
    expect(availableDetail.detailStatus).toBe("available");
    expect(notCapturedDetail.detailStatus).toBe(
      "not_captured_in_current_stock_detail_rows",
    );
    expect(manifestCoverage.stockShardCount).toBe(1);
    expectTypeOf(availableDetail).toMatchTypeOf<PortfolioDetailRecord>();
  });
});

void missingAvailablePayload;
void notCapturedWithHoldings;
void holdingWithoutRank;
void incompleteShardCoverage;
void manifestCoverageWithShardOnlyField;
