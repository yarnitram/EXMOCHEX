import { describe, it, expect } from "vitest";
import type { ScreenerCoin, ScreenerFilters } from "@/types/screener";

const MOCK_COINS: ScreenerCoin[] = [
  {
    symbol: "BTC_USDT",
    baseCoin: "BTC",
    quoteCoin: "USDT",
    displayNameEn: "BTC / USDT Perpetual",
    lastPrice: 80500,
    bid1: 80499,
    ask1: 80501,
    volume24: 25000,
    amount24: 2_000_000_000, // $2B
    holdVol: 500000,
    lower24Price: 79000,
    high24Price: 82000,
    riseFallRate: 0.025, // +2.5%
    riseFallValue: 1960,
    fundingRate: 0.0001,
    maxLeverage: 200,
    baseCoinIconUrl: "https://example.com/btc.png",
    isHot: true,
    isNew: false,
  },
  {
    symbol: "ETH_USDT",
    baseCoin: "ETH",
    quoteCoin: "USDT",
    displayNameEn: "ETH / USDT Perpetual",
    lastPrice: 2800,
    bid1: 2799,
    ask1: 2801,
    volume24: 150000,
    amount24: 420_000_000, // $420M
    holdVol: 120000,
    lower24Price: 2750,
    high24Price: 2900,
    riseFallRate: -0.015, // -1.5%
    riseFallValue: -42,
    fundingRate: 0.00005,
    maxLeverage: 100,
    baseCoinIconUrl: "https://example.com/eth.png",
    isHot: true,
    isNew: false,
  },
  {
    symbol: "SOL_USDT",
    baseCoin: "SOL",
    quoteCoin: "USDT",
    displayNameEn: "SOL / USDT Perpetual",
    lastPrice: 185,
    bid1: 184.9,
    ask1: 185.1,
    volume24: 800000,
    amount24: 148_000_000, // $148M
    holdVol: 90000,
    lower24Price: 175,
    high24Price: 190,
    riseFallRate: 0.082, // +8.2%
    riseFallValue: 14,
    fundingRate: 0.00035, // High funding > 0.03%
    maxLeverage: 100,
    baseCoinIconUrl: "https://example.com/sol.png",
    isHot: false,
    isNew: false,
  },
  {
    symbol: "PEPE_USDT",
    baseCoin: "PEPE",
    quoteCoin: "USDT",
    displayNameEn: "PEPE / USDT Perpetual",
    lastPrice: 0.0000085,
    bid1: 0.00000849,
    ask1: 0.00000851,
    volume24: 5000000000,
    amount24: 42_500_000, // $42.5M
    holdVol: 30000,
    lower24Price: 0.0000078,
    high24Price: 0.0000095,
    riseFallRate: 0.154, // +15.4%
    riseFallValue: 0.0000011,
    fundingRate: 0.00045, // High funding > 0.03%
    maxLeverage: 50,
    baseCoinIconUrl: "https://example.com/pepe.png",
    isHot: false,
    isNew: true,
  },
  {
    symbol: "LOWVOL_USDT",
    baseCoin: "LOWVOL",
    quoteCoin: "USDT",
    displayNameEn: "LOWVOL / USDT Perpetual",
    lastPrice: 1.25,
    bid1: 1.24,
    ask1: 1.26,
    volume24: 200000,
    amount24: 250_000, // $250K (Low volume < $10M)
    holdVol: 5000,
    lower24Price: 1.2,
    high24Price: 1.35,
    riseFallRate: -0.055, // -5.5%
    riseFallValue: -0.07,
    fundingRate: -0.0001,
    maxLeverage: 20,
    baseCoinIconUrl: "",
    isHot: false,
    isNew: false,
  },
];

