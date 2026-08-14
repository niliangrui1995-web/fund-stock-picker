export type LeverageDashboardLoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "blocked"; reason: string; cutoffDate?: string | null };

export interface DashboardStateView {
  heading: string;
  detail: string;
  blocking: boolean;
  cutoffDate?: string;
}

export function getDashboardStateView(
  state: LeverageDashboardLoadState,
): DashboardStateView {
  switch (state.kind) {
    case "idle":
      return {
        heading: "正在加载数据",
        detail: "请稍候。",
        blocking: false,
      };
    case "loading":
      return {
        heading: "正在加载数据",
        detail: "请稍候。",
        blocking: false,
      };
    case "ready":
      return {
        heading: "数据已就绪",
        detail: "正在展示最新数据。",
        blocking: false,
      };
    case "blocked":
      return {
        heading: "数据暂不可用",
        detail: "请稍后刷新再试。",
        blocking: true,
        cutoffDate: state.cutoffDate ?? "暂无",
      };
  }
}
