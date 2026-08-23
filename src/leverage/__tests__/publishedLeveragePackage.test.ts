import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { validateLeveragePackage } from "../validateLeveragePackage";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const payloadPath = resolve(projectRoot, "public", "data", "leverage-dashboard.json");
const manifestPath = resolve(projectRoot, "public", "data", "leverage-dashboard.manifest.json");

describe("已发布两融数据包", () => {
  it("接受完整 DFCF 审计、前段官方或妙想厂商链，以及 2017 年后厂商市值分段", async () => {
    const [payloadText, manifestText] = await Promise.all([
      readFile(payloadPath, "utf8"),
      readFile(manifestPath, "utf8"),
    ]);
    const result = await validateLeveragePackage(payloadText, manifestText);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const pre2017Records = result.payload.records.filter((record) => record.date < "2017-01-03");
    const post2017Records = result.payload.records.filter((record) => record.date >= "2017-01-03");
    const allNonNullRatioRecords = result.payload.records.filter((record) => record.ratio_pct !== null);
    const nonNullRatioRecords = post2017Records.filter((record) => record.ratio_pct !== null);
    const officialPre2017 = pre2017Records.every(
      (record) =>
        record.market_cap_source === "official_exchange_pre2017_raw_chain_audited" &&
        record.market_cap_review_status === "official_exchange_pre2017_raw_chain_audited",
    );
    const mxPre2017 = pre2017Records.every(
      (record) =>
        record.market_cap_source === "mx_pre2017_vendor_unverified" &&
        record.market_cap_review_status === "mx_vendor_unverified",
    );

    expect(result.payload.records[0]?.date).toBe("2011-08-03");
    if (officialPre2017 || mxPre2017) {
      expect(pre2017Records.every((record) =>
        record.denominator_market_cap_yi !== null &&
        record.denominator_market_cap_yi > 0 &&
        record.ratio_pct !== null,
      )).toBe(true);
      expect(result.payload.provenance.ratio_data_range).toEqual({
        start: "2011-08-03",
        end: allNonNullRatioRecords[allNonNullRatioRecords.length - 1]?.date,
      });
      if (officialPre2017) {
        expect(result.manifest.market_cap.official_pre2017).toMatchObject({
          available: true,
          raw_chain_status: "pass",
          financial_evidence_audit: {
            applicable: false,
            status: "N/A",
            reason_code: "UNSUPPORTED_RATIO_CONTRACT",
          },
        });
      } else {
        expect(result.manifest.market_cap.mx_pre2017).toMatchObject({
          available: true,
          date_contract_status: "pass",
          financial_evidence_audit: {
            applicable: false,
            status: "N/A",
            reason_code: "UNSUPPORTED_RATIO_CONTRACT",
          },
        });
        expect(result.manifest.market_cap.official_pre2017).toBeUndefined();
      }
    } else {
      expect(pre2017Records.every((record) => record.ratio_pct === null)).toBe(true);
    }
    expect(nonNullRatioRecords.length).toBeGreaterThan(0);
    expect(
      post2017Records.every((record) => {
        if (record.ratio_pct === null) {
          return (
            record.denominator_market_cap_yi === null &&
            record.market_cap_source === "eastmoney_post2017_vendor_unverified" &&
            record.market_cap_review_status === "unavailable"
          );
        }

        return (
          record.denominator_market_cap_yi !== null &&
          record.denominator_market_cap_yi > 0 &&
          record.market_cap_source === "eastmoney_post2017_vendor_unverified" &&
          record.market_cap_review_status === "eastmoney_vendor_unverified"
        );
      }),
    ).toBe(true);
    if (!officialPre2017 && !mxPre2017) {
      expect(result.payload.provenance.ratio_data_range).toEqual({
        start: nonNullRatioRecords[0]?.date,
        end: nonNullRatioRecords[nonNullRatioRecords.length - 1]?.date,
      });
    }
    expect(result.manifest.market_cap.ratio_missing_records).toBe(
      result.payload.records.length - allNonNullRatioRecords.length,
    );
    expect(result.manifest.market_cap.reporting_eligible).toBe(false);
  });
});
