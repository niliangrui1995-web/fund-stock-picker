import { useEffect, useMemo, useRef, useState } from "react";

import { LeverageChart } from "./LeverageChart";
import { LeverageControls } from "./LeverageControls";
import { LeverageDisclosure } from "./LeverageDisclosure";
import { LeverageSummary } from "./LeverageSummary";
import "./leverage.css";
import {
  getDashboardStateView,
  type LeverageDashboardLoadState,
} from "./dashboardState";
import { deriveLeverageSeries, type DerivedSeries } from "./deriveLeverageSeries";
import {
  resolveLeverageDateRange,
  type LeverageDateRange,
  type LeveragePeriod,
} from "./leverageDateRange";
import { LeverageLoadLifecycle, isAbortError } from "./leverageLoadLifecycle";
import { LEVERAGE_METRIC_LABELS } from "./leverageLabels";
import { loadLeveragePackage } from "./leveragePackageLoader";
import type {
  LeverageDashboardPayload,
  LeverageIndexCode,
  LeverageManifest,
  LeverageMetric,
  LeverageRecord,
} from "./types";
import { validateLeveragePackage } from "./validateLeveragePackage";

interface LoadedLeveragePackage {
  payload: LeverageDashboardPayload;
  manifest: LeverageManifest;
}

const DEFAULT_INDEX_CODES: LeverageIndexCode[] = ["000001", "399106", "399006"];
const LEVERAGE_PAYLOAD_URL = "/data/leverage-dashboard.json";
const LEVERAGE_MANIFEST_URL = "/data/leverage-dashboard.manifest.json";

function recordForDate(records: LeverageRecord[], date: string | undefined): LeverageRecord | null {
  if (date === undefined) {
    return null;
  }
  return records.find((record) => record.date === date) ?? null;
}

function previousRecordForDerived(
  records: LeverageRecord[],
  derived: DerivedSeries,
): LeverageRecord | null {
  return recordForDate(records, derived.main[derived.main.length - 2]?.date);
}

function recordBounds(records: LeverageRecord[]): LeverageDateRange | null {
  const first = records[0];
  const last = records[records.length - 1];
  return first === undefined || last === undefined
    ? null
    : { startDate: first.date, endDate: last.date };
}

