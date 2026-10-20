"use client";

import { useEffect, useRef, useState, useCallback, useContext } from "react";
import type { FuturesTicker, FuturesDetail } from "@/app/api/mexc/futures/route";
import { useMarketData } from "@/context/market-data-context";

export interface MexcMarketDataParams {
  symbols?: string[];
  refreshIntervalSec?: number;
  enableDetails?: boolean;
}

export interface MexcMarketDataState {
  tickers: FuturesTicker[];
  prices: Record<string, number | null>;
  details: Record<string, FuturesDetail>;
  loading: boolean;
  error: string | null;
  lastRefreshed: number | null;
  refreshIntervalSec: number;
  refetch: () => Promise<void>;
}

/**
 * Custom hook for MEXC futures ticker and contract detail data.
 * Powered by high-speed WebSocket streaming when wrapped in MarketDataProvider,
 * with automatic fallback to single-batch cold start.
 */
export function useMexcMarketData(params: MexcMarketDataParams = {}): MexcMarketDataState {
  try {
    return useMarketDataHook(params);
  } catch {
    // If used outside MarketDataProvider, fallback to standalone hook
    return useStandaloneMexcMarketData(params);
  }
}

function useMarketDataHook({
  symbols,
  refreshIntervalSec = 10,
  enableDetails = true,
}: MexcMarketDataParams): MexcMarketDataState {
  const ctx = useMarketData();
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const prevSymbolsRef = useRef<string[]>([]);

  // Subscribe requested symbols to the WebSocket manager
  useEffect(() => {
    const list = symbols?.map((s) => s.trim().toUpperCase()).filter(Boolean) || [];
    const prev = prevSymbolsRef.current;

    // Determine additions and removals
    const toAdd = list.filter((s) => !prev.includes(s));
    const toRemove = prev.filter((s) => !list.includes(s));

    if (toAdd.length > 0) ctx.subscribeSymbols(toAdd);
    if (toRemove.length > 0) ctx.unsubscribeSymbols(toRemove);

    prevSymbolsRef.current = list;

    return () => {
      if (list.length > 0) {
        ctx.unsubscribeSymbols(list);
      }
    };
  }, [symbols, ctx]);

  // Cold start seed for tickers/details if empty
  const refetch = useCallback(async () => {
    const list = symbols?.map((s) => s.trim().toUpperCase()).filter(Boolean);
    let url = "/api/mexc/futures";
    const sp = new URLSearchParams();
    if (list && list.length > 0) {
      sp.set("symbols", list.join(","));
    } else if (enableDetails) {
      sp.set("with_details", "true");
    }
    if (sp.toString()) url += `?${sp.toString()}`;

    try {
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.tickers && Array.isArray(data.tickers)) {
        for (const t of data.tickers) {
          ctx.prices[t.symbol] = t.lastPrice;
          ctx.tickers[t.symbol] = t;
        }
      }
      if (data.details) {
        Object.assign(ctx.details, data.details);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fetch error");
    } finally {
      setInitialLoading(false);
    }
  }, [symbols, enableDetails, ctx]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Filter tickers for current symbols if specified
  const filteredTickers = Object.values(ctx.tickers).filter((t) => {
    if (!symbols || symbols.length === 0) return true;
    return symbols.some((s) => s.trim().toUpperCase() === t.symbol.toUpperCase());
  });

  return {
    tickers: filteredTickers,
    prices: ctx.prices,
    details: ctx.details,
    loading: initialLoading && Object.keys(ctx.prices).length === 0,
    error,
    lastRefreshed: ctx.lastTickTime,
    refreshIntervalSec,
    refetch,
  };
}

function useStandaloneMexcMarketData({
  symbols,
  refreshIntervalSec = 10,
  enableDetails = true,
}: MexcMarketDataParams): MexcMarketDataState {
  const [tickers, setTickers] = useState<FuturesTicker[]>([]);
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [details, setDetails] = useState<Record<string, FuturesDetail>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    const trackedList = symbols?.map((s) => s.trim().toUpperCase()).filter(Boolean);
    let url = "/api/mexc/futures";
    const params = new URLSearchParams();
    if (trackedList && trackedList.length > 0) {
      params.set("symbols", trackedList.join(","));
    } else if (enableDetails) {
      params.set("with_details", "true");
    }
    if (params.toString()) url += `?${params.toString()}`;

    try {
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return;
      const data = await res.json();
      if (data.tickers && Array.isArray(data.tickers)) {
        setTickers(data.tickers);
        const map: Record<string, number | null> = {};
        for (const t of data.tickers) map[t.symbol.toUpperCase()] = t.lastPrice;
        setPrices(map);
      }
      if (data.details) setDetails(data.details);
      setLastRefreshed(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fetch failed");
    } finally {
      setLoading(false);
    }
  }, [symbols, enableDetails]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    tickers,
    prices,
    details,
    loading,
    error,
    lastRefreshed,
    refreshIntervalSec,
    refetch: fetchData,
  };
}
