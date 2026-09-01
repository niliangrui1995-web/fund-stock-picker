from __future__ import annotations

import unittest

from fetch_qdii_half_year_holdings import (
    CUTOFF_DATE,
    REPORT_LABEL,
    SECTION_HEADING_RE,
    classify_portfolio_section,
    continuation_schema,
    holding_record_key,
    holding_from_table_row,
    inferred_continuation_schema,
    merge_rankless_equity_name_fragment,
    normalize_pdf_wrapped_name,
    table_schema,
)


REPORT = {
    "fundCode": "164212",
    "fundShortName": "天弘恒生科技指数(QDII)",
    "fundTypeName": "QDII",
    "reportName": "测试基金2026年中期报告",
    "uploadInfoId": "1563648",
    "reportSendDate": "2026-08-31",
}


class QdiiHalfYearParserTests(unittest.TestCase):
    def test_portfolio_section_is_classified_by_stable_disclosure_title(self) -> None:
        self.assertEqual(
            classify_portfolio_section("7.5 期末按公允价值占基金资产净值比例大小排序的所有权益投资明细"),
            "equity",
        )
        self.assertEqual(
            classify_portfolio_section("7.11 期末按公允价值占基金资产净值比例大小排序的前十名基金投资明细"),
            "fund",
        )
        self.assertEqual(
            classify_portfolio_section("7.6.1 累计买入金额超出期初基金资产净值 2% 的权益投资明细"),
            "outside",
        )
        self.assertIsNone(SECTION_HEADING_RE.match("7.74"))

    def test_equity_schema_preserves_local_or_isin_code_and_full_scope(self) -> None:
        rows = [
            ["序号", "公司名称(英文)", "证券代码", "数量(股)", "公允价值(人民币元)", "占基金资产净值比例"],
            ["1", "NVIDIA CORP", "US67066G1040", "100", "12,345,678.00", "12.34%"],
        ]
        schema = table_schema(rows, "equity")
        self.assertIsNotNone(schema)
        record = holding_from_table_row(rows[1], schema or {}, "equity", fallback_rank=1, report=REPORT, page_number=42, pdf_sha256="a" * 64, year=2026)
        self.assertIsNotNone(record)
        self.assertEqual(record["披露范围"], "all_disclosed_equity")
        self.assertEqual(record["证券代码"], "US67066G1040")
        self.assertEqual(record["报告期"], REPORT_LABEL.format(year=2026))
        self.assertEqual(record["截止日期"], CUTOFF_DATE.format(year=2026))
        self.assertEqual(record["持仓市值(万元)"], 1234.5678)
        self.assertEqual(record["持股数(万股)"], 0.01)

    def test_fund_schema_marks_etf_as_top_ten_disclosure_without_inventing_code(self) -> None:
        rows = [
            ["序号", "基金名称", "基金类型", "运作方式", "公允价值(人民币元)", "占基金资产净值比例"],
            ["1", "CSOP SK Hynix Daily 2x Leveraged Product", "股票型", "交易型开放式", "987654", "3.21%"],
        ]
        schema = table_schema(rows, "fund")
        self.assertIsNotNone(schema)
        record = holding_from_table_row(rows[1], schema or {}, "fund", fallback_rank=1, report=REPORT, page_number=70, pdf_sha256="b" * 64, year=2026)
        self.assertIsNotNone(record)
        self.assertEqual(record["持仓类别"], "ETF")
        self.assertEqual(record["披露范围"], "top10_disclosed_fund_investments")
        self.assertEqual(record["证券代码"], "")
        self.assertEqual(record["证券标识"], "REPORT-FUND-001")

    def test_pdf_layout_name_normalization_only_joins_proven_mid_word_breaks(self) -> None:
        # ``Page.get_textbox(cell)`` preserves real blank glyphs at line ends.
        # The first sample has no blank glyph between H/ynix and 2/x; the
        # second has a real word space before "and", so it must stay separate.
        self.assertEqual(
            normalize_pdf_wrapped_name(
                "CSOP SK H\nynix Daily 2\nx Leveraged\n Product "
            ),
            "CSOP SK Hynix Daily 2x Leveraged Product",
        )
        self.assertEqual(
            normalize_pdf_wrapped_name(
                "Calamos \nConvertible \nand High \nIncome Fund"
            ),
            "Calamos Convertible and High Income Fund",
        )
        self.assertEqual(
            normalize_pdf_wrapped_name("Alphabet \nInc "),
            "Alphabet Inc",
        )

    def test_merged_header_fallback_recovers_one_column_left_fund_row(self) -> None:
        rows = [
            ["", "序号", "", "", "基金名称", "", "", "基金类型", "", "", "运作方式", "", "", "管理人", "", "", "公允价值", "", "", "占基金资产净值比例", ""],
            ["1", None, None, "恒生科技ETF汇添富", None, None, "股票型", None, None, "交易型开放式", None, None, "汇添富基金管理股份有限公司", None, None, "2,785,567,817.67", None, None, None, "93.17", None],
        ]
        schema = table_schema(rows, "fund")
        self.assertIsNotNone(schema)
        record = holding_from_table_row(rows[1], schema or {}, "fund", fallback_rank=1, report=REPORT, page_number=55, pdf_sha256="e" * 64, year=2026)
        self.assertIsNotNone(record)
        self.assertEqual(record["证券名称"], "恒生科技ETF汇添富")
        self.assertEqual(record["序号"], 1)
        self.assertEqual(record["持仓市值(万元)"], 278556.781767)
        self.assertEqual(record["占净值比例数值"], 0.9317)

    def test_split_english_header_waits_for_usable_name_column(self) -> None:
        rows = [
            ["序号", "", "公司", "", "公司名称（中文）", "证券代码", "数量（股）", "公允价值", "占基金资产净值比例（%）"],
            [None, None, "名称", None, None, None, None, None, None],
            [None, None, "（英", None, None, None, None, None, None],
            ["1", "WELLTOWER INC", None, None, "-", "WELL", "21,438", "33,140,360.48", "10.01"],
        ]
        schema = table_schema(rows, "equity")
        self.assertIsNotNone(schema)
        record = holding_from_table_row(rows[3], schema or {}, "equity", fallback_rank=1, report=REPORT, page_number=44, pdf_sha256="f" * 64, year=2026)
        self.assertIsNotNone(record)
        self.assertEqual(record["证券名称"], "WELLTOWER INC")
        self.assertEqual(record["证券代码"], "WELL")

    def test_wide_bilingual_header_can_span_eight_pdf_rows(self) -> None:
        def table_row(values: dict[int, str]) -> list[str]:
            row = [""] * 25
            for index, value in values.items():
                row[index] = value
            return row

        rows = [
            table_row({1: "序", 4: "公司名称", 7: "公司名", 10: "证券代", 19: "数量（股）", 20: "公允价值", 23: "占基"}),
            table_row({1: "号", 7: "称（中", 10: "码", 13: "所在证", 16: "国家", 23: "金资"}),
            table_row({4: "（英文）", 7: "文）", 13: "券市场", 16: "（地区）", 23: "产净"}),
            table_row({23: "值比"}),
            table_row({23: "例"}),
            table_row({23: "（%）"}),
            table_row({}),
            table_row({0: "1", 3: "Sandisk Corp", 6: "闪迪公司", 9: "SNDK US", 12: "美国", 15: "美国", 18: "23,000", 20: "356,181,396.11", 22: "9.12"}),
        ]
        schema = table_schema(rows, "equity")
        self.assertIsNotNone(schema)
        record = holding_from_table_row(rows[7], schema or {}, "equity", fallback_rank=1, report=REPORT, page_number=42, pdf_sha256="h" * 64, year=2026)
        self.assertIsNotNone(record)
        self.assertEqual(record["证券代码"], "SNDKUS")
        self.assertEqual(record["证券名称"], "闪迪公司")

    def test_equity_continuation_reconstructs_collapsed_name_columns(self) -> None:
        original = {
            "rankIndex": 0,
            "codeIndex": 5,
            "nameIndices": [2, 4],
            "valueIndex": 9,
            "ratioIndex": 10,
            "quantityIndex": 8,
            "quantityUnit": "万股",
        }
        continued = continuation_schema(original, 9, "equity")
        self.assertIsNotNone(continued)
        row = ["6", "REALTY INCOME CORP", "-", "O", "纽约证券交易所", "美国", "41,683", "17,590,366.22", "5.31"]
        record = holding_from_table_row(row, continued or {}, "equity", fallback_rank=6, report=REPORT, page_number=45, pdf_sha256="g" * 64, year=2026)
        self.assertIsNotNone(record)
        self.assertEqual(record["证券代码"], "O")
        self.assertEqual(record["证券名称"], "REALTY INCOME CORP")

    def test_wide_headerless_equity_continuation_keeps_actual_code_and_tail_fields(self) -> None:
        row = [
            "1",
            "Marvell Technology Inc",
            "美满电子科技公司",
            None,
            None,
            "MRVL US",
            "美国",
            "美国",
            None,
            None,
            "15,798",
            "32,052,546.42",
            "9.83",
            None,
            None,
        ]
        schema = inferred_continuation_schema(15, "equity", [row])
        self.assertIsNotNone(schema)
        record = holding_from_table_row(row, schema or {}, "equity", fallback_rank=1, report=REPORT, page_number=42, pdf_sha256="i" * 64, year=2026)
        self.assertIsNotNone(record)
        self.assertEqual(record["证券代码"], "MRVLUS")
        self.assertEqual(record["证券名称"], "美满电子科技公司")
        self.assertEqual(record["持仓市值(万元)"], 3205.254642)
        self.assertEqual(record["占净值比例数值"], 0.0983)

    def test_truncated_rankless_continuation_fragment_is_not_a_holding(self) -> None:
        schema = inferred_continuation_schema(9, "equity")
        self.assertIsNotNone(schema)
        row = ["", "Inc", "有限公司", "", "交易所", "美国", "4", "", ""]
        record = holding_from_table_row(row, schema or {}, "equity", fallback_rank=35, report=REPORT, page_number=56, pdf_sha256="j" * 64, year=2026)
        self.assertIsNone(record)

    def test_rankless_overseas_identifiers_are_not_filtered_as_fragments(self) -> None:
        schema = inferred_continuation_schema(9, "equity")
        self.assertIsNotNone(schema)
        for code in ("BRK/B US", "700 HK Equity", "JP3236330001", "TVSLIN609/01/26Pfd"):
            with self.subTest(code=code):
                row = ["", "Example Company", "-", code, "NYSE", "美国", "1", "50,000", "0.01"]
                record = holding_from_table_row(row, schema or {}, "equity", fallback_rank=11, report=REPORT, page_number=43, pdf_sha256="k" * 64, year=2026)
                self.assertIsNotNone(record)
                self.assertEqual(record["证券代码"], code.replace(" ", ""))

    def test_rankless_page_fragment_only_merges_the_previous_page_name_tail(self) -> None:
        schema = inferred_continuation_schema(9, "equity")
        self.assertIsNotNone(schema)
        prior = {
            "持仓类别": "权益投资",
            "披露范围": "all_disclosed_equity",
            "证券标识": "US5738741041",
            "证券名称": "迈威迩电子科技股",
            "序号": 2,
            "页码": 48,
            "_selectedNameIndex": 2,
        }
        records = [prior]
        seen = {holding_record_key(prior)}
        merged = merge_rankless_equity_name_fragment(
            records,
            seen,
            ["", "Inc", "份有限公司", "", "交易所", "美国", "4", "", ""],
            schema or {},
            row_index=0,
            page_number=49,
            expected_rank=2,
        )
        self.assertTrue(merged)
        self.assertEqual(prior["证券名称"], "迈威迩电子科技股份有限公司")
        self.assertIn(holding_record_key(prior), seen)

    def test_rankless_fragment_merges_an_english_name_tail(self) -> None:
        schema = inferred_continuation_schema(9, "equity")
        self.assertIsNotNone(schema)
        prior = {
            "持仓类别": "权益投资",
            "披露范围": "all_disclosed_equity",
            "证券标识": "ITUN",
            "证券名称": "Gartner",
            "序号": 486,
            "页码": 81,
            "_selectedNameIndex": 1,
        }
        records = [prior]
        seen = {holding_record_key(prior)}
        merged = merge_rankless_equity_name_fragment(
            records,
            seen,
            ["", "Inc", "公司", "", "交易所", "美国", "4", "", ""],
            schema or {},
            row_index=0,
            page_number=82,
            expected_rank=486,
        )
        self.assertTrue(merged)
        self.assertEqual(prior["证券名称"], "Gartner Inc")

    def test_rankless_fragment_uses_verified_layout_to_join_mid_word_break(self) -> None:
        schema = inferred_continuation_schema(9, "equity")
        self.assertIsNotNone(schema)
        prior = {
            "持仓类别": "权益投资",
            "披露范围": "all_disclosed_equity",
            "证券标识": "OHIUS",
            "证券名称": "Omega",
            "序号": 12,
            "页码": 42,
            "_selectedNameIndex": 1,
        }
        records = [prior]
        seen = {holding_record_key(prior)}
        merged = merge_rankless_equity_name_fragment(
            records,
            seen,
            ["", "Healthcar\ne \nInvestors \nInc ", "", "", "交易所", "美国", "", "", ""],
            schema or {},
            row_index=0,
            page_number=43,
            expected_rank=12,
            layout_name_indices={1},
        )
        self.assertTrue(merged)
        self.assertEqual(prior["证券名称"], "Omega Healthcare Investors Inc")

    def test_rankless_continuation_code_receives_deterministic_rank(self) -> None:
        rows = [
            ["序号", "公司名称(英文)", "证券代码", "数量(股)", "公允价值(人民币元)", "占基金资产净值比例"],
            ["", "Alphabet Inc", "GOOG", "50", "500000", "1.50%"],
        ]
        schema = table_schema(rows, "equity")
        record = holding_from_table_row(rows[1], schema or {}, "equity", fallback_rank=11, report=REPORT, page_number=43, pdf_sha256="c" * 64, year=2026)
        self.assertIsNotNone(record)
        self.assertEqual(record["序号"], 11)
        self.assertEqual(record["证券代码"], "GOOG")

    def test_continuation_table_recovers_ratio_column_after_merged_header_disappears(self) -> None:
        header_rows = [
            ["序号", "公司名称(英文)", "公司名称(中文)", "证券代码", "市场", "国家", "数量(股)", "公允价值", "", "占基金资产净值比例", ""],
            ["1", "ASML", "-", "ASML", "荷兰", "荷兰", "4,043", "54,056,066.06", "6.26", None, None],
        ]
        schema = table_schema(header_rows, "equity")
        self.assertIsNotNone(schema)
        continued = continuation_schema(schema or {}, 9)
        self.assertIsNotNone(continued)
        record = holding_from_table_row(header_rows[1], continued or {}, "equity", fallback_rank=1, report=REPORT, page_number=45, pdf_sha256="d" * 64, year=2026)
        self.assertIsNotNone(record)
        self.assertEqual(record["证券代码"], "ASML")
        self.assertEqual(record["占净值比例数值"], 0.0626)


if __name__ == "__main__":
    unittest.main(verbosity=2)
