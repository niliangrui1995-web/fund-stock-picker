from __future__ import annotations

import csv
import json
import re
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

from quarter_config import load_quarter_config


ROOT = Path(__file__).resolve().parents[1]
QUARTER = load_quarter_config()
SOURCE_CSV = QUARTER.source_stock_csv
FUND_INVESTMENT_CSV = QUARTER.source_fund_investment_csv
SUMMARY_JSON = QUARTER.run_summary_json
PURCHASE_LIMIT_CSV = ROOT / "outputs" / "fund_purchase_limit_snapshot.csv"
EXPOSURE_ALIASES_JSON = ROOT / "config" / "stock-exposure-aliases.json"
TARGET_JSON = QUARTER.fund_stock_index_json
INDEX_FUND_MARKERS = ("指数", "ETF", "ETF联接")
ON_EXCHANGE_FUND_MARKERS = ("ETF", "LOF", "封闭", "REIT")
LEVERAGED_LONG_MARKERS_RE = re.compile(
    r"(?i)(?:\b\d(?:\.\d+)?\s*X\b|\d(?:\.\d+)?\s*倍|杠杆|LEVERAGED|LEVERAGE|ULTRA)"
)
INVERSE_PRODUCT_RE = re.compile(r"(?i)(?:SHORT|BEAR|INVERSE|DOWN|PUT|做空|反向|反向做多)")
PRODUCT_MARKERS_RE = re.compile(r"(?i)(?:ETF|ETP|ETN|TRUST|SHARES?|NOTE|CERTIFICATE|PRODUCTS?|基金|产品)")
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


JAPANESE_STOCK_NAME_RE = re.compile(
    r"东京|丰田|索尼|日立|三菱|任天堂|软银|本田|东京电子|三井|住友|瑞穗|武田|迅销|基恩士|信越|村田|电装|佳能|尼康|日本"
)
KOREAN_STOCK_NAME_RE = re.compile(
    r"三星电子|SK海力士|现代汽车|起亚|LG|NAVER|Kakao|浦项|POSCO|Celltrion|韩华|韩国电力"
)


def stock_market_bucket(code: str, name: str = "") -> str:
    normalized = code.strip().upper()
    if re.fullmatch(r"\d{5}", normalized):
        return "hk"
    if re.fullmatch(r"\d{4}\.(T|JP)", normalized):
        return "jp"
    if re.fullmatch(r"\d{6}\.(KS|KQ)", normalized):
        return "kr"
    if re.fullmatch(r"[A-Z]{1,5}([.-][A-Z]{1,2})?", normalized):
        return "us"
    if re.fullmatch(r"\d{4}", normalized):
        return "jp" if JAPANESE_STOCK_NAME_RE.search(name) else "other"
    if re.fullmatch(r"\d{6}", normalized) and KOREAN_STOCK_NAME_RE.search(name):
        return "kr"
    if re.fullmatch(r"\d{6}", normalized) or re.fullmatch(r"A\d+", normalized):
        return "a"
    return "other"


def is_overseas_stock_code(code: str, name: str = "") -> bool:
    return stock_market_bucket(code, name) != "a"


def balanced_overseas_popular(stocks: list[dict[str, Any]], limit: int = 60) -> list[dict[str, Any]]:
    quotas = {"us": 30, "hk": 16, "jp": 4, "kr": 4, "other": 6}
    cycle = ("us", "us", "hk", "us", "kr", "hk", "jp", "us", "other", "us")
    buckets = {bucket: [] for bucket in quotas}
    for item in stocks:
        buckets[stock_market_bucket(item["code"], item["name"])].append(item)

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
                "minPurchase": row.get("起购金额", "").strip(),
                "dailyPurchaseLimit": row.get("日累计限购额度", "").strip(),
            }
    return limits


