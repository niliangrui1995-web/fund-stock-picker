import { describe, expect, it } from "vitest";

import { getDashboardStateView } from "../dashboardState";

describe("dashboard state view", () => {
  it("校验失败时返回面向客户的简洁阻断提示", () => {
    expect(
      getDashboardStateView({ kind: "blocked", reason: "发布包 SHA-256 校验失败。" }),
    ).toEqual({
      heading: "数据暂不可用",
      detail: "请稍后刷新再试。",
      blocking: true,
      cutoffDate: "暂无",
    });
  });

  it("加载完成前不把尚未读取的数据伪装成旧数据", () => {
    expect(getDashboardStateView({ kind: "loading" })).toEqual({
      heading: "正在加载数据",
      detail: "请稍候。",
      blocking: false,
    });
  });
});
