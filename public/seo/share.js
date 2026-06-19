document.querySelectorAll(".stock-logo img").forEach((image) => {
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

function positionFundCard(card, event, isMobilePanel) {
  if (isMobilePanel) {
    Object.assign(card.style, {
      position: "fixed",
      left: "12px",
      right: "12px",
      bottom: "12px",
      zIndex: "10000",
      pointerEvents: "auto",
      visibility: "visible",
    });
    return;
  }

  const x = typeof event?.clientX === "number" ? event.clientX : 24;
  const y = typeof event?.clientY === "number" ? event.clientY : 24;
  const cardWidth = Math.min(382, window.innerWidth - 24);
  const rect = card.getBoundingClientRect();
  const visibleHeight = Math.min(rect.height || 420, window.innerHeight - 24);
  const left = Math.max(12, Math.min(x + 18, window.innerWidth - cardWidth - 12));
  const top = Math.max(12, Math.min(y + 12, window.innerHeight - visibleHeight - 12));

  Object.assign(card.style, {
    position: "fixed",
    left: left + "px",
    top: top + "px",
    zIndex: "9999",
    pointerEvents: "none",
    visibility: "visible",
  });
}

function buildFundCard(cell, event, isMobilePanel) {
  const holdings = fundHoldingsFromCell(cell);
  const fundName = cell.dataset.fundName || "基金";
  const fundCodes = cell.dataset.fundCodes || "";
  const currentStockCode = normalizeStockCode(cell.dataset.currentStockCode || "");
  const maxRatio = Math.max(...holdings.map((holding) => Number(holding.ratioPercent) || 0), 1);
  const topHolding = holdings[0] || null;
  const currentHolding = holdings.find((holding) => normalizeStockCode(holding.stockCode) === currentStockCode);

  const card = createElement("div", "fund-holdings-hover-card" + (isMobilePanel ? " mobile-panel" : ""));
  card.style.visibility = "hidden";

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
      const fill = createElement("div", "holding-progress-fill");
      fill.style.width = Math.min((ratio / maxRatio) * 100, 100) + "%";
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
  positionFundCard(card, event, isMobilePanel);
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
    positionFundCard(activeFundCard, event, false);
  }
}

document.querySelectorAll(".js-fund-cell").forEach((cell) => {
  cell.addEventListener("mouseenter", (event) => {
    if (!supportsHoverPointer()) return;
    showFundCard(cell, event);
  });

  cell.addEventListener("mousemove", (event) => {
    if (!supportsHoverPointer() || activeFundCell !== cell || !activeFundCard) return;
    positionFundCard(activeFundCard, event, false);
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
