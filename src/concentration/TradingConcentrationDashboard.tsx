import { useEffect, useMemo, useState } from "react";

import { TradingConcentrationChart } from "./TradingConcentrationChart";
import { loadConcentrationPackage } from "./concentrationPackageLoader";
import "./concentration.css";
import type {
  AiChainSeries,
  ConcentrationDashboardPayload,
  ConcentrationManifest,
  ConcentrationRecord,
} from "./types";
import { validateConcentrationPackage } from "./validateConcentrationPackage";

const PAYLOAD_URL = "/data/trading-concentration-dashboard.json";
const MANIFEST_URL = "/data/trading-concentration-dashboard.manifest.json";

type Period = "1y" | "3y" | "5y" | "10y" | "all";

type DashboardFailure =
  | { kind: "load"; reason: string }
  | { kind: "validation"; reason: string };

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

function aiChainSeriesForPeriod(
  aiChainSeries: AiChainSeries | undefined,
  records: ConcentrationRecord[],
): AiChainSeries | undefined {
  const firstDate = records[0]?.date;
  const lastDate = records[records.length - 1]?.date;
  if (!aiChainSeries || !firstDate || !lastDate) {
    return undefined;
  }
  const periodRecords = aiChainSeries.records.filter(
    (record) => record.date >= firstDate && record.date <= lastDate,
  );
  return periodRecords.length > 0 ? { ...aiChainSeries, records: periodRecords } : undefined;
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
      <h2>正在加载数据</h2>
      <p>{detail}</p>
    </section>
  );
}

function ErrorState({ failure, onRetry }: { failure: DashboardFailure; onRetry: () => void }) {
  const reasonIsChinese = /[\u3400-\u9fff]/.test(failure.reason);
  return (
    <section className="concentration-dashboard concentration-dashboard-state is-blocked" aria-live="polite">
      <span className="concentration-eyebrow">交易集中度</span>
      <h2>{failure.kind === "validation" ? "数据包未通过校验" : "数据读取失败"}</h2>
      <p>{reasonIsChinese ? failure.reason : "请检查网络后重试。"}</p>
      {!reasonIsChinese && <details><summary>错误详情</summary><p>{failure.reason}</p></details>}
      <button type="button" className="dashboard-retry-button" onClick={onRetry}>重新加载</button>
    </section>
  );
}

