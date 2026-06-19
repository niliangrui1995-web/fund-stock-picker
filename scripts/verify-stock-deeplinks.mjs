import { readFile } from "node:fs/promises";
import path from "node:path";

import { loadQuarterConfig, ROOT } from "./quarter-config.mjs";

const SAMPLE_CODES = ["AMD", "LITE", "COHR", "000660"];
const REDIRECTS_PATH = path.join(ROOT, "public", "_redirects");
const WORKER_PATH = path.join(ROOT, "public", "_worker.js");
const TEST_ORIGIN = "https://fund.niliangrui.cloud";

function normalizeStockCode(code) {
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

async function main() {
  const quarterConfig = await loadQuarterConfig();
  const [redirectsRaw, workerRaw, dataRaw] = await Promise.all([
    readFile(REDIRECTS_PATH, "utf8"),
    readFile(WORKER_PATH, "utf8"),
    readFile(path.join(ROOT, quarterConfig.paths.fundStockIndexJson), "utf8"),
  ]);
  const rules = parseRedirects(redirectsRaw);
  const payload = JSON.parse(dataRaw);
  const stocksByNormalizedCode = new Map(
    (payload.stocks ?? []).map((stock) => [normalizeStockCode(stock.code), stock]),
  );

  for (const code of SAMPLE_CODES) {
    const expectedCode = normalizeStockCode(code);
    const expectedStock = stocksByNormalizedCode.get(expectedCode);
    assert(expectedStock, `${code} is missing from ${quarterConfig.paths.fundStockIndexJson}`);
    assert(
      Array.isArray(expectedStock.topByRatio) && expectedStock.topByRatio.length > 0,
      `${code} has no off-exchange fund holding result rows`,
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

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
