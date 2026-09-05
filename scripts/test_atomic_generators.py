from __future__ import annotations

import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

import atomic_publish
from atomic_publish import publish_staged_files
import fetch_fund_holdings
import fetch_fund_report_holdings


class AtomicGeneratorTests(unittest.TestCase):
    def test_group_publish_retries_transient_permission_error(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            staged = root / "staged.txt"
            target = root / "target.txt"
            staged.write_bytes(b"new")
            target.write_bytes(b"old")
            original_replace = Path.replace
            attempts = 0

            def transient_lock(path: Path, destination: Path):
                nonlocal attempts
                if path == staged:
                    attempts += 1
                    if attempts < 3:
                        raise PermissionError("transient Windows lock")
                return original_replace(path, destination)

            with (
                mock.patch.object(Path, "replace", new=transient_lock),
                mock.patch.object(atomic_publish.time, "sleep") as sleep,
            ):
                publish_staged_files([(staged, target)])

            self.assertEqual(attempts, 3)
            self.assertEqual(target.read_bytes(), b"new")
            self.assertEqual(sleep.call_count, 2)

    def test_group_publish_preserves_backup_when_rollback_itself_fails(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            staged_first = root / "staged-first.txt"
            staged_second = root / "staged-second.txt"
            target_first = root / "first.txt"
            target_second = root / "second.txt"
            staged_first.write_bytes(b"new first")
            staged_second.write_bytes(b"new second")
            target_first.write_bytes(b"old first")
            target_second.write_bytes(b"old second")
            original_replace = Path.replace

            def fail_publish_and_rollback(path: Path, target: Path):
                if path == staged_second:
                    raise OSError("injected publish failure")
                if ".rollback-" in path.name and Path(target) == target_first:
                    raise PermissionError("injected rollback failure")
                return original_replace(path, target)

            with mock.patch.object(Path, "replace", new=fail_publish_and_rollback):
                with self.assertRaisesRegex(RuntimeError, "无法回滚"):
                    publish_staged_files(
                        [
                            (staged_first, target_first),
                            (staged_second, target_second),
                        ]
                    )

            backups = list(root.glob(".first.txt.rollback-*"))
            self.assertEqual(len(backups), 1)
            self.assertEqual(backups[0].read_bytes(), b"old first")

    def test_group_rollback_retries_transient_permission_error(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            staged_first, staged_second = root / "staged-first.txt", root / "staged-second.txt"
            target_first, target_second = root / "first.txt", root / "second.txt"
            for path, content in (
                (staged_first, b"new first"), (staged_second, b"new second"),
                (target_first, b"old first"), (target_second, b"old second"),
            ):
                path.write_bytes(content)
            original_replace = Path.replace
            rollback_attempts = 0

            def fail_publish_and_lock_rollback(path: Path, target: Path):
                nonlocal rollback_attempts
                if path == staged_second:
                    raise OSError("injected publish failure")
                if ".rollback-" in path.name and Path(target) == target_first:
                    rollback_attempts += 1
                    if rollback_attempts < 3:
                        raise PermissionError("transient rollback lock")
                return original_replace(path, target)

            with (
                mock.patch.object(Path, "replace", new=fail_publish_and_lock_rollback),
                mock.patch.object(atomic_publish.time, "sleep"),
            ):
                with self.assertRaisesRegex(OSError, "injected publish failure"):
                    publish_staged_files([(staged_first, target_first), (staged_second, target_second)])

            self.assertEqual(rollback_attempts, 3)
            self.assertEqual(target_first.read_bytes(), b"old first")
            self.assertEqual(target_second.read_bytes(), b"old second")
            self.assertEqual(list(root.glob(".*.rollback-*")), [])

    def test_fund_holding_fetch_failure_keeps_previous_published_outputs(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            output_dir = root / "outputs"
            output_dir.mkdir()
            published_paths = [
                output_dir / "fund_list_2026q2.csv",
                output_dir / "fetch_status_2026q2.csv",
                output_dir / "holdings_stock_2026q2.csv",
                output_dir / "fund_holdings_2026q2.xlsx",
                output_dir / "run_summary_2026q2.json",
            ]
            for path in published_paths:
                path.write_bytes(f"old:{path.name}".encode("utf-8"))

            args = SimpleNamespace(
                year=2026,
                quarter=2,
                types="stock",
                workers=1,
                topline=1000,
                limit=1,
                refresh=False,
                progress_every=0,
                output_dir="outputs",
                cache_dir="data/eastmoney_cache",
            )
            fund = {
                "code": "000001",
                "name": "测试基金",
                "type": "混合型",
                "pinyin_short": "CSJJ",
                "pinyin_full": "CESHIJIJIN",
                "is_qdii": "否",
            }

            with (
                mock.patch.object(fetch_fund_holdings, "parse_args", return_value=args),
                mock.patch.object(fetch_fund_holdings.Path, "cwd", return_value=root),
                mock.patch.object(fetch_fund_holdings, "fetch_text", return_value=("", "cache")),
                mock.patch.object(fetch_fund_holdings, "parse_fund_list", return_value=[fund]),
                mock.patch.object(
                    fetch_fund_holdings,
                    "fetch_one_fund",
                    side_effect=RuntimeError("injected fetch failure"),
                ),
            ):
                with self.assertRaisesRegex(RuntimeError, "injected fetch failure"):
                    fetch_fund_holdings.main()

            for path in published_paths:
                self.assertEqual(path.read_bytes(), f"old:{path.name}".encode("utf-8"))

    def test_fund_holding_error_status_keeps_previous_published_outputs(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            output_dir = root / "outputs"
            output_dir.mkdir()
            published_paths = [
                output_dir / "fund_list_2026q2.csv",
                output_dir / "fetch_status_2026q2.csv",
                output_dir / "holdings_stock_2026q2.csv",
                output_dir / "fund_holdings_2026q2.xlsx",
                output_dir / "run_summary_2026q2.json",
            ]
            for path in published_paths:
                path.write_bytes(f"old:{path.name}".encode("utf-8"))

            args = SimpleNamespace(
                year=2026,
                quarter=2,
                types="stock",
                workers=1,
                topline=1000,
                limit=1,
                refresh=False,
                progress_every=0,
                output_dir="outputs",
                cache_dir="data/eastmoney_cache",
            )
            fund = {
                "code": "000001",
                "name": "测试基金",
                "type": "混合型",
                "pinyin_short": "CSJJ",
                "pinyin_full": "CESHIJIJIN",
                "is_qdii": "否",
            }
            record = {
                "fund": fund,
                "holdings": {"stock": []},
                "status": {
                    "stock": {
                        "status": "error",
                        "rows": 0,
                        "cutoff_date": "",
                        "fetch_source": "",
                        "error": "injected source error",
                    }
                },
            }

            with (
                mock.patch.object(fetch_fund_holdings, "parse_args", return_value=args),
                mock.patch.object(fetch_fund_holdings.Path, "cwd", return_value=root),
                mock.patch.object(fetch_fund_holdings, "fetch_text", return_value=("", "cache")),
                mock.patch.object(fetch_fund_holdings, "parse_fund_list", return_value=[fund]),
                mock.patch.object(fetch_fund_holdings, "fetch_one_fund", return_value=record),
            ):
                for failure_status in ("error", "parse_error"):
                    with self.subTest(status=failure_status):
                        record["status"]["stock"]["status"] = failure_status
                        with self.assertRaisesRegex(RuntimeError, failure_status):
                            fetch_fund_holdings.main()
                        for path in published_paths:
                            self.assertEqual(path.read_bytes(), f"old:{path.name}".encode("utf-8"))

    def test_fund_holding_publish_failure_rolls_back_all_outputs(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            output_dir = root / "outputs"
            output_dir.mkdir()
            published_paths = [
                output_dir / "fund_list_2026q2.csv",
                output_dir / "fetch_status_2026q2.csv",
                output_dir / "holdings_stock_2026q2.csv",
                output_dir / "fund_holdings_2026q2.xlsx",
                output_dir / "run_summary_2026q2.json",
            ]
            for path in published_paths:
                path.write_bytes(f"old:{path.name}".encode("utf-8"))

            args = SimpleNamespace(
                year=2026,
                quarter=2,
                types="stock",
                workers=1,
                topline=1000,
                limit=1,
                refresh=False,
                progress_every=0,
                output_dir="outputs",
                cache_dir="data/eastmoney_cache",
            )
            fund = {
                "code": "000001",
                "name": "测试基金",
                "type": "混合型",
                "pinyin_short": "CSJJ",
                "pinyin_full": "CESHIJIJIN",
                "is_qdii": "否",
            }
            record = {
                "fund": fund,
                "holdings": {"stock": []},
                "status": {
                    "stock": {
                        "status": "no_data",
                        "rows": 0,
                        "cutoff_date": "",
                        "fetch_source": "cache",
                        "error": "",
                    }
                },
            }
            original_replace = Path.replace

            def fail_status_publish(path: Path, target: Path):
                if Path(target) == output_dir / "fetch_status_2026q2.csv":
                    raise OSError("injected grouped publish failure")
                return original_replace(path, target)

            def build_stub(path: Path, *_args, **_kwargs):
                path.write_bytes(b"new workbook")
                return []

            with (
                mock.patch.object(fetch_fund_holdings, "parse_args", return_value=args),
                mock.patch.object(fetch_fund_holdings.Path, "cwd", return_value=root),
                mock.patch.object(fetch_fund_holdings, "fetch_text", return_value=("", "cache")),
                mock.patch.object(fetch_fund_holdings, "parse_fund_list", return_value=[fund]),
                mock.patch.object(fetch_fund_holdings, "fetch_one_fund", return_value=record),
                mock.patch.object(fetch_fund_holdings, "build_workbook", side_effect=build_stub),
                mock.patch.object(
                    fetch_fund_holdings,
                    "validate_workbook",
                    return_value={"opened": True},
                ),
                mock.patch.object(Path, "replace", new=fail_status_publish),
            ):
                with self.assertRaisesRegex(OSError, "injected grouped publish failure"):
                    fetch_fund_holdings.main()

            for path in published_paths:
                self.assertEqual(path.read_bytes(), f"old:{path.name}".encode("utf-8"))

    def test_fund_report_write_failure_keeps_previous_published_outputs(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            output_dir = root / "outputs"
            output_dir.mkdir()
            source_csv = output_dir / "holdings_stock_2026q2.csv"
            source_csv.write_text("source", encoding="utf-8")
            output_csv = output_dir / "holdings_fund_investment_2026q2.csv"
            summary_json = output_dir / "fund_report_holdings_summary_2026q2.json"
            output_csv.write_bytes(b"old csv")
            summary_json.write_bytes(b"old summary")

            args = SimpleNamespace(
                year=2026,
                quarter=2,
                workers=1,
                refresh=False,
                limit=1,
                progress_every=0,
                output_dir="outputs",
                cache_dir="data/eastmoney_cache",
                candidate_scope="overseas-lof",
            )
            fund = {"code": "000001", "name": "测试基金", "type": "混合型"}
            result = {
                "fund": fund,
                "status": "ok",
                "rows": [["value"] * len(fetch_fund_report_holdings.HOLDING_HEADERS)],
                "error": "",
            }
            safe_csv_row = fetch_fund_report_holdings.safe_csv_row
            call_count = 0

            def fail_on_data_row(values):
                nonlocal call_count
                call_count += 1
                if call_count == 2:
                    raise RuntimeError("injected row write failure")
                return safe_csv_row(values)

            with (
                mock.patch.object(fetch_fund_report_holdings, "ROOT", root),
                mock.patch.object(fetch_fund_report_holdings, "parse_args", return_value=args),
                mock.patch.object(
                    fetch_fund_report_holdings,
                    "load_quarter_config",
                    return_value=SimpleNamespace(report="2026Q2"),
                ),
                mock.patch.object(
                    fetch_fund_report_holdings,
                    "load_candidate_funds",
                    return_value={fund["code"]: fund},
                ),
                mock.patch.object(fetch_fund_report_holdings, "fetch_one_fund", return_value=result),
                mock.patch.object(fetch_fund_report_holdings, "safe_csv_row", side_effect=fail_on_data_row),
            ):
                with self.assertRaisesRegex(RuntimeError, "injected row write failure"):
                    fetch_fund_report_holdings.main()

            self.assertEqual(output_csv.read_bytes(), b"old csv")
            self.assertEqual(summary_json.read_bytes(), b"old summary")

    def test_fund_report_error_status_keeps_previous_published_outputs(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            output_dir = root / "outputs"
            output_dir.mkdir()
            source_csv = output_dir / "holdings_stock_2026q2.csv"
            source_csv.write_text("source", encoding="utf-8")
            output_csv = output_dir / "holdings_fund_investment_2026q2.csv"
            summary_json = output_dir / "fund_report_holdings_summary_2026q2.json"
            output_csv.write_bytes(b"old csv")
            summary_json.write_bytes(b"old summary")

            args = SimpleNamespace(
                year=2026,
                quarter=2,
                workers=1,
                refresh=False,
                limit=1,
                progress_every=0,
                output_dir="outputs",
                cache_dir="data/eastmoney_cache",
                candidate_scope="overseas-lof",
            )
            fund = {"code": "000001", "name": "测试基金", "type": "混合型"}
            result = {
                "fund": fund,
                "status": "error",
                "rows": [],
                "error": "injected source error",
            }

            with (
                mock.patch.object(fetch_fund_report_holdings, "ROOT", root),
                mock.patch.object(fetch_fund_report_holdings, "parse_args", return_value=args),
                mock.patch.object(
                    fetch_fund_report_holdings,
                    "load_quarter_config",
                    return_value=SimpleNamespace(report="2026Q2"),
                ),
                mock.patch.object(
                    fetch_fund_report_holdings,
                    "load_candidate_funds",
                    return_value={fund["code"]: fund},
                ),
                mock.patch.object(fetch_fund_report_holdings, "fetch_one_fund", return_value=result),
            ):
                for failure_status in ("error", "pdf_parse_error"):
                    with self.subTest(status=failure_status):
                        result["status"] = failure_status
                        with self.assertRaisesRegex(RuntimeError, failure_status):
                            fetch_fund_report_holdings.main()
                        self.assertEqual(output_csv.read_bytes(), b"old csv")
                        self.assertEqual(summary_json.read_bytes(), b"old summary")

    def test_fund_report_publish_failure_rolls_back_csv(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            output_dir = root / "outputs"
            output_dir.mkdir()
            source_csv = output_dir / "holdings_stock_2026q2.csv"
            source_csv.write_text("source", encoding="utf-8")
            output_csv = output_dir / "holdings_fund_investment_2026q2.csv"
            summary_json = output_dir / "fund_report_holdings_summary_2026q2.json"
            output_csv.write_bytes(b"old csv")
            summary_json.write_bytes(b"old summary")

            args = SimpleNamespace(
                year=2026,
                quarter=2,
                workers=1,
                refresh=False,
                limit=1,
                progress_every=0,
                output_dir="outputs",
                cache_dir="data/eastmoney_cache",
                candidate_scope="overseas-lof",
            )
            fund = {"code": "000001", "name": "测试基金", "type": "混合型"}
            result = {
                "fund": fund,
                "status": "ok",
                "rows": [["value"] * len(fetch_fund_report_holdings.HOLDING_HEADERS)],
                "error": "",
            }
            original_replace = Path.replace

            def fail_summary_publish(path: Path, target: Path):
                if Path(target) == summary_json:
                    raise OSError("injected grouped publish failure")
                return original_replace(path, target)

            with (
                mock.patch.object(fetch_fund_report_holdings, "ROOT", root),
                mock.patch.object(fetch_fund_report_holdings, "parse_args", return_value=args),
                mock.patch.object(
                    fetch_fund_report_holdings,
                    "load_quarter_config",
                    return_value=SimpleNamespace(report="2026Q2"),
                ),
                mock.patch.object(
                    fetch_fund_report_holdings,
                    "load_candidate_funds",
                    return_value={fund["code"]: fund},
                ),
                mock.patch.object(fetch_fund_report_holdings, "fetch_one_fund", return_value=result),
                mock.patch.object(Path, "replace", new=fail_summary_publish),
            ):
                with self.assertRaisesRegex(OSError, "injected grouped publish failure"):
                    fetch_fund_report_holdings.main()

            self.assertEqual(output_csv.read_bytes(), b"old csv")
            self.assertEqual(summary_json.read_bytes(), b"old summary")


if __name__ == "__main__":
    unittest.main()
