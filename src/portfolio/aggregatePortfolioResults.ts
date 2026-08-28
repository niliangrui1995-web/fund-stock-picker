import type {
  AggregatedFundResult,
  AggregatedPortfolioResults,
  DirectEdge,
  FundFamilyProfile,
  PortfolioContribution,
  PortfolioShard,
  QualifiedIndirectEdge,
  ReasonCountMap,
} from "./types";

const FORMULA_TOLERANCE = 0.005000001;

interface MutableContribution {
  targetCode: string;
  targetName: string;
  directRatioPercent: number;
  indirectEstimatedRatioPercent: number;
  indirectSources: QualifiedIndirectEdge[];
}

interface MutableAggregate {
  profile: FundFamilyProfile;
  directRatioPercent: number;
  indirectEstimatedRatioPercent: number;
  contributions: Map<string, MutableContribution>;
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function addReasonCounts(target: ReasonCountMap, source: ReasonCountMap) {
  for (const [reason, count] of Object.entries(source)) {
    if (Number.isInteger(count) && count >= 0) {
      target[reason] = (target[reason] ?? 0) + count;
    }
  }
}

function betterDirect(current: DirectEdge | undefined, candidate: DirectEdge): DirectEdge {
  return current === undefined || candidate.ratioPercent > current.ratioPercent
    ? candidate
    : current;
}

function betterIndirect(
  current: QualifiedIndirectEdge | undefined,
  candidate: QualifiedIndirectEdge,
): QualifiedIndirectEdge {
  if (current === undefined) return candidate;
  if (candidate.estimatedRatioPercent !== current.estimatedRatioPercent) {
    return candidate.estimatedRatioPercent > current.estimatedRatioPercent
      ? candidate
      : current;
  }
  if (candidate.sourceRatioPercent !== current.sourceRatioPercent) {
    return candidate.sourceRatioPercent > current.sourceRatioPercent
      ? candidate
      : current;
  }
  return current;
}

function eligibleDirect(edge: DirectEdge, selectedCodes: Set<string>): boolean {
  return selectedCodes.has(edge.targetCode) && isPositiveFinite(edge.ratioPercent);
}

function eligibleIndirect(
  edge: QualifiedIndirectEdge,
  selectedCodes: Set<string>,
): boolean {
  return (
    selectedCodes.has(edge.targetCode) &&
    edge.sourceCode.trim().length > 0 &&
    edge.sourceName.trim().length > 0 &&
    edge.targetCode.trim().length > 0 &&
    isPositiveFinite(edge.sourceRatioPercent) &&
    isPositiveFinite(edge.leverageMultiple) &&
    isPositiveFinite(edge.estimatedRatioPercent) &&
    Math.abs(
      edge.sourceRatioPercent * edge.leverageMultiple -
        edge.estimatedRatioPercent,
    ) <= FORMULA_TOLERANCE
  );
}

function directKey(edge: DirectEdge): string {
  return `${edge.fundFamilyKey}\u0000${edge.targetCode}`;
}

function indirectKey(edge: QualifiedIndirectEdge): string {
  return `${edge.fundFamilyKey}\u0000${edge.targetCode}\u0000${edge.sourceCode}`;
}

function contributionFor(
  aggregate: MutableAggregate,
  targetCode: string,
  targetName: string,
): MutableContribution {
  const current = aggregate.contributions.get(targetCode);
  if (current !== undefined) return current;
  const created: MutableContribution = {
    targetCode,
    targetName,
    directRatioPercent: 0,
    indirectEstimatedRatioPercent: 0,
    indirectSources: [],
  };
  aggregate.contributions.set(targetCode, created);
  return created;
}

function ensureAggregate(
  aggregates: Map<string, MutableAggregate>,
  profile: FundFamilyProfile,
): MutableAggregate {
  const current = aggregates.get(profile.fundFamilyKey);
  if (current !== undefined) return current;
  const created: MutableAggregate = {
    profile,
    directRatioPercent: 0,
    indirectEstimatedRatioPercent: 0,
    contributions: new Map(),
  };
  aggregates.set(profile.fundFamilyKey, created);
  return created;
}

function toResult(
  aggregate: MutableAggregate,
  selectedStockCodes: string[],
): AggregatedFundResult {
  const contributions: PortfolioContribution[] = selectedStockCodes.flatMap((code) => {
    const contribution = aggregate.contributions.get(code);
    if (
      contribution === undefined ||
      (contribution.directRatioPercent <= 0 &&
        contribution.indirectEstimatedRatioPercent <= 0)
    ) {
      return [];
    }
    return [{
      ...contribution,
      indirectSources: [...contribution.indirectSources],
    }];
  });
  return {
    ...aggregate.profile,
    directRatioPercent: aggregate.directRatioPercent,
    indirectEstimatedRatioPercent: aggregate.indirectEstimatedRatioPercent,
    totalEstimatedExposurePercent:
      aggregate.directRatioPercent + aggregate.indirectEstimatedRatioPercent,
    contributions,
  };
}

function sortResults(rows: AggregatedFundResult[]) {
  rows.sort((left, right) =>
    right.totalEstimatedExposurePercent - left.totalEstimatedExposurePercent ||
    right.directRatioPercent - left.directRatioPercent ||
    left.fundCode.localeCompare(right.fundCode, "en"),
  );
}

export function aggregatePortfolioResults(input: {
  selectedStockCodes: string[];
  shards: PortfolioShard[];
}): AggregatedPortfolioResults {
  const selectedStockCodes = [...new Set(input.selectedStockCodes)];
  const selectedCodes = new Set(selectedStockCodes);
  const profiles = new Map<string, FundFamilyProfile>();
  const directRepresentatives = new Map<string, DirectEdge>();
  const indirectRepresentatives = new Map<string, QualifiedIndirectEdge>();
  const ineligibleByReason: ReasonCountMap = {};
  let directExcludedRows = 0;
  let ineligibleIndirectCandidateRows = 0;
  let disclosure = "未映射或不合格的间接产品不按 0% 计入。";

  for (const shard of input.shards) {
    if (!selectedCodes.has(shard.stock.code)) continue;
    for (const [familyKey, profile] of Object.entries(shard.fundProfiles)) {
      profiles.set(familyKey, profile);
    }
    for (const edge of shard.directEdges) {
      if (!eligibleDirect(edge, selectedCodes)) continue;
      const key = directKey(edge);
      directRepresentatives.set(
        key,
        betterDirect(directRepresentatives.get(key), edge),
      );
    }
    for (const edge of shard.indirectEdges) {
      if (!eligibleIndirect(edge, selectedCodes)) continue;
      const key = indirectKey(edge);
      indirectRepresentatives.set(
        key,
        betterIndirect(indirectRepresentatives.get(key), edge),
      );
    }
    directExcludedRows += Object.values(shard.coverage.directIneligibleByReason)
      .filter((count) => Number.isInteger(count) && count >= 0)
      .reduce((total, count) => total + count, 0);
    if (
      Number.isInteger(shard.coverage.ineligibleCandidateRows) &&
      shard.coverage.ineligibleCandidateRows >= 0
    ) {
      ineligibleIndirectCandidateRows += shard.coverage.ineligibleCandidateRows;
    }
    addReasonCounts(ineligibleByReason, shard.coverage.ineligibleByReason);
    if (shard.coverage.unmappedNotCountedAsZero.trim().length > 0) {
      disclosure = shard.coverage.unmappedNotCountedAsZero;
    }
  }

  const aggregates = new Map<string, MutableAggregate>();
  for (const edge of directRepresentatives.values()) {
    const profile = profiles.get(edge.fundFamilyKey);
    if (profile === undefined) continue;
    const aggregate = ensureAggregate(aggregates, profile);
    aggregate.directRatioPercent += edge.ratioPercent;
    contributionFor(aggregate, edge.targetCode, edge.targetName).directRatioPercent +=
      edge.ratioPercent;
  }
  for (const edge of indirectRepresentatives.values()) {
    const profile = profiles.get(edge.fundFamilyKey);
    if (profile === undefined) continue;
    const aggregate = ensureAggregate(aggregates, profile);
    aggregate.indirectEstimatedRatioPercent += edge.estimatedRatioPercent;
    const contribution = contributionFor(
      aggregate,
      edge.targetCode,
      edge.targetName,
    );
    contribution.indirectEstimatedRatioPercent += edge.estimatedRatioPercent;
    contribution.indirectSources.push(edge);
  }

  const offExchange: AggregatedFundResult[] = [];
  const onExchange: AggregatedFundResult[] = [];
  for (const aggregate of aggregates.values()) {
    if (
      aggregate.directRatioPercent <= 0 &&
      aggregate.indirectEstimatedRatioPercent <= 0
    ) {
      continue;
    }
    const result = toResult(aggregate, selectedStockCodes);
    (aggregate.profile.isOnExchangeFund ? onExchange : offExchange).push(result);
  }
  sortResults(offExchange);
  sortResults(onExchange);

  return {
    offExchange,
    onExchange,
    coverage: {
      selectedStockCodes,
      directExcludedRows,
      ineligibleIndirectCandidateRows,
      ineligibleByReason,
      hasSelectedIndirectCoverageLimit: ineligibleIndirectCandidateRows > 0,
      disclosure,
    },
  };
}
