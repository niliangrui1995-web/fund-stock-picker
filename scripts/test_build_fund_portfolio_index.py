from __future__ import annotations

import copy
import csv
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import build_fund_stock_index as index_builder
from build_fund_stock_index import (
    build_portfolio_release,
    json_utf8_bytes,
    portfolio_detail_shard_prefix,
    sha256_bytes,
    validate_portfolio_release,
    write_portfolio_release,
)


def fund(
    suffix: str,
    ratio: float,
    *,
    code: str | None = None,
    name: str = "全球科技混合",
    fund_type: str = "混合型",
) -> dict[str, object]:
    return {
        "fundCode": code or ("000001" if suffix == "A" else "000002"),
        "fundName": f"{name}{suffix}",
        "fundType": fund_type,
        "ratio": ratio,
        "ratioPercent": round(ratio * 100, 2),
        "marketValueWan": 100.0,
        "cutoffDate": "2026-06-30",
    }


def indirect(
    suffix: str,
    source_code: str,
    estimated_ratio_percent: float,
    *,
    target_code: str = "000660",
    leverage_multiple: float | None = 2.0,
    code: str | None = None,
    name: str = "全球科技混合",
    fund_type: str = "混合型",
) -> dict[str, object]:
    ratio = estimated_ratio_percent / 100 / (leverage_multiple or 1)
    result = fund(suffix, ratio, code=code, name=name, fund_type=fund_type)
    result.update(
        {
            "targetCode": target_code,
            "targetName": "SK海力士" if target_code == "000660" else "三星电子",
            "sourceCode": source_code,
            "sourceName": f"{source_code} leveraged product",
            "leverageMultiple": leverage_multiple,
            "estimatedRatio": estimated_ratio_percent / 100,
            "estimatedRatioPercent": estimated_ratio_percent,
            "matchReason": f"known product {source_code}",
        }
    )
    return result


