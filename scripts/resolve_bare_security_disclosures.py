"""Resolve bare tickers by the market printed in that exact official report row."""
from __future__ import annotations

import argparse
import csv
import json
import re
import time
from collections import Counter, defaultdict
from pathlib import Path

import requests

from expand_security_identity_registry import write_registry

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "outputs/research-flow-2026-09-05/identity"
MARKETS = {"us": ("US", "us", "美股", "美国"), "hk": ("HK", "hk", "港股", "HKEX"), "a": ("CH", "a", "A股", "中国内地"), "tw": ("TT", "other", "台股", "TWSE"), "jp": ("JP", "jp", "日股", "日本交易所"), "ch": ("SW", "other", "瑞士股", "SIX"), "au": ("AU", "other", "澳股", "ASX"), "gb": ("LN", "other", "英股", "LSE"), "de": ("GY", "other", "德股", "德国"), "fr": ("FP", "other", "法股", "巴黎"), "es": ("SM", "other", "西班牙股", "西班牙"), "at": ("AV", "other", "奥地利股", "维也纳"), "nl": ("NA", "other", "荷兰股", "阿姆斯特丹"), "ca": ("CN", "other", "加股", "加拿大"), "se": ("SS", "other", "瑞典股", "斯德哥尔摩"), "it": ("IM", "other", "意大利股", "米兰")}


