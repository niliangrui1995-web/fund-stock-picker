import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const workerSource = (await readFile(new URL("../public/_worker.js", import.meta.url), "utf8"))
  .replace('import { connect } from "cloudflare:sockets";', "")
  .replace("export default {", "globalThis.worker = {");

function loadWorker() {
  const failOnNetwork = () => { throw new Error("测试不得访问网络或发送邮件。"); };
  const context = vm.createContext({
    console, TextEncoder, TextDecoder, Response, Request, URL, URLSearchParams,
    Uint8Array, AbortController, setTimeout, clearTimeout,
    fetch: failOnNetwork,
    connect: failOnNetwork,
  });
  vm.runInContext(workerSource, context);
  return context.worker;
}

function feedbackRequest(payload, headers = {}) {
  return new Request("https://fund.niliangrui.cloud/api/feedback", {
    method: "POST",
    headers: {
      origin: "https://fund.niliangrui.cloud",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(payload),
  });
}

test("反馈接口将 null、数组和原始 JSON 值返回为 400，不抛出异常", async () => {
  const worker = loadWorker();
  for (const payload of [null, [], "hello", 42, true]) {
    const response = await worker.fetch(feedbackRequest(payload), {});
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { ok: false, error: "请求内容必须为对象。" });
  }
});

test("前端允许的 1200 字中文留言和最大长度验证 token 不被字节预算误拒绝", async () => {
  const worker = loadWorker();
  const payload = {
    contact: "audit@example.com",
    message: "中".repeat(1200),
    website: "",
    page: "https://fund.niliangrui.cloud/research",
    turnstileToken: "x".repeat(2048),
  };
  const request = feedbackRequest(payload);
  assert.ok(Buffer.byteLength(JSON.stringify(payload)) > 4096);
  const response = await worker.fetch(request, {});
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { ok: false, error: "反馈安全验证尚未配置。" });
});

test("缺少 Content-Length 的超大流式请求仍返回 413", async () => {
  const response = await loadWorker().fetch(feedbackRequest({ message: "x".repeat(16_385) }), {});
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { ok: false, error: "反馈内容过长。" });
});

test("Content-Length 超过预算时在读取正文前返回 413", async () => {
  const response = await loadWorker().fetch(feedbackRequest({}, { "content-length": "16385" }), {});
  assert.equal(response.status, 413);
});
