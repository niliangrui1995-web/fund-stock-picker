import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { loadQuarterConfig } from "./quarter-config.mjs";

const SITE_URL = "https://fund.niliangrui.cloud";
const STOCKS_DIR = path.join("public", "stocks");
const SEO_DIR = path.join("public", "seo");
const AI_BATTLE_HOTSPOTS_PATH = path.join("config", "ai-battle-hotspots.json");
const LASTMOD = process.env.SEO_LASTMOD || new Date().toISOString().slice(0, 10);
const DEFAULT_SEO_PAGE_LIMIT = 120;
const POPULAR_STOCK_SCORE_BOOST = 1_000_000_000;

const valueFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 2,
});
const integerFormatter = new Intl.NumberFormat("zh-CN");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatWan(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "未披露";
  }
  if (value >= 10000) {
    return `${valueFormatter.format(value / 10000)} 亿`;
  }
  return `${valueFormatter.format(value)} 万`;
}

function slugFor(code) {
  return String(code).trim().toLowerCase().replace(/[^0-9a-z]+/g, "-").replace(/^-+|-+$/g, "");
}

function normalizeCodeValue(code) {
  return String(code ?? "").trim().toUpperCase();
}

function normalizedStockCode(stock) {
  return normalizeCodeValue(stock?.code);
}

function finiteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function widthClass(value) {
  const width = Math.max(0, Math.min(100, Math.round(finiteNumber(value))));
  return `width-pct-${width}`;
}

function percentageWidthCss() {
  return Array.from({ length: 101 }, (_, width) => `.width-pct-${width} { width: ${width}%; }`).join("\n");
}

function seoPageLimit(stockCount) {
  const configuredLimit = Number.parseInt(process.env.SEO_PAGE_LIMIT ?? "", 10);
  if (!Number.isFinite(configuredLimit) || configuredLimit <= 0) {
    return Math.min(DEFAULT_SEO_PAGE_LIMIT, stockCount);
  }
  return Math.min(configuredLimit, stockCount);
}

function buildPopularRanks(popularStocks) {
  const ranks = new Map();
  for (const [index, stock] of (popularStocks ?? []).entries()) {
    const code = normalizedStockCode(stock);
    if (code && !ranks.has(code)) {
      ranks.set(code, index);
    }
  }
  return ranks;
}

function stockPriorityScore(stock, popularRank) {
  const popularBoost = popularRank === undefined ? 0 : POPULAR_STOCK_SCORE_BOOST - popularRank;
  return (
    popularBoost +
    finiteNumber(stock.activeFundCount) * 10_000 +
    finiteNumber(stock.fundCount) * 1_000 +
    finiteNumber(stock.onExchangeFundCount) * 250 +
    Math.log10(finiteNumber(stock.totalMarketValueWan) + 1) * 100 +
    finiteNumber(stock.maxRatioPercent)
  );
}

function isSeoStockCandidate(stock) {
  return Boolean(
    normalizedStockCode(stock) &&
      stock?.name &&
      (finiteNumber(stock.activeFundCount) > 0 || finiteNumber(stock.onExchangeFundCount) > 0),
  );
}

function selectSeoStocks(payload, forcedCodes = []) {
  if (!Array.isArray(payload.stocks)) {
    throw new Error("Invalid fund stock payload: missing stocks array");
  }

  const popularRanks = buildPopularRanks(payload.popularStocks);
  const rankedStocks = payload.stocks
    .filter(isSeoStockCandidate)
    .map((stock) => {
      const code = normalizedStockCode(stock);
      return {
        stock,
        code,
        slug: slugFor(code),
        score: stockPriorityScore(stock, popularRanks.get(code)),
      };
    })
    .filter((item) => item.slug)
    .sort(
      (left, right) =>
        right.score - left.score ||
        finiteNumber(right.stock.activeFundCount) - finiteNumber(left.stock.activeFundCount) ||
        finiteNumber(right.stock.fundCount) - finiteNumber(left.stock.fundCount) ||
        left.code.localeCompare(right.code, "en"),
    );

  const selectedStocks = [];
  const selectedSlugs = new Set();
  const rankedByCode = new Map(rankedStocks.map((item) => [item.code, item]));
  for (const code of forcedCodes.map(normalizeCodeValue).filter(Boolean)) {
    const item = rankedByCode.get(code);
    if (!item || selectedSlugs.has(item.slug)) {
      continue;
    }
    selectedStocks.push(item.stock);
    selectedSlugs.add(item.slug);
  }

  const limit = seoPageLimit(rankedStocks.length);
  for (const item of rankedStocks) {
    if (selectedSlugs.has(item.slug)) {
      continue;
    }
    selectedStocks.push(item.stock);
    selectedSlugs.add(item.slug);
    if (selectedStocks.length >= limit) {
      break;
    }
  }

  if (!selectedStocks.length) {
    throw new Error("No SEO stock records selected from current fund data");
  }

  return selectedStocks;
}

function fundDisplayName(fund) {
  return fund.fundVariantCount && fund.fundVariantCount > 1 && fund.fundDisplayName
    ? fund.fundDisplayName
    : fund.fundName;
}

function uniqueFundCodes(fund) {
  return Array.from(new Set([fund.fundCode, ...(fund.fundVariantCodes ?? [])].filter(Boolean)));
}

function fundHoldingsFor(fundHoldings, fund) {
  for (const code of uniqueFundCodes(fund)) {
    const rows = fundHoldings?.[code];
    if (Array.isArray(rows) && rows.length) {
      return rows;
    }
  }
  return [];
}

function fundCellAttributes(fundHoldings, fund, currentStock) {
  const fundName = fundDisplayName(fund);
  const fundCodes = uniqueFundCodes(fund).join(" / ");
  const holdings = fundHoldingsFor(fundHoldings, fund);

  return [
    'class="fund-cell js-fund-cell"',
    'tabindex="0"',
    'role="button"',
    `aria-label="查看 ${escapeHtml(fundName)} 前十大持仓"`,
    `data-fund-name="${escapeHtml(fundName)}"`,
    `data-fund-codes="${escapeHtml(fundCodes)}"`,
    `data-current-stock-code="${escapeHtml(currentStock?.code ?? "")}"`,
    `data-holdings="${escapeHtml(JSON.stringify(holdings))}"`,
  ].join(" ");
}

const japaneseStockNamePattern =
  /东京|丰田|索尼|日立|三菱|任天堂|软银|本田|东京电子|三井|佳能|住友|瑞穗|武田|迅销|基恩士|信越|村田|电装|尼康|日本/;
const koreanStockNamePattern =
  /三星电子|SK海力士|现代汽车|起亚|LG|NAVER|Kakao|浦项|POSCO|Celltrion|韩华|韩国电力/;

