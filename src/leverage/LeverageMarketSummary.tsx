import { useEffect, useRef, useState } from "react";

import { appPagePath } from "../pageRoute";
import {
  deriveMarketComparison,
  type AvailableMarketComparison,
} from "./deriveTwentyDayComparison";
import { isAbortError, LeverageLoadLifecycle } from "./leverageLoadLifecycle";
import { loadLeveragePackage } from "./leveragePackageLoader";
import type { LeverageDashboardPayload, LeverageManifest } from "./types";
import { validateLeveragePackage } from "./validateLeveragePackage";
import "./leverageMarketSummary.css";

const PAYLOAD_URL = "/data/leverage-dashboard.json";
const MANIFEST_URL = "/data/leverage-dashboard.manifest.json";

type State =
  | { kind: "loading" }
  | { kind: "ready"; comparison: AvailableMarketComparison }
  | { kind: "unavailable" };

export interface LeverageMarketSummaryProps {
  load?: (
    signal: AbortSignal,
  ) => Promise<{ payload: LeverageDashboardPayload; manifest: LeverageManifest } | null>;
}

async function defaultLoad(signal: AbortSignal): Promise<{ payload: LeverageDashboardPayload; manifest: LeverageManifest } | null> {
  const result = await loadLeveragePackage({ fetchImpl: (url, options) => fetch(url, options), validate: validateLeveragePackage, signal, payloadUrl: PAYLOAD_URL, manifestUrl: MANIFEST_URL });
  return result.ok ? { payload: result.payload, manifest: result.manifest } : null;
}
function format(value: number): string {
  return value.toFixed(2);
}

function UnavailableSummary() {
  return (
    <section className="leverage-market-summary" aria-label="市场环境" role="status" aria-live="polite">
      <h3>市场环境</h3>
      <p>市场环境摘要暂不可用</p>
      <a className="leverage-market-summary-link" href={appPagePath("leverage")} aria-label="打开完整两融数据看板">
        查看完整两融看板
      </a>
    </section>
  );
}

export function LeverageMarketSummary({ load = defaultLoad }: LeverageMarketSummaryProps) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const lifecycle = useRef(new LeverageLoadLifecycle()).current;

  useEffect(() => {
    lifecycle.setup();
    return () => lifecycle.abortOnUnmount();
  }, [lifecycle]);

  useEffect(() => {
    const request = lifecycle.begin();
    if (!request.started) {
      return undefined;
    }

    void load(request.controller.signal)
      .then((loaded) => {
        if (!lifecycle.mayCommit(request.controller)) {
          return;
        }
        lifecycle.clear(request.controller);
        if (loaded === null) {
          setState({ kind: "unavailable" });
          return;
        }
        const comparison = deriveMarketComparison(loaded.payload.records);
        setState(
          comparison.kind === "available"
            ? { kind: "ready", comparison }
            : { kind: "unavailable" },
        );
      })
      .catch((error: unknown) => {
        if (isAbortError(error) || !lifecycle.mayCommit(request.controller)) {
          return;
        }
        lifecycle.clear(request.controller);
        setState({ kind: "unavailable" });
      });

    return undefined;
  }, [lifecycle, load]);

  if (state.kind === "loading") {
    return (
      <section className="leverage-market-summary" aria-label="市场环境" role="status" aria-live="polite">
        <h3>市场环境</h3>
        <p>正在加载市场环境摘要…</p>
      </section>
    );
  }
  if (state.kind === "unavailable") {
    return <UnavailableSummary />;
  }

  const { comparison } = state;
  return (
    <section className="leverage-market-summary" aria-labelledby="leverage-market-summary-title">
      <h3 id="leverage-market-summary-title">市场环境</h3>
      <dl className="leverage-market-summary-list">
        <div>
          <dt>区间</dt>
          <dd>{comparison.startDate} 至 {comparison.endDate}，共同交易日 {comparison.commonDayCount} 天</dd>
        </div>
        <div>
          <dt>融资余额：</dt>
          <dd>100 → {format(comparison.marginEndNormalized)}（{format(comparison.marginChangePercent)}%）</dd>
        </div>
        <div>
          <dt>上证指数 000001：</dt>
          <dd>100 → {format(comparison.indexEndNormalized)}（{format(comparison.indexChangePercent)}%）</dd>
        </div>
        <div>
          <dt>描述性差值</dt>
          <dd>融资余额变化减指数变化：{format(comparison.differencePercentagePoints)} 个百分点。</dd>
        </div>
      </dl>
      <p>该摘要仅描述市场环境，不证明其造成所选股票或基金结果变化。</p>
      <a className="leverage-market-summary-link" href={appPagePath("leverage")} aria-label="打开完整两融数据看板">
        查看完整两融看板
      </a>
    </section>
  );
}
