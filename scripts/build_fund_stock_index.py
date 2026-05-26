from __future__ import annotations

import csv
import json
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SOURCE_CSV = ROOT / "outputs" / "holdings_stock_2026q1.csv"
SUMMARY_JSON = ROOT / "outputs" / "run_summary_2026q1.json"
PURCHASE_LIMIT_CSV = ROOT / "outputs" / "fund_purchase_limit_snapshot.csv"
TARGET_JSON = ROOT / "public" / "data" / "fund-stock-index-2026q1.json"
INDEX_FUND_MARKERS = ("指数", "ETF", "ETF联接")
SHARE_CLASS_SUFFIXES = ("A", "B", "C", "D", "E", "F", "H", "I", "Y")
CURRENCY_MARKERS = (
    "人民币",
    "美元",
    "美元现汇",
    "美元现钞",
    "港币",
    "港元",
    "欧元",
)


def parse_float(value: str | None) -> float:
    if value is None:
        return 0.0
    value = value.strip().replace(",", "")
    if not value:
        return 0.0
    try:
        return float(value)
    except ValueError:
        return 0.0


def parse_optional_float(value: str | None) -> float | None:
    if value is None:
        return None
    value = value.strip().replace(",", "")
    if not value:
        return None
    try:
        return float(value)
    except ValueError:
        return None


def rounded(value: float, digits: int = 4) -> float:
    return round(value, digits)


def rounded_optional(value: float | None, digits: int = 4) -> float | None:
    return None if value is None else round(value, digits)


def is_overseas_stock_code(code: str) -> bool:
    return re.fullmatch(r"\d{6}", code.strip()) is None


def stock_market_bucket(code: str) -> str:
    normalized = code.strip().upper()
    if re.fullmatch(r"\d{5}", normalized):
        return "hk"
    if re.fullmatch(r"[A-Z][A-Z0-9._-]*", normalized):
        return "us"
    return "other"


def balanced_overseas_popular(stocks: list[dict[str, Any]], limit: int = 60) -> list[dict[str, Any]]:
    quotas = {"us": 36, "hk": 18, "other": 6}
    cycle = ("us", "us", "hk", "us", "other", "us", "hk", "us")
    buckets = {bucket: [] for bucket in quotas}
    for item in stocks:
        buckets[stock_market_bucket(item["code"])].append(item)

    selected: list[dict[str, Any]] = []
    selected_codes: set[str] = set()
    bucket_positions = {bucket: 0 for bucket in quotas}
    bucket_counts = {bucket: 0 for bucket in quotas}

    while len(selected) < limit:
        added = False
        for bucket in cycle:
            if len(selected) >= limit:
                break
            if bucket_counts[bucket] >= quotas[bucket]:
                continue
            bucket_items = buckets[bucket]
            position = bucket_positions[bucket]
            while position < len(bucket_items) and bucket_items[position]["code"] in selected_codes:
                position += 1
            bucket_positions[bucket] = position
            if position >= len(bucket_items):
                continue
            item = bucket_items[position]
            selected.append(item)
            selected_codes.add(item["code"])
            bucket_positions[bucket] += 1
            bucket_counts[bucket] += 1
            added = True
        if not added:
            break

    for item in stocks:
        if len(selected) >= limit:
            break
        if item["code"] in selected_codes:
            continue
        selected.append(item)
        selected_codes.add(item["code"])

    return selected


def load_summary() -> dict[str, Any]:
    if not SUMMARY_JSON.exists():
        return {}
    with SUMMARY_JSON.open("r", encoding="utf-8-sig") as handle:
        return json.load(handle)


def load_purchase_limits() -> dict[str, dict[str, str]]:
    if not PURCHASE_LIMIT_CSV.exists():
        return {}
    limits = {}
    with PURCHASE_LIMIT_CSV.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            code = row.get("基金代码", "").strip()
            if not code:
                continue
            limits[code] = {
                "purchaseStatus": row.get("申购状态", "").strip(),
                "redemptionStatus": row.get("赎回状态", "").strip(),
                "nextOpenDate": row.get("下一开放日", "").strip(),
                "minPurchase": row.get("起购金额", "").strip(),
                "dailyPurchaseLimit": row.get("日累计限购额度", "").strip(),
                "purchaseFee": row.get("费率", "").strip(),
                "navDate": row.get("净值日期", "").strip(),
            }
    return limits


