"""Verify the published search summary against the complete portfolio package."""
from __future__ import annotations

import csv
import argparse
import hashlib
import json
from collections import defaultdict
from pathlib import Path

from quarter_config import load_quarter_config
from security_identity import CONFIG, disclosure_security_identity, security_identity
from build_fund_stock_index import disclosure_correction


ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=ROOT / "outputs/ui-ux-optimization-2026-09-05/identity-count-verification.json")
    args = parser.parse_args()
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
        identity = security_identity(code, stock["name"])
        if identity["name"] != stock["name"] or identity["code"] != code or shard["stock"] != {"code": code, "name": stock["name"]}:
            mismatches.append(f"{code}:canonical_metadata")
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
        if row["披露范围"] == "all_disclosed_equity" and not disclosure_correction(row, "excludedRows"):
            code = disclosure_security_identity(row["证券代码"], row["证券名称"], row["来源URL"])["code"]
            grouped[(row["基金代码"], code)].append(row)
    collisions = [
        {"fundCode": fund_code, "stockCode": code, "rawCodes": sorted({row["证券代码"] for row in rows})}
        for (fund_code, code), rows in grouped.items()
        if len({row["证券代码"] for row in rows}) > 1
    ]
    route_checks = []
    for collision in collisions:
        code, fund_code = collision["stockCode"], collision["fundCode"]
        if code not in manifest["shards"]:
            continue
        shard = json.loads((data_dir / manifest["shards"][code]["path"]).read_text(encoding="utf-8"))
        profile = next((item for item in shard["fundProfiles"].values() if fund_code in item["fundVariantCodes"]), None)
        if profile is None:
            continue
        edge = next((item for item in shard["directEdges"] if item["fundFamilyKey"] == profile["fundFamilyKey"]), None)
        if edge is None:
            continue
        expected = max(round(sum(float(row["占净值比例数值"]) * 100 for row in grouped.get((variant, code), [])), 2) for variant in profile["fundVariantCodes"])
        route_checks.append({**collision, "expectedRatioPercent": expected, "actualRatioPercent": edge["ratioPercent"]})
        if abs(expected - edge["ratioPercent"]) > 0.000001:
            mismatches.append(f"{code}:{fund_code}:disclosed_route_sum")
    result = {
        "releaseId": manifest["releaseId"], "stocksChecked": len(stocks), "countMismatches": mismatches,
        "verifiedSecurities": len(verified_codes), "sourceCsvSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "verifiedFundTradingFamilies": verified_fund_families,
        "sameFundDistinctAliasRows": collisions, "keySecurities": key_securities,
        "separateRouteRatioChecks": route_checks,
    }
    output = args.output
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if mismatches:
        raise ValueError(f"Security identity verification failed: {mismatches}")
    print(f"证券身份验证通过：{len(stocks)} 个证券摘要计数与组合一致；{len(verified_codes)} 个核实身份；原始同基金别名碰撞 {len(collisions)} 项。")


if __name__ == "__main__":
    main()
