import { useEffect, useMemo, useState } from "react";

import { TradingConcentrationChart } from "./TradingConcentrationChart";
import { loadConcentrationPackage } from "./concentrationPackageLoader";
import "./concentration.css";
import type { ConcentrationDashboardPayload, ConcentrationManifest, ConcentrationRecord } from "./types";
import { validateConcentrationPackage } from "./validateConcentrationPackage";

const PAYLOAD_URL = "/data/trading-concentration-dashboard.json";
const MANIFEST_URL = "/data/trading-concentration-dashboard.manifest.json";

type Period = "1y" | "3y" | "5y" | "10y" | "all";

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: "1y", label: "1 年" },
  { value: "3y", label: "3 年" },
  { value: "5y", label: "5 年" },
  { value: "10y", label: "10 年" },
  { value: "all", label: "全部" },
];

function recordsForPeriod(records: ConcentrationRecord[], period: Period): ConcentrationRecord[] {
  if (period === "all") {
    return records;
  }
  const latest = records[records.length - 1];
  if (!latest) {
    return [];
  }
  const years = Number.parseInt(period, 10);
  const target = new Date(`${latest.date}T00:00:00Z`);
  target.setUTCFullYear(target.getUTCFullYear() - years);
  const targetDate = target.toISOString().slice(0, 10);
  return records.filter((record) => record.date >= targetDate);
}

function formatYi(value: number): string {
  return `${value.toLocaleString("zh-CN", { maximumFractionDigits: 0 })} 亿元`;
}

