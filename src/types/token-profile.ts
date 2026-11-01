export type DilutionRiskLevel = "low" | "moderate" | "high";

export interface TokenLinks {
  websites: string[];
  whitepaper: string | null;
  twitter: string | null;
  telegram: string | null;
  explorers: string[];
  sourceCode: string | null;
  reddit: string | null;
  mexcFutures: string;
}

export interface TokenProfile {
  symbol: string;
  name: string;
  contractSymbol: string;
  rank: number | null;
  iconUrl: string | null;
  price: number;
  priceChange24h: number; // Decimal (e.g. 0.052 for +5.2%)
  high24h: number;
  low24h: number;

  // The 7 Core Fundamentals
  marketCap: number | null;
  fdv: number | null;
  volume24h: number | null;
  openInterest: number | null;
  fundingRate: number | null;
  maxLeverage: number | null;
  circulatingSupply: number | null;
  totalSupply: number | null;
  maxSupply: number | null;

  // Computed Intelligence Ratios
  circulatingPct: number | null; // e.g. 92.5 (%)
  dilutionRatio: number | null; // FDV / MarketCap (e.g. 1.25)
  dilutionRisk: DilutionRiskLevel; // low (< 1.25x), moderate (1.25x - 3x), high (> 3x)
  volumeMcRatio: number | null; // 24h Vol / MarketCap
  oiMcRatio: number | null; // Open Interest / MarketCap

  // Historical Highs
  athPrice: number | null;
  athDate: string | null;
  athChangePct: number | null;

  // Usecase & Overview
  description: string;
  categories: string[];
  links: TokenLinks;

  fetchedAt: number;
}
