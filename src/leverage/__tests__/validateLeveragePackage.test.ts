import { describe, expect, it } from "vitest";

import {
  makeManifestWithDfcfFlags,
  makeManifestWithPayloadHash,
  makeMxPre2017ManifestText,
  makeMxPre2017PayloadText,
  makeMxPre2017UnavailableManifestText,
  makeMxPre2017UnavailablePayloadText,
  makeOfficialPre2017ManifestText,
  makeOfficialPre2017PayloadText,
  makeOfficialPre2017UnavailableManifestText,
  makeOfficialPre2017UnavailablePayloadText,
  makeManifestWithRatioUnavailable,
  makePayloadWithRatio,
  makeValidManifestText,
  makeValidPayloadText,
  sha256,
} from "./fixtures";
import { validateLeveragePackage } from "../validateLeveragePackage";

type JsonObject = Record<string, any>;

function parseObject(text: string): JsonObject {
  return JSON.parse(text) as JsonObject;
}

function packageWith(
  mutatePayload?: (payload: JsonObject) => void,
  mutateManifest?: (manifest: JsonObject) => void,
) {
  const payload = parseObject(makeValidPayloadText());
  mutatePayload?.(payload);
  const payloadText = JSON.stringify(payload);
  const manifest = parseObject(makeValidManifestText(payloadText));
  mutateManifest?.(manifest);
  return { payloadText, manifestText: JSON.stringify(manifest) };
}

