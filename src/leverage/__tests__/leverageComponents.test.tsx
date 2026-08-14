import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LeverageControls } from "../LeverageControls";
import { LeverageDisclosure } from "../LeverageDisclosure";
import type { LeverageDashboardPayload, LeverageManifest } from "../types";
import {
  makeOfficialPre2017ManifestText,
  makeOfficialPre2017PayloadText,
  makeOfficialPre2017UnavailableManifestText,
  makeOfficialPre2017UnavailablePayloadText,
  makeValidManifestText,
  makeValidPayloadText,
} from "./fixtures";

const payload = JSON.parse(makeValidPayloadText()) as LeverageDashboardPayload;
const manifest = JSON.parse(makeValidManifestText(makeValidPayloadText())) as LeverageManifest;
const auditedPayload = JSON.parse(makeOfficialPre2017PayloadText()) as LeverageDashboardPayload;
const auditedManifest = JSON.parse(
  makeOfficialPre2017ManifestText(makeOfficialPre2017PayloadText()),
) as LeverageManifest;
const officialUnavailablePayload = JSON.parse(
  makeOfficialPre2017UnavailablePayloadText(),
) as LeverageDashboardPayload;
const officialUnavailableManifest = JSON.parse(
  makeOfficialPre2017UnavailableManifestText(makeOfficialPre2017UnavailablePayloadText()),
) as LeverageManifest;
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const publishedManifestPath = resolve(
  projectRoot,
  "public",
  "data",
  "leverage-dashboard.manifest.json",
);

function disclosureMarkupForSourceSegments(sourceSegments: unknown[]): string {
  const invalidManifest = JSON.parse(JSON.stringify(manifest)) as LeverageManifest;
  invalidManifest.market_cap.source_segments =
    sourceSegments as LeverageManifest["market_cap"]["source_segments"];
  return renderToStaticMarkup(
    <LeverageDisclosure payload={payload} manifest={invalidManifest} />,
  );
}

function expectUnavailableSourceSegments(markup: string): void {
  expect(markup).toContain('leverage-disclosure-source-list"><span>N/A</span>');
}

