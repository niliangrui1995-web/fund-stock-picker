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

  const maxExposure = funds.reduce((max, f) => Math.max(max, f.totalEstimatedExposurePercent), 0);
  // 恒定列折叠：单一标的组合里「覆盖股票」恒为 1、无间接来源时「间接估算」恒为 0，
  // 保留它们只会挤占横向空间并稀释主指标（总估算暴露）的权重。
  const showCoverageColumn = funds.some((fund) => fund.contributions.length !== 1);
  const showIndirectColumn = funds.some((fund) => fund.indirectEstimatedRatioPercent > 0);
  const columnCount = 4 + (showCoverageColumn ? 1 : 0) + (showIndirectColumn ? 1 : 0);

  return (
    <div className="portfolio-fund-table-scroll">
      <table className="portfolio-fund-table" role="table">
        <caption className="portfolio-visually-hidden">基金比较，按总估算经济暴露降序；相同时按直接暴露降序、基金代码升序。</caption>
        <thead>
          <tr>
            <th scope="col">基金</th>
            {showCoverageColumn && <th scope="col">覆盖股票</th>}
            <th scope="col">直接暴露</th>
            {showIndirectColumn && <th scope="col">间接估算</th>}
            <th scope="col" aria-sort="descending">总估算暴露 ↓</th>
            <th scope="col">操作</th>
          </tr>
        </thead>
        <tbody>{funds.map((fund, index) => {
          const isExpanded = expanded.has(fund.fundFamilyKey);
          const detailId = `portfolio-estimate-${fund.view}-${fund.fundCode}`;
          const barWidth = maxExposure > 0 ? (fund.totalEstimatedExposurePercent / maxExposure) * 100 : 0;
          const isTopRanked = index < 3;
          // 斑马纹用显式类而非 nth-child：每行数据后跟一个隐藏的明细行，会打乱奇偶，导致 nth-child(even) 永不命中数据行
          const isAltRow = index % 2 === 1;
          return <Fragment key={fund.fundFamilyKey}>
            <tr className={`portfolio-fund-row${isTopRanked ? " is-top" : ""}${isAltRow ? " is-alt" : ""}`} data-fund-code={fund.fundCode} data-qdii={fund.isQdii}>
              <th scope="row" className="portfolio-fund-head"><span className="portfolio-rank">{index + 1}</span><div><h4>{fund.fundDisplayName}</h4><p>{fund.fundCode} · {fund.fundType}{fund.managementStyle ? ` · ${fund.managementStyle === "index" ? "指数" : "主动"}` : ""}</p></div></th>
              {showCoverageColumn && <td data-label="覆盖股票" className="portfolio-coverage-cell">{fund.contributions.length} 只</td>}
              <td data-label="直接暴露" className="portfolio-number portfolio-secondary-exposure">{formatPercent(fund.directRatioPercent)}</td>
              {showIndirectColumn && <td data-label="间接估算" className="portfolio-number portfolio-secondary-exposure">{formatPercent(fund.indirectEstimatedRatioPercent)}</td>}
              <td data-label="总估算暴露" className="portfolio-number portfolio-total-exposure">
                <div className="portfolio-table-metric-cell">
                  {formatPercent(fund.totalEstimatedExposurePercent)}
                  <div className="table-progress-track" role="presentation"><div className="table-progress-fill" style={{ width: `${barWidth}%` }} /></div>
                </div>
              </td>
              <td className="portfolio-row-actions">
                <button type="button" aria-expanded={isExpanded} aria-controls={detailId} title={isExpanded ? `收起 ${fund.fundDisplayName} 的暴露构成` : `展开 ${fund.fundDisplayName} 各股票的直接 / 间接暴露构成`} onClick={() => toggle(fund.fundFamilyKey)}>{isExpanded ? "收起" : "构成"}</button>
                <button type="button" title={`查看 ${fund.fundDisplayName} 披露的持仓明细`} onClick={(event) => onOpenDetail(fund, event.currentTarget)} aria-label={`查看 ${fund.fundDisplayName} 基金详情`}>持仓</button>
              </td>
            </tr>
            <tr id={detailId} className="portfolio-fund-breakdown" hidden={!isExpanded}><td colSpan={columnCount}>{isExpanded ? <ExposureBreakdown fund={fund} report={report} cutoffDate={cutoffDate} /> : null}</td></tr>
          </Fragment>;
        })}</tbody>
      </table>
    </div>
  );
}
