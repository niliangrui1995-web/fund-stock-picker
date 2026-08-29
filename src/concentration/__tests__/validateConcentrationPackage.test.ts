import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { validateConcentrationPackage } from "../validateConcentrationPackage";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const payloadPath = resolve(projectRoot, "public", "data", "trading-concentration-dashboard.json");
const manifestPath = resolve(projectRoot, "public", "data", "trading-concentration-dashboard.manifest.json");

describe("交易集中度前端发布包校验器", () => {
  it("拒绝被篡改的 SHA", async () => {
    const [payloadText, manifestText] = await Promise.all([
      readFile(payloadPath, "utf8"),
      readFile(manifestPath, "utf8"),
    ]);
    const manifest = JSON.parse(manifestText) as Record<string, unknown>;
    manifest.payload_sha256 = "0".repeat(64);

    await expect(validateConcentrationPackage(payloadText, JSON.stringify(manifest))).resolves.toMatchObject({
      ok: false,
      reason: "交易集中度发布包 SHA-256 校验失败。",
    });
  });

  it("拒绝与切换日期不一致的分子范围", async () => {
    const [payloadText, manifestText] = await Promise.all([
      readFile(payloadPath, "utf8"),
      readFile(manifestPath, "utf8"),
    ]);
    const payload = JSON.parse(payloadText) as { records: Array<Record<string, unknown>> };
    const record = payload.records.find((item) => item.date === "2022-08-02");
    if (!record) {
      throw new Error("测试数据缺少北交所纳入日。");
    }
    record.numerator_scope = "sh_sz_active_a";

    await expect(validateConcentrationPackage(JSON.stringify(payload), manifestText)).resolves.toMatchObject({
      ok: false,
      reason: expect.stringContaining("北交所纳入口径不一致"),
    });
  });

  it("拒绝无效的创业板指收盘价", async () => {
    const [payloadText, manifestText] = await Promise.all([
      readFile(payloadPath, "utf8"),
      readFile(manifestPath, "utf8"),
    ]);
    const payload = JSON.parse(payloadText) as { records: Array<Record<string, unknown>> };
    const record = payload.records[0];
    if (!record) {
      throw new Error("测试数据缺少首条记录。");
    }
    record.chinext_close = 0;

    await expect(validateConcentrationPackage(JSON.stringify(payload), manifestText)).resolves.toMatchObject({
      ok: false,
      reason: expect.stringContaining("chinext_close 无效"),
    });
  });
});
