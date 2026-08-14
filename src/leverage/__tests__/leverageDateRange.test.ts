import { describe, expect, it } from "vitest";

import { resolveLeverageDateRange } from "../leverageDateRange";
import { fixtureRecords } from "./fixtures";

describe("resolveLeverageDateRange", () => {
  it("手动起止日期覆盖预设，并把区间原样交给派生层以重新确定共同基期", () => {
    expect(
      resolveLeverageDateRange({
        records: fixtureRecords,
        period: "custom",
        customRange: { startDate: "2017-01-03", endDate: "2017-01-03" },
      }),
    ).toEqual({ startDate: "2017-01-03", endDate: "2017-01-03" });
  });

  it("点击预设时使用记录范围而不是遗留的手动日期", () => {
    expect(
      resolveLeverageDateRange({
        records: fixtureRecords,
        period: "all",
        customRange: { startDate: "2017-01-03", endDate: "2017-01-03" },
      }),
    ).toEqual({ startDate: "2011-08-03", endDate: "2017-01-03" });
  });
});