function normalizeStockCode(code) {
  return String(code ?? "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

function stockMarketBucket(code, name = "") {
  const normalized = String(code ?? "").trim().toUpperCase();
  if (/^\d{5}$/.test(normalized)) return "hk";
  if (/^\d{4}\.(T|JP)$/.test(normalized)) return "jp";
  if (/^\d{6}\.(KS|KQ)$/.test(normalized)) return "kr";
  if (/^[A-Z]{1,5}([.-][A-Z]{1,2})?$/.test(normalized)) return "us";
  if (/^\d{4}$/.test(normalized)) return japaneseStockNamePattern.test(name) ? "jp" : "other";
  if (/^\d{6}$/.test(normalized) && koreanStockNamePattern.test(name)) return "kr";
  if (/^A\d+$/.test(normalized)) return "a";
  if (/^\d{6}$/.test(normalized)) return "a";
  return "other";
}

function isOverseasStockCode(code, name = "") {
  return stockMarketBucket(code, name) !== "a";
}

function marketLabel(code, name = "") {
  const bucket = stockMarketBucket(code, name);
  if (bucket === "hk") return "港股";
  if (bucket === "jp") return "日股";
  if (bucket === "kr") return "韩股";
  if (bucket === "us") return "美股";
  return bucket === "other" ? "其他" : "A股";
}

function localStockLogoUrl(code) {
  return `/stock-logos/${normalizeStockCode(code).toLowerCase()}.png`;
}

function stockLogo(stock, size = "") {
  const code = normalizeStockCode(stock.code);
  const fallback = code.slice(0, 3) || "STK";
  return `<span class="stock-logo ${size}">
    <span class="logo-fallback" aria-hidden="true">${escapeHtml(fallback)}</span>
    <img src="${escapeHtml(localStockLogoUrl(stock.code))}" alt="${escapeHtml(stock.name)} 品牌图标" loading="lazy" />
  </span>`;
}

function tradeStatusTone(status) {
  if (!status) return "neutral";
  if (/暂停|停止|封闭|终止|不可|失败/.test(status)) return "blocked";
  if (/限制|限大额/.test(status)) return "limited";
  if (/开放/.test(status)) return "open";
  return "neutral";
}

function formatSharesWan(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "未披露";
  }
  return `${valueFormatter.format(value)} 万股`;
}

function formatPercent(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? `${valueFormatter.format(value)}%`
    : "未估算";
}

function iconSvg(name) {
  const paths = {
    arrow: '<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
    bar: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
    calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.7 8.8a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.5a1.3 1.3 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    sliders: '<path d="M10 6h10"/><path d="M4 6h2"/><path d="M7 6h.01"/><path d="M14 18h6"/><path d="M4 18h6"/><path d="M11 18h.01"/><path d="M18 12h2"/><path d="M4 12h10"/><path d="M15 12h.01"/>',
  };
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name] ?? ""}</svg>`;
}

function marketShortcuts(currentMarket) {
  return [
    ["us", "美股"],
    ["jp", "日股"],
    ["kr", "韩股"],
    ["hk", "港股"],
    ["other", "其他"],
  ]
    .map(
      ([key, label]) =>
        `<span class="market-shortcut ${key === currentMarket ? "active" : ""}">${escapeHtml(label)}</span>`,
    )
    .join("");
}

function tradeStatusHtml(fund) {
  return `<div class="status-stack">
    <span class="trade-pill ${tradeStatusTone(fund.purchaseStatus)}">${escapeHtml(fund.purchaseStatus || "申购 --")}</span>
    <span class="trade-pill ${tradeStatusTone(fund.redemptionStatus)}">${escapeHtml(fund.redemptionStatus || "赎回 --")}</span>
  </div>`;
}

function fundRows(funds, fundHoldings, currentStock) {
  const maxRatio = Math.max(...funds.map((fund) => finiteNumber(fund.ratioPercent)), 1);
  const maxValue = Math.max(...funds.map((fund) => finiteNumber(fund.marketValueWan)), 1);

  return funds
    .slice(0, 10)
    .map((fund, index) => {
      const codes = uniqueFundCodes(fund).join(" / ");
      const ratioWidth = Math.min((finiteNumber(fund.ratioPercent) / maxRatio) * 100, 100);
      const valueWidth =
        typeof fund.marketValueWan === "number" && Number.isFinite(fund.marketValueWan)
          ? Math.min((fund.marketValueWan / maxValue) * 100, 100)
          : 0;
      const tradeLimits = [
        fund.dailyPurchaseLimit ? `<span class="trade-limit">日限 ${escapeHtml(fund.dailyPurchaseLimit)}</span>` : "",
        fund.minPurchase ? `<span class="trade-limit">起购 ${escapeHtml(fund.minPurchase)}</span>` : "",
      ]
        .filter(Boolean)
        .join("");
      const tradeLimitRow = tradeLimits ? `
          <div class="fund-trade-row">${tradeLimits}</div>` : "";
      return `<tr>
        <td><span class="rank rank-${index + 1}">${index + 1}</span></td>
        <td ${fundCellAttributes(fundHoldings, fund, currentStock)}>
          <div class="fund-name" title="${escapeHtml(fund.fundName)}">${escapeHtml(fundDisplayName(fund))}</div>
          <div class="fund-code"><span class="fund-code-list">${escapeHtml(codes)}</span></div>${tradeLimitRow}
        </td>
        <td><span class="fund-type-badge">${escapeHtml(fund.fundType || "未分类")}</span></td>
        <td class="strong">
          <div class="table-metric-cell">
            <span class="metric-num">${valueFormatter.format(fund.ratioPercent)}%</span>
            <div class="table-progress-track"><div class="table-progress-fill ${widthClass(ratioWidth)}"></div></div>
          </div>
        </td>
        <td>
          <div class="table-metric-cell cell-passive">
            <span class="metric-num-passive">${escapeHtml(formatWan(fund.marketValueWan))}</span>
            <div class="table-progress-track passive-track"><div class="table-progress-fill passive-fill ${widthClass(valueWidth)}"></div></div>
          </div>
        </td>
        <td class="shares-cell">${escapeHtml(formatSharesWan(fund.sharesWan))}</td>
        <td>${tradeStatusHtml(fund)}</td>
      </tr>`;
    })
    .join("\n");
}

function fundTable(funds, accessLabel, fundHoldings = {}, currentStock = null) {
  if (!funds?.length) {
    return `<div class="table-empty">暂无${escapeHtml(accessLabel)}基金持仓记录</div>`;
  }

  return `<div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>排名</th>
          <th>基金</th>
          <th>类型</th>
          <th>净值占比</th>
          <th>持仓市值</th>
          <th>持股数</th>
          <th>交易状态</th>
        </tr>
      </thead>
      <tbody>${fundRows(funds, fundHoldings, currentStock)}</tbody>
    </table>
  </div>`;
}

function indirectExposureRows(exposures, fundHoldings, currentStock) {
  const maxRawRatio = Math.max(...exposures.map((fund) => finiteNumber(fund.ratioPercent)), 1);
  const maxEstimatedRatio = Math.max(
    ...exposures.map((fund) => finiteNumber(fund.estimatedRatioPercent ?? fund.ratioPercent)),
    1,
  );

  return exposures
    .slice(0, 10)
    .map((fund, index) => {
      const codes = uniqueFundCodes(fund).join(" / ");
      const rawWidth = Math.min((finiteNumber(fund.ratioPercent) / maxRawRatio) * 100, 100);
      const estimatedRatio =
        typeof fund.estimatedRatioPercent === "number" ? fund.estimatedRatioPercent : null;
      const estimatedWidth =
        estimatedRatio === null
          ? rawWidth
          : Math.min((finiteNumber(estimatedRatio) / maxEstimatedRatio) * 100, 100);
      const leverageLabel = fund.leverageMultiple
        ? `${valueFormatter.format(fund.leverageMultiple)}x`
        : "杠杆";
      return `<tr>
        <td><span class="rank rank-${index + 1}">${index + 1}</span></td>
        <td ${fundCellAttributes(fundHoldings, fund, currentStock)}>
          <div class="fund-name" title="${escapeHtml(fund.fundName)}">${escapeHtml(fundDisplayName(fund))}</div>
          <div class="fund-code"><span class="fund-code-list">${escapeHtml(codes)}</span></div>
        </td>
        <td>
          <div class="indirect-product-name" title="${escapeHtml(fund.sourceName)}">${escapeHtml(fund.sourceName)}</div>
          <div class="indirect-product-code">
            <span>${escapeHtml(fund.sourceCode)}</span>
            <span class="leverage-pill">${escapeHtml(leverageLabel)}</span>
          </div>
        </td>
        <td class="strong">
          <div class="table-metric-cell">
            <span class="metric-num">${valueFormatter.format(fund.ratioPercent)}%</span>
            <div class="table-progress-track"><div class="table-progress-fill ${widthClass(rawWidth)}"></div></div>
          </div>
        </td>
        <td class="strong">
          <div class="table-metric-cell">
            <span class="metric-num estimated-num">${escapeHtml(formatPercent(estimatedRatio))}</span>
            <div class="table-progress-track"><div class="table-progress-fill estimated-fill ${widthClass(estimatedWidth)}"></div></div>
          </div>
        </td>
        <td>
          <div class="table-metric-cell cell-passive">
            <span class="metric-num-passive">${escapeHtml(formatWan(fund.marketValueWan))}</span>
          </div>
        </td>
        <td>${tradeStatusHtml(fund)}</td>
      </tr>`;
    })
    .join("\n");
}

function indirectExposureTable(exposures, fundHoldings = {}, currentStock = null) {
  if (!exposures?.length) {
    return "";
  }

  return `<div class="indirect-exposure-panel" aria-labelledby="indirect-exposure-title">
    <div id="indirect-exposure" class="section-title section-title-spaced">
      <h2 id="indirect-exposure-title">间接 / 杠杆 ETF 暴露</h2>
      <span>${iconSvg("arrow")}不并入正股直接持仓，按估算经济暴露排序</span>
    </div>
    <p class="indirect-note">这里展示基金持有的海外个股杠杆 ETF / ETP / ETN 等产品。原占净值来自基金披露，估算暴露按产品杠杆倍数折算，仅作方向性穿透。</p>
    <div class="table-wrap indirect-table-wrap">
      <table>
        <thead>
          <tr>
            <th>排名</th>
            <th>基金</th>
            <th>杠杆产品</th>
            <th>原占净值</th>
            <th>估算暴露</th>
            <th>持仓市值</th>
            <th>交易状态</th>
          </tr>
        </thead>
        <tbody>${indirectExposureRows(exposures, fundHoldings, currentStock)}</tbody>
      </table>
    </div>
  </div>`;
}

async function loadAiBattleHotspots() {
  const raw = await readFile(AI_BATTLE_HOTSPOTS_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`${AI_BATTLE_HOTSPOTS_PATH} must contain an array.`);
  }
  return parsed.filter((item) => item?.code && item?.label);
}

function selectHotspotStocks(payload, hotspots) {
  const byCode = new Map((payload.stocks ?? []).map((stock) => [normalizedStockCode(stock), stock]));
  return hotspots
    .map((hotspot) => {
      const stock = byCode.get(normalizeCodeValue(hotspot.code));
      return stock ? { hotspot, stock } : null;
    })
    .filter(Boolean);
}

function aiHotspotSection(currentStock, hotspotItems) {
  if (!hotspotItems.length) {
    return "";
  }

  const currentCode = normalizedStockCode(currentStock);
  const links = hotspotItems
    .map(({ hotspot, stock }) => {
      const isCurrent = normalizedStockCode(stock) === currentCode;
      return `<a class="ai-hotspot-link ${isCurrent ? "active" : ""}" href="/stocks/${slugFor(stock.code)}/">
        ${stockLogo(stock)}
        <span>
          <strong>${escapeHtml(hotspot.label)}</strong>
          <em>${escapeHtml(hotspot.track || stock.code)}</em>
        </span>
        <b>${integerFormatter.format(finiteNumber(stock.activeFundCount))} 只</b>
      </a>`;
    })
    .join("\n");

  return `<section class="ai-hotspot-section" aria-labelledby="ai-hotspot-title">
    <div class="ai-hotspot-head">
      <span>AI 战报热点</span>
      <h2 id="ai-hotspot-title">最近高频标的一键穿透</h2>
      <p>基于邮件战报高频线索、海外 AI 暴露表和 ${escapeHtml(currentStock.code)} 当前持仓索引生成。</p>
    </div>
    <div class="ai-hotspot-links">${links}</div>
  </section>`;
}

function stockPage(stock, payload, hotspotItems = []) {
  const meta = payload.meta;
  const fundHoldings = payload.fundHoldings ?? {};
  const slug = slugFor(stock.code);
  const canonical = `${SITE_URL}/stocks/${slug}/`;
  const appUrl = `/?q=${encodeURIComponent(stock.code)}`;
  const title = `${stock.name}（${stock.code}）被哪些国内基金重仓？${meta.report} 公募持仓穿透`;
  const market = marketLabel(stock.code, stock.name);
  const marketBucket = stockMarketBucket(stock.code, stock.name);
  const activeFundCount = finiteNumber(stock.activeFundCount);
  const onExchangeFundCount = finiteNumber(stock.onExchangeFundCount);
  const indirectExposureFundCount = finiteNumber(stock.indirectExposureFundCount);
  const maxRatio = finiteNumber(stock.maxRatioPercent);
  const onExchangeMaxRatio = finiteNumber(stock.onExchangeMaxRatioPercent);
  const indirectDescription = indirectExposureFundCount
    ? `另有 ${indirectExposureFundCount} 只基金通过海外个股杠杆 ETF/ETP/ETN 形成间接暴露。`
    : "";
  const description = `${stock.name}（${stock.code}）${meta.report} 公募基金持仓穿透：场外主动口径 ${activeFundCount} 只基金持有，最高净值占比 ${valueFormatter.format(maxRatio)}%，场内 ETF/LOF 口径 ${onExchangeFundCount} 只。${indirectDescription}`;

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${canonical}" />
    <link rel="stylesheet" href="/seo/stock-page.css" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="出海钱眼" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${SITE_URL}/og-image.svg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${SITE_URL}/og-image.svg" />
  </head>
  <body>
    <main class="app-shell">
      <header class="topbar">
        <a class="brand-mark" href="/">
          <span>出海钱眼</span>
          基金持仓穿透
        </a>
        <nav class="topbar-nav" aria-label="当前功能区">
          <a class="active" href="#research" aria-current="page">研究</a>
          <a href="#methodology">方法论</a>
        </nav>
        <div class="topbar-meta">
          <span>${iconSvg("calendar")}${escapeHtml(meta.report)}</span>
          <span>${iconSvg("database")}${integerFormatter.format(meta.overseasStockCount ?? meta.stockCount)} 海外标的</span>
        </div>
      </header>

      <section id="research" class="search-zone">
        <div class="command-panel">
          <div class="panel-status">
            <span>全球股票 / 指数 / ETF</span>
          </div>
          <div class="seo-search-box">
            ${iconSvg("search")}
            <div class="seo-query">
              <span>当前静态页</span>
              <strong>${escapeHtml(stock.name)} <em>${escapeHtml(stock.code)}</em></strong>
            </div>
            <a class="search-action" href="${escapeHtml(appUrl)}">${iconSvg("search")}完整查询</a>
          </div>
        </div>

        <div class="recent-panel" aria-label="页面快照">
          <div class="panel-status">
            <span>页面快照</span>
          </div>
          <div class="recent-chips">
            <span>${escapeHtml(market)}</span>
            <span>${escapeHtml(meta.report)}</span>
            <span>SEO 静态页</span>
          </div>
        </div>

        <div class="summary-card" aria-label="基金数据总览">
          <span>全市场基金总数</span>
          <strong>${integerFormatter.format(meta.fundCount ?? meta.sourceRows)} 只</strong>
          <small>覆盖中外市场</small>
        </div>
      </section>

      <section class="selected-context" aria-label="当前研究上下文">
        <div>
          <span>数据期</span>
          <strong>${escapeHtml(meta.report)}</strong>
        </div>
        <div>
          <span>数据截至</span>
          <strong>${escapeHtml(meta.cutoffDate)}</strong>
        </div>
        <div>
          <span>海外标的</span>
          <strong>${integerFormatter.format(meta.overseasStockCount ?? meta.stockCount)} 只</strong>
        </div>
        <div>
          <span>持仓明细</span>
          <strong>${integerFormatter.format(meta.holdingRows ?? meta.sourceRows)} 条</strong>
        </div>
      </section>

      ${aiHotspotSection(stock, hotspotItems)}

      <section class="workspace has-selection">
        <aside class="left-panel" aria-label="股票候选">
          <div class="left-panel-top">
            <div class="panel-heading">
              <h2>当前标的</h2>
              <span>1 项</span>
            </div>
            <div class="market-shortcuts" aria-label="海外热门市场筛选">
              ${marketShortcuts(marketBucket)}
            </div>
          </div>
          <div class="candidate-list">
            <a class="candidate selected" href="${escapeHtml(appUrl)}">
              <span class="candidate-identity">
                ${stockLogo(stock)}
                <span class="candidate-main">
                  <span class="candidate-title-row">
                    <strong>${escapeHtml(stock.name)}</strong>
                    <span class="market-badge">${escapeHtml(market)}</span>
                  </span>
                  <em>${escapeHtml(stock.code)}</em>
                </span>
              </span>
              <span>
                ${integerFormatter.format(activeFundCount)} 只场外基金
                <small>最高 ${valueFormatter.format(maxRatio)}%</small>
              </span>
            </a>
          </div>
        </aside>

        <section class="results-panel">
          <div class="result-header">
            <div>
              <p class="eyeline">${isOverseasStockCode(stock.code, stock.name) ? "当前海外标的" : "当前标的"}</p>
              <div class="result-title-row">
                ${stockLogo(stock, "large")}
                <h1>
                  ${escapeHtml(stock.name)}
                  <span>${escapeHtml(stock.code)}</span>
                </h1>
              </div>
              <div class="result-tags">
                <span>${escapeHtml(market)}</span>
                <span>${escapeHtml(meta.report)}</span>
                <span>场外持仓</span>
              </div>
            </div>
            <div class="segmented" aria-label="基金交易场景">
              <a class="active" href="#off-exchange">${iconSvg("sliders")}场外</a>
              <a href="#on-exchange">${iconSvg("bar")}场内</a>
            </div>
          </div>

          <div class="metrics-grid">
            <section class="metric">
              <div class="metric-icon">${iconSvg("shield")}</div>
              <div>
                <p>场外基金覆盖</p>
                <strong>${integerFormatter.format(activeFundCount)} 只</strong>
              </div>
            </section>
            <section class="metric">
              <div class="metric-icon">${iconSvg("sliders")}</div>
              <div>
                <p>最高净值占比</p>
                <strong>${valueFormatter.format(maxRatio)}%</strong>
              </div>
            </section>
            <section class="metric">
              <div class="metric-icon">${iconSvg("bar")}</div>
              <div>
                <p>场外持仓市值</p>
                <strong>${escapeHtml(formatWan(stock.totalMarketValueWan))}</strong>
              </div>
            </section>
          </div>

          <div id="off-exchange" class="section-title">
            <h2>前 10 名场外基金持仓明细</h2>
            <span>${iconSvg("arrow")}剔除指数和 ETF，按净值占比排序</span>
          </div>
          ${fundTable(stock.topByRatio ?? [], "场外", fundHoldings, stock)}

          <div id="on-exchange" class="section-title section-title-spaced">
            <h2>前 10 名场内基金持仓明细</h2>
            <span>${iconSvg("arrow")}ETF / LOF 等场内品种，按净值占比排序；本页最高 ${valueFormatter.format(onExchangeMaxRatio)}%</span>
          </div>
          ${fundTable(stock.topOnExchangeByRatio ?? [], "场内", fundHoldings, stock)}
${indirectExposureTable(stock.topIndirectExposureByRatio ?? [], fundHoldings, stock)}
        </section>
      </section>

      <section id="methodology" class="methodology-section" aria-labelledby="methodology-title">
        <div class="methodology-head">
          <span>方法论</span>
          <h2 id="methodology-title">基金持仓穿透口径</h2>
          <p>
            数据期为 ${escapeHtml(meta.report)}，截至 ${escapeHtml(meta.cutoffDate)}。页面优先展示海外标的在公募基金披露持仓中的覆盖、权重和可交易状态。
          </p>
        </div>
        <div class="methodology-grid">
          <article>
            <strong>场外样本</strong>
            <p>剔除指数、ETF、ETF 联接等被动跟踪基金，保留主动基金里对单只股票的高权重表达。</p>
          </article>
          <article>
            <strong>场内样本</strong>
            <p>ETF、LOF、封闭式基金和 REIT 单独归入场内视图，便于和场外主动配置分开判断。</p>
          </article>
          <article>
            <strong>间接暴露</strong>
            <p>海外个股杠杆 ETF/ETP/ETN 通过名称和配置映射回正股，单独展示原始占比和估算经济暴露。</p>
          </article>
          <article>
            <strong>排序规则</strong>
            <p>默认按个股占基金净值比例排序；持仓市值缺失时保留披露状态，不用估算值替代。</p>
          </article>
          <article>
            <strong>份额合并</strong>
            <p>同一基金的 A/C、币种、前后端份额合并展示，同时保留全部基金代码供回查。</p>
          </article>
        </div>
      </section>

      <footer class="compliance-disclaimer">
        <strong>免责声明</strong>
        <p>
          本页面基于公开基金定期报告、基金持仓明细及申赎状态整理，仅供信息展示和研究参考，不构成任何投资建议、基金推荐、销售邀约或收益承诺。基金持仓、申购赎回、费率和限额可能存在披露滞后或实时变化，请以基金管理人、基金销售机构及监管披露文件为准。基金有风险，投资需谨慎。
        </p>
        <button class="share-action" type="button" data-share-url="${canonical}" data-share-title="${escapeHtml(title)}">分享页面</button>
      </footer>
    </main>
    <script src="/seo/share.js" defer></script>
  </body>
</html>
`;
}

