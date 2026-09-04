from __future__ import annotations

import unittest

import build_fund_stock_index as builder
from security_identity import CONFIG, canonicalize_security_code, identity_key, security_identity
from test_build_fund_portfolio_index import fund, indirect


class SecurityIdentityTests(unittest.TestCase):
    def test_reviewed_aliases_have_one_owner_and_report_evidence(self):
        owners = {}
        for security in CONFIG["securities"]:
            self.assertTrue(security["compositeFIGI"])
            self.assertTrue(security["evidence"])
            for alias in security["aliases"]:
                key = identity_key(alias)
                self.assertNotIn(key, owners)
                owners[key] = security["code"]

    def test_nvidia_versions_merge_without_merging_distinct_securities(self):
        self.assertEqual({canonicalize_security_code(code) for code in ("NVDA", "NVDAUS", "NVDAUW", "NVDAUSEquity")}, {"NVDA"})
        for code in ("GOOG", "GOOGL", "ASMLNA", "2330", "TCEHYUV", "KYG875721634", "FAKEUS"):
            self.assertEqual(canonicalize_security_code(code), code)
        self.assertEqual(security_identity("000660", "SK 海力")["market"], "kr")
        self.assertEqual(security_identity("UNVERIFIEDUS")["identityStatus"], "pending")

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
