import { describe, it, expect } from "vitest";

// Replicating pure normalization logic from tradingview route for unit verification
function normalizeSymbol(raw: string): string {
  let s = raw.trim().toUpperCase();
  if (s.includes(":")) {
    s = s.split(":")[1];
  }
  s = s.replace(/\.P$/i, "");
  s = s.replace(/[\/\-]/g, "_");
  if (!s.includes("_")) {
    if (s.endsWith("USDT")) {
      s = s.slice(0, -4) + "_USDT";
    } else {
      s = s + "_USDT";
    }
  }
  return s;
}

function normalizeSide(raw: unknown): "long" | "short" {
  const s = String(raw || "").trim().toLowerCase();
  if (["short", "sell", "put", "bear", "down"].includes(s)) {
    return "short";
  }
  return "long";
}

describe("TradingView Webhook Normalization Logic", () => {
  it("normalizes diverse exchange symbol strings into MEXC standard format", () => {
    expect(normalizeSymbol("BINANCE:BTCUSDT.P")).toBe("BTC_USDT");
    expect(normalizeSymbol("BYBIT:ETHUSDT")).toBe("ETH_USDT");
    expect(normalizeSymbol("SOLUSDT")).toBe("SOL_USDT");
    expect(normalizeSymbol("PEPE-USDT")).toBe("PEPE_USDT");
    expect(normalizeSymbol("DOGE/USDT")).toBe("DOGE_USDT");
    expect(normalizeSymbol("BTC")).toBe("BTC_USDT");
  });

  it("normalizes directional side values accurately", () => {
    expect(normalizeSide("buy")).toBe("long");
    expect(normalizeSide("LONG")).toBe("long");
    expect(normalizeSide("bull")).toBe("long");

    expect(normalizeSide("sell")).toBe("short");
    expect(normalizeSide("SHORT")).toBe("short");
    expect(normalizeSide("bear")).toBe("short");
    expect(normalizeSide("put")).toBe("short");
  });
});
