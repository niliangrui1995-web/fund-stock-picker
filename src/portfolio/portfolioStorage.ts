import { canonicalizeSecurityCode } from "../securityIdentity";
import type {
  BasketDraft,
  BasketValidationResult,
  PortfolioStorageReadResult,
  PortfolioStorageWriteResult,
  PortfolioStoreV1,
  SavedBasket,
} from "./types";

export const PORTFOLIO_STORAGE_KEY = "chuhaiqianyan.portfolio-baskets.v1";

const MAX_BASKET_NAME_LENGTH = 40;
const MAX_STOCK_CODES_PER_BASKET = 10;
const STORE_KEYS = new Set(["schemaVersion", "activeBasketId", "baskets"]);

export interface ValidateBasketDraftOptions {
  existingBaskets?: readonly SavedBasket[];
  currentBasketId?: string;
  allowNameCollision?: boolean;
}

export function createEmptyPortfolioStore(): PortfolioStoreV1 {
  return { schemaVersion: 1, activeBasketId: null, baskets: [] };
}

export function validateBasketDraft(
  draft: BasketDraft,
  validStockCodes: Set<string>,
  options: ValidateBasketDraftOptions = {},
): BasketValidationResult {
  if (typeof draft?.name !== "string") {
    return { ok: false, reason: "组合名称不能为空。" };
  }

  const name = draft.name.trim();
  if (name.length === 0) {
    return { ok: false, reason: "组合名称不能为空。" };
  }
  if (name.length > MAX_BASKET_NAME_LENGTH) {
    return { ok: false, reason: "组合名称最多 40 个字符。" };
  }
  if (!Array.isArray(draft.stockCodes) || draft.stockCodes.length === 0) {
    return { ok: false, reason: "组合至少选择 1 只股票。" };
  }
  if (draft.stockCodes.length > MAX_STOCK_CODES_PER_BASKET) {
    return { ok: false, reason: "每个组合最多选择 10 只股票。" };
  }

  const codes = new Set<string>();
  for (const stockCode of draft.stockCodes) {
    if (typeof stockCode !== "string" || stockCode.trim().length === 0) {
      return { ok: false, reason: "股票代码不能为空。" };
    }
    if (!validStockCodes.has(stockCode)) {
      return {
        ok: false,
        reason: `股票代码 ${stockCode} 不在当前可搜索范围内。`,
      };
    }
    if (codes.has(stockCode)) {
      return { ok: false, reason: "组合内不能重复添加同一只股票。" };
    }
    codes.add(stockCode);
  }

  const hasCollision = options.existingBaskets?.some((basket) =>
    basket.id !== options.currentBasketId && basket.name === name,
  ) ?? false;
  if (hasCollision && options.allowNameCollision !== true) {
    return { ok: false, reason: "已存在同名组合，请改名或明确覆盖。" };
  }

  return { ok: true, value: { name, stockCodes: [...draft.stockCodes] } };
}

export function readPortfolioStore(
  storage: Storage,
  validStockCodes: Set<string>,
): PortfolioStorageReadResult {
  let raw: string | null;
  try {
    raw = storage.getItem(PORTFOLIO_STORAGE_KEY);
  } catch {
    return {
      kind: "unavailable",
      store: createEmptyPortfolioStore(),
      reason: "无法读取本机保存，已使用当前会话空草稿。",
    };
  }

  if (raw === null) {
    return { kind: "ready", store: createEmptyPortfolioStore() };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return recoveredEmpty("本机组合记录损坏，已改为空草稿。");
  }

  if (!isSafeRecord(parsed)) {
    return recoveredEmpty("本机组合记录格式无效，已改为空草稿。");
  }
  if (parsed.schemaVersion !== 1) {
    return recoveredEmpty("本机组合记录版本不受支持，已改为空草稿。");
  }
  if (!hasOnlyStoreKeys(parsed) || !Array.isArray(parsed.baskets)) {
    return recoveredEmpty("本机组合记录格式无效，已改为空草稿。");
  }

  const baskets: SavedBasket[] = [];
  const ids = new Set<string>();
  const names = new Set<string>();
  let isolatedCount = 0;
  for (const candidate of parsed.baskets) {
    const basket = parseSavedBasket(candidate, validStockCodes);
    if (basket === null || ids.has(basket.id) || names.has(basket.name)) {
      isolatedCount += 1;
      continue;
    }
    ids.add(basket.id);
    names.add(basket.name);
    baskets.push(basket);
  }

  const requestedActiveId = parsed.activeBasketId;
  const activeBasketId = typeof requestedActiveId === "string" && ids.has(requestedActiveId)
    ? requestedActiveId
    : requestedActiveId === null && isolatedCount === 0
      ? null
      : baskets[0]?.id ?? null;
  const activeWasRecovered = requestedActiveId !== activeBasketId;
  const store: PortfolioStoreV1 = { schemaVersion: 1, activeBasketId, baskets };

  const reasons: string[] = [];
  if (isolatedCount > 0) {
    reasons.push(`已隔离 ${isolatedCount} 个无效组合，其他已保存组合仍可使用。`);
  }
  if (activeWasRecovered) {
    reasons.push("当前组合指向无效记录，已切换到可用组合。");
  }
  if (reasons.length > 0) {
    return { kind: "recovered", store, reason: reasons.join(" ") };
  }
  return { kind: "ready", store };
}

