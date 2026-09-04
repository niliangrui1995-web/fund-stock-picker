import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { canonicalizeSecurityCode } from "../securityIdentity";

import { aggregatePortfolioResults } from "./aggregatePortfolioResults";
import { loadPortfolioFundDetails, loadPortfolioIndex } from "./portfolioIndex";
import {
  createEmptyPortfolioStore,
  readPortfolioStore,
  validateBasketDraft,
  writePortfolioStore,
} from "./portfolioStorage";
import type {
  AggregatedFundResult,
  AggregatedPortfolioResults,
  BasketDraft,
  PortfolioDetailRecord,
  PortfolioManifest,
  PortfolioStorageReadResult,
  PortfolioStoreV1,
  SavedBasket,
} from "./types";

export type { AggregatedFundResult } from "./types";

export interface PortfolioStockOption {
  code: string;
  name: string;
  aliases?: string[];
  marketLabel?: string;
}

export type PortfolioDetailState =
  | { kind: "idle" }
  | { kind: "loading"; fund: AggregatedFundResult }
  | { kind: "available"; fund: AggregatedFundResult; record: Extract<PortfolioDetailRecord, { detailStatus: "available" }> }
  | { kind: "notCaptured"; fund: AggregatedFundResult; message: string }
  | { kind: "unavailable"; fund: AggregatedFundResult; reason: string };

export type PendingUnsavedAction =
  | { kind: "create"; trigger: HTMLElement | null }
  | { kind: "temporary"; code: string; trigger: HTMLElement | null }
  | { kind: "switch"; basketId: string; trigger: HTMLElement | null }
  | { kind: "leave"; trigger: HTMLElement | null; action: () => void };

export interface PortfolioResearchModel {
  draft: BasketDraft;
  activeBasketId: string | null;
  baskets: SavedBasket[];
  isTemporary: boolean;
  dirty: boolean;
  status: "idle" | "loading" | "ready" | "blocked";
  error: string | null;
  recoveryReason: string | null;
  saveError: string | null;
  manifest: PortfolioManifest | null;
  results: AggregatedPortfolioResults | null;
  pendingAction: PendingUnsavedAction | null;
  detail: PortfolioDetailState;
  create(trigger?: HTMLElement | null): void;
  addStock(code: string): void;
  removeStock(code: string): void;
  saveActive(): boolean;
  saveAs(name: string): boolean;
  renameActive(name: string): void;
  requestSwitch(basketId: string, trigger: HTMLElement | null): void;
  requestDelete(basketId: string, trigger: HTMLElement | null): void;
  requestLeave(action: () => void, trigger: HTMLElement | null): void;
  resolveUnsavedDecision(decision: "save" | "discard" | "cancel"): void;
  retry(): void;
  openDetail(fund: AggregatedFundResult): void;
  retryDetail(): void;
  closeDetail(): void;
}

export interface UsePortfolioResearchOptions {
  stocks: PortfolioStockOption[];
  manifestUrl: string;
  temporaryStockCode?: string | null;
  temporarySelection?: { code: string; requestId: number; trigger: HTMLElement | null };
  fetchImpl?: typeof fetch;
}

function initialStore(validCodes: Set<string>): PortfolioStorageReadResult {
  if (typeof window === "undefined") {
    return { kind: "ready", store: createEmptyPortfolioStore() };
  }
  try {
    return readPortfolioStore(window.localStorage, validCodes);
  } catch {
    return {
      kind: "unavailable",
      store: createEmptyPortfolioStore(),
      reason: "无法读取本机保存，已使用当前会话空草稿。",
    };
  }
}

function basketDraft(basket: SavedBasket | undefined): BasketDraft {
  return basket === undefined
    ? { name: "", stockCodes: [] }
    : { name: basket.name, stockCodes: [...basket.stockCodes] };
}

function sameDraft(left: BasketDraft, right: BasketDraft): boolean {
  return left.name === right.name && left.stockCodes.length === right.stockCodes.length &&
    left.stockCodes.every((code, index) => code === right.stockCodes[index]);
}

