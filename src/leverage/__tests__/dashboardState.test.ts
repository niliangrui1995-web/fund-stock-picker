import { describe, expect, it } from "vitest";

import { getDashboardStateView } from "../dashboardState";

describe("dashboard state view", () => {
  it("校验失败时返回阻断视图和可辨识的中文原因", () => {
    expect(
      getDashboardStateView({ kind: "blocked", reason: "发布包 SHA-256 校验失败。" }),
    ).toEqual({
      heading: "两融数据不可用",
      detail: "发布包 SHA-256 校验失败。",
      blocking: true,
      cutoffDate: "N/A",
    });
  });

  it("加载完成前不把尚未读取的数据伪装成旧数据", () => {
    expect(getDashboardStateView({ kind: "loading" })).toEqual({
      heading: "正在校验两融发布包",
      detail: "仅加载本机静态发布包，不访问外部行情接口。",
      blocking: false,
    });
  });
});
