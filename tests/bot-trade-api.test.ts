import { describe, expect, it } from "vitest";
import {
  BOT_API_FIELDS_SPEC,
  extractApiKey,
  formatBotNotificationSummary,
  normalizeBotAction,
  normalizeBotSide,
  normalizeBotSymbol,
  sideToTriggerDirection,
} from "@/lib/bot-trade-api";

describe("Bot & Trade Webhook API Helpers", () => {
  describe("extractApiKey", () => {
    it("extracts key from X-API-Key header", () => {
      const req = new Request("https://mochex.app/api/trades/webhook", {
        headers: { "X-API-Key": "tv_sec_abc123" },
      });
      expect(extractApiKey(req)).toBe("tv_sec_abc123");
    });

    it("extracts key from Authorization Bearer header", () => {
      const req = new Request("https://mochex.app/api/trades/webhook", {
        headers: { Authorization: "Bearer tv_sec_bearer99" },
      });
      expect(extractApiKey(req)).toBe("tv_sec_bearer99");
    });

    it("extracts key from URL query parameters (?key= or ?api_key=)", () => {
      const req = new Request(
        "https://mochex.app/api/trades/webhook?key=tv_sec_query77"
      );
      expect(extractApiKey(req)).toBe("tv_sec_query77");
    });

    it("extracts key from JSON body when headers and query are empty", () => {
      const req = new Request("https://mochex.app/api/trades/webhook");
      expect(extractApiKey(req, { api_key: "tv_sec_body55" })).toBe(
        "tv_sec_body55"
      );
      expect(extractApiKey(req, { secret: "tv_sec_legacy" })).toBe(
        "tv_sec_legacy"
      );
    });

    it("returns null when no API key is present", () => {
      const req = new Request("https://mochex.app/api/trades/webhook");
      expect(extractApiKey(req, {})).toBeNull();
    });
  });

  describe("normalizeBotSymbol", () => {
    it("normalizes bare ticker, exchange prefixes, perpetual suffixes, and slashes to BASE_USDT", () => {
      expect(normalizeBotSymbol("btc")).toBe("BTC_USDT");
      expect(normalizeBotSymbol("SOLUSDT")).toBe("SOL_USDT");
      expect(normalizeBotSymbol("BINANCE:ETHUSDT.P")).toBe("ETH_USDT");
      expect(normalizeBotSymbol("PEPE/USDT")).toBe("PEPE_USDT");
      expect(normalizeBotSymbol("SUI-USDT-PERP")).toBe("SUI_USDT");
    });
  });

  describe("normalizeBotAction", () => {
    it("maps open, update, close, and watchlist actions accurately", () => {
      expect(normalizeBotAction({})).toBe("open");
      expect(normalizeBotAction({ action: "trade" })).toBe("open");
      expect(normalizeBotAction({ action: "execute" })).toBe("open");
      expect(normalizeBotAction({ action: "update" })).toBe("update");
      expect(normalizeBotAction({ action: "breakeven" })).toBe("update");
      expect(normalizeBotAction({ action: "close" })).toBe("close");
      expect(normalizeBotAction({ action: "tp_hit" })).toBe("close");
      expect(normalizeBotAction({ action: "watchlist" })).toBe("watchlist");
      expect(
        normalizeBotAction({ status: "closed", trade_id: "uuid-123" })
      ).toBe("close");
    });
  });

  describe("normalizeBotSide & sideToTriggerDirection", () => {
    it("resolves explicit long/buy and short/sell sides", () => {
      expect(normalizeBotSide({ side: "LONG" })).toBe("long");
      expect(normalizeBotSide({ side: "buy" })).toBe("long");
      expect(normalizeBotSide({ direction: "SHORT" })).toBe("short");
      expect(normalizeBotSide({ position: "sell" })).toBe("short");

      expect(sideToTriggerDirection("long")).toBe("below");
      expect(sideToTriggerDirection("short")).toBe("above");
    });

    it("infers short when stop_loss > entry_price and side is omitted", () => {
      expect(
        normalizeBotSide({ entry_price: 100, stop_loss: 105, take_profit: 90 })
      ).toBe("short");
      expect(
        normalizeBotSide({ entry_price: 100, stop_loss: 95, take_profit: 115 })
      ).toBe("long");
    });
  });

  describe("formatBotNotificationSummary & BOT_API_FIELDS_SPEC", () => {
    it("formats open, update, and close notifications cleanly", () => {
      const openSummary = formatBotNotificationSummary({
        action: "open",
        symbol: "SOL_USDT",
        side: "long",
        entryPrice: 185.5,
        stopLoss: 178,
        takeProfit: 202,
        marginUsd: 100,
        leverage: 20,
      });
      expect(openSummary.title).toContain("LONG SOL");
      expect(openSummary.message).toContain("185.5");

      const closeSummary = formatBotNotificationSummary({
        action: "close",
        symbol: "SOL_USDT",
        side: "long",
        entryPrice: 185.5,
        exitPrice: 202,
        pnlUsd: 177.9,
        pnlPct: 1.779,
      });
      expect(closeSummary.title).toContain("+$177.90");
    });

    it("documents all core trade lifecycle fields in BOT_API_FIELDS_SPEC", () => {
      const fieldNames = BOT_API_FIELDS_SPEC.map((f) => f.field);
      expect(fieldNames).toContain("action");
      expect(fieldNames).toContain("symbol");
      expect(fieldNames).toContain("side");
      expect(fieldNames).toContain("entry_price");
      expect(fieldNames).toContain("stop_loss");
      expect(fieldNames).toContain("take_profit");
      expect(fieldNames).toContain("margin_usd");
      expect(fieldNames).toContain("leverage");
      expect(fieldNames).toContain("trade_id");
      expect(fieldNames).toContain("exit_price");
      expect(fieldNames).toContain("api_key");
    });
  });
});