def trade_status_text(limit: dict[str, str] | None) -> str:
    if not limit:
        return ""
    parts = []
    purchase_status = limit.get("purchaseStatus", "")
    redemption_status = limit.get("redemptionStatus", "")
    min_purchase = limit.get("minPurchase", "")
    daily_limit = limit.get("dailyPurchaseLimit", "")
    if purchase_status:
        parts.append(purchase_status)
    if redemption_status:
        parts.append(redemption_status)
    if min_purchase:
        parts.append(f"起购{min_purchase}")
    if daily_limit:
        parts.append(f"日限{daily_limit}")
    return " · ".join(parts)


def enrich_fund_record(
    fund: dict[str, Any],
    purchase_limits: dict[str, dict[str, str]],
) -> dict[str, Any]:
    code = fund["fundCode"]
    limit = purchase_limits.get(code, {})
    fund.update(
        {
            "purchaseStatus": limit.get("purchaseStatus", ""),
            "redemptionStatus": limit.get("redemptionStatus", ""),
            "nextOpenDate": limit.get("nextOpenDate", ""),
            "minPurchase": limit.get("minPurchase", ""),
            "dailyPurchaseLimit": limit.get("dailyPurchaseLimit", ""),
            "purchaseFee": limit.get("purchaseFee", ""),
            "navDate": limit.get("navDate", ""),
            "tradeStatusText": trade_status_text(limit),
        }
    )
    return fund


def strip_wrapped_share_markers(name: str) -> str:
    pattern = r"[（(]([^）)]*)[）)]$"
    while True:
        match = re.search(pattern, name)
        if not match:
            return name
        text = match.group(1).upper()
        if (
            any(marker.upper() in text for marker in CURRENCY_MARKERS)
            or any(marker in text for marker in SHARE_CLASS_SUFFIXES)
            or "QDII" in text
            or "后端" in text
            or "前端" in text
        ):
            name = name[: match.start()]
            continue
        return name


def fund_family_key(fund: dict[str, Any]) -> str:
    name = fund["fundName"].strip()
    name = re.sub(r"\s+", "", name)
    name = strip_wrapped_share_markers(name)
    changed = True
    while changed:
        changed = False
        for marker in ["人民币份额", "美元份额", *CURRENCY_MARKERS, "前端", "后端"]:
            if name.endswith(marker):
                name = name[: -len(marker)]
                changed = True
        name_before = name
        name = re.sub(r"(?:A|B|C|D|E|F|H|I|Y)类?$", "", name, flags=re.I)
        if name != name_before:
            changed = True
    return name.upper()


def share_class_penalty(fund: dict[str, Any]) -> int:
    name = fund["fundName"].upper()
    penalty = 30
    if "人民币" in name:
        penalty -= 12
    if "美元" in name or "港币" in name or "港元" in name:
        penalty += 12
    if "前端" in name:
        penalty -= 4
    if "后端" in name:
        penalty += 10
    for index, suffix in enumerate(SHARE_CLASS_SUFFIXES):
        if re.search(rf"{suffix}类?$", name):
            penalty += index
            break
    else:
        penalty -= 6
    return penalty


def make_fund_record(row: dict[str, str]) -> dict[str, Any]:
    ratio = parse_float(row.get("占净值比例数值"))
    market_value = parse_optional_float(row.get("持仓市值(万元)"))
    shares = parse_float(row.get("持股数(万股)"))
    return {
        "fundCode": row.get("基金代码", "").strip(),
        "fundName": row.get("基金名称", "").strip(),
        "fundType": row.get("基金类型", "").strip(),
        "reportPeriod": row.get("报告期", "").strip(),
        "cutoffDate": row.get("截止日期", "").strip(),
        "ratio": rounded(ratio, 6),
        "ratioPercent": rounded(ratio * 100, 2),
        "marketValueWan": rounded_optional(market_value, 2),
        "sharesWan": rounded(shares, 2),
    }


