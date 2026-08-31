from __future__ import annotations

"""Fetch and parse official QDII half-year holdings from the CSRC EID platform.

The source is intentionally the CSRC Fund Electronic Disclosure platform rather
than an aggregator.  A 2026 H1 report fully discloses direct equity investments
in section 7.4, while section 7.10 discloses at most the top ten fund
investments.  The generated rows retain that distinction in ``披露范围``.
"""

import argparse
import csv
import hashlib
from html import unescape
import json
import re
import threading
import time
from collections import Counter
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import fitz
import requests

from atomic_publish import publish_staged_files
from spreadsheet_safety import safe_csv_row


ROOT = Path(__file__).resolve().parents[1]
EID_BASE_URL = "http://eid.csrc.gov.cn"
EID_SEARCH_URL = f"{EID_BASE_URL}/fund/disclose/advanced_search_report.do"
EID_PDF_URL = f"{EID_BASE_URL}/fund/disclose/instance_show_pdf_id.do?instanceid={{upload_info_id}}"
EID_REFERER = f"{EID_BASE_URL}/fund/disclose/index.html"
REPORT_TYPE_MID_YEAR = "FB020"
QDII_FUND_TYPE = "6020-6050"
REPORT_LABEL = "{year}H1"
CUTOFF_DATE = "{year}-06-30"
THREAD_LOCAL = threading.local()

# The EID PDF endpoint occasionally serves an all-zero body for certain
# reports even though its list record and Content-Type are both valid.  Use
# only a named fund manager's own disclosure endpoint as a narrowly scoped
# official fallback, never an aggregation site.
OFFICIAL_MANAGER_DISCLOSURE_PAGES = {
    "国海富兰克林": "https://www.ftsfund.com/qxjj/jjxq/xxplload?fundCode={fund_code}&page=1",
}
DISCLOSURE_LINK_RE = re.compile(
    r'<a\s+href="(?P<href>https?://[^"]+)"[^>]*>\s*'
    r'<i[^>]*>.*?</i>\s*<span\s+class="title">(?P<title>.*?)</span>',
    re.IGNORECASE | re.DOTALL,
)

HOLDING_HEADERS = [
    "基金代码",
    "基金名称",
    "基金类型",
    "报告期",
    "截止日期",
    "持仓类别",
    "披露范围",
    "证券标识",
    "序号",
    "证券代码",
    "证券名称",
    "占净值比例",
    "占净值比例数值",
    "持仓市值(万元)",
    "持股数(万股)",
    "数量单位",
    "来源标题",
    "来源URL",
    "公告ID",
    "公告日期",
    "页码",
    "PDF_SHA256",
    "解析方式",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="从证监会基金电子披露平台抓取并解析 QDII 中期报告持仓。"
    )
    parser.add_argument("--year", type=int, default=2026)
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--refresh", action="store_true", help="忽略 EID 列表和 PDF 缓存。")
    parser.add_argument("--limit", type=int, default=0, help="仅处理前 N 份报告，用于冒烟测试。")
    parser.add_argument(
        "--fund-code",
        action="append",
        default=[],
        help="仅处理指定报告基金代码，可重复传入，用于回归抽样。",
    )
    parser.add_argument("--progress-every", type=int, default=10)
    parser.add_argument("--output-dir", default="outputs")
    parser.add_argument("--cache-dir", default="data/eid_cache")
    return parser.parse_args()


def get_session() -> requests.Session:
    session = getattr(THREAD_LOCAL, "session", None)
    if session is None:
        session = requests.Session()
        session.headers.update(
            {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"
                ),
                "Accept": "application/json,text/javascript,*/*;q=0.01",
                "Referer": EID_REFERER,
            }
        )
        THREAD_LOCAL.session = session
    return session


def _request_bytes(url: str) -> bytes:
    last_error: Exception | None = None
    for attempt in range(5):
        try:
            response = get_session().get(url, timeout=45)
            response.raise_for_status()
            return response.content
        except Exception as exc:  # network behaviour is handled by retry below
            last_error = exc
            time.sleep(0.8 * (attempt + 1))
    raise RuntimeError(str(last_error))


def is_pdf(content: bytes) -> bool:
    return content.lstrip().startswith(b"%PDF")


def fetch_pdf(url: str, cache_path: Path, *, refresh: bool) -> bytes:
    if cache_path.exists() and not refresh:
        cached = cache_path.read_bytes()
        if is_pdf(cached):
            return cached

    # EID occasionally replies with an empty HTTP 200 body while a report is
    # being served.  It is not a valid disclosure response, so retry it rather
    # than treating the first transient body as a permanent parser failure.
    content = b""
    for attempt in range(5):
        content = _request_bytes(url)
        if is_pdf(content):
            break
        if attempt < 4:
            time.sleep(1.2 * (attempt + 1))
    if not is_pdf(content):
        preview = content[:120].decode("utf-8", errors="replace").replace("\n", " ")
        raise RuntimeError(f"EID 返回的不是 PDF（{len(content)} 字节）：{preview}")
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    staged = cache_path.with_suffix(cache_path.suffix + ".tmp")
    staged.write_bytes(content)
    staged.replace(cache_path)
    return content


