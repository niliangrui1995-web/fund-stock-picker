import { Fragment, useState } from "react";
import { getSecurityIdentity } from "../securityIdentity";

import type { AggregatedFundResult } from "./types";

export function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}%`;
}

function ExposureBreakdown({ fund, report, cutoffDate }: {
  fund: AggregatedFundResult;
  report: string;
  cutoffDate: string;
}) {
  return (
    <div className="portfolio-estimate-detail">
      <p>{report} · {cutoffDate} · 占基金净值。零值仅代表已识别贡献；未披露不代表未持有。</p>
      <ul className="portfolio-contributions" aria-label={`${fund.fundDisplayName} 的股票贡献`}>
        {fund.contributions.map((contribution) => (
          <li key={contribution.targetCode}>
            <strong>{contribution.targetName} · {getSecurityIdentity(contribution.targetCode, contribution.targetName).marketLabel} · {contribution.targetCode}</strong>
            <p>直接 {formatPercent(contribution.directRatioPercent)} · 间接估算 {formatPercent(contribution.indirectEstimatedRatioPercent)}</p>
            {contribution.directSources?.map((source, index) => <p key={`${source.targetCode}-${index}`}>原披露：{source.targetName} · {source.targetCode} · {formatPercent(source.ratioPercent)}</p>)}
            {contribution.indirectSources.map((source) => <p key={source.sourceCode} className="portfolio-source-formula">
              <strong>{source.sourceName} · {source.sourceCode}</strong>
              <span>产品原占比 {formatPercent(source.sourceRatioPercent)} × {source.leverageMultiple} 倍 = 间接估算 {formatPercent(source.estimatedRatioPercent)}</span>
            </p>)}
          </li>
        ))}
      </ul>
      <p className="portfolio-share-codes"><strong>全部份额：</strong>{[...new Set([fund.fundCode, ...fund.fundVariantCodes])].join("、")} · {fund.fundType} · {fund.managementStyle === "index" ? "指数" : fund.managementStyle === "active" ? "主动" : "管理方式以披露为准"}</p>
    </div>
  );
}

export function PortfolioFundResults({ funds, report, cutoffDate, onOpenDetail }: {
  funds: AggregatedFundResult[];
  report: string;
  cutoffDate: string;
  onOpenDetail(fund: AggregatedFundResult, trigger: HTMLButtonElement): void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggle = (key: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  return (
    <div className="portfolio-fund-table-scroll">
      <table className="portfolio-fund-table" role="table">
        <caption className="portfolio-visually-hidden">基金比较，按总估算经济暴露降序；相同时按直接暴露降序、基金代码升序。</caption>
        <thead><tr><th scope="col">基金</th><th scope="col">覆盖股票</th><th scope="col">直接暴露</th><th scope="col">间接估算</th><th scope="col" aria-sort="descending">总估算暴露 ↓</th><th scope="col">详情</th></tr></thead>
        <tbody>{funds.map((fund, index) => {
          const isExpanded = expanded.has(fund.fundFamilyKey);
          const detailId = `portfolio-estimate-${fund.view}-${fund.fundCode}`;
          return <Fragment key={fund.fundFamilyKey}>
            <tr className="portfolio-fund-row" data-fund-code={fund.fundCode} data-qdii={fund.isQdii}>
              <th scope="row" className="portfolio-fund-head"><span className="portfolio-rank">{index + 1}</span><div><h4>{fund.fundDisplayName}</h4><p>{fund.fundCode} · {fund.fundType}{fund.managementStyle ? ` · ${fund.managementStyle === "index" ? "指数" : "主动"}` : ""}</p></div></th>
              <td data-label="覆盖股票" className="portfolio-coverage-cell">{fund.contributions.length} 只</td>
              <td data-label="直接暴露" className="portfolio-number portfolio-secondary-exposure">{formatPercent(fund.directRatioPercent)}</td>
              <td data-label="间接估算" className="portfolio-number portfolio-secondary-exposure">{formatPercent(fund.indirectEstimatedRatioPercent)}</td>
              <td data-label="总估算暴露" className="portfolio-number portfolio-total-exposure">{formatPercent(fund.totalEstimatedExposurePercent)}</td>
              <td className="portfolio-row-actions"><button type="button" aria-expanded={isExpanded} aria-controls={detailId} onClick={() => toggle(fund.fundFamilyKey)}>{isExpanded ? "收起" : "构成"}</button><button type="button" onClick={(event) => onOpenDetail(fund, event.currentTarget)} aria-label={`查看 ${fund.fundDisplayName} 基金详情`}>持仓</button></td>
            </tr>
            <tr id={detailId} className="portfolio-fund-breakdown" hidden={!isExpanded}><td colSpan={6}>{isExpanded ? <ExposureBreakdown fund={fund} report={report} cutoffDate={cutoffDate} /> : null}</td></tr>
          </Fragment>;
        })}</tbody>
      </table>
    </div>
  );
}