def load_purchase_limit_metadata() -> dict[str, Any]:
    if not PURCHASE_LIMIT_CSV.exists():
        return {}
    fetched_at_values: set[str] = set()
    source_values: set[str] = set()
    net_value_dates: Counter[str] = Counter()
    with PURCHASE_LIMIT_CSV.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            fetched_at = row.get("抓取时间", "").strip()
            source = row.get("数据源", "").strip()
            net_value_date = row.get("净值日期", "").strip()
            if fetched_at:
                fetched_at_values.add(fetched_at)
            if source:
                source_values.add(source)
            if net_value_date:
                net_value_dates[net_value_date] += 1
    return {
        "purchaseLimitFetchedAt": max(fetched_at_values) if fetched_at_values else "",
        "purchaseLimitSource": sorted(source_values)[0] if source_values else "",
        "purchaseLimitNetValueDates": [date for date, _count in net_value_dates.most_common(3)],
    }


def load_fund_investment_rows() -> list[dict[str, str]]:
    if not FUND_INVESTMENT_CSV.exists():
        return []
    with FUND_INVESTMENT_CSV.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def load_exposure_aliases() -> dict[str, Any]:
    if not EXPOSURE_ALIASES_JSON.exists():
        return {"stockAliases": {}, "knownProducts": []}
    with EXPOSURE_ALIASES_JSON.open("r", encoding="utf-8-sig") as handle:
        parsed = json.load(handle)
    if isinstance(parsed, dict):
        return parsed
    return {"stockAliases": {}, "knownProducts": []}


def normalize_alias_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().upper())


def is_ascii_alias(value: str) -> bool:
    return bool(re.fullmatch(r"[A-Z0-9][A-Z0-9 .&/-]*", normalize_alias_text(value)))


def alias_in_text(alias: str, text: str) -> bool:
    alias = normalize_alias_text(alias)
    text = normalize_alias_text(text)
    if not alias:
        return False
    if is_ascii_alias(alias):
        pattern = rf"(?<![A-Z0-9]){re.escape(alias)}(?![A-Z0-9])"
        return re.search(pattern, text) is not None
    return alias in text


def parse_leverage_multiple(text: str, configured: Any = None) -> float | None:
    if isinstance(configured, (int, float)) and configured > 0:
        return float(configured)
    normalized = normalize_alias_text(text)
    match = re.search(r"(?<!\d)(\d(?:\.\d+)?)\s*X(?![A-Z0-9])", normalized)
    if match:
        return float(match.group(1))
    match = re.search(r"(\d(?:\.\d+)?)\s*倍", normalized)
    if match:
        return float(match.group(1))
    if "ULTRAPRO" in normalized or "3X" in normalized:
        return 3.0
    if "ULTRA" in normalized or "LEVERAGED" in normalized or "LEVERAGE" in normalized or "杠杆" in normalized:
        return 2.0
    return None


def is_leveraged_long_product(code: str, name: str, known_product: dict[str, Any] | None = None) -> bool:
    if known_product is not None:
        return True
    text = f"{code} {name}"
    if INVERSE_PRODUCT_RE.search(text):
        return False
    if not LEVERAGED_LONG_MARKERS_RE.search(text):
        return False
    return bool(PRODUCT_MARKERS_RE.search(text) or re.search(r"(?i)\b(LONG|BULL)\b", text))


def configured_known_products(alias_config: dict[str, Any]) -> dict[str, dict[str, Any]]:
    products: dict[str, dict[str, Any]] = {}
    for item in alias_config.get("knownProducts", []):
        if not isinstance(item, dict):
            continue
        source_code = normalize_alias_text(str(item.get("sourceCode", ""))).replace(" ", "")
        target_code = str(item.get("targetCode", "")).strip()
        if source_code and target_code:
            products[source_code] = item
    return products


