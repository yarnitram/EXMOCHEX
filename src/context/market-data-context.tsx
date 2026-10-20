"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import type { FuturesTicker, FuturesDetail } from "@/app/api/mexc/futures/route";
import { mexcWs } from "@/lib/mexc-websocket";

interface MarketDataContextValue {
  prices: Record<string, number | null>;
  tickers: Record<string, FuturesTicker>;
  details: Record<string, FuturesDetail>;
  isConnected: boolean;
  lastTickTime: number | null;
  subscribeSymbols: (symbols: string[]) => void;
  unsubscribeSymbols: (symbols: string[]) => void;
  getLatestPrice: (symbol: string | null | undefined) => number | null;
}

const MarketDataContext = createContext<MarketDataContextValue | null>(null);

export function MarketDataProvider({ children }: { children: React.ReactNode }) {
  const [prices, setPrices] = useState<Record<string, number | null>>({});
  const [tickers, setTickers] = useState<Record<string, FuturesTicker>>({});
  const [details, setDetails] = useState<Record<string, FuturesDetail>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [lastTickTime, setLastTickTime] = useState<number | null>(null);

  // Reference counting for dynamic subscriptions
  const refCountMap = useRef<Map<string, number>>(new Map());

  // Subscribe to ticker updates from the singleton WebSocket
  useEffect(() => {
    const unsubTicker = mexcWs.addTickerListener((ticker) => {
      setLastTickTime(Date.now());
      setPrices((prev) => {
        if (prev[ticker.symbol] === ticker.lastPrice) return prev;
        return { ...prev, [ticker.symbol]: ticker.lastPrice };
      });
      setTickers((prev) => ({ ...prev, [ticker.symbol]: ticker }));
    });

    const unsubStatus = mexcWs.addStatusListener((status) => {
      setIsConnected(status);
    });

    return () => {
      unsubTicker();
      unsubStatus();
    };
  }, []);

  // Fetch contract details in background (cached on server for 60s)
  const fetchDetailsForSymbols = useCallback(async (symbols: string[]) => {
    const missing = symbols.filter((s) => !details[s]);
    if (missing.length === 0) return;

    try {
      const res = await fetch(`/api/mexc/futures?symbols=${missing.join(",")}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.details) {
        setDetails((prev) => ({ ...prev, ...data.details }));
      }
      if (data.tickers && Array.isArray(data.tickers)) {
        // Cold-start seed
        setPrices((prev) => {
          const next = { ...prev };
          for (const t of data.tickers) {
            if (next[t.symbol] == null) next[t.symbol] = t.lastPrice;
          }
          return next;
        });
      }
    } catch {
      // Graceful fallback
    }
  }, [details]);

  const subscribeSymbols = useCallback((symbols: string[]) => {
    const toSub: string[] = [];
    for (const sym of symbols) {
      const clean = sym.trim().toUpperCase();
      if (!clean) continue;
      const count = refCountMap.current.get(clean) || 0;
      refCountMap.current.set(clean, count + 1);
      if (count === 0) {
        toSub.push(clean);
      }
    }

    if (toSub.length > 0) {
      mexcWs.subscribe(toSub);
      fetchDetailsForSymbols(toSub);
    }
  }, [fetchDetailsForSymbols]);

  const unsubscribeSymbols = useCallback((symbols: string[]) => {
    const toUnsub: string[] = [];
    for (const sym of symbols) {
      const clean = sym.trim().toUpperCase();
      if (!clean) continue;
      const count = refCountMap.current.get(clean) || 0;
      if (count <= 1) {
        refCountMap.current.delete(clean);
        toUnsub.push(clean);
      } else {
        refCountMap.current.set(clean, count - 1);
      }
    }

    if (toUnsub.length > 0) {
      mexcWs.unsubscribe(toUnsub);
    }
  }, []);

  const getLatestPrice = useCallback((symbol: string | null | undefined): number | null => {
    if (!symbol) return null;
    const upper = symbol.trim().toUpperCase();
    const withUsdt = upper.endsWith("_USDT") ? upper : `${upper}_USDT`;
    const clean = upper.replace(/_USDT$/i, "");
    return prices[withUsdt] ?? prices[upper] ?? prices[clean] ?? null;
  }, [prices]);

  return (
    <MarketDataContext.Provider
      value={{
        prices,
        tickers,
        details,
        isConnected,
        lastTickTime,
        subscribeSymbols,
        unsubscribeSymbols,
        getLatestPrice,
      }}
    >
      {children}
    </MarketDataContext.Provider>
  );
}

export function useMarketData(): MarketDataContextValue {
  const ctx = useContext(MarketDataContext);
  if (!ctx) {
    throw new Error("useMarketData must be used within a MarketDataProvider");
  }
  return ctx;
}
