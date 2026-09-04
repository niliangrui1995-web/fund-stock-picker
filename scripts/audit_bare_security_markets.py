"""Recover explicit exchange / country labels beside bare tickers in reports."""
from __future__ import annotations

import csv
import hashlib
import json
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import fitz

from fetch_qdii_half_year_holdings import get_session, is_pdf

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "outputs/research-flow-2026-09-05/identity"


def main() -> None:
    audit = json.loads((OUTPUT / "openfigi-expansion-evidence.json").read_text(encoding="utf-8"))
    bases = {job["idValue"] for job in audit["candidates"].values() if job["idType"] == "TICKER"}
    stocks = json.loads((ROOT / "public/data/fund-stock-index-2026q2.json").read_text(encoding="utf-8"))["stocks"]
    bases.update(stock["code"] for stock in stocks if re.fullmatch(r"[A-Z]{1,5}|\d{1,4}", stock["code"]) and not re.search(r"(?:US|UW|UN)$", stock["code"]))
    bases.update(["ASML", "SAN", "RIO", "TMUS"])
    rows = [row for row in csv.DictReader((ROOT / "outputs/holdings_qdii_2026h1.csv").open(encoding="utf-8-sig")) if row["披露范围"] == "all_disclosed_equity" and row["证券代码"] in bases]
    reports = {row["公告ID"]: row for row in rows}
    def inspect(pair):
        report_id, sample = pair
        path = OUTPUT / (report_id + ".pdf")
        if not path.exists() or not is_pdf(path.read_bytes()):
            for _ in range(2):
                try:
                    response = get_session().get(sample["来源URL"], timeout=35)
                    response.raise_for_status()
                    if is_pdf(response.content):
                        path.write_bytes(response.content)
                        break
                except Exception:
                    continue
            else:
                return {"reportId": report_id, "sourceUrl": sample["来源URL"], "status": "source_gap", "rows": []}
        if hashlib.sha256(path.read_bytes()).hexdigest() != sample["PDF_SHA256"]:
            raise ValueError(f"Report digest mismatch: {report_id}")
        doc = fitz.open(path)
        page_lines = {}
        result = []
        for row in rows:
            if row["公告ID"] != report_id:
                continue
            page_number = int(row["页码"])
            lines = page_lines.setdefault(page_number, [re.sub(r"\s+", "", line) for line in doc[page_number - 1].get_text().splitlines() if line.strip()])
            positions = [index for index, line in enumerate(lines) if line.upper() == row["证券代码"].upper()]
            markets = set()
            labels = set()
            for position in positions:
                tail = "".join(lines[position + 1:position + 8])
                tail = re.split(r"\d", tail, maxsplit=1)[0]
                for market, pattern in [("us", r"纳斯达克|那斯达克|纽约|NASDAQ|NYSE|美国|美國"), ("hk", r"香港|深港通|沪港通|港股通"), ("a", r"上海|深圳|中国大陆|中國大陸"), ("tw", r"台湾|臺灣|台灣"), ("jp", r"日本|东京|東京"), ("ch", r"瑞士|Swiss|SWX|SIX"), ("au", r"澳大利亚|澳洲|Australia"), ("gb", r"英国|伦敦|London"), ("de", r"德国|德國|法兰克福"), ("fr", r"法国|巴黎"), ("es", r"西班牙|马德里"), ("at", r"奥地利|维也纳"), ("nl", r"荷兰|阿姆斯特丹"), ("ca", r"加拿大|多伦多"), ("se", r"瑞典|斯德哥尔摩"), ("it", r"意大利|米兰")]:
                    if match := re.search(pattern, tail, re.I):
                        markets.add(market)
                        labels.add(match[0])
            if "hk" in markets:
                markets.discard("a")
            result.append({"fundCode": row["基金代码"], "code": row["证券代码"], "name": row["证券名称"], "page": row["页码"], "markets": sorted(markets), "marketLabels": sorted(labels)})
        return {"reportId": report_id, "sourceUrl": sample["来源URL"], "pdfSha256": sample["PDF_SHA256"], "rows": result}
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(inspect, reports.items()))
    (OUTPUT / "bare-security-market-evidence.json").write_text(json.dumps({"checkedAt": "2026-09-05", "reports": results}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Verified {len(reports)} official reports; {len(rows)} bare code rows; explicit unique markets {sum(len(row['markets']) == 1 for report in results for row in report['rows'])}")


if __name__ == "__main__":
    main()