class PortfolioReleaseTests(unittest.TestCase):
    def build_release(self, **overrides: object):
        defaults: dict[str, object] = {
            "report": "2026Q2",
            "generated_at": "2026-08-28T00:00:00+08:00",
            "stock_rows": {"000660": {"code": "000660", "name": "SK海力士"}},
            "direct_funds": {},
            "indirect_candidates": {},
            "cutoff_date": "2026-06-30",
        }
        defaults.update(overrides)
        return build_portfolio_release(**defaults)

    def sync_stock_shard_hash(self, manifest, shards, code="000660"):
        manifest["shards"][code]["sha256"] = sha256_bytes(json_utf8_bytes(shards[code]))

    def test_overseas_slash_code_uses_safe_storage_filename_without_mutating_code(self):
        manifest, shards = self.build_release(
            stock_rows={"BA/LN": {"code": "BA/LN", "name": "英国宇航系统"}},
            direct_funds={"BA/LN": [fund("A", 0.042)]},
        )
        self.assertIn("BA/LN", shards)
        self.assertEqual(shards["BA/LN"]["stock"]["code"], "BA/LN")
        self.assertEqual(
            manifest["shards"]["BA/LN"]["path"],
            f"fund-portfolio-index-2026q2/{manifest['releaseId']}/stock-42412f4c4e.json",
        )
        self.assertEqual(validate_portfolio_release(manifest, shards), [])

    def test_korean_six_digit_code_with_english_name_is_overseas(self):
        self.assertEqual(index_builder.stock_market_bucket("000660", "SK HYNIX INC"), "kr")
        self.assertTrue(index_builder.is_overseas_stock_code("000660", "SK HYNIX INC"))

    def test_stock_code_aliases_merge_only_explicitly_verified_identifiers(self):
        aliases = index_builder.configured_stock_code_aliases(
            {
                "stockCodeAliases": {
                    "000660KS": "000660",
                    "KR7000660001": "000660",
                }
            }
        )
        self.assertEqual(index_builder.canonical_stock_code("000660KS", aliases), "000660")
        self.assertEqual(index_builder.canonical_stock_code("KR7000660001", aliases), "000660")
        self.assertEqual(index_builder.canonical_stock_code("440110KS", aliases), "440110KS")

    def test_portfolio_release_dedupes_share_classes_and_keeps_distinct_sources(self):
        manifest, shards = self.build_release(
            direct_funds={"000660": [fund("A", 0.042), fund("C", 0.039)]},
            indirect_candidates={
                "000660": [
                    indirect("A", "SOXL", 9.74),
                    indirect("C", "SOXL", 9.74),
                    indirect("A", "NVDL", 3.80),
                ]
            },
        )

        shard = shards["000660"]
        self.assertEqual(manifest["report"], "2026Q2")
        self.assertEqual(manifest["builderVersion"], "fund-portfolio-index-v1")
        self.assertEqual(manifest["fundFamilyRuleVersion"], "fund-family-key-v1")
        self.assertEqual(manifest["viewClassificationRuleVersion"], "is-on-exchange-fund-v1")
        self.assertEqual(manifest["publishStatus"], "complete")
        self.assertIn("unmappedNotCountedAsZero", manifest["coverage"])
        self.assertEqual(len(shard["directEdges"]), 1)
        self.assertEqual(len(shard["indirectEdges"]), 2)
        self.assertEqual(
            round(sum(edge["estimatedRatioPercent"] for edge in shard["indirectEdges"]), 2),
            13.54,
        )
        profile = next(iter(shard["fundProfiles"].values()))
        self.assertEqual(profile["fundVariantCodes"], ["000001", "000002"])
        self.assertFalse(profile["isOnExchangeFund"])
        self.assertEqual(shard["indirectEdges"][0]["sourceRatioPercent"], 1.9)

    def test_portfolio_release_keeps_rank_eleven_direct_holding(self):
        direct = [
            fund("A", 0.01, code=f"{index:06d}", name=f"基金{index}")
            for index in range(1, 12)
        ]
        _manifest, shards = self.build_release(direct_funds={"000660": direct})
        self.assertEqual(len(shards["000660"]["directEdges"]), 11)

    def test_q2_indirect_regression_dedupes_share_classes_across_two_targets(self):
        _manifest, shards = self.build_release(
            stock_rows={
                "000660": {"code": "000660", "name": "SK海力士"},
                "005930": {"code": "005930", "name": "三星电子"},
            },
            indirect_candidates={
                "000660": [indirect("A", "7709.HK", 9.74), indirect("C", "7709.HK", 9.74)],
                "005930": [
                    indirect("A", "7747.HK", 3.80, target_code="005930"),
                    indirect("C", "7747.HK", 3.80, target_code="005930"),
                ],
            },
        )
        actual = sum(
            edge["estimatedRatioPercent"]
            for shard in shards.values()
            for edge in shard["indirectEdges"]
        )
        self.assertEqual(round(actual, 2), 13.54)

    def test_invalid_indirect_candidates_are_excluded_and_counted(self):
        _manifest, shards = self.build_release(
            indirect_candidates={
                "000660": [
                    indirect("A", "SOXL", 9.74),
                    indirect("A", "BAD0", 1.0, leverage_multiple=0),
                    indirect("A", "BADN", 1.0, leverage_multiple=float("nan")),
                ]
            },
        )
        shard = shards["000660"]
        self.assertEqual([edge["sourceCode"] for edge in shard["indirectEdges"]], ["SOXL"])
        self.assertEqual(shard["coverage"]["ineligibleByReason"]["non_positive_leverage"], 1)
        self.assertEqual(shard["coverage"]["ineligibleByReason"]["non_finite_leverage"], 1)

    def test_non_positive_direct_edge_is_excluded_and_covered(self):
        _manifest, shards = self.build_release(
            direct_funds={"000660": [fund("A", 0.042), fund("C", 0.0)]}
        )
        shard = shards["000660"]
        self.assertEqual(len(shard["directEdges"]), 1)
        self.assertEqual(shard["coverage"]["directIneligibleByReason"], {"non_positive_direct_ratio": 1})

    def test_etf_feeder_is_off_exchange(self):
        _manifest, shards = self.build_release(
            direct_funds={
                "000660": [
                    fund("A", 0.042, name="全球科技ETF联接基金", fund_type="指数型"),
                    fund("A", 0.031, code="000003", name="全球科技ETF基金", fund_type="指数型"),
                ]
            }
        )
        profiles = shards["000660"]["fundProfiles"]
        self.assertFalse(profiles["全球科技ETF联接基金"]["isOnExchangeFund"])
        self.assertTrue(profiles["全球科技ETF基金"]["isOnExchangeFund"])

    def test_profile_is_canonical_across_stock_shards_and_detail_is_real_or_explicit(self):
        manifest, shards = self.build_release(
            stock_rows={
                "000660": {"code": "000660", "name": "SK海力士"},
                "005930": {"code": "005930", "name": "三星电子"},
            },
            direct_funds={
                "000660": [fund("A", 0.042), fund("C", 0.039)],
                "005930": [fund("C", 0.031)],
            },
            fund_holdings={
                "000001": [
                    {
                        "rank": 11,
                        "stockCode": "000660",
                        "stockName": "SK海力士",
                        "ratioPercent": 4.2,
                    }
                ]
            },
        )
        first = shards["000660"]["fundProfiles"]["全球科技混合"]
        second = shards["005930"]["fundProfiles"]["全球科技混合"]
        self.assertEqual(first, second)
        self.assertEqual(first["detailShardKey"], portfolio_detail_shard_prefix("全球科技混合"))
        details = next(iter(manifest["_buildFundDetailPayloads"].values()))["fundDetails"]
        detail = details["全球科技混合"]
        self.assertEqual(detail["detailStatus"], "available")
        self.assertEqual(detail["holdings"][0]["rank"], 11)

    def test_family_detail_sorting_is_capped_at_ten(self):
        holdings = [
            {
                "rank": rank,
                "stockCode": f"S{rank:02d}",
                "stockName": f"股票{rank}",
                "ratioPercent": float(20 - rank),
            }
            for rank in range(12, 1, -1)
        ]
        manifest, _shards = self.build_release(
            direct_funds={"000660": [fund("A", 0.042)]},
            fund_holdings={"000001": sorted(holdings, key=lambda item: -item["rank"])},
        )
        details = next(iter(manifest["_buildFundDetailPayloads"].values()))["fundDetails"]
        detail = details["全球科技混合"]
        self.assertEqual(detail["detailStatus"], "available")
        self.assertEqual(len(detail["holdings"]), 10)
        self.assertEqual(detail["holdings"][0]["rank"], 2)

    def test_missing_family_detail_is_explicit_and_has_no_fake_holdings(self):
        manifest, _shards = self.build_release(direct_funds={"000660": [fund("A", 0.042)]})
        details = next(iter(manifest["_buildFundDetailPayloads"].values()))["fundDetails"]
        detail = details["全球科技混合"]
        self.assertEqual(detail["detailStatus"], "not_captured_in_current_stock_detail_rows")
        self.assertNotIn("holdings", detail)

    def test_sha_mismatch_detection(self):
        manifest, shards = self.build_release(direct_funds={"000660": [fund("A", 0.042)]})
        self.assertEqual(validate_portfolio_release(manifest, shards), [])
        tampered = copy.deepcopy(shards)
        tampered["000660"]["directEdges"][0]["ratioPercent"] = 999.0
        self.assertTrue(validate_portfolio_release(manifest, tampered))

    def test_formula_tamper_is_rejected_even_when_hash_is_synchronized(self):
        manifest, shards = self.build_release(
            indirect_candidates={"000660": [indirect("A", "SOXL", 9.74)]}
        )
        tampered = copy.deepcopy(shards)
        tampered["000660"]["indirectEdges"][0]["estimatedRatioPercent"] = 99.99
        self.sync_stock_shard_hash(manifest, tampered)
        self.assertTrue(validate_portfolio_release(manifest, tampered))

    def test_path_dates_and_coverage_tamper_are_rejected_even_when_hash_is_synchronized(self):
        manifest, shards = self.build_release(direct_funds={"000660": [fund("A", 0.042)]})
        path_tampered = copy.deepcopy(manifest)
        path_tampered["shards"]["000660"]["path"] = "wrong-release/000660.json"
        self.assertTrue(validate_portfolio_release(path_tampered, shards))

        cutoff_tampered = copy.deepcopy(shards)
        cutoff_tampered["000660"]["cutoffDate"] = "1999-12-31"
        manifest_for_cutoff = copy.deepcopy(manifest)
        self.sync_stock_shard_hash(manifest_for_cutoff, cutoff_tampered)
        self.assertTrue(validate_portfolio_release(manifest_for_cutoff, cutoff_tampered))

        generated_tampered = copy.deepcopy(manifest)
        generated_tampered["generatedAt"] = ""
        self.assertTrue(validate_portfolio_release(generated_tampered, shards))

        coverage_tampered = copy.deepcopy(manifest)
        coverage_tampered["coverage"]["directPublishedEdges"] = 999999
        self.assertTrue(validate_portfolio_release(coverage_tampered, shards))

    def test_build_expected_facts_reject_synchronized_coverage_and_source_tampering(self):
        manifest, shards = self.build_release(direct_funds={"000660": [fund("A", 0.042), fund("C", 0.0)]})

        direct_input_tampered = copy.deepcopy(shards)
        direct_input_manifest = copy.deepcopy(manifest)
        direct_input_tampered["000660"]["coverage"]["directInputRows"] = 999
        direct_input_manifest["coverage"]["directInputRows"] = 999
        self.sync_stock_shard_hash(direct_input_manifest, direct_input_tampered)
        self.assertTrue(validate_portfolio_release(direct_input_manifest, direct_input_tampered))

        ineligible_tampered = copy.deepcopy(shards)
        ineligible_manifest = copy.deepcopy(manifest)
        fake_map = {"fake": 777}
        ineligible_tampered["000660"]["coverage"]["directIneligibleByReason"] = fake_map
        ineligible_manifest["coverage"]["directIneligibleByReason"] = fake_map
        self.sync_stock_shard_hash(ineligible_manifest, ineligible_tampered)
        self.assertTrue(validate_portfolio_release(ineligible_manifest, ineligible_tampered))

        unmapped_tampered = copy.deepcopy(manifest)
        unmapped_tampered["coverage"]["unmappedCandidateRows"] = 777
        unmapped_tampered["coverage"]["unmappedByReason"] = {"fake": 777}
        self.assertTrue(validate_portfolio_release(unmapped_tampered, shards))

        source_tampered = copy.deepcopy(manifest)
        source_tampered["inputHoldingRows"] = 999999
        source_tampered["sourceFile"] = "wrong.csv"
        self.assertTrue(validate_portfolio_release(source_tampered, shards))

    def test_fixed_detail_rule_limit_and_disclosure_are_required(self):
        manifest, shards = self.build_release(direct_funds={"000660": [fund("A", 0.042)]})
        for field, value in (
            ("fundDetailShardRule", ""),
            ("fundDetailDisplayLimit", 999),
        ):
            tampered = copy.deepcopy(manifest)
            tampered[field] = value
            self.assertTrue(validate_portfolio_release(tampered, shards), field)
        disclosure_tampered = copy.deepcopy(manifest)
        disclosure_tampered["coverage"]["unmappedNotCountedAsZero"] = ""
        self.assertTrue(validate_portfolio_release(disclosure_tampered, shards))

    def test_writer_replaces_manifest_last(self):
        manifest, shards = self.build_release(direct_funds={"000660": [fund("A", 0.042)]})
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir) / "data"
            manifest_path = data_dir / "fund-portfolio-index-2026q2.manifest.json"
            manifest_path.parent.mkdir(parents=True)
            manifest_path.write_text('{"releaseId":"old"}', encoding="utf-8")
            invalid_manifest = copy.deepcopy(manifest)
            invalid_manifest["shards"]["000660"]["sha256"] = "0" * 64

            with self.assertRaises(ValueError):
                write_portfolio_release(
                    manifest_path,
                    data_dir / "fund-portfolio-index-2026q2" / invalid_manifest["releaseId"],
                    invalid_manifest["releaseId"],
                    invalid_manifest,
                    shards,
                )

            self.assertEqual(manifest_path.read_text(encoding="utf-8"), '{"releaseId":"old"}')

    def test_main_keeps_previous_core_files_when_portfolio_publish_fails(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir) / "data"
            seo_dir = Path(temp_dir) / "seo"
            data_dir.mkdir()
            seo_dir.mkdir()
            target_json = data_dir / "fund-stock-index-2026q2.json"
            holdings_json = data_dir / "fund-holdings-2026q2.json"
            audit_path = seo_dir / "indirect-exposure-audit-2026q2.md"
            old_files = {
                target_json: b"old index",
                holdings_json: b"old holdings",
                audit_path: b"old audit",
            }
            for path, content in old_files.items():
                path.write_bytes(content)

            payload = {
                "meta": {
                    "report": "2026Q2",
                    "generatedAt": "2026-08-30T00:00:00",
                    "cutoffDate": "2026-06-30",
                    "sourceRows": 1,
                    "fundInvestmentSourceRows": 0,
                    "stockCount": 1,
                },
                "popularStocks": [],
                "stocks": [],
                "fundHoldings": {"000001": []},
            }
            portfolio_inputs = {
                "stockRows": {},
                "directFunds": {},
                "indirectCandidates": {},
                "indirectCoverage": {},
                "fundHoldings": {},
            }
            manifest = {"releaseId": "2026q2-test-release"}

            with (
                mock.patch.object(index_builder, "TARGET_JSON", target_json),
                mock.patch.object(index_builder, "INDIRECT_EXPOSURE_AUDIT_MD", audit_path),
                mock.patch.object(
                    index_builder,
                    "build_index_with_audit",
                    return_value=(copy.deepcopy(payload), "new audit", portfolio_inputs),
                ),
                mock.patch.object(
                    index_builder,
                    "build_portfolio_release",
                    return_value=(manifest, {}),
                ),
                mock.patch.object(
                    index_builder,
                    "write_portfolio_release",
                    side_effect=OSError("injected portfolio publish failure"),
                ),
            ):
                with self.assertRaisesRegex(OSError, "injected portfolio publish failure"):
                    index_builder.main()

            for path, content in old_files.items():
                self.assertEqual(path.read_bytes(), content)

    def test_main_rolls_back_core_files_and_manifest_when_group_publish_fails(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir) / "data"
            seo_dir = Path(temp_dir) / "seo"
            data_dir.mkdir()
            seo_dir.mkdir()
            target_json = data_dir / "fund-stock-index-2026q2.json"
            holdings_json = data_dir / "fund-holdings-2026q2.json"
            audit_path = seo_dir / "indirect-exposure-audit-2026q2.md"
            manifest_path = data_dir / "fund-portfolio-index-2026q2.manifest.json"
            old_files = {
                target_json: b"old index",
                holdings_json: b"old holdings",
                audit_path: b"old audit",
                manifest_path: b"old manifest",
            }
            for path, content in old_files.items():
                path.write_bytes(content)

            payload = {
                "meta": {
                    "report": "2026Q2",
                    "generatedAt": "2026-08-30T00:00:00",
                    "cutoffDate": "2026-06-30",
                    "sourceRows": 1,
                    "fundInvestmentSourceRows": 0,
                    "stockCount": 1,
                },
                "popularStocks": [],
                "stocks": [],
                "fundHoldings": {"000001": []},
            }
            portfolio_inputs = {
                "stockRows": {},
                "directFunds": {},
                "indirectCandidates": {},
                "indirectCoverage": {},
                "fundHoldings": {},
            }
            manifest = {"releaseId": "2026q2-test-release"}
            release_dir = data_dir / "fund-portfolio-index-2026q2" / manifest["releaseId"]
            original_replace = Path.replace

            def fail_holdings_publish(path: Path, target: Path):
                if Path(target) == holdings_json:
                    raise OSError("injected grouped publish failure")
                return original_replace(path, target)

            def stage_portfolio(
                target_manifest: Path,
                target_release_dir: Path,
                _release_id: str,
                _manifest: dict,
                _shards: dict,
                *,
                publish_manifest: bool = True,
            ):
                target_release_dir.mkdir(parents=True)
                staged_manifest = target_manifest.with_name(".new-portfolio-manifest.json")
                staged_manifest.write_bytes(b"new manifest")
                if publish_manifest:
                    staged_manifest.replace(target_manifest)
                    return None
                return staged_manifest

            with (
                mock.patch.object(index_builder, "TARGET_JSON", target_json),
                mock.patch.object(index_builder, "INDIRECT_EXPOSURE_AUDIT_MD", audit_path),
                mock.patch.object(
                    index_builder,
                    "build_index_with_audit",
                    return_value=(copy.deepcopy(payload), "new audit", portfolio_inputs),
                ),
                mock.patch.object(
                    index_builder,
                    "build_portfolio_release",
                    return_value=(manifest, {}),
                ),
                mock.patch.object(
                    index_builder,
                    "write_portfolio_release",
                    side_effect=stage_portfolio,
                ),
                mock.patch.object(Path, "replace", new=fail_holdings_publish),
            ):
                with self.assertRaisesRegex(OSError, "injected grouped publish failure"):
                    index_builder.main()

            for path, content in old_files.items():
                self.assertEqual(path.read_bytes(), content)
            self.assertFalse(release_dir.exists())

    def test_build_rejects_source_row_count_mismatch_with_run_summary(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            source_csv = Path(temp_dir) / "holdings_stock_2026q2.csv"
            with source_csv.open("w", encoding="utf-8-sig", newline="") as handle:
                writer = csv.DictWriter(
                    handle,
                    fieldnames=[
                        "基金代码",
                        "基金名称",
                        "基金类型",
                        "截止日期",
                        "序号",
                        "证券代码",
                        "证券名称",
                        "占净值比例数值",
                        "持仓市值(万元)",
                        "持股数(万股)",
                    ],
                )
                writer.writeheader()
                writer.writerow(
                    {
                        "基金代码": "000001",
                        "基金名称": "测试基金",
                        "基金类型": "混合型",
                        "截止日期": "2026-06-30",
                        "序号": "1",
                        "证券代码": "AMD",
                        "证券名称": "AMD",
                        "占净值比例数值": "0.01",
                        "持仓市值(万元)": "100",
                        "持股数(万股)": "1",
                    }
                )

            with (
                mock.patch.object(index_builder, "SOURCE_CSV", source_csv),
                mock.patch.object(
                    index_builder,
                    "load_summary",
                    return_value={
                        "report": "2026Q2",
                        "fund_count": 1,
                        "status_rows": 1,
                        "selected_types": ["stock"],
                        "holding_rows": {"stock": 2},
                        "status_counts": {"stock": {"ok": 1}},
                    },
                ),
                mock.patch.object(index_builder, "load_fund_report_summary", return_value={}),
                mock.patch.object(index_builder, "load_purchase_limits", return_value={}),
                mock.patch.object(index_builder, "load_purchase_limit_metadata", return_value={}),
                mock.patch.object(index_builder, "load_exposure_aliases", return_value={}),
                mock.patch.object(index_builder, "load_fund_investment_rows", return_value=[]),
                mock.patch.object(index_builder, "load_qdii_h1_source", return_value=None),
            ):
                with self.assertRaisesRegex(ValueError, "holding_rows.stock"):
                    index_builder.build_index_with_audit()

    def test_source_summary_rejects_incomplete_status_coverage(self):
        summary = {
            "fund_count": 10,
            "status_rows": 9,
            "holding_rows": {"stock": 1},
        }

        with self.assertRaisesRegex(ValueError, "status_rows"):
            index_builder.validate_source_summary(summary, 1)

    def test_source_summary_rejects_fetch_errors(self):
        summary = {
            "fund_count": 1,
            "status_rows": 1,
            "selected_types": ["stock"],
            "holding_rows": {"stock": 0},
            "status_counts": {"stock": {"error": 1}},
        }

        with self.assertRaisesRegex(ValueError, "error"):
            index_builder.validate_source_summary(summary, 0)

    def test_qdii_h1_incomplete_summary_is_rejected_even_when_counts_match(self):
        rows = [
            {
                "基金代码": "000001",
                "报告期": "2026H1",
                "截止日期": "2026-06-30",
                "披露范围": "all_disclosed_equity",
            }
        ]
        summary = {
            "report": "2026H1",
            "cutoffDate": "2026-06-30",
            "fundType": "6020-6050",
            "reportType": "FB020",
            "isComplete": False,
            "reportCount": 1,
            "reportResults": [{"fundCode": "000001", "status": "ok"}],
            "holdingRows": 1,
            "scopeCounts": {
                "all_disclosed_equity": 1,
                "top10_disclosed_fund_investments": 0,
            },
        }

        with self.assertRaisesRegex(ValueError, "不是完整抓取结果"):
            index_builder.validate_qdii_h1_summary(summary, rows)

    def test_qdii_h1_complete_summary_with_matching_csv_scope_counts_loads(self):
        rows = [
            {
                "基金代码": "000001",
                "报告期": "2026H1",
                "截止日期": "2026-06-30",
                "披露范围": "all_disclosed_equity",
            },
            {
                "基金代码": "000001",
                "报告期": "2026H1",
                "截止日期": "2026-06-30",
                "披露范围": "top10_disclosed_fund_investments",
            },
        ]
        summary = {
            "report": "2026H1",
            "cutoffDate": "2026-06-30",
            "fundType": "6020-6050",
            "reportType": "FB020",
            "isComplete": True,
            "reportCount": 1,
            "reportResults": [{"fundCode": "000001", "status": "ok"}],
            "holdingRows": 2,
            "scopeCounts": {
                "all_disclosed_equity": 1,
                "top10_disclosed_fund_investments": 1,
            },
        }

        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            source_csv = temp_path / "holdings_qdii_2026h1.csv"
            summary_json = temp_path / "qdii_half_year_holdings_summary_2026.json"
            with source_csv.open("w", encoding="utf-8-sig", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
                writer.writeheader()
                writer.writerows(rows)
            summary_json.write_text(json.dumps(summary, ensure_ascii=False), encoding="utf-8")

            with (
                mock.patch.object(index_builder, "QDII_H1_CSV", source_csv),
                mock.patch.object(index_builder, "QDII_H1_SUMMARY_JSON", summary_json),
                mock.patch.object(index_builder, "FUND_LIST_CSV", temp_path / "missing-fund-list.csv"),
            ):
                loaded = index_builder.load_qdii_h1_source()

        self.assertIsNotNone(loaded)
        assert loaded is not None
        self.assertEqual(loaded["rows"], rows)
        self.assertEqual(loaded["summary"]["scopeCounts"], summary["scopeCounts"])

    def test_qdii_variants_seed_from_official_report_code_when_fund_list_type_lacks_marker(self):
        rows = [
            {"基金代码": "000071", "基金名称": "测试海外 ETF 联接A", "基金类型": "指数型-海外股票", "是否QDII": ""},
            {"基金代码": "000072", "基金名称": "测试海外 ETF 联接C", "基金类型": "指数型-海外股票", "是否QDII": ""},
            {"基金代码": "000073", "基金名称": "普通境内基金A", "基金类型": "混合型", "是否QDII": ""},
        ]
        with tempfile.TemporaryDirectory() as temp_dir:
            source = Path(temp_dir) / "fund_list.csv"
            with source.open("w", encoding="utf-8-sig", newline="") as handle:
                writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
                writer.writeheader()
                writer.writerows(rows)
            with mock.patch.object(index_builder, "FUND_LIST_CSV", source):
                variants = index_builder.qdii_fund_variants(["000071"])

        self.assertEqual(
            [item["基金代码"] for item in variants["测试海外ETF联接"]],
            ["000071", "000072"],
        )
        self.assertNotIn("普通境内基金", variants)

    def test_writer_failure_does_not_replace_old_manifest_or_reference_new_release(self):
        manifest, shards = self.build_release(
            stock_rows={
                "000660": {"code": "000660", "name": "SK海力士"},
                "005930": {"code": "005930", "name": "三星电子"},
            },
            direct_funds={
                "000660": [fund("A", 0.042)],
                "005930": [fund("A", 0.031)],
            },
        )
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir) / "data"
            manifest_path = data_dir / "fund-portfolio-index-2026q2.manifest.json"
            manifest_path.parent.mkdir(parents=True)
            old_manifest = b'{"releaseId":"old"}'
            manifest_path.write_bytes(old_manifest)
            release_dir = data_dir / "fund-portfolio-index-2026q2" / manifest["releaseId"]
            original_write_bytes = Path.write_bytes

            def fail_second_stock(path: Path, content: bytes) -> int:
                if path.name == f"{index_builder.portfolio_stock_file_stem('005930')}.json":
                    raise OSError("injected shard write failure")
                return original_write_bytes(path, content)

            with mock.patch.object(Path, "write_bytes", new=fail_second_stock):
                with self.assertRaises(OSError):
                    write_portfolio_release(
                        manifest_path,
                        release_dir,
                        manifest["releaseId"],
                        manifest,
                        shards,
                    )

            self.assertEqual(manifest_path.read_bytes(), old_manifest)
            self.assertFalse(release_dir.exists())

    def test_manifest_replace_failure_keeps_old_manifest_after_release_is_finalized(self):
        manifest, shards = self.build_release(direct_funds={"000660": [fund("A", 0.042)]})
        with tempfile.TemporaryDirectory() as temp_dir:
            data_dir = Path(temp_dir) / "data"
            manifest_path = data_dir / "fund-portfolio-index-2026q2.manifest.json"
            manifest_path.parent.mkdir(parents=True)
            old_manifest = b'{"releaseId":"old-release"}'
            manifest_path.write_bytes(old_manifest)
            release_dir = data_dir / "fund-portfolio-index-2026q2" / manifest["releaseId"]
            original_replace = Path.replace
            replace_calls = []

            def fail_manifest_replace(path: Path, target: Path):
                replace_calls.append((path, target))
                if Path(target) == manifest_path:
                    raise OSError("injected manifest replace failure")
                return original_replace(path, target)

            with mock.patch.object(Path, "replace", new=fail_manifest_replace):
                with self.assertRaises(OSError):
                    write_portfolio_release(
                        manifest_path, release_dir, manifest["releaseId"], manifest, shards
                    )

            self.assertEqual(manifest_path.read_bytes(), old_manifest)
            self.assertTrue(release_dir.is_dir())
            self.assertGreaterEqual(len(replace_calls), 2)
            self.assertEqual(replace_calls[0][1], release_dir)
            self.assertEqual(replace_calls[-1][1], manifest_path)


if __name__ == "__main__":
    unittest.main()
