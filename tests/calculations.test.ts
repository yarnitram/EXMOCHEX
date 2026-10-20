import { describe, it, expect } from "vitest";
import {
  pnlDollars,
  pnlPct,
  rMultiple,
  resolveLeverageFromNotes,
  enrichTrade,
  summarizeTrades,
} from "@/lib/calculations";
import type { Trade } from "@/lib/types";

describe("calculations - PnL & Risk Math", () => {
  it("computes pnlDollars for long positions accurately including fees", () => {
    const longWin: Partial<Trade> = {
      direction: "long",
      entry_price: 50000,
      exit_price: 55000,
      size: 2,
      fees: 20,
    };
    // Gross = (55000 - 50000) * 2 = 10000. Net = 10000 - 20 = 9980
    expect(pnlDollars(longWin)).toBe(9980);

    const longLoss: Partial<Trade> = {
      direction: "long",
      entry_price: 50000,
      exit_price: 48000,
      size: 1,
      fees: 5,
    };
    // Gross = (48000 - 50000) * 1 = -2000. Net = -2000 - 5 = -2005
    expect(pnlDollars(longLoss)).toBe(-2005);
  });

  it("computes pnlDollars for short positions accurately including fees", () => {
    const shortWin: Partial<Trade> = {
      direction: "short",
      entry_price: 3000,
      exit_price: 2700,
      size: 5,
      fees: 15,
    };
    // Gross = (3000 - 2700) * 5 = 1500. Net = 1500 - 15 = 1485
    expect(pnlDollars(shortWin)).toBe(1485);

    const shortLoss: Partial<Trade> = {
      direction: "short",
      entry_price: 3000,
      exit_price: 3200,
      size: 2,
      fees: 10,
    };
    // Gross = (3000 - 3200) * 2 = -400. Net = -400 - 10 = -410
    expect(pnlDollars(shortLoss)).toBe(-410);
  });

  it("returns 0 pnlDollars when trade is still open (no exit_price)", () => {
    const openTrade: Partial<Trade> = {
      direction: "long",
      entry_price: 100,
      exit_price: null,
      size: 10,
    };
    expect(pnlDollars(openTrade)).toBe(0);
  });

  it("calculates pnlPct with leverage scaling correctly", () => {
    // Notional = 100 * 10 = 1000. Exit = 110. Gross PnL = 100.
    // 1x leverage: (100 / 1000) * 1 * 100 = 10%
    const trade1x: Partial<Trade> = {
      direction: "long",
      entry_price: 100,
      exit_price: 110,
      size: 10,
      fees: 0,
      leverage: 1,
    };
    expect(pnlPct(trade1x)).toBe(10);

    // 10x leverage: (100 / 1000) * 10 * 100 = 100%
    const trade10x: Partial<Trade> = {
      direction: "long",
      entry_price: 100,
      exit_price: 110,
      size: 10,
      fees: 0,
      leverage: 10,
    };
    expect(pnlPct(trade10x)).toBe(100);

    // 0 notional returns 0
    expect(pnlPct({ entry_price: 0, size: 0 })).toBe(0);
  });

  it("computes rMultiple relative to risk at stop price", () => {
    const trade: Partial<Trade> = {
      direction: "long",
      entry_price: 100,
      stop_price: 90, // risked $10 per unit * 5 units = $50 risked
      exit_price: 120, // made $20 per unit * 5 units = $100
      size: 5,
      fees: 0,
    };
    // R-multiple = 100 / 50 = 2.0R
    expect(rMultiple(trade)).toBe(2);

    // No stop loss set returns null
    expect(rMultiple({ ...trade, stop_price: null })).toBeNull();

    // Open trade returns null
    expect(rMultiple({ ...trade, exit_price: null })).toBeNull();
  });

  it("resolves leverage accurately from notes strings", () => {
    expect(resolveLeverageFromNotes("Setup info. Leverage: 20x")).toBe(20);
    expect(resolveLeverageFromNotes("Scalp · 50x")).toBe(50);
    expect(resolveLeverageFromNotes("Leverage: 12.5x with trailing stop")).toBe(12.5);
    expect(resolveLeverageFromNotes("No leverage info here")).toBeNull();
    expect(resolveLeverageFromNotes(null)).toBeNull();
  });

  it("enriches trade with all derived analytics fields", () => {
    const rawTrade = {
      id: "t1",
      direction: "long" as const,
      entry_price: 200,
      exit_price: 250,
      stop_price: 180,
      size: 1,
      fees: 2,
      notes: { post_trade_review: "Good fill · 10x" },
    };
    const enriched = enrichTrade(rawTrade);
    expect(enriched.leverage).toBe(10);
    expect(enriched.pnl_dollars).toBe(48); // (250 - 200) * 1 - 2 = 48
    expect(enriched.pnl_pct).toBe((48 / 200) * 10 * 100); // 240%
    expect(enriched.r_multiple).toBe(48 / 20); // 2.4R
  });

  it("summarizes a collection of trades into AnalyticsSummary", () => {
    const trades = [
      {
        id: "t1",
        account_id: "a1",
        symbol: "BTC_USDT",
        direction: "long" as const,
        entry_price: 60000,
        exit_price: 63000,
        size: 1,
        fees: 10,
        stop_price: 59000,
        status: "closed" as const,
        entry_time: "2026-10-10T10:00:00Z",
        exit_time: "2026-10-10T12:00:00Z",
        created_at: "2026-10-10T10:00:00Z",
        tags: [],
      },
      {
        id: "t2",
        account_id: "a1",
        symbol: "ETH_USDT",
        direction: "short" as const,
        entry_price: 3000,
        exit_price: 3100,
        size: 5,
        fees: 10,
        stop_price: 3050,
        status: "closed" as const,
        entry_time: "2026-10-11T10:00:00Z",
        exit_time: "2026-10-11T12:00:00Z",
        created_at: "2026-10-11T10:00:00Z",
        tags: [],
      },
    ];

    const summary = summarizeTrades(trades as any);
    expect(summary.tradeCount).toBe(2);
    expect(summary.winners).toBe(1);
    expect(summary.losers).toBe(1);
    expect(summary.winRate).toBe(0.5);
    expect(summary.netPnl).toBe(2990 - 510); // 2480
  });
});