function stockPageCss() {
  return `:root {
  color: #152033;
  background: #f4f7fb;
  font-family: "Microsoft YaHei UI", "PingFang SC", "Noto Sans SC", system-ui, sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;

  --bg: #f4f7fb;
  --surface: #ffffff;
  --surface-soft: #f8fbff;
  --nav: #07111f;
  --nav-soft: #0c1a2d;
  --ink: #152033;
  --ink-strong: #0d1524;
  --muted: #64748b;
  --muted-strong: #475569;
  --line: #dce5ef;
  --line-soft: #edf2f7;
  --accent: #f01824;
  --accent-soft: #fff0f1;
  --blue: #1769e8;
  --blue-soft: #eef5ff;
  --green: #15a866;
  --green-soft: #eafaf2;
  --amber: #b7791f;
  --amber-soft: #fff7e8;
  --danger: #e11d30;
  --shadow-soft: 0 16px 40px rgba(15, 23, 42, 0.08);
  --shadow-tiny: 0 1px 2px rgba(15, 23, 42, 0.04);
  --ease: cubic-bezier(0.16, 1, 0.3, 1);
}

* {
  box-sizing: border-box;
}

html {
  background: var(--bg);
  scroll-behavior: smooth;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  overflow-x: hidden;
  background:
    linear-gradient(180deg, #eef3f8 0, #f8fbff 148px, #f4f7fb 100%);
}

button,
input,
textarea {
  font: inherit;
}

a {
  color: var(--blue);
  text-decoration: underline;
  text-underline-offset: 4px;
}

.icon {
  width: 1em;
  height: 1em;
  flex: 0 0 auto;
}

.app-shell {
  width: min(1440px, calc(100% - 40px));
  margin: 0 auto;
  padding: 0 0 46px;
}

.topbar {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: stretch;
  min-height: 66px;
  margin: 0 calc(50% - 50vw);
  padding: 0 max(20px, calc(50vw - 720px));
  background: linear-gradient(90deg, var(--nav) 0%, var(--nav-soft) 100%);
  color: #eff6ff;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.brand-mark {
  display: inline-flex;
  align-items: center;
  gap: 14px;
  min-width: 300px;
  color: #ffffff;
  font-size: 20px;
  font-weight: 900;
  text-decoration: none;
}

.brand-mark span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 7px;
  background: var(--accent);
  color: #ffffff;
  font-size: 13px;
  font-weight: 900;
}

.topbar-nav {
  display: inline-flex;
  justify-content: flex-start;
  align-items: stretch;
  height: 100%;
}

.topbar-nav a {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 0 34px;
  border-left: 1px solid rgba(255, 255, 255, 0.05);
  color: #a9b7c9;
  font-size: 15px;
  font-weight: 800;
  text-decoration: none;
  transition: background 0.16s ease, color 0.16s ease;
}

.topbar-nav a:hover,
.topbar-nav a.active {
  background: rgba(255, 255, 255, 0.04);
  color: #ffffff;
}

.topbar-nav a.active::after {
  position: absolute;
  right: 28px;
  bottom: 0;
  left: 28px;
  height: 3px;
  border-radius: 99px 99px 0 0;
  background: var(--blue);
  content: "";
}

.topbar-meta {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  color: #cbd7e6;
  font-size: 13px;
  white-space: nowrap;
}

.topbar-meta span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.03);
}

.search-zone {
  display: grid;
  grid-template-columns: minmax(420px, 1.35fr) minmax(320px, 0.8fr) minmax(220px, 0.45fr);
  gap: 14px;
  padding: 20px 0 12px;
  scroll-margin-top: 18px;
}

.command-panel,
.recent-panel,
.summary-card,
.selected-context,
.left-panel,
.results-panel {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  box-shadow: var(--shadow-tiny);
}

.command-panel {
  padding: 14px;
}

.recent-panel {
  display: grid;
  align-content: center;
  gap: 10px;
  padding: 14px 16px;
}

.summary-card {
  display: grid;
  align-content: center;
  gap: 4px;
  padding: 16px 20px;
}

.summary-card span,
.summary-card small,
.selected-context span,
.metric p,
.panel-status span,
.eyeline {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.summary-card strong {
  color: var(--ink-strong);
  font-size: 24px;
  line-height: 1.1;
  font-weight: 900;
}

.summary-card small {
  font-size: 12px;
  font-weight: 600;
}

.panel-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 9px;
}

.seo-search-box {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 5px 5px 5px 17px;
  border: 1px solid #cfdbe8;
  border-radius: 999px;
  background: #ffffff;
}

.seo-search-box > .icon {
  width: 22px;
  height: 22px;
  color: #8796aa;
}

.seo-query {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.seo-query span {
  color: var(--muted);
  font-size: 11px;
  font-weight: 800;
}

.seo-query strong {
  min-width: 0;
  overflow: hidden;
  color: var(--ink-strong);
  font-size: 18px;
  line-height: 1.2;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.seo-query em {
  color: #64748b;
  font-size: 14px;
  font-style: normal;
}

.search-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  min-width: 112px;
  padding: 0 16px;
  border-radius: 999px;
  background: var(--blue);
  color: #ffffff;
  font-size: 14px;
  font-weight: 900;
  text-decoration: none;
}

.recent-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}

.recent-chips span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 32px;
  padding: 0 15px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #ffffff;
  color: #34506f;
  font-size: 13px;
  font-weight: 800;
}

.selected-context {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 14px;
  overflow: hidden;
}

.selected-context div {
  display: grid;
  gap: 4px;
  min-height: 64px;
  align-content: center;
  padding: 12px 18px;
  border-right: 1px solid var(--line-soft);
}

.selected-context div:last-child {
  border-right: 0;
}

.selected-context strong {
  color: var(--ink-strong);
  font-size: 17px;
  font-weight: 900;
}

.ai-hotspot-section {
  display: grid;
  gap: 12px;
  margin-bottom: 14px;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #ffffff;
  box-shadow: var(--shadow-tiny);
}

.ai-hotspot-head {
  display: grid;
  gap: 6px;
}

.ai-hotspot-head span {
  color: var(--blue);
  font-size: 12px;
  font-weight: 900;
}

.ai-hotspot-head h2 {
  margin: 0;
  color: var(--ink-strong);
  font-size: 22px;
  line-height: 1.15;
  font-weight: 900;
}

.ai-hotspot-head p {
  max-width: 760px;
  margin: 0;
  color: var(--muted-strong);
  font-size: 13px;
  line-height: 1.65;
}

.ai-hotspot-links {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.ai-hotspot-link {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 76px;
  padding: 12px;
  border: 1px solid #d8e4f0;
  border-radius: 8px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  color: var(--ink);
  text-decoration: none;
}

.ai-hotspot-link:hover,
.ai-hotspot-link.active {
  border-color: rgba(23, 105, 232, 0.48);
  background: #f4f8ff;
}

.ai-hotspot-link.active {
  box-shadow: inset 3px 0 0 var(--blue);
}

.ai-hotspot-link span {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.ai-hotspot-link strong {
  overflow: hidden;
  color: var(--ink-strong);
  font-size: 14px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-hotspot-link em {
  overflow: hidden;
  color: #64748b;
  font-size: 11px;
  font-style: normal;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-hotspot-link b {
  color: var(--accent);
  font-size: 12px;
  font-weight: 900;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.workspace {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.left-panel {
  overflow: hidden;
}

.left-panel-top {
  padding: 16px;
  background: linear-gradient(180deg, #101d31 0%, #0b1829 100%);
  color: #ffffff;
}

.panel-heading,
.result-header,
.section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.panel-heading h2,
.section-title h2 {
  margin: 0;
  color: var(--ink-strong);
  font-size: 16px;
  font-weight: 900;
}

.left-panel-top .panel-heading h2 {
  color: #ffffff;
}

.panel-heading span,
.section-title span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.left-panel-top .panel-heading span {
  color: #95abc6;
}

.market-shortcuts {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 7px;
  margin-top: 14px;
}

.market-shortcut {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.07);
  color: #c6d5e7;
  font-size: 12px;
  font-weight: 900;
}

.market-shortcut.active {
  border-color: rgba(47, 128, 255, 0.72);
  background: var(--blue);
  color: #ffffff;
}

.candidate-list {
  display: grid;
  max-height: 696px;
  overflow-y: auto;
}

.candidate {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 76px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--line-soft);
  background: #ffffff;
  color: var(--ink);
  text-align: left;
  text-decoration: none;
}

.candidate.selected {
  background: #f4f8ff;
  box-shadow: inset 3px 0 0 var(--blue);
}

.candidate-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.stock-logo {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  overflow: hidden;
  border: 1px solid #d9e4ef;
  border-radius: 8px;
  background: #ffffff;
}

.stock-logo.large {
  width: 52px;
  height: 52px;
  border-color: #d5e1ed;
}

.stock-logo img {
  position: relative;
  z-index: 1;
  display: block;
  width: 72%;
  height: 72%;
  object-fit: contain;
  background: #ffffff;
}

.logo-fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #7b8da4;
  font-size: 11px;
  font-weight: 900;
  letter-spacing: 0;
}

.candidate-main {
  display: grid;
  gap: 5px;
}

.candidate-title-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.candidate strong,
.candidate em,
.candidate small {
  display: block;
}

.candidate strong {
  min-width: 0;
  overflow: hidden;
  color: var(--ink-strong);
  font-size: 14px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.candidate em {
  color: #71839b;
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.candidate > span:last-child {
  color: var(--ink-strong);
  font-size: 12px;
  font-weight: 900;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.candidate small {
  margin-top: 4px;
  color: var(--accent);
  font-size: 11px;
  font-weight: 900;
}

.market-badge {
  flex: 0 0 auto;
  padding: 2px 7px;
  border: 1px solid #cfe0f4;
  border-radius: 999px;
  background: var(--blue-soft);
  color: var(--blue);
  font-size: 10px;
  font-weight: 900;
  line-height: 1.3;
}

.results-panel {
  min-width: 0;
  min-height: 650px;
  padding: 20px;
}

.eyeline {
  margin: 0 0 5px;
  color: var(--blue);
  font-size: 12px;
}

.result-header {
  align-items: flex-start;
  margin-bottom: 16px;
}

.result-title-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.result-header h1 {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  color: var(--ink-strong);
  font-size: 34px;
  line-height: 1.08;
  font-weight: 900;
}

.result-header h1 span {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid #cfdbe8;
  border-radius: 6px;
  background: #f5f8fc;
  color: #34506f;
  font-size: 15px;
  font-weight: 800;
}

.result-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.result-tags span {
  display: inline-flex;
  align-items: center;
  min-height: 27px;
  padding: 0 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface-soft);
  color: #52647a;
  font-size: 12px;
  font-weight: 800;
}

.segmented {
  display: inline-grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  min-width: 238px;
  padding: 3px;
  border: 1px solid #ccd9e8;
  border-radius: 999px;
  background: #edf3fb;
}

.segmented a {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 36px;
  border-radius: 999px;
  color: #60738b;
  font-size: 13px;
  font-weight: 900;
  text-decoration: none;
}

.segmented a.active {
  background: var(--accent);
  color: #ffffff;
  box-shadow: 0 8px 20px rgba(240, 24, 36, 0.24);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin: 14px 0 18px;
}

.metric {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 14px;
  min-height: 88px;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: linear-gradient(180deg, #ffffff 0%, #fbfdff 100%);
}

.metric-icon {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border: 1px solid #d8e5f2;
  border-radius: 8px;
  background: var(--blue-soft);
  color: var(--blue);
}

.metric p {
  margin: 0 0 4px;
  font-size: 12px;
}

.metric strong {
  display: block;
  overflow-wrap: anywhere;
  color: var(--ink-strong);
  font-size: 25px;
  line-height: 1.1;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

.section-title {
  margin-top: 6px;
  padding-top: 4px;
}

.section-title-spaced {
  margin-top: 26px;
}

.indirect-exposure-panel {
  margin-top: 22px;
}

.indirect-note {
  margin: 8px 0 0;
  color: #5b708a;
  font-size: 13px;
  line-height: 1.7;
}

.indirect-table-wrap {
  margin-top: 10px;
}

.table-wrap {
  margin-top: 12px;
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #ffffff;
}

table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
  background: #ffffff;
}

th,
td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--line-soft);
  text-align: left;
  vertical-align: middle;
}

th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: #f7faff;
  color: #4f637d;
  font-size: 12px;
  font-weight: 900;
}

td {
  color: var(--ink);
  font-size: 14px;
}

tbody tr:last-child td {
  border-bottom: 0;
}

th:nth-child(4),
td:nth-child(4) {
  background: #fff7f7;
}

th:nth-child(5),
td:nth-child(5) {
  background: #f5f9ff;
}

.rank {
  display: inline-grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 1px solid #d4dfeb;
  border-radius: 999px;
  background: #f7faff;
  color: #56708d;
  font-size: 11px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

.rank-1,
.rank-2 {
  border-color: var(--accent);
  background: var(--accent);
  color: #ffffff;
}

.rank-3 {
  border-color: #ccd9e8;
  background: #eef4fb;
  color: #20334d;
}

.fund-name {
  max-width: 270px;
  overflow: hidden;
  color: var(--ink-strong);
  font-size: 14px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fund-code {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  max-width: 360px;
  margin-top: 4px;
  color: #667b96;
  font-size: 12px;
  line-height: 1.55;
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}

.fund-code-list {
  font-weight: 800;
}

.fund-cell {
  cursor: help;
}

.fund-cell:focus {
  outline: 2px solid rgba(23, 105, 232, 0.34);
  outline-offset: -2px;
}

.indirect-product-name {
  max-width: 300px;
  overflow: hidden;
  color: var(--ink-strong);
  font-size: 14px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.indirect-product-code {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  color: #667b96;
  font-size: 12px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.leverage-pill {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 2px 7px;
  border: 1px solid rgba(240, 24, 36, 0.16);
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 11px;
  font-weight: 900;
  line-height: 1.2;
}

.fund-trade-row {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  max-width: 360px;
  margin-top: 8px;
}

.fund-type-badge,
.trade-pill,
.trade-limit {
  display: inline-flex;
  align-items: center;
  min-height: 23px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 900;
  line-height: 1.2;
  white-space: nowrap;
}

.fund-type-badge,
.trade-limit {
  border: 1px solid #d5e1ed;
  background: #f4f8fc;
  color: #52647a;
}

.trade-limit {
  background: #f7faff;
  color: #61738a;
}

.trade-pill.open {
  border: 1px solid rgba(21, 168, 102, 0.2);
  background: var(--green-soft);
  color: #0d8a53;
}

.trade-pill.limited {
  border: 1px solid rgba(183, 121, 31, 0.2);
  background: var(--amber-soft);
  color: var(--amber);
}

.trade-pill.blocked {
  border: 1px solid rgba(225, 29, 48, 0.18);
  background: var(--accent-soft);
  color: var(--danger);
}

.trade-pill.neutral {
  border: 1px solid #d5e1ed;
  background: #f7faff;
  color: #61738a;
}

.status-stack {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.strong {
  color: var(--ink-strong);
}

.table-metric-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 126px;
}

.metric-num {
  color: var(--accent);
  font-size: 14px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

.metric-num-passive {
  color: #51647a;
  font-size: 14px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.table-progress-track {
  width: 100%;
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: #e8eef5;
}

.table-progress-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
}

${percentageWidthCss()}

.passive-fill {
  background: #ccd7e6;
}

.estimated-num {
  color: #9a3412;
}

.estimated-fill {
  background: #f97316;
}

.shares-cell {
  color: #1d2b40;
  font-weight: 800;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.table-empty {
  display: grid;
  min-height: 160px;
  margin-top: 12px;
  place-items: center;
  border: 1px dashed #c7d5e6;
  border-radius: 8px;
  background: #f8fbff;
  color: var(--muted);
  font-size: 14px;
  font-weight: 800;
}

.fund-holdings-hover-card::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.fund-holdings-hover-card::-webkit-scrollbar-thumb {
  background: #cbd7e6;
  border-radius: 99px;
}

.fund-holdings-hover-card::-webkit-scrollbar-track {
  background: transparent;
}

.fund-holdings-hover-card {
  position: fixed;
  top: 84px;
  right: 12px;
  z-index: 9999;
  width: 382px;
  max-width: calc(100vw - 24px);
  max-height: calc(100vh - 24px);
  overflow: hidden auto;
  border: 1px solid #cfdbe8;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 24px 70px rgba(7, 17, 31, 0.18);
  padding: 14px;
  pointer-events: none;
  animation: hover-card-pop 0.2s var(--ease) forwards;
}

.fund-holdings-hover-card.card-left {
  right: auto;
  left: 12px;
}

.fund-holdings-hover-card.card-bottom {
  top: auto;
  bottom: 12px;
}

.fund-holdings-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9998;
  border: 0;
  padding: 0;
  background: rgba(7, 17, 31, 0.36);
}

@keyframes hover-card-pop {
  from {
    opacity: 0;
    transform: scale(0.97) translateY(4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.hover-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line-soft);
}

.hover-card-fund-info {
  min-width: 0;
}

.hover-card-fund-name {
  overflow: hidden;
  color: var(--ink-strong);
  font-size: 15px;
  font-weight: 900;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hover-card-meta-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 7px;
  color: var(--muted);
  font-size: 11px;
}

.hover-card-meta-line strong {
  color: #1e344f;
  font-weight: 900;
}

.hover-card-fund-codes {
  min-width: 0;
  overflow-wrap: anywhere;
  line-height: 1.4;
}

.hover-card-close {
  display: none;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #ffffff;
  color: var(--ink);
}

.hover-card-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}

.hover-card-summary div {
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface-soft);
  padding: 8px 10px;
}

.hover-card-summary span,
.hover-card-target-strip span {
  display: block;
  color: var(--muted);
  font-size: 10px;
  font-weight: 900;
}

.hover-card-summary strong {
  display: block;
  margin-top: 4px;
  color: var(--ink-strong);
  font-size: 14px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

.hover-card-target-strip {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 8px;
  margin-bottom: 9px;
  border: 1px solid rgba(240, 24, 36, 0.22);
  border-radius: 8px;
  background: var(--accent-soft);
  padding: 8px 10px;
}

.hover-card-target-strip strong {
  overflow: hidden;
  color: var(--ink-strong);
  font-size: 13px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hover-card-target-strip b {
  color: var(--accent);
  font-size: 13px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

.hover-card-title-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  margin-bottom: 6px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 900;
}

.hover-card-holdings-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hover-card-holding-row {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) 58px;
  align-items: stretch;
  gap: 9px;
  min-height: 34px;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 6px 7px;
  background: #ffffff;
}

.holding-rank {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #8da1b8;
  font-size: 10px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
}

.holding-main {
  min-width: 0;
}

.holding-name-line {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin-bottom: 4px;
}

.holding-stock-name {
  overflow: hidden;
  color: var(--ink-strong);
  font-size: 12px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.holding-stock-code {
  flex: 0 0 auto;
  color: #8da1b8;
  font-size: 10px;
  font-weight: 800;
}

.holding-progress-bar {
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: #e9f0f7;
}

.holding-progress-fill {
  height: 100%;
  border-radius: inherit;
  background: #9fb4ce;
}

.holding-stock-ratio {
  align-self: center;
  color: var(--muted-strong);
  font-size: 12px;
  font-weight: 900;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.hover-card-holding-row.row-highlight {
  border-color: rgba(240, 24, 36, 0.22);
  background: var(--accent-soft);
}

.hover-card-holding-row.row-highlight .holding-rank,
.hover-card-holding-row.row-highlight .holding-stock-name,
.hover-card-holding-row.row-highlight .holding-stock-ratio {
  color: var(--accent);
}

.hover-card-holding-row.row-highlight .holding-progress-fill {
  background: var(--accent);
}

.target-badge {
  display: inline-flex;
  padding: 2px 6px;
  border-radius: 999px;
  background: #ffffff;
  color: var(--accent);
  font-size: 9px;
  font-weight: 900;
  white-space: nowrap;
}

.no-holdings-msg {
  margin: 0;
  padding: 12px 0;
  color: var(--muted);
  font-size: 12px;
  text-align: center;
}

.methodology-section {
  display: grid;
  gap: 18px;
  margin-top: 18px;
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(23, 105, 232, 0.06), rgba(240, 24, 36, 0.04)),
    #ffffff;
  box-shadow: var(--shadow-tiny);
  scroll-margin-top: 18px;
}

.methodology-head {
  display: grid;
  gap: 8px;
  max-width: 760px;
}

.methodology-head span {
  color: var(--blue);
  font-size: 12px;
  font-weight: 900;
}

.methodology-head h2 {
  margin: 0;
  color: var(--ink-strong);
  font-size: 22px;
  font-weight: 900;
}

.methodology-head p,
.methodology-grid p {
  margin: 0;
  color: var(--muted-strong);
  font-size: 13px;
  line-height: 1.75;
}

.methodology-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.methodology-grid article {
  display: grid;
  align-content: start;
  gap: 8px;
  min-height: 138px;
  padding: 16px;
  border: 1px solid #d8e4f0;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.78);
}

.methodology-grid strong {
  color: var(--ink-strong);
  font-size: 15px;
  font-weight: 900;
}

.compliance-disclaimer {
  display: grid;
  gap: 8px;
  margin-top: 18px;
  padding: 16px 4px 0;
  border-top: 1px solid var(--line);
  color: var(--muted);
  font-size: 12px;
  line-height: 1.75;
}

.compliance-disclaimer strong {
  color: var(--ink-strong);
  font-size: 13px;
  font-weight: 900;
}

.compliance-disclaimer p {
  max-width: 1180px;
  margin: 0;
}

.share-action {
  justify-self: start;
  min-height: 36px;
  margin-top: 6px;
  padding: 0 14px;
  border: 1px solid #d6e1ed;
  border-radius: 8px;
  background: #ffffff;
  color: #223652;
  font-size: 13px;
  font-weight: 900;
  cursor: pointer;
}

.share-copied {
  border-color: rgba(22, 163, 74, 0.35);
  color: #15803d;
}

@media (max-width: 1180px) {
  .topbar-nav {
    display: none;
  }

  .search-zone {
    grid-template-columns: 1fr 1fr;
  }

  .ai-hotspot-links {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .summary-card {
    grid-column: 1 / -1;
  }

  .workspace {
    grid-template-columns: 300px minmax(0, 1fr);
  }

  .methodology-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 920px) {
  .app-shell {
    width: min(100% - 28px, 1440px);
  }

  .search-zone,
  .workspace {
    grid-template-columns: 1fr;
  }

  .selected-context {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .selected-context div:nth-child(2n) {
    border-right: 0;
  }

  .workspace.has-selection .left-panel {
    order: 2;
  }

  .candidate-list {
    max-height: 340px;
  }
}

@media (max-width: 720px) {
  .app-shell {
    width: min(100% - 24px, 1440px);
  }

  .topbar {
    grid-template-columns: 1fr;
    gap: 8px;
    padding-top: 12px;
    padding-bottom: 12px;
  }

  .brand-mark {
    min-width: 0;
    font-size: 18px;
  }

  .topbar-meta {
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  .search-zone {
    padding-top: 14px;
  }

  .ai-hotspot-section {
    padding: 16px;
  }

  .ai-hotspot-links {
    grid-template-columns: 1fr;
  }

  .seo-search-box {
    grid-template-columns: 1fr;
    gap: 10px;
    padding: 10px;
    border-radius: 8px;
  }

  .seo-search-box > .icon {
    display: none;
  }

  .search-action {
    width: 100%;
  }

  .selected-context,
  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .selected-context div {
    border-right: 0;
    border-bottom: 1px solid var(--line-soft);
  }

  .selected-context div:last-child {
    border-bottom: 0;
  }

  .results-panel {
    padding: 16px;
  }

  .result-header,
  .section-title {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }

  .result-header h1 {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
    font-size: 28px;
  }

  .result-title-row {
    align-items: flex-start;
  }

  .segmented {
    width: 100%;
    min-width: 0;
  }

  .methodology-section {
    padding: 16px;
  }

  .methodology-grid {
    grid-template-columns: 1fr;
  }

  .fund-holdings-hover-card.mobile-panel {
    width: auto;
    max-width: none;
    max-height: min(72vh, 620px);
    top: auto;
    right: 12px;
    left: 12px;
    bottom: 12px;
    border-radius: 8px 8px 0 0;
    pointer-events: auto;
    animation: mobile-card-rise 0.2s var(--ease) forwards;
  }

  .hover-card-close {
    display: inline-flex;
  }

  .hover-card-meta-line {
    align-items: flex-start;
    flex-direction: column;
    gap: 4px;
  }
}

@keyframes mobile-card-rise {
  from {
    opacity: 0;
    transform: translateY(18px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
`;
}