export function LeverageDashboard() {
  const [loadState, setLoadState] = useState<LeverageDashboardLoadState>({ kind: "idle" });
  const [loadedPackage, setLoadedPackage] = useState<LoadedLeveragePackage | null>(null);
  const [metric, setMetric] = useState<LeverageMetric>("margin");
  const [indexCodes, setIndexCodes] = useState<LeverageIndexCode[]>(DEFAULT_INDEX_CODES);
  const [period, setPeriod] = useState<LeveragePeriod>("10y");
  const [customRange, setCustomRange] = useState<LeverageDateRange | null>(null);
  const lifecycleRef = useRef<LeverageLoadLifecycle | null>(null);

  if (lifecycleRef.current === null) {
    lifecycleRef.current = new LeverageLoadLifecycle();
  }

  useEffect(() => {
    const lifecycle = lifecycleRef.current as LeverageLoadLifecycle;
    lifecycle.setup();
    return () => lifecycle.abortOnUnmount();
  }, []);

  useEffect(() => {
    if (loadedPackage !== null) {
      return undefined;
    }

    const lifecycle = lifecycleRef.current as LeverageLoadLifecycle;
    const request = lifecycle.begin();
    if (!request.started) {
      return undefined;
    }

    setLoadState({ kind: "loading" });
    void loadLeveragePackage({
      fetchImpl: (url, options) => fetch(url, options),
      validate: validateLeveragePackage,
      signal: request.controller.signal,
      payloadUrl: LEVERAGE_PAYLOAD_URL,
      manifestUrl: LEVERAGE_MANIFEST_URL,
    })
      .then((validation) => {
        if (!lifecycle.mayCommit(request.controller)) {
          return;
        }
        lifecycle.clear(request.controller);

        if (!validation.ok) {
          setLoadState({ kind: "blocked", reason: validation.reason, cutoffDate: null });
          return;
        }

        setLoadedPackage({ payload: validation.payload, manifest: validation.manifest });
        setLoadState({ kind: "ready" });
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) {
          if (lifecycle.mayCommit(request.controller)) {
            lifecycle.clear(request.controller);
          }
          return;
        }
        if (!lifecycle.mayCommit(request.controller)) {
          return;
        }
        lifecycle.clear(request.controller);
        setLoadState({
          kind: "blocked",
          reason: "数据读取失败。",
          cutoffDate: null,
        });
      });

    return undefined;
  }, [loadedPackage]);

  const ratioAvailable = loadedPackage?.payload.provenance.ratio_available ?? false;
  useEffect(() => {
    if (!ratioAvailable && metric === "ratio") {
      setMetric("margin");
    }
  }, [metric, ratioAvailable]);

  const records = loadedPackage?.payload.records ?? [];
  const dataBounds = useMemo(() => recordBounds(records), [records]);
  const range = useMemo(
    () => resolveLeverageDateRange({ records, period, customRange }),
    [customRange, period, records],
  );
  const controlsRange =
    period === "custom" && customRange !== null ? customRange : range ?? dataBounds;

  const derived = useMemo(() => {
    if (loadedPackage === null || range === null) {
      return null;
    }
    return deriveLeverageSeries({
      records,
      metric,
      indexCodes,
      startDate: range.startDate,
      endDate: range.endDate,
    });
  }, [indexCodes, loadedPackage, metric, range, records]);

  const currentRecord = useMemo(
    () =>
      derived === null
        ? null
        : recordForDate(records, derived.main[derived.main.length - 1]?.date),
    [derived, records],
  );
  const previousRecord = useMemo(
    () => (derived === null ? null : previousRecordForDerived(records, derived)),
    [derived, records],
  );

  const handlePeriodChange = (nextPeriod: Exclude<LeveragePeriod, "custom">) => {
    setPeriod(nextPeriod);
    setCustomRange(null);
  };

  const handleDateRangeChange = (nextRange: LeverageDateRange) => {
    if (nextRange.startDate > nextRange.endDate) {
      return;
    }
    setCustomRange(nextRange);
    setPeriod("custom");
  };

  if (loadState.kind !== "ready" || loadedPackage === null || derived === null || controlsRange === null || dataBounds === null) {
    const stateForView: LeverageDashboardLoadState =
      loadState.kind === "ready" ? { kind: "loading" } : loadState;
    const view = getDashboardStateView(stateForView);
    return (
      <section
        className={`leverage-dashboard leverage-dashboard-state ${view.blocking ? "is-blocked" : ""}`}
        aria-live="polite"
      >
        <span className="leverage-eyebrow">两融</span>
        <h2>{view.heading}</h2>
        <p>{view.detail}</p>
        {view.blocking && <small className="leverage-state-cutoff">数据截至：{view.cutoffDate ?? "暂无"}</small>}
      </section>
    );
  }

  return (
    <section className="leverage-dashboard" aria-labelledby="leverage-dashboard-title">
      <header className="leverage-dashboard-header">
        <div>
          <span className="leverage-eyebrow">两融</span>
          <h2 id="leverage-dashboard-title">两融数据</h2>
          <p>融资余额与指数走势</p>
        </div>
      </header>

      <LeverageControls
        metric={metric}
        ratioAvailable={ratioAvailable}
        indexCodes={indexCodes}
        unavailableIndexCodes={derived.unavailableIndexCodes}
        period={period}
        startDate={controlsRange.startDate}
        endDate={controlsRange.endDate}
        minDate={dataBounds.startDate}
        maxDate={dataBounds.endDate}
        onMetricChange={setMetric}
        onIndexCodesChange={setIndexCodes}
        onPeriodChange={handlePeriodChange}
        onDateRangeChange={handleDateRangeChange}
      />

      <LeverageSummary
        metric={metric}
        currentRecord={currentRecord}
        previousRecord={previousRecord}
        dataEndDate={loadedPackage.manifest.data_range.end}
        manifest={loadedPackage.manifest}
      />

      <div className="leverage-workspace">
        <section className="leverage-chart-panel" aria-label="融资趋势图">
          <div className="leverage-chart-panel-head">
            <div>
              <span>
                {derived.main[0]?.date ?? controlsRange.startDate} 至 {derived.main[derived.main.length - 1]?.date ?? controlsRange.endDate}
              </span>
              <strong>
                {metric === "margin"
                  ? `${LEVERAGE_METRIC_LABELS.margin}与指数`
                  : `${LEVERAGE_METRIC_LABELS.ratio}与指数`}
              </strong>
            </div>
            {derived.baseDate !== null && <em>对比基准：{derived.baseDate} = 100</em>}
          </div>
          <LeverageChart metric={metric} derived={derived} />
        </section>

        <LeverageDisclosure
          payload={loadedPackage.payload}
          manifest={loadedPackage.manifest}
        />
      </div>
    </section>
  );
}
