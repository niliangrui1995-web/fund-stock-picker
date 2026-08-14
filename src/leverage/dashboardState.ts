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
        heading: "两融面板尚未载入",
        detail: "进入两融栏目后，将从本机静态发布包读取并校验数据。",
        blocking: false,
      };
    case "loading":
      return {
        heading: "正在校验两融发布包",
        detail: "仅加载本机静态发布包，不访问外部行情接口。",
        blocking: false,
      };
    case "ready":
      return {
        heading: "两融发布包校验通过",
        detail: "数据已通过前端完整性与口径门槛检查。",
        blocking: false,
      };
    case "blocked":
      return {
        heading: "两融数据不可用",
        detail: state.reason,
        blocking: true,
        cutoffDate: state.cutoffDate ?? "N/A",
      };
  }
}