function filterCoins(coins: ScreenerCoin[], filters: ScreenerFilters): ScreenerCoin[] {
  return coins.filter((coin) => {
    if (filters.search) {
      const q = filters.search.trim().toUpperCase();
      const sym = coin.symbol.toUpperCase();
      const base = coin.baseCoin.toUpperCase();
      if (!sym.includes(q) && !base.includes(q)) return false;
    }

    switch (filters.preset) {
      case "gainers":
        if (coin.riseFallRate <= 0) return false;
        break;
      case "losers":
        if (coin.riseFallRate >= 0) return false;
        break;
      case "high_volume":
        if (coin.amount24 < 10_000_000) return false;
        break;
      case "high_funding":
        if (Math.abs(coin.fundingRate) < 0.0003) return false;
        break;
      case "hot_new":
        if (!coin.isHot && !coin.isNew) return false;
        break;
      case "all":
      default:
        break;
    }

    if (filters.minVolume > 0 && coin.amount24 < filters.minVolume) return false;
    if (filters.minChange !== null && coin.riseFallRate * 100 < filters.minChange) return false;
    if (filters.maxChange !== null && coin.riseFallRate * 100 > filters.maxChange) return false;
    if (filters.minLeverage > 0 && coin.maxLeverage < filters.minLeverage) return false;

    return true;
  });
}

describe("CEX Screener Filter & Search Logic", () => {
  const baseFilters: ScreenerFilters = {
    preset: "all",
    search: "",
    minVolume: 0,
    minChange: null,
    maxChange: null,
    minLeverage: 0,
  };

  it("filters all coins without exclusion when preset is 'all'", () => {
    const res = filterCoins(MOCK_COINS, baseFilters);
    expect(res.length).toBe(5);
  });

  it("filters only gainers (riseFallRate > 0)", () => {
    const res = filterCoins(MOCK_COINS, { ...baseFilters, preset: "gainers" });
    expect(res.map((c) => c.baseCoin)).toEqual(["BTC", "SOL", "PEPE"]);
  });

  it("filters only losers (riseFallRate < 0)", () => {
    const res = filterCoins(MOCK_COINS, { ...baseFilters, preset: "losers" });
    expect(res.map((c) => c.baseCoin)).toEqual(["ETH", "LOWVOL"]);
  });

  it("filters high volume coins (amount24 >= $10,000,000)", () => {
    const res = filterCoins(MOCK_COINS, { ...baseFilters, preset: "high_volume" });
    expect(res.map((c) => c.baseCoin)).toEqual(["BTC", "ETH", "SOL", "PEPE"]);
    expect(res.some((c) => c.baseCoin === "LOWVOL")).toBe(false);
  });

  it("filters high funding contracts (abs(fundingRate) >= 0.03%)", () => {
    const res = filterCoins(MOCK_COINS, { ...baseFilters, preset: "high_funding" });
    expect(res.map((c) => c.baseCoin)).toEqual(["SOL", "PEPE"]);
  });

  it("filters hot and new contracts (isHot || isNew)", () => {
    const res = filterCoins(MOCK_COINS, { ...baseFilters, preset: "hot_new" });
    expect(res.map((c) => c.baseCoin)).toEqual(["BTC", "ETH", "PEPE"]);
  });

  it("filters by substring search (case-insensitive)", () => {
    const res = filterCoins(MOCK_COINS, { ...baseFilters, search: "sol" });
    expect(res.length).toBe(1);
    expect(res[0].baseCoin).toBe("SOL");
  });

  it("filters by numeric minimum volume and leverage thresholds", () => {
    const res = filterCoins(MOCK_COINS, {
      ...baseFilters,
      minVolume: 100_000_000, // >= $100M
      minLeverage: 100, // >= 100x
    });
    expect(res.map((c) => c.baseCoin)).toEqual(["BTC", "ETH", "SOL"]);

    const ultraHighLev = filterCoins(MOCK_COINS, {
      ...baseFilters,
      minLeverage: 200, // >= 200x
    });
    expect(ultraHighLev.map((c) => c.baseCoin)).toEqual(["BTC"]);
  });
});
