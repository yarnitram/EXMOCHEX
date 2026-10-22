// ============================================================
// Shared types, constants, and localStorage helpers for the
// Watchlist feature. Imported by watchlist-client.tsx and its
// sub-components (watchlist-toolbar, watchlist-row, etc.).
// ============================================================

// ---- Live ticker data from MEXC ----

export interface Ticker {
  symbol: string;
  lastPrice: number;
  bid1: number;
  ask1: number;
  volume24: number;
  amount24: number;
  holdVol: number;
  lower24Price: number;
  high24Price: number;
  riseFallRate: number;
  indexPrice: number;
  fundingRate: number;
}

// ---- Sort ----

export type SortField =
  | "status"
  | "coin"
  | "change"
  | "volume"
  | "price"
  | "trigger"
  | "daysActive";

export interface SortConfig {
  field: SortField;
  dir: "asc" | "desc";
}

export const DEFAULT_SORT: SortConfig = { field: "status", dir: "asc" };

export const SORT_OPTIONS: { value: SortConfig; label: string }[] = [
  { value: { field: "status", dir: "asc" }, label: "Status" },
  { value: { field: "coin", dir: "asc" }, label: "Coin (A–Z)" },
  { value: { field: "coin", dir: "desc" }, label: "Coin (Z–A)" },
  { value: { field: "change", dir: "desc" }, label: "24h % (high → low)" },
  { value: { field: "change", dir: "asc" }, label: "24h % (low → high)" },
  { value: { field: "volume", dir: "desc" }, label: "Volume (high → low)" },
  { value: { field: "volume", dir: "asc" }, label: "Volume (low → high)" },
  { value: { field: "price", dir: "desc" }, label: "Last price (high → low)" },
  { value: { field: "price", dir: "asc" }, label: "Last price (low → high)" },
  { value: { field: "trigger", dir: "desc" }, label: "Trigger (high → low)" },
  { value: { field: "trigger", dir: "asc" }, label: "Trigger (low → high)" },
  { value: { field: "daysActive", dir: "desc" }, label: "Days active: oldest first" },
  { value: { field: "daysActive", dir: "asc" }, label: "Days active: newest first" },
];

export function sortConfigKey(c: SortConfig): string {
  return `${c.field}:${c.dir}`;
}

// ---- Column visibility ----

/** Toggleable table columns — Coin and Actions are always shown. */
export type ColKey =
  | "position"
  | "change"
  | "volume"
  | "price"
  | "trigger"
  | "plan"
  | "orderType"
  | "daysActive"
  | "triggerAdded"
  | "firedAt"
  | "status";

export const COLUMNS: { key: ColKey; label: string }[] = [
  { key: "position", label: "Position" },
  { key: "change", label: "24h %" },
  { key: "volume", label: "Volume (24h)" },
  { key: "price", label: "Last Price" },
  { key: "trigger", label: "Trigger" },
  { key: "plan", label: "EP / SL / TP" },
  { key: "orderType", label: "Order type" },
  { key: "daysActive", label: "Days Active" },
  { key: "triggerAdded", label: "Trigger added" },
  { key: "firedAt", label: "Fired at" },
  { key: "status", label: "Status" },
];

export const DEFAULT_COLS: Record<ColKey, boolean> = {
  position: true,
  change: true,
  volume: true,
  price: true,
  trigger: true,
  plan: true,
  orderType: true,
  daysActive: true,
  triggerAdded: false,
  firedAt: false,
  status: false,
};

// ---- Order-type labels ----

export const ORDER_TYPE_LABELS: Record<string, string> = {
  limit: "Limit",
  trigger_limit: "Trigger Limit",
  market: "Market",
};

// ---- localStorage helpers ----

const SORT_KEY = "mochex:watchlist-sort";
const COLS_KEY = "mochex:watchlist-cols-v2";

export function loadSort(): SortConfig {
  try {
    const raw = localStorage.getItem(SORT_KEY);
    if (!raw) return DEFAULT_SORT;
    const parsed = JSON.parse(raw) as SortConfig;
    if (
      SORT_OPTIONS.some((o) => sortConfigKey(o.value) === sortConfigKey(parsed))
    ) {
      return parsed;
    }
    return DEFAULT_SORT;
  } catch {
    return DEFAULT_SORT;
  }
}

export function saveSort(c: SortConfig): void {
  try {
    localStorage.setItem(SORT_KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}

export function loadCols(): Record<ColKey, boolean> {
  try {
    const raw = localStorage.getItem(COLS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record<ColKey, boolean>>;
      return { ...DEFAULT_COLS, ...parsed };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_COLS };
}

export function saveCols(cols: Record<ColKey, boolean>): void {
  try {
    localStorage.setItem(COLS_KEY, JSON.stringify(cols));
  } catch {
    /* ignore */
  }
}
