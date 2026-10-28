"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ScreenerCoin,
  ScreenerFilterPreset,
  ScreenerFilters,
  ScreenerMarketStats,
  ScreenerSortField,
  SortDirection,
} from "@/types/screener";
import type { FuturesDetail, FuturesTicker } from "@/app/api/mexc/futures/route";

const POLL_INTERVAL_SECONDS = 5;

const DEFAULT_FILTERS: ScreenerFilters = {
  preset: "all",
  search: "",
  minVolume: 0,
  minChange: null,
  maxChange: null,
  minLeverage: 0,
};

export function useCexScreener() {
  const [coins, setCoins] = useState<ScreenerCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [countdown, setCountdown] = useState(POLL_INTERVAL_SECONDS);

  // Filters & Search
  const [filters, setFilters] = useState<ScreenerFilters>(DEFAULT_FILTERS);

  // Sorting
  const [sortField, setSortField] = useState<ScreenerSortField>("volume");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Pagination
  const [pageSize, setPageSize] = useState<number | "all">(50);
  const [pageIndex, setPageIndex] = useState(0);

  // Stored price map to detect tick movements
  const previousPricesRef = useRef<Map<string, number>>(new Map());
  const tickTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const fetchTickers = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const res = await fetch("/api/mexc/futures?with_details=true");
      if (!res.ok) {
        throw new Error(`Failed to load MEXC tickers: HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        success: boolean;
        tickers: FuturesTicker[];
        details?: Record<string, FuturesDetail>;
      };

      if (!data.success || !Array.isArray(data.tickers)) {
        throw new Error("Invalid futures payload from MEXC");
      }

      const detailsMap = data.details || {};
      const prevPrices = previousPricesRef.current;
      const now = new Date();

      const mergedCoins: ScreenerCoin[] = data.tickers.map((t) => {
        const symbol = t.symbol.toUpperCase();
        const baseCoin = symbol.replace(/_USDT$/, "").replace(/USDT$/, "");
        const detail = detailsMap[symbol];

        const prevPrice = prevPrices.get(symbol);
        let priceDirection: "up" | "down" | null = null;

        if (prevPrice !== undefined && t.lastPrice !== prevPrice) {
          priceDirection = t.lastPrice > prevPrice ? "up" : "down";
        }

        // Cache last price for next iteration
        prevPrices.set(symbol, t.lastPrice);

        return {
          symbol,
          baseCoin,
          quoteCoin: "USDT",
          displayNameEn: detail?.displayNameEn || `${baseCoin} / USDT Perpetual`,
          lastPrice: t.lastPrice,
          bid1: t.bid1,
          ask1: t.ask1,
          volume24: t.volume24,
          amount24: t.amount24,
          holdVol: t.holdVol,
          lower24Price: t.lower24Price,
          high24Price: t.high24Price,
          riseFallRate: t.riseFallRate,
          riseFallValue: t.riseFallValue,
          fundingRate: t.fundingRate,
          maxLeverage: detail?.maxLeverage || 50,
          baseCoinIconUrl: detail?.baseCoinIconUrl || "",
          isHot: Boolean(detail?.isHot),
          isNew: Boolean(detail?.isNew),
          priceDirection,
        };
      });

      setCoins(mergedCoins);
      setLastUpdated(now);
      setError(null);

      // Clear price direction highlights after 1.5 seconds
      const timeoutMap = tickTimeoutsRef.current;
      for (const coin of mergedCoins) {
        if (coin.priceDirection) {
          if (timeoutMap.has(coin.symbol)) {
            clearTimeout(timeoutMap.get(coin.symbol));
          }
          const tId = setTimeout(() => {
            setCoins((current) =>
              current.map((c) =>
                c.symbol === coin.symbol ? { ...c, priceDirection: null } : c
              )
            );
            timeoutMap.delete(coin.symbol);
          }, 1500);
          timeoutMap.set(coin.symbol, tId);
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchTickers(true);
    return () => {
      // Cleanup any pending flash timeouts
      tickTimeoutsRef.current.forEach((t) => clearTimeout(t));
      tickTimeoutsRef.current.clear();
    };
  }, [fetchTickers]);

  // 1-second countdown and 5-second polling loop
  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchTickers();
          return POLL_INTERVAL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isPaused, fetchTickers]);

  const togglePause = useCallback(() => {
    setIsPaused((p) => !p);
  }, []);

  const refresh = useCallback(async () => {
    setCountdown(POLL_INTERVAL_SECONDS);
    await fetchTickers();
  }, [fetchTickers]);

  // Filter modifiers
  const setPreset = useCallback((preset: ScreenerFilterPreset) => {
    setFilters((f) => ({ ...f, preset }));
    setPageIndex(0);
  }, []);

  const setSearch = useCallback((search: string) => {
    setFilters((f) => ({ ...f, search }));
    setPageIndex(0);
  }, []);

  const setNumericFilters = useCallback((updates: Partial<ScreenerFilters>) => {
    setFilters((f) => ({ ...f, ...updates }));
    setPageIndex(0);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPageIndex(0);
  }, []);

  // Sorting modifier
  const toggleSort = useCallback((field: ScreenerSortField) => {
    setSortField((currentField) => {
      if (currentField === field) {
        setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
        return field;
      }
      // Default initial direction per field
      const defaultDesc = ["volume", "price", "change", "range", "funding", "oi", "leverage"].includes(field);
      setSortDirection(defaultDesc ? "desc" : "asc");
      return field;
    });
    setPageIndex(0);
  }, []);

  // Compute market statistics
  const stats = useMemo<ScreenerMarketStats>(() => {
    if (coins.length === 0) {
      return {
        totalCount: 0,
        gainersCount: 0,
        losersCount: 0,
        totalTurnoverUsdt: 0,
        topGainer: null,
        topLoser: null,
      };
    }

    let gainers = 0;
    let losers = 0;
    let turnover = 0;
    let topGainer: ScreenerCoin | null = null;
    let topLoser: ScreenerCoin | null = null;

    for (const c of coins) {
      turnover += c.amount24;
      if (c.riseFallRate > 0) gainers++;
      else if (c.riseFallRate < 0) losers++;

      if (!topGainer || c.riseFallRate > topGainer.riseFallRate) {
        topGainer = c;
      }
      if (!topLoser || c.riseFallRate < topLoser.riseFallRate) {
        topLoser = c;
      }
    }

    return {
      totalCount: coins.length,
      gainersCount: gainers,
      losersCount: losers,
      totalTurnoverUsdt: turnover,
      topGainer,
      topLoser,
    };
  }, [coins]);

  // Apply filters
  const filteredCoins = useMemo(() => {
    return coins.filter((coin) => {
      // 1. Search Query
      if (filters.search) {
        const query = filters.search.trim().toUpperCase();
        const sym = coin.symbol.toUpperCase();
        const base = coin.baseCoin.toUpperCase();
        if (!sym.includes(query) && !base.includes(query)) {
          return false;
        }
      }

      // 2. Preset Filter
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
          if (Math.abs(coin.fundingRate) < 0.0003) return false; // > 0.03%
          break;
        case "hot_new":
          if (!coin.isHot && !coin.isNew) return false;
          break;
        case "all":
        default:
          break;
      }

      // 3. Numerical Filters
      if (filters.minVolume > 0 && coin.amount24 < filters.minVolume) {
        return false;
      }
      if (filters.minChange !== null && coin.riseFallRate * 100 < filters.minChange) {
        return false;
      }
      if (filters.maxChange !== null && coin.riseFallRate * 100 > filters.maxChange) {
        return false;
      }
      if (filters.minLeverage > 0 && coin.maxLeverage < filters.minLeverage) {
        return false;
      }

      return true;
    });
  }, [coins, filters]);

  // Apply sorting
  const sortedCoins = useMemo(() => {
    const list = [...filteredCoins];
    const isAsc = sortDirection === "asc";
    const dir = isAsc ? 1 : -1;

    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "coin":
          cmp = a.baseCoin.localeCompare(b.baseCoin);
          break;
        case "price":
          cmp = a.lastPrice - b.lastPrice;
          break;
        case "change":
          cmp = a.riseFallRate - b.riseFallRate;
          break;
        case "volume":
          cmp = a.amount24 - b.amount24;
          break;
        case "range": {
          // Range ratio: (last - low) / (high - low)
          const rangeA = a.high24Price > a.lower24Price ? (a.lastPrice - a.lower24Price) / (a.high24Price - a.lower24Price) : 0;
          const rangeB = b.high24Price > b.lower24Price ? (b.lastPrice - b.lower24Price) / (b.high24Price - b.lower24Price) : 0;
          cmp = rangeA - rangeB;
          break;
        }
        case "funding":
          cmp = a.fundingRate - b.fundingRate;
          break;
        case "oi":
          cmp = a.holdVol - b.holdVol;
          break;
        case "leverage":
          cmp = a.maxLeverage - b.maxLeverage;
          break;
        case "rank":
        default:
          cmp = b.amount24 - a.amount24; // Default rank by turnover
          break;
      }

      // Tie breaker by symbol
      return cmp !== 0 ? cmp * dir : a.symbol.localeCompare(b.symbol);
    });

    return list;
  }, [filteredCoins, sortField, sortDirection]);

  // Paginated slice
  const pageCount = useMemo(() => {
    if (pageSize === "all") return 1;
    return Math.max(1, Math.ceil(sortedCoins.length / pageSize));
  }, [sortedCoins.length, pageSize]);

  const pagedCoins = useMemo(() => {
    if (pageSize === "all") return sortedCoins;
    const start = pageIndex * pageSize;
    return sortedCoins.slice(start, start + pageSize);
  }, [sortedCoins, pageIndex, pageSize]);

  return {
    coins,
    sortedCoins,
    pagedCoins,
    stats,
    loading,
    error,
    lastUpdated,
    isPaused,
    countdown,
    togglePause,
    refresh,
    filters,
    setPreset,
    setSearch,
    setNumericFilters,
    resetFilters,
    sortField,
    sortDirection,
    toggleSort,
    pageSize,
    setPageSize,
    pageIndex,
    setPageIndex,
    pageCount,
    totalFilteredCount: sortedCoins.length,
  };
}
