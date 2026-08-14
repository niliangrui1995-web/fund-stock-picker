import { describe, expect, it, vi } from "vitest";

import { loadLeveragePackage } from "../leveragePackageLoader";

describe("loadLeveragePackage", () => {
  it("对同源静态发布包同时使用 no-cache 和同一个 AbortSignal", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      text: async () => "{}",
    }));
    const validate = vi.fn(async () => ({ ok: false as const, reason: "测试校验失败" }));

    const result = await loadLeveragePackage({
      fetchImpl,
      validate,
      signal: controller.signal,
      payloadUrl: "/data/leverage-dashboard.json",
      manifestUrl: "/data/leverage-dashboard.manifest.json",
    });

    expect(result).toEqual({ ok: false, reason: "测试校验失败" });
    expect(fetchImpl).toHaveBeenNthCalledWith(1, "/data/leverage-dashboard.json", {
      cache: "no-cache",
      signal: controller.signal,
    });
    expect(fetchImpl).toHaveBeenNthCalledWith(2, "/data/leverage-dashboard.manifest.json", {
      cache: "no-cache",
      signal: controller.signal,
    });
  });
});
