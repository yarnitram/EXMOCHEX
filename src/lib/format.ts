/** Format a USD amount with right-aligned friendly precision. */
export function money(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const abs = Math.abs(v);
  const digits = abs >= 1000 ? 2 : abs >= 1 ? 2 : 4;
  return (
    (v < 0 ? "-$" : "$") +
    abs.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: digits,
    })
  );
}

/** Format a percent with explicit sign. */
export function percent(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

/** Format an R-multiple with sign. */
export function r(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}R`;
}

export function signed(v: number, digits = 2): string {
  return `${v >= 0 ? "+" : ""}${v.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

// ---- Watchlist / MEXC helpers ----

/**
 * Strip the _USDT suffix from a MEXC futures symbol.
 * e.g. "BTC_USDT" → "BTC"
 */
export function cleanSymbol(s: string): string {
  return s.replace(/_USDT$/i, "");
}

/**
 * Format a MEXC last-price with adaptive precision:
 * ≥ 1000 → 1 decimal, ≥ 1 → 3 decimals, < 1 → 6 decimals.
 */
export function fmtPx(p: number): string {
  if (p >= 1000)
    return p.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (p >= 1)
    return p.toLocaleString("en-US", { maximumFractionDigits: 3 });
  return p.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

/**
 * Format a plan price (trigger / EP / SL / TP) with up to 7 decimal places,
 * trailing zeros after the decimal point trimmed.
 * e.g. 0.5000000 → "0.5"
 */
export function fmtPlanPx(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return "—";
  const s = p.toLocaleString("en-US", { maximumFractionDigits: 7 });
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

/**
 * Format a 24 h rise/fall rate as a signed percentage.
 * MEXC returns this as a decimal fraction (0.0512 → "+5.12%").
 */
export function fmtPct(f: number): string {
  return `${f >= 0 ? "+" : ""}${(f * 100).toFixed(2)}%`;
}

/**
 * Compact USD volume display.
 * e.g. 1_230_000_000 → "$1.23B", 456_780 → "$456.78K"
 */
export function compact(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/**
 * Generate external MEXC futures chart URL for a symbol.
 * e.g. "BTC" or "BTC_USDT" → "https://www.mexc.co/futures/BTC_USDT"
 */
export function mexcChartUrl(symbol: string): string {
  if (!symbol) return "https://www.mexc.co/futures";
  const clean = symbol.trim().toUpperCase();
  const formattedSymbol = clean.includes("_") ? clean : `${clean}_USDT`;
  return `https://www.mexc.co/futures/${formattedSymbol}`;
}

/**
 * Calculate and format days active from an added_at ISO date string.
 * Returns text like "Today" (if < 24h or same day) or "1d", "5d", "14d",
 * and a full formatted date for the hover tooltip.
 */
export function formatDaysActive(
  addedAt: string | null | undefined,
  nowMs: number = Date.now()
): { text: string; fullDate: string; days: number } {
  if (!addedAt) return { text: "—", fullDate: "", days: -1 };
  const added = new Date(addedAt);
  const time = added.getTime();
  if (isNaN(time)) return { text: "—", fullDate: "", days: -1 };

  const diffMs = nowMs - time;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const fullDate = added.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (days <= 0) {
    return { text: "Today", fullDate, days: 0 };
  }
  return { text: `${days}d`, fullDate, days };
}
