"use client";

import type { ScreenerMarketStats } from "@/types/screener";
import { compact, fmtPct, fmtPx } from "@/lib/format";

interface ScreenerStatsProps {
  stats: ScreenerMarketStats;
  loading: boolean;
}

export function ScreenerStats({ stats, loading }: ScreenerStatsProps) {
  const total = stats.totalCount || 0;
  const gainers = stats.gainersCount || 0;
  const losers = stats.losersCount || 0;
  const neutral = Math.max(0, total - gainers - losers);
  const gainerPct = total > 0 ? (gainers / total) * 100 : 50;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
      {/* 1. Total Pairs */}
      <div className="card-base p-4 rounded-xl flex flex-col justify-between border border-line hover:border-accent/30 transition-colors">
        <div className="flex items-center justify-between text-xs text-muted font-medium mb-1">
          <span>Active Perpetuals</span>
          <span className="text-[10px] bg-accent/10 text-accent font-semibold px-2 py-0.5 rounded-full">
            MEXC USDT
          </span>
        </div>
        <div className="text-2xl sm:text-3xl font-black tracking-tight text-text">
          {loading && total === 0 ? "—" : total.toLocaleString()}
          <span className="text-xs font-normal text-muted ml-1.5">pairs</span>
        </div>
        <div className="text-[11px] text-muted mt-2 flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Live Contract Feeds
        </div>
      </div>

      {/* 2. Market Breadth */}
      <div className="card-base p-4 rounded-xl flex flex-col justify-between border border-line hover:border-accent/30 transition-colors">
        <div className="flex items-center justify-between text-xs text-muted font-medium mb-1">
          <span>Market Breadth</span>
          <span className="text-[10px] font-mono text-muted">
            {gainers}G / {losers}L
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl sm:text-2xl font-black text-profit">
            {gainerPct.toFixed(1)}%
          </span>
          <span className="text-xs font-semibold text-muted">Advancing</span>
        </div>
        {/* Visual Breadth Bar */}
        <div className="w-full bg-loss/30 h-2 rounded-full overflow-hidden mt-3 flex">
          <div
            className="bg-profit h-full transition-all duration-500 ease-out"
            style={{ width: `${gainerPct}%` }}
          />
        </div>
      </div>

      {/* 3. 24h Total Turnover */}
      <div className="card-base p-4 rounded-xl flex flex-col justify-between border border-line hover:border-accent/30 transition-colors">
        <div className="flex items-center justify-between text-xs text-muted font-medium mb-1">
          <span>24h Total Turnover</span>
          <span className="text-[10px] bg-paper-2 text-muted px-1.5 py-0.5 rounded">
            USDT
          </span>
        </div>
        <div className="text-2xl sm:text-3xl font-black tracking-tight text-text">
          {loading && stats.totalTurnoverUsdt === 0
            ? "—"
            : compact(stats.totalTurnoverUsdt)}
        </div>
        <div className="text-[11px] text-muted mt-2">
          Aggregated across all perpetuals
        </div>
      </div>

      {/* 4. Top Gainer */}
      <div className="card-base p-4 rounded-xl flex flex-col justify-between border border-line hover:border-accent/30 transition-colors">
        <div className="flex items-center justify-between text-xs text-muted font-medium mb-1">
          <span>Top Performer</span>
          <span className="text-[10px] font-bold text-profit">🚀 Leader</span>
        </div>
        {stats.topGainer ? (
          <div>
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-lg text-text">
                {stats.topGainer.baseCoin}
              </span>
              <span className="text-sm font-bold text-profit bg-profit/10 px-2 py-0.5 rounded-md">
                {fmtPct(stats.topGainer.riseFallRate)}
              </span>
            </div>
            <div className="text-xs text-muted mt-1 font-mono">
              ${fmtPx(stats.topGainer.lastPrice)} · Vol: {compact(stats.topGainer.amount24)}
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted">Calculating…</div>
        )}
      </div>
    </div>
  );
}