def make_holding_record(row: dict[str, str]) -> dict[str, Any]:
    ratio = parse_float(row.get("占净值比例数值"))
    market_value = parse_optional_float(row.get("持仓市值(万元)"))
    shares = parse_float(row.get("持股数(万股)"))
    return {
        "rank": int(parse_float(row.get("序号"))),
        "stockCode": row.get("证券代码", "").strip(),
        "stockName": row.get("证券名称", "").strip(),
        "ratio": rounded(ratio, 6),
        "ratioPercent": rounded(ratio * 100, 2),
        "marketValueWan": rounded_optional(market_value, 2),
        "sharesWan": rounded(shares, 2),
    }


def is_index_fund(fund: dict[str, Any]) -> bool:
    text = f"{fund['fundName']} {fund['fundType']}".upper()
    return any(marker.upper() in text for marker in INDEX_FUND_MARKERS)


def better_record(current: dict[str, Any] | None, candidate: dict[str, Any]) -> dict[str, Any]:
    if current is None:
        return candidate
    current_score = (current["ratio"], current["marketValueWan"] or -1)
    candidate_score = (candidate["ratio"], candidate["marketValueWan"] or -1)
    return candidate if candidate_score > current_score else current


def ranking_key(fund: dict[str, Any], ranking: str) -> tuple[float, float, int, str]:
    if ranking == "value":
        return (
            fund["marketValueWan"] or -1,
            fund["ratio"],
            -share_class_penalty(fund),
            fund["fundCode"],
        )
    return (
        fund["ratio"],
        fund["marketValueWan"] or -1,
        -share_class_penalty(fund),
        fund["fundCode"],
    )


def unique_fund_families(funds: list[dict[str, Any]], ranking: str, limit: int = 10) -> list[dict[str, Any]]:
    grouped: dict[str, dict[str, Any]] = {}
    variant_counts: dict[str, int] = defaultdict(int)
    for fund in funds:
        key = fund_family_key(fund)
        variant_counts[key] += 1
        current = grouped.get(key)
        if current is None or ranking_key(fund, ranking) > ranking_key(current, ranking):
            grouped[key] = fund
    ranked = sorted(grouped.values(), key=lambda item: ranking_key(item, ranking), reverse=True)
    for fund in ranked:
        fund["fundFamilyKey"] = fund_family_key(fund)
        fund["fundVariantCount"] = variant_counts[fund["fundFamilyKey"]]
    return ranked[:limit]


def better_holding_record(current: dict[str, Any] | None, candidate: dict[str, Any]) -> dict[str, Any]:
    if current is None:
        return candidate
    current_score = (current["ratio"], current["marketValueWan"] or -1)
    candidate_score = (candidate["ratio"], candidate["marketValueWan"] or -1)
    return candidate if candidate_score > current_score else current


