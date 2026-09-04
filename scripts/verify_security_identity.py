"""Verify the published search summary against the complete portfolio package."""
from __future__ import annotations

import csv
import hashlib
import json
from collections import defaultdict
from pathlib import Path

from quarter_config import load_quarter_config
from security_identity import CONFIG, canonicalize_security_code


ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    quarter = load_quarter_config()
    data_dir = ROOT / "public/data"
    payload = json.loads(quarter.fund_stock_index_json.read_text(encoding="utf-8"))
    manifest = json.loads((data_dir / f"fund-portfolio-index-{quarter.slug}.manifest.json").read_text(encoding="utf-8"))
    stocks = {stock["code"]: stock for stock in payload["stocks"]}
    trading_overrides = {item["fundFamilyKey"]: item["isOnExchangeFund"] for item in json.loads((ROOT / "config/fund-trading-overrides.json").read_text(encoding="utf-8"))["funds"]}
    verified_fund_families = {}
    mismatches, key_securities = [], {}
    verified_codes = {item["code"] for item in CONFIG["securities"]}
    for code, stock in stocks.items():
        shard = json.loads((data_dir / manifest["shards"][code]["path"]).read_text(encoding="utf-8"))
        profiles = shard["fundProfiles"]
        for key, profile in profiles.items():
            if key in trading_overrides:
                if profile["isOnExchangeFund"] != trading_overrides[key]:
                    mismatches.append(f"{code}:{key}:fund_trading_classification")
                verified_fund_families[key] = profile["view"]
        on_exchange = sum(profile["isOnExchangeFund"] for profile in profiles.values())
        off_exchange = len(profiles) - on_exchange
        if (off_exchange, on_exchange) != (stock["offExchangeFundCount"], stock["portfolioOnExchangeFundCount"]):
            mismatches.append(code)
        if len({edge["fundFamilyKey"] for edge in shard["directEdges"]}) != len(shard["directEdges"]):
            mismatches.append(f"{code}:duplicate_direct_family")
        if code in verified_codes:
            key_securities[code] = {
                "name": stock["name"], "market": stock["market"], "aliases": stock["aliases"],
                "activeFundCount": stock["activeFundCount"], "offExchangeFundCount": off_exchange,
                "onExchangeFundCount": on_exchange, "directEdges": len(shard["directEdges"]),
                "indirectEdges": len(shard["indirectEdges"]),
            }
    for item in CONFIG["securities"]:
        for alias in item["aliases"]:
            if alias != item["code"] and alias in stocks:
                mismatches.append(f"{alias}:noncanonical_stock")
    source = ROOT / f"outputs/holdings_qdii_{quarter.year}h1.csv"
    grouped = defaultdict(list)
    for row in csv.DictReader(source.open(encoding="utf-8-sig")):
        if row["披露范围"] == "all_disclosed_equity":
            grouped[(row["基金代码"], canonicalize_security_code(row["证券代码"]))].append(row)
    collisions = [
        {"fundCode": fund_code, "stockCode": code, "rawCodes": sorted({row["证券代码"] for row in rows})}
        for (fund_code, code), rows in grouped.items()
        if len({row["证券代码"] for row in rows}) > 1
    ]
    result = {
        "releaseId": manifest["releaseId"], "stocksChecked": len(stocks), "countMismatches": mismatches,
        "verifiedSecurities": len(verified_codes), "sourceCsvSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "verifiedFundTradingFamilies": verified_fund_families,
        "sameFundDistinctAliasRows": collisions, "keySecurities": key_securities,
    }
    output = ROOT / "outputs/ui-ux-optimization-2026-09-05/identity-count-verification.json"
    output.parent.mkdir(exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if mismatches:
        raise ValueError(f"Security identity verification failed: {mismatches}")
    print(f"证券身份验证通过：{len(stocks)} 个证券摘要计数与组合一致；{len(verified_codes)} 个核实身份；原始同基金别名碰撞 {len(collisions)} 项。")


if __name__ == "__main__":
    main()