function signedPercent(value: number): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)} 个百分点`;
}

function LoadingState({ detail }: { detail: string }) {
  return (
    <section className="concentration-dashboard concentration-dashboard-state" aria-live="polite">
      <span className="concentration-eyebrow">交易集中度</span>
      <h2>正在读取日度数据</h2>
      <p>{detail}</p>
    </section>
  );
}

function ErrorState({ reason }: { reason: string }) {
  return (
    <section className="concentration-dashboard concentration-dashboard-state is-blocked" aria-live="polite">
      <span className="concentration-eyebrow">交易集中度</span>
      <h2>数据包未通过校验</h2>
      <p>{reason}</p>
      <small>页面不会使用未经校验的集中度数据。</small>
    </section>
  );
}

function Disclosure({ payload, manifest }: { payload: ConcentrationDashboardPayload; manifest: ConcentrationManifest }) {
  return (
    <aside className="concentration-disclosure" aria-label="数据说明">
      <details open>
        <summary>
          <span>数据说明</span>
          <small>口径与边界</small>
        </summary>
        <div className="concentration-disclosure-content">
          <p>来源：{payload.provenance.source}。</p>
          <p>计算：{payload.provenance.definition}</p>
          <p>样本：{payload.provenance.active_stock_rule}</p>
          <p>分母：全期间使用 `sh880008.day.amount`（通达信全A等权 AMOUNT 字段）。</p>
          <p>北交所：自 2022-08-02 起纳入分子候选池。</p>
          <p>
            叠加：{manifest.comparison_index_input.name}（{manifest.comparison_index_input.code}）取
            `sz399006.day` 收盘价；图中按所选观察区间首个有效日 = 100 归一化，以右轴呈现，不参与 C5 分子或分母计算。
          </p>
          <p>数据范围：{manifest.data_range.start} 至 {manifest.data_range.end}。</p>
          {manifest.omitted_dates.length > 0 && (
            <p>未输出 {manifest.omitted_dates.length} 个分母无效或样本为空的交易日；不插值。</p>
          )}
          <p className="concentration-disclosure-warning">{manifest.scope_warning}</p>
          <p className="concentration-disclosure-warning">仅供趋势研究，不构成投资建议。</p>
        </div>
      </details>
    </aside>
  );
}

export function TradingConcentrationDashboard() {
  const [period, setPeriod] = useState<Period>("all");
  const [loaded, setLoaded] = useState<{
    payload: ConcentrationDashboardPayload;
    manifest: ConcentrationManifest;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void loadConcentrationPackage({
      fetchImpl: (url, options) => fetch(url, options),
      validate: validateConcentrationPackage,
      signal: controller.signal,
      payloadUrl: PAYLOAD_URL,
      manifestUrl: MANIFEST_URL,
    })
      .then((result) => {
        if (controller.signal.aborted) {
          return;
        }
        if (!result.ok) {
          setError(result.reason);
          return;
        }
        setLoaded({ payload: result.payload, manifest: result.manifest });
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "交易集中度数据读取失败。");
      });
    return () => controller.abort();
  }, []);

  const visibleRecords = useMemo(
    () => recordsForPeriod(loaded?.payload.records ?? [], period),
    [loaded, period],
  );
  const latest = visibleRecords[visibleRecords.length - 1] ?? null;
  const previous = visibleRecords[visibleRecords.length - 2] ?? null;

  if (error !== null) {
    return <ErrorState reason={error} />;
  }
  if (loaded === null || latest === null) {
    return <LoadingState detail="正在校验同源静态数据包和日度口径。" />;
  }

  const change = previous === null ? null : latest.c5_pct - previous.c5_pct;
  const universeLabel = latest.numerator_scope === "sh_sz_bj_active_a" ? "沪深北" : "沪深";

  return (
    <section className="concentration-dashboard" aria-labelledby="concentration-dashboard-title">
      <header className="concentration-dashboard-header">
        <div>
          <span className="concentration-eyebrow">交易集中度</span>
          <h2 id="concentration-dashboard-title">前 5% 个股成交额占比</h2>
          <p>观察成交额是否向少数交易活跃 A 股集中；C5 越高，说明当日成交更集中。同步叠加创业板指观察市场风格。</p>
        </div>
        <div className="concentration-header-status">
          <span>{loaded.payload.provenance.metric_name}</span>
          <strong>数据截至 {latest.date}</strong>
        </div>
      </header>

      <div className="concentration-controls" aria-label="时间区间">
        <span>观察区间</span>
        <div className="concentration-period-toggle" role="group" aria-label="选择时间区间">
          {PERIODS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={period === item.value ? "is-active" : ""}
              aria-pressed={period === item.value}
              onClick={() => setPeriod(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="concentration-summary-grid">
        <article className="concentration-summary-card concentration-summary-primary">
          <span>最新 C5</span>
          <strong>{latest.c5_pct.toFixed(2)}%</strong>
          <small>{latest.date}，前 5% 个股成交额占全A等权 AMOUNT</small>
        </article>
        <article className="concentration-summary-card">
          <span>较上一交易日</span>
          <strong className={change !== null && change > 0 ? "is-up" : change !== null && change < 0 ? "is-down" : ""}>
            {change === null ? "—" : signedPercent(change)}
          </strong>
          <small>正值表示成交进一步向头部交易股集中</small>
        </article>
        <article className="concentration-summary-card">
          <span>成交活跃 A 股</span>
          <strong>{latest.active_stock_count.toLocaleString("zh-CN")} 只</strong>
          <small>{universeLabel}范围，前 {latest.top5_stock_count.toLocaleString("zh-CN")} 只纳入分子</small>
        </article>
        <article className="concentration-summary-card concentration-summary-volume">
          <span>全A等权 AMOUNT</span>
          <strong>{formatYi(latest.market_amount_yi)}</strong>
          <small>前 5% 合计 {formatYi(latest.top5_amount_yi)}</small>
        </article>
      </div>

      <div className="concentration-workspace">
        <section className="concentration-chart-panel" aria-label="C5 与创业板指趋势图">
          <div className="concentration-chart-panel-head">
            <div>
              <span>{visibleRecords[0]?.date} 至 {latest.date}</span>
              <strong>成交额集中度 C5 与创业板指</strong>
            </div>
            <em>创业板指右轴，首个有效日 = 100</em>
          </div>
          <TradingConcentrationChart records={visibleRecords} />
        </section>
        <Disclosure payload={loaded.payload} manifest={loaded.manifest} />
      </div>
    </section>
  );
}