def build_index() -> dict[str, Any]:
    summary = load_summary()
    purchase_limits = load_purchase_limits()
    stock_rows: dict[str, dict[str, Any]] = {}
    stock_funds: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    fund_profiles: dict[str, dict[str, Any]] = {}
    fund_holdings: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    row_count = 0

    with SOURCE_CSV.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            code = row.get("证券代码", "").strip()
            name = row.get("证券名称", "").strip()
            if not code or not name:
                continue

            fund = enrich_fund_record(make_fund_record(row), purchase_limits)
            if not fund["fundCode"]:
                continue
            fund_profiles[fund["fundCode"]] = fund

            stock_rows.setdefault(
                code,
                {
                    "code": code,
                    "name": name,
                },
            )
            existing = stock_funds[code].get(fund["fundCode"])
            stock_funds[code][fund["fundCode"]] = better_record(existing, fund)

            holding = make_holding_record(row)
            holding_existing = fund_holdings[fund["fundCode"]].get(code)
            fund_holdings[fund["fundCode"]][code] = better_holding_record(holding_existing, holding)
            row_count += 1

    stocks: list[dict[str, Any]] = []
    for code, base in stock_rows.items():
        funds = list(stock_funds[code].values())
        active_funds = [fund for fund in funds if not is_index_fund(fund)]
        fund_family_count = len({fund_family_key(fund) for fund in funds})
        active_fund_family_count = len({fund_family_key(fund) for fund in active_funds})
        top_by_ratio = unique_fund_families(active_funds, "ratio")
        top_by_value = unique_fund_families(active_funds, "value")
        disclosed_market_values = [
            item["marketValueWan"] for item in active_funds if item["marketValueWan"] is not None
        ]
        total_market_value = sum(disclosed_market_values) if disclosed_market_values else None
        max_ratio = top_by_ratio[0]["ratioPercent"] if top_by_ratio else 0
        stocks.append(
            {
                "code": base["code"],
                "name": base["name"],
                "fundCount": fund_family_count,
                "activeFundCount": active_fund_family_count,
                "shareClassCount": len(funds),
                "activeShareClassCount": len(active_funds),
                "excludedIndexFundCount": len(funds) - len(active_funds),
                "totalMarketValueWan": rounded_optional(total_market_value, 2),
                "maxRatioPercent": max_ratio,
                "topByRatio": top_by_ratio,
                "topByValue": top_by_value,
            }
        )

    stocks.sort(key=lambda item: (-item["activeFundCount"], -item["fundCount"], item["code"]))
    overseas_stocks = [item for item in stocks if is_overseas_stock_code(item["code"])]
    popular_source = balanced_overseas_popular(overseas_stocks) if overseas_stocks else stocks[:60]
    popular_market_mix = {
        "hk": sum(1 for item in popular_source if stock_market_bucket(item["code"]) == "hk"),
        "us": sum(1 for item in popular_source if stock_market_bucket(item["code"]) == "us"),
        "other": sum(1 for item in popular_source if stock_market_bucket(item["code"]) == "other"),
    }
    popular = [
        {
            "code": item["code"],
            "name": item["name"],
            "fundCount": item["fundCount"],
            "activeFundCount": item["activeFundCount"],
            "maxRatioPercent": item["maxRatioPercent"],
        }
        for item in popular_source
    ]

    cutoff_dates = sorted(
        {fund["cutoffDate"] for stock in stocks for fund in stock["topByRatio"] if fund["cutoffDate"]}
    )
    report = summary.get("report", "2026Q1")
    visible_fund_codes = {
        fund["fundCode"]
        for stock in stocks
        for fund in [*stock["topByRatio"], *stock["topByValue"]]
        if fund["fundCode"]
    }
    fund_top_holdings: dict[str, list[dict[str, Any]]] = {}
    for fund_code in sorted(visible_fund_codes):
        holdings_by_stock = fund_holdings.get(fund_code, {})
        fund = fund_profiles.get(fund_code)
        if fund and is_index_fund(fund):
            continue
        sorted_holdings = sorted(
            holdings_by_stock.values(),
            key=lambda item: (
                item["rank"] if item["rank"] > 0 else 9999,
                -item["ratio"],
                item["stockCode"],
            ),
        )[:10]
        fund_top_holdings[fund_code] = sorted_holdings

    return {
        "meta": {
            "report": report,
            "sourceFile": SOURCE_CSV.name,
            "generatedAt": datetime.now().isoformat(timespec="seconds"),
            "sourceRows": row_count,
            "stockCount": len(stocks),
            "defaultRanking": "ratio",
            "defaultRankingLabel": "占基金净值比例",
            "alternateRankingLabel": "持仓市值(万元)",
            "fundFilter": "剔除基金类型或基金名称包含 指数、ETF、ETF联接 的基金",
            "cutoffDate": cutoff_dates[-1] if cutoff_dates else "",
            "fundCount": summary.get("fund_count"),
            "holdingRows": summary.get("holding_rows", {}).get("stock"),
            "purchaseLimitCount": len(purchase_limits),
            "fundDedupe": "同一基金不同份额、币种、前后端名称归并后，只保留该股票口径下最强的一类份额",
            "popularScope": "overseas" if overseas_stocks else "all",
            "popularScopeLabel": "海外热门" if overseas_stocks else "高覆盖股票",
            "overseasStockCount": len(overseas_stocks),
            "popularMarketMix": popular_market_mix,
        },
        "popularStocks": popular,
        "stocks": stocks,
        "fundHoldings": fund_top_holdings,
    }


def main() -> None:
    TARGET_JSON.parent.mkdir(parents=True, exist_ok=True)
    payload = build_index()
    with TARGET_JSON.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
    print(
        f"Wrote {TARGET_JSON} with {payload['meta']['stockCount']} stocks "
        f"from {payload['meta']['sourceRows']} holding rows."
    )


if __name__ == "__main__":
    main()
