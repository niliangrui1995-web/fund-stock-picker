export type LeverageDashboardLoadState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready" }
  | { kind: "blocked"; reason: string; failureKind?: "load" | "validation"; cutoffDate?: string | null };

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
        heading: state.failureKind === "load" ? "数据读取失败" : "数据包未通过校验",
        detail: /[\u3400-\u9fff]/.test(state.reason) ? state.reason : "数据包不完整或版本不匹配，请重新加载。",
        blocking: true,
        cutoffDate: state.cutoffDate ?? "暂无",
      };
  }
}
