import { describe, expect, it, vi } from "vitest";

import { loadConcentrationPackage, type ConcentrationPackageFetch } from "../concentrationPackageLoader";

function response(text: string, ok = true) {
  return { ok, text: vi.fn().mockResolvedValue(text) };
}

function request(fetchImpl: ConcentrationPackageFetch, validate = vi.fn().mockResolvedValue({
  ok: false as const,
  reason: "validation failed",
})) {
  return loadConcentrationPackage({
    fetchImpl,
    validate,
    signal: new AbortController().signal,
    payloadUrl: "/payload.json",
    manifestUrl: "/manifest.json",
  });
}

describe("loadConcentrationPackage", () => {
  it("透传网络拒绝", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("network down"));
    await expect(request(fetchImpl)).rejects.toThrow("network down");
  });

  it("任一 HTTP 响应失败时拒绝", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response("payload"))
      .mockResolvedValueOnce(response("missing", false));
    await expect(request(fetchImpl)).rejects.toThrow("静态数据包不存在或无法读取");
  });

  it("响应正文读取失败时拒绝", async () => {
    const broken = response("");
    broken.text.mockRejectedValueOnce(new Error("body read failed"));
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(broken)
      .mockResolvedValueOnce(response("manifest"));
    await expect(request(fetchImpl)).rejects.toThrow("body read failed");
  });

  it("完整正文交给 validator，并返回其校验语义", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(response("payload"))
      .mockResolvedValueOnce(response("manifest"));
    const validate = vi.fn().mockResolvedValue({ ok: false, reason: "invalid JSON" });

    await expect(request(fetchImpl, validate)).resolves.toEqual({
      ok: false,
      reason: "invalid JSON",
    });
    expect(validate).toHaveBeenCalledWith("payload", "manifest");
  });
});
