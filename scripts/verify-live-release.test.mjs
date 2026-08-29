import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";

const moduleUrl = new URL("./verify-live-release.mjs", import.meta.url);

test("导入核验模块不会启动线上核验", async () => {
  const originalFetch = globalThis.fetch;
  const originalExitCode = process.exitCode;
  let fetchCalls = 0;

  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("unexpected live request during import");
  };

  try {
    await import(`${moduleUrl.href}?import-safety=${Date.now()}`);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    process.exitCode = originalExitCode;
  }
});

test("原始字节请求明确使用 Accept-Encoding: identity", async () => {
  const releaseModule = await import(moduleUrl.href);
  assert.equal(typeof releaseModule.fetchReleaseBytes, "function");

  let acceptEncoding = null;
  const responseBytes = Buffer.from([0x80, 0x81]);
  const server = createServer((request, response) => {
    acceptEncoding = request.headers["accept-encoding"];
    response.writeHead(200, { "content-type": "application/octet-stream" });
    response.end(responseBytes);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    const result = await releaseModule.fetchReleaseBytes(
      new URL(`http://127.0.0.1:${address.port}/release.json`),
      "test release",
    );
    assert.equal(acceptEncoding, "identity");
    assert.deepEqual(Buffer.from(result.bytes), responseBytes);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("发布字节比较不会把解码后相同的不同字节误判为一致", async () => {
  const releaseModule = await import(moduleUrl.href);
  assert.equal(typeof releaseModule.compareReleaseBytes, "function");

  const localBytes = Buffer.from([0x80]);
  const liveBytes = Buffer.from([0x81]);
  assert.equal(localBytes.toString("utf8"), liveBytes.toString("utf8"));

  const comparison = releaseModule.compareReleaseBytes(localBytes, liveBytes);
  assert.equal(comparison.matches, false);
  assert.notEqual(comparison.localSha256, comparison.liveSha256);
});

test("线上组合核验覆盖 manifest 声明的每一个股票与详情分片", async () => {
  const releaseModule = await import(moduleUrl.href);
  assert.equal(typeof releaseModule.verifyDeclaredPortfolioShards, "function");

  const bytesByPath = new Map([
    ["data/release/A.json", Buffer.from("A")],
    ["data/release/B.json", Buffer.from("tampered-B")],
    ["data/release/fund-details/aa.json", Buffer.from("detail-aa")],
    ["data/release/fund-details/bb.json", Buffer.from("detail-bb")],
  ]);
  const hash = (value) => createHash("sha256").update(value).digest("hex");
  const manifest = {
    shards: {
      A: { path: "release/A.json", sha256: hash(Buffer.from("A")) },
      B: { path: "release/B.json", sha256: hash(Buffer.from("B")) },
    },
    fundDetailShards: {
      aa: { path: "release/fund-details/aa.json", sha256: hash(Buffer.from("detail-aa")) },
      bb: { path: "release/fund-details/bb.json", sha256: hash(Buffer.from("detail-bb")) },
    },
  };
  const requested = [];
  const checks = [];

  await releaseModule.verifyDeclaredPortfolioShards(manifest, {
    concurrency: 2,
    fetchBytes: async (browserPath) => {
      requested.push(browserPath);
      return {
        bytes: bytesByPath.get(browserPath),
        headers: new Headers({
          "cache-control": "public, max-age=604800, stale-while-revalidate=86400",
        }),
      };
    },
    recordCheck: (label, passed, details = "") => checks.push({ label, passed, details }),
    urlFor: (browserPath) => browserPath,
  });

  assert.deepEqual(requested.sort(), [...bytesByPath.keys()].sort());
  assert.equal(checks.length, 1);
  assert.equal(checks[0].passed, false);
  assert.match(checks[0].details, /B\.json/);
  assert(!checks[0].details.includes("bb.json"));
});
