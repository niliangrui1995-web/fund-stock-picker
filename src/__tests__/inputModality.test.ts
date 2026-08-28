// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { installInputModalityTracking } from "../inputModality";

describe("installInputModalityTracking", () => {
  let dispose: (() => void) | undefined;

  afterEach(() => {
    dispose?.();
    dispose = undefined;
    delete document.documentElement.dataset.inputMode;
  });

  it("鼠标或触摸操作时标记为 pointer 模式", () => {
    dispose = installInputModalityTracking();

    document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));

    expect(document.documentElement.dataset.inputMode).toBe("pointer");
  });

  it("键盘导航切换为 keyboard 模式，普通输入和修饰键组合不改变模式", () => {
    dispose = installInputModalityTracking();
    document.documentElement.dataset.inputMode = "pointer";

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.documentElement.dataset.inputMode).toBe("keyboard");

    document.documentElement.dataset.inputMode = "pointer";
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    expect(document.documentElement.dataset.inputMode).toBe("pointer");

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
    expect(document.documentElement.dataset.inputMode).toBe("pointer");
  });
});
