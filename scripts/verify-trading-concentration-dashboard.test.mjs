import assert from "node:assert/strict";
import test from "node:test";

import { verifyTradingConcentrationDashboard } from "./verify-trading-concentration-dashboard.mjs";

test("已发布交易集中度数据包满足 SHA、分段和 C5 反算契约", async () => {
  const result = await verifyTradingConcentrationDashboard();
  assert.ok(result.records > 3000);
  assert.ok(result.start >= "2013-01-01");
  assert.ok(result.end >= result.start);
  assert.match(result.payloadSha256, /^[a-f0-9]{64}$/);
});
