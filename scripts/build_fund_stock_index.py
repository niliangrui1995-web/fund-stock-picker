from __future__ import annotations

import csv
import hashlib
import json
import math
import re
import shutil
import uuid
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

from atomic_publish import publish_staged_files
from quarter_config import load_quarter_config


ROOT = Path(__file__).resolve().parents[1]
QUARTER = load_quarter_config()
SOURCE_CSV = QUARTER.source_stock_csv
FUND_INVESTMENT_CSV = QUARTER.source_fund_investment_csv
SUMMARY_JSON = QUARTER.run_summary_json
PURCHASE_LIMIT_CSV = ROOT / "outputs" / "fund_purchase_limit_snapshot.csv"
EXPOSURE_ALIASES_JSON = ROOT / "config" / "stock-exposure-aliases.json"
TARGET_JSON = QUARTER.fund_stock_index_json
FUND_REPORT_SUMMARY_JSON = ROOT / "outputs" / f"fund_report_holdings_summary_{QUARTER.slug}.json"
QDII_H1_CSV = ROOT / "outputs" / f"holdings_qdii_{QUARTER.year}h1.csv"
QDII_H1_SUMMARY_JSON = ROOT / "outputs" / f"qdii_half_year_holdings_summary_{QUARTER.year}.json"
FUND_LIST_CSV = ROOT / "outputs" / f"fund_list_{QUARTER.slug}.csv"
INDIRECT_EXPOSURE_AUDIT_MD = ROOT / "public" / "seo" / f"indirect-exposure-audit-{QUARTER.slug}.md"
QDII_RICH_JSON = TARGET_JSON.with_name(f"qdii-fund-holdings-{QUARTER.year}h1.json")
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


def csv_text(value: str | None) -> str:
    """Undo the CSV formula guard only when this reader needs the source value."""
    value = (value or "").strip()
    return value[1:] if value.startswith("\t") else value


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
    r"三星电子|SK\s*(?:海力士|HYNIX)|现代汽车|起亚|LG|NAVER|Kakao|浦项|POSCO|Celltrion|韩华|韩国电力",
    re.IGNORECASE,
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


def validate_source_summary(summary: dict[str, Any], actual_stock_rows: int) -> None:
    summary_holding_rows = summary.get("holding_rows")
    expected_stock_rows = (
        summary_holding_rows.get("stock") if isinstance(summary_holding_rows, dict) else None
    )
    if not isinstance(expected_stock_rows, int) or isinstance(expected_stock_rows, bool):
        raise ValueError("run summary holding_rows.stock 缺失或不是整数")
    if expected_stock_rows != actual_stock_rows:
        raise ValueError(
            "run summary holding_rows.stock 与实际有效股票持仓行数不一致："
            f"summary={expected_stock_rows}, actual={actual_stock_rows}"
        )
    fund_count = summary.get("fund_count")
    status_rows = summary.get("status_rows")
    if not isinstance(fund_count, int) or isinstance(fund_count, bool) or fund_count < 0:
        raise ValueError("run summary fund_count 缺失或不是非负整数")
    if not isinstance(status_rows, int) or isinstance(status_rows, bool) or status_rows < 0:
        raise ValueError("run summary status_rows 缺失或不是非负整数")
    if status_rows != fund_count:
        raise ValueError(
            "run summary status_rows 未覆盖全部基金："
            f"status_rows={status_rows}, fund_count={fund_count}"
        )
    selected_types = summary.get("selected_types")
    if not isinstance(selected_types, list) or "stock" not in selected_types:
        raise ValueError("run summary selected_types 必须包含 stock")
    status_counts = summary.get("status_counts")
    stock_status_counts = status_counts.get("stock") if isinstance(status_counts, dict) else None
    if not isinstance(stock_status_counts, dict):
        raise ValueError("run summary status_counts.stock 缺失或不是对象")
    normalized_counts: dict[str, int] = {}
    for status, count in stock_status_counts.items():
        if not isinstance(status, str) or not isinstance(count, int) or isinstance(count, bool) or count < 0:
            raise ValueError("run summary status_counts.stock 包含无效状态计数")
        normalized_counts[status] = count
    if sum(normalized_counts.values()) != fund_count:
        raise ValueError(
            "run summary status_counts.stock 未覆盖全部基金："
            f"counted={sum(normalized_counts.values())}, fund_count={fund_count}"
        )
    if normalized_counts.get("error", 0) > 0:
        raise ValueError(
            "run summary status_counts.stock 包含 error 状态，拒绝生成发布包："
            f"error={normalized_counts['error']}"
        )


def load_fund_report_summary() -> dict[str, Any]:
    if not FUND_REPORT_SUMMARY_JSON.exists():
        return {}
    with FUND_REPORT_SUMMARY_JSON.open("r", encoding="utf-8-sig") as handle:
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
        return {"stockAliases": {}, "stockCodeAliases": {}, "knownProducts": []}
    with EXPOSURE_ALIASES_JSON.open("r", encoding="utf-8-sig") as handle:
        parsed = json.load(handle)
    if isinstance(parsed, dict):
        return parsed
    return {"stockAliases": {}, "stockCodeAliases": {}, "knownProducts": []}


def normalize_alias_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().upper())


def configured_stock_code_aliases(alias_config: dict[str, Any]) -> dict[str, str]:
    raw_aliases = alias_config.get("stockCodeAliases", {})
    if not isinstance(raw_aliases, dict):
        return {}
    aliases: dict[str, str] = {}
    for raw_code, target_code in raw_aliases.items():
        if not isinstance(raw_code, str) or not isinstance(target_code, str):
            continue
        normalized = normalize_alias_text(raw_code).replace(" ", "")
        target = target_code.strip()
        if normalized and target:
            aliases[normalized] = target
    return aliases


def canonical_stock_code(code: str, aliases: dict[str, str]) -> str:
    raw_code = code.strip()
    return aliases.get(normalize_alias_text(raw_code).replace(" ", ""), raw_code)


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


def configured_ignored_products(alias_config: dict[str, Any]) -> list[dict[str, Any]]:
    products: list[dict[str, Any]] = []
    for item in alias_config.get("ignoredProducts", []):
        if isinstance(item, dict):
            products.append(item)
    return products


def ignored_product_reason(row: dict[str, str], ignored_products: list[dict[str, Any]]) -> str:
    source_code = row.get("证券代码", "").strip()
    source_name = row.get("证券名称", "").strip()
    normalized_source_code = normalize_alias_text(source_code).replace(" ", "")
    text = f"{source_code} {source_name}"
    for item in ignored_products:
        configured_code = normalize_alias_text(str(item.get("sourceCode", ""))).replace(" ", "")
        if configured_code and configured_code == normalized_source_code:
            return str(item.get("reason", "")).strip()
        for alias in item.get("aliases", []):
            if isinstance(alias, str) and alias_in_text(alias, text):
                return str(item.get("reason", "")).strip()
    return ""


def unmapped_fund_investment_reason(
    row: dict[str, str],
    ignored_products: list[dict[str, Any]],
) -> str:
    reason = ignored_product_reason(row, ignored_products)
    if reason:
        return f"已确认暂不映射：{reason}"
    return "未匹配到站内正股；如需要展示，补 `config/stock-exposure-aliases.json`。"


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


def repo_relative(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT)).replace("\\", "/")
    except ValueError:
        return str(path).replace("\\", "/")


def markdown_cell(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).replace("\r", " ").replace("\n", " ").strip()
    return text.replace("|", "\\|")


def markdown_table(headers: list[str], rows: list[list[Any]]) -> str:
    if not rows:
        return "_无。_"
    rendered = [
        "| " + " | ".join(markdown_cell(header) for header in headers) + " |",
        "| " + " | ".join("---" for _header in headers) + " |",
    ]
    rendered.extend(
        "| " + " | ".join(markdown_cell(value) for value in row) + " |" for row in rows
    )
    return "\n".join(rendered)


def status_label(status: str) -> str:
    labels = {
        "ok": "解析到杠杆明细",
        "no_leveraged_fund_investment": "报告已解析，无正向杠杆明细",
        "no_report": "未找到本季报告",
        "no_report_id": "公告缺少 ID",
        "pdf_parse_error": "PDF 解析失败",
        "error": "抓取或解析异常",
    }
    return labels.get(status, status or "未知")


def skipped_candidate_reason(
    result: dict[str, Any],
    mapped_rows: int,
    unmapped_reason: str = "",
) -> str:
    status = str(result.get("status", ""))
    rows_found = int(result.get("rows_found") or 0)
    if mapped_rows > 0:
        return ""
    if rows_found > 0:
        if unmapped_reason:
            return unmapped_reason
        return "解析到杠杆明细，但未通过映射配置匹配到站内正股"
    if status == "no_leveraged_fund_investment":
        return "报告已解析，但基金投资明细里没有正向个股杠杆产品"
    if status == "no_report":
        return "未找到当前季度定期报告"
    if status == "no_report_id":
        return "找到公告但缺少公告 ID，无法下载 PDF"
    if status == "pdf_parse_error":
        return "PDF 下载后解析失败"
    if status == "error":
        return result.get("error", "") or "抓取或解析异常"
    return status_label(status)


def flatten_indirect_exposure_rows(
    indirect_exposures: dict[str, dict[str, dict[str, Any]]],
) -> list[dict[str, Any]]:
    rows = [
        fund
        for target_code in sorted(indirect_exposures)
        for fund in indirect_exposures[target_code].values()
    ]
    rows.sort(
        key=lambda item: (
            item.get("targetCode", ""),
            item.get("sourceCode", ""),
            item.get("fundCode", ""),
        )
    )
    return rows