function createBasketId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `basket-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function currentBasket(store: PortfolioStoreV1, basketId: string | null): SavedBasket | undefined {
  return basketId === null ? undefined : store.baskets.find((item) => item.id === basketId);
}

function stockCodesKey(stockCodes: readonly string[]): string {
  return stockCodes.join("\u0000");
}

function restoreActionTrigger(trigger: HTMLElement | null): void {
  if (typeof window === "undefined") return;
  window.requestAnimationFrame(() => {
    if (trigger?.isConnected && typeof trigger.focus === "function") {
      trigger.focus();
    }
  });
}

export function usePortfolioResearch(options: UsePortfolioResearchOptions): PortfolioResearchModel {
  const stockCodeKey = options.stocks.map((stock) => stock.code).join("\u0000");
  const validCodes = useMemo(() => new Set(options.stocks.map((stock) => stock.code)), [stockCodeKey]);
  const restored = useMemo(() => initialStore(validCodes), [validCodes]);
  const [store, setStore] = useState<PortfolioStoreV1>(() => restored.store);
  const storeRef = useRef(store);
  storeRef.current = store;
  const [draft, setDraft] = useState<BasketDraft>(() => basketDraft(currentBasket(restored.store, restored.store.activeBasketId)));
  const [activeBasketId, setActiveBasketId] = useState<string | null>(() => restored.store.activeBasketId);
  const [dirty, setDirty] = useState(false);
  const [isTemporary, setIsTemporary] = useState(false);
  const [status, setStatus] = useState<PortfolioResearchModel["status"]>("idle");
  const [error, setError] = useState<string | null>(null);
  const [recoveryReason, setRecoveryReason] = useState<string | null>(
    restored.kind === "ready" ? null : restored.reason,
  );
  const [saveError, setSaveError] = useState<string | null>(null);
  const [manifest, setManifest] = useState<PortfolioManifest | null>(null);
  const [results, setResults] = useState<AggregatedPortfolioResults | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingUnsavedAction | null>(null);
  const [detail, setDetail] = useState<PortfolioDetailState>({ kind: "idle" });
  const [retryToken, setRetryToken] = useState(0);
  const [statusForCodesKey, setStatusForCodesKey] = useState("");
  const [resultsForCodesKey, setResultsForCodesKey] = useState("");
  const requestTokenRef = useRef(0);
  const detailControllerRef = useRef<AbortController | null>(null);
  const storageHydratedRef = useRef(validCodes.size > 0);
  const handledTemporaryRequestRef = useRef<number | string | null>(null);
  const draftCodesKey = stockCodesKey(draft.stockCodes);
  const currentDraftCodesKeyRef = useRef(draftCodesKey);
  currentDraftCodesKeyRef.current = draftCodesKey;
  const savedDraft = currentBasket(store, activeBasketId);
  const unsavedChanges = dirty && (!savedDraft || !sameDraft(draft, basketDraft(savedDraft)));

  useEffect(() => {
    if (storageHydratedRef.current || validCodes.size === 0) return;
    const recovered = initialStore(validCodes);
    storageHydratedRef.current = true;
    setStore(recovered.store);
    setActiveBasketId(recovered.store.activeBasketId);
    setDraft(basketDraft(currentBasket(recovered.store, recovered.store.activeBasketId)));
    setRecoveryReason(recovered.kind === "ready" ? null : recovered.reason);
  }, [validCodes]);

  useEffect(() => {
    if (!unsavedChanges || typeof window === "undefined") return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [unsavedChanges]);

  useEffect(() => {
    const codes = draft.stockCodes;
    const codesKey = stockCodesKey(codes);
    const token = requestTokenRef.current + 1;
    requestTokenRef.current = token;
    const controller = new AbortController();
    detailControllerRef.current?.abort();
    setDetail({ kind: "idle" });
    if (codes.length === 0) {
      setManifest(null);
      setResults(null);
      setResultsForCodesKey("");
      setStatusForCodesKey(codesKey);
      setStatus("idle");
      setError(null);
      return () => controller.abort();
    }

    setStatusForCodesKey(codesKey);
    setStatus("loading");
    setError(null);
    setResults(null);
    setResultsForCodesKey("");
    loadPortfolioIndex({
      manifestUrl: options.manifestUrl,
      selectedStockCodes: codes,
      signal: controller.signal,
      fetchImpl: options.fetchImpl,
    }).then((loaded) => {
      if (controller.signal.aborted || token !== requestTokenRef.current || codesKey !== currentDraftCodesKeyRef.current) return;
      setManifest(loaded.manifest);
      setResults(aggregatePortfolioResults({ selectedStockCodes: codes, shards: loaded.shards }));
      setResultsForCodesKey(codesKey);
      setStatus("ready");
    }).catch((loadError: unknown) => {
      if (controller.signal.aborted || token !== requestTokenRef.current || codesKey !== currentDraftCodesKeyRef.current) return;
      setManifest(null);
      setResults(null);
      setResultsForCodesKey("");
      setStatus("blocked");
      setError(loadError instanceof Error ? loadError.message : "组合数据暂时不可用。");
    });
    return () => controller.abort();
  }, [draft.stockCodes, options.fetchImpl, options.manifestUrl, retryToken]);

  const persist = useCallback((nextStore: PortfolioStoreV1): boolean => {
    if (typeof window === "undefined") {
      setSaveError("无法保存到本机，当前研究仍可继续。");
      return false;
    }
    let outcome;
    try {
      outcome = writePortfolioStore(window.localStorage, nextStore, validCodes);
    } catch {
      outcome = { ok: false as const, reason: "无法保存到本机，当前研究仍可继续。" };
    }
    if (!outcome.ok) {
      setSaveError(outcome.reason);
      return false;
    }
    setStore(nextStore);
    storeRef.current = nextStore;
    setSaveError(null);
    return true;
  }, [validCodes]);

  const saveAs = useCallback((name: string): boolean => {
    const candidate = { name, stockCodes: draft.stockCodes };
    const validation = validateBasketDraft(candidate, validCodes, { existingBaskets: store.baskets });
    if (!validation.ok) {
      setSaveError(validation.reason);
      return false;
    }
    const now = new Date().toISOString();
    const basket: SavedBasket = {
      id: createBasketId(),
      ...validation.value,
      createdAt: now,
      updatedAt: now,
    };
    const nextStore = { schemaVersion: 1 as const, activeBasketId: basket.id, baskets: [...store.baskets, basket] };
    if (!persist(nextStore)) return false;
    setDraft(validation.value);
    setActiveBasketId(basket.id);
    setIsTemporary(false);
    setDirty(false);
    return true;
  }, [draft.stockCodes, persist, store.baskets, validCodes]);

  const saveActive = useCallback((): boolean => {
    if (activeBasketId === null) return saveAs(draft.name);
    const validation = validateBasketDraft(draft, validCodes, {
      existingBaskets: store.baskets,
      currentBasketId: activeBasketId,
    });
    if (!validation.ok) {
      setSaveError(validation.reason);
      return false;
    }
    const existing = currentBasket(store, activeBasketId);
    if (existing === undefined) {
      setSaveError("当前组合不存在，无法保存。");
      return false;
    }
    const updated = { ...existing, ...validation.value, updatedAt: new Date().toISOString() };
    const nextStore = {
      schemaVersion: 1 as const,
      activeBasketId,
      baskets: store.baskets.map((basket) => basket.id === activeBasketId ? updated : basket),
    };
    if (!persist(nextStore)) return false;
    setDraft(validation.value);
    setDirty(false);
    return true;
  }, [activeBasketId, draft, persist, saveAs, store, validCodes]);

  const switchTo = useCallback((basketId: string) => {
    const currentStore = storeRef.current;
    const basket = currentStore.baskets.find((item) => item.id === basketId);
    if (!basket) return;
    if (!persist({ ...currentStore, activeBasketId: basketId })) return;
    setDraft(basketDraft(basket));
    setActiveBasketId(basket.id);
    setIsTemporary(false);
    setDirty(false);
    setSaveError(null);
    setPendingAction(null);
  }, [persist]);

  const deleteBasket = useCallback((basketId: string) => {
    const nextBaskets = store.baskets.filter((item) => item.id !== basketId);
    const nextActive = activeBasketId === basketId ? nextBaskets[0]?.id ?? null : activeBasketId;
    const nextStore = { schemaVersion: 1 as const, activeBasketId: nextActive, baskets: nextBaskets };
    if (!persist(nextStore)) return;
    setActiveBasketId(nextActive);
    setDraft(basketDraft(nextBaskets.find((item) => item.id === nextActive)));
    setIsTemporary(false);
    setDirty(false);
    setPendingAction(null);
  }, [activeBasketId, persist, store.baskets]);

  const runPending = useCallback((action: PendingUnsavedAction) => {
    if (action.kind === "create") {
      setDraft({ name: "", stockCodes: [] });
      setActiveBasketId(null);
      setIsTemporary(false);
      setDirty(false);
      setSaveError(null);
      setPendingAction(null);
    } else if (action.kind === "temporary") {
      setDraft({ name: "临时研究", stockCodes: [action.code] });
      setActiveBasketId(null);
      setIsTemporary(true);
      setDirty(false);
      setSaveError(null);
      setPendingAction(null);
    } else if (action.kind === "switch") switchTo(action.basketId);
    else {
      setDirty(false);
      setPendingAction(null);
      action.action();
    }
  }, [switchTo]);

  const withProtection = useCallback((action: PendingUnsavedAction) => {
    if (unsavedChanges) setPendingAction(action);
    else runPending(action);
  }, [unsavedChanges, runPending]);

  useEffect(() => {
    const selection = options.temporarySelection;
    const rawCode = selection?.code ?? options.temporaryStockCode ?? null;
    const code = rawCode ? canonicalizeSecurityCode(rawCode) : null;
    const requestKey = selection?.requestId ?? code;
    if (!code || requestKey === null || !validCodes.has(code) || handledTemporaryRequestRef.current === requestKey) return;
    handledTemporaryRequestRef.current = requestKey;
    withProtection({ kind: "temporary", code, trigger: selection?.trigger ?? null });
  }, [options.temporarySelection, options.temporaryStockCode, validCodes, withProtection]);

  const openDetail = useCallback((fund: AggregatedFundResult) => {
    if (manifest === null) {
      setDetail({ kind: "unavailable", fund, reason: "详情暂时不可用：组合结果尚未准备完成。" });
      return;
    }
    detailControllerRef.current?.abort();
    const controller = new AbortController();
    detailControllerRef.current = controller;
    setDetail({ kind: "loading", fund });
    loadPortfolioFundDetails({
      manifestUrl: options.manifestUrl,
      manifest,
      fundFamilyKey: fund.fundFamilyKey,
      signal: controller.signal,
      fetchImpl: options.fetchImpl,
    }).then((record) => {
      if (controller.signal.aborted) return;
      if (record.detailStatus === "available") setDetail({ kind: "available", fund, record });
      else setDetail({ kind: "notCaptured", fund, message: record.detailMessage });
    }).catch((detailError: unknown) => {
      if (controller.signal.aborted) return;
      setDetail({ kind: "unavailable", fund, reason: detailError instanceof Error ? detailError.message : "详情暂时不可用。" });
    });
  }, [manifest, options.fetchImpl, options.manifestUrl]);

  const displayIsCurrent = statusForCodesKey === draftCodesKey;
  const displayStatus = displayIsCurrent ? status : draft.stockCodes.length > 0 ? "loading" : "idle";
  const displayResults = resultsForCodesKey === draftCodesKey ? results : null;
  const displayManifest = resultsForCodesKey === draftCodesKey ? manifest : null;

  return {
    draft,
    activeBasketId,
    baskets: store.baskets,
    isTemporary,
    dirty: unsavedChanges,
    status: displayStatus,
    error: displayIsCurrent ? error : null,
    recoveryReason,
    saveError,
    manifest: displayManifest,
    results: displayResults,
    pendingAction,
    detail,
    create: (trigger = null) => withProtection({ kind: "create", trigger }),
    addStock: (rawCode) => {
      const code = canonicalizeSecurityCode(rawCode);
      if (!validCodes.has(code)) {
        setSaveError(`股票代码 ${code} 不在当前可搜索范围内。`);
        return;
      }
      if (draft.stockCodes.includes(code)) {
        setSaveError("组合内不能重复添加同一只股票。");
        return;
      }
      if (draft.stockCodes.length >= 10) {
        setSaveError("每个组合最多选择 10 只股票。");
        return;
      }
      setDraft((current) => ({ ...current, stockCodes: [...current.stockCodes, code] }));
      setDirty(true);
      setSaveError(null);
    },
    removeStock: (code) => {
      if (!draft.stockCodes.includes(code)) return;
      setDraft((current) => ({ ...current, stockCodes: current.stockCodes.filter((item) => item !== code) }));
      setDirty(true);
    },
    saveActive,
    saveAs,
    renameActive: (name) => {
      setDraft((current) => ({ ...current, name }));
      setDirty(true);
    },
    requestSwitch: (basketId, trigger) => withProtection({ kind: "switch", basketId, trigger }),
    requestDelete: (basketId) => deleteBasket(basketId),
    requestLeave: (action, trigger) => withProtection({ kind: "leave", action, trigger }),
    resolveUnsavedDecision: (decision) => {
      const action = pendingAction;
      if (action === null || decision === "cancel") {
        setPendingAction(null);
        restoreActionTrigger(action?.trigger ?? null);
        return;
      }
      if (decision === "save" && !saveActive()) return;
      if (decision === "discard") {
        setDirty(false);
        if (action.kind === "leave") setDraft(basketDraft(currentBasket(store, activeBasketId)));
      }
      runPending(action);
    },
    retry: () => setRetryToken((value) => value + 1),
    openDetail,
    retryDetail: () => {
      if (detail.kind === "unavailable") openDetail(detail.fund);
    },
    closeDetail: () => {
      detailControllerRef.current?.abort();
      setDetail({ kind: "idle" });
    },
  };
}
