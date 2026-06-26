import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadQuarterConfig, ROOT } from "./quarter-config.mjs";

export const SAMPLE_CODES = ["AMD", "LITE", "COHR", "GLW", "000660", "005930", "MU", "SNDK"];
const REDIRECTS_PATH = path.join(ROOT, "public", "_redirects");
const WORKER_PATH = path.join(ROOT, "public", "_worker.js");
const TEST_ORIGIN = "https://fund.niliangrui.cloud";

export function normalizeStockCode(code) {
  return String(code ?? "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compileSource(source) {
  const keys = [];
  const pattern = source
    .split(/(:[A-Za-z][A-Za-z0-9_]*|\*)/g)
    .map((part) => {
      if (part === "*") {
        keys.push("splat");
        return "(.*)";
      }
      if (part.startsWith(":")) {
        keys.push(part.slice(1));
        return "([^/]+)";
      }
      return escapeRegExp(part);
    })
    .join("");

  return { regex: new RegExp(`^${pattern}$`), keys };
}

function parseRedirects(rawRedirects) {
  return rawRedirects
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const [source, destination, status = "302"] = line.split(/\s+/);
      return { source, destination, status, ...compileSource(source) };
    });
}

function resolveRedirect(rules, pathname) {
  for (const rule of rules) {
    const match = rule.regex.exec(pathname);
    if (!match) continue;

    const params = Object.fromEntries(rule.keys.map((key, index) => [key, match[index + 1] ?? ""]));
    const destination = rule.destination.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, (_, key) => params[key] ?? "");
    return { ...rule, destination };
  }

  return null;
}

function stockPathVariants(code) {
  const variants = [`/stocks/${code}/`, `/stocks/${code}`, `/stocks/${code}/index.html`];
  if (/[A-Z]/.test(code)) {
    const lowerCode = code.toLowerCase();
    variants.push(`/stocks/${lowerCode}/`, `/stocks/${lowerCode}`, `/stocks/${lowerCode}/index.html`);
  }
  return variants;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function stockMap(payload) {
  return new Map((payload.stocks ?? []).map((stock) => [normalizeStockCode(stock.code), stock]));
}

function expectedStockContext(stocksByNormalizedCode, code, dataLabel) {
  const expectedCode = normalizeStockCode(code);
  const expectedStock = stocksByNormalizedCode.get(expectedCode);
  assert(expectedStock, `${code} is missing from ${dataLabel}`);
  assert(
    Array.isArray(expectedStock.topByRatio) && expectedStock.topByRatio.length > 0,
    `${code} has no off-exchange fund holding result rows`,
  );

  return { expectedCode, expectedStock };
}

function noCacheHeaders() {
  return {
    "cache-control": "no-cache",
    pragma: "no-cache",
  };
}

function finalPath(url) {
  return `${url.pathname}${url.search}`;
}

export async function verifyLiveStockDeeplinks({
  liveOrigin = TEST_ORIGIN,
  stockPayload,
  sampleCodes = SAMPLE_CODES,
} = {}) {
  assert(stockPayload, "stockPayload is required for live stock deeplink verification");

  const origin = String(liveOrigin || TEST_ORIGIN).replace(/\/+$/, "");
  const expectedOrigin = new URL(origin).origin;
  const stocksByNormalizedCode = stockMap(stockPayload);
  const results = [];

  for (const code of sampleCodes) {
    const requestPath = `/stocks/${encodeURIComponent(code)}/`;

    try {
      const { expectedCode, expectedStock } = expectedStockContext(
        stocksByNormalizedCode,
        code,
        "live stock data payload",
      );
      const requestUrl = new URL(requestPath, `${origin}/`);
      const response = await fetch(requestUrl, {
        cache: "no-store",
        headers: noCacheHeaders(),
        redirect: "follow",
      });

      if (!response.ok) {
        throw new Error(`${requestUrl.href} returned ${response.status} ${response.statusText}`);
      }

      const resolvedUrl = new URL(response.url);
      const stockParam = resolvedUrl.searchParams.get("stock") ?? "";
      assert(resolvedUrl.origin === expectedOrigin, `${requestPath} landed on ${resolvedUrl.origin}`);
      assert(resolvedUrl.pathname === "/", `${requestPath} should land on /, got ${resolvedUrl.pathname}`);
      assert(
        normalizeStockCode(stockParam) === expectedCode,
        `${requestPath} should preserve stock=${code}, got ${stockParam || "(empty)"}`,
      );

      const selectedStock = stocksByNormalizedCode.get(normalizeStockCode(stockParam));
      assert(selectedStock?.code === expectedStock.code, `${requestPath} would select the wrong live stock`);

      results.push({
        code,
        passed: true,
        requestPath,
        finalPath: finalPath(resolvedUrl),
        details: `${requestUrl.href} -> ${finalPath(resolvedUrl)} -> ${selectedStock.code} (${selectedStock.topByRatio.length} result rows)`,
      });
    } catch (error) {
      results.push({
        code,
        passed: false,
        requestPath,
        finalPath: "",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return results;
}

async function main() {
  const quarterConfig = await loadQuarterConfig();
  const [redirectsRaw, workerRaw, dataRaw] = await Promise.all([
    readFile(REDIRECTS_PATH, "utf8"),
    readFile(WORKER_PATH, "utf8"),
    readFile(path.join(ROOT, quarterConfig.paths.fundStockIndexJson), "utf8"),
  ]);
  const rules = parseRedirects(redirectsRaw);
  const payload = JSON.parse(dataRaw);
  const stocksByNormalizedCode = stockMap(payload);

  for (const code of SAMPLE_CODES) {
    const { expectedCode, expectedStock } = expectedStockContext(
      stocksByNormalizedCode,
      code,
      quarterConfig.paths.fundStockIndexJson,
    );

    for (const pathname of stockPathVariants(code)) {
      const redirect = resolveRedirect(rules, pathname);
      assert(redirect, `${pathname} does not match a rule in public/_redirects`);
      assert(redirect.status === "302", `${pathname} should redirect with 302, got ${redirect.status}`);

      const targetUrl = new URL(redirect.destination, TEST_ORIGIN);
      const stockParam = targetUrl.searchParams.get("stock") ?? "";
      assert(targetUrl.pathname === "/", `${pathname} should redirect to /, got ${targetUrl.pathname}`);
      assert(
        normalizeStockCode(stockParam) === expectedCode,
        `${pathname} should preserve stock=${code}, got ${stockParam || "(empty)"}`,
      );

      const selectedStock = stocksByNormalizedCode.get(normalizeStockCode(stockParam));
      assert(selectedStock?.code === expectedStock.code, `${pathname} would select the wrong stock`);
    }

    console.log(
      `[OK] /stocks/${code}/ -> /?stock=${code} -> ${expectedStock.code} (${expectedStock.topByRatio.length} result rows)`,
    );
  }

  assert(
    workerRaw.includes("legacyStockPageRedirect(url)") &&
      workerRaw.includes('target.searchParams.set("stock", stockCode)'),
    "public/_worker.js is missing the legacy stock page redirect fallback",
  );
  console.log("[OK] public/_worker.js preserves stock context before serving assets");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