def render_indirect_exposure_audit(
    payload: dict[str, Any],
    fetch_summary: dict[str, Any],
    fund_investment_rows: list[dict[str, str]],
    indirect_exposures: dict[str, dict[str, dict[str, Any]]],
    exposure_aliases: dict[str, Any],
) -> str:
    meta = payload["meta"]
    candidate_results = fetch_summary.get("candidate_results", [])
    final_rows = flatten_indirect_exposure_rows(indirect_exposures)
    mapped_rows_by_fund = Counter(row["fundCode"] for row in final_rows)
    ignored_products = configured_ignored_products(exposure_aliases)
    parsed_statuses = {"ok", "no_leveraged_fund_investment"}
    parsed_results = [
        result for result in candidate_results if result.get("status") in parsed_statuses
    ]
    skipped_results = [
        result
        for result in candidate_results
        if mapped_rows_by_fund.get(result.get("fundCode", ""), 0) == 0
    ]
    final_keys = {
        (row.get("fundCode", ""), row.get("sourceCode", ""), row.get("sourceName", ""))
        for row in final_rows
    }
    unmapped_fund_investment_rows = [
        row
        for row in fund_investment_rows
        if (row.get("基金代码", ""), row.get("证券代码", ""), row.get("证券名称", ""))
        not in final_keys
    ]
    unmapped_reasons_by_fund: dict[str, set[str]] = defaultdict(set)
    for row in unmapped_fund_investment_rows:
        reason = unmapped_fund_investment_reason(row, ignored_products)
        if reason.startswith("已确认暂不映射"):
            unmapped_reasons_by_fund[row.get("基金代码", "")].add(reason)

    product_mappings: dict[tuple[Any, ...], set[str]] = defaultdict(set)
    for row in final_rows:
        key = (
            row.get("sourceCode", ""),
            row.get("sourceName", ""),
            row.get("targetCode", ""),
            row.get("targetName", ""),
            row.get("leverageMultiple", ""),
            row.get("matchReason", ""),
        )
        product_mappings[key].add(row.get("fundCode", ""))

    lines = [
        f"# {meta.get('report', QUARTER.report)} 间接 / 杠杆 ETF 暴露维护审计",
        "",
        (
            "只读维护产物，由 `scripts/build_fund_stock_index.py` 根据定期报告解析结果、"
            "`config/stock-exposure-aliases.json` 和最终前端数据生成；不要手工修改它来修页面展示。"
        ),
        "",
        f"- 生成时间：`{meta.get('generatedAt', '')}`",
        f"- 前端数据：`{repo_relative(TARGET_JSON)}`",
        f"- 报告解析 summary：`{repo_relative(FUND_REPORT_SUMMARY_JSON)}`",
        f"- 报告解析 CSV：`{repo_relative(FUND_INVESTMENT_CSV)}`",
        f"- 映射配置：`{repo_relative(EXPOSURE_ALIASES_JSON)}`",
        "",
        "## 总览",
        "",
        markdown_table(
            ["项目", "值"],
            [
                ["报告期", meta.get("report", "")],
                ["候选范围", fetch_summary.get("candidate_scope", "")],
                ["候选基金数", fetch_summary.get("candidate_fund_count", "")],
                ["已解析 LOF/QDII 定期报告", len(parsed_results) if candidate_results else "见状态计数"],
                ["候选未进入 indirectExposureRows", len(skipped_results) if candidate_results else ""],
                ["报告 PDF 解析出的杠杆明细", meta.get("fundInvestmentSourceRows", "")],
                ["最终 indirectExposureRows", meta.get("indirectExposureRows", "")],
                ["stockAliases 正股数", len(exposure_aliases.get("stockAliases", {}))],
                ["knownProducts 产品数", len(exposure_aliases.get("knownProducts", []))],
                ["ignoredProducts 暂不映射产品数", len(exposure_aliases.get("ignoredProducts", []))],
            ],
        ),
        "",
        "## 状态计数",
        "",
        markdown_table(
            ["状态", "含义", "数量"],
            [
                [status, status_label(status), count]
                for status, count in sorted(fetch_summary.get("status_counts", {}).items())
            ],
        ),
        "",
    ]

    if not candidate_results:
        lines.extend(
            [
                "> 当前 summary 还没有候选级明细。重新运行 `python scripts\\fetch_fund_report_holdings.py`，"
                "再运行 `python scripts\\build_fund_stock_index.py` 即可补齐下面的候选列表。",
                "",
            ]
        )

    lines.extend(
        [
            "## 已解析定期报告",
            "",
            markdown_table(
                ["基金代码", "基金名称", "基金类型", "状态", "杠杆明细行", "公告日期", "公告 ID"],
                [
                    [
                        result.get("fundCode", ""),
                        result.get("fundName", ""),
                        result.get("fundType", ""),
                        status_label(str(result.get("status", ""))),
                        result.get("rows_found", 0),
                        result.get("announcementDate", ""),
                        result.get("announcementId", ""),
                    ]
                    for result in parsed_results
                ],
            ),
            "",
            "## 杠杆产品映射到正股",
            "",
            markdown_table(
                ["产品代码", "产品名称", "映射正股", "杠杆倍数", "匹配原因", "最终行数", "基金代码"],
                [
                    [
                        source_code,
                        source_name,
                        f"{target_code} / {target_name}",
                        leverage_multiple,
                        match_reason,
                        len(fund_codes),
                        ", ".join(sorted(code for code in fund_codes if code)),
                    ]
                    for (
                        source_code,
                        source_name,
                        target_code,
                        target_name,
                        leverage_multiple,
                        match_reason,
                    ), fund_codes in sorted(product_mappings.items())
                ],
            ),
            "",
            "## 最终进入 indirectExposureRows",
            "",
            markdown_table(
                [
                    "正股",
                    "基金代码",
                    "基金名称",
                    "杠杆产品",
                    "原占净值",
                    "杠杆倍数",
                    "估算暴露",
                ],
                [
                    [
                        f"{row.get('targetCode', '')} / {row.get('targetName', '')}",
                        row.get("fundCode", ""),
                        fund_family_display_name(row),
                        f"{row.get('sourceCode', '')} / {row.get('sourceName', '')}",
                        row.get("ratioPercent", ""),
                        row.get("leverageMultiple", ""),
                        row.get("estimatedRatioPercent", ""),
                    ]
                    for row in final_rows
                ],
            ),
            "",
            "## 解析到但未映射的杠杆明细",
            "",
            markdown_table(
                ["基金代码", "基金名称", "基金类型", "产品代码", "产品名称", "原占净值", "处理结果"],
                [
                    [
                        row.get("基金代码", ""),
                        row.get("基金名称", ""),
                        row.get("基金类型", ""),
                        row.get("证券代码", ""),
                        row.get("证券名称", ""),
                        row.get("占净值比例", ""),
                        unmapped_fund_investment_reason(row, ignored_products),
                    ]
                    for row in unmapped_fund_investment_rows
                ],
            ),
            "",
            "## 候选跳过 / 未进入 indirectExposureRows",
            "",
            markdown_table(
                ["基金代码", "基金名称", "基金类型", "状态", "解析杠杆行", "映射行", "原因"],
                [
                    [
                        result.get("fundCode", ""),
                        result.get("fundName", ""),
                        result.get("fundType", ""),
                        status_label(str(result.get("status", ""))),
                        result.get("rows_found", 0),
                        mapped_rows_by_fund.get(result.get("fundCode", ""), 0),
                        skipped_candidate_reason(
                            result,
                            mapped_rows_by_fund.get(result.get("fundCode", ""), 0),
                            "；".join(sorted(unmapped_reasons_by_fund.get(result.get("fundCode", ""), set()))),
                        ),
                    ]
                    for result in skipped_results
                ],
            ),
            "",
        ]
    )
    return "\n".join(lines).rstrip()


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
        "isQdii": is_qdii_record(row),
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
        "securityId": row.get("证券标识", "").strip()
        or row.get("证券代码", "").strip()
        or f"holding-{row.get('序号', '').strip()}-{row.get('证券名称', '').strip()}",
        "holdingType": row.get("持仓类别", "股票").strip() or "股票",
        "disclosureScope": row.get("披露范围", "quarter_top10_equity").strip()
        or "quarter_top10_equity",
        "sourceUrl": row.get("来源URL", "").strip(),
        "sourcePage": int(parse_float(row.get("页码"))) if row.get("页码", "").strip() else None,
    }


def is_qdii_record(row: dict[str, str]) -> bool:
    return (
        row.get("是否QDII", "").strip().upper() in {"Y", "YES", "TRUE", "1"}
        or "QDII" in f"{row.get('基金名称', '')} {row.get('基金类型', '')}".upper()
    )


def qdii_fund_variants(report_codes: Iterable[str] = ()) -> dict[str, list[dict[str, str]]]:
    """Return QDII share classes grouped by local family identity.

    Some valid QDII products are labelled as ``指数型-海外股票`` in the
    fund-list snapshot and do not carry a QDII marker.  A code that appears in
    the official EID QDII report result is authoritative for this release, so
    seed its local family and include its A/C/etc. variants as well.
    """
    if not FUND_LIST_CSV.exists():
        return {}
    report_code_set = {str(code).strip() for code in report_codes if str(code).strip()}
    normalized_rows: list[dict[str, str]] = []
    families_for_official_reports: set[str] = set()
    with FUND_LIST_CSV.open("r", encoding="utf-8-sig", newline="") as handle:
        for raw in csv.DictReader(handle):
            row = {key: csv_text(value) for key, value in raw.items() if key}
            normalized = {
                "基金代码": row.get("基金代码", ""),
                "基金名称": row.get("基金名称", ""),
                "基金类型": row.get("基金类型", ""),
                "是否QDII": row.get("是否QDII", ""),
            }
            if not normalized["基金代码"]:
                continue
            normalized_rows.append(normalized)
            if normalized["基金代码"] in report_code_set:
                families_for_official_reports.add(fund_family_key({"fundName": normalized["基金名称"]}))
    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for normalized in normalized_rows:
        key = fund_family_key({"fundName": normalized["基金名称"]})
        if not is_qdii_record(normalized) and key not in families_for_official_reports:
            continue
        grouped[key].append(normalized)
    return {
        key: sorted(value, key=lambda item: item["基金代码"])
        for key, value in sorted(grouped.items())
    }


def validate_qdii_h1_summary(summary: dict[str, Any], rows: list[dict[str, str]]) -> None:
    expected_report = f"{QUARTER.year}H1"
    if summary.get("report") != expected_report:
        raise ValueError(f"QDII H1 摘要报告期不一致：expected={expected_report}")
    if summary.get("cutoffDate") != QUARTER.cutoff_date:
        raise ValueError("QDII H1 摘要截止日期与当前基金数据期不一致")
    if summary.get("fundType") != "6020-6050" or summary.get("reportType") != "FB020":
        raise ValueError("QDII H1 摘要不是证监会 QDII 中期报告检索结果")
    if summary.get("isComplete") is not True:
        raise ValueError("QDII H1 摘要不是完整抓取结果，拒绝使用 --limit 或 --fund-code 冒烟数据")
    report_results = summary.get("reportResults")
    if not isinstance(report_results, list) or not report_results:
        raise ValueError("QDII H1 摘要缺少逐报告结果")
    if int(summary.get("reportCount") or -1) != len(report_results):
        raise ValueError("QDII H1 摘要 reportCount 与逐报告结果数不一致")
    errors = [item for item in report_results if isinstance(item, dict) and item.get("status") in {"error", "invalid_report_id"}]
    if errors:
        raise ValueError(f"QDII H1 摘要含 {len(errors)} 个失败报告，拒绝生成发布包")
    scope_counts = summary.get("scopeCounts")
    if not isinstance(scope_counts, dict):
        raise ValueError("QDII H1 摘要缺少披露范围行数")
    actual_scope_counts = Counter(row.get("披露范围", "") for row in rows)
    if sum(actual_scope_counts.values()) != int(summary.get("holdingRows") or -1):
        raise ValueError("QDII H1 摘要 holdingRows 与 CSV 实际行数不一致")
    for scope in ("all_disclosed_equity", "top10_disclosed_fund_investments"):
        if int(scope_counts.get(scope) or 0) != actual_scope_counts[scope]:
            raise ValueError(f"QDII H1 摘要 {scope} 行数与 CSV 不一致")
    invalid_rows = [
        row
        for row in rows
        if row.get("报告期") != expected_report
        or row.get("截止日期") != QUARTER.cutoff_date
        or row.get("披露范围") not in {"all_disclosed_equity", "top10_disclosed_fund_investments"}
    ]
    if invalid_rows:
        raise ValueError(f"QDII H1 CSV 存在 {len(invalid_rows)} 行报告期、截止日或披露范围无效")