function Disclosure({ payload, manifest }: { payload: ConcentrationDashboardPayload; manifest: ConcentrationManifest }) {
  const aiChainSeries = payload.ai_chain_series;
  const aiChainManifest = manifest.ai_chain_series;
  return (
    <aside className="concentration-disclosure" aria-label="数据说明">
      <div className="concentration-disclosure-essential">
        {aiChainSeries && (
          <p className="concentration-disclosure-warning">AI 曲线按当前成分回溯，存在前视偏差。</p>
        )}
        <p className="concentration-disclosure-warning">2022-08-02 起分子含北交所，分母仍为通达信全 A 等权成交额；样本范围可能不同，跨阶段慎比。</p>
      </div>
      <details>
        <summary>数据说明</summary>
        <div className="concentration-disclosure-content">
          <p>数据包更新日：{payload.generated_at_beijing.slice(0, 10)}；已通过校验。</p>
          <p>来源：{payload.provenance.source}。</p>
          <p>计算：{payload.provenance.definition}</p>
          <p>样本：{payload.provenance.active_stock_rule}</p>
          <p>分母：全期间使用通达信全A等权成交额（sh880008.day 的 AMOUNT 字段）。</p>
          <p>北交所：自 2022-08-02 起纳入分子候选池。</p>
          <p>
            叠加：{manifest.comparison_index_input.name}（{manifest.comparison_index_input.code}）取
            sz399006.day 收盘价；图中按所选观察区间首个有效日 = 100 归一化，以右轴呈现，不参与 C5 分子或分母计算。
          </p>
          {aiChainSeries && aiChainManifest && aiChainSeries.records.length > 0 && (
            <>
              <p>AI 产业链曲线：{aiChainSeries.definition}</p>
              <p>
                AI 产业链样本：以 {aiChainSeries.universe.workbook} 的 {aiChainSeries.universe.sheet} 工作表快照为成分宇宙；
                {aiChainSeries.active_stock_rule}
              </p>
              <p>
                AI 产业链分母：{aiChainManifest.formula}。AI 曲线独立于 C5，当前成分快照不代表历史逐日成分。
              </p>
            </>
          )}
          <p>数据范围：{manifest.data_range.start} 至 {manifest.data_range.end}。</p>
          <p>{manifest.scope_warning}</p>
          <p>仅供趋势研究，不构成投资建议。</p>
          {manifest.omitted_dates.length > 0 && (
            <p>未输出 {manifest.omitted_dates.length} 个分母无效或样本为空的交易日；不插值。</p>
          )}
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
  const [failure, setFailure] = useState<DashboardFailure | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setFailure(null);
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
          setFailure({ kind: "validation", reason: result.reason });
          return;
        }
        setLoaded({ payload: result.payload, manifest: result.manifest });
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setFailure({
          kind: "load",
          reason: loadError instanceof Error ? loadError.message : "交易集中度数据读取失败。",
        });
      });
    return () => controller.abort();
  }, [loadAttempt]);

  const visibleRecords = useMemo(
    () => recordsForPeriod(loaded?.payload.records ?? [], period),
    [loaded, period],
  );
  const visibleAiChainSeries = useMemo(
    () => aiChainSeriesForPeriod(loaded?.payload.ai_chain_series, visibleRecords),
    [loaded?.payload.ai_chain_series, visibleRecords],
  );
  const latest = visibleRecords[visibleRecords.length - 1] ?? null;
  const previous = visibleRecords[visibleRecords.length - 2] ?? null;
  const latestAiChainRecord = visibleAiChainSeries?.records[visibleAiChainSeries.records.length - 1] ?? null;

  if (failure !== null) {
    return <ErrorState failure={failure} onRetry={() => setLoadAttempt((attempt) => attempt + 1)} />;
  }
  if (loaded === null || latest === null) {
    return <LoadingState detail="正在校验数据…" />;
  }

  const change = previous === null ? null : latest.c5_pct - previous.c5_pct;
  const universeLabel = latest.numerator_scope === "sh_sz_bj_active_a" ? "沪深北" : "沪深";
  const latestAiChainPercentage = latestAiChainRecord?.ai_chain_amount_pct ?? null;
  const latestAiChainAmount = latestAiChainRecord?.ai_chain_amount_yi ?? null;

  return (
    <section className="concentration-dashboard" aria-labelledby="concentration-dashboard-title">
      <header className="concentration-dashboard-header">
        <div>
          <h2 id="concentration-dashboard-title">交易集中度</h2>
          <p>C5：成交额前 5% 的活跃 A 股占全 A 等权成交额的比例。</p>
        </div>
        <div className="concentration-header-status">
          <strong>最新交易日 {loaded.manifest.data_range.end}</strong>
        </div>
      </header>

      <div className="concentration-controls" aria-label="时间区间">
        <span>区间</span>
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

      <div className={`concentration-summary-grid${visibleAiChainSeries ? " has-ai-chain-series" : ""}`}>
        <article className="concentration-summary-card concentration-summary-primary">
          <span>区间末日 C5</span>
          <strong>{latest.c5_pct.toFixed(2)}%</strong>
          <small>统计日：{latest.date}</small>
        </article>
        {visibleAiChainSeries && (
          <article className="concentration-summary-card concentration-summary-ai">
            <span>AI 产业链成交占比</span>
            <strong>{latestAiChainPercentage === null ? "暂无" : `${latestAiChainPercentage.toFixed(2)}%`}</strong>
            <small>
              {latestAiChainRecord === null
                ? "区间暂无数据"
                : `${latestAiChainRecord.date} · ${latestAiChainRecord.ai_chain_active_stock_count.toLocaleString("zh-CN")} 只 · ${latestAiChainAmount === null ? "暂无" : formatYi(latestAiChainAmount)}`}
            </small>
          </article>
        )}
        <article className="concentration-summary-card">
          <span>较上一交易日</span>
          <strong className={change !== null && change > 0 ? "is-up" : change !== null && change < 0 ? "is-down" : ""}>
            {change === null ? "—" : signedPercent(change)}
          </strong>
        </article>
        <article className="concentration-summary-card">
          <span>成交活跃 A 股</span>
          <strong>{latest.active_stock_count.toLocaleString("zh-CN")} 只</strong>
          <small>{universeLabel} · 前 {latest.top5_stock_count.toLocaleString("zh-CN")} 只计入 C5</small>
        </article>
        <article className="concentration-summary-card concentration-summary-volume">
          <span>全 A 等权成交额</span>
          <strong>{formatYi(latest.market_amount_yi)}</strong>
          <small>前 5% 合计 {formatYi(latest.top5_amount_yi)}</small>
        </article>
      </div>

      <div className="concentration-workspace">
        <section
          className="concentration-chart-panel"
          aria-label={visibleAiChainSeries ? "C5、AI产业链成交额占比与创业板指趋势图" : "C5 与创业板指趋势图"}
        >
          <div className="concentration-chart-panel-head">
            <div>
              <span>{visibleRecords[0]?.date} 至 {latest.date}</span>
            </div>
            <em>创业板指右轴，首个有效日 = 100</em>
          </div>
          <TradingConcentrationChart records={visibleRecords} aiChainSeries={visibleAiChainSeries} />
        </section>
        <Disclosure payload={loaded.payload} manifest={loaded.manifest} />
      </div>
    </section>
  );
}
