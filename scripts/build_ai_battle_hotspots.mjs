import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadQuarterConfig } from "./quarter-config.mjs";

const SOURCE_PATH = path.join("config", "ai-battle-hotspot-sources.json");
const OUTPUT_PATH = path.join("config", "ai-battle-hotspots.json");

function normalizeCode(code) {
  return String(code ?? "").trim().toUpperCase();
}

function formatPercent(value) {
  return typeof value === "number" && Number.isFinite(value) ? `${value.toFixed(2).replace(/\.?0+$/, "")}%` : "未估算";
}

function parseCsvLine(line) {
  const fields = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

async function readOptionalText(filePath) {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function buildExposureLookup(rows) {
  const byCode = new Map();
  for (const row of rows) {
    const code = normalizeCode(row["证券代码"]);
    const scope = row["口径"]?.trim();
    const category = row["分类"]?.trim();
    if (!code || !scope || !category) continue;

    const current = byCode.get(code) ?? new Map();
    const key = `${scope} / ${category}`;
    current.set(key, (current.get(key) ?? 0) + 1);
    byCode.set(code, current);
  }

  return new Map(
    Array.from(byCode.entries()).map(([code, groups]) => {
      const [label] = Array.from(groups.entries()).sort(
        (left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "zh-CN"),
      )[0];
      return [code, label];
    }),
  );
}

function loadStockLookup(payload) {
  if (!Array.isArray(payload?.stocks)) {
    throw new Error("Current fund stock index JSON must contain a stocks array.");
  }
  return new Map(payload.stocks.map((stock) => [normalizeCode(stock.code), stock]));
}

function validateSources(sources) {
  if (!Array.isArray(sources)) {
    throw new Error(`${SOURCE_PATH} must contain an array.`);
  }

  const seen = new Set();
  for (const [index, item] of sources.entries()) {
    const code = normalizeCode(item?.code);
    if (!code) {
      throw new Error(`${SOURCE_PATH}[${index}] must contain code.`);
    }
    if (!item?.source || !item?.signal || !item?.thesis) {
      throw new Error(`${SOURCE_PATH}[${index}] must contain source, signal and thesis.`);
    }
    if ("homepageQuickEntry" in item && typeof item.homepageQuickEntry !== "boolean") {
      throw new Error(`${SOURCE_PATH}[${index}].homepageQuickEntry must be a boolean when present.`);
    }
    if (seen.has(code)) {
      throw new Error(`${SOURCE_PATH} contains duplicate hotspot code: ${code}.`);
    }
    seen.add(code);
  }
}

function buildEvidence(source, stock, exposureLabel, report) {
  const sourceEvidence = `${source.source}：${source.signal}`;
  const exposureEvidence = exposureLabel ? [`海外 AI 暴露表：${exposureLabel}`] : [];
  const fundEvidence = typeof stock.offExchangeFundCount === "number"
    ? `${report} 基金持仓索引：场外 ${stock.offExchangeFundCount} 只（与单股结果同口径，按基金家族去重）`
    : `${report} 基金持仓索引：主动基金 ${stock.activeFundCount ?? 0} 只，直接持仓最高占比 ${formatPercent(stock.maxRatioPercent)}`;
  return [sourceEvidence, ...exposureEvidence, fundEvidence].join("；");
}

async function main() {
  const quarterConfig = await loadQuarterConfig();
  const [sourceRaw, payloadRaw, exposureRaw] = await Promise.all([
    readFile(SOURCE_PATH, "utf8"),
    readFile(quarterConfig.paths.fundStockIndexJson, "utf8"),
    readOptionalText(quarterConfig.paths.overseasAiPositionDetailsCsv),
  ]);

  const sources = JSON.parse(sourceRaw);
  validateSources(sources);

  const payload = JSON.parse(payloadRaw);
  if (payload?.meta?.report !== quarterConfig.report) {
    throw new Error(
      `Configured quarter is ${quarterConfig.report}, but ${quarterConfig.paths.fundStockIndexJson} contains ${
        payload?.meta?.report || "unknown"
      }.`,
    );
  }

  const stocksByCode = loadStockLookup(payload);
  const exposureByCode = buildExposureLookup(exposureRaw ? parseCsv(exposureRaw) : []);
  const hotspots = sources.map((source) => {
    const code = normalizeCode(source.code);
    const stock = stocksByCode.get(code);
    if (!stock) {
      throw new Error(`${SOURCE_PATH} references ${code}, but it is missing from ${quarterConfig.paths.fundStockIndexJson}.`);
    }

    const hotspot = {
      code: stock.code,
      label: `${stock.code} / ${stock.name}`,
      track: source.track || exposureByCode.get(code) || stock.name,
      thesis: source.thesis,
      evidence: buildEvidence(source, stock, exposureByCode.get(code), quarterConfig.report),
    };
    if (source.homepageQuickEntry) {
      hotspot.homepageQuickEntry = true;
    }
    return hotspot;
  });

  await writeFile(OUTPUT_PATH, `${JSON.stringify(hotspots, null, 2)}\n`, "utf8");
  console.log(`Generated ${hotspots.length} AI battle hotspots from ${SOURCE_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