def source_key(row):
    return (row["证券代码"], row["证券名称"], row["来源URL"])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    rows = [row for row in csv.DictReader((ROOT / "outputs/holdings_qdii_2026h1.csv").open(encoding="utf-8-sig")) if row["披露范围"] == "all_disclosed_equity"]
    rows_by_key = {source_key(row): row for row in rows}
    market_audit = json.loads((OUTPUT / "bare-security-market-evidence.json").read_text(encoding="utf-8"))
    row_markets = {}
    for report in market_audit["reports"]:
        for row in report["rows"]:
            if len(row["markets"]) == 1:
                row_markets[(row["code"], row["name"], report["sourceUrl"])] = row["markets"][0]
    # These exact rows were independently inspected because their market cells
    # precede the code in the PDF text order. No fuzzy company-name rule is used.
    reviewed_overrides = {("378006", "2883", "凯基金融"): "tw", ("007280", "6088", "SIGMAXYZ HOLDINGS INC"): "jp", ("007729", "GOOGL", "谷歌 (Alphabet)"): "us", ("012060", "GOOGL", "谷歌 (Alphabet)"): "us", ("159513", "GOOGL", "Alphab"): "us", ("377016", "2330", "台湾集成电路制造股份有限公司"): "tw", ("501226", "AMZN", "亚马逊"): "us"}
    for row in rows:
        if market := reviewed_overrides.get((row["基金代码"], row["证券代码"], row["证券名称"])):
            row_markets[source_key(row)] = market
    jobs = {}
    for key, market in row_markets.items():
        ticker = str(int(key[0])) if market == "hk" and key[0].isdigit() else key[0]
        jobs[key] = {"idType": "TICKER", "idValue": ticker, "exchCode": MARKETS[market][0]}
    cache_path = OUTPUT / "bare-market-identifier-evidence.json"
    records = {}
    for path in [OUTPUT / "openfigi-expansion-evidence.json", OUTPUT / "bare-code-separated-identifiers.json", OUTPUT / "taiwan-2330-evidence.json", cache_path]:
        if path.exists():
            for item in json.loads(path.read_text(encoding="utf-8"))["records"]:
                records[json.dumps(item["request"], sort_keys=True)] = item
    unique = {json.dumps(job, sort_keys=True): job for job in jobs.values()}
    missing = [job for key, job in unique.items() if key not in records]
    print(f"Explicit report markets {len(jobs)} rows; new identifier requests {len(missing)}", flush=True)
    for offset in range(0, len(missing), 10):
        start = time.monotonic()
        batch = missing[offset:offset + 10]
        response = requests.post("https://api.openfigi.com/v3/mapping", json=batch, timeout=40)
        if response.status_code == 429:
            time.sleep(15)
            response = requests.post("https://api.openfigi.com/v3/mapping", json=batch, timeout=40)
        response.raise_for_status()
        for job, result in zip(batch, response.json(), strict=True):
            records[json.dumps(job, sort_keys=True)] = {"request": job, "response": result}
        cache_path.write_text(json.dumps({"checkedAt": "2026-09-05", "source": "https://api.openfigi.com/v3/mapping", "records": [records[key] for key in unique if key in records]}, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        print(f"Bare identifier requests {min(offset + 10, len(missing))}/{len(missing)}", flush=True)
        time.sleep(max(0, 2.5 - (time.monotonic() - start)))
    resolved, gaps = {}, []
    for key, job in jobs.items():
        data = records[json.dumps(job, sort_keys=True)]["response"].get("data", [])
        composites = {item.get("compositeFIGI") for item in data}
        if len(composites) != 1 or None in composites:
            gaps.append({"rawCode": key[0], "rawName": key[1], "sourceUrl": key[2], "reason": "identifier_missing_or_ambiguous"})
        else:
            resolved[key] = data[0]
    config = json.loads((ROOT / "config/security-identities.json").read_text(encoding="utf-8"))
    items = {item["compositeFIGI"]: item for item in config["securities"]}
    groups = defaultdict(list)
    code_figis = defaultdict(set)
    for key, identifier in resolved.items():
        groups[identifier["compositeFIGI"]].append(key)
        code_figis[key[0]].add(identifier["compositeFIGI"])
    ambiguous_codes = {code for code, figis in code_figis.items() if len(figis) > 1}
    all_source_keys = defaultdict(set)
    for row in rows:
        all_source_keys[row["证券代码"]].add(source_key(row))
    globally_safe = {code for code, figis in code_figis.items() if len(figis) == 1 and all_source_keys[code].issubset(resolved)}
    # Remove bare aliases whose reports disagree or whose market is unproven.
    reviewed_codes = {row["code"] for report in market_audit["reports"] for row in report["rows"]}
    for item in items.values():
        source_markets = {row_markets[key] for key in groups.get(item["compositeFIGI"], [])}
        suffix = MARKETS[next(iter(source_markets))][0] if len(source_markets) == 1 else {"us": "US", "hk": "HK", "a": "CH", "kr": "KS", "jp": "JP"}.get(item["market"], {"SIX": "SW", "TWSE": "TT", "ASX": "AU", "LSE": "LN"}.get(item["exchange"], "UNVERIFIED"))
        if re.search(r"[^A-Za-z0-9./-]", item["code"]):
            previous_code = item["code"]
            item["code"] = previous_code.split(".", 1)[0] + "." + suffix
            item["aliases"] = [item["code"], *(alias for alias in item["aliases"] if alias != previous_code)]
        unsafe = [alias for alias in item["aliases"] if alias in reviewed_codes and (alias not in globally_safe or item["compositeFIGI"] not in code_figis.get(alias, set()))]
        if item["code"] in unsafe:
            alternatives = [alias for alias in item["aliases"] if alias not in unsafe]
            item["code"] = next((alias for alias in alternatives if re.search(r"(?:US|HK|CH)$", alias)), alternatives[0] if alternatives else item["code"] + "." + suffix)
        item["aliases"] = list(dict.fromkeys([item["code"], *(alias for alias in item["aliases"] if alias not in unsafe)]))
    for figi, keys in groups.items():
        first = keys[0]
        market = row_markets[first]
        exchange_code, bucket, label, exchange = MARKETS[market]
        if figi not in items:
            identifier = resolved[first]
            canonical = first[0].zfill(5) if market == "hk" else first[0]
            if canonical not in globally_safe or any(other["code"] == canonical for other in items.values()):
                canonical = first[0] + "." + exchange_code
            names = Counter(key[1] for key in keys)
            name = max(names, key=lambda name: (bool(re.search(r"[\u4e00-\u9fff]", name)), names[name], len(name)))
            sample = rows_by_key[first]
            items[figi] = {"code": canonical, "name": name, "market": bucket, "marketLabel": label, "exchange": exchange, "identityStatus": "verified", "aliases": [canonical], "nameAliases": sorted(names), "compositeFIGI": figi, "shareClassFIGI": identifier["shareClassFIGI"], "securityType": identifier["securityType"], "evidence": [{"alias": first[0], "disclosedNames": sorted(names), "fundCode": sample["基金代码"], "reportName": sample["来源标题"], "sourceUrl": sample["来源URL"], "page": sample["页码"], "pdfSha256": sample["PDF_SHA256"], "identifierEvidence": "bare-market-identifier-evidence-2026-09-05.json"}]}
        item = items[figi]
        safe_codes = {key[0] for key in keys if key[0] in globally_safe}
        preferred = resolved[first]["ticker"].zfill(5) if market == "hk" else resolved[first]["ticker"]
        if (preferred in safe_codes or (market == "hk" and str(int(preferred)) in safe_codes)) and not any(other["code"] == preferred for other_figi, other in items.items() if other_figi != figi):
            item["code"] = preferred
            item["aliases"] = list(dict.fromkeys([preferred, *item["aliases"]]))
        for key in keys:
            if key[0] in globally_safe and key[0] not in item["aliases"]:
                item["aliases"].append(key[0])
        item["nameAliases"] = sorted(set([*item["nameAliases"], *(key[1] for key in keys)]))
    disclosures = [{"rawCode": key[0], "rawName": key[1], "sourceUrl": key[2], "code": items[identifier["compositeFIGI"]]["code"]} for key, identifier in resolved.items()]
    name_targets = defaultdict(set)
    for item in disclosures:
        name_targets[(item["rawCode"], item["rawName"])].add(item["code"])
    keys_by_name = defaultdict(set)
    for row in rows:
        keys_by_name[(row["证券代码"], row["证券名称"])].add(source_key(row))
    contexts = [{"rawCode": key[0], "rawName": key[1], "code": next(iter(targets))} for key, targets in name_targets.items() if len(targets) == 1 and keys_by_name[key].issubset(resolved)]
    config["securities"] = list(items.values())
    config["contextualAliases"] = contexts
    config["disclosureAliases"] = disclosures
    config["ambiguousCodes"] = sorted(ambiguous_codes)
    owners = {}
    for item in items.values():
        for alias in [item["code"], *item["aliases"]]:
            key = re.sub(r"[^A-Z0-9]", "", alias.upper())
            owner = (item["code"], item["compositeFIGI"], item["market"])
            if key in owners and owners[key] != owner:
                raise ValueError(f"Alias collision after disclosure resolution: {alias}")
            owners[key] = owner
    summary = {"resolvedReportRows": len(disclosures), "contextualAliases": len(contexts), "globallySafeBareCodes": len(globally_safe), "ambiguousCodes": sorted(ambiguous_codes), "identifierGaps": gaps, "conflicts": {code: [{"code": items[figi]["code"], "name": items[figi]["name"], "market": items[figi]["marketLabel"], "compositeFIGI": figi} for figi in sorted(figis)] for code, figis in code_figis.items() if len(figis) > 1}}
    (OUTPUT / "bare-market-resolution-audit.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.apply:
        write_registry(config)
        (ROOT / "docs/bare-market-identifier-evidence-2026-09-05.json").write_bytes(cache_path.read_bytes())
        (ROOT / "docs/bare-security-market-evidence-2026-09-05.json").write_bytes((OUTPUT / "bare-security-market-evidence.json").read_bytes())
    print(json.dumps({key: value for key, value in summary.items() if key not in ("conflicts", "identifierGaps")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
