from __future__ import annotations

from collections.abc import Iterable
from typing import Any


_DANGEROUS_FORMULA_PREFIXES = frozenset("=+-@＝＋－＠")
_ZERO_WIDTH_PREFIXES = frozenset("\u200b\u200c\u200d\u2060\ufeff")


def _formula_candidate(value: str) -> str:
    """Remove leading characters that spreadsheet importers can ignore before formulas."""
    index = 0
    while index < len(value):
        character = value[index]
        codepoint = ord(character)
        if (
            character.isspace()
            or codepoint <= 0x1F
            or 0x7F <= codepoint <= 0x9F
            or character in _ZERO_WIDTH_PREFIXES
        ):
            index += 1
            continue
        break
    return value[index:]


def _is_formula_like(value: Any) -> tuple[Any, bool]:
    if not isinstance(value, str):
        return value, False

    candidate = _formula_candidate(value)
    is_formula = bool(candidate) and candidate[0] in _DANGEROUS_FORMULA_PREFIXES
    return (candidate if is_formula else value), is_formula


def safe_csv_value(value: Any) -> Any:
    """Prefix cells Excel could evaluate as a formula with a single leading tab."""
    candidate, is_formula = _is_formula_like(value)
    return f"\t{candidate}" if is_formula else value


def safe_csv_row(values: Iterable[Any]) -> list[Any]:
    return [safe_csv_value(value) for value in values]


def safe_xlsx_value(value: Any) -> tuple[Any, bool]:
    return _is_formula_like(value)


def append_safe_xlsx_row(worksheet: Any, values: Iterable[Any]) -> None:
    """Append values while forcing formula-like external text to an XLSX string cell."""
    prepared = [safe_xlsx_value(value) for value in values]
    safe_values = [value for value, _is_formula in prepared]

    if getattr(worksheet.parent, "write_only", False):
        from openpyxl.cell import WriteOnlyCell

        cells = []
        for value, is_formula in prepared:
            cell = WriteOnlyCell(worksheet, value=value)
            if is_formula:
                cell.data_type = "s"
            cells.append(cell)
        worksheet.append(cells)
        return

    worksheet.append(safe_values)
    row_number = worksheet.max_row
    for column_number, (_value, is_formula) in enumerate(prepared, start=1):
        if is_formula:
            worksheet.cell(row=row_number, column=column_number).data_type = "s"