def load_qdii_h1_source() -> dict[str, Any] | None:
    """Load the official H1 overlay, or return None for a normal non-H1 rebuild."""
    if not QDII_H1_CSV.exists() and not QDII_H1_SUMMARY_JSON.exists():
        return None
    if not QDII_H1_CSV.exists() or not QDII_H1_SUMMARY_JSON.exists():
        raise ValueError("QDII H1 CSV 与摘要必须同时存在，拒绝使用半成品")
    with QDII_H1_CSV.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = [{key: csv_text(value) for key, value in raw.items() if key} for raw in csv.DictReader(handle)]
    with QDII_H1_SUMMARY_JSON.open("r", encoding="utf-8-sig") as handle:
        summary = json.load(handle)
    if not isinstance(summary, dict):
        raise ValueError("QDII H1 摘要不是对象")
    validate_qdii_h1_summary(summary, rows)
    report_results = [item for item in summary["reportResults"] if isinstance(item, dict)]
    reports_by_code = {
        str(item.get("fundCode", "")).strip(): item
        for item in report_results
        if str(item.get("fundCode", "")).strip()
    }
    if len(reports_by_code) != len(report_results):
        raise ValueError("QDII H1 摘要包含重复或空基金代码")
    return {
        "rows": rows,
        "summary": summary,
        "reportsByCode": reports_by_code,
        "variantsByFamily": qdii_fund_variants(reports_by_code),
    }


def report_family_key(report: dict[str, Any]) -> str:
    return fund_family_key({"fundName": str(report.get("fundName", "")).strip()})


def h1_variants_for_report(
    report: dict[str, Any],
    variants_by_family: dict[str, list[dict[str, str]]],
) -> list[dict[str, str]]:
    report_code = str(report.get("fundCode", "")).strip()
    report_name = str(report.get("fundName", "")).strip()
    matching_families = [
        family_key
        for family_key, candidates in variants_by_family.items()
        if any(candidate["基金代码"] == report_code for candidate in candidates)
    ]
    if len(matching_families) > 1:
        raise ValueError(f"QDII 报告基金代码映射到多个本地基金家族：{report_code}")
    variants = list(variants_by_family.get(matching_families[0], [])) if matching_families else []
    if not variants:
        variants = list(variants_by_family.get(report_family_key(report), []))
    if not any(item["基金代码"] == report_code for item in variants) and report_code:
        variants.append(
            {
                "基金代码": report_code,
                "基金名称": report_name,
                "基金类型": "QDII",
            }
        )
    return sorted(variants, key=lambda item: item["基金代码"])


def expanded_h1_rows(source: dict[str, Any], *, scope: str) -> list[dict[str, str]]:
    expanded: list[dict[str, str]] = []
    seen: set[tuple[str, str, str, str, str]] = set()
    report_by_code: dict[str, dict[str, Any]] = source["reportsByCode"]
    for row in source["rows"]:
        if row.get("披露范围") != scope:
            continue
        report_code = row.get("基金代码", "").strip()
        report = report_by_code.get(report_code)
        if report is None:
            raise ValueError(f"QDII H1 行未能匹配报告摘要基金代码：{report_code}")
        for variant in h1_variants_for_report(report, source["variantsByFamily"]):
            expanded_row = dict(row)
            expanded_row.update(variant)
            # The official EID QDII result set is authoritative even when the
            # local fund-list label merely says "指数型-海外股票".
            expanded_row["是否QDII"] = "Y"
            expanded_row["报告基金代码"] = report_code
            identity = (
                expanded_row["基金代码"],
                scope,
                expanded_row.get("证券标识", ""),
                expanded_row.get("证券代码", ""),
                expanded_row.get("证券名称", ""),
            )
            # A/C report entries can point to the same pooled portfolio PDF.
            # Each local share class receives that holding once, with the first
            # official report code as its deterministic provenance.
            if identity in seen:
                continue
            seen.add(identity)
            expanded.append(expanded_row)
    return expanded


