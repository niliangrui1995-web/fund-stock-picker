import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { canonicalizeSecurityCode, getSecurityIdentity, getSecurityMarket } from "../securityIdentity";
import { getVerifiedFundTradingClassification } from "../fundTradingClassification";

describe("verified security identities", () => {
  it("maps all disclosed NVIDIA versions and case/spacing variants to one security", () => {
    const codes = ["NVDA", "NVDAUS", "NVDAUW", "NVDAUSEquity", "nvda us equity"];
    expect(new Set(codes.map(canonicalizeSecurityCode))).toEqual(new Set(["NVDA"]));
    for (const code of codes) {
      expect(getSecurityIdentity(code)).toMatchObject({ code: "NVDA", name: "英伟达 NVIDIA", market: "us", exchange: "NASDAQ", identityStatus: "verified" });
    }
  });

  it("keeps share classes, depositary receipts, and unverified listings separate", () => {
    expect(canonicalizeSecurityCode("GOOGUS")).toBe("GOOG");
    expect(canonicalizeSecurityCode("GOOGLUS")).toBe("GOOGL");
    for (const code of ["2330", "TCEHYUV", "KYG875721634", "80700", "FAKEUS"]) {
      expect(canonicalizeSecurityCode(code)).toBe(code);
    }
    expect(getSecurityIdentity("ASMLNA").marketLabel).toBe("荷兰股");
    expect(getSecurityIdentity("ASMLUS").market).toBe("us");
  });

  it("uses reviewed Korean metadata even when the disclosed name is truncated", () => {
    expect(getSecurityMarket("000660", "SK 海力")).toBe("kr");
    expect(getSecurityIdentity("005930KS")).toMatchObject({ code: "005930", market: "kr", exchange: "KRX" });
    expect(getSecurityMarket("000001", "平安银行")).toBe("a");
    expect(getSecurityMarket("6981", "村田制作所")).toBe("jp");
    expect(getSecurityMarket("005380", "现代汽车")).toBe("kr");
    expect(getSecurityIdentity("SMSNLI", "三星电子有限公司")).toMatchObject({ market: "other", identityStatus: "pending" });
    expect(getSecurityIdentity("TSM").aliases).toContain("台湾积体电路制造股份有限公司");
  });

  it("labels unresolved disclosure versions without merging them", () => {
    expect(getSecurityIdentity("UNVERIFIEDUS", "报告中的证券")).toMatchObject({ code: "UNVERIFIEDUS", market: "us", identityStatus: "pending", aliases: [] });
    expect(getSecurityIdentity("KYG875721634", "腾讯控股")).toMatchObject({ market: "other", marketLabel: "市场待核对", identityStatus: "pending" });
    expect(getSecurityIdentity("UNREVIEWED", "未核实证券")).toMatchObject({ market: "other", identityStatus: "pending" });
    expect(getSecurityIdentity("ROP")).toMatchObject({ market: "other", identityStatus: "pending" });
  });

  it("unifies confirmed code and name versions while retaining each listed market", () => {
    for (const codes of [["INTC", "INTCUS", "INTCUW", "INTCUSEquity"], ["SNDK", "SNDKUS", "SNDKUW"], ["MRVL", "MRVLUS", "MRVLUW"], ["00981", "981", "981HK", "00981HG", "00981HS"]]) {
      expect(new Set(codes.map(canonicalizeSecurityCode))).toEqual(new Set([codes[0]]));
      expect(new Set(codes.map((code) => getSecurityIdentity(code).name)).size).toBe(1);
    }
    expect(getSecurityIdentity("2330TT")).toMatchObject({ code: "2330", marketLabel: "台股", exchange: "TWSE" });
    expect(getSecurityIdentity("TSMUS")).toMatchObject({ code: "TSM", market: "us" });
    expect(getSecurityIdentity("688981CH")).toMatchObject({ market: "a", marketLabel: "A股" });
    expect(canonicalizeSecurityCode("688981CH")).not.toBe(canonicalizeSecurityCode("00981HG"));
    expect(getSecurityIdentity("00981HG")).toMatchObject({ code: "00981", market: "hk" });
    expect(canonicalizeSecurityCode("BABAUS")).not.toBe(canonicalizeSecurityCode("9988HK"));
    expect(canonicalizeSecurityCode("GOOGUS")).not.toBe(canonicalizeSecurityCode("GOOGLUS"));
  });

  it("shares exact reviewed fund trading exceptions without overriding listed REITs", () => {
    for (const key of ["嘉实全球房地产", "摩根富时发达市场REITS指数(QDII)", "诺安全球收益不动产(QDII)", "鹏华美国房地产"]) {
      expect(getVerifiedFundTradingClassification(key)).toBe(false);
    }
    expect(getVerifiedFundTradingClassification("华安张江产业园REIT")).toBeUndefined();
  });

  it("keeps frontend identity metadata aligned with the current generated index", () => {
    const quarter = JSON.parse(readFileSync("config/fund-quarter.json", "utf8"));
    const payload = JSON.parse(readFileSync(`public/data/fund-stock-index-${quarter.year}q${quarter.quarter}.json`, "utf8"));
    for (const stock of payload.stocks) {
      const identity = getSecurityIdentity(stock.code, stock.name);
      expect({ code: identity.code, market: identity.market, identityStatus: identity.identityStatus }).toEqual({ code: stock.code, market: stock.market, identityStatus: stock.identityStatus });
    }
  });
});
