import registry from "../config/security-identities.json";

export type SecurityMarket = "us" | "hk" | "jp" | "kr" | "a" | "other";
export type SecurityIdentity = {
  code: string;
  name: string;
  market: SecurityMarket;
  marketLabel: string;
  exchange: string;
  aliases: string[];
  identityStatus: "verified" | "disclosed" | "pending";
};

const identityKey = (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
const identities = new Map(registry.securities.flatMap((item) => item.aliases.map((alias) => [identityKey(alias), item] as const)));

/** Only explicitly verified aliases are merged; unknown disclosure codes stay intact. */
export function canonicalizeSecurityCode(code: string): string {
  return identities.get(identityKey(code))?.code ?? code.trim();
}

export function getSecurityIdentity(code: string, name = ""): SecurityIdentity {
  const item = identities.get(identityKey(code));
  if (item) {
    return {
      code: item.code,
      name: item.name,
      market: item.market as SecurityMarket,
      marketLabel: item.marketLabel,
      exchange: item.exchange,
      aliases: [...new Set([...item.aliases, ...item.nameAliases])],
      identityStatus: "verified",
    };
  }
  const normalized = code.trim().toUpperCase();
  let market: SecurityMarket = "other";
  let exchange = "交易所待核对";
  let identityStatus: SecurityIdentity["identityStatus"] = "pending";
  if (/^[A-Z0-9./-]+(?:US|UW|UN)(?:EQUITY)?$/.test(normalized)) {
    market = "us";
    exchange = "美国（披露市场标记）";
  } else if (/^\d{1,5}(?:HK|HG|HS)(?:EQUITY)?$/.test(normalized) || /^\d{1,5}\.HK$/.test(normalized)) {
    market = "hk";
    exchange = "香港（披露市场标记）";
  } else if (/^\d{5}$/.test(normalized)) {
    market = "hk";
    exchange = "HKEX";
    identityStatus = "disclosed";
  } else if (/^\d{6}[.]?(?:KS|KQ|KP)$/.test(normalized) || (/^\d{6}$/.test(normalized) && /SK\s*(?:HYNIX|海力)|三星|SAMSUNG|韩国|KOREA|现代汽车|起亚|LG|NAVER|Kakao|浦项|POSCO|Celltrion|韩华/i.test(name))) {
    market = "kr";
    exchange = "韩国（披露代码）";
  } else if (/^\d{4}\.(?:T|JP)$/.test(normalized) || (/^\d{4}$/.test(normalized) && /东京|丰田|索尼|日立|三菱|任天堂|软银|本田|东京电子|三井|住友|瑞穗|武田|迅销|基恩士|信越|村田|电装|佳能|尼康|日本/.test(name))) {
    market = "jp";
    exchange = "日本（披露代码）";
    identityStatus = "disclosed";
  } else if (/^[A-Z]{1,5}(?:[./-][A-Z]{1,2})?$/.test(normalized)) {
    market = "other";
    exchange = "交易所待核对";
    identityStatus = "pending";
  } else if (/^\d{6}$|^A\d+$/.test(normalized)) {
    market = "a";
    exchange = "中国内地（披露代码）";
    identityStatus = "disclosed";
  }
  const labels = { us: "美股", hk: "港股", kr: "韩股", jp: "日股", a: "A股", other: "市场待核对" };
  return { code: code.trim(), name: name || code.trim(), market, marketLabel: labels[market], exchange, aliases: [], identityStatus };
}

export function getSecurityMarket(code: string, name = ""): SecurityMarket {
  return getSecurityIdentity(code, name).market;
}