export function writePortfolioStore(
  storage: Storage,
  store: PortfolioStoreV1,
  validStockCodes: Set<string>,
): PortfolioStorageWriteResult {
  const validation = validateStoreForWrite(store, validStockCodes);
  if (!validation.ok) {
    return validation;
  }

  try {
    storage.setItem(PORTFOLIO_STORAGE_KEY, JSON.stringify(validation.store));
  } catch {
    return { ok: false, reason: "无法保存到本机，当前研究仍可继续。" };
  }
  return { ok: true };
}

function recoveredEmpty(reason: string): PortfolioStorageReadResult {
  return { kind: "recovered", store: createEmptyPortfolioStore(), reason };
}

function isSafeRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyStoreKeys(value: Record<string, unknown>): boolean {
  return Object.keys(value).every((key) => STORE_KEYS.has(key))
    && Object.prototype.hasOwnProperty.call(value, "schemaVersion")
    && Object.prototype.hasOwnProperty.call(value, "activeBasketId")
    && Object.prototype.hasOwnProperty.call(value, "baskets");
}

function parseSavedBasket(
  candidate: unknown,
  validStockCodes: Set<string>,
): SavedBasket | null {
  if (!isSafeRecord(candidate)
    || typeof candidate.id !== "string"
    || candidate.id.trim().length === 0
    || candidate.id !== candidate.id.trim()
    || typeof candidate.createdAt !== "string"
    || typeof candidate.updatedAt !== "string"
    || !isIsoTimestamp(candidate.createdAt)
    || !isIsoTimestamp(candidate.updatedAt)) {
    return null;
  }

  const originalCodes = candidate.stockCodes;
  const migratedCodes = Array.isArray(originalCodes) && originalCodes.every((code) => typeof code === "string") && new Set(originalCodes).size === originalCodes.length
    ? [...new Set(originalCodes.map((code) => canonicalizeSecurityCode(code)))]
    : originalCodes;
  const validation = validateBasketDraft(
    { name: candidate.name as string, stockCodes: migratedCodes as string[] },
    validStockCodes,
  );
  if (!validation.ok
    || candidate.name !== validation.value.name
    || !Array.isArray(candidate.stockCodes)
    || candidate.stockCodes.some((code) => typeof code !== "string")) {
    return null;
  }
  return {
    id: candidate.id,
    name: validation.value.name,
    stockCodes: validation.value.stockCodes,
    createdAt: candidate.createdAt,
    updatedAt: candidate.updatedAt,
  };
}

function isIsoTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function validateStoreForWrite(
  store: PortfolioStoreV1,
  validStockCodes: Set<string>,
): { ok: true; store: PortfolioStoreV1 } | { ok: false; reason: string } {
  if (!isSafeRecord(store) || store.schemaVersion !== 1 || !Array.isArray(store.baskets)) {
    return { ok: false, reason: "无法保存：本地组合结构无效。" };
  }

  const ids = new Set<string>();
  const names = new Set<string>();
  const baskets: SavedBasket[] = [];
  for (const candidate of store.baskets) {
    const basket = parseSavedBasket(candidate, validStockCodes);
    if (basket === null) {
      return { ok: false, reason: "无法保存：组合内容无效。" };
    }
    if (ids.has(basket.id)) {
      return { ok: false, reason: "无法保存：组合 ID 重复。" };
    }
    if (names.has(basket.name)) {
      return { ok: false, reason: "无法保存：已存在同名组合，请改名或明确覆盖。" };
    }
    ids.add(basket.id);
    names.add(basket.name);
    baskets.push(basket);
  }

  if (store.activeBasketId !== null
    && (typeof store.activeBasketId !== "string" || !ids.has(store.activeBasketId))) {
    return { ok: false, reason: "无法保存：当前活动组合无效。" };
  }
  return {
    ok: true,
    store: {
      schemaVersion: 1,
      activeBasketId: store.activeBasketId,
      baskets,
    },
  };
}
