from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

import fitz
import requests

from quarter_config import cutoff_date_for_quarter, load_quarter_config, report_label


ROOT = Path(__file__).resolve().parents[1]
FUND_LIST_URL = "https://fund.eastmoney.com/js/fundcode_search.js"
ANNOUNCEMENT_URL = "https://api.fund.eastmoney.com/f10/JJGG"
PDF_URL = "https://pdf.dfcfw.com/pdf/H2_{announcement_id}_1.pdf"
REFERER_URL = "https://fundf10.eastmoney.com/jjgg_{fund_code}_3.html"

HOLDING_HEADERS = [
    "基金代码",
    "基金名称",
    "基金类型",
    "报告期",
    "截止日期",
    "持仓类别",
    "序号",
    "证券代码",
    "证券名称",
    "占净值比例",
    "占净值比例数值",
    "持仓市值(万元)",
    "持股数(万股)",
    "最新价",
    "涨跌幅",
    "涨跌幅数值",
    "来源标题",
    "来源URL",
    "公告ID",
    "公告日期",
    "候选范围",
    "解析方式",
]

JAPANESE_STOCK_NAME_RE = re.compile(
    r"东京|丰田|索尼|日立|三菱|任天堂|软银|本田|东京电子|三井|住友|瑞穗|武田|迅销|基恩士|信越|村田|电装|佳能|尼康|日本"
)
KOREAN_STOCK_NAME_RE = re.compile(
    r"三星电子|SK海力士|现代汽车|起亚|LG|NAVER|Kakao|浦项|POSCO|Celltrion|韩华|韩国电力"
)
LEVERAGED_LONG_RE = re.compile(
    r"(?i)(?:\b\d(?:\.\d+)?\s*X\b|\d(?:\.\d+)?\s*倍|杠杆|LEVERAGED|LEVERAGE|ULTRA)"
)
INVERSE_PRODUCT_RE = re.compile(r"(?i)(?:SHORT|BEAR|INVERSE|DOWN|PUT|做空|反向|反向做多)")
NUMERIC_RE = re.compile(r"(?<![A-Za-z0-9])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?![A-Za-z0-9])")
THREAD_LOCAL = threading.local()

NAME_FIXES = (
    (re.compile(r"\bSa\s+msung\b", re.I), "Samsung"),
    (re.compile(r"\bEle\s+ctronics\b", re.I), "Electronics"),
    (re.compile(r"\bD\s+aily\b", re.I), "Daily"),
    (re.compile(r"\bDai\s+ly\b", re.I), "Daily"),
    (re.compile(r"\bLe\s+veraged\b", re.I), "Leveraged"),
    (re.compile(r"\bLeve\s+raged\b", re.I), "Leveraged"),
    (re.compile(r"\bPr\s+oduct\b", re.I), "Product"),
    (re.compile(r"\bProd\s+uct\b", re.I), "Product"),
    (re.compile(r"\bAss\s+et\b", re.I), "Asset"),
    (re.compile(r"\bManage\s+ment\b", re.I), "Management"),
)

KNOWN_PRODUCT_CODES = (
    (re.compile(r"(?i)\bCSOP\b.*\bSK\s+HYNIX\b.*\b2\s*X\b"), "7709.HK"),
    (re.compile(r"(?i)\bCSOP\b.*\bSAMSUNG\s+ELECTRONICS\b.*\b2\s*X\b"), "7747.HK"),
)


def parse_args() -> argparse.Namespace:
    quarter_config = load_quarter_config()
    parser = argparse.ArgumentParser(
        description=(
            "Fetch Eastmoney regular-report PDFs for LOF funds with overseas stock holdings, "
            "then extract leveraged fund-investment rows."
        )
    )
    parser.add_argument("--year", type=int, default=quarter_config.year)
    parser.add_argument("--quarter", type=int, default=quarter_config.quarter, choices=[1, 2, 3, 4])
    parser.add_argument("--workers", type=int, default=6)
    parser.add_argument("--refresh", action="store_true", help="Ignore cached report lists and PDFs.")
    parser.add_argument("--limit", type=int, default=0, help="Limit candidate funds for a smoke test.")
    parser.add_argument("--progress-every", type=int, default=20)
    parser.add_argument("--output-dir", default="outputs")
    parser.add_argument("--cache-dir", default="data/eastmoney_cache")
    parser.add_argument(
        "--candidate-scope",
        choices=["overseas-lof", "overseas-qdii", "overseas-all"],
        default="overseas-lof",
        help="Candidate funds are first filtered by existing overseas stock holdings.",
    )
    return parser.parse_args()


def get_session() -> requests.Session:
    session = getattr(THREAD_LOCAL, "session", None)
    if session is None:
        session = requests.Session()
        session.headers.update(
            {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
                ),
                "Accept": "application/json,text/javascript,*/*;q=0.01",
            }
        )
        THREAD_LOCAL.session = session
    return session


