export const validStockCodes = new Set([
  "NVDA",
  "TSM",
  "MSFT",
  "AAPL",
  "AMZN",
  "META",
  "GOOGL",
  "AVGO",
  "TSLA",
  "AMD",
  "ASML",
]);

export class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  clearCalls = 0;
  removeCalls = 0;
  getError: Error | null = null;
  setError: Error | null = null;

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.clearCalls += 1;
    this.values.clear();
  }

  getItem(key: string): string | null {
    if (this.getError !== null) {
      throw this.getError;
    }
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.removeCalls += 1;
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.setError !== null) {
      throw this.setError;
    }
    this.values.set(key, value);
  }
}

export function savedBasket(overrides: Partial<{
  id: string;
  name: string;
  stockCodes: string[];
  createdAt: string;
  updatedAt: string;
}> = {}) {
  return {
    id: "basket-ai",
    name: "AI 核心",
    stockCodes: ["NVDA", "TSM"],
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
    ...overrides,
  };
}