function shareJs() {
  return `document.querySelectorAll(".stock-logo img").forEach((image) => {
  image.addEventListener("error", () => {
    image.remove();
  });
});

const holdingFormatter = new Intl.NumberFormat("zh-CN", {
  maximumFractionDigits: 2,
});

let activeFundCard = null;
let activeFundBackdrop = null;
let activeFundCell = null;

function normalizeStockCode(code) {
  return String(code || "").replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

function supportsHoverPointer() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
    !(navigator.maxTouchPoints > 0)
  );
}

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = text;
  return element;
}

function closeFundCard() {
  if (activeFundCard) {
    activeFundCard.remove();
    activeFundCard = null;
  }
  if (activeFundBackdrop) {
    activeFundBackdrop.remove();
    activeFundBackdrop = null;
  }
  activeFundCell = null;
}

function fundHoldingsFromCell(cell) {
  try {
    const parsed = JSON.parse(cell.dataset.holdings || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function cardPositionClass(event) {
  if (!event || typeof event.clientX !== "number" || typeof event.clientY !== "number") {
    return "";
  }

  const horizontalClass = event.clientX > window.innerWidth / 2 ? " card-left" : "";
  const verticalClass = event.clientY < window.innerHeight / 2 ? " card-bottom" : "";
  return horizontalClass + verticalClass;
}

function buildFundCard(cell, event, isMobilePanel) {
  const holdings = fundHoldingsFromCell(cell);
  const fundName = cell.dataset.fundName || "基金";
  const fundCodes = cell.dataset.fundCodes || "";
  const currentStockCode = normalizeStockCode(cell.dataset.currentStockCode || "");
  const maxRatio = Math.max(...holdings.map((holding) => Number(holding.ratioPercent) || 0), 1);
  const topHolding = holdings[0] || null;
  const currentHolding = holdings.find((holding) => normalizeStockCode(holding.stockCode) === currentStockCode);

  const card = createElement(
    "div",
    "fund-holdings-hover-card" + (isMobilePanel ? " mobile-panel" : cardPositionClass(event)),
  );

  const header = createElement("div", "hover-card-header");
  const fundInfo = createElement("div", "hover-card-fund-info");
  const fundTitle = createElement("div", "hover-card-fund-name", fundName);
  fundTitle.title = fundName;
  const metaLine = createElement("div", "hover-card-meta-line");
  metaLine.append(createElement("span", "", "基金代码"), createElement("strong", "hover-card-fund-codes", fundCodes));
  fundInfo.append(fundTitle, metaLine);

  const closeButton = createElement("button", "hover-card-close");
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "关闭基金持仓卡片");
  closeButton.innerHTML = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
  closeButton.addEventListener("click", closeFundCard);
  header.append(fundInfo, closeButton);

  const body = createElement("div", "hover-card-body");
  const summary = createElement("div", "hover-card-summary");
  const countItem = createElement("div");
  countItem.append(createElement("span", "", "持仓股票"), createElement("strong", "", holdings.length ? holdings.length + " 只" : "--"));
  const topItem = createElement("div");
  topItem.append(
    createElement("span", "", "最高占比"),
    createElement("strong", "", topHolding ? holdingFormatter.format(Number(topHolding.ratioPercent) || 0) + "%" : "--"),
  );
  summary.append(countItem, topItem);
  body.append(summary);

  if (currentHolding) {
    const targetStrip = createElement("div", "hover-card-target-strip");
    targetStrip.append(
      createElement("span", "", "当前查询"),
      createElement("strong", "", currentHolding.stockName || currentHolding.stockCode || "--"),
      createElement("b", "", holdingFormatter.format(Number(currentHolding.ratioPercent) || 0) + "%"),
    );
    body.append(targetStrip);
  }

  const titleRow = createElement("div", "hover-card-title-row");
  titleRow.append(createElement("span", "", "前十大持仓股"), createElement("span", "", "占净值"));
  body.append(titleRow);

  const list = createElement("div", "hover-card-holdings-list");
  if (holdings.length) {
    holdings.forEach((holding, index) => {
      const ratio = Number(holding.ratioPercent) || 0;
      const isCurrentTarget = currentStockCode && normalizeStockCode(holding.stockCode) === currentStockCode;
      const row = createElement("div", "hover-card-holding-row" + (isCurrentTarget ? " row-highlight" : ""));
      const main = createElement("div", "holding-main");
      const nameLine = createElement("div", "holding-name-line");
      nameLine.append(
        createElement("span", "holding-stock-name", holding.stockName || "--"),
        createElement("span", "holding-stock-code", holding.stockCode || "--"),
      );
      if (isCurrentTarget) {
        nameLine.append(createElement("span", "target-badge", "查询标的"));
      }
      const progress = createElement("div", "holding-progress-bar");
      const width = Math.max(0, Math.min(100, Math.round((ratio / maxRatio) * 100)));
      const fill = createElement("div", "holding-progress-fill width-pct-" + width);
      progress.append(fill);
      main.append(nameLine, progress);
      row.append(
        createElement("span", "holding-rank", holding.rank || index + 1),
        main,
        createElement("span", "holding-stock-ratio", holdingFormatter.format(ratio) + "%"),
      );
      list.append(row);
    });
  } else {
    list.append(createElement("p", "no-holdings-msg", "该基金暂无持仓记录"));
  }
  body.append(list);
  card.append(header, body);

  if (isMobilePanel) {
    const backdrop = createElement("button", "fund-holdings-backdrop");
    backdrop.type = "button";
    backdrop.setAttribute("aria-label", "关闭基金持仓卡片");
    backdrop.addEventListener("click", closeFundCard);
    document.body.append(backdrop);
    activeFundBackdrop = backdrop;
  }

  document.body.append(card);
  return card;
}

function showFundCard(cell, event, forceMobilePanel = false) {
  const isMobilePanel = forceMobilePanel || !supportsHoverPointer();
  if (activeFundCell !== cell || isMobilePanel) {
    closeFundCard();
    activeFundCell = cell;
    activeFundCard = buildFundCard(cell, event, isMobilePanel);
    return;
  }
  if (activeFundCard) {
    activeFundCard.className = "fund-holdings-hover-card" + cardPositionClass(event);
  }
}

document.querySelectorAll(".js-fund-cell").forEach((cell) => {
  cell.addEventListener("mouseenter", (event) => {
    if (!supportsHoverPointer()) return;
    showFundCard(cell, event);
  });

  cell.addEventListener("mousemove", (event) => {
    if (!supportsHoverPointer() || activeFundCell !== cell || !activeFundCard) return;
    activeFundCard.className = "fund-holdings-hover-card" + cardPositionClass(event);
  });

  cell.addEventListener("mouseleave", () => {
    if (!supportsHoverPointer()) return;
    closeFundCard();
  });

  cell.addEventListener("click", (event) => {
    showFundCard(cell, event, !supportsHoverPointer());
  });

  cell.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    showFundCard(cell, event, true);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeFundCard();
  }
});

const buttons = document.querySelectorAll(".share-action");

for (const button of buttons) {
  button.addEventListener("click", async () => {
    const url = button.dataset.shareUrl || window.location.href;
    const title = button.dataset.shareTitle || document.title;

    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }

      await navigator.clipboard.writeText(url);
      const originalText = button.textContent;
      button.textContent = "已复制链接";
      button.classList.add("share-copied");
      window.setTimeout(() => {
        button.textContent = originalText || "分享页面";
        button.classList.remove("share-copied");
      }, 1800);
    } catch {
      button.textContent = "复制失败";
      window.setTimeout(() => {
        button.textContent = "分享页面";
      }, 1800);
    }
  });
}
`;
}

