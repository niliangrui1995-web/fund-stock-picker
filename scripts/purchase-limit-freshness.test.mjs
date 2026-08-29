import assert from "node:assert/strict";
import test from "node:test";

import { evaluatePurchaseLimitSnapshotFreshness } from "./purchase-limit-freshness.mjs";

test("按实际核验日计算购买限额快照年龄", () => {
  const result = evaluatePurchaseLimitSnapshotFreshness(
    { purchaseLimitFetchedAt: "2026-01-10 09:30:00" },
    { verificationDate: "2026-01-15" },
  );

  assert.equal(result.status, "warn");
  assert.equal(result.ageDays, 5);
  assert.equal(result.asOfDate, "2026-01-15");
});

test("默认核验日使用运行环境的本地日历日", (context) => {
  context.mock.timers.enable({
    apis: ["Date"],
    now: new Date(2026, 7, 30, 0, 30, 0),
  });

  const result = evaluatePurchaseLimitSnapshotFreshness({
    purchaseLimitFetchedAt: "2026-08-30 00:15:00",
  });

  assert.equal(result.status, "ok");
  assert.equal(result.ageDays, 0);
  assert.equal(result.asOfDate, "2026-08-30");
});

test("拒绝晚于实际核验日的未来快照", () => {
  const result = evaluatePurchaseLimitSnapshotFreshness(
    { purchaseLimitFetchedAt: "2026-01-16 09:30:00" },
    { verificationDate: "2026-01-15" },
  );

  assert.equal(result.status, "fail");
  assert.equal(result.passed, false);
  assert.equal(result.reasonCode, "future_snapshot");
});

test("购买限额快照在 4/5/9/10 天边界切换 ok、warn、fail", () => {
  const statusAtAge = (ageDays) => evaluatePurchaseLimitSnapshotFreshness(
    { purchaseLimitFetchedAt: "2026-01-01 09:30:00" },
    { verificationDate: `2026-01-${String(ageDays + 1).padStart(2, "0")}` },
  ).status;

  assert.equal(statusAtAge(4), "ok");
  assert.equal(statusAtAge(5), "warn");
  assert.equal(statusAtAge(9), "warn");
  assert.equal(statusAtAge(10), "fail");
});