def fetch_bytes(url: str, cache_path: Path, refresh: bool, referer: str | None = None) -> bytes:
    if cache_path.exists() and not refresh:
        cached = cache_path.read_bytes()
        if not is_pdf_bot_challenge(cached):
            return cached

    headers = {}
    if referer:
        headers["Referer"] = referer

    last_error: Exception | None = None
    for attempt in range(4):
        try:
            response = get_session().get(url, headers=headers, timeout=35)
            response.raise_for_status()
            content = response.content
            if is_pdf_bot_challenge(content):
                apply_pdf_bot_challenge_cookies(content)
                last_error = RuntimeError("Eastmoney PDF cookie challenge.")
                continue
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            tmp_path = cache_path.with_suffix(cache_path.suffix + ".tmp")
            tmp_path.write_bytes(content)
            tmp_path.replace(cache_path)
            return content
        except Exception as exc:
            last_error = exc
            time.sleep(0.8 * (attempt + 1))

    raise RuntimeError(str(last_error))


def is_pdf_bot_challenge(content: bytes) -> bool:
    return content.lstrip().startswith(b"<script") and b"EO_Bot_Ssid" in content


def apply_pdf_bot_challenge_cookies(content: bytes) -> None:
    text = content.decode("utf-8", errors="ignore")
    numbers = [int(item) for item in re.findall(r"\b\d{7,10}\b", text)]
    if not numbers:
        return
    eo_bot_ssid = max(numbers)
    tst_status = sum(item for item in numbers if item != eo_bot_ssid)
    session = get_session()
    session.cookies.set("__tst_status", f"{tst_status}#", domain="pdf.dfcfw.com")
    session.cookies.set("EO_Bot_Ssid", str(eo_bot_ssid), domain="pdf.dfcfw.com")


def fetch_json(url: str, cache_path: Path, refresh: bool, referer: str | None = None) -> dict[str, Any]:
    text = fetch_bytes(url, cache_path, refresh, referer).decode("utf-8", errors="replace")
    return json.loads(text)


def is_overseas_stock_code(code: str, name: str = "") -> bool:
    normalized = code.strip().upper()
    if re.fullmatch(r"\d{5}", normalized):
        return True
    if re.fullmatch(r"\d{4}\.(T|JP)", normalized):
        return True
    if re.fullmatch(r"\d{6}\.(KS|KQ)", normalized):
        return True
    if re.fullmatch(r"[A-Z]{1,5}([.-][A-Z]{1,2})?", normalized):
        return True
    if re.fullmatch(r"\d{4}", normalized):
        return True
    if re.fullmatch(r"\d{6}", normalized) and KOREAN_STOCK_NAME_RE.search(name):
        return True
    if JAPANESE_STOCK_NAME_RE.search(name) or KOREAN_STOCK_NAME_RE.search(name):
        return True
    return False


def load_candidate_funds(
    stock_csv: Path,
    *,
    candidate_scope: str,
) -> dict[str, dict[str, str]]:
    candidates: dict[str, dict[str, str]] = {}
    with stock_csv.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            stock_code = row.get("证券代码", "")
            stock_name = row.get("证券名称", "")
            if not is_overseas_stock_code(stock_code, stock_name):
                continue
            fund_code = row.get("基金代码", "").strip()
            fund_name = row.get("基金名称", "").strip()
            fund_type = row.get("基金类型", "").strip()
            if not fund_code:
                continue
            searchable = f"{fund_name} {fund_type}".upper()
            if candidate_scope == "overseas-lof" and "LOF" not in searchable:
                continue
            if candidate_scope == "overseas-qdii" and not fund_type.startswith("QDII"):
                continue
            candidates[fund_code] = {
                "code": fund_code,
                "name": fund_name,
                "type": fund_type,
            }
    return dict(sorted(candidates.items()))


def select_quarter_report(data: dict[str, Any], year: int, quarter: int) -> dict[str, Any] | None:
    marker = f"{year}年第{quarter}季度报告"
    for item in data.get("Data") or []:
        title = str(item.get("TITLE", ""))
        if marker in title:
            return item
    return None


def normalize_product_name(value: str) -> str:
    normalized = re.sub(r"\s+", " ", value.strip())
    for pattern, replacement in NAME_FIXES:
        normalized = pattern.sub(replacement, normalized)
    return normalized.strip()


def infer_product_code(name: str, rank: int) -> str:
    normalized = normalize_product_name(name)
    for pattern, code in KNOWN_PRODUCT_CODES:
        if pattern.search(normalized):
            return code
    return f"REPORT-FUND-{rank:02d}"


def parse_number(value: str) -> float:
    return float(value.replace(",", ""))


