"""Verify the report pages behind observed HG / HS Hong Kong disclosure codes."""
from __future__ import annotations

import csv
import hashlib
import json
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import fitz
from fetch_qdii_half_year_holdings import get_session

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "outputs/research-flow-2026-09-05/identity"


def main() -> None:
    rows = [row for row in csv.DictReader((ROOT / "outputs/holdings_qdii_2026h1.csv").open(encoding="utf-8-sig")) if re.fullmatch(r"\d{1,5}(HG|HS)", row["证券代码"])]
    reports = {row["公告ID"]: row for row in rows}
    def verify_report(pair):
        report_id, sample = pair
        path = OUTPUT / (report_id + ".pdf")
        if not path.exists():
            response = get_session().get(sample["来源URL"], timeout=60)
            response.raise_for_status()
            path.write_bytes(response.content)
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != sample["PDF_SHA256"]:
            raise ValueError(f"Official report digest mismatch: {report_id}")
        document = fitz.open(path)
        excerpts = []
        for row in rows:
            if row["公告ID"] != report_id:
                continue
            page = document[int(row["页码"]) - 1].get_text()
            compact = re.sub(r"\s+", "", page)
            code = row["证券代码"]
            start = compact.find(code)
            route_text = compact[start + len(code):start + len(code) + 16] if start >= 0 else ""
            market = re.search(r"(?:港股通|沪港通|深港通)(?:联合市(?:场)?)?", route_text)
            excerpts.append({"code": code, "name": row["证券名称"], "page": row["页码"], "reportedMarket": market[0] if market else "", "codeFound": start >= 0})
        return {"reportId": report_id, "fundCode": sample["基金代码"], "reportName": sample["来源标题"], "sourceUrl": sample["来源URL"], "pdfSha256": digest, "excerpts": excerpts}
    with ThreadPoolExecutor(max_workers=3) as pool:
        result = list(pool.map(verify_report, reports.items()))
    target = OUTPUT / "hk-disclosure-suffix-evidence.json"
    target.write_text(json.dumps({"checkedAt": "2026-09-05", "reports": result}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Verified {len(reports)} official report hashes; {len(rows)} HG/HS disclosure rows")


if __name__ == "__main__":
    main()