function ogImage(report) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#eef3f8"/>
      <stop offset="1" stop-color="#f8fbff"/>
    </linearGradient>
    <linearGradient id="nav" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#07111f"/>
      <stop offset="1" stop-color="#0c1a2d"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="72" y="72" width="1056" height="72" rx="10" fill="url(#nav)"/>
  <rect x="104" y="93" width="116" height="30" rx="7" fill="#f01824"/>
  <text x="124" y="115" fill="#ffffff" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="16" font-weight="900">出海钱眼</text>
  <text x="244" y="116" fill="#ffffff" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="24" font-weight="900">基金持仓穿透</text>
  <rect x="72" y="166" width="680" height="94" rx="10" fill="#ffffff" stroke="#dce5ef"/>
  <rect x="776" y="166" width="352" height="94" rx="10" fill="#ffffff" stroke="#dce5ef"/>
  <text x="112" y="204" fill="#64748b" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="20" font-weight="700">全球股票 / 指数 / ETF</text>
  <text x="112" y="239" fill="#0d1524" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="34" font-weight="900">公募基金持仓穿透查询</text>
  <text x="808" y="205" fill="#64748b" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="20" font-weight="700">数据期</text>
  <text x="808" y="239" fill="#0d1524" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="34" font-weight="900">${escapeHtml(report)}</text>
  <rect x="72" y="292" width="320" height="222" rx="10" fill="#ffffff" stroke="#dce5ef"/>
  <rect x="408" y="292" width="720" height="222" rx="10" fill="#ffffff" stroke="#dce5ef"/>
  <rect x="72" y="292" width="320" height="64" rx="10" fill="#101d31"/>
  <text x="104" y="333" fill="#ffffff" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="24" font-weight="900">海外热门</text>
  <circle cx="122" cy="408" r="24" fill="#eef5ff" stroke="#d9e4ef"/>
  <text x="166" y="401" fill="#0d1524" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="24" font-weight="900">股票品牌图标</text>
  <text x="166" y="436" fill="#64748b" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="19">基金覆盖、权重、交易状态</text>
  <text x="448" y="352" fill="#1769e8" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="20" font-weight="800">当前海外标的</text>
  <text x="448" y="407" fill="#0d1524" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="48" font-weight="900">谁在重仓这只股票？</text>
  <rect x="448" y="442" width="168" height="42" rx="21" fill="#fff0f1"/>
  <text x="484" y="470" fill="#f01824" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="20" font-weight="900">场外样本</text>
  <rect x="634" y="442" width="168" height="42" rx="21" fill="#eef5ff"/>
  <text x="670" y="470" fill="#1769e8" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="20" font-weight="900">场内样本</text>
  <text x="72" y="570" fill="#64748b" font-family="Microsoft YaHei, PingFang SC, sans-serif" font-size="24">fund.niliangrui.cloud</text>