def numbers_from_text(value: str) -> list[float]:
    return [parse_number(item.group(0)) for item in NUMERIC_RE.finditer(value)]


def y_overlap(a: tuple[float, float], b: tuple[float, float]) -> float:
    return max(0.0, min(a[1], b[1]) - max(a[0], b[0]))


def closest_value_block(
    name_block: tuple[float, float, float, float, str],
    blocks: list[tuple[float, float, float, float, str]],
) -> tuple[float, float] | None:
    nx0, ny0, nx1, ny1, _ = name_block
    candidates: list[tuple[float, float, list[float]]] = []
    for x0, y0, x1, y1, text in blocks:
        if x0 <= max(nx1, 280):
            continue
        nums = numbers_from_text(text)
        if len(nums) < 2:
            continue
        overlap = y_overlap((ny0, ny1), (y0, y1))
        if overlap <= 0 and abs(((ny0 + ny1) / 2) - ((y0 + y1) / 2)) > 55:
            continue
        distance = abs(((ny0 + ny1) / 2) - ((y0 + y1) / 2))
        candidates.append((distance, -overlap, nums))
    if not candidates:
        return None
    nums = sorted(candidates, key=lambda item: (item[0], item[1]))[0][2]
    return nums[-2], nums[-1]


def rank_for_block(
    name_block: tuple[float, float, float, float, str],
    blocks: list[tuple[float, float, float, float, str]],
    fallback: int,
) -> int:
    _, ny0, _, ny1, _ = name_block
    best: tuple[float, int] | None = None
    for x0, y0, x1, y1, text in blocks:
        if x0 > 110:
            continue
        stripped = text.strip()
        if not re.fullmatch(r"\d{1,2}", stripped):
            continue
        overlap = y_overlap((ny0, ny1), (y0, y1))
        if overlap <= 0:
            continue
        distance = abs(((ny0 + ny1) / 2) - ((y0 + y1) / 2))
        rank = int(stripped)
        if best is None or distance < best[0]:
            best = (distance, rank)
    return best[1] if best else fallback


