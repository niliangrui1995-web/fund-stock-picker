import { describe, expect, it } from "vitest";

import {
  LeverageLoadLifecycle,
  isAbortError,
} from "../leverageLoadLifecycle";

describe("LeverageLoadLifecycle", () => {
  it("在 StrictMode 的 setup-清理-setup 重放后重置挂载状态并创建新请求", () => {
    const lifecycle = new LeverageLoadLifecycle();

    lifecycle.setup();
    const first = lifecycle.begin();
    lifecycle.abortOnUnmount();
    lifecycle.setup();
    const replay = lifecycle.begin();

    expect(first.started).toBe(true);
    expect(first.controller.signal.aborted).toBe(true);
    expect(replay.started).toBe(true);
    expect(replay.controller).not.toBe(first.controller);
    expect(lifecycle.mayCommit(replay.controller)).toBe(true);
  });

  it("只有真实组件清理才中止当前请求；请求在栏目暂时不可见时仍可提交", () => {
    const lifecycle = new LeverageLoadLifecycle();
    lifecycle.setup();
    const request = lifecycle.begin();

    expect(lifecycle.mayCommit(request.controller)).toBe(true);
    expect(request.controller.signal.aborted).toBe(false);

    lifecycle.abortOnUnmount();

    expect(request.controller.signal.aborted).toBe(true);
    expect(lifecycle.mayCommit(request.controller)).toBe(false);
  });

  it("将 AbortError 与真实读取失败区分，避免写入 blocked 状态", () => {
    expect(isAbortError({ name: "AbortError" })).toBe(true);
    expect(isAbortError(new Error("network unavailable"))).toBe(false);
  });
});
