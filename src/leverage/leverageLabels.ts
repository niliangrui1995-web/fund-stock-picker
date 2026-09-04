import type { LeverageIndexCode, LeverageMetric } from "./types";

export const LEVERAGE_METRIC_LABELS: Record<LeverageMetric, string> = {
  margin: "融资余额",
  ratio: "融资余额占市值",
};

export const LEVERAGE_INDEX_LABELS: Record<LeverageIndexCode, string> = {
  "000001": "上证指数",
  "399106": "深证综指",
  "399006": "创业板指",
};

export const LEVERAGE_INDEX_COLORS: Record<LeverageIndexCode, string> = {
  "000001": "#4757c8",
  "399106": "#1c9f8a",
  "399006": "#d98633",
};