def compact_disclosure_title(value: str) -> str:
    """Normalize harmless whitespace without weakening an exact title match."""
    return re.sub(r"\s+", "", unescape(value)).replace("&nbsp;", "")


def official_manager_pdf_url(report: dict[str, Any]) -> str | None:
    """Return the exact manager-hosted PDF for a matching official report title."""
    endpoint_template = OFFICIAL_MANAGER_DISCLOSURE_PAGES.get(str(report.get("organName", "")).strip())
    fund_code = str(report.get("fundCode", "")).strip()
    report_name = compact_disclosure_title(str(report.get("reportName", "")))
    if not endpoint_template or not fund_code or not report_name:
        return None
    endpoint = endpoint_template.format(fund_code=fund_code)
    html = _request_bytes(endpoint).decode("utf-8", errors="replace")
    for match in DISCLOSURE_LINK_RE.finditer(html):
        title = compact_disclosure_title(match.group("title"))
        if title == report_name:
            return unescape(match.group("href")).strip()
    return None


def datatables_params(start: int) -> list[dict[str, Any]]:
    return [
        {"name": "sEcho", "value": 1},
        {"name": "iColumns", "value": 6},
        {"name": "sColumns", "value": ""},
        {"name": "iDisplayStart", "value": start},
        {"name": "iDisplayLength", "value": 20},
        {"name": "mDataProp_0", "value": "fundCode"},
        {"name": "mDataProp_1", "value": "fundId"},
        {"name": "mDataProp_2", "value": "reportName"},
        {"name": "mDataProp_3", "value": "organName"},
        {"name": "mDataProp_4", "value": "reportDesp"},
        {"name": "mDataProp_5", "value": "reportSendDate"},
        {"name": "fundType", "value": QDII_FUND_TYPE},
        {"name": "reportType", "value": REPORT_TYPE_MID_YEAR},
        {"name": "reportYear", "value": ""},
        {"name": "fundCompanyShortName", "value": ""},
        {"name": "fundCode", "value": ""},
        {"name": "fundShortName", "value": ""},
        {"name": "startUploadDate", "value": ""},
        {"name": "endUploadDate", "value": ""},
    ]


def fetch_report_page(year: int, start: int) -> dict[str, Any]:
    params = datatables_params(start)
    for item in params:
        if item["name"] == "reportYear":
            item["value"] = str(year)
    response = get_session().get(
        EID_SEARCH_URL,
        params={"aoData": json.dumps(params, ensure_ascii=False, separators=(",", ":"))},
        timeout=45,
    )
    response.raise_for_status()
    parsed = response.json()
    if not isinstance(parsed, dict) or not isinstance(parsed.get("aaData"), list):
        raise RuntimeError("EID 报告列表响应缺少 aaData。")
    return parsed