describe("validateLeveragePackage", () => {
  it("接受 DFCF 标记、哈希和分段比例口径均有效的发布包", async () => {
    const result = await validateLeveragePackage(
      makeValidPayloadText(),
      makeValidManifestText(),
    );

    expect(result.ok).toBe(true);
  });

  it("接受 2011–2016 官方原始链已审计分母，并将比例起点前移至同日 DFCF 记录", async () => {
    const payloadText = makeOfficialPre2017PayloadText();
    const result = await validateLeveragePackage(
      payloadText,
      makeOfficialPre2017ManifestText(payloadText),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.payload.provenance.ratio_data_range).toEqual({
      start: "2011-08-03",
      end: "2017-01-03",
    });
    expect(result.payload.records[0]).toMatchObject({
      market_cap_source: "official_exchange_pre2017_raw_chain_audited",
      market_cap_review_status: "official_exchange_pre2017_raw_chain_audited",
      denominator_market_cap_yi: 10000,
      ratio_pct: 1.8,
    });
  });

  it("接受 2011–2016 东方财富妙想厂商前段，并保留未审计标识", async () => {
    const payloadText = makeMxPre2017PayloadText();
    const result = await validateLeveragePackage(
      payloadText,
      makeMxPre2017ManifestText(payloadText),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.payload.records[0]).toMatchObject({
      market_cap_source: "mx_pre2017_vendor_unverified",
      market_cap_review_status: "mx_vendor_unverified",
      denominator_market_cap_yi: 10000,
      ratio_pct: 1.8,
    });
  });

  it("拒绝伪造为可用的东方财富妙想前段元数据", async () => {
    const payloadText = makeMxPre2017PayloadText();
    const manifest = parseObject(makeMxPre2017ManifestText(payloadText));
    manifest.market_cap.mx_pre2017.date_contract_status = "blocked";

    await expect(
      validateLeveragePackage(payloadText, JSON.stringify(manifest)),
    ).resolves.toEqual({ ok: false, reason: "比例未审计口径提示无效。" });
  });

  it("接受妙想前段暂缺且后段 Choice 比例仍可用的发布包", async () => {
    const payloadText = makeMxPre2017UnavailablePayloadText();
    const result = await validateLeveragePackage(
      payloadText,
      makeMxPre2017UnavailableManifestText(payloadText),
    );

    expect(result.ok).toBe(true);
  });

  it("拒绝伪造为已审计的前段原始链元数据", async () => {
    const payload = parseObject(makeOfficialPre2017PayloadText());
    const payloadText = JSON.stringify(payload);
    const manifest = parseObject(makeOfficialPre2017ManifestText(payloadText));
    manifest.market_cap.official_pre2017.raw_chain_status = "blocked";

    await expect(
      validateLeveragePackage(payloadText, JSON.stringify(manifest)),
    ).resolves.toEqual({ ok: false, reason: "比例未审计口径提示无效。" });
  });

  it("拒绝官方前段混入不可用来源，即使哈希与元数据已重算", async () => {
    const payload = parseObject(makeOfficialPre2017PayloadText());
    const changed = payload.records.find(
      (record: JsonObject) => record.date === "2016-12-30",
    );
    if (changed === undefined) {
      throw new Error("测试夹具缺少 2016-12-30 官方前段记录。");
    }
    changed.denominator_market_cap_yi = null;
    changed.market_cap_source = "pre2017_official_unavailable";
    changed.market_cap_review_status = "unavailable";
    changed.ratio_pct = null;
    const payloadText = JSON.stringify(payload);
    const manifest = makeOfficialPre2017ManifestText(payloadText);

    await expect(
      validateLeveragePackage(payloadText, manifest),
    ).resolves.toEqual({ ok: false, reason: "2017-01-03 前市值来源分段不得混用。" });
  });

  it("接受官方前段不可用的临时 QA 包，但不将其标为已审计前段", async () => {
    const result = await validateLeveragePackage(
      makeOfficialPre2017UnavailablePayloadText(),
      makeOfficialPre2017UnavailableManifestText(),
    );

    expect(result.ok).toBe(true);
  });

  it("接受比例全不可用但余额仍有效的发布包", async () => {
    const payloadText = makePayloadWithRatio();
    const payload = parseObject(payloadText);
    expect(payload.provenance.ratio_data_range).toEqual({ start: null, end: null });
    const result = await validateLeveragePackage(
      payloadText,
      makeManifestWithRatioUnavailable(payloadText),
    );

    expect(result.ok).toBe(true);
  });

  it("接受比例全不可用时两端均为整体 null 的数据范围", async () => {
    const payload = parseObject(makePayloadWithRatio());
    payload.provenance.ratio_data_range = null;
    const payloadText = JSON.stringify(payload);
    const manifest = parseObject(makeManifestWithRatioUnavailable(payloadText));
    manifest.market_cap.ratio_data_range = null;
    manifest.payload_sha256 = sha256(payloadText);

    await expect(
      validateLeveragePackage(payloadText, JSON.stringify(manifest)),
    ).resolves.toMatchObject({ ok: true });
  });

  it("拒绝 payload SHA-256 不匹配", async () => {
    const payloadText = makeValidPayloadText();
    const result = await validateLeveragePackage(
      payloadText,
      makeManifestWithPayloadHash("0".repeat(64), payloadText),
    );

    expect(result).toEqual({ ok: false, reason: "发布包 SHA-256 校验失败。" });
  });

  it("拒绝不满足 DFCF-only 审计标记的发布包", async () => {
    const payloadText = makeValidPayloadText();
    const result = await validateLeveragePackage(
      payloadText,
      makeManifestWithDfcfFlags(false, 1, payloadText),
    );

    expect(result).toEqual({ ok: false, reason: "DFCF 审计标记无效。" });
  });

  it("拒绝缺失或非法的 DFCF 输入文件哈希", async () => {
    const missingInput = packageWith(undefined, (manifest) => {
      delete manifest.dfcf.inputs["dfcf_sse_margin.csv"];
    });
    const invalidHash = packageWith(undefined, (manifest) => {
      manifest.dfcf.inputs["dfcf_szse_margin.csv"] = "A".repeat(64);
    });

    await expect(
      validateLeveragePackage(missingInput.payloadText, missingInput.manifestText),
    ).resolves.toEqual({ ok: false, reason: "DFCF 审计标记无效。" });
    await expect(
      validateLeveragePackage(invalidHash.payloadText, invalidHash.manifestText),
    ).resolves.toEqual({ ok: false, reason: "DFCF 审计标记无效。" });
  });

  it("拒绝无效 schema 和日期", async () => {
    const invalidSchema = packageWith((payload) => {
      payload.schema_version = "2";
    });
    const invalidDate = packageWith((payload) => {
      payload.records[1].date = "2017/01/03";
    });

    await expect(
      validateLeveragePackage(
        invalidSchema.payloadText,
        invalidSchema.manifestText,
      ),
    ).resolves.toEqual({ ok: false, reason: "发布包 schema_version 无效。" });
    await expect(
      validateLeveragePackage(invalidDate.payloadText, invalidDate.manifestText),
    ).resolves.toEqual({ ok: false, reason: "发布包记录日期无效。" });
  });

  it("拒绝余额数值错误或沪深合计不一致", async () => {
    const negativeBalance = packageWith((payload) => {
      payload.records[1].sh_margin_yi = -1;
    });
    const mismatchedTotal = packageWith((payload) => {
      payload.records[1].total_margin_yi = 999;
    });

    await expect(
      validateLeveragePackage(
        negativeBalance.payloadText,
        negativeBalance.manifestText,
      ),
    ).resolves.toEqual({ ok: false, reason: "融资余额字段无效。" });
    await expect(
      validateLeveragePackage(
        mismatchedTotal.payloadText,
        mismatchedTotal.manifestText,
      ),
    ).resolves.toEqual({ ok: false, reason: "两市融资余额合计不一致。" });
  });

  it("拒绝非有限市值或指数数值", async () => {
    const payloadText = makeValidPayloadText().replace(
      '"index_000001_close":3000',
      '"index_000001_close":1e999',
    );
    const result = await validateLeveragePackage(
      payloadText,
      makeValidManifestText(payloadText),
    );

    expect(result).toEqual({ ok: false, reason: "市值或指数数值字段无效。" });
  });

  it("在比例不可用时拒绝非空比例", async () => {
    const payload = parseObject(makePayloadWithRatio());
    payload.records[payload.records.length - 1].ratio_pct = 1.5;
    const payloadText = JSON.stringify(payload);
    const manifest = parseObject(makeManifestWithRatioUnavailable(payloadText));
    manifest.payload_sha256 = sha256(payloadText);
    manifest.market_cap.source_segments[1].market_cap_review_status =
      "eastmoney_vendor_unverified";
    manifest.market_cap.source_segments[1].ratio_available = true;

    const result = await validateLeveragePackage(payloadText, JSON.stringify(manifest));

    expect(result).toEqual({ ok: false, reason: "比例不可用时不得包含比例数值。" });
  });

  it("在比例可用时要求至少一条非空比例，但允许 pre-2017 空比例", async () => {
    const allNull = packageWith((payload) => {
      const post2017Record = payload.records[payload.records.length - 1];
      post2017Record.denominator_market_cap_yi = null;
      post2017Record.market_cap_source =
        "eastmoney_post2017_vendor_unverified";
      post2017Record.market_cap_review_status = "unavailable";
      post2017Record.ratio_pct = null;
    }, (manifest) => {
      manifest.market_cap.ratio_missing_records = 3;
      manifest.market_cap.source_segments[1].market_cap_review_status = "unavailable";
      manifest.market_cap.source_segments[1].ratio_available = false;
    });

    const result = await validateLeveragePackage(
      allNull.payloadText,
      allNull.manifestText,
    );

    expect(result).toEqual({ ok: false, reason: "比例可用但没有有效比例记录。" });
  });

  it("接受 post-2017 未匹配市值日的厂商来源与 unavailable 状态", async () => {
    const packageWithPost2017Gap = packageWith((payload) => {
      const post2017Record = payload.records[payload.records.length - 1];
      payload.records.push({
        ...post2017Record,
        date: "2017-01-04",
        denominator_market_cap_yi: null,
        market_cap_review_status: "unavailable",
        ratio_pct: null,
        index_399006_close: 1990,
      });
    }, (manifest) => {
      manifest.market_cap.ratio_missing_records = 3;
      manifest.market_cap.source_segments[1].end = "2017-01-04";
    });

    const result = await validateLeveragePackage(
      packageWithPost2017Gap.payloadText,
      packageWithPost2017Gap.manifestText,
    );

    expect(result.ok).toBe(true);
  });

  it("拒绝非空比例缺少正分母或厂商来源审查状态", async () => {
    const missingDenominator = packageWith((payload) => {
      payload.records[payload.records.length - 1].denominator_market_cap_yi = 0;
    });
    const missingReview = packageWith((payload) => {
      payload.records[payload.records.length - 1].market_cap_review_status = null;
    });

    await expect(
      validateLeveragePackage(
        missingDenominator.payloadText,
        missingDenominator.manifestText,
      ),
    ).resolves.toEqual({ ok: false, reason: "比例分母无效。" });
    await expect(
      validateLeveragePackage(
        missingReview.payloadText,
        missingReview.manifestText,
      ),
    ).resolves.toEqual({ ok: false, reason: "比例数据来源或审查状态无效。" });
  });

  it("拒绝负数比例", async () => {
    const negativeRatio = packageWith((payload) => {
      payload.records[payload.records.length - 1].ratio_pct = -0.01;
    });

    await expect(
      validateLeveragePackage(
        negativeRatio.payloadText,
        negativeRatio.manifestText,
      ),
    ).resolves.toEqual({ ok: false, reason: "比例数值无效。" });
  });

  it("拒绝 pre-2017 的比例或东方财富来源伪装", async () => {
    const invalidPre2017 = packageWith((payload) => {
      payload.records[0].denominator_market_cap_yi = 10000;
      payload.records[0].market_cap_source =
        "eastmoney_post2017_vendor_unverified";
      payload.records[0].market_cap_review_status =
        "eastmoney_vendor_unverified";
      payload.records[0].ratio_pct = 1.8;
      payload.provenance.ratio_data_range.start = "2016-12-30";
    }, (manifest) => {
      manifest.market_cap.ratio_data_range.start = "2016-12-30";
    });

    const result = await validateLeveragePackage(
      invalidPre2017.payloadText,
      invalidPre2017.manifestText,
    );

    expect(result).toEqual({
      ok: false,
      reason: "2017-01-03 前不得使用 2017 年后 Choice 市值或比例。",
    });
  });

  it("拒绝比例范围、未审计警示、切换日期或审查状态冲突", async () => {
    const outOfRange = packageWith((payload) => {
      payload.provenance.ratio_data_range.start = "2017-01-04";
      payload.provenance.ratio_data_range.end = "2017-01-04";
    }, (manifest) => {
      manifest.market_cap.ratio_data_range.start = "2017-01-04";
      manifest.market_cap.ratio_data_range.end = "2017-01-04";
    });
    const missingWarning = packageWith((payload) => {
      payload.provenance.ratio_scope_warning = "比例说明。";
    });
    const invalidSwitchDate = packageWith((payload) => {
      payload.provenance.source_switch_date = "2017-01-02";
    });
    const conflictingReview = packageWith(undefined, (manifest) => {
      manifest.market_cap.ratio_review_status = "unavailable";
    });
    const reportingEligible = packageWith(undefined, (manifest) => {
      manifest.market_cap.reporting_eligible = true;
    });

    await expect(
      validateLeveragePackage(outOfRange.payloadText, outOfRange.manifestText),
    ).resolves.toEqual({ ok: false, reason: "比例日期不在声明的数据范围内。" });
    await expect(
      validateLeveragePackage(
        missingWarning.payloadText,
        missingWarning.manifestText,
      ),
    ).resolves.toEqual({ ok: false, reason: "比例未审计口径提示无效。" });
    await expect(
      validateLeveragePackage(
        invalidSwitchDate.payloadText,
        invalidSwitchDate.manifestText,
      ),
    ).resolves.toEqual({ ok: false, reason: "市值来源切换日期无效。" });
    await expect(
      validateLeveragePackage(
        conflictingReview.payloadText,
        conflictingReview.manifestText,
      ),
    ).resolves.toEqual({ ok: false, reason: "市值审查状态无效。" });
    await expect(
      validateLeveragePackage(
        reportingEligible.payloadText,
        reportingEligible.manifestText,
      ),
    ).resolves.toEqual({ ok: false, reason: "市值审计标记无效。" });
  });

  it("拒绝比例不可用时单端 null 或 payload/manifest 表示形式不一致", async () => {
    const oneSidedNull = parseObject(makePayloadWithRatio());
    oneSidedNull.provenance.ratio_data_range = {
      start: null,
      end: "2017-01-03",
    };
    const oneSidedPayloadText = JSON.stringify(oneSidedNull);
    const oneSidedManifest = parseObject(
      makeManifestWithRatioUnavailable(oneSidedPayloadText),
    );
    oneSidedManifest.market_cap.ratio_data_range = {
      start: null,
      end: "2017-01-03",
    };
    oneSidedManifest.payload_sha256 = sha256(oneSidedPayloadText);

    const inconsistentPayload = parseObject(makePayloadWithRatio());
    const inconsistentPayloadText = JSON.stringify(inconsistentPayload);
    const inconsistentManifest = parseObject(
      makeManifestWithRatioUnavailable(inconsistentPayloadText),
    );
    inconsistentManifest.market_cap.ratio_data_range = null;
    inconsistentManifest.payload_sha256 = sha256(inconsistentPayloadText);

    await expect(
      validateLeveragePackage(oneSidedPayloadText, JSON.stringify(oneSidedManifest)),
    ).resolves.toEqual({ ok: false, reason: "比例数据范围与发布清单不一致。" });
    await expect(
      validateLeveragePackage(
        inconsistentPayloadText,
        JSON.stringify(inconsistentManifest),
      ),
    ).resolves.toEqual({ ok: false, reason: "比例数据范围与发布清单不一致。" });
  });
});
