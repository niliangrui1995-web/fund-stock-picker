import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LeverageControls } from "../LeverageControls";
import { LeverageDisclosure } from "../LeverageDisclosure";
import type { LeverageDashboardPayload, LeverageManifest } from "../types";
import {
  makeMxPre2017ManifestText,
  makeMxPre2017PayloadText,
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
const mxPayload = JSON.parse(makeMxPre2017PayloadText()) as LeverageDashboardPayload;
const mxManifest = JSON.parse(
  makeMxPre2017ManifestText(makeMxPre2017PayloadText()),
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

function expectFallbackMarketCapSummary(markup: string): void {
  expect(markup).toContain("市值来源：2011–2016 待更新 · 东方财富 Choice（2017 年起）。");
}

describe("leverage dashboard components", () => {
  it("比例不可用时禁用该主指标并给出数据缺口", () => {
    const controlProps: React.ComponentProps<typeof LeverageControls> = {
      metric: "margin" as const,
      ratioAvailable: false,
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

    expect(markup).toContain("融资余额占市值");
    expect(markup).toContain("disabled");
    expect(markup).toContain("暂无可用比例数据");
    expect(markup).toContain('type="checkbox"');
    expect(markup).toContain("暂无数据");
    expect(markup).toContain('type="date"');
    expect(markup).toContain("自定义");
  });

  it("将数据来源与使用边界收拢为可展开的客户说明", () => {
    const markup = renderToStaticMarkup(
      <LeverageDisclosure payload={payload} manifest={manifest} />,
    );

    expect(markup).toContain("<details");
    expect(markup).not.toContain("<details open");
    expect(markup).toContain("数据说明");
    expect(markup).toContain("融资数据：东方财富；指数数据：通达信。");
    expect(markup).toContain("市值来源：2011–2016 待更新 · 东方财富 Choice（2017 年起）。");
    expect(markup).toContain("融资余额反映市场杠杆，不预示涨跌");
    expect(markup.split("<details")[0]).toContain("融资余额可能含非 A 股标的，跨来源占比不可直接比较");
    expect(markup).not.toContain("DFCF 厂商口径／未经交易所复核");
    expect(markup).not.toContain("SHA-256");
  });

  it("用简洁日期分段说明已就绪的历史市值来源", () => {
    const markup = renderToStaticMarkup(
      <LeverageDisclosure payload={auditedPayload} manifest={auditedManifest} />,
    );

    expect(markup).toContain("市值来源：交易所历史数据（2011–2016）· 东方财富 Choice（2017 年起）。");
    expect(markup).not.toContain("UNSUPPORTED_RATIO_CONTRACT");
    expect(markup).not.toContain("未经完整审计");
  });

  it("明确披露妙想前段与 Choice 后段均为厂商口径", () => {
    const markup = renderToStaticMarkup(
      <LeverageDisclosure payload={mxPayload} manifest={mxManifest} />,
    );

    expect(markup).toContain("市值来源：东方财富妙想厂商数据（2011–2016）· 东方财富 Choice（2017 年起）。");
    expect(markup).not.toContain("交易所历史数据（2011–2016）");
  });

  it("早期市值不可用时使用客户可理解的提示", () => {
    const markup = renderToStaticMarkup(
      <LeverageDisclosure
        payload={officialUnavailablePayload}
        manifest={officialUnavailableManifest}
      />,
    );

    expect(markup).toContain("市值来源：2011–2016 暂缺 · 东方财富 Choice（2017 年起）。");
    expect(markup).not.toContain("交易所历史市值段不可用");
  });

  it("按真实发布清单简洁展示两段市值来源", async () => {
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
      "mx_pre2017_vendor_unverified",
      "pre2017_mx_vendor_unavailable",
    ]).toContain(sources[0]);
    expect(markup).toMatch(/市值来源：交易所历史数据（2011–2016）· 东方财富 Choice（2017 年起）。|市值来源：东方财富妙想厂商数据（2011–2016）· 东方财富 Choice（2017 年起）。|市值来源：2011–2016 暂缺 · 东方财富 Choice（2017 年起）。|市值来源：2011–2016 待更新 · 东方财富 Choice（2017 年起）。/);
  });

  it("仅 legacy source 字段而没有 market_cap_source 时不显示未验证来源", () => {
    const markup = disclosureMarkupForSourceSegments([
      {
        source: "unverified_legacy_source",
        start: "2017-01-03",
        end: "2017-01-03",
      },
    ]);

    expectFallbackMarketCapSummary(markup);
    expect(markup).not.toContain("unverified_legacy_source");
  });

  it("未知 market_cap_source 时不显示未验证来源", () => {
    const markup = disclosureMarkupForSourceSegments([
      {
        market_cap_source: "unverified_market_cap_source",
        start: "2017-01-03",
        end: "2017-01-03",
      },
    ]);

    expectFallbackMarketCapSummary(markup);
    expect(markup).not.toContain("unverified_market_cap_source");
  });

  it("非对象市值来源分段时使用安全的客户提示", () => {
    const markup = disclosureMarkupForSourceSegments([
      null,
      "unverified_source_segment",
      ["eastmoney_post2017_vendor_unverified"],
    ]);

    expectFallbackMarketCapSummary(markup);
    expect(markup).not.toContain("unverified_source_segment");
  });

});
