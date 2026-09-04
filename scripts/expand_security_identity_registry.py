"""Materialize evidence-checked disclosure aliases from the recorded FIGI audit.

Names are only used to reject ambiguous bare tickers; they never join securities.
Market-qualified aliases are joined exclusively by country composite FIGI.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "outputs/research-flow-2026-09-05/identity"
ALLOWED_TYPES = {"Common Stock", "ADR", "REIT", "Tracking Stk", "NY Reg Shrs"}


def name_key(name: str) -> str:
    value = re.sub(r"[^A-Z0-9\u4e00-\u9fff]", "", unicodedata.normalize("NFKC", name).upper())
    for suffix in ("CORPORATION", "INCORPORATED", "COMPANY", "LIMITED", "PUBLIC", "CORP", "INC", "PLC", "LTD", "股份有限公司", "有限责任公司", "有限公司", "股份公司", "公司"):
        value = value.replace(suffix, "")
    if value.endswith("公"):
        value = value[:-1]
    return value


def compatible_name(name: str, known: set[str]) -> bool:
    key = name_key(name)
    if len(key) < 2:
        return False
    for target in known:
        if key == target:
            return True
        # Original PDF extraction contains short, visibly truncated company names.
        # A bare ticker still needs every disclosed name to agree with its own
        # market-qualified counterpart; unrelated names reject the entire alias.
        chinese = bool(re.search(r"[\u4e00-\u9fff]", key))
        minimum = 3 if chinese else 5
        if min(len(key), len(target)) >= minimum and (key in target or target in key):
            if min(len(key), len(target)) / max(len(key), len(target)) >= (0.25 if chinese else 0.2):
                return True
    return False


def write_registry(config: dict) -> None:
    runtime = {"version": config["version"], "contextualAliases": config.get("contextualAliases", []), "securities": [{key: item[key] for key in ("code", "name", "market", "marketLabel", "exchange", "aliases", "nameAliases", "identityStatus", "compositeFIGI")} for item in config["securities"]]}
    revision = hashlib.sha256(json.dumps(runtime, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()[:12]
    config["revision"] = revision
    runtime["revision"] = revision
    (ROOT / "config/security-identities.json").write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ROOT / "config/security-identities.runtime.json").write_text(json.dumps(runtime, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    evidence = json.loads((OUTPUT / "openfigi-expansion-evidence.json").read_text(encoding="utf-8"))
    responses = {json.dumps(item["request"], sort_keys=True): item["response"] for item in evidence["records"]}
    config = json.loads((ROOT / "config/security-identities.json").read_text(encoding="utf-8"))
    original = {item["compositeFIGI"]: item for item in config["securities"]}
    original_owners = {re.sub(r"[^A-Z0-9]", "", code.upper()): item["code"] for item in config["securities"] for code in item["aliases"]}
    stocks = {stock["code"]: stock for stock in json.loads((ROOT / "public/data/fund-stock-index-2026q2.json").read_text(encoding="utf-8"))["stocks"]}
    rows_by_code = defaultdict(list)
    for source in (ROOT / "outputs/holdings_stock_2026q2.csv", ROOT / "outputs/holdings_qdii_2026h1.csv"):
        for row in csv.DictReader(source.open(encoding="utf-8-sig")):
            if source.name.startswith("holdings_qdii") and row["披露范围"] != "all_disclosed_equity":
                continue
            if source.name.startswith("holdings_stock") and "QDII" in (row.get("基金类型", "") + row.get("基金名称", "")).upper():
                continue
            rows_by_code[row["证券代码"].strip()].append(row)
    groups = defaultdict(list)
    pending = []
    disclosed_tickers = {job["idValue"].upper() for job in evidence["candidates"].values() if job["idType"] == "TICKER"}
    for code, job in evidence["candidates"].items():
        if job["idType"] == "TICKER" and code.upper() in disclosed_tickers and code.upper() != job["idValue"].upper():
            # TMUS / RUN are themselves tickers, not necessarily TM US / R UN.
            # Their own qualified counterparts are handled by the bare-code gate.
            pending.append({"code": code, "reason": "natural_ticker_suffix_requires_bare_name_check"})
            continue
        result = responses.get(json.dumps(job, sort_keys=True))
        if result is None:
            pending.append({"code": code, "reason": "mapping_not_fetched"})
            continue
        data = result.get("data", [])
        composites = {item.get("compositeFIGI") for item in data}
        if len(composites) != 1 or None in composites or any(item.get("securityType") not in ALLOWED_TYPES for item in data):
            pending.append({"code": code, "reason": "mapping_missing_ambiguous_or_non_equity"})
            continue
        if not rows_by_code[code]:
            pending.append({"code": code, "reason": "no_disclosure_row"})
            continue
        groups[data[0]["compositeFIGI"]].append((code, job, data[0]))
    updated = dict(original)
    ambiguous_bare = []
    contextual_aliases = []
    for composite, candidates in groups.items():
        markets = {"hk" if job["exchCode"] == "HK" else "a" if job["exchCode"] == "CH" else "us" for _, job, _ in candidates}
        if len(markets) != 1 or (composite in original and original[composite]["market"] not in markets):
            pending.extend({"code": code, "reason": "cross_market_identity_conflict"} for code, _, _ in candidates)
            continue
        if composite in original:
            item = dict(original[composite])
            market = item["market"]
            canonical = item["code"]
        else:
            exchange_code = candidates[0][1]["exchCode"]
            market = "hk" if exchange_code == "HK" else "a" if exchange_code == "CH" else "us"
            identifier = candidates[0][2]
            base = identifier["ticker"]
            canonical = base.zfill(5) if market == "hk" else base
            item = {}
        names = [row["证券名称"].strip() for code, _, _ in candidates for row in rows_by_code[code] if row["证券名称"].strip()]
        known_names = {name_key(name) for name in [*names, *(identifier["name"] for _, _, identifier in candidates)] if name_key(name)}
        aliases = list(item.get("aliases", []))
        aliases.extend(code for code, _, _ in candidates)
        bare_candidates = {canonical}
        if market == "hk":
            bare_candidates.add(str(int(canonical)))
        for bare in bare_candidates:
            disclosed = {row["证券名称"].strip() for row in rows_by_code.get(bare, [])}
            compatible = bool(disclosed) and all(compatible_name(name, known_names) for name in disclosed)
            if bare not in aliases and disclosed and not compatible:
                ambiguous_bare.append({"code": bare, "candidateCompositeFIGI": composite, "disclosedNames": sorted(disclosed), "reason": "bare_code_names_not_all_consistent"})
                if bare == canonical and not item:
                    canonical = next((code for code, job, _ in candidates if job["idType"] == "TICKER" and job["exchCode"] == {"us": "US", "hk": "HK", "a": "CH"}[market]), candidates[0][0])
            elif compatible:
                aliases.append(bare)
                names.extend(disclosed)
        aliases.append(canonical)
        aliases = list(dict.fromkeys(aliases))
        if any((owner := original_owners.get(re.sub(r"[^A-Z0-9]", "", alias.upper()))) and owner != canonical for alias in aliases):
            pending.extend({"code": code, "reason": "existing_identity_collision"} for code, _, _ in candidates)
            continue
        if not item:
            counts = Counter(names)
            chinese = [name for name in counts if re.search(r"[\u4e00-\u9fff]", name)]
            display = max(chinese or list(counts), key=lambda name: (counts[name], len(name)))
            display = re.sub(r"(?<=[\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])", "", display)
            item = {"code": canonical, "name": display, "market": market, "marketLabel": {"us": "美股", "hk": "港股", "a": "A股"}[market], "exchange": {"hk": "HKEX", "a": "中国内地"}.get(market, "美国"), "identityStatus": "verified", "compositeFIGI": composite, "shareClassFIGI": candidates[0][2]["shareClassFIGI"], "securityType": candidates[0][2]["securityType"]}
        item["aliases"] = aliases
        item["nameAliases"] = sorted(set([*item.get("nameAliases", []), *names, *(identifier["name"] for _, _, identifier in candidates)]))
        by_alias = {entry["alias"]: entry for entry in item.get("evidence", [])}
        for alias in aliases:
            if alias in by_alias or not rows_by_code.get(alias):
                continue
            row = rows_by_code[alias][0]
            by_alias[alias] = {"alias": alias, "disclosedNames": sorted({r["证券名称"].strip() for r in rows_by_code[alias]}), "fundCode": row["基金代码"], "reportName": row.get("来源标题", ""), "sourceUrl": row.get("来源URL", ""), "page": row.get("页码", ""), "pdfSha256": row.get("PDF_SHA256", ""), "identifierEvidence": "openfigi-expansion-evidence-2026-09-05.json"}
        item["evidence"] = list(by_alias.values())
        updated[composite] = item
        contextual_targets = {"ROP": "us", "2883": "hk", "6088": "hk", "ASX": "us"}
        for bare, expected_market in contextual_targets.items():
            if market != expected_market or bare not in bare_candidates:
                continue
            for raw_name in sorted({row["证券名称"] for row in rows_by_code[bare]}):
                if compatible_name(raw_name, known_names):
                    contextual_aliases.append({"rawCode": bare, "rawName": raw_name, "code": canonical})
    separated_path = OUTPUT / "bare-code-separated-identifiers.json"
    if separated_path.exists():
        separated = json.loads(separated_path.read_text(encoding="utf-8"))
        specs = {"ROP": ("ROCHE HOLDING AG", "other", "瑞士股", "SIX"), "2883": ("凯基金融", "other", "台股", "TWSE"), "6088": ("SIGMAXYZ HOLDINGS INC", "jp", "日股", "日本交易所"), "ASX": ("ASX LTD", "other", "澳股", "ASX")}
        for record in separated["records"]:
            code = record["request"]["idValue"]
            data = record["response"].get("data", [])
            if len(data) != 1:
                raise ValueError(f"Ambiguous separated security identifier: {code}")
            identifier = data[0]
            raw_name, market, label, exchange = specs[code]
            samples = [row for row in rows_by_code[code] if row["证券名称"] == raw_name]
            if not samples:
                raise ValueError(f"Missing separated source disclosure: {code}")
            row = samples[0]
            updated[identifier["compositeFIGI"]] = {"code": code, "name": raw_name, "market": market, "marketLabel": label, "exchange": exchange, "identityStatus": "verified", "aliases": [code], "nameAliases": [raw_name, identifier["name"]], "compositeFIGI": identifier["compositeFIGI"], "shareClassFIGI": identifier["shareClassFIGI"], "securityType": identifier["securityType"], "evidence": [{"alias": code, "disclosedNames": [raw_name], "fundCode": row["基金代码"], "reportName": row["来源标题"], "sourceUrl": row["来源URL"], "page": row["页码"], "pdfSha256": row["PDF_SHA256"], "identifierEvidence": "bare-code-separated-identifiers-2026-09-05.json"}]}
    taiwan_path = OUTPUT / "taiwan-2330-evidence.json"
    if taiwan_path.exists():
        taiwan = json.loads(taiwan_path.read_text(encoding="utf-8"))
        mapped = [record["response"].get("data", []) for record in taiwan["records"]]
        if any(len(data) != 1 or data[0]["compositeFIGI"] != "BBG000BN2HR7" for data in mapped):
            raise ValueError("Taiwan TSMC identifier evidence is missing or ambiguous")
        identifier = mapped[0][0]
        aliases = ["2330", "2330TT"]
        report_evidence = []
        for alias in aliases:
            samples = rows_by_code[alias]
            if not samples:
                raise ValueError(f"Missing Taiwan TSMC disclosure: {alias}")
            row = samples[0]
            report_evidence.append({"alias": alias, "disclosedNames": sorted({r["证券名称"] for r in samples}), "fundCode": row["基金代码"], "reportName": row["来源标题"], "sourceUrl": row["来源URL"], "page": row["页码"], "pdfSha256": row["PDF_SHA256"], "identifierEvidence": "taiwan-2330-evidence-2026-09-05.json"})
        updated[identifier["compositeFIGI"]] = {"code": "2330", "name": "台积电 TSMC（台湾普通股）", "market": "other", "marketLabel": "台股", "exchange": "TWSE", "identityStatus": "verified", "aliases": aliases, "nameAliases": sorted({"台积电", "TSMC", *(name for item in report_evidence for name in item["disclosedNames"])}), "compositeFIGI": identifier["compositeFIGI"], "shareClassFIGI": identifier["shareClassFIGI"], "securityType": identifier["securityType"], "evidence": report_evidence}
    config["securities"] = list(updated.values())
    config["contextualAliases"] = contextual_aliases
    config["version"] = "security-identity-v2"
    config["policy"] = "按官方披露代码与 OpenFIGI country composite FIGI 归并有证据的同一证券。裸代码须逐个披露名称通过交叉核对；名称只用于拒绝冲突，不作为跨证券合并依据。不同市场、股份类别、ADR 和未确定柜台的 ISIN 保持独立；原始披露行完整保留。"
    config["sources"] = list(dict.fromkeys([*config["sources"], "https://investor.tsmc.com/english/fundamentals"]))
    owners = {}
    for item in config["securities"]:
        for alias in item["aliases"]:
            key = re.sub(r"[^A-Z0-9]", "", alias.upper())
            if key in owners and owners[key] != item["code"]:
                raise ValueError(f"Conflicting alias {alias}: {owners[key]} / {item['code']}")
            owners[key] = item["code"]
    summary = {"beforeStocks": len(stocks), "verifiedIdentities": len(updated), "verifiedAliases": len(owners), "verifiedMarkets": dict(Counter(item["market"] for item in updated.values())), "pendingMapping": pending, "ambiguousBareCodes": ambiguous_bare, "canonicalCodes": {code: owners.get(re.sub(r"[^A-Z0-9]", "", code.upper()), code) for code in stocks}}
    (OUTPUT / "registry-expansion-audit.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if args.apply:
        if any(item["reason"] == "mapping_not_fetched" for item in pending):
            raise ValueError("Fetch all candidate evidence before applying the registry")
        write_registry(config)
        (ROOT / "docs/openfigi-expansion-evidence-2026-09-05.json").write_text(json.dumps(evidence, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        suffix_evidence = OUTPUT / "hk-disclosure-suffix-evidence.json"
        if suffix_evidence.exists():
            (ROOT / "docs/hk-disclosure-suffix-evidence-2026-09-05.json").write_bytes(suffix_evidence.read_bytes())
        if taiwan_path.exists():
            (ROOT / "docs/taiwan-2330-evidence-2026-09-05.json").write_bytes(taiwan_path.read_bytes())
        if separated_path.exists():
            (ROOT / "docs/bare-code-separated-identifiers-2026-09-05.json").write_bytes(separated_path.read_bytes())
    print(json.dumps({key: value for key, value in summary.items() if key not in ("pendingMapping", "ambiguousBareCodes", "canonicalCodes")}, ensure_ascii=False))
    print(f"Pending mappings {len(pending)}; ambiguous bare codes {len(ambiguous_bare)}")


if __name__ == "__main__":
    main()