def stock_alias_candidates(stock_rows: dict[str, dict[str, Any]], alias_config: dict[str, Any]) -> list[dict[str, Any]]:
    configured_aliases = alias_config.get("stockAliases", {})
    candidates: list[dict[str, Any]] = []
    for code, stock in stock_rows.items():
        if not is_overseas_stock_code(code, stock["name"]):
            continue
        aliases = {code, stock["name"]}
        for alias in configured_aliases.get(code, []):
            if isinstance(alias, str):
                aliases.add(alias)
        aliases = {alias.strip() for alias in aliases if alias and alias.strip()}
        candidates.append(
            {
                "code": code,
                "aliases": sorted(aliases, key=lambda value: len(value), reverse=True),
            }
        )
    candidates.sort(key=lambda item: max((len(alias) for alias in item["aliases"]), default=0), reverse=True)
    return candidates


def match_indirect_target(
    source_code: str,
    source_name: str,
    stock_rows: dict[str, dict[str, Any]],
    alias_candidates: list[dict[str, Any]],
    known_products: dict[str, dict[str, Any]],
) -> tuple[str, dict[str, Any] | None, str] | None:
    normalized_source_code = normalize_alias_text(source_code).replace(" ", "")
    known_product = known_products.get(normalized_source_code)
    if known_product is not None:
        target_code = str(known_product.get("targetCode", "")).strip()
        if target_code in stock_rows and target_code != source_code:
            return target_code, known_product, f"known product {source_code}"

    if not is_leveraged_long_product(source_code, source_name):
        return None

    text = f"{source_code} {source_name}"
    best_match: tuple[str, int, str] | None = None
    for item in alias_candidates:
        target_code = item["code"]
        if target_code == source_code:
            continue
        for alias in item["aliases"]:
            if alias_in_text(alias, text):
                score = len(alias)
                if best_match is None or score > best_match[1]:
                    best_match = (target_code, score, alias)
                break
    if best_match is None:
        return None
    return best_match[0], None, f"name matched {best_match[2]}"


def make_indirect_exposure_record(
    row: dict[str, str],
    target_code: str,
    target_name: str,
    known_product: dict[str, Any] | None,
    match_reason: str,
) -> dict[str, Any]:
    fund = make_fund_record(row)
    leverage_multiple = parse_leverage_multiple(
        f"{row.get('证券代码', '')} {row.get('证券名称', '')}",
        known_product.get("leverageMultiple") if known_product else None,
    )
    estimated_ratio = fund["ratio"] * leverage_multiple if leverage_multiple else None
    fund.update(
        {
            "sourceCode": row.get("证券代码", "").strip() or row.get("证券名称", "").strip(),
            "sourceName": row.get("证券名称", "").strip(),
            "targetCode": target_code,
            "targetName": target_name,
            "exposureType": "leveraged_etf",
            "exposureTypeLabel": "个股杠杆 ETF/ETP",
            "leverageMultiple": rounded(leverage_multiple, 2) if leverage_multiple else None,
            "estimatedRatio": rounded(estimated_ratio, 6) if estimated_ratio is not None else None,
            "estimatedRatioPercent": rounded(estimated_ratio * 100, 2)
            if estimated_ratio is not None
            else None,
            "matchReason": match_reason,
        }
    )
    return fund


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
            "minPurchase": limit.get("minPurchase", ""),
            "dailyPurchaseLimit": limit.get("dailyPurchaseLimit", ""),
        }
    )
    return fund


def public_fund_record(fund: dict[str, Any]) -> dict[str, Any]:
    return {
        "fundCode": fund["fundCode"],
        "fundName": fund["fundName"],
        "fundType": fund["fundType"],
        "ratioPercent": fund["ratioPercent"],
        "marketValueWan": fund["marketValueWan"],
        "sharesWan": fund["sharesWan"],
        "purchaseStatus": fund.get("purchaseStatus", ""),
        "redemptionStatus": fund.get("redemptionStatus", ""),
        "minPurchase": fund.get("minPurchase", ""),
        "dailyPurchaseLimit": fund.get("dailyPurchaseLimit", ""),
        "fundVariantCount": fund.get("fundVariantCount", 1),
        "fundVariantCodes": fund.get("fundVariantCodes", [fund["fundCode"]]),
        "fundDisplayName": fund.get("fundDisplayName", fund["fundName"]),
    }


