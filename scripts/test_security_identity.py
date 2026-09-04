from __future__ import annotations

import unittest
import hashlib
import json
import csv
from pathlib import Path

import build_fund_stock_index as builder
from security_identity import CONFIG, canonicalize_security_code, disclosure_security_identity, identity_key, security_identity
from test_build_fund_portfolio_index import fund, indirect


class SecurityIdentityTests(unittest.TestCase):
    def test_reviewed_aliases_have_one_owner_and_report_evidence(self):
        owners = {}
        for security in CONFIG["securities"]:
            self.assertTrue(security["compositeFIGI"])
            self.assertTrue(security["evidence"])
            for alias in security["aliases"]:
                key = identity_key(alias)
                if key in owners:
                    self.assertEqual(owners[key], security["code"])
                owners[key] = security["code"]

    def test_runtime_registry_and_content_revision_match_audited_registry(self):
        runtime = json.loads((Path(__file__).resolve().parents[1] / "config/security-identities.runtime.json").read_text(encoding="utf-8"))
        expected = [{key: item[key] for key in ("code", "name", "market", "marketLabel", "exchange", "aliases", "nameAliases", "identityStatus", "compositeFIGI")} for item in CONFIG["securities"]]
        self.assertEqual(runtime["securities"], expected)
        revision = runtime.pop("revision")
        calculated = hashlib.sha256(json.dumps(runtime, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()[:12]
        self.assertEqual(revision, calculated)
        self.assertEqual(CONFIG["revision"], revision)

    def test_nvidia_versions_merge_without_merging_distinct_securities(self):
        self.assertEqual({canonicalize_security_code(code) for code in ("NVDA", "NVDAUS", "NVDAUW", "NVDAUSEquity")}, {"NVDA"})
        for code in ("GOOG", "GOOGL", "2330", "TCEHYUV", "KYG875721634", "FAKEUS"):
            self.assertEqual(canonicalize_security_code(code), code)
        self.assertNotEqual(canonicalize_security_code("ASMLNA"), canonicalize_security_code("ASMLUS"))
        self.assertEqual(security_identity("000660", "SK 海力")["market"], "kr")
        self.assertEqual(security_identity("UNVERIFIEDUS")["identityStatus"], "pending")

    def test_punctuation_aliases_reach_the_builder_and_share_class_stays_distinct(self):
        for code in ("BRK/BUS", "BRK/BUN"):
            self.assertEqual(builder.canonical_stock_code(code, {}), canonicalize_security_code(code))
            self.assertNotEqual(builder.canonical_stock_code(code, {}), code)
        self.assertNotEqual(canonicalize_security_code("BRK/BUS"), canonicalize_security_code("BRK/AUS"))

    def test_actual_report_rows_separate_all_confirmed_cross_market_collisions(self):
        path = Path(__file__).resolve().parents[1] / "outputs/holdings_qdii_2026h1.csv"
        with path.open(encoding="utf-8-sig") as handle:
            rows = list(csv.DictReader(handle))
        for raw_code in ("ROP", "2883", "6088", "ASX", "BBY", "BG", "DTE", "PRU", "RIO", "SAN", "ASML"):
            resolved = [disclosure_security_identity(row["证券代码"], row["证券名称"], row["来源URL"]) for row in rows if row["证券代码"] == raw_code and row["披露范围"] == "all_disclosed_equity"]
            with self.subTest(raw_code=raw_code):
                self.assertGreaterEqual(len({item["code"] for item in resolved}), 2)
                self.assertGreaterEqual(len({item["marketLabel"] for item in resolved}), 2)
        san_rows = [row for row in rows if row["证券代码"] == "SAN" and row["基金代码"] == "006282"]
        holdings = [builder.make_holding_record(row) for row in san_rows]
        self.assertEqual({holding["stockCode"] for holding in holdings}, {"SAN"})
        self.assertEqual(len({holding["canonicalStockCode"] for holding in holdings}), 2)
        self.assertEqual(sorted(holding["ratioPercent"] for holding in holdings), [1.76, 2.9])
        for row in rows:
            if row["证券代码"] == "ASML":
                identity = disclosure_security_identity("ASML", row["证券名称"], row["来源URL"])
                self.assertEqual(identity["marketLabel"], "荷兰股" if row["基金代码"] == "006282" else "美股")

    def test_existing_indirect_targets_survive_identity_migrations(self):
        config = builder.load_exposure_aliases()
        stocks = {item["code"]: item for item in json.loads(builder.TARGET_JSON.read_text(encoding="utf-8"))["stocks"]}
        targets = set(config["stockAliases"]) | set(config["stockCodeAliases"].values()) | {item["targetCode"] for item in config["knownProducts"]}
        self.assertEqual(sorted(targets - stocks.keys()), [])
        for target in targets:
            self.assertEqual(security_identity(target)["identityStatus"], "verified", target)
        self.assertNotIn("ASML", config["stockAliases"])
        products = builder.configured_known_products(config)
        for source_code in ("ASMU", ""):
            match = builder.match_indirect_target(source_code, "Direxion Daily ASML Bull 2X ETF", stocks, [], products)
            self.assertIsNotNone(match)
            self.assertEqual(match[0], "ASMLUS")
            self.assertEqual(stocks[match[0]]["market"], "us")
            self.assertNotEqual(match[0], "ASML.NA")
        self.assertEqual(canonicalize_security_code("AMZNUS"), "AMZN")
        match = builder.match_indirect_target("AMZU", "Direxion Daily AMZN Bull 2X ETF", stocks, [], products)
        self.assertEqual(match[0], "AMZN")
        self.assertEqual(security_identity(match[0])["market"], "us")

    def test_verified_page_continuations_are_flagged_and_numbers_restored_without_changing_raw_identity(self):
        path = Path(__file__).resolve().parents[1] / "outputs/holdings_qdii_2026h1.csv"
        with path.open(encoding="utf-8-sig") as handle:
            rows = {builder.disclosure_correction_key(row): row for row in csv.DictReader(handle)}
        for correction in builder.DISCLOSURE_CORRECTIONS["excludedRows"]:
            original = rows[builder.configured_correction_key(correction)]
            for fund_code in (original["基金代码"], "999999"):
                holding = builder.make_holding_record({**original, "基金代码": fund_code})
                self.assertEqual(holding["parseStatus"], "pending")
                self.assertEqual(holding["stockCode"], correction["rawCode"])
                self.assertEqual(holding["stockName"], correction["rawName"])
            self.assertIsNone(builder.disclosure_correction({**original, "页码": str(correction["sourcePage"] + 1)}, "excludedRows"))
        for correction in builder.DISCLOSURE_CORRECTIONS["correctedRows"]:
            original = rows[builder.configured_correction_key(correction)]
            holding = builder.make_holding_record(original)
            self.assertNotIn("parseStatus", holding)
            self.assertEqual(holding["stockCode"], correction["rawCode"])
            self.assertEqual(holding["stockName"], correction["rawName"])
            self.assertEqual(holding["ratioPercent"], round(float(original["占净值比例数值"]) * 100, 2))
            for field in ("marketValueWan", "sharesWan"):
                if field in correction:
                    self.assertEqual(holding[field], round(correction[field], 2))

    def test_search_counts_equal_eligible_portfolio_family_union(self):
        active_a = fund("A", 0.1)
        active_c = fund("C", 0.1)
        off_index = fund("A", 0.2, code="000003", name="全球科技指数", fund_type="指数型")
        on_etf = fund("A", 0.3, code="000004", name="全球科技ETF", fund_type="指数型")
        zero = fund("A", 0.0, code="000005", name="无有效占比混合")
        indirect_same = indirect("A", "NVDL", 4.0, target_code="NVDA")
        indirect_only = indirect("A", "NVDU", 6.0, target_code="NVDA", code="000006", name="其他混合")
        direct = {"NVDA": [active_a, active_c, off_index, on_etf, zero]}
        candidates = {"NVDA": [indirect_same, indirect_only]}
        profiles = builder.build_portfolio_profile_registry(direct, candidates)
        count = builder.portfolio_stock_family_counts("NVDA", direct["NVDA"], candidates["NVDA"], profiles)
        _, shards = builder.build_portfolio_release(report="2026Q2", generated_at="2026-09-05", stock_rows={"NVDA": {"code": "NVDA", "name": "英伟达"}}, direct_funds=direct, indirect_candidates=candidates, cutoff_date="2026-06-30")
        shard = shards["NVDA"]
        self.assertEqual(count["researchFundCount"], len(shard["fundProfiles"]))
        self.assertEqual(count["offExchangeFundCount"], 3)
        self.assertEqual(count["portfolioOnExchangeFundCount"], 1)
        self.assertEqual(len([edge for edge in shard["directEdges"] if edge["fundFamilyKey"] == builder.fund_family_key(active_a)]), 1)
        self.assertEqual(next(edge["ratioPercent"] for edge in shard["directEdges"] if edge["fundFamilyKey"] == builder.fund_family_key(active_a)), 10.0)

    def test_separate_disclosed_routes_sum_only_inside_one_fund_report(self):
        def row(code, ratio, fund_code="159742", source="https://official.example/report.pdf"):
            return {"证券代码": code, "证券名称": "腾讯控股", "基金代码": fund_code, "基金名称": "测试科技ETF", "基金类型": "QDII", "截止日期": "2026-06-30", "披露范围": "all_disclosed_equity", "来源URL": source, "占净值比例数值": str(ratio), "持仓市值(万元)": "10", "持股数(万股)": "1"}
        records = builder.combine_verified_disclosure_aliases([
            row("00700", 0.0785), row("700HK", 0.0016), row("700HK", 0.0016),
            row("00700", 0.0801, fund_code="159743"),
            row("700HK", 0.10, source="https://official.example/another.pdf"),
        ], "00700")
        self.assertEqual(len(records), 3)
        self.assertEqual(sorted(record["ratio"] for record in records), [0.0801, 0.0801, 0.1])
        self.assertEqual(sum(record["ratio"] == 0.0801 for record in records), 2)

    def test_reit_investment_funds_are_not_listed_reits(self):
        cases = [
            ("070031", "嘉实全球房地产(QDII)", "QDII-REITs"),
            ("005613", "摩根富时发达市场REITs指数(QDII)人民币A", "指数型-海外股票"),
            ("320017", "诺安全球收益不动产(QDII)A", "QDII-REITs"),
            ("206011", "鹏华美国房地产(QDII)", "QDII-REITs"),
            ("019495", "摩根富时发达市场REITs指数(QDII)人民币C", "指数型-海外股票"),
            ("027794", "诺安全球收益不动产(QDII)C", "QDII-REITs"),
            ("006283", "鹏华美国房地产美元现汇", "QDII-REITs"),
        ]
        for code, name, fund_type in cases:
            with self.subTest(code=code):
                self.assertFalse(builder.is_on_exchange_fund({"fundCode": code, "fundName": name, "fundType": fund_type}))
        self.assertTrue(builder.is_on_exchange_fund({"fundCode": "508000", "fundName": "华安张江产业园REIT", "fundType": "REITs"}))
        self.assertTrue(builder.is_on_exchange_fund({"fundCode": "999999", "fundName": "其他房地产ETF", "fundType": "指数型"}))


if __name__ == "__main__":
    unittest.main()
