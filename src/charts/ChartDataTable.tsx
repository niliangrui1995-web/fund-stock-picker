import { useId, useState } from "react";

import "./chartDataTable.css";

export interface ChartDataRow {
  date: string;
  values: string[];
}

interface ChartDataTableProps {
  title: string;
  columns: string[];
  rows: ChartDataRow[];
}

export function ChartDataTable({ title, columns, rows }: ChartDataTableProps) {
  const inputId = useId();
  const [requestedDate, setRequestedDate] = useState("");
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (!first || !last) {
    return <p className="chart-data-empty">区间暂无数据。</p>;
  }

  const targetDate = requestedDate >= first.date && requestedDate <= last.date ? requestedDate : last.date;
  const nextIndex = rows.findIndex((row) => row.date > targetDate);
  const selectedIndex = nextIndex === -1 ? rows.length - 1 : Math.max(0, nextIndex - 1);
  const selected = rows[selectedIndex];

  return (
    <details className="chart-data-table">
      <summary>数据表</summary>
      <div className="chart-data-controls">
        <label htmlFor={inputId}>日期</label>
        <input
          id={inputId}
          type="date"
          value={targetDate}
          min={first.date}
          max={last.date}
          onChange={(event) => setRequestedDate(event.target.value)}
        />
        <div className="chart-data-day-controls" role="group" aria-label="切换数据交易日">
          <button type="button" disabled={selectedIndex === 0} onClick={() => setRequestedDate(rows[selectedIndex - 1].date)}>
            上一交易日
          </button>
          <button type="button" disabled={selectedIndex === rows.length - 1} onClick={() => setRequestedDate(rows[selectedIndex + 1].date)}>
            下一交易日
          </button>
        </div>
      </div>
      <p className="chart-data-status" role="status">
        <span className="visually-hidden">统计日：{selected.date}。</span>
        {selected.date !== targetDate && `所选日期无记录，显示 ${selected.date}；不插值。`}
        共 {rows.length.toLocaleString("zh-CN")} 个交易日
      </p>
      <table>
        <caption>{title} · {selected.date}</caption>
        <thead><tr><th scope="col">指标</th><th scope="col">数值</th></tr></thead>
        <tbody>
          {columns.map((column, index) => (
            <tr key={column}><th scope="row">{column}</th><td>{selected.values[index] ?? "暂无"}</td></tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}
