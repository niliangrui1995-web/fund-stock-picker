import { describe, expect, it } from "vitest";

import {
  PORTFOLIO_STORAGE_KEY,
  readPortfolioStore,
  validateBasketDraft,
  writePortfolioStore,
} from "../portfolioStorage";
import { MemoryStorage, savedBasket, validStockCodes } from "./fixtures";

describe("portfolioStorage", () => {
  it("恢复旧组合时仅合并已核实证券别名，保留未知代码且不重复持仓", () => {
    const storage = new MemoryStorage();
    storage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, activeBasketId: "legacy", baskets: [savedBasket({ id: "legacy", stockCodes: ["NVDAUS", "NVDAUW", "NVDA", "UNKNOWNUS"] })] }));
    const result = readPortfolioStore(storage, new Set(["NVDA", "UNKNOWNUS"]));
    expect(result.kind).toBe("ready");
    expect(result.store.baskets[0].stockCodes).toEqual(["NVDA", "UNKNOWNUS"]);
    expect(result.store.activeBasketId).toBe("legacy");
    expect(JSON.parse(storage.getItem(PORTFOLIO_STORAGE_KEY)!).baskets[0].stockCodes).toEqual(["NVDAUS", "NVDAUW", "NVDA", "UNKNOWNUS"]);
  });
  it("空存储返回可用的空草稿存储", () => {
    const result = readPortfolioStore(new MemoryStorage(), validStockCodes);

    expect(result).toEqual({
      kind: "ready",
      store: { schemaVersion: 1, activeBasketId: null, baskets: [] },
    });
  });

  it("写入后可以恢复已保存组合和活动组合", () => {
    const storage = new MemoryStorage();
    const store = {
      schemaVersion: 1 as const,
      activeBasketId: "basket-ai",
      baskets: [savedBasket()],
    };

    expect(writePortfolioStore(storage, store, validStockCodes)).toEqual({ ok: true });
    expect(readPortfolioStore(storage, validStockCodes)).toEqual({ kind: "ready", store });
  });

  it("拒绝重复代码、第 11 只、空白或过长名称及不可搜索代码", () => {
    const elevenCodes = Array.from(validStockCodes);

    expect(validateBasketDraft({ name: "AI", stockCodes: ["NVDA", "NVDA"] }, validStockCodes))
      .toEqual({ ok: false, reason: "组合内不能重复添加同一只股票。" });
    expect(validateBasketDraft({ name: "AI", stockCodes: elevenCodes }, validStockCodes))
      .toEqual({ ok: false, reason: "每个组合最多选择 10 只股票。" });
    expect(validateBasketDraft({ name: "   ", stockCodes: ["NVDA"] }, validStockCodes))
      .toEqual({ ok: false, reason: "组合名称不能为空。" });
    expect(validateBasketDraft({ name: "a".repeat(41), stockCodes: ["NVDA"] }, validStockCodes))
      .toEqual({ ok: false, reason: "组合名称最多 40 个字符。" });
    expect(validateBasketDraft({ name: "AI", stockCodes: [" "] }, validStockCodes))
      .toEqual({ ok: false, reason: "股票代码不能为空。" });
    expect(validateBasketDraft({ name: "AI", stockCodes: ["UNKNOWN"] }, validStockCodes))
      .toEqual({ ok: false, reason: "股票代码 UNKNOWN 不在当前可搜索范围内。" });
  });

  it("同名保存需要调用方明确允许覆盖", () => {
    const existing = savedBasket();
    const draft = { name: " AI 核心 ", stockCodes: ["NVDA"] };

    expect(validateBasketDraft(draft, validStockCodes, { existingBaskets: [existing] }))
      .toEqual({ ok: false, reason: "已存在同名组合，请改名或明确覆盖。" });
    expect(validateBasketDraft(draft, validStockCodes, {
      existingBaskets: [existing],
      allowNameCollision: true,
    })).toEqual({ ok: true, value: { name: "AI 核心", stockCodes: ["NVDA"] } });
  });

  it("写入时拒绝重复 id 和未明确覆盖的同名组合", () => {
    const storage = new MemoryStorage();
    const duplicateIdStore = {
      schemaVersion: 1 as const,
      activeBasketId: "one",
      baskets: [
        savedBasket({ id: "one", name: "组合一" }),
        savedBasket({ id: "one", name: "组合二", stockCodes: ["TSM"] }),
      ],
    };
    const duplicateNameStore = {
      schemaVersion: 1 as const,
      activeBasketId: "one",
      baskets: [
        savedBasket({ id: "one", name: "组合一" }),
        savedBasket({ id: "two", name: "组合一", stockCodes: ["TSM"] }),
      ],
    };

    expect(writePortfolioStore(storage, duplicateIdStore, validStockCodes)).toEqual({
      ok: false,
      reason: "无法保存：组合 ID 重复。",
    });
    expect(writePortfolioStore(storage, duplicateNameStore, validStockCodes)).toEqual({
      ok: false,
      reason: "无法保存：已存在同名组合，请改名或明确覆盖。",
    });
  });

  it("损坏 JSON 和不支持的根 schema 都恢复为空草稿", () => {
    const storage = new MemoryStorage();
    storage.setItem(PORTFOLIO_STORAGE_KEY, "{");
    const malformed = readPortfolioStore(storage, validStockCodes);
    storage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify({ schemaVersion: 2, baskets: [] }));
    const unsupported = readPortfolioStore(storage, validStockCodes);

    expect(malformed).toMatchObject({
      kind: "recovered",
      store: { schemaVersion: 1, activeBasketId: null, baskets: [] },
      reason: expect.stringContaining("损坏"),
    });
    expect(unsupported).toMatchObject({
      kind: "recovered",
      store: { schemaVersion: 1, activeBasketId: null, baskets: [] },
      reason: expect.stringContaining("版本"),
    });
  });

  it("只隔离非法组合并保留另一条有效记录", () => {
    const storage = new MemoryStorage();
    storage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      activeBasketId: "good",
      baskets: [
        savedBasket({ id: "bad", stockCodes: ["UNKNOWN"] }),
        savedBasket({ id: "good", name: "可恢复组合" }),
      ],
    }));

    expect(readPortfolioStore(storage, validStockCodes)).toEqual({
      kind: "recovered",
      store: {
        schemaVersion: 1,
        activeBasketId: "good",
        baskets: [savedBasket({ id: "good", name: "可恢复组合" })],
      },
      reason: "已隔离 1 个无效组合，其他已保存组合仍可使用。",
    });
  });

  it("拒绝未知根字段、伪造原型字段和无效 ISO 时间而不信任输入", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      PORTFOLIO_STORAGE_KEY,
      '{"schemaVersion":1,"activeBasketId":null,"baskets":[],"__proto__":{"polluted":true}}',
    );
    const poisoned = readPortfolioStore(storage, validStockCodes);
    storage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      activeBasketId: "basket-ai",
      baskets: [savedBasket({ createdAt: "2026/08/28" })],
    }));
    const invalidDate = readPortfolioStore(storage, validStockCodes);

    expect(poisoned).toMatchObject({
      kind: "recovered",
      store: { schemaVersion: 1, activeBasketId: null, baskets: [] },
      reason: expect.stringContaining("格式无效"),
    });
    expect(invalidDate).toMatchObject({
      kind: "recovered",
      store: { baskets: [] },
      reason: expect.stringContaining("已隔离"),
    });
  });

  it("无效活动组合会稳定回退到首个保留组合并报告恢复原因", () => {
    const storage = new MemoryStorage();
    storage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify({
      schemaVersion: 1,
      activeBasketId: "missing",
      baskets: [
        savedBasket({ id: "first", name: "第一组" }),
        savedBasket({ id: "second", name: "第二组", stockCodes: ["TSM"] }),
      ],
    }));

    expect(readPortfolioStore(storage, validStockCodes)).toEqual({
      kind: "recovered",
      store: {
        schemaVersion: 1,
        activeBasketId: "first",
        baskets: [
          savedBasket({ id: "first", name: "第一组" }),
          savedBasket({ id: "second", name: "第二组", stockCodes: ["TSM"] }),
        ],
      },
      reason: "当前组合指向无效记录，已切换到可用组合。",
    });
  });

  it("读取或写入被浏览器阻止时给出中文原因，不假装已保存", () => {
    const readStorage = new MemoryStorage();
    readStorage.getError = new Error("SecurityError");
    const writeStorage = new MemoryStorage();
    writeStorage.setError = new Error("QuotaExceededError");
    const store = { schemaVersion: 1 as const, activeBasketId: null, baskets: [] };

    expect(readPortfolioStore(readStorage, validStockCodes)).toEqual({
      kind: "unavailable",
      store,
      reason: "无法读取本机保存，已使用当前会话空草稿。",
    });
    expect(writePortfolioStore(writeStorage, store, validStockCodes)).toEqual({
      ok: false,
      reason: "无法保存到本机，当前研究仍可继续。",
    });
  });

  it("绝不清理或删除其他业务键", () => {
    const storage = new MemoryStorage();
    storage.setItem("other-feature", "keep");
    storage.setItem(PORTFOLIO_STORAGE_KEY, "{");

    readPortfolioStore(storage, validStockCodes);
    writePortfolioStore(storage, { schemaVersion: 1, activeBasketId: null, baskets: [] }, validStockCodes);

    expect(storage.getItem("other-feature")).toBe("keep");
    expect(storage.clearCalls).toBe(0);
    expect(storage.removeCalls).toBe(0);
  });
});