def qdii_rich_payload(source: dict[str, Any]) -> dict[str, Any]:
    report_by_code: dict[str, dict[str, Any]] = source["reportsByCode"]
    rows_by_code: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in source["rows"]:
        rows_by_code[row.get("基金代码", "").strip()].append(row)
    aliases: dict[str, str] = {}
    statuses: dict[str, dict[str, Any]] = {}
    holdings: dict[str, dict[str, Any]] = {}
    for report_code, report in sorted(report_by_code.items()):
        report_rows = rows_by_code.get(report_code, [])
        equity_holdings = [
            make_holding_record(row)
            for row in report_rows
            if row.get("披露范围") == "all_disclosed_equity"
        ]
        fund_investments = [
            make_holding_record(row)
            for row in report_rows
            if row.get("披露范围") == "top10_disclosed_fund_investments"
        ]
        if len(fund_investments) > 10:
            raise ValueError(f"QDII 报告 {report_code} 的前十名基金投资明细解析出 {len(fund_investments)} 条，拒绝发布")
        holdings[report_code] = {
            "status": "available",
            "fundCode": report_code,
            "fundName": str(report.get("fundName", "")).strip(),
            "fundType": "QDII",
            "report": f"{QUARTER.year}H1",
            "cutoffDate": QUARTER.cutoff_date,
            "equityDisclosureScope": "all_disclosed_equity",
            "fundInvestmentDisclosureScope": "top10_disclosed_fund_investments",
            "sourceUrl": str(report.get("sourceUrl", "")).strip(),
            "sourceTitle": str(report.get("reportName", "")).strip(),
            "publishedAt": str(report.get("reportSendDate", "")).strip(),
            "equityHoldings": sorted(equity_holdings, key=lambda item: (item["rank"], item["securityId"])),
            "fundInvestments": sorted(fund_investments, key=lambda item: (item["rank"], item["securityId"])),
        }
        aliases[report_code] = report_code
        for variant in h1_variants_for_report(report, source["variantsByFamily"]):
            code = variant["基金代码"]
            aliases.setdefault(code, report_code)
            statuses[code] = {
                "status": "available",
                "detailFundCode": report_code,
                "fundName": variant["基金名称"],
                "fundType": variant["基金类型"],
            }
    for variants in source["variantsByFamily"].values():
        for variant in variants:
            statuses.setdefault(
                variant["基金代码"],
                {
                    "status": "not_reported_in_eid_h1",
                    "fundName": variant["基金名称"],
                    "fundType": variant["基金类型"],
                    "reason": "未在本次证监会 QDII 中期报告检索结果中匹配到该份额；这不代表基金没有持仓。",
                },
            )
    summary = source["summary"]
    return {
        "schemaVersion": "1",
        "meta": {
            "report": f"{QUARTER.year}H1",
            "cutoffDate": QUARTER.cutoff_date,
            "generatedAt": datetime.now().isoformat(timespec="seconds"),
            "sourceFile": QDII_H1_CSV.name,
            "sourceSummaryFile": QDII_H1_SUMMARY_JSON.name,
            "reportCount": summary.get("reportCount"),
            "scopeCounts": summary.get("scopeCounts"),
            "equityDisclosure": "all_disclosed_equity：中期报告 7.4 至 7.5 的全部已披露权益投资明细。",
            "fundInvestmentDisclosure": "top10_disclosed_fund_investments：中期报告 7.10 至 7.11 的前十名基金投资明细，ETF 亦不应被理解为全部持仓。",
        },
        "fundCodeAliases": dict(sorted(aliases.items())),
        "fundStatuses": dict(sorted(statuses.items())),
        "fundHoldings": holdings,
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


PORTFOLIO_SCHEMA_VERSION = "1"
PORTFOLIO_FAMILY_RULE_VERSION = "fund-family-key-v1"
PORTFOLIO_VIEW_RULE_VERSION = "is-on-exchange-fund-v1"
PORTFOLIO_DISCLOSURE = (
    "仅覆盖当前季度已采集的公开股票持仓明细；未出现不代表未持有。"
    "基金详情最多展示 10 条，不能代表基金完整组合或实时仓位。"
)
PORTFOLIO_INDIRECT_DISCLOSURE = "未映射或不合格的间接产品不按 0% 计入。"
PORTFOLIO_PERCENT_DISPLAY_TOLERANCE = 0.005000001
PORTFOLIO_DETAIL_SHARD_RULE = "sha256(fundFamilyKey UTF-8) 的前 2 位十六进制字符"
PORTFOLIO_FUND_DETAIL_DISPLAY_LIMIT = 10


def json_utf8_bytes(value: Any) -> bytes:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def finite_number(value: Any) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def portfolio_ratio_percent(fund: dict[str, Any]) -> float | None:
    ratio_percent = fund.get("ratioPercent")
    if finite_number(ratio_percent):
        return float(ratio_percent)
    ratio = fund.get("ratio")
    if finite_number(ratio):
        return float(ratio) * 100
    return None


def portfolio_direct_ineligible_reason(fund: dict[str, Any]) -> str | None:
    ratio_percent = portfolio_ratio_percent(fund)
    if ratio_percent is None:
        return "non_finite_direct_ratio"
    if ratio_percent <= 0:
        return "non_positive_direct_ratio"
    return None


def portfolio_indirect_ineligible_reason(fund: dict[str, Any]) -> str | None:
    multiplier = fund.get("leverageMultiple")
    estimated = fund.get("estimatedRatioPercent")
    target_code = str(fund.get("targetCode", "")).strip()
    source_code = str(fund.get("sourceCode", "")).strip()
    if not target_code:
        return "missing_target_code"
    if not source_code:
        return "missing_source_code"
    if not finite_number(multiplier):
        return "non_finite_leverage"
    if float(multiplier) <= 0:
        return "non_positive_leverage"
    if not finite_number(estimated):
        return "non_finite_estimated_ratio"
    if float(estimated) <= 0:
        return "non_positive_estimated_ratio"
    source_ratio_percent = fund.get("sourceRatioPercent")
    if not finite_number(source_ratio_percent):
        source_ratio_percent = portfolio_ratio_percent(fund)
    if source_ratio_percent is None:
        return "non_finite_source_ratio"
    if source_ratio_percent <= 0:
        return "non_positive_source_ratio"
    return None


def eligible_indirect_edge(fund: dict[str, Any]) -> bool:
    return portfolio_indirect_ineligible_reason(fund) is None


def indirect_formula_matches_display(edge: dict[str, Any]) -> bool:
    source_ratio = edge.get("sourceRatioPercent")
    multiplier = edge.get("leverageMultiple")
    estimated = edge.get("estimatedRatioPercent")
    if not all(finite_number(value) for value in (source_ratio, multiplier, estimated)):
        return False
    expected = round(float(source_ratio) * float(multiplier), 2)
    return math.isclose(float(estimated), expected, abs_tol=PORTFOLIO_PERCENT_DISPLAY_TOLERANCE)


def portfolio_view_for(fund: dict[str, Any]) -> str:
    return "onExchange" if is_on_exchange_fund(fund) else "offExchange"


def unique_fund_family_records(
    funds: list[dict[str, Any]],
    *,
    ranking: str,
    selector: Any = better_record,
) -> tuple[dict[str, dict[str, Any]], dict[str, set[str]]]:
    """Return all family representatives without the legacy Top-10 display truncation."""
    representatives: dict[str, dict[str, Any]] = {}
    variant_codes: dict[str, set[str]] = defaultdict(set)
    for fund in funds:
        fund_code = str(fund.get("fundCode", "")).strip()
        fund_name = str(fund.get("fundName", "")).strip()
        if not fund_code or not fund_name:
            continue
        key = fund_family_key(fund)
        variant_codes[key].add(fund_code)
        current = representatives.get(key)
        if current is None or ranking_key(fund, ranking) > ranking_key(current, ranking):
            representatives[key] = selector(current, fund)
    return representatives, variant_codes


def portfolio_profile(fund: dict[str, Any], family_key: str, variant_codes: set[str]) -> dict[str, Any]:
    return {
        "fundFamilyKey": family_key,
        "fundCode": fund["fundCode"],
        "fundName": fund["fundName"],
        "fundDisplayName": fund_family_display_name(fund),
        "fundType": fund.get("fundType", ""),
        "fundVariantCodes": sorted(variant_codes),
        "isQdii": bool(fund.get("isQdii", False)),
        "isOnExchangeFund": is_on_exchange_fund(fund),
        "view": portfolio_view_for(fund),
        "detailShardKey": portfolio_detail_shard_prefix(family_key),
    }


def portfolio_record_key(fund: dict[str, Any]) -> tuple[Any, ...]:
    ratio = fund.get("ratio")
    market_value = fund.get("marketValueWan")
    return (
        float(ratio) if finite_number(ratio) else float("-inf"),
        float(market_value) if finite_number(market_value) else float("-inf"),
        -share_class_penalty(fund),
        str(fund.get("fundCode", "")),
    )


def build_portfolio_profile_registry(
    direct_funds: dict[str, list[dict[str, Any]]],
    indirect_candidates: dict[str, list[dict[str, Any]]],
) -> dict[str, dict[str, Any]]:
    """Build one family profile registry before producing individual stock shards."""
    representatives: dict[str, dict[str, Any]] = {}
    variants: dict[str, set[str]] = defaultdict(set)
    for collection in [*direct_funds.values(), *indirect_candidates.values()]:
        for fund in collection:
            if not isinstance(fund, dict):
                continue
            fund_code = str(fund.get("fundCode", "")).strip()
            fund_name = str(fund.get("fundName", "")).strip()
            if not fund_code or not fund_name:
                continue
            family_key = fund_family_key(fund)
            variants[family_key].add(fund_code)
            current = representatives.get(family_key)
            if current is None or portfolio_record_key(fund) > portfolio_record_key(current):
                representatives[family_key] = fund
    return {
        family_key: portfolio_profile(representative, family_key, variants[family_key])
        for family_key, representative in sorted(representatives.items())
    }


def portfolio_detail_shard_prefix(fund_family_key_value: str) -> str:
    return sha256_bytes(fund_family_key_value.encode("utf-8"))[:2]


def portfolio_stock_file_stem(stock_code: str) -> str:
    """Return a path-safe, collision-free filename stem for any exchange code.

    Overseas codes such as ``BA/LN`` and ``BRK/B`` are valid disclosure values
    but cannot be used as Windows/URL path segments verbatim.  Keep the exact
    code inside the shard and use a deterministic UTF-8 hex filename only for
    storage.  The client validates the same mapping before fetching.
    """
    normalized = str(stock_code).strip()
    if not normalized:
        raise ValueError("股票代码为空，不能生成组合分片文件名")
    return f"stock-{normalized.encode('utf-8').hex()}"


def portfolio_holding_sort_key(holding: dict[str, Any]) -> tuple[Any, ...]:
    rank = holding.get("rank")
    ratio = holding.get("ratio")
    return (
        int(rank) if finite_number(rank) and int(rank) > 0 else 9999,
        -float(ratio) if finite_number(ratio) else 0.0,
        str(holding.get("stockCode", "")),
    )


def build_portfolio_fund_detail_payloads(
    *,
    report: str,
    cutoff_date: str,
    generated_at: str,
    release_id: str,
    profiles: dict[str, dict[str, Any]],
    fund_holdings: dict[str, list[dict[str, Any]]],
) -> dict[str, dict[str, Any]]:
    """Build on-demand family-detail shards without pretending missing rows are empty holdings."""
    grouped: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    for family_key, profile in sorted(profiles.items()):
        detail_fund_code = ""
        holdings: list[dict[str, Any]] | None = None
        for fund_code in profile["fundVariantCodes"]:
            candidate = fund_holdings.get(fund_code)
            if candidate:
                detail_fund_code = fund_code
                holdings = sorted(candidate, key=portfolio_holding_sort_key)[:PORTFOLIO_FUND_DETAIL_DISPLAY_LIMIT]
                break
        if holdings is None:
            record = {
                "fundFamilyKey": family_key,
                "detailStatus": "not_captured_in_current_stock_detail_rows",
                "detailMessage": "当前已采集公开股票明细未包含可展开的该基金家族持仓详情；这不代表基金没有持仓。",
            }
        else:
            record = {
                "fundFamilyKey": family_key,
                "detailStatus": "available",
                "detailFundCode": detail_fund_code,
                "holdings": holdings,
            }
        grouped[profile["detailShardKey"]][family_key] = record
    return {
        prefix: {
            "schemaVersion": PORTFOLIO_SCHEMA_VERSION,
            "releaseId": release_id,
            "report": report,
            "cutoffDate": cutoff_date,
            "generatedAt": generated_at,
            "fundFamilyKeyHashPrefix": prefix,
            "fundDetails": details,
            "integrity": {"algorithm": "SHA-256", "encoding": "UTF-8"},
        }
        for prefix, details in sorted(grouped.items())
    }


def build_portfolio_release_id(
    report: str,
    generated_at: str,
    release_seed: Any,
) -> str:
    report_slug = re.sub(r"[^a-z0-9]+", "-", report.lower()).strip("-") or "report"
    timestamp_slug = re.sub(r"[^0-9]", "", generated_at)[:20] or "generated"
    return f"{report_slug}-{timestamp_slug}-{sha256_bytes(json_utf8_bytes(release_seed))[:12]}"


def build_portfolio_expected_facts(
    *,
    stock_codes: set[str],
    direct_funds: dict[str, list[dict[str, Any]]],
    indirect_candidates: dict[str, list[dict[str, Any]]],
    indirect_coverage: dict[str, Any],
    source_metadata: dict[str, Any],
    total_direct_input_rows: int,
    fund_detail_payloads: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """Derive build-only release facts from raw inputs, never from public shards."""
    per_stock_coverage: dict[str, dict[str, Any]] = {}
    direct_ineligible: Counter[str] = Counter()
    indirect_ineligible = Counter(indirect_coverage.get("ineligibleByReason", {}))
    direct_input_rows = 0
    direct_published_edges = 0
    indirect_input_rows = 0
    qualified_indirect_edges = 0
    for code in sorted(stock_codes):
        direct_rows = [item for item in direct_funds.get(code, []) if isinstance(item, dict)]
        indirect_rows = [item for item in indirect_candidates.get(code, []) if isinstance(item, dict)]
        direct_input_rows += len(direct_rows)
        indirect_input_rows += len(indirect_rows)
        direct_representatives: dict[str, dict[str, Any]] = {}
        per_stock_direct_ineligible: Counter[str] = Counter()
        for fund in direct_rows:
            reason = portfolio_direct_ineligible_reason(fund)
            if reason is not None:
                direct_ineligible[reason] += 1
                per_stock_direct_ineligible[reason] += 1
                continue
            family_key = fund_family_key(fund)
            current = direct_representatives.get(family_key)
            if current is None or ranking_key(fund, "ratio") > ranking_key(current, "ratio"):
                direct_representatives[family_key] = fund
        direct_published_edges += len(direct_representatives)

        qualified_indirect_rows: list[dict[str, Any]] = []
        per_stock_indirect_ineligible: Counter[str] = Counter()
        for fund in indirect_rows:
            reason = portfolio_indirect_ineligible_reason(fund)
            if reason is not None:
                indirect_ineligible[reason] += 1
                per_stock_indirect_ineligible[reason] += 1
                continue
            if str(fund.get("targetCode", "")).strip() != code:
                indirect_ineligible["target_code_mismatch"] += 1
                continue
            qualified_indirect_rows.append(fund)
        indirect_keys = {
            (fund_family_key(fund), str(fund["sourceCode"]).strip())
            for fund in qualified_indirect_rows
        }
        qualified_indirect_edges += len(indirect_keys)
        per_stock_coverage[code] = {
            "directInputRows": len(direct_rows),
            "directPublishedEdges": len(direct_representatives),
            "directIneligibleByReason": dict(sorted(per_stock_direct_ineligible.items())),
            "indirectCandidateRows": len(indirect_rows),
            "qualifiedIndirectEdges": len(indirect_keys),
            "ineligibleCandidateRows": len(indirect_rows) - len(qualified_indirect_rows),
            "ineligibleByReason": dict(sorted(per_stock_indirect_ineligible.items())),
            "unmappedNotCountedAsZero": PORTFOLIO_INDIRECT_DISCLOSURE,
        }
    detail_records = [
        detail
        for payload in fund_detail_payloads.values()
        for detail in payload["fundDetails"].values()
    ]
    coverage = {
        "directInputRows": direct_input_rows,
        "directPublishedEdges": direct_published_edges,
        "indirectCandidateRows": indirect_input_rows,
        "qualifiedIndirectEdges": qualified_indirect_edges,
        "unmappedCandidateRows": int(indirect_coverage.get("unmappedCandidateRows", 0)),
        "unmappedByReason": dict(sorted(indirect_coverage.get("unmappedByReason", {}).items())),
        "directIneligibleByReason": dict(sorted(direct_ineligible.items())),
        "ineligibleByReason": dict(sorted(indirect_ineligible.items())),
        "unmappedNotCountedAsZero": PORTFOLIO_INDIRECT_DISCLOSURE,
        "stockShardCount": len(stock_codes),
        "fundDetailShardCount": len(fund_detail_payloads),
        "fundDetailFamilyCount": len(detail_records),
        "fundDetailAvailableFamilyCount": sum(
            detail["detailStatus"] == "available" for detail in detail_records
        ),
        "fundDetailNotCapturedFamilyCount": sum(
            detail["detailStatus"] == "not_captured_in_current_stock_detail_rows"
            for detail in detail_records
        ),
    }
    return {
        "coverage": coverage,
        "perStockCoverage": per_stock_coverage,
        "sourceFacts": {
            "inputHoldingRows": int(source_metadata.get("inputHoldingRows", total_direct_input_rows)),
            "source": source_metadata.get("source", "current-quarter-public-stock-detail-rows"),
            "sourceFile": source_metadata.get("sourceFile", "unknown-source.csv"),
            "fundInvestmentSourceFile": source_metadata.get(
                "fundInvestmentSourceFile", "not-provided"
            ),
            "fundInvestmentSourceRows": int(source_metadata.get("fundInvestmentSourceRows", 0)),
        },
    }


def build_portfolio_release(
    *,
    report: str,
    generated_at: str,
    stock_rows: dict[str, dict[str, Any]],
    direct_funds: dict[str, list[dict[str, Any]]],
    indirect_candidates: dict[str, list[dict[str, Any]]],
    cutoff_date: str = "",
    source_metadata: dict[str, Any] | None = None,
    indirect_coverage: dict[str, Any] | None = None,
    fund_holdings: dict[str, list[dict[str, Any]]] | None = None,
) -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    """Build an immutable, untruncated portfolio package in memory.

    Legacy Top-10 arrays deliberately do not enter this function.  The caller
    supplies raw quarterly rows grouped by canonical target code instead.
    """
    source_metadata = source_metadata or {}
    indirect_coverage = indirect_coverage or {}
    fund_holdings = fund_holdings or {}
    normalized_stocks = {
        str(code).strip(): value
        for code, value in stock_rows.items()
        if str(code).strip() and isinstance(value, dict)
    }
    release_seed = {
        "report": report,
        "generatedAt": generated_at,
        "stocks": normalized_stocks,
        "direct": direct_funds,
        "indirect": indirect_candidates,
        "fundHoldings": fund_holdings,
    }
    release_id = build_portfolio_release_id(report, generated_at, release_seed)
    report_slug = report.lower()
    profile_registry = build_portfolio_profile_registry(direct_funds, indirect_candidates)
    shards: dict[str, dict[str, Any]] = {}
    manifest_shards: dict[str, dict[str, Any]] = {}
    total_direct_input_rows = 0
    total_direct_published_rows = 0
    total_indirect_input_rows = 0
    total_indirect_published_rows = 0
    global_ineligible = Counter(indirect_coverage.get("ineligibleByReason", {}))
    global_direct_ineligible: Counter[str] = Counter()

    for code in sorted(normalized_stocks):
        stock = normalized_stocks[code]
        stock_name = str(stock.get("name", "")).strip()
        direct_rows = [dict(item) for item in direct_funds.get(code, []) if isinstance(item, dict)]
        indirect_rows = [
            dict(item) for item in indirect_candidates.get(code, []) if isinstance(item, dict)
        ]
        total_direct_input_rows += len(direct_rows)
        total_indirect_input_rows += len(indirect_rows)

        qualified_direct_rows: list[dict[str, Any]] = []
        direct_ineligible: Counter[str] = Counter()
        for fund in direct_rows:
            reason = portfolio_direct_ineligible_reason(fund)
            if reason is not None:
                direct_ineligible[reason] += 1
                global_direct_ineligible[reason] += 1
                continue
            qualified_direct_rows.append(fund)
        direct_representatives, _direct_variants = unique_fund_family_records(
            qualified_direct_rows,
            ranking="ratio",
        )
        direct_edges: list[dict[str, Any]] = []
        for family_key, fund in sorted(direct_representatives.items()):
            ratio_percent = portfolio_ratio_percent(fund)
            direct_edges.append(
                {
                    "fundFamilyKey": family_key,
                    "targetCode": code,
                    "targetName": stock_name,
                    "ratioPercent": rounded(ratio_percent, 2),
                    "isOnExchangeFund": profile_registry[family_key]["isOnExchangeFund"],
                }
            )

        qualified_indirect_rows: list[dict[str, Any]] = []
        for fund in indirect_rows:
            reason = portfolio_indirect_ineligible_reason(fund)
            if reason is not None:
                global_ineligible[reason] += 1
                continue
            if str(fund.get("targetCode", "")).strip() != code:
                global_ineligible["target_code_mismatch"] += 1
                continue
            qualified_indirect_rows.append(fund)

        indirect_representatives: dict[tuple[str, str], dict[str, Any]] = {}
        for fund in qualified_indirect_rows:
            family_key = fund_family_key(fund)
            source_code = str(fund["sourceCode"]).strip()
            key = (family_key, source_code)
            current = indirect_representatives.get(key)
            indirect_representatives[key] = better_indirect_exposure_record(current, fund)

        indirect_edges: list[dict[str, Any]] = []
        for (family_key, source_code), fund in sorted(indirect_representatives.items()):
            source_ratio_percent = rounded(portfolio_ratio_percent(fund) or 0.0, 2)
            leverage_multiple = rounded(float(fund["leverageMultiple"]), 4)
            indirect_edges.append(
                {
                    "fundFamilyKey": family_key,
                    "targetCode": code,
                    "targetName": stock_name,
                    "sourceCode": source_code,
                    "sourceName": fund.get("sourceName", ""),
                    "sourceRatioPercent": source_ratio_percent,
                    "leverageMultiple": leverage_multiple,
                    "estimatedRatioPercent": rounded(source_ratio_percent * leverage_multiple, 2),
                    "matchReason": fund.get("matchReason", ""),
                    "isOnExchangeFund": profile_registry[family_key]["isOnExchangeFund"],
                }
            )

        edge_family_keys = {edge["fundFamilyKey"] for edge in [*direct_edges, *indirect_edges]}
        profiles = {
            family_key: profile_registry[family_key]
            for family_key in sorted(edge_family_keys)
        }
        shard = {
            "schemaVersion": PORTFOLIO_SCHEMA_VERSION,
            "releaseId": release_id,
            "report": report,
            "cutoffDate": cutoff_date,
            "generatedAt": generated_at,
            "stock": {"code": code, "name": stock_name},
            "fundProfiles": profiles,
            "directEdges": direct_edges,
            "indirectEdges": indirect_edges,
            "coverage": {
                "directInputRows": len(direct_rows),
                "directPublishedEdges": len(direct_edges),
                "directIneligibleByReason": dict(sorted(direct_ineligible.items())),
                "indirectCandidateRows": len(indirect_rows),
                "qualifiedIndirectEdges": len(indirect_edges),
                "ineligibleCandidateRows": len(indirect_rows) - len(qualified_indirect_rows),
                "unmappedNotCountedAsZero": PORTFOLIO_INDIRECT_DISCLOSURE,
                "ineligibleByReason": {},
            },
            "integrity": {"algorithm": "SHA-256", "encoding": "UTF-8"},
        }
        for fund in indirect_rows:
            reason = portfolio_indirect_ineligible_reason(fund)
            if reason is not None:
                shard["coverage"]["ineligibleByReason"][reason] = (
                    shard["coverage"]["ineligibleByReason"].get(reason, 0) + 1
                )
        shards[code] = shard
        total_direct_published_rows += len(direct_edges)
        total_indirect_published_rows += len(indirect_edges)
        manifest_shards[code] = {
            "path": f"fund-portfolio-index-{report_slug}/{release_id}/{portfolio_stock_file_stem(code)}.json",
            "sha256": sha256_bytes(json_utf8_bytes(shard)),
            "directEdgeCount": len(direct_edges),
            "qualifiedIndirectEdgeCount": len(indirect_edges),
        }

    coverage = {
        "directInputRows": total_direct_input_rows,
        "directPublishedEdges": total_direct_published_rows,
        "indirectCandidateRows": total_indirect_input_rows,
        "qualifiedIndirectEdges": total_indirect_published_rows,
        "unmappedCandidateRows": int(indirect_coverage.get("unmappedCandidateRows", 0)),
        "unmappedByReason": dict(sorted(indirect_coverage.get("unmappedByReason", {}).items())),
        "directIneligibleByReason": dict(sorted(global_direct_ineligible.items())),
        "ineligibleByReason": dict(sorted(global_ineligible.items())),
        "unmappedNotCountedAsZero": PORTFOLIO_INDIRECT_DISCLOSURE,
    }
    relevant_profiles = {
        family_key: profile
        for shard in shards.values()
        for family_key, profile in shard["fundProfiles"].items()
    }
    fund_detail_payloads = build_portfolio_fund_detail_payloads(
        report=report,
        cutoff_date=cutoff_date,
        generated_at=generated_at,
        release_id=release_id,
        profiles=relevant_profiles,
        fund_holdings=fund_holdings,
    )
    fund_detail_shards = {
        prefix: {
            "path": f"fund-portfolio-index-{report_slug}/{release_id}/fund-details/{prefix}.json",
            "sha256": sha256_bytes(json_utf8_bytes(payload)),
            "fundFamilyCount": len(payload["fundDetails"]),
        }
        for prefix, payload in fund_detail_payloads.items()
    }
    detail_records = [
        detail
        for payload in fund_detail_payloads.values()
        for detail in payload["fundDetails"].values()
    ]
    coverage.update(
        {
            "stockShardCount": len(shards),
            "fundDetailShardCount": len(fund_detail_shards),
            "fundDetailFamilyCount": len(detail_records),
            "fundDetailAvailableFamilyCount": sum(
                detail["detailStatus"] == "available" for detail in detail_records
            ),
            "fundDetailNotCapturedFamilyCount": sum(
                detail["detailStatus"] == "not_captured_in_current_stock_detail_rows"
                for detail in detail_records
            ),
        }
    )
    manifest = {
        "schemaVersion": PORTFOLIO_SCHEMA_VERSION,
        "releaseId": release_id,
        "report": report,
        "cutoffDate": cutoff_date,
        "generatedAt": generated_at,
        "builderVersion": "fund-portfolio-index-v1",
        "fundFamilyRuleVersion": PORTFOLIO_FAMILY_RULE_VERSION,
        "viewClassificationRuleVersion": PORTFOLIO_VIEW_RULE_VERSION,
        "publishStatus": "complete",
        "inputHoldingRows": int(source_metadata.get("inputHoldingRows", total_direct_input_rows)),
        "source": source_metadata.get("source", "current-quarter-public-stock-detail-rows"),
        "sourceFile": source_metadata.get("sourceFile", "unknown-source.csv"),
        "fundInvestmentSourceFile": source_metadata.get(
            "fundInvestmentSourceFile", "not-provided"
        ),
        "fundInvestmentSourceRows": int(source_metadata.get("fundInvestmentSourceRows", 0)),
        "disclosure": PORTFOLIO_DISCLOSURE,
        "auditPath": source_metadata.get(
            "auditPath", f"seo/indirect-exposure-audit-{report_slug}.md"
        ),
        "fundDetailShardRule": PORTFOLIO_DETAIL_SHARD_RULE,
        "fundDetailDisplayLimit": PORTFOLIO_FUND_DETAIL_DISPLAY_LIMIT,
        "fundDetailShards": fund_detail_shards,
        "coverage": coverage,
        "shards": manifest_shards,
        "_buildFundDetailPayloads": fund_detail_payloads,
    }
    manifest["_buildExpectedFacts"] = build_portfolio_expected_facts(
        stock_codes=set(normalized_stocks),
        direct_funds=direct_funds,
        indirect_candidates=indirect_candidates,
        indirect_coverage=indirect_coverage,
        source_metadata=source_metadata,
        total_direct_input_rows=total_direct_input_rows,
        fund_detail_payloads=fund_detail_payloads,
    )
    errors = validate_portfolio_release(manifest, shards)
    if errors:
        raise ValueError("组合发布包内存校验失败：" + "；".join(errors))
    return manifest, shards


def validate_portfolio_release(
    manifest: dict[str, Any],
    shards: dict[str, dict[str, Any]],
) -> list[str]:
    errors: list[str] = []
    if manifest.get("schemaVersion") != PORTFOLIO_SCHEMA_VERSION:
        errors.append("manifest schemaVersion 无效")
    report = manifest.get("report")
    release_id = manifest.get("releaseId")
    if not isinstance(report, str) or not report:
        errors.append("manifest report 缺失")
    if not isinstance(release_id, str) or not release_id:
        errors.append("manifest releaseId 缺失")
    for field in ("cutoffDate", "generatedAt"):
        if not isinstance(manifest.get(field), str) or not manifest[field]:
            errors.append(f"manifest {field} 缺失")
    required_manifest_values = {
        "builderVersion": "fund-portfolio-index-v1",
        "fundFamilyRuleVersion": PORTFOLIO_FAMILY_RULE_VERSION,
        "viewClassificationRuleVersion": PORTFOLIO_VIEW_RULE_VERSION,
        "publishStatus": "complete",
    }
    for field, expected in required_manifest_values.items():
        if manifest.get(field) != expected:
            errors.append(f"manifest {field} 无效")
    if not isinstance(manifest.get("inputHoldingRows"), int) or manifest["inputHoldingRows"] < 0:
        errors.append("manifest inputHoldingRows 无效")
    for field in ("source", "sourceFile", "fundInvestmentSourceFile", "auditPath", "disclosure"):
        if not isinstance(manifest.get(field), str) or not manifest[field]:
            errors.append(f"manifest {field} 缺失")
    if not isinstance(manifest.get("fundInvestmentSourceRows"), int) or manifest[
        "fundInvestmentSourceRows"
    ] < 0:
        errors.append("manifest fundInvestmentSourceRows 无效")
    coverage = manifest.get("coverage")
    if not isinstance(coverage, dict) or not isinstance(
        coverage.get("unmappedNotCountedAsZero"), str
    ) or not isinstance(coverage.get("unmappedByReason"), dict):
        errors.append("manifest coverage 无效")
        coverage = {}
    if manifest.get("fundDetailShardRule") != PORTFOLIO_DETAIL_SHARD_RULE:
        errors.append("manifest fundDetailShardRule 无效")
    if manifest.get("fundDetailDisplayLimit") != PORTFOLIO_FUND_DETAIL_DISPLAY_LIMIT:
        errors.append("manifest fundDetailDisplayLimit 无效")
    if coverage.get("unmappedNotCountedAsZero") != PORTFOLIO_INDIRECT_DISCLOSURE:
        errors.append("manifest coverage unmappedNotCountedAsZero 无效")
    expected_facts = manifest.get("_buildExpectedFacts")
    expected_per_stock_coverage: dict[str, Any] = {}
    if expected_facts is not None:
        if not isinstance(expected_facts, dict):
            errors.append("build expected facts 无效")
        else:
            expected_coverage = expected_facts.get("coverage")
            expected_source_facts = expected_facts.get("sourceFacts")
            expected_per_stock_coverage = expected_facts.get("perStockCoverage", {})
            if not isinstance(expected_coverage, dict) or coverage != expected_coverage:
                errors.append("manifest coverage 与构建输入事实不一致")
            if not isinstance(expected_source_facts, dict):
                errors.append("manifest source facts 无效")
            else:
                for field, expected in expected_source_facts.items():
                    if manifest.get(field) != expected:
                        errors.append(f"manifest {field} 与构建输入事实不一致")
            if not isinstance(expected_per_stock_coverage, dict):
                errors.append("build per-stock coverage 无效")
                expected_per_stock_coverage = {}
    manifest_shards = manifest.get("shards")
    if not isinstance(manifest_shards, dict):
        return [*errors, "manifest shards 无效"]
    if set(manifest_shards) != set(shards):
        errors.append("manifest 分片集合与内容不一致")
    canonical_profiles: dict[str, dict[str, Any]] = {}
    for code, shard in shards.items():
        metadata = manifest_shards.get(code)
        if not isinstance(metadata, dict):
            errors.append(f"{code} 缺少 manifest 元数据")
            continue
        if shard.get("schemaVersion") != PORTFOLIO_SCHEMA_VERSION:
            errors.append(f"{code} shard schemaVersion 无效")
        if (
            shard.get("report") != report
            or shard.get("releaseId") != release_id
            or shard.get("cutoffDate") != manifest.get("cutoffDate")
            or shard.get("generatedAt") != manifest.get("generatedAt")
        ):
            errors.append(f"{code} shard 报告期或 releaseId 不一致")
        if shard.get("stock", {}).get("code") != code:
            errors.append(f"{code} shard 股票代码不一致")
        expected_hash = metadata.get("sha256")
        expected_path = f"fund-portfolio-index-{str(report).lower()}/{release_id}/{portfolio_stock_file_stem(code)}.json"
        if metadata.get("path") != expected_path:
            errors.append(f"{code} shard path 无效")
        if not re.fullmatch(r"[0-9a-f]{64}", str(expected_hash)):
            errors.append(f"{code} shard SHA-256 元数据无效")
        if expected_hash != sha256_bytes(json_utf8_bytes(shard)):
            errors.append(f"{code} shard SHA-256 不一致")
        direct_keys: set[tuple[str, str]] = set()
        indirect_keys: set[tuple[str, str, str]] = set()
        profiles = shard.get("fundProfiles", {})
        if not isinstance(profiles, dict):
            errors.append(f"{code} fundProfiles 无效")
            continue
        shard_coverage = shard.get("coverage")
        if not isinstance(shard_coverage, dict):
            errors.append(f"{code} shard coverage 无效")
            shard_coverage = {}
        if expected_facts is not None and shard_coverage != expected_per_stock_coverage.get(code):
            errors.append(f"{code} shard coverage 与构建输入事实不一致")
        for family_key, profile in profiles.items():
            if profile.get("fundFamilyKey") != family_key:
                errors.append(f"{code} profile family key 不一致")
            if not isinstance(profile.get("isOnExchangeFund"), bool):
                errors.append(f"{code} profile 分类无效")
            if profile.get("detailShardKey") != portfolio_detail_shard_prefix(family_key):
                errors.append(f"{code} profile detailShardKey 无效")
            existing_profile = canonical_profiles.get(family_key)
            if existing_profile is None:
                canonical_profiles[family_key] = profile
            elif existing_profile != profile:
                errors.append(f"{code} profile 跨股票分片不一致")
        for edge in shard.get("directEdges", []):
            key = (edge.get("fundFamilyKey", ""), edge.get("targetCode", ""))
            if not key[0] or key[1] != code or key in direct_keys:
                errors.append(f"{code} direct edge 无效或重复")
            direct_keys.add(key)
            if (
                edge.get("fundFamilyKey") not in profiles
                or portfolio_direct_ineligible_reason(edge) is not None
                or edge.get("isOnExchangeFund") != profiles[edge.get("fundFamilyKey")].get("isOnExchangeFund")
            ):
                errors.append(f"{code} direct edge profile 或数值无效")
        for edge in shard.get("indirectEdges", []):
            key = (edge.get("fundFamilyKey", ""), edge.get("targetCode", ""), edge.get("sourceCode", ""))
            if not key[0] or key[1] != code or not key[2] or key in indirect_keys:
                errors.append(f"{code} indirect edge 无效或重复")
            indirect_keys.add(key)
            if (
                edge.get("fundFamilyKey") not in profiles
                or not eligible_indirect_edge(edge)
                or not indirect_formula_matches_display(edge)
                or edge.get("isOnExchangeFund") != profiles[edge.get("fundFamilyKey")].get("isOnExchangeFund")
            ):
                errors.append(f"{code} indirect edge profile 或数值无效")
        if metadata.get("directEdgeCount") != len(shard.get("directEdges", [])):
            errors.append(f"{code} direct edge count 不一致")
        if metadata.get("qualifiedIndirectEdgeCount") != len(shard.get("indirectEdges", [])):
            errors.append(f"{code} indirect edge count 不一致")
    valid_shard_coverages = [
        shard.get("coverage")
        for shard in shards.values()
        if isinstance(shard.get("coverage"), dict)
    ]
    if isinstance(coverage, dict) and len(valid_shard_coverages) == len(shards):
        expected_coverage = {
            "directInputRows": sum(item.get("directInputRows", -1) for item in valid_shard_coverages),
            "directPublishedEdges": sum(len(shard["directEdges"]) for shard in shards.values()),
            "indirectCandidateRows": sum(
                item.get("indirectCandidateRows", -1) for item in valid_shard_coverages
            ),
            "qualifiedIndirectEdges": sum(len(shard["indirectEdges"]) for shard in shards.values()),
            "stockShardCount": len(shards),
        }
        for field, expected in expected_coverage.items():
            if coverage.get(field) != expected:
                errors.append(f"manifest coverage {field} 不一致")
        if sum(coverage.get("unmappedByReason", {}).values()) != coverage.get("unmappedCandidateRows"):
            errors.append("manifest coverage unmappedByReason 不一致")
    detail_metadata = manifest.get("fundDetailShards", {})
    detail_payloads = manifest.get("_buildFundDetailPayloads")
    if not isinstance(detail_metadata, dict):
        errors.append("fundDetailShards 无效")
    for prefix, metadata in detail_metadata.items():
        if not isinstance(prefix, str) or not re.fullmatch(r"[0-9a-f]{2}", prefix):
            errors.append("fundDetailShards prefix 无效")
            continue
        expected_path = f"fund-portfolio-index-{str(report).lower()}/{release_id}/fund-details/{prefix}.json"
        if not isinstance(metadata, dict) or metadata.get("path") != expected_path:
            errors.append(f"基金详情分片 {prefix} path 无效")
        if not isinstance(metadata, dict) or not re.fullmatch(
            r"[0-9a-f]{64}", str(metadata.get("sha256", ""))
        ):
            errors.append(f"基金详情分片 {prefix} SHA-256 元数据无效")
    if detail_payloads is not None:
        if not isinstance(detail_payloads, dict) or set(detail_metadata) != set(detail_payloads):
            errors.append("基金详情分片集合不一致")
        else:
            for prefix, payload in detail_payloads.items():
                metadata = detail_metadata.get(prefix, {})
                if (
                    payload.get("schemaVersion") != PORTFOLIO_SCHEMA_VERSION
                    or payload.get("report") != report
                    or payload.get("releaseId") != release_id
                    or payload.get("cutoffDate") != manifest.get("cutoffDate")
                    or payload.get("generatedAt") != manifest.get("generatedAt")
                    or payload.get("fundFamilyKeyHashPrefix") != prefix
                ):
                    errors.append(f"基金详情分片 {prefix} 报告期或 releaseId 不一致")
                if metadata.get("sha256") != sha256_bytes(json_utf8_bytes(payload)):
                    errors.append(f"基金详情分片 {prefix} SHA-256 不一致")
                details = payload.get("fundDetails", {})
                if metadata.get("fundFamilyCount") != len(details):
                    errors.append(f"基金详情分片 {prefix} 家族数不一致")
                for family_key, detail in details.items():
                    if detail.get("fundFamilyKey") != family_key:
                        errors.append(f"基金详情分片 {prefix} family key 不一致")
                    if portfolio_detail_shard_prefix(family_key) != prefix:
                        errors.append(f"基金详情分片 {prefix} hash-prefix 不一致")
                    if detail.get("detailStatus") == "available":
                        if not detail.get("detailFundCode") or not detail.get("holdings"):
                            errors.append(f"基金详情分片 {prefix} 可用详情无持仓")
                        elif len(detail["holdings"]) > 10:
                            errors.append(f"基金详情分片 {prefix} 超过详情展示上限")
                    elif detail.get("detailStatus") != "not_captured_in_current_stock_detail_rows":
                        errors.append(f"基金详情分片 {prefix} 披露状态无效")
            if isinstance(coverage, dict):
                detail_records = [
                    detail
                    for payload in detail_payloads.values()
                    for detail in payload["fundDetails"].values()
                ]
                expected_detail_coverage = {
                    "fundDetailShardCount": len(detail_payloads),
                    "fundDetailFamilyCount": len(detail_records),
                    "fundDetailAvailableFamilyCount": sum(
                        detail["detailStatus"] == "available" for detail in detail_records
                    ),
                    "fundDetailNotCapturedFamilyCount": sum(
                        detail["detailStatus"] == "not_captured_in_current_stock_detail_rows"
                        for detail in detail_records
                    ),
                }
                for field, expected in expected_detail_coverage.items():
                    if coverage.get(field) != expected:
                        errors.append(f"manifest coverage {field} 不一致")
    return errors


def write_portfolio_release(
    manifest_path: Path,
    release_dir: Path,
    release_id: str,
    manifest: dict[str, Any],
    shards: dict[str, dict[str, Any]],
    *,
    publish_manifest: bool = True,
) -> Path | None:
    """Stage and validate all immutable shards before atomically replacing the manifest."""
    if manifest.get("releaseId") != release_id:
        raise ValueError("releaseId 与 manifest 不一致")
    errors = validate_portfolio_release(manifest, shards)
    if errors:
        raise ValueError("组合发布包校验失败：" + "；".join(errors))
    if release_dir.exists():
        raise FileExistsError(f"不可覆盖既有组合 release：{release_dir}")

    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    release_dir.parent.mkdir(parents=True, exist_ok=True)
    staging_dir = release_dir.parent / f".{release_id}.tmp-{uuid.uuid4().hex}"
    try:
        staging_dir.mkdir()
        for code, shard in shards.items():
            shard_path = staging_dir / f"{portfolio_stock_file_stem(code)}.json"
            shard_path.write_bytes(json_utf8_bytes(shard))
        detail_payloads = manifest.get("_buildFundDetailPayloads", {})
        for prefix, payload in detail_payloads.items():
            detail_path = staging_dir / "fund-details" / f"{prefix}.json"
            detail_path.parent.mkdir(parents=True, exist_ok=True)
            detail_path.write_bytes(json_utf8_bytes(payload))
        staged_shards = {
            code: json.loads((staging_dir / f"{portfolio_stock_file_stem(code)}.json").read_text(encoding="utf-8"))
            for code in shards
        }
        staged_manifest = dict(manifest)
        staged_manifest["_buildFundDetailPayloads"] = {
            prefix: json.loads(
                (staging_dir / "fund-details" / f"{prefix}.json").read_text(encoding="utf-8")
            )
            for prefix in detail_payloads
        }
        staged_errors = validate_portfolio_release(staged_manifest, staged_shards)
        if staged_errors:
            raise ValueError("组合分片暂存校验失败：" + "；".join(staged_errors))
        staging_dir.replace(release_dir)
        temp_manifest = manifest_path.with_name(f".{manifest_path.name}.tmp-{uuid.uuid4().hex}")
        keep_temp_manifest = False
        try:
            published_manifest = {
                key: value
                for key, value in manifest.items()
                if key not in {"_buildFundDetailPayloads", "_buildExpectedFacts"}
            }
            temp_manifest.write_bytes(json_utf8_bytes(published_manifest))
            if publish_manifest:
                temp_manifest.replace(manifest_path)
                return None
            keep_temp_manifest = True
            return temp_manifest
        finally:
            if temp_manifest.exists() and not keep_temp_manifest:
                temp_manifest.unlink()
    except Exception:
        if staging_dir.exists():
            shutil.rmtree(staging_dir)
        raise


def build_index_with_audit() -> tuple[dict[str, Any], str, dict[str, Any]]:
    summary = load_summary()
    fetch_summary = load_fund_report_summary()
    purchase_limits = load_purchase_limits()
    purchase_limit_metadata = load_purchase_limit_metadata()
    exposure_aliases = load_exposure_aliases()
    stock_code_aliases = configured_stock_code_aliases(exposure_aliases)
    qdii_h1_source = load_qdii_h1_source()
    base_fund_investment_rows = [
        {key: csv_text(value) for key, value in row.items() if key}
        for row in load_fund_investment_rows()
    ]
    stock_rows: dict[str, dict[str, Any]] = {}
    stock_funds: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    indirect_exposures: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    portfolio_indirect_candidates: dict[str, list[dict[str, Any]]] = defaultdict(list)
    portfolio_indirect_coverage: dict[str, Any] = {
        "unmappedCandidateRows": 0,
        "unmappedByReason": {},
        "ineligibleByReason": {},
    }
    fund_profiles: dict[str, dict[str, Any]] = {}
    fund_holdings: dict[str, dict[str, dict[str, Any]]] = defaultdict(dict)
    q2_source_rows: list[dict[str, str]] = []
    source_rows: list[dict[str, str]] = []
    row_count = 0

    with SOURCE_CSV.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for raw_row in reader:
            row = {key: csv_text(value) for key, value in raw_row.items() if key}
            code = row.get("证券代码", "").strip()
            name = row.get("证券名称", "").strip()
            if not code or not name:
                continue
            q2_source_rows.append(row)

    # Validate the unmodified Q2 extraction before replacing its QDII subset.
    validate_source_summary(summary, len(q2_source_rows))
    if qdii_h1_source is None:
        source_rows = q2_source_rows
        fund_investment_rows = base_fund_investment_rows
        qdii_rich = None
    else:
        qdii_h1_codes = {
            variant["基金代码"]
            for variants in qdii_h1_source["variantsByFamily"].values()
            for variant in variants
        }
        q2_non_qdii_rows = [
            row
            for row in q2_source_rows
            if row.get("基金代码", "").strip() not in qdii_h1_codes and not is_qdii_record(row)
        ]
        h1_equity_rows = expanded_h1_rows(qdii_h1_source, scope="all_disclosed_equity")
        source_rows = [*q2_non_qdii_rows, *h1_equity_rows]
        h1_fund_investment_rows = expanded_h1_rows(
            qdii_h1_source,
            scope="top10_disclosed_fund_investments",
        )
        fund_investment_rows = [
            *[
                row
                for row in base_fund_investment_rows
                if row.get("基金代码", "").strip() not in qdii_h1_codes and not is_qdii_record(row)
            ],
            *h1_fund_investment_rows,
        ]
        qdii_rich = qdii_rich_payload(qdii_h1_source)

    for row in source_rows:
        code = canonical_stock_code(row.get("证券代码", ""), stock_code_aliases)
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
        holding_key = holding["securityId"]
        holding_existing = fund_holdings[fund["fundCode"]].get(holding_key)
        fund_holdings[fund["fundCode"]][holding_key] = better_holding_record(holding_existing, holding)
        row_count += 1

    alias_candidates = stock_alias_candidates(stock_rows, exposure_aliases)
    known_products = configured_known_products(exposure_aliases)
    ignored_products = configured_ignored_products(exposure_aliases)
    for row in [*source_rows, *fund_investment_rows]:
        source_code = row.get("证券代码", "").strip()
        source_name = row.get("证券名称", "").strip()
        if not source_name:
            continue
        source_code_for_match = source_code or source_name
        known_product = known_products.get(
            normalize_alias_text(source_code_for_match).replace(" ", "")
        )
        target_match = match_indirect_target(
            source_code_for_match,
            source_name,
            stock_rows,
            alias_candidates,
            known_products,
        )
        if target_match is None:
            if is_leveraged_long_product(source_code_for_match, source_name, known_product):
                portfolio_indirect_coverage["unmappedCandidateRows"] += 1
                reason = (
                    "ignored_product"
                    if ignored_product_reason(row, ignored_products)
                    else "unmapped_target"
                )
                portfolio_indirect_coverage["unmappedByReason"][reason] = (
                    portfolio_indirect_coverage["unmappedByReason"].get(reason, 0) + 1
                )
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
        portfolio_indirect_candidates[target_code].append(fund)
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
    portfolio_fund_holdings: dict[str, list[dict[str, Any]]] = {}
    for fund_code, holdings_by_stock in fund_holdings.items():
        portfolio_fund_holdings[fund_code] = sorted(
            holdings_by_stock.values(),
            key=lambda item: (
                item["rank"] if item["rank"] > 0 else 9999,
                -item["ratio"],
                item["stockCode"],
            ),
        )[:10]
    for fund_code in sorted(visible_fund_codes):
        fund_top_holdings[fund_code] = portfolio_fund_holdings.get(fund_code, [])

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

    qdii_h1_meta = None
    if qdii_h1_source is not None and qdii_rich is not None:
        statuses = qdii_rich["fundStatuses"].values()
        qdii_h1_meta = {
            "report": f"{QUARTER.year}H1",
            "cutoffDate": QUARTER.cutoff_date,
            "sourceFile": QDII_H1_CSV.name,
            "sourceSummaryFile": QDII_H1_SUMMARY_JSON.name,
            "richDetailFile": QDII_RICH_JSON.name,
            "equityRows": qdii_h1_source["summary"]["scopeCounts"].get("all_disclosed_equity", 0),
            "fundInvestmentRows": qdii_h1_source["summary"]["scopeCounts"].get("top10_disclosed_fund_investments", 0),
            "reportCount": qdii_h1_source["summary"].get("reportCount", 0),
            "fundStatusCounts": dict(sorted(Counter(item["status"] for item in statuses).items())),
            "equityDisclosure": "中期报告 7.4 至 7.5 的全部已披露权益投资明细。",
            "fundInvestmentDisclosure": "中期报告 7.10 至 7.11 的前十名基金投资明细；ETF 亦仅限报告披露范围。",
        }

    payload = {
        "meta": {
            "report": report,
            "sourceFile": (
                f"{SOURCE_CSV.name} + {QDII_H1_CSV.name}"
                if qdii_h1_source is not None
                else SOURCE_CSV.name
            ),
            "sourceFiles": [
                SOURCE_CSV.name,
                *([QDII_H1_CSV.name] if qdii_h1_source is not None else []),
            ],
            "fundInvestmentSourceFile": (
                f"{FUND_INVESTMENT_CSV.name} + {QDII_H1_CSV.name}"
                if qdii_h1_source is not None
                else (FUND_INVESTMENT_CSV.name if FUND_INVESTMENT_CSV.exists() else "")
            ),
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
            "holdingRows": row_count,
            "baseQ2HoldingRows": summary.get("holding_rows", {}).get("stock"),
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
            "qdiiH1": qdii_h1_meta,
        },
        "popularStocks": popular,
        "stocks": public_stocks,
        "fundHoldings": fund_top_holdings,
    }
    audit_markdown = render_indirect_exposure_audit(
        payload,
        fetch_summary,
        fund_investment_rows,
        indirect_exposures,
        exposure_aliases,
    )
    shipped_stock_codes = {stock["code"] for stock in export_stocks}
    portfolio_inputs = {
        "stockRows": {code: stock_rows[code] for code in shipped_stock_codes},
        "directFunds": {
            code: list(stock_funds[code].values())
            for code in shipped_stock_codes
            if code in stock_funds
        },
        "indirectCandidates": {
            code: candidates
            for code, candidates in portfolio_indirect_candidates.items()
            if code in shipped_stock_codes
        },
        "indirectCoverage": portfolio_indirect_coverage,
        "fundHoldings": portfolio_fund_holdings,
        "qdiiRichPayload": qdii_rich,
    }
    return payload, audit_markdown, portfolio_inputs


def build_index() -> dict[str, Any]:
    payload, _audit_markdown, _portfolio_inputs = build_index_with_audit()
    return payload


def main() -> None:
    TARGET_JSON.parent.mkdir(parents=True, exist_ok=True)
    payload, audit_markdown, portfolio_inputs = build_index_with_audit()
    # fundHoldings 只在悬浮卡里使用，单独成文件供前端按需懒加载，
    # 首屏主索引体积可减少约 40%。
    fund_holdings = payload.pop("fundHoldings", {})
    holdings_payload = {
        "meta": {
            "report": payload["meta"]["report"],
            "generatedAt": payload["meta"]["generatedAt"],
            "fundCount": len(fund_holdings),
        },
        "fundHoldings": fund_holdings,
    }
    holdings_json = TARGET_JSON.with_name(TARGET_JSON.name.replace("fund-stock-index-", "fund-holdings-"))
    portfolio_generated_at = datetime.now().isoformat(timespec="microseconds")
    portfolio_manifest, portfolio_shards = build_portfolio_release(
        report=payload["meta"]["report"],
        generated_at=portfolio_generated_at,
        stock_rows=portfolio_inputs["stockRows"],
        direct_funds=portfolio_inputs["directFunds"],
        indirect_candidates=portfolio_inputs["indirectCandidates"],
        cutoff_date=payload["meta"]["cutoffDate"],
        source_metadata={
            "inputHoldingRows": payload["meta"]["sourceRows"],
            "source": "current-quarter-public-stock-detail-rows-with-official-qdii-h1-overlay",
            "sourceFile": payload["meta"].get("sourceFile", SOURCE_CSV.name),
            "fundInvestmentSourceFile": payload["meta"].get(
                "fundInvestmentSourceFile",
                FUND_INVESTMENT_CSV.name,
            ),
            "fundInvestmentSourceRows": payload["meta"]["fundInvestmentSourceRows"],
            "auditPath": repo_relative(INDIRECT_EXPOSURE_AUDIT_MD),
        },
        indirect_coverage=portfolio_inputs["indirectCoverage"],
        fund_holdings=portfolio_inputs["fundHoldings"],
    )
    portfolio_manifest_path = TARGET_JSON.with_name(
        f"fund-portfolio-index-{payload['meta']['report'].lower()}.manifest.json"
    )
    portfolio_release_dir = (
        TARGET_JSON.parent
        / f"fund-portfolio-index-{payload['meta']['report'].lower()}"
        / portfolio_manifest["releaseId"]
    )
    stage_token = uuid.uuid4().hex
    temp_json = TARGET_JSON.with_name(f".{TARGET_JSON.name}.tmp-{stage_token}")
    temp_holdings = holdings_json.with_name(f".{holdings_json.name}.tmp-{stage_token}")
    temp_audit = INDIRECT_EXPOSURE_AUDIT_MD.with_name(
        f".{INDIRECT_EXPOSURE_AUDIT_MD.name}.tmp-{stage_token}"
    )
    qdii_rich_payload = portfolio_inputs.get("qdiiRichPayload")
    temp_qdii_rich = (
        QDII_RICH_JSON.with_name(f".{QDII_RICH_JSON.name}.tmp-{stage_token}")
        if qdii_rich_payload is not None
        else None
    )
    INDIRECT_EXPOSURE_AUDIT_MD.parent.mkdir(parents=True, exist_ok=True)
    staged_portfolio_manifest: Path | None = None
    try:
        with temp_json.open("w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
        with temp_holdings.open("w", encoding="utf-8") as handle:
            json.dump(holdings_payload, handle, ensure_ascii=False, separators=(",", ":"))
        if temp_qdii_rich is not None:
            with temp_qdii_rich.open("w", encoding="utf-8") as handle:
                json.dump(qdii_rich_payload, handle, ensure_ascii=False, separators=(",", ":"))
        temp_audit.write_text(audit_markdown + "\n", encoding="utf-8")

        staged_portfolio_manifest = write_portfolio_release(
            portfolio_manifest_path,
            portfolio_release_dir,
            portfolio_manifest["releaseId"],
            portfolio_manifest,
            portfolio_shards,
            publish_manifest=False,
        )
        if staged_portfolio_manifest is None:
            raise RuntimeError("组合发布 manifest 未完成暂存")
        replacements = [
            (temp_audit, INDIRECT_EXPOSURE_AUDIT_MD),
            (temp_holdings, holdings_json),
            (temp_json, TARGET_JSON),
            (staged_portfolio_manifest, portfolio_manifest_path),
        ]
        if temp_qdii_rich is not None:
            replacements.append((temp_qdii_rich, QDII_RICH_JSON))
        publish_staged_files(replacements)
    except Exception:
        if portfolio_release_dir.exists():
            shutil.rmtree(portfolio_release_dir)
        raise
    finally:
        staged_paths = [temp_json, temp_holdings, temp_audit]
        if temp_qdii_rich is not None:
            staged_paths.append(temp_qdii_rich)
        if staged_portfolio_manifest is not None:
            staged_paths.append(staged_portfolio_manifest)
        for staged_path in staged_paths:
            if staged_path.exists():
                staged_path.unlink()
    print(
        f"Wrote {TARGET_JSON} with {payload['meta']['stockCount']} stocks "
        f"from {payload['meta']['sourceRows']} holding rows."
    )
    print(f"Wrote {holdings_json} with {holdings_payload['meta']['fundCount']} funds.")
    if qdii_rich_payload is not None:
        print(f"Wrote {QDII_RICH_JSON} with {len(qdii_rich_payload['fundHoldings'])} official QDII reports.")
    print(f"Wrote {INDIRECT_EXPOSURE_AUDIT_MD}.")
    print(
        f"Wrote {portfolio_manifest_path} with {len(portfolio_shards)} stock shards "
        f"in release {portfolio_manifest['releaseId']}."
    )


if __name__ == "__main__":
    main()
