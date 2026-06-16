from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config" / "fund-quarter.json"


def report_label(year: int, quarter: int) -> str:
    return f"{year}Q{quarter}"


def cutoff_date_for_quarter(year: int, quarter: int) -> str:
    return {
        1: f"{year}-03-31",
        2: f"{year}-06-30",
        3: f"{year}-09-30",
        4: f"{year}-12-31",
    }[quarter]


def month_for_quarter(quarter: int) -> int:
    return {1: 3, 2: 6, 3: 9, 4: 12}[quarter]


@dataclass(frozen=True)
class FundQuarterConfig:
    year: int
    quarter: int
    root: Path = ROOT

    @property
    def report(self) -> str:
        return report_label(self.year, self.quarter)

    @property
    def slug(self) -> str:
        return self.report.lower()

    @property
    def cutoff_date(self) -> str:
        return cutoff_date_for_quarter(self.year, self.quarter)

    @property
    def source_stock_csv_relative(self) -> Path:
        return Path("outputs") / f"holdings_stock_{self.slug}.csv"

    @property
    def run_summary_json_relative(self) -> Path:
        return Path("outputs") / f"run_summary_{self.slug}.json"

    @property
    def fund_stock_index_json_relative(self) -> Path:
        return Path("public") / "data" / f"fund-stock-index-{self.slug}.json"

    @property
    def overseas_ai_workbook_relative(self) -> Path:
        return Path("outputs") / f"overseas_ai_exposure_{self.slug}.xlsx"

    @property
    def overseas_ai_ranking_csv_relative(self) -> Path:
        return Path("outputs") / f"overseas_ai_fund_ranking_{self.slug}.csv"

    @property
    def overseas_ai_detail_csv_relative(self) -> Path:
        return Path("outputs") / f"overseas_ai_position_details_{self.slug}.csv"

    @property
    def overseas_ai_summary_json_relative(self) -> Path:
        return Path("outputs") / f"overseas_ai_exposure_summary_{self.slug}.json"

    @property
    def source_stock_csv(self) -> Path:
        return self.root / self.source_stock_csv_relative

    @property
    def run_summary_json(self) -> Path:
        return self.root / self.run_summary_json_relative

    @property
    def fund_stock_index_json(self) -> Path:
        return self.root / self.fund_stock_index_json_relative

    @property
    def overseas_ai_workbook(self) -> Path:
        return self.root / self.overseas_ai_workbook_relative

    @property
    def overseas_ai_ranking_csv(self) -> Path:
        return self.root / self.overseas_ai_ranking_csv_relative

    @property
    def overseas_ai_detail_csv(self) -> Path:
        return self.root / self.overseas_ai_detail_csv_relative

    @property
    def overseas_ai_summary_json(self) -> Path:
        return self.root / self.overseas_ai_summary_json_relative


def _validate_config(raw_config: dict[str, Any]) -> tuple[int, int]:
    year = raw_config.get("year")
    quarter = raw_config.get("quarter")
    if not isinstance(year, int) or year < 2000:
        raise ValueError("config/fund-quarter.json must contain an integer year >= 2000.")
    if quarter not in (1, 2, 3, 4):
        raise ValueError("config/fund-quarter.json quarter must be one of 1, 2, 3, 4.")
    return year, quarter


def load_quarter_config() -> FundQuarterConfig:
    raw_config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    year, quarter = _validate_config(raw_config)
    return FundQuarterConfig(year=year, quarter=quarter)
