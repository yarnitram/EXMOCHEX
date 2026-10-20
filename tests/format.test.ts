import { describe, it, expect } from "vitest";
import { money, percent, r, signed, cleanSymbol, fmtPx } from "@/lib/format";

describe("format - Display Formatters & Symbol Cleaners", () => {
  describe("money", () => {
    it("formats standard USD currency with appropriate decimals", () => {
      expect(money(1234.56)).toBe("$1,234.56");
      expect(money(50.25)).toBe("$50.25");
      expect(money(0.005)).toBe("$0.005");
      expect(money(-25.5)).toBe("-$25.50");
      expect(money(-1500)).toBe("-$1,500.00");
    });

    it("returns placeholder dash for null or non-finite values", () => {
      expect(money(null)).toBe("—");
      expect(money(undefined)).toBe("—");
      expect(money(NaN)).toBe("—");
    });
  });

  describe("percent", () => {
    it("formats percentage with explicit plus/minus sign", () => {
      expect(percent(12.34)).toBe("+12.34%");
      expect(percent(-5.67)).toBe("-5.67%");
      expect(percent(0)).toBe("+0.00%");
      expect(percent(15.555, 1)).toBe("+15.6%");
    });

    it("handles null and undefined gracefully", () => {
      expect(percent(null)).toBe("—");
      expect(percent(undefined)).toBe("—");
    });
  });

  describe("r (R-multiple)", () => {
    it("formats R-multiple with sign and R suffix", () => {
      expect(r(2.5)).toBe("+2.50R");
      expect(r(-1)).toBe("-1.00R");
      expect(r(0)).toBe("+0.00R");
    });

    it("handles missing values", () => {
      expect(r(null)).toBe("—");
      expect(r(undefined)).toBe("—");
    });
  });

  describe("cleanSymbol", () => {
    it("strips _USDT suffix from pair symbols", () => {
      expect(cleanSymbol("BTC_USDT")).toBe("BTC");
      expect(cleanSymbol("ETH_usdt")).toBe("ETH");
      expect(cleanSymbol("SOL")).toBe("SOL");
    });
  });

  describe("fmtPx", () => {
    it("applies adaptive decimal precision based on price magnitude", () => {
      // >= 1000: 1 decimal max
      expect(fmtPx(65432.1)).toBe("65,432.1");
      // >= 1: 3 decimals max
      expect(fmtPx(4.567)).toBe("4.567");
      // < 1: 6 decimals max
      expect(fmtPx(0.000123)).toBe("0.000123");
    });
  });
});
