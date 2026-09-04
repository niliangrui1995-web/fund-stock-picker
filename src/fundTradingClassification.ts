import overrides from "../config/fund-trading-overrides.json";

const classifications = new Map(overrides.funds.map((fund) => [fund.fundFamilyKey, fund.isOnExchangeFund]));

/** Only exact officially reviewed fund families override the generated trading view. */
export function getVerifiedFundTradingClassification(fundFamilyKey: string): boolean | undefined {
  return classifications.get(fundFamilyKey);
}
