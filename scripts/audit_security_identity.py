"""Capture official identifier responses for the explicitly reviewed UI audit scope."""
from __future__ import annotations

import csv
import json
import time
from pathlib import Path

import requests

from expand_security_identity_registry import write_registry


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "outputs" / "ui-ux-optimization-2026-09-05"
TICKERS = (
    "NVDA", "AAPL", "AMD", "AMZN", "ASML", "AVGO", "GOOG", "GOOGL",
    "META", "MSFT", "MU", "TSLA", "TSM", "PLTR", "LITE", "COHR", "GLW", "MSTR",
)
DISPLAY_NAMES = {
    "NVDA": "英伟达 NVIDIA", "AAPL": "苹果 Apple", "AMD": "超威半导体 AMD",
    "AMZN": "亚马逊 Amazon", "ASML": "阿斯麦 ASML（美国登记股）", "AVGO": "博通 Broadcom",
    "GOOG": "Alphabet C 类股", "GOOGL": "Alphabet A 类股", "META": "Meta Platforms A 类股",
    "MSFT": "微软 Microsoft", "MU": "美光 Micron", "TSLA": "特斯拉 Tesla",
    "TSM": "台积电 TSMC（ADR）", "PLTR": "Palantir A 类股", "LITE": "Lumentum",
    "COHR": "相干 Coherent", "GLW": "康宁 Corning", "MSTR": "Strategy",
    "000660": "SK 海力士", "005930": "三星电子（普通股）", "00700": "腾讯控股",
}


def write_reviewed_registry(rows: list[dict[str, str]], records: list[dict]) -> None:
    """Only materialize the reviewed finite allowlist, never strip arbitrary suffixes."""
    responses = {(r["request"]["idType"], r["request"]["idValue"], r["request"]["exchCode"]): r["response"] for r in records}
    codes = {r["证券代码"] for r in rows if r["披露范围"] == "all_disclosed_equity"}
    legacy = json.loads((ROOT / "config/stock-exposure-aliases.json").read_text(encoding="utf-8"))
    identities = []
    for code in (*TICKERS, "000660", "005930", "00700"):
        market = "kr" if code in ("000660", "005930") else "hk" if code == "00700" else "us"
        exchange = {"kr": "KS", "hk": "HK", "us": "US"}[market]
        ticker = "700" if code == "00700" else code
        response = responses[("TICKER", ticker, exchange)]
        if len(response.get("data", [])) != 1:
            raise ValueError(f"Ambiguous official identifier for {code}: {response}")
        identifier = response["data"][0]
        aliases = [code]
        if code in TICKERS:
            for suffix in ("US", "UW", "UN", "USEquity"):
                alias = code + suffix
                if alias not in codes:
                    continue
                mapped = responses[("TICKER", code, "US" if suffix == "USEquity" else suffix)].get("data", [])
                if len(mapped) != 1 or mapped[0]["compositeFIGI"] != identifier["compositeFIGI"]:
                    raise ValueError(f"Composite FIGI mismatch: {alias}")
                aliases.append(alias)
        elif code == "00700":
            # The ISIN also identifies Tencent's RMB counter; retain it as pending.
            aliases.extend(alias for alias in ("700", "700HK", "700HKEquity") if alias in codes)
        else:
            aliases.extend(alias for alias, target in legacy["stockCodeAliases"].items() if target == code)
        evidence = []
        for alias in aliases:
            samples = [r for r in rows if r["证券代码"] == alias and r["披露范围"] == "all_disclosed_equity"]
            if samples:
                sample = samples[0]
                evidence.append({
                    "alias": alias, "disclosedNames": sorted({r["证券名称"] for r in samples}),
                    "fundCode": sample["基金代码"], "reportName": sample["来源标题"],
                    "sourceUrl": sample["来源URL"], "page": sample["页码"],
                    "pdfSha256": sample["PDF_SHA256"],
                })
        identities.append({
            "code": code, "name": DISPLAY_NAMES[code], "market": market,
            "marketLabel": {"kr": "韩股", "hk": "港股", "us": "美股"}[market],
            "exchange": "KRX" if market == "kr" else "HKEX" if market == "hk" else "NYSE" if code in ("TSM", "GLW", "COHR") else "NASDAQ",
            "aliases": aliases,
            "nameAliases": list(dict.fromkeys([
                *legacy.get("stockAliases", {}).get(code, []),
                *(name for entry in evidence for name in entry["disclosedNames"] if len("".join(name.split())) >= 4),
            ])),
            "identityStatus": "verified", "compositeFIGI": identifier["compositeFIGI"],
            "shareClassFIGI": identifier["shareClassFIGI"], "securityType": identifier["securityType"],
            "evidence": evidence,
        })
    config = {
        "version": "security-identity-v1", "verifiedAt": "2026-09-05",
        "policy": "只归并有限白名单中由官方报告代码和名称、OpenFIGI 证券级标识共同核实的版本。GOOG/GOOGL、TSM/2330、ASML/ASMLNA、腾讯 ADR/港币柜台/未确定柜台的 ISIN 保持独立。未核实版本不参与别名合并。",
        "sources": ["https://www.openfigi.com/api/documentation", "https://api.openfigi.com/v3/mapping", "https://investor.nvidia.com/investor-resources/faqs/", "https://www.skhynix.com/ir/UI-FR-IR99/", "https://www.samsung.com/global/ir/stock-information/listing-Info/"],
        "securities": identities,
    }
    current_path = ROOT / "config/security-identities.json"
    if current_path.exists():
        current = json.loads(current_path.read_text(encoding="utf-8"))
        reviewed = {item["compositeFIGI"]: item for item in identities}
        for existing in current["securities"]:
            if existing["compositeFIGI"] in reviewed:
                fresh = reviewed[existing["compositeFIGI"]]
                fresh["code"] = existing["code"]
                fresh["aliases"] = list(existing["aliases"])
                fresh["nameAliases"] = list(dict.fromkeys([*fresh["nameAliases"], *existing["nameAliases"]]))
                fresh["evidence"] = list({entry["alias"]: entry for entry in [*existing["evidence"], *fresh["evidence"]]}.values())
            else:
                identities.append(existing)
        config["version"] = current["version"]
        config["policy"] = current["policy"]
        for field in ("contextualAliases", "disclosureAliases", "ambiguousCodes"):
            if field in current:
                config[field] = current[field]
    write_registry(config)