def public_indirect_exposure_record(fund: dict[str, Any]) -> dict[str, Any]:
    record = public_fund_record(fund)
    record.update(
        {
            "sourceCode": fund["sourceCode"],
            "sourceName": fund["sourceName"],
            "targetCode": fund["targetCode"],
            "targetName": fund["targetName"],
            "exposureType": fund["exposureType"],
            "exposureTypeLabel": fund["exposureTypeLabel"],
            "leverageMultiple": fund.get("leverageMultiple"),
            "estimatedRatioPercent": fund.get("estimatedRatioPercent"),
            "matchReason": fund.get("matchReason", ""),
        }
    )
    return record


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


def strip_wrapped_display_share_markers(name: str) -> str:
    pattern = r"[（(]([^）)]*)[）)]$"
    while True:
        match = re.search(pattern, name)
        if not match:
            return name
        text = match.group(1).upper()
        share_class_pattern = "|".join(SHARE_CLASS_SUFFIXES)
        if (
            any(marker.upper() in text for marker in CURRENCY_MARKERS)
            or re.fullmatch(rf"(?:{share_class_pattern})(?:/(?:{share_class_pattern}))*类?", text, flags=re.I)
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


def fund_family_display_name(fund: dict[str, Any]) -> str:
    name = fund["fundName"].strip()
    name = re.sub(r"\s+", "", name)
    name = strip_wrapped_display_share_markers(name)
    changed = True
    currency_markers = sorted(
        ["人民币份额", "美元份额", *CURRENCY_MARKERS, "前端", "后端"],
        key=len,
        reverse=True,
    )
    share_class_pattern = "|".join(SHARE_CLASS_SUFFIXES)
    while changed:
        changed = False
        for marker in currency_markers:
            next_name = re.sub(
                rf"{re.escape(marker)}(?:{share_class_pattern})?类?$",
                "",
                name,
                flags=re.I,
            )
            if next_name != name:
                name = next_name
                changed = True
                break
        if changed:
            continue
        next_name = re.sub(rf"(?:{share_class_pattern})类?$", "", name, flags=re.I)
        next_name = re.sub(
            rf"(?:{share_class_pattern})(?:/(?:{share_class_pattern}))+$",
            "",
            next_name,
            flags=re.I,
        )
        if next_name != name:
            name = next_name
            changed = True
    return name or fund["fundName"].strip()


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


def is_etf_feeder_fund(fund: dict[str, Any]) -> bool:
    text = f"{fund['fundName']} {fund['fundType']}".upper()
    return "ETF" in text and "联接" in text


def is_on_exchange_fund(fund: dict[str, Any]) -> bool:
    text = f"{fund['fundName']} {fund['fundType']}".upper()
    if is_etf_feeder_fund(fund):
        return False
    return any(marker.upper() in text for marker in ON_EXCHANGE_FUND_MARKERS)


def better_record(current: dict[str, Any] | None, candidate: dict[str, Any]) -> dict[str, Any]:
    if current is None:
        return candidate
    current_score = (current["ratio"], current["marketValueWan"] or -1)
    candidate_score = (candidate["ratio"], candidate["marketValueWan"] or -1)
    return candidate if candidate_score > current_score else current


def ranking_key(fund: dict[str, Any], ranking: str) -> tuple[Any, ...]:
    if ranking == "estimated":
        return (
            fund.get("estimatedRatio") or fund["ratio"],
            fund["ratio"],
            fund["marketValueWan"] or -1,
            -share_class_penalty(fund),
            fund["fundCode"],
        )
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
    variant_codes: dict[str, set[str]] = defaultdict(set)
    for fund in funds:
        key = fund_family_key(fund)
        if fund["fundCode"]:
            variant_codes[key].add(fund["fundCode"])
        current = grouped.get(key)
        if current is None or ranking_key(fund, ranking) > ranking_key(current, ranking):
            grouped[key] = fund
    ranked = sorted(grouped.values(), key=lambda item: ranking_key(item, ranking), reverse=True)
    for fund in ranked:
        fund["fundFamilyKey"] = fund_family_key(fund)
        codes = sorted(variant_codes[fund["fundFamilyKey"]])
        fund["fundVariantCount"] = len(codes)
        fund["fundVariantCodes"] = codes
        fund["fundDisplayName"] = fund_family_display_name(fund)
    return ranked[:limit]


def better_holding_record(current: dict[str, Any] | None, candidate: dict[str, Any]) -> dict[str, Any]:
    if current is None:
        return candidate
    current_score = (current["ratio"], current["marketValueWan"] or -1)
    candidate_score = (candidate["ratio"], candidate["marketValueWan"] or -1)
    return candidate if candidate_score > current_score else current


def better_indirect_exposure_record(
    current: dict[str, Any] | None,
    candidate: dict[str, Any],
) -> dict[str, Any]:
    if current is None:
        return candidate
    current_score = (
        current.get("estimatedRatio") or current["ratio"],
        current["ratio"],
        current["marketValueWan"] or -1,
    )
    candidate_score = (
        candidate.get("estimatedRatio") or candidate["ratio"],
        candidate["ratio"],
        candidate["marketValueWan"] or -1,
    )
    return candidate if candidate_score > current_score else current


def build_index() -> dict[str, Any]:
    summary = load_summary()
    purchase_limits = load_purchase_limits()
    purchase_limit_metadata = load_purchase_limit_metadata()
    exposure_aliases = load_exposure_aliases()
    fund_investment_rows = load_fund_investment_rows()
    stock_rows: dict[str, dict[str, Any]] = {}
    stock_funds: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    indirect_exposures: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    fund_profiles: dict[str, dict[str, Any]] = {}
    fund_holdings: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    source_rows: list[dict[str, str]] = []
    row_count = 0

    with SOURCE_CSV.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            code = row.get("证券代码", "").strip()
            name = row.get("证券名称", "").strip()
            if not code or not name:
                continue
            source_rows.append(row)

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

    alias_candidates = stock_alias_candidates(stock_rows, exposure_aliases)
    known_products = configured_known_products(exposure_aliases)
    for row in [*source_rows, *fund_investment_rows]:
        source_code = row.get("证券代码", "").strip()
        source_name = row.get("证券名称", "").strip()
        if not source_name:
            continue
        source_code_for_match = source_code or source_name
        target_match = match_indirect_target(
            source_code_for_match,
            source_name,
            stock_rows,
            alias_candidates,
            known_products,
        )
        if target_match is None:
            continue
        target_code, known_product, match_reason = target_match
        fund = enrich_fund_record(
            make_indirect_exposure_record(
                row,
                target_code,
                stock_rows[target_code]["name"],
                known_product,
                match_reason,
            ),
            purchase_limits,
        )
        if not fund["fundCode"]:
            continue
        existing = indirect_exposures[target_code].get(fund["fundCode"])
        indirect_exposures[target_code][fund["fundCode"]] = better_indirect_exposure_record(
            existing,
            fund,
        )

    stocks: list[dict[str, Any]] = []
    for code, base in stock_rows.items():
        funds = list(stock_funds[code].values())
        indirect_funds = list(indirect_exposures.get(code, {}).values())
        active_funds = [fund for fund in funds if not is_index_fund(fund)]
        on_exchange_funds = [fund for fund in funds if is_on_exchange_fund(fund)]
        fund_family_count = len({fund_family_key(fund) for fund in funds})
        active_fund_family_count = len({fund_family_key(fund) for fund in active_funds})
        on_exchange_fund_family_count = len({fund_family_key(fund) for fund in on_exchange_funds})
        indirect_fund_family_count = len({fund_family_key(fund) for fund in indirect_funds})
        top_by_ratio = unique_fund_families(active_funds, "ratio")
        top_by_value = unique_fund_families(active_funds, "value")
        top_on_exchange_by_ratio = unique_fund_families(on_exchange_funds, "ratio")
        top_indirect_exposure_by_ratio = unique_fund_families(indirect_funds, "estimated")
        disclosed_market_values = [
            item["marketValueWan"] for item in active_funds if item["marketValueWan"] is not None
        ]
        on_exchange_market_values = [
            item["marketValueWan"] for item in on_exchange_funds if item["marketValueWan"] is not None
        ]
        total_market_value = sum(disclosed_market_values) if disclosed_market_values else None
        on_exchange_total_market_value = (
            sum(on_exchange_market_values) if on_exchange_market_values else None
        )
        max_ratio = top_by_ratio[0]["ratioPercent"] if top_by_ratio else 0
        on_exchange_max_ratio = (
            top_on_exchange_by_ratio[0]["ratioPercent"] if top_on_exchange_by_ratio else 0
        )
        indirect_max_estimated_ratio = (
            top_indirect_exposure_by_ratio[0].get("estimatedRatioPercent")
            if top_indirect_exposure_by_ratio
            else 0
        )
        if indirect_max_estimated_ratio is None:
            indirect_max_estimated_ratio = (
                top_indirect_exposure_by_ratio[0]["ratioPercent"]
                if top_indirect_exposure_by_ratio
                else 0
            )
        stocks.append(
            {
                "code": base["code"],
                "name": base["name"],
                "fundCount": fund_family_count,
                "activeFundCount": active_fund_family_count,
                "shareClassCount": len(funds),
                "activeShareClassCount": len(active_funds),
                "onExchangeFundCount": on_exchange_fund_family_count,
                "onExchangeShareClassCount": len(on_exchange_funds),
                "indirectExposureFundCount": indirect_fund_family_count,
                "indirectExposureShareClassCount": len(indirect_funds),
                "excludedIndexFundCount": len(funds) - len(active_funds),
                "totalMarketValueWan": rounded_optional(total_market_value, 2),
                "onExchangeTotalMarketValueWan": rounded_optional(on_exchange_total_market_value, 2),
                "maxRatioPercent": max_ratio,
                "onExchangeMaxRatioPercent": on_exchange_max_ratio,
                "indirectExposureMaxEstimatedRatioPercent": indirect_max_estimated_ratio,
                "topByRatio": top_by_ratio,
                "topByValue": top_by_value,
                "topOnExchangeByRatio": top_on_exchange_by_ratio,
                "topIndirectExposureByRatio": top_indirect_exposure_by_ratio,
            }
        )

    stocks.sort(key=lambda item: (-item["activeFundCount"], -item["fundCount"], item["code"]))
    overseas_stocks = [item for item in stocks if is_overseas_stock_code(item["code"], item["name"])]
    export_stocks = overseas_stocks if overseas_stocks else stocks
    popular_source = balanced_overseas_popular(overseas_stocks) if overseas_stocks else stocks[:60]
    popular_market_mix = {
        "hk": sum(1 for item in popular_source if stock_market_bucket(item["code"], item["name"]) == "hk"),
        "us": sum(1 for item in popular_source if stock_market_bucket(item["code"], item["name"]) == "us"),
        "jp": sum(1 for item in popular_source if stock_market_bucket(item["code"], item["name"]) == "jp"),
        "kr": sum(1 for item in popular_source if stock_market_bucket(item["code"], item["name"]) == "kr"),
        "other": sum(1 for item in popular_source if stock_market_bucket(item["code"], item["name"]) == "other"),
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
        {
            fund["cutoffDate"]
            for stock in stocks
            for fund in [*stock["topByRatio"], *stock["topOnExchangeByRatio"]]
            if fund["cutoffDate"]
        }
    )
    report = summary.get("report", QUARTER.report)
    visible_fund_codes = {
        fund["fundCode"]
        for stock in export_stocks
        for fund in [
            *stock["topByRatio"],
            *stock["topByValue"],
            *stock["topOnExchangeByRatio"],
            *stock["topIndirectExposureByRatio"],
        ]
        if fund["fundCode"]
    }
    fund_top_holdings: dict[str, list[dict[str, Any]]] = {}
    for fund_code in sorted(visible_fund_codes):
        holdings_by_stock = fund_holdings.get(fund_code, {})
        sorted_holdings = sorted(
            holdings_by_stock.values(),
            key=lambda item: (
                item["rank"] if item["rank"] > 0 else 9999,
                -item["ratio"],
                item["stockCode"],
            ),
        )[:10]
        fund_top_holdings[fund_code] = sorted_holdings

    public_stocks = [
        {
            **stock,
            "topByRatio": [public_fund_record(fund) for fund in stock["topByRatio"]],
            "topByValue": [public_fund_record(fund) for fund in stock["topByValue"]],
            "topOnExchangeByRatio": [
                public_fund_record(fund) for fund in stock["topOnExchangeByRatio"]
            ],
            "topIndirectExposureByRatio": [
                public_indirect_exposure_record(fund)
                for fund in stock["topIndirectExposureByRatio"]
            ],
        }
        for stock in export_stocks
    ]

    return {
        "meta": {
            "report": report,
            "sourceFile": SOURCE_CSV.name,
            "fundInvestmentSourceFile": FUND_INVESTMENT_CSV.name if FUND_INVESTMENT_CSV.exists() else "",
            "generatedAt": datetime.now().isoformat(timespec="seconds"),
            "sourceRows": row_count,
            "fundInvestmentSourceRows": len(fund_investment_rows),
            "stockCount": len(public_stocks),
            "totalStockCount": len(stocks),
            "defaultRanking": "ratio",
            "defaultRankingLabel": "占基金净值比例",
            "alternateRankingLabel": "持仓市值(万元)",
            "fundFilter": "剔除基金类型或基金名称包含 指数、ETF、ETF联接 的基金",
            "onExchangeFundFilter": "基金名称或类型包含 ETF、LOF、封闭、REIT，且排除 ETF 联接基金",
            "indirectExposureFilter": "股票持仓明细或定期报告基金投资明细中，证券名称或代码匹配海外个股杠杆 ETF/ETP/ETN/产品，并映射到对应正股后单独展示",
            "cutoffDate": cutoff_dates[-1] if cutoff_dates else "",
            "fundCount": summary.get("fund_count"),
            "holdingRows": summary.get("holding_rows", {}).get("stock"),
            "purchaseLimitCount": len(purchase_limits),
            **purchase_limit_metadata,
            "indirectExposureRows": sum(len(items) for items in indirect_exposures.values()),
            "fundDedupe": "同一基金不同份额、币种、前后端名称归并后，只保留该股票口径下最强的一类份额",
            "popularScope": "overseas" if overseas_stocks else "all",
            "popularScopeLabel": "海外热门" if overseas_stocks else "高覆盖股票",
            "overseasStockCount": len(overseas_stocks),
            "shippedStockScope": "overseas" if overseas_stocks else "all",
            "shippedStockCount": len(public_stocks),
            "popularMarketMix": popular_market_mix,
        },
        "popularStocks": popular,
        "stocks": public_stocks,
        "fundHoldings": fund_top_holdings,
    }


def main() -> None:
    TARGET_JSON.parent.mkdir(parents=True, exist_ok=True)
    payload = build_index()
    temp_json = TARGET_JSON.with_name(f".{TARGET_JSON.name}.tmp")
    with temp_json.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
    temp_json.replace(TARGET_JSON)
    print(
        f"Wrote {TARGET_JSON} with {payload['meta']['stockCount']} stocks "
        f"from {payload['meta']['sourceRows']} holding rows."
    )


if __name__ == "__main__":
    main()
