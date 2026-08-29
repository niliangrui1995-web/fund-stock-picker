import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { validateConcentrationPackage } from "../validateConcentrationPackage";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const payloadPath = resolve(projectRoot, "public", "data", "trading-concentration-dashboard.json");
const manifestPath = resolve(projectRoot, "public", "data", "trading-concentration-dashboard.manifest.json");

describe("已发布交易集中度数据包", () => {
  it("通过 SHA、C5 和分段校验", async () => {
    const [payloadText, manifestText] = await Promise.all([
      readFile(payloadPath, "utf8"),
      readFile(manifestPath, "utf8"),
    ]);
    const result = await validateConcentrationPackage(payloadText, manifestText);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.records.length).toBeGreaterThan(3000);
    expect((result.payload.records[0]?.date ?? "") >= "2013-01-01").toBe(true);
    expect(result.payload.records[result.payload.records.length - 1]?.date).toBe(result.manifest.data_range.end);
    expect(result.payload.records.some((record) => record.date === "2016-01-26" && record.denominator_source === "sh880005")).toBe(true);
    expect(result.payload.records.some((record) => record.date === "2022-08-02" && record.numerator_scope === "sh_sz_bj_active_a")).toBe(true);
    expect(result.payload.records.some((record) => record.chinext_close !== null && record.chinext_close > 0)).toBe(true);
    expect(result.manifest.comparison_index_input.code).toBe("399006");
    expect(result.manifest.raw_data_copied).toBe(false);
  });
});