describe("leverage dashboard components", () => {
  it("比例不可用时禁用该主指标并给出数据缺口", () => {
    const controlProps: React.ComponentProps<typeof LeverageControls> = {
      metric: "margin" as const,
      ratioAvailable: false,
      ratioUnavailableReason: "当前发布包没有可用比例记录。",
      indexCodes: ["399006"],
      unavailableIndexCodes: ["399006"],
      period: "custom",
      startDate: "2016-12-30",
      endDate: "2017-01-03",
      minDate: "2016-12-30",
      maxDate: "2017-01-03",
      onMetricChange: () => undefined,
      onIndexCodesChange: () => undefined,
      onPeriodChange: () => undefined,
      onDateRangeChange: () => undefined,
    };
    const markup = renderToStaticMarkup(
      <LeverageControls {...controlProps} />,
    );

    expect(markup).toContain("沪深融资余额／沪深 A 股市值（%）");
    expect(markup).toContain("disabled");
    expect(markup).toContain("当前发布包没有可用比例记录。");
    expect(markup).toContain('type="checkbox"');
    expect(markup).toContain("当前范围 N/A");
    expect(markup).toContain('type="date"');
    expect(markup).toContain("自定义区间");
    expect(markup).toContain("手动日期会切换至自定义区间");
  });

  it("披露固定说明 DFCF 厂商口径、2011-2016 比例 N/A 与分子分母范围差异", () => {
    const markup = renderToStaticMarkup(
      <LeverageDisclosure payload={payload} manifest={manifest} />,
    );

    expect(markup).toContain("DFCF 厂商口径／未经交易所复核");
    expect(markup).toContain("2011–2016 年比例为 N/A");
    expect(markup).toContain("市值分母来源");
    expect(markup).toContain("交易所历史市值段待准出（比例 N/A）");
    expect(markup).toContain("东方财富Choice厂商市值");
    expect(markup).toContain("审查状态");
    expect(markup).toContain("正式报告资格：否");
    expect(markup).toContain("完整数据范围");
    expect(markup).toContain(
      "分子可能包含非 A 股融资标的；本指标仅作描述性比例展示，不代表资产类别完全匹配的估值口径。",
    );
    expect(markup).toContain(`SHA-256 ${manifest.payload_sha256.slice(0, 12)}…`);
  });

  it("披露 2011–2016 官方原始链已审计前段，同时保留东方财富后段未审计警示", () => {
    const markup = renderToStaticMarkup(
      <LeverageDisclosure payload={auditedPayload} manifest={auditedManifest} />,
    );

    expect(markup).toContain("交易所官方历史原始链已审计");
    expect(markup).toContain("2011-08-03 至 2016-12-30 的分母为交易所官方历史原始链");
    expect(markup).toContain("UNSUPPORTED_RATIO_CONTRACT");
    expect(markup).toContain("东方财富Choice厂商市值／未经交易所复核、未经完整审计");
    expect(markup).toContain("前段官方原始链不改变后段的厂商未审计属性");
    expect(markup).toContain("去杠杆压力代理");
  });

  it("官方前段临时不可用时不将其披露为已审计分母", () => {
    const markup = renderToStaticMarkup(
      <LeverageDisclosure
        payload={officialUnavailablePayload}
        manifest={officialUnavailableManifest}
      />,
    );

    expect(markup).toContain("交易所历史市值段不可用（比例 N/A）");
    expect(markup).toContain("2011–2016 年前段交易所官方市值链当前不可用（比例 N/A）");
    expect(markup).not.toContain("前段为交易所官方原始链已审计分母");
    expect(markup).toContain("东方财富Choice厂商未复核／未完整审计口径");
  });

  it("按真实发布清单的 market_cap_source 字段显示两个市值来源分段", async () => {
    const publishedManifest = JSON.parse(
      await readFile(publishedManifestPath, "utf8"),
    ) as LeverageManifest;
    const markup = renderToStaticMarkup(
      <LeverageDisclosure payload={payload} manifest={publishedManifest} />,
    );

    const sources = publishedManifest.market_cap.source_segments.map(
      (segment) => segment.market_cap_source,
    );
    expect(sources).toContain("eastmoney_post2017_vendor_unverified");
    expect([
      "official_exchange_pre2017_raw_chain_audited",
      "pre2017_official_unavailable",
      "pre2017_official_pending",
    ]).toContain(sources[0]);
    expect(markup).toMatch(/交易所官方历史原始链已审计|交易所历史市值段不可用|交易所历史市值段待准出/);
    expect(markup).toContain("东方财富Choice厂商市值／未经交易所复核、未经完整审计");
  });

  it("仅 legacy source 字段而没有 market_cap_source 时保持 N/A", () => {
    const markup = disclosureMarkupForSourceSegments([
      {
        source: "unverified_legacy_source",
        start: "2017-01-03",
        end: "2017-01-03",
      },
    ]);

    expectUnavailableSourceSegments(markup);
    expect(markup).not.toContain("unverified_legacy_source");
  });

  it("未知 market_cap_source 时保持 N/A，不显示未验证来源", () => {
    const markup = disclosureMarkupForSourceSegments([
      {
        market_cap_source: "unverified_market_cap_source",
        start: "2017-01-03",
        end: "2017-01-03",
      },
    ]);

    expectUnavailableSourceSegments(markup);
    expect(markup).not.toContain("unverified_market_cap_source");
  });

  it("null、字符串和数组等非对象市值来源分段时保持 N/A", () => {
    const markup = disclosureMarkupForSourceSegments([
      null,
      "unverified_source_segment",
      ["eastmoney_post2017_vendor_unverified"],
    ]);

    expectUnavailableSourceSegments(markup);
    expect(markup).not.toContain("unverified_source_segment");
  });

});