</svg>
`;
}

function sitemap(stockUrls) {
  const urls = [
    { loc: `${SITE_URL}/`, priority: "1.0" },
    ...stockUrls.map((loc) => ({ loc, priority: "0.8" })),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${LASTMOD}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${url.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;
}

function toBrowserPath(filePath) {
  return filePath.replace(/\\/g, "/").replace(/^public\//, "");
}

function fileNameFromBrowserPath(filePath) {
  const normalized = toBrowserPath(filePath);
  const parts = normalized.split("/");
  return parts[parts.length - 1] || normalized;
}

function releaseCheckManifest(quarterConfig, payload, selectedStocks, stockUrls) {
  const dataPath = toBrowserPath(quarterConfig.paths.fundStockIndexJson);
  const sampleStock = selectedStocks[0] ?? null;
  const sampleSlug = sampleStock ? slugFor(sampleStock.code) : "";

  return `${JSON.stringify(
    {
      version: 1,
      report: quarterConfig.report,
      cutoffDate: quarterConfig.cutoffDate,
      dataPath,
      dataFileName: fileNameFromBrowserPath(dataPath),
      dataMeta: {
        report: payload.meta.report,
        cutoffDate: payload.meta.cutoffDate,
        generatedAt: payload.meta.generatedAt,
        sourceFile: payload.meta.sourceFile,
        stockCount: payload.meta.stockCount,
        overseasStockCount: payload.meta.overseasStockCount,
        shippedStockScope: payload.meta.shippedStockScope,
        shippedStockCount: payload.meta.shippedStockCount,
      },
      seo: {
        siteUrl: SITE_URL,
        lastmod: LASTMOD,
        stockPageCount: selectedStocks.length,
        sampleStock: sampleStock
          ? {
              code: sampleStock.code,
              name: sampleStock.name,
              path: `/stocks/${sampleSlug}/`,
              canonical: stockUrls[0],
            }
          : null,
        titleTemplate: "{stock.name}（{stock.code}）被哪些国内基金重仓？{report} 公募持仓穿透",
        descriptionTemplate:
          "{stock.name}（{stock.code}）{report} 公募基金持仓穿透：场外主动口径 {activeFundCount} 只基金持有，最高净值占比 {maxRatioPercent}%，场内 ETF/LOF 口径 {onExchangeFundCount} 只。",
        staticFiles: ["og-image.svg", "sitemap.xml", "robots.txt", "seo/stock-page.css", "seo/share.js"],
      },
      checks: {
        reportMatchesData: payload.meta.report === quarterConfig.report,
        cutoffDateMatchesData: payload.meta.cutoffDate === quarterConfig.cutoffDate,
        seoUsesConfiguredDataFile: true,
      },
    },
    null,
    2,
  )}\n`;
}

async function main() {
  const quarterConfig = await loadQuarterConfig();
  const dataPath = quarterConfig.paths.fundStockIndexJson;
  const payload = JSON.parse(await readFile(dataPath, "utf8"));
  if (payload?.meta?.report !== quarterConfig.report) {
    throw new Error(
      `Configured quarter is ${quarterConfig.report}, but ${dataPath} contains ${payload?.meta?.report || "unknown"}.`,
    );
  }
  if (payload?.meta?.cutoffDate !== quarterConfig.cutoffDate) {
    throw new Error(
      `Configured cutoffDate is ${quarterConfig.cutoffDate}, but ${dataPath} contains ${payload?.meta?.cutoffDate || "unknown"}.`,
    );
  }
  const aiBattleHotspots = await loadAiBattleHotspots();
  const hotspotItems = selectHotspotStocks(payload, aiBattleHotspots);
  const selectedStocks = selectSeoStocks(
    payload,
    aiBattleHotspots.map((hotspot) => hotspot.code),
  );

  await rm(STOCKS_DIR, { recursive: true, force: true });
  await mkdir(STOCKS_DIR, { recursive: true });
  await mkdir(SEO_DIR, { recursive: true });

  const stockUrls = [];
  for (const stock of selectedStocks) {
    const slug = slugFor(stock.code);
    const pageDir = path.join(STOCKS_DIR, slug);
    await mkdir(pageDir, { recursive: true });
    await writeFile(path.join(pageDir, "index.html"), stockPage(stock, payload, hotspotItems), "utf8");
    stockUrls.push(`${SITE_URL}/stocks/${slug}/`);
  }

  await writeFile(path.join(SEO_DIR, "stock-page.css"), stockPageCss(), "utf8");
  await writeFile(path.join(SEO_DIR, "share.js"), shareJs(), "utf8");
  await writeFile(
    quarterConfig.paths.releaseCheckJson,
    releaseCheckManifest(quarterConfig, payload, selectedStocks, stockUrls),
    "utf8",
  );
  await writeFile(path.join("public", "og-image.svg"), ogImage(quarterConfig.report), "utf8");
  await writeFile(path.join("public", "sitemap.xml"), sitemap(stockUrls), "utf8");
  await writeFile(
    path.join("public", "robots.txt"),
    `User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${SITE_URL}/sitemap.xml
`,
    "utf8",
  );

  console.log(`Generated ${selectedStocks.length} SEO stock pages, sitemap.xml and quarter-release-check.json`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