def fetch_all_reports(year: int, cache_path: Path, *, refresh: bool) -> list[dict[str, Any]]:
    if cache_path.exists() and not refresh:
        cached = json.loads(cache_path.read_text(encoding="utf-8"))
        reports = cached.get("reports") if isinstance(cached, dict) else None
        if isinstance(reports, list):
            return [item for item in reports if isinstance(item, dict)]

    first = fetch_report_page(year, 0)
    total = int(first.get("iTotalRecords") or 0)
    reports = [item for item in first["aaData"] if isinstance(item, dict)]
    for start in range(20, total, 20):
        page = fetch_report_page(year, start)
        reports.extend(item for item in page["aaData"] if isinstance(item, dict))
        time.sleep(0.08)
    if total != len(reports):
        raise RuntimeError(f"EID 报告分页不完整：total={total}, received={len(reports)}")
    deduped: dict[str, dict[str, Any]] = {}
    for report in reports:
        report_id = str(report.get("uploadInfoId", "")).strip()
        if not report_id:
            raise RuntimeError("EID 报告列表包含空 uploadInfoId。")
        if report_id in deduped:
            raise RuntimeError(f"EID 报告列表存在重复 uploadInfoId：{report_id}")
        deduped[report_id] = report
    ordered = sorted(deduped.values(), key=lambda item: (str(item.get("fundCode", "")), str(item.get("uploadInfoId", ""))))
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    staged = cache_path.with_suffix(cache_path.suffix + ".tmp")
    staged.write_text(
        json.dumps(
            {
                "source": EID_SEARCH_URL,
                "year": year,
                "fundType": QDII_FUND_TYPE,
                "reportType": REPORT_TYPE_MID_YEAR,
                "fetchedAt": datetime.now(timezone.utc).isoformat(),
                "total": total,
                "reports": ordered,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    staged.replace(cache_path)
    return ordered


def compact(value: Any) -> str:
    return re.sub(r"\s+", "", str(value or ""))


def display_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def parse_number(value: Any) -> float | None:
    raw = compact(value).replace(",", "").replace("，", "")
    if not raw or raw in {"-", "--", "—"}:
        return None
    negative = raw.startswith("(") and raw.endswith(")")
    raw = raw.strip("()")
    match = re.search(r"-?\d+(?:\.\d+)?", raw)
    if match is None:
        return None
    number = float(match.group(0))
    return -number if negative else number


def parse_rank(value: Any) -> int | None:
    number = parse_number(value)
    if number is None or number < 1 or number != int(number):
        return None
    return int(number)


def normalize_header(value: Any) -> str:
    return compact(value).replace("（", "(").replace("）", ")")


def header_labels(rows: list[list[str | None]], count: int) -> list[str]:
    width = max((len(row) for row in rows[:count]), default=0)
    return [
        "".join(normalize_header(row[index]) if index < len(row) else "" for row in rows[:count])
        for index in range(width)
    ]


def first_index(labels: Iterable[str], *needles: str) -> int | None:
    for index, label in enumerate(labels):
        if any(needle in label for needle in needles):
            return index
    return None


def all_indices(labels: Iterable[str], *needles: str) -> list[int]:
    return [
        index
        for index, label in enumerate(labels)
        if any(needle in label for needle in needles)
    ]


def table_schema(rows: list[list[str | None]], section: str) -> dict[str, Any] | None:
    candidates: list[tuple[int, int, int, dict[str, Any]]] = []
    # Some official reports split a wide bilingual equity header across eight
    # PDF table rows.  Keep scanning through that full header before falling
    # back to a preceding page's continuation schema.
    for header_rows in range(1, min(len(rows), 12) + 1):
        labels = header_labels(rows, header_rows)
        value_index = first_index(labels, "公允价值")
        ratio_index = first_index(labels, "占基金资产净值比例", "占基金资产净值")
        if value_index is None or ratio_index is None:
            continue
        schema: dict[str, Any] | None = None
        if section == "equity":
            code_index = first_index(labels, "证券代码", "股票代码", "股票编码", "ISIN")
            name_indices = all_indices(labels, "证券名称", "公司名称", "股票名称")
            if code_index is None or not name_indices:
                continue
            schema = {
                "headerRows": header_rows,
                "labels": labels,
                "rankIndex": first_index(labels, "序号"),
                "codeIndex": code_index,
                "nameIndices": name_indices,
                "valueIndex": value_index,
                "ratioIndex": ratio_index,
                "quantityIndex": first_index(labels, "数量", "持有数量", "持股数"),
                "quantityUnit": "万股",
            }
        elif section == "fund":
            name_indices = all_indices(labels, "基金名称")
            if not name_indices:
                continue
            schema = {
                "headerRows": header_rows,
                "labels": labels,
                "rankIndex": first_index(labels, "序号"),
                "codeIndex": first_index(labels, "基金代码", "证券代码"),
                "nameIndices": name_indices,
                "typeIndex": first_index(labels, "基金类型"),
                "operationIndex": first_index(labels, "运作方式"),
                "valueIndex": value_index,
                "ratioIndex": ratio_index,
                "quantityIndex": first_index(labels, "数量", "持有数量", "份额"),
                "quantityUnit": "万份",
            }
        if schema is None:
            continue
        valid_rows = schema_data_score(rows[header_rows : header_rows + 6], schema)
        # More usable rows win.  For a tie, prefer a schema with more explicit
        # name columns and then the shortest header, so a normal one-row header
        # never discards its first holding.
        candidates.append((valid_rows, len(schema["nameIndices"]), -header_rows, schema))
    return max(candidates, default=(0, 0, 0, None), key=lambda item: item[:3])[3]


def looks_like_wide_equity_continuation(rows: list[list[str | None]]) -> bool:
    """Recognize the one known 15-column equity continuation layout safely."""
    for row in rows:
        if len(row) != 15 or parse_rank(row[0]) is None:
            continue
        code = compact(row[5])
        if not code or re.search(r"[\u4e00-\u9fff]", code):
            continue
        if (
            parse_number(row[10]) is not None
            and parse_number(row[11]) is not None
            and normalized_percent(row[12]) is not None
        ):
            return True
    return False


def inferred_continuation_schema(
    width: int,
    section: str,
    rows: list[list[str | None]] | None = None,
) -> dict[str, Any] | None:
    """Recover a headerless continuation whose merged columns collapsed.

    The target tables have a stable right-hand tail (quantity, fair value,
    ratio), even when the first-page English/Chinese-name columns disappear.
    Use this only inside a semantically identified final-holdings section.
    """
    # Some managers emit a wide bilingual table whose first continuation page
    # retains only fragments of the eight-row header.  Its data columns remain
    # stable, however: rank, English/Chinese names, code, quantity, fair value,
    # and ratio are respectively 0, 1/2, 5, 10, 11, and 12.  Do not let the
    # generic collapsed-table fallback treat the Chinese-name column as code.
    if section == "equity" and width == 15 and (rows is None or looks_like_wide_equity_continuation(rows)):
        return {
            "headerRows": 0,
            "labels": [],
            "rankIndex": 0,
            "codeIndex": 5,
            "nameIndices": [1, 2],
            "valueIndex": 11,
            "ratioIndex": 12,
            "quantityIndex": 10,
            "quantityUnit": "万股",
        }
    if section == "equity" and width >= 7:
        code_index = 3 if width >= 9 else 2
        name_indices = [1, 2] if width >= 9 else [1]
        return {
            "headerRows": 0,
            "labels": [],
            "rankIndex": 0,
            "codeIndex": code_index,
            "nameIndices": name_indices,
            "valueIndex": width - 2,
            "ratioIndex": width - 1,
            "quantityIndex": width - 3,
            "quantityUnit": "万股",
        }
    if section == "fund" and width >= 4:
        return {
            "headerRows": 0,
            "labels": [],
            "rankIndex": 0,
            "codeIndex": None,
            "nameIndices": [1],
            "typeIndex": 2 if width >= 5 else None,
            "operationIndex": 3 if width >= 6 else None,
            "valueIndex": width - 2,
            "ratioIndex": width - 1,
            "quantityIndex": None,
            "quantityUnit": "万份",
        }
    return None


def continuation_schema(
    schema: dict[str, Any],
    width: int,
    section: str = "",
    rows: list[list[str | None]] | None = None,
) -> dict[str, Any] | None:
    """Adapt a header schema to a continuation table whose merged headers vanished."""
    if width < 4:
        return None
    adjusted = dict(schema)
    for field in ("rankIndex", "codeIndex", "valueIndex", "quantityIndex"):
        index = adjusted.get(field)
        if index is not None and int(index) >= width:
            return inferred_continuation_schema(width, section, rows)
    name_indices = [index for index in adjusted.get("nameIndices", []) if int(index) < width]
    if not name_indices:
        return inferred_continuation_schema(width, section, rows)
    adjusted["nameIndices"] = name_indices
    ratio_index = int(adjusted["ratioIndex"])
    if ratio_index >= width:
        adjusted["ratioIndex"] = width - 1
    return adjusted


def table_row_value(row: list[str | None], index: int | None) -> str:
    return "" if index is None or index >= len(row) else display_text(row[index])


def preferred_row_value(row: list[str | None], primary: int | None, alternate: int | None) -> str:
    """Use an alternate merged-header column only when the primary is blank."""
    value = table_row_value(row, primary)
    if value and value not in {"-", "--"}:
        return value
    alternative = table_row_value(row, alternate)
    return alternative if alternative not in {"-", "--"} else ""


def shift_schema_indices(schema: dict[str, Any], offset: int) -> dict[str, Any] | None:
    """Move table columns when a merged PDF header has an empty leading cell.

    MuPDF can place the header's visible labels one cell to the right of the
    actual data.  Only use this as a fallback after the unshifted name lookup
    fails; that keeps ordinary tables on their original schema.
    """
    shifted = dict(schema)
    for field in ("rankIndex", "codeIndex", "typeIndex", "operationIndex", "valueIndex", "ratioIndex", "quantityIndex"):
        index = shifted.get(field)
        if index is not None:
            adjusted = int(index) + offset
            if adjusted < 0:
                # A visible leading blank cell can shift the labels while the
                # rank itself remains in column zero.  Preserve that rank and
                # shift the following value columns as a fallback.
                if field == "rankIndex":
                    adjusted = 0
                else:
                    return None
            shifted[field] = adjusted
    names = [int(index) + offset for index in shifted.get("nameIndices", [])]
    if not names or any(index < 0 for index in names):
        return None
    shifted["nameIndices"] = names
    return shifted


def choose_name_with_index(row: list[str | None], indices: list[int]) -> tuple[str, int | None]:
    candidates = [
        (table_row_value(row, index), index)
        for index in indices
    ]
    candidates = [
        (candidate, index)
        for candidate, index in candidates
        if candidate and candidate not in {"-", "--"}
    ]
    if not candidates:
        return "", None
    chosen, chosen_index = next(
        ((candidate, index) for candidate, index in candidates if re.search(r"[\u4e00-\u9fff]", candidate)),
        candidates[0],
    )
    return (
        re.sub(r"(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])", "", chosen),
        chosen_index,
    )


def choose_name(row: list[str | None], indices: list[int]) -> str:
    return choose_name_with_index(row, indices)[0]


def normalized_percent(value: Any) -> tuple[str, float] | None:
    number = parse_number(value)
    if number is None:
        return None
    return (f"{number:.6f}".rstrip("0").rstrip(".") + "%", number / 100)


def row_percent(row: list[str | None], preferred_index: int) -> tuple[str, float] | None:
    """Read a percentage, tolerating PDF table headers split into an adjacent column."""
    for index in (preferred_index, preferred_index - 1, preferred_index + 1):
        if index < 0 or index >= len(row):
            continue
        parsed = normalized_percent(row[index])
        if parsed is not None and abs(parsed[1]) <= 1:
            return parsed
    return None


def schema_data_score(rows: list[list[str | None]], schema: dict[str, Any]) -> int:
    """Count likely holdings under a tentative header schema.

    Some PDFs split an English column heading across four rows.  Choosing the
    first recognizable header would then point only at the Chinese-name column,
    which can legitimately contain ``-``.  Score actual rows before selecting a
    header depth instead.
    """
    score = 0
    alternatives = [schema]
    shifted = shift_schema_indices(schema, -1)
    if shifted is not None:
        alternatives.append(shifted)
    for row in rows:
        for candidate in alternatives:
            if not choose_name(row, candidate["nameIndices"]):
                continue
            if row_percent(row, int(candidate["ratioIndex"])) is not None:
                score += 1
                break
    return score


def holding_from_table_row(
    row: list[str | None],
    schema: dict[str, Any],
    section: str,
    *,
    fallback_rank: int,
    report: dict[str, Any],
    page_number: int,
    pdf_sha256: str,
    year: int,
) -> dict[str, Any] | None:
    name, selected_name_index = choose_name_with_index(row, schema["nameIndices"])
    shifted = shift_schema_indices(schema, -1)
    if not name:
        if shifted is not None:
            shifted_name, shifted_name_index = choose_name_with_index(row, shifted["nameIndices"])
            if shifted_name:
                name = shifted_name
                selected_name_index = shifted_name_index
    if not name:
        return None
    code = compact(preferred_row_value(
        row,
        schema.get("codeIndex"),
        shifted.get("codeIndex") if shifted is not None else None,
    ))
    ratio = row_percent(row, int(schema["ratioIndex"]))
    if ratio is None and shifted is not None:
        ratio = row_percent(row, int(shifted["ratioIndex"]))
    if ratio is None:
        return None
    explicit_rank = (
        parse_rank(table_row_value(row, schema.get("rankIndex")))
        or parse_rank(table_row_value(row, shifted.get("rankIndex") if shifted is not None else None))
    )
    market_value_yuan = parse_number(preferred_row_value(
        row,
        schema["valueIndex"],
        shifted.get("valueIndex") if shifted is not None else None,
    ))
    quantity = parse_number(preferred_row_value(
        row,
        schema.get("quantityIndex"),
        shifted.get("quantityIndex") if shifted is not None else None,
    ))
    # A page break can leave a top-row fragment with no sequence number.  Its
    # missing code cell is then incorrectly recovered from the adjacent Chinese
    # name cell, while the tolerant ratio reader sees a left-hand table tail.
    # Reject only those audited fragments; rankless holdings with a genuine
    # overseas identifier remain valid and retain their deterministic rank.
    if section == "equity" and explicit_rank is None:
        normalized_code = compact(code).casefold()
        if re.search(r"[\u4e00-\u9fff]", code) or normalized_code in {"equity", "quity"}:
            return None
    rank = explicit_rank or fallback_rank
    holding_type = "权益投资"
    scope = "all_disclosed_equity"
    security_id = code or f"EQUITY-REPORT-{rank:03d}"
    if section == "fund":
        extra = " ".join(
            preferred_row_value(
                row,
                index,
                shifted.get(field) if shifted is not None else None,
            )
            for field, index in (("typeIndex", schema.get("typeIndex")), ("operationIndex", schema.get("operationIndex")))
        )
        holding_type = "ETF" if re.search(r"(?i)\b(?:ETF|ETN|ETP)\b|交易型开放", f"{name} {extra}") else "基金投资"
        scope = "top10_disclosed_fund_investments"
        security_id = code or f"REPORT-FUND-{rank:03d}"
    source_id = str(report.get("uploadInfoId", "")).strip()
    source_url = str(report.get("sourceUrl", "")).strip() or EID_PDF_URL.format(upload_info_id=source_id)
    return {
        "基金代码": str(report.get("fundCode", "")).strip(),
        "基金名称": str(report.get("fundShortName", "")).strip(),
        "基金类型": str(report.get("fundTypeName", "QDII")).strip() or "QDII",
        "报告期": REPORT_LABEL.format(year=year),
        "截止日期": CUTOFF_DATE.format(year=year),
        "持仓类别": holding_type,
        "披露范围": scope,
        "证券标识": security_id,
        "序号": rank,
        "证券代码": code,
        "证券名称": name,
        "占净值比例": ratio[0],
        "占净值比例数值": ratio[1],
        "持仓市值(万元)": round(market_value_yuan / 10000, 6) if market_value_yuan is not None else "",
        "持股数(万股)": round(quantity / 10000, 6) if quantity is not None else "",
        "数量单位": schema.get("quantityUnit", ""),
        "来源标题": str(report.get("reportName", "")).strip(),
        "来源URL": source_url,
        "公告ID": source_id,
        "公告日期": str(report.get("reportSendDate", "")).strip(),
        "页码": page_number,
        "PDF_SHA256": pdf_sha256,
        "解析方式": str(report.get("parserMethod", "eid_pdf_table_7_4_7_10")),
        "_selectedNameIndex": selected_name_index,
    }


def holding_record_key(record: dict[str, Any]) -> tuple[str, str, str, int]:
    return (
        str(record["持仓类别"]),
        str(record["证券标识"]),
        str(record["证券名称"]),
        int(record["序号"]),
    )


def merge_rankless_equity_name_fragment(
    records: list[dict[str, Any]],
    seen: set[tuple[str, str, str, int]],
    row: list[str | None],
    schema: dict[str, Any],
    *,
    row_index: int,
    page_number: int,
    expected_rank: int,
) -> bool:
    """Append a provable next-page name tail to the immediately preceding row.

    This is intentionally narrower than general row recovery: the fragment
    must have no rank, no primary code (or only a Bloomberg ``Equity`` tail),
    and no complete primary value/ratio tail.  Its preceding holding must be
    the last known rank on the immediately previous page.  These conditions
    distinguish a page-break tail from a valid rankless holding.
    """
    if row_index != 0:
        return False
    shifted = shift_schema_indices(schema, -1)
    explicit_rank = (
        parse_rank(table_row_value(row, schema.get("rankIndex")))
        or parse_rank(table_row_value(row, shifted.get("rankIndex") if shifted is not None else None))
    )
    if explicit_rank is not None:
        return False
    primary_code = compact(table_row_value(row, schema.get("codeIndex"))).casefold()
    if primary_code and primary_code not in {"equity", "quity"}:
        return False
    if (
        parse_number(table_row_value(row, int(schema["valueIndex"]))) is not None
        and normalized_percent(table_row_value(row, int(schema["ratioIndex"]))) is not None
    ):
        return False
    previous = next(
        (
            item
            for item in reversed(records)
            if item["披露范围"] == "all_disclosed_equity"
            and int(item["序号"]) == expected_rank
        ),
        None,
    )
    if previous is None or int(previous["页码"]) != page_number - 1:
        return False
    selected_name_index = previous.get("_selectedNameIndex")
    if not isinstance(selected_name_index, int):
        return False
    previous_name = display_text(previous["证券名称"])
    previous_is_chinese = bool(re.search(r"[\u4e00-\u9fff]", previous_name))
    suffix = table_row_value(row, selected_name_index)
    if not suffix or bool(re.search(r"[\u4e00-\u9fff]", suffix)) != previous_is_chinese:
        return False
    if previous_is_chinese:
        merged_name = re.sub(
            r"(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])",
            "",
            previous_name + suffix,
        )
    else:
        merged_name = f"{previous_name} {suffix}".strip()
    if merged_name == previous_name:
        return False
    old_key = holding_record_key(previous)
    updated = dict(previous)
    updated["证券名称"] = merged_name
    new_key = holding_record_key(updated)
    if new_key in seen:
        return False
    seen.discard(old_key)
    previous["证券名称"] = merged_name
    seen.add(new_key)
    return True


# Match real §7 subsection numbers (7.1 through 7.19), not a holding ratio
# such as ``7.74`` emitted as a standalone PDF text block inside a table.
SECTION_HEADING_RE = re.compile(r"^\s*(7[\.．](?:[1-9]|1\d)(?:[\.．]\d+)?)(?!\d)")


def classify_portfolio_section(heading: str) -> str:
    """Classify a §7 holding table by its title rather than a fixed number.

    QDII reports omit inapplicable debt, target-fund, and derivative sections,
    so the same disclosure table can be numbered 7.4/7.5 or 7.10/7.11.  The
    table title is the stable official contract.  In particular, exclude the
    similarly named *cumulative purchases/sales* tables, which do not describe
    the period-end portfolio.
    """
    normalized = compact(heading).replace("．", ".")
    if "期末" not in normalized:
        return "outside"
    if "基金投资明细" in normalized and ("前十名" in normalized or "前10名" in normalized):
        return "fund"
    if (
        ("权益投资明细" in normalized or "股票投资明细" in normalized)
        and "累计" not in normalized
        and "买入" not in normalized
        and "卖出" not in normalized
    ):
        return "equity"
    return "outside"


def section_events(page: fitz.Page) -> list[tuple[float, str]]:
    events: list[tuple[float, str]] = []
    previous_marker = ""
    previous_section = "outside"
    for block in page.get_text("blocks", sort=True):
        x0, y0, _x1, _y1, text, *_rest = block
        del x0
        normalized = compact(text).replace("．", ".")
        match = SECTION_HEADING_RE.match(normalized)
        if match is None:
            continue
        marker = match.group(1).replace("．", ".")
        section = classify_portfolio_section(normalized)
        parent_marker = marker.rsplit(".", 1)[0] if marker.count(".") >= 2 else ""
        # Index funds frequently put ``7.4.1`` in a separate PDF text block
        # immediately after a semantic ``7.4`` title.  Keep the parent target
        # section in that one case; a new 7.5.1/7.6.1 remains outside because
        # its parent heading was already classified outside.
        if section == "outside" and parent_marker == previous_marker and previous_section in {"equity", "fund"}:
            section = previous_section
        events.append((float(y0), section))
        previous_marker = marker
        previous_section = section
    return sorted(events)


def parse_report_pdf(pdf_path: Path, report: dict[str, Any], year: int) -> list[dict[str, Any]]:
    content = pdf_path.read_bytes()
    pdf_sha256 = hashlib.sha256(content).hexdigest()
    records: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str, int]] = set()
    schemas: dict[str, dict[str, Any]] = {}
    next_rank = {"equity": 1, "fund": 1}
    current_section = "outside"
    doc = fitz.open(stream=content, filetype="pdf")
    try:
        for page_index, page in enumerate(doc):
            # The first pages are the table of contents, which repeats §7
            # titles without their tables.  Never carry a contents-page target
            # section into the financial statements that follow.
            events = [] if page_index < 5 else section_events(page)
            tables = list(page.find_tables().tables)
            for table in tables:
                bbox = table.bbox
                for y, event_section in events:
                    if y <= bbox[1] + 1:
                        current_section = event_section
                    else:
                        break
                if current_section not in {"equity", "fund"}:
                    continue
                extracted = table.extract()
                rows = [list(row) for row in extracted if any(display_text(cell) for cell in row)]
                if not rows:
                    continue
                schema = table_schema(rows, current_section)
                data_start = 0
                if schema is not None:
                    schemas[current_section] = schema
                    data_start = int(schema["headerRows"])
                else:
                    schema = schemas.get(current_section)
                    if schema is None:
                        schema = inferred_continuation_schema(len(rows[0]), current_section, rows)
                    else:
                        schema = continuation_schema(schema, len(rows[0]), current_section, rows)
                    if schema is None:
                        continue
                for row_index, row in enumerate(rows[data_start:], start=data_start):
                    record = holding_from_table_row(
                        row,
                        schema,
                        current_section,
                        fallback_rank=next_rank[current_section],
                        report=report,
                        page_number=page_index + 1,
                        pdf_sha256=pdf_sha256,
                        year=year,
                    )
                    if record is None:
                        if current_section == "equity":
                            merge_rankless_equity_name_fragment(
                                records,
                                seen,
                                row,
                                schema,
                                row_index=row_index,
                                page_number=page_index + 1,
                                expected_rank=next_rank[current_section] - 1,
                            )
                        continue
                    key = holding_record_key(record)
                    if key in seen:
                        continue
                    seen.add(key)
                    records.append(record)
                    next_rank[current_section] = max(next_rank[current_section], int(record["序号"]) + 1)
            # A §7 heading often sits at the bottom of one page while its
            # table starts on the next page.  Table-by-table updates above do
            # not observe such a trailing heading, so carry the final section
            # state forward explicitly.
            if events:
                current_section = events[-1][1]
    finally:
        doc.close()
    ordered_records = sorted(
        records,
        key=lambda item: (
            0 if item["披露范围"] == "all_disclosed_equity" else 1,
            int(item["序号"]),
            item["证券标识"],
        ),
    )
    for record in ordered_records:
        record.pop("_selectedNameIndex", None)
    return ordered_records


def parse_one_report(
    report: dict[str, Any],
    *,
    year: int,
    pdf_cache_dir: Path,
    refresh: bool,
) -> dict[str, Any]:
    report_id = str(report.get("uploadInfoId", "")).strip()
    if not report_id:
        return {"report": report, "status": "invalid_report_id", "rows": [], "error": "uploadInfoId 为空"}
    pdf_url = EID_PDF_URL.format(upload_info_id=report_id)
    pdf_path = pdf_cache_dir / f"{report_id}.pdf"
    try:
        fetch_pdf(pdf_url, pdf_path, refresh=refresh)
        source_report = report
        source_url = pdf_url
    except Exception as eid_error:
        try:
            fallback_url = official_manager_pdf_url(report)
            if not fallback_url:
                raise RuntimeError("未找到基金管理人官网的同名中期报告")
            fetch_pdf(fallback_url, pdf_path, refresh=True)
            source_report = {
                **report,
                "sourceUrl": fallback_url,
                "parserMethod": "manager_official_pdf_table_7_4_7_10",
            }
            source_url = fallback_url
        except Exception as fallback_error:
            return {
                "report": report,
                "status": "error",
                "rows": [],
                "error": f"EID 下载失败：{eid_error}；官网回退失败：{fallback_error}",
                "sourceUrl": pdf_url,
            }
    try:
        rows = parse_report_pdf(pdf_path, source_report, year)
    except Exception as exc:
        return {"report": report, "status": "error", "rows": [], "error": str(exc), "sourceUrl": source_url}
    counts = Counter(row["披露范围"] for row in rows)
    return {
        "report": report,
        "status": "ok" if rows else "parsed_without_7_4_or_7_10_rows",
        "rows": rows,
        "error": "",
        "sourceUrl": source_url,
        "equityRows": counts["all_disclosed_equity"],
        "fundInvestmentRows": counts["top10_disclosed_fund_investments"],
        "pdfSha256": hashlib.sha256(pdf_path.read_bytes()).hexdigest(),
    }


def report_result_summary(result: dict[str, Any]) -> dict[str, Any]:
    report = result["report"]
    return {
        "fundCode": str(report.get("fundCode", "")).strip(),
        "fundName": str(report.get("fundShortName", "")).strip(),
        "reportName": str(report.get("reportName", "")).strip(),
        "uploadInfoId": str(report.get("uploadInfoId", "")).strip(),
        "reportSendDate": str(report.get("reportSendDate", "")).strip(),
        "correctionsNum": report.get("correctionsNum", 0),
        "status": result["status"],
        "equityRows": int(result.get("equityRows") or 0),
        "fundInvestmentRows": int(result.get("fundInvestmentRows") or 0),
        "pdfSha256": result.get("pdfSha256", ""),
        "sourceUrl": result.get("sourceUrl", ""),
        "error": result.get("error", ""),
    }


def write_rows(path: Path, rows: list[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(HOLDING_HEADERS)
        for row in rows:
            writer.writerow(safe_csv_row([row.get(header, "") for header in HOLDING_HEADERS]))


def main() -> None:
    args = parse_args()
    if args.year < 2000:
        raise ValueError("--year 必须不小于 2000")
    if args.workers < 1 or args.workers > 6:
        raise ValueError("--workers 必须在 1 到 6 之间，避免触发 EID 限流。")
    if args.limit < 0:
        raise ValueError("--limit 不能为负数")

    output_dir = ROOT / args.output_dir
    cache_root = ROOT / args.cache_dir / f"{args.year}h1"
    reports = fetch_all_reports(args.year, cache_root / "reports.json", refresh=args.refresh)
    requested_codes = {str(code).strip() for code in args.fund_code if str(code).strip()}
    if requested_codes:
        reports = [report for report in reports if str(report.get("fundCode", "")).strip() in requested_codes]
        missing_codes = requested_codes - {str(report.get("fundCode", "")).strip() for report in reports}
        if missing_codes:
            raise RuntimeError(f"EID QDII 中期报告列表没有基金代码：{', '.join(sorted(missing_codes))}")
    if args.limit:
        reports = reports[: args.limit]
    if not reports:
        raise RuntimeError("EID 未返回任何 QDII 中期报告。")

    results: list[dict[str, Any]] = []
    # PyMuPDF table recognition uses native state that is not reliable when
    # several PDFs are parsed in Python threads: it can silently miss tables
    # without raising an exception.  Isolate each report in a process so a
    # "parsed_without" result is a disclosure outcome, not a thread race.
    with ProcessPoolExecutor(max_workers=args.workers) as executor:
        pending = {
            executor.submit(
                parse_one_report,
                report,
                year=args.year,
                pdf_cache_dir=cache_root / "reports",
                refresh=args.refresh,
            ): report
            for report in reports
        }
        for index, future in enumerate(as_completed(pending), start=1):
            report = pending[future]
            try:
                result = future.result()
            except Exception as exc:  # defensive guard for worker faults
                result = {"report": report, "status": "error", "rows": [], "error": str(exc)}
            results.append(result)
            if args.progress_every and (index == len(pending) or index % args.progress_every == 0):
                print(f"[QDII H1] {index}/{len(pending)} {result['status']} {report.get('fundCode', '')}", flush=True)

    results.sort(key=lambda item: (str(item["report"].get("fundCode", "")), str(item["report"].get("uploadInfoId", ""))))
    errors = [result for result in results if result["status"] in {"error", "invalid_report_id"}]
    if errors:
        preview = "；".join(
            f"{item['report'].get('fundCode', '')}: {item.get('error', '')}" for item in errors[:5]
        )
        raise RuntimeError(f"{len(errors)} 份 EID 报告抓取或解析失败，拒绝发布半成品：{preview}")

    rows = [row for result in results for row in result["rows"]]
    rows.sort(
        key=lambda item: (
            item["基金代码"],
            0 if item["披露范围"] == "all_disclosed_equity" else 1,
            int(item["序号"]),
            item["证券标识"],
        )
    )
    status_counts = Counter(result["status"] for result in results)
    scope_counts = Counter(row["披露范围"] for row in rows)
    summary = {
        "schemaVersion": "1",
        "report": REPORT_LABEL.format(year=args.year),
        "cutoffDate": CUTOFF_DATE.format(year=args.year),
        "officialSource": EID_SEARCH_URL,
        "officialSourceLandingPage": EID_REFERER,
        "fundType": QDII_FUND_TYPE,
        "reportType": REPORT_TYPE_MID_YEAR,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "reportCount": len(results),
        # Prevent a smoke run (``--limit`` / ``--fund-code``) from becoming a
        # production overlay source by accident.
        "isComplete": not bool(args.limit or args.fund_code),
        "requestedFundCodes": sorted(set(args.fund_code)),
        "statusCounts": dict(sorted(status_counts.items())),
        "holdingRows": len(rows),
        "scopeCounts": dict(sorted(scope_counts.items())),
        "disclosureScopes": {
            "all_disclosed_equity": "7.4 至 7.5 的全部已披露权益投资明细",
            "top10_disclosed_fund_investments": "7.10 至 7.11 的前十名基金投资明细；ETF 亦仅限报告披露范围",
        },
        "reportResults": [report_result_summary(result) for result in results],
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    csv_target = output_dir / f"holdings_qdii_{args.year}h1.csv"
    summary_target = output_dir / f"qdii_half_year_holdings_summary_{args.year}.json"
    token = f".{int(time.time() * 1000)}"
    csv_staged = csv_target.with_name(csv_target.name + token + ".tmp")
    summary_staged = summary_target.with_name(summary_target.name + token + ".tmp")
    try:
        write_rows(csv_staged, rows)
        summary_staged.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
        publish_staged_files([(csv_staged, csv_target), (summary_staged, summary_target)])
    finally:
        if csv_staged.exists():
            csv_staged.unlink()
        if summary_staged.exists():
            summary_staged.unlink()
    print(
        "[QDII H1] 已发布："
        f"reports={len(results)} equity={scope_counts['all_disclosed_equity']} "
        f"fund_investments={scope_counts['top10_disclosed_fund_investments']}",
        flush=True,
    )


if __name__ == "__main__":
    main()
