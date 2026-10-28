export interface ScreenerCoin {
  symbol: string;
  baseCoin: string;
  quoteCoin: string;
  displayNameEn: string;
  lastPrice: number;
  bid1: number;
  ask1: number;
  volume24: number;
  amount24: number; // 24h turnover in USDT
  holdVol: number; // Open interest
  lower24Price: number;
  high24Price: number;
  riseFallRate: number; // 24h change as decimal, e.g. 0.052 = +5.2%
  riseFallValue: number;
  fundingRate: number;
  maxLeverage: number;
  baseCoinIconUrl: string;
  isHot: boolean;
  isNew: boolean;
  priceDirection?: "up" | "down" | null;
}

export type ScreenerFilterPreset =
  | "all"
  | "gainers"
  | "losers"
  | "high_volume"
  | "high_funding"
  | "hot_new";

export type ScreenerSortField =
  | "rank"
  | "coin"
  | "price"
  | "change"
  | "volume"
  | "range"
  | "funding"
  | "oi"
  | "leverage";

export type SortDirection = "asc" | "desc";

export interface ScreenerFilters {
  preset: ScreenerFilterPreset;
  search: string;
  minVolume: number; // Minimum 24h USDT volume
  minChange: number | null; // e.g. +5%
  maxChange: number | null; // e.g. -5%
  minLeverage: number; // e.g. 50x, 100x
}

export interface ScreenerMarketStats {
  totalCount: number;
  gainersCount: number;
  losersCount: number;
  totalTurnoverUsdt: number;
  topGainer: ScreenerCoin | null;
  topLoser: ScreenerCoin | null;
}