def parse_leveraged_fund_investments(pdf_path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    doc = fitz.open(str(pdf_path))
    try:
        for page in doc:
            page_text = page.get_text("text")
            if "基金投资明细" not in page_text and not LEVERAGED_LONG_RE.search(page_text):
                continue
            raw_blocks = page.get_text("blocks", sort=True)
            blocks = [
                (float(x0), float(y0), float(x1), float(y1), str(text))
                for x0, y0, x1, y1, text, *_ in raw_blocks
            ]
            section_tops = [y0 for x0, y0, x1, y1, text in blocks if "基金投资明细" in text]
            section_top = min(section_tops) if section_tops else 0.0
            section_bottoms = [
                y0
                for x0, y0, x1, y1, text in blocks
                if y0 > section_top and re.search(r"5\.10|投资组合报告附注", text)
            ]
            section_bottom = min(section_bottoms) if section_bottoms else float("inf")
            for block in blocks:
                x0, y0, x1, y1, text = block
                if y0 < section_top or y0 > section_bottom:
                    continue
                if not (80 <= x0 <= 260):
                    continue
                name = normalize_product_name(text)
                if not name or "基金名称" in name:
                    continue
                if INVERSE_PRODUCT_RE.search(name) or not LEVERAGED_LONG_RE.search(name):
                    continue
                values = closest_value_block(block, blocks)
                if values is None:
                    continue
                market_value_yuan, ratio_percent = values
                rank = rank_for_block(block, blocks, len(rows) + 1)
                rows.append(
                    {
                        "rank": rank,
                        "sourceCode": infer_product_code(name, rank),
                        "sourceName": name,
                        "ratioPercent": ratio_percent,
                        "ratio": ratio_percent / 100,
                        "marketValueWan": market_value_yuan / 10000,
                    }
                )
    finally:
        doc.close()
    rows.sort(key=lambda item: item["rank"])
    return rows


def fetch_one_fund(
    fund: dict[str, str],
    *,
    year: int,
    quarter: int,
    report_cache_dir: Path,
    pdf_cache_dir: Path,
    refresh: bool,
    candidate_scope: str,
) -> dict[str, Any]:
    fund_code = fund["code"]
    referer = REFERER_URL.format(fund_code=fund_code)
    report_url = (
        f"{ANNOUNCEMENT_URL}?fundcode={fund_code}&pageIndex=1&pageSize=20&type=3"
    )
    report_cache = report_cache_dir / f"{fund_code}.json"
    report_data = fetch_json(report_url, report_cache, refresh, referer)
    report_item = select_quarter_report(report_data, year, quarter)
    if report_item is None:
        return {"fund": fund, "status": "no_report", "rows": [], "error": ""}

    announcement_id = str(report_item.get("ID", "")).strip()
    if not announcement_id:
        return {"fund": fund, "status": "no_report_id", "rows": [], "error": ""}

    pdf_url = PDF_URL.format(announcement_id=announcement_id)
    pdf_path = pdf_cache_dir / f"{fund_code}_{announcement_id}.pdf"
    fetch_bytes(pdf_url, pdf_path, refresh, referer)
    try:
        parsed = parse_leveraged_fund_investments(pdf_path)
    except Exception as exc:
        return {
            "fund": fund,
            "status": "pdf_parse_error",
            "rows": [],
            "error": str(exc),
            "announcement_id": announcement_id,
        }
    rows = []
    for item in parsed:
        rows.append(
            [
                fund["code"],
                fund["name"],
                fund["type"],
                report_label(year, quarter),
                cutoff_date_for_quarter(year, quarter),
                "基金投资",
                item["rank"],
                item["sourceCode"],
                item["sourceName"],
                f"{item['ratioPercent']:.2f}%",
                item["ratio"],
                round(item["marketValueWan"], 4),
                "",
                "",
                "",
                "",
                str(report_item.get("TITLE", "")).strip(),
                pdf_url,
                announcement_id,
                str(report_item.get("PUBLISHDATEDesc", "")).strip(),
                candidate_scope,
                "eastmoney_report_pdf_fund_investment",
            ]
        )
    return {
        "fund": fund,
        "status": "ok" if rows else "no_leveraged_fund_investment",
        "rows": rows,
        "error": "",
        "announcement_id": announcement_id,
    }


def main() -> int:
    args = parse_args()
    quarter = load_quarter_config()
    year = args.year
    quarter_num = args.quarter
    slug = report_label(year, quarter_num).lower()
    stock_csv = ROOT / "outputs" / f"holdings_stock_{slug}.csv"
    if not stock_csv.exists():
        raise FileNotFoundError(f"Missing stock holding CSV: {stock_csv}")

    candidates = list(
        load_candidate_funds(stock_csv, candidate_scope=args.candidate_scope).values()
    )
    if args.limit:
        candidates = candidates[: args.limit]

    output_path = ROOT / args.output_dir / f"holdings_fund_investment_{slug}.csv"
    summary_path = ROOT / args.output_dir / f"fund_report_holdings_summary_{slug}.json"
    cache_root = ROOT / args.cache_dir / slug
    report_cache_dir = cache_root / "report_list"
    pdf_cache_dir = cache_root / "reports"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    started = time.time()
    status_counts: dict[str, int] = {}
    rows_written = 0
    processed = 0

    with output_path.open("w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.writer(handle)
        writer.writerow(HOLDING_HEADERS)
        with ThreadPoolExecutor(max_workers=max(args.workers, 1)) as executor:
            futures = [
                executor.submit(
                    fetch_one_fund,
                    fund,
                    year=year,
                    quarter=quarter_num,
                    report_cache_dir=report_cache_dir,
                    pdf_cache_dir=pdf_cache_dir,
                    refresh=args.refresh,
                    candidate_scope=args.candidate_scope,
                )
                for fund in candidates
            ]
            for future in as_completed(futures):
                processed += 1
                try:
                    result = future.result()
                except Exception as exc:
                    status = "error"
                    status_counts[status] = status_counts.get(status, 0) + 1
                    if args.progress_every and processed % args.progress_every == 0:
                        print(
                            json.dumps(
                                {
                                    "processed": processed,
                                    "fund_count": len(candidates),
                                    "rows_written": rows_written,
                                    "status_counts": status_counts,
                                    "last_error": str(exc),
                                },
                                ensure_ascii=False,
                            ),
                            flush=True,
                        )
                    continue
                status = result["status"]
                status_counts[status] = status_counts.get(status, 0) + 1
                rows = result.get("rows", [])
                if rows:
                    writer.writerows(rows)
                    rows_written += len(rows)
                if args.progress_every and processed % args.progress_every == 0:
                    print(
                        json.dumps(
                            {
                                "processed": processed,
                                "fund_count": len(candidates),
                                "rows_written": rows_written,
                                "status_counts": status_counts,
                                "elapsed_seconds": round(time.time() - started, 1),
                            },
                            ensure_ascii=False,
                        ),
                        flush=True,
                    )

    summary = {
        "report": report_label(year, quarter_num),
        "candidate_scope": args.candidate_scope,
        "candidate_fund_count": len(candidates),
        "rows_written": rows_written,
        "output_csv": str(output_path),
        "status_counts": status_counts,
        "elapsed_seconds": round(time.time() - started, 1),
        "source_stock_csv": str(stock_csv),
        "cache_dir": str(cache_root),
        "configured_quarter": quarter.report,
    }
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        print("Interrupted.", file=sys.stderr)
        raise SystemExit(130)
