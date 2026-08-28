export type PortfolioView = "offExchange" | "onExchange";

export interface BasketDraft {
  name: string;
  stockCodes: string[];
}

export interface SavedBasket extends BasketDraft {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioStoreV1 {
  schemaVersion: 1;
  activeBasketId: string | null;
  baskets: SavedBasket[];
}

export type BasketValidationResult =
  | { ok: true; value: BasketDraft }
  | { ok: false; reason: string };

export type PortfolioStorageReadResult =
  | { kind: "ready"; store: PortfolioStoreV1 }
  | { kind: "recovered"; store: PortfolioStoreV1; reason: string }
  | { kind: "unavailable"; store: PortfolioStoreV1; reason: string };

export type PortfolioStorageWriteResult =
  | { ok: true }
  | { ok: false; reason: string };

export interface FundFamilyProfile {
  fundFamilyKey: string;
  fundCode: string;
  fundName: string;
  fundDisplayName: string;
  fundType: string;
  fundVariantCodes: string[];
  isOnExchangeFund: boolean;
  view: PortfolioView;
  detailShardKey: string;
}

export interface DirectEdge {
  fundFamilyKey: string;
  targetCode: string;
  targetName: string;
  ratioPercent: number;
  isOnExchangeFund: boolean;
}

export interface QualifiedIndirectEdge {
  fundFamilyKey: string;
  targetCode: string;
  targetName: string;
  sourceCode: string;
  sourceName: string;
  sourceRatioPercent: number;
  leverageMultiple: number;
  estimatedRatioPercent: number;
  matchReason: string;
  isOnExchangeFund: boolean;
}

export interface PortfolioFundHoldingDetail {
  rank: number;
  stockCode: string;
  stockName: string;
  ratio?: number;
  ratioPercent: number;
  marketValueWan?: number | null;
  sharesWan?: number;
}

export interface AvailablePortfolioDetailRecord {
  fundFamilyKey: string;
  detailStatus: "available";
  detailFundCode: string;
  detailMessage?: never;
  holdings: [PortfolioFundHoldingDetail, ...PortfolioFundHoldingDetail[]];
}

export interface NotCapturedPortfolioDetailRecord {
  fundFamilyKey: string;
  detailStatus: "not_captured_in_current_stock_detail_rows";
  detailFundCode?: never;
  detailMessage: string;
  holdings?: never;
}

export type PortfolioDetailRecord =
  | AvailablePortfolioDetailRecord
  | NotCapturedPortfolioDetailRecord;

export interface PortfolioDetailShard {
  schemaVersion: "1";
  releaseId: string;
  report: string;
  cutoffDate: string;
  generatedAt: string;
  fundFamilyKeyHashPrefix: string;
  fundDetails: Record<string, PortfolioDetailRecord>;
  integrity: { algorithm: "SHA-256"; encoding: "UTF-8" };
}

export type ReasonCountMap = Record<string, number>;

export interface PortfolioShardCoverage {
  directIneligibleByReason: ReasonCountMap;
  directInputRows: number;
  directPublishedEdges: number;
  indirectCandidateRows: number;
  ineligibleByReason: ReasonCountMap;
  ineligibleCandidateRows: number;
  qualifiedIndirectEdges: number;
  unmappedNotCountedAsZero: string;
}

export interface PortfolioManifestCoverage {
  directIneligibleByReason: ReasonCountMap;
  directInputRows: number;
  directPublishedEdges: number;
  fundDetailAvailableFamilyCount: number;
  fundDetailFamilyCount: number;
  fundDetailNotCapturedFamilyCount: number;
  fundDetailShardCount: number;
  indirectCandidateRows: number;
  ineligibleByReason: ReasonCountMap;
  qualifiedIndirectEdges: number;
  stockShardCount: number;
  unmappedByReason: ReasonCountMap;
  unmappedCandidateRows: number;
  unmappedNotCountedAsZero: string;
}

export interface PortfolioShard {
  schemaVersion: "1";
  releaseId: string;
  report: string;
  cutoffDate: string;
  generatedAt: string;
  stock: { code: string; name: string };
  fundProfiles: Record<string, FundFamilyProfile>;
  directEdges: DirectEdge[];
  indirectEdges: QualifiedIndirectEdge[];
  coverage: PortfolioShardCoverage;
  integrity: { algorithm: "SHA-256"; encoding: "UTF-8" };
}

export interface PortfolioManifestShard {
  path: string;
  sha256: string;
  directEdgeCount: number;
  qualifiedIndirectEdgeCount: number;
}

export interface PortfolioDetailManifestShard {
  path: string;
  sha256: string;
  fundFamilyCount: number;
}

export interface PortfolioManifest {
  schemaVersion: "1";
  releaseId: string;
  report: string;
  cutoffDate: string;
  generatedAt: string;
  builderVersion: string;
  fundFamilyRuleVersion: string;
  viewClassificationRuleVersion: string;
  publishStatus: "complete";
  inputHoldingRows: number;
  source: string;
  sourceFile: string;
  fundInvestmentSourceFile: string;
  fundInvestmentSourceRows: number;
  disclosure: string;
  auditPath: string;
  fundDetailShardRule: string;
  fundDetailDisplayLimit: 10;
  coverage: PortfolioManifestCoverage;
  shards: Record<string, PortfolioManifestShard>;
  fundDetailShards: Record<string, PortfolioDetailManifestShard>;
}

export interface PortfolioContribution {
  targetCode: string;
  targetName: string;
  directRatioPercent: number;
  indirectEstimatedRatioPercent: number;
  indirectSources: QualifiedIndirectEdge[];
}

export interface AggregatedFundResult extends FundFamilyProfile {
  directRatioPercent: number;
  indirectEstimatedRatioPercent: number;
  totalEstimatedExposurePercent: number;
  contributions: PortfolioContribution[];
}

export interface PortfolioSelectedCoverage {
  selectedStockCodes: string[];
  directExcludedRows: number;
  ineligibleIndirectCandidateRows: number;
  ineligibleByReason: ReasonCountMap;
  hasSelectedIndirectCoverageLimit: boolean;
  disclosure: string;
}

export interface AggregatedPortfolioResults {
  offExchange: AggregatedFundResult[];
  onExchange: AggregatedFundResult[];
  coverage: PortfolioSelectedCoverage;
}
