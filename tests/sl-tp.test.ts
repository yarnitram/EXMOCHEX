import { describe, it, expect } from "vitest";
import { crossed, hitDirectionFor, detectHits, type SlTpCandidate } from "@/lib/sl-tp";
import { deriveTradeSide, sideForTrigger } from "@/lib/types";
import { calculateTradePnl } from "@/lib/trade-calc";

describe("sl-tp & trade-calc - Level Crossing & Position Math", () => {
  describe("crossed & hitDirectionFor", () => {
    it("determines correct crossing direction for LONG and SHORT", () => {
      // LONG: Stop Loss is hit when price moves DOWN to or below SL
      expect(hitDirectionFor("long", "sl")).toBe("down");
      // LONG: Take Profit is hit when price moves UP to or above TP
      expect(hitDirectionFor("long", "tp")).toBe("up");

      // SHORT: Stop Loss is hit when price moves UP to or above SL
      expect(hitDirectionFor("short", "sl")).toBe("up");
      // SHORT: Take Profit is hit when price moves DOWN to or below TP
      expect(hitDirectionFor("short", "tp")).toBe("down");
    });

    it("evaluates crossed levels accurately", () => {
      // Downwards crossing: price <= level
      expect(crossed(95, 100, "down")).toBe(true);
      expect(crossed(100, 100, "down")).toBe(true);
      expect(crossed(101, 100, "down")).toBe(false);

      // Upwards crossing: price >= level
      expect(crossed(105, 100, "up")).toBe(true);
      expect(crossed(100, 100, "up")).toBe(true);
      expect(crossed(99, 100, "up")).toBe(false);
    });
  });

  describe("detectHits", () => {
    it("detects stop loss hit for a LONG position", () => {
      const candidate: SlTpCandidate = {
        entry_price: 100,
        stop_loss: 90,
        take_profit: 120,
        trigger_direction: "below",
        sl_fired_at: null,
        tp_fired_at: null,
      };

      // Current price falls to 89
      const hits = detectHits(candidate, 89);
      expect(hits.length).toBe(1);
      expect(hits[0].level).toBe("sl");
      expect(hits[0].price).toBe(89);
    });

    it("detects take profit hit for a LONG position", () => {
      const candidate: SlTpCandidate = {
        entry_price: 100,
        stop_loss: 90,
        take_profit: 120,
        trigger_direction: "below",
        sl_fired_at: null,
        tp_fired_at: null,
      };

      // Current price rises to 121
      const hits = detectHits(candidate, 121);
      expect(hits.length).toBe(1);
      expect(hits[0].level).toBe("tp");
      expect(hits[0].price).toBe(121);
    });

    it("does not fire level that was already consumed (sl_fired_at != null)", () => {
      const candidate: SlTpCandidate = {
        entry_price: 100,
        stop_loss: 90,
        take_profit: 120,
        trigger_direction: "below",
        sl_fired_at: "2026-10-10T08:00:00Z",
        tp_fired_at: null,
      };

      const hits = detectHits(candidate, 85);
      expect(hits.length).toBe(0);
    });

    it("detects take profit hit for a SHORT position", () => {
      const candidate: SlTpCandidate = {
        entry_price: 100,
        stop_loss: 110,
        take_profit: 80,
        trigger_direction: "above",
        sl_fired_at: null,
        tp_fired_at: null,
      };

      // Price drops to 78 -> TP hit for short
      const hits = detectHits(candidate, 78);
      expect(hits.length).toBe(1);
      expect(hits[0].level).toBe("tp");
      expect(hits[0].price).toBe(78);
    });
  });

  describe("deriveTradeSide & sideForTrigger", () => {
    it("derives long when entry_price >= stop_loss", () => {
      expect(
        deriveTradeSide({
          entry_price: 100,
          stop_loss: 90,
          take_profit: 120,
        })
      ).toBe("long");
    });

    it("derives short when stop_loss > entry_price", () => {
      expect(
        deriveTradeSide({
          entry_price: 100,
          stop_loss: 110,
          take_profit: 80,
        })
      ).toBe("short");
    });

    it("falls back to trigger_direction when SL is absent", () => {
      expect(sideForTrigger("below")).toBe("long");
      expect(sideForTrigger("above")).toBe("short");
      expect(sideForTrigger(null)).toBe("long");
    });
  });

  describe("calculateTradePnl", () => {
    it("calculates PnL USD and % for long position", () => {
      // Entry 100, Exit 120, margin $100, 5x leverage -> notional $500, size 5 units
      // PnL = 5 * (120 - 100) = $100 USD. PnL % = (120/100 - 1) * 5 = 100%
      const res = calculateTradePnl(100, 120, "below", 100, 5);
      expect(res.realizedPnlUsd).toBe(100);
      expect(res.realizedPnlPct).toBeCloseTo(1); // 1.0 = 100%
      expect(res.positionSize).toBe(5);
      expect(res.notional).toBe(500);
    });

    it("calculates PnL USD and % for short position", () => {
      // Entry 100, Exit 80, margin $50, 2x leverage -> notional $100, size 1 unit
      // PnL = -1 * 1 * (80 - 100) = $20 USD. PnL % = -1 * (80/100 - 1) * 2 = 40%
      const res = calculateTradePnl(100, 80, "above", 50, 2);
      expect(res.realizedPnlUsd).toBe(20);
      expect(res.realizedPnlPct).toBeCloseTo(0.4);
      expect(res.positionSize).toBe(1);
      expect(res.notional).toBe(100);
    });

    it("returns null fields for invalid entry/exit prices", () => {
      const res = calculateTradePnl(null, 100, "below", 10, 1);
      expect(res.realizedPnlUsd).toBeNull();
      expect(res.positionSize).toBeNull();
    });
  });
});
