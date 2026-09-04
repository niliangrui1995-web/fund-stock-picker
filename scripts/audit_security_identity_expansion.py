"""Capture identifier evidence for every explicitly market-qualified disclosure code.

This only writes an audit artifact. It never rewrites the registry or publishes data.
"""
from __future__ import annotations

import csv
import json
import re
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "outputs/research-flow-2026-09-05/identity"


def mapping_job(code: str) -> dict[str, str] | None:
    value = code.strip().upper().replace(" ", "")
    if match := re.fullmatch(r"(.+?)(US|UW|UN)(?:EQUITY)?", value):
        return {"idType": "TICKER", "idValue": match[1], "exchCode": match[2]}
    if match := re.fullmatch(r"(\d{1,5})(HK)(?:EQUITY)?", value):
        return {"idType": "TICKER", "idValue": str(int(match[1])), "exchCode": "HK"}
    if re.fullmatch(r"\d{5}", value):
        return {"idType": "TICKER", "idValue": str(int(value)), "exchCode": "HK"}
    if match := re.fullmatch(r"(\d{6})CH(?:EQUITY)?", value):
        return {"idType": "TICKER", "idValue": match[1], "exchCode": "CH"}
    if re.fullmatch(r"US[A-Z0-9]{9}\d", value):
        return {"idType": "ID_ISIN", "idValue": value, "exchCode": "US"}
    return None


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    payload = json.loads((ROOT / "public/data/fund-stock-index-2026q2.json").read_text(encoding="utf-8"))
    stocks = payload["stocks"]
    candidates = {stock["code"]: job for stock in stocks if (job := mapping_job(stock["code"]))}
    suffix_evidence = OUTPUT / "hk-disclosure-suffix-evidence.json"
    if suffix_evidence.exists():
        verified_routes = json.loads(suffix_evidence.read_text(encoding="utf-8"))
        for report in verified_routes["reports"]:
            for excerpt in report["excerpts"]:
                code = excerpt["code"]
                route = excerpt["reportedMarket"]
                if excerpt["codeFound"] and re.search(r"(?:港股通|沪港通|深港通)", route):
                    candidates[code] = {"idType": "TICKER", "idValue": str(int(code[:-2])), "exchCode": "HK"}
    jobs = {json.dumps(job, sort_keys=True): job for job in candidates.values()}
    records = {}
    target = OUTPUT / "openfigi-expansion-evidence.json"
    if target.exists():
        records = {json.dumps(item["request"], sort_keys=True): item for item in json.loads(target.read_text(encoding="utf-8"))["records"]}
    for source in (ROOT / "docs/security-identity-openfigi-evidence-2026-09-05.json",):
        if source.exists():
            for item in json.loads(source.read_text(encoding="utf-8"))["records"]:
                records.setdefault(json.dumps(item["request"], sort_keys=True), item)
    missing = [job for key, job in jobs.items() if key not in records]
    print(f"Candidates {len(candidates)}, unique requests {len(jobs)}, cached {len(jobs) - len(missing)}", flush=True)
    for offset in range(0, len(missing), 10):
        batch = missing[offset:offset + 10]
        start = time.monotonic()
        response = requests.post("https://api.openfigi.com/v3/mapping", json=batch, timeout=45)
        if response.status_code == 429:
            time.sleep(max(3, min(60, int(response.headers.get("ratelimit-reset", "15")))))
            response = requests.post("https://api.openfigi.com/v3/mapping", json=batch, timeout=45)
        response.raise_for_status()
        for job, result in zip(batch, response.json(), strict=True):
            records[json.dumps(job, sort_keys=True)] = {"request": job, "response": result}
        target.write_text(json.dumps({"checkedAt": "2026-09-05", "source": "https://api.openfigi.com/v3/mapping", "candidates": candidates, "records": list(records.values())}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        if offset % 100 == 0 or offset + 10 >= len(missing):
            print(f"Fetched {min(offset + 10, len(missing))}/{len(missing)}", flush=True)
        # The unauthenticated official limit is 25 requests per minute.
        time.sleep(max(0, 2.5 - (time.monotonic() - start)))


if __name__ == "__main__":
    main()
