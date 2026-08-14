export interface LeverageLoadRequest {
  controller: AbortController;
  started: boolean;
}

/**
 * 将 React effect 的挂载、StrictMode 重放和请求归属状态集中在一个可测试对象中。
 * `abortOnUnmount` 只由组件的真实/模拟卸载 cleanup 调用；栏目 active 状态不调用它。
 */
export class LeverageLoadLifecycle {
  private controller: AbortController | null = null;
  private mounted = false;

  setup(): void {
    this.mounted = true;
  }

  begin(): LeverageLoadRequest {
    if (this.controller !== null && !this.controller.signal.aborted) {
      return { controller: this.controller, started: false };
    }

    this.controller = new AbortController();
    return { controller: this.controller, started: true };
  }

  mayCommit(controller: AbortController): boolean {
    return (
      this.mounted &&
      this.controller === controller &&
      !controller.signal.aborted
    );
  }

  clear(controller: AbortController): void {
    if (this.controller === controller) {
      this.controller = null;
    }
  }

  abortOnUnmount(): void {
    this.mounted = false;
    const activeController = this.controller;
    this.controller = null;
    activeController?.abort();
  }
}

export function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "AbortError"
  );
}
