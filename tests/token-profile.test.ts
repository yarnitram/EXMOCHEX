import { describe, it, expect } from "vitest";
import { compactSupply } from "@/lib/format";
import type { DilutionRiskLevel } from "@/types/token-profile";

function computeDilutionMetrics(marketCap: number | null, fdv: number | null): {
  dilutionRatio: number | null;
  dilutionRisk: DilutionRiskLevel;
} {
  if (!marketCap || !fdv || marketCap <= 0) {
    return { dilutionRatio: null, dilutionRisk: "low" };
  }
  const dilutionRatio = fdv / marketCap;
  let dilutionRisk: DilutionRiskLevel = "low";
  if (dilutionRatio > 3) {
    dilutionRisk = "high";
  } else if (dilutionRatio > 1.25) {
    dilutionRisk = "moderate";
  } else {
    dilutionRisk = "low";
  }
  return { dilutionRatio, dilutionRisk };
}

function computeSupplyCirculatingPct(
  circulating: number | null,
  total: number | null,
  max: number | null
): number | null {
  const denominator = max || total;
  if (!circulating || circulating <= 0 || !denominator || denominator <= 0) return null;
  return Math.min(100, Math.max(0, (circulating / denominator) * 100));
}

describe("Token Profile Fundamentals & Dilution Logic", () => {
  describe("computeDilutionMetrics", () => {
    it("assigns 'low' dilution risk when FDV is within 25% of Market Cap (e.g. Bitcoin, Dogecoin)", () => {
      // BTC: MC $1.5T, FDV $1.6T -> ratio 1.06x
      const { dilutionRatio, dilutionRisk } = computeDilutionMetrics(1_500_000_000_000, 1_600_000_000_000);
      expect(dilutionRatio).toBeCloseTo(1.066, 2);
      expect(dilutionRisk).toBe("low");
    });

    it("assigns 'moderate' dilution risk when FDV is 1.25x to 3.0x of Market Cap", () => {
      // Token: MC $100M, FDV $200M -> ratio 2.0x
      const { dilutionRatio, dilutionRisk } = computeDilutionMetrics(100_000_000, 200_000_000);
      expect(dilutionRatio).toBe(2);
      expect(dilutionRisk).toBe("moderate");
    });

    it("assigns 'high' dilution risk when FDV is > 3.0x of Market Cap (VC unlock trap)", () => {
      // Low float high FDV token: MC $50M, FDV $1B -> ratio 20x
      const { dilutionRatio, dilutionRisk } = computeDilutionMetrics(50_000_000, 1_000_000_000);
      expect(dilutionRatio).toBe(20);
      expect(dilutionRisk).toBe("high");
    });

    it("handles null and zero market cap safely", () => {
      expect(computeDilutionMetrics(null, 1_000_000)).toEqual({ dilutionRatio: null, dilutionRisk: "low" });
      expect(computeDilutionMetrics(0, 1_000_000)).toEqual({ dilutionRatio: null, dilutionRisk: "low" });
      expect(computeDilutionMetrics(1_000_000, null)).toEqual({ dilutionRatio: null, dilutionRisk: "low" });
    });
  });

  describe("computeSupplyCirculatingPct", () => {
    it("calculates circulating percentage against max supply when available", () => {
      // BTC: 19.75M / 21M
      const pct = computeSupplyCirculatingPct(19_750_000, 19_750_000, 21_000_000);
      expect(pct).toBeCloseTo(94.04, 1);
    });

    it("falls back to total supply when max supply is null (dynamic/infinite)", () => {
      // ETH or SOL without hard cap: 475M / 589M
      const pct = computeSupplyCirculatingPct(475_000_000, 589_000_000, null);
      expect(pct).toBeCloseTo(80.64, 1);
    });

    it("caps percentage between 0% and 100%", () => {
      expect(computeSupplyCirculatingPct(500, 100, null)).toBe(100);
      expect(computeSupplyCirculatingPct(-10, 100, null)).toBe(null);
    });
  });

  describe("compactSupply formatter", () => {
    it("formats thousands, millions, billions, and trillions cleanly", () => {
      expect(compactSupply(21_000_000, "BTC")).toBe("21.00M BTC");
      expect(compactSupply(589_100_000, "SOL")).toBe("589.10M SOL");
      expect(compactSupply(420_690_000_000_000, "PEPE")).toBe("420.69T PEPE");
      expect(compactSupply(500_000)).toBe("500.00K");
      expect(compactSupply(123.45)).toBe("123.45");
    });

    it("handles null, zero, and non-finite values gracefully", () => {
      expect(compactSupply(null)).toBe("—");
      expect(compactSupply(undefined)).toBe("—");
      expect(compactSupply(0)).toBe("—");
      expect(compactSupply(NaN)).toBe("—");
    });
  });
});
