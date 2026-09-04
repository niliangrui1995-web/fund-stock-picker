"""Shared, evidence-bounded security identifiers for static data generation."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any


CONFIG = json.loads((Path(__file__).resolve().parents[1] / "config/security-identities.json").read_text(encoding="utf-8"))


def identity_key(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", value.strip().upper())


IDENTITIES = {identity_key(alias): item for item in CONFIG["securities"] for alias in item["aliases"]}


def verified_code_aliases() -> dict[str, str]:
    return {key: item["code"] for key, item in IDENTITIES.items()}


def canonicalize_security_code(code: str) -> str:
    item = IDENTITIES.get(identity_key(code))
    return item["code"] if item else code.strip()


def security_identity(code: str, name: str = "") -> dict[str, Any]:
    item = IDENTITIES.get(identity_key(code))
    if item:
        return {
            key: item[key] for key in ("code", "name", "market", "marketLabel", "exchange", "identityStatus")
        } | {"aliases": list(dict.fromkeys([*item["aliases"], *item.get("nameAliases", [])]))}
    normalized = code.strip().upper()
    market, exchange, status = "other", "交易所待核对", "pending"
    if re.fullmatch(r"[A-Z0-9./-]+(?:US|UW|UN)(?:EQUITY)?", normalized):
        market, exchange = "us", "美国（披露市场标记）"
    elif re.fullmatch(r"\d{1,5}(?:HK|HG|HS)(?:EQUITY)?", normalized) or re.fullmatch(r"\d{1,5}\.HK", normalized):
        market, exchange = "hk", "香港（披露市场标记）"
    elif re.fullmatch(r"\d{5}", normalized):
        market, exchange, status = "hk", "HKEX", "disclosed"
    elif re.fullmatch(r"\d{6}[.]?(?:KS|KQ|KP)", normalized) or (re.fullmatch(r"\d{6}", normalized) and re.search(r"SK\s*(?:HYNIX|海力)|三星|SAMSUNG|韩国|KOREA|现代汽车|起亚|LG|NAVER|Kakao|浦项|POSCO|Celltrion|韩华", name, re.I)):
        market, exchange = "kr", "韩国（披露代码）"
    elif re.fullmatch(r"\d{4}\.(?:T|JP)", normalized) or (re.fullmatch(r"\d{4}", normalized) and re.search(r"东京|丰田|索尼|日立|三菱|任天堂|软银|本田|东京电子|三井|住友|瑞穗|武田|迅销|基恩士|信越|村田|电装|佳能|尼康|日本", name)):
        market, exchange, status = "jp", "日本（披露代码）", "disclosed"
    elif re.fullmatch(r"[A-Z]{1,5}(?:[./-][A-Z]{1,2})?", normalized):
        market, exchange, status = "other", "交易所待核对", "pending"
    elif re.fullmatch(r"\d{6}|A\d+", normalized):
        market, exchange, status = "a", "中国内地（披露代码）", "disclosed"
    labels = {"us": "美股", "hk": "港股", "kr": "韩股", "jp": "日股", "a": "A股", "other": "市场待核对"}
    return {"code": code.strip(), "name": name or code.strip(), "market": market, "marketLabel": labels[market], "exchange": exchange, "aliases": [], "identityStatus": status}