def main() -> None:
    rows = list(csv.DictReader((ROOT / "outputs/holdings_qdii_2026h1.csv").open(encoding="utf-8-sig")))
    codes = {row["证券代码"] for row in rows if row["披露范围"] == "all_disclosed_equity"}
    requests_to_make = []
    for ticker in TICKERS:
        for exchange in ("US", "UW", "UN"):
            if exchange == "US" or ticker + exchange in codes:
                requests_to_make.append({"idType": "TICKER", "idValue": ticker, "exchCode": exchange})
    requests_to_make.extend([
        {"idType": "TICKER", "idValue": "000660", "exchCode": "KS"},
        {"idType": "TICKER", "idValue": "005930", "exchCode": "KS"},
        {"idType": "TICKER", "idValue": "700", "exchCode": "HK"},
        {"idType": "ID_ISIN", "idValue": "KYG875721634", "exchCode": "HK"},
    ])
    records = []
    for offset in range(0, len(requests_to_make), 10):
        batch = requests_to_make[offset:offset + 10]
        response = requests.post("https://api.openfigi.com/v3/mapping", json=batch, timeout=40)
        if response.status_code == 429:
            time.sleep(15)
            response = requests.post("https://api.openfigi.com/v3/mapping", json=batch, timeout=40)
        response.raise_for_status()
        records.extend({"request": job, "response": result} for job, result in zip(batch, response.json(), strict=True))
        print(f"Verified response batch {offset // 10 + 1}: {len(records)} identifiers", flush=True)
    OUTPUT.mkdir(exist_ok=True)
    (OUTPUT / "identity-openfigi-responses.json").write_text(json.dumps({
        "checkedAt": "2026-09-05", "source": "https://api.openfigi.com/v3/mapping", "records": records,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_reviewed_registry(rows, records)


if __name__ == "__main__":
    main()
