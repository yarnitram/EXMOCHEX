"use client";

import { useState } from "react";
import type { ScreenerFilterPreset, ScreenerFilters } from "@/types/screener";

interface ScreenerToolbarProps {
  filters: ScreenerFilters;
  setPreset: (preset: ScreenerFilterPreset) => void;
  setSearch: (search: string) => void;
  setNumericFilters: (updates: Partial<ScreenerFilters>) => void;
  resetFilters: () => void;
  totalMatches: number;
  isPaused: boolean;
  countdown: number;
  togglePause: () => void;
  refresh: () => Promise<void>;
  loading: boolean;
}

const PRESET_TABS: { id: ScreenerFilterPreset; label: string; icon: string }[] = [
  { id: "all", label: "All Contracts", icon: "🌐" },
  { id: "gainers", label: "Top Gainers", icon: "🚀" },
  { id: "losers", label: "Top Losers", icon: "🩸" },
  { id: "high_volume", label: "High Volume (>$10M)", icon: "💧" },
  { id: "high_funding", label: "High Funding (>0.03%)", icon: "⚡" },
  { id: "hot_new", label: "Hot & New", icon: "🔥" },
];

export function ScreenerToolbar({
  filters,
  setPreset,
  setSearch,
  setNumericFilters,
  resetFilters,
  totalMatches,
  isPaused,
  countdown,
  togglePause,
  refresh,
  loading,
}: ScreenerToolbarProps) {
  const [showDrawer, setShowDrawer] = useState(false);

  const hasActiveNumericFilters =
    filters.minVolume > 0 ||
    filters.minChange !== null ||
    filters.maxChange !== null ||
    filters.minLeverage > 0;

  return (
    <div className="space-y-3 mb-4">
      {/* 1. Preset Tabs */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
        <div className="flex items-center gap-1.5 shrink-0">
          {PRESET_TABS.map((tab) => {
            const active = filters.preset === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPreset(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150 ${
                  active
                    ? "bg-accent text-white shadow-sm font-bold"
                    : "bg-paper-2 text-muted hover:text-text hover:bg-paper-3"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Live Auto-Refresh State & Refresh Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={togglePause}
            title={isPaused ? "Resume 5s live polling" : "Pause 5s live polling"}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium border cursor-pointer transition-colors ${
              isPaused
                ? "bg-loss/10 border-loss/30 text-loss hover:bg-loss/20"
                : "bg-profit/10 border-profit/30 text-profit hover:bg-profit/20"
            }`}
          >
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                isPaused ? "bg-loss" : "bg-profit animate-pulse"
              }`}
            />
            <span>{isPaused ? "Paused" : `${countdown}s`}</span>
            <span className="text-[10px] text-muted">
              {isPaused ? "▶" : "⏸"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => refresh()}
            disabled={loading}
            title="Refresh now"
            className="p-1.5 rounded-lg bg-paper-2 text-muted hover:text-text border border-line hover:border-accent/30 cursor-pointer disabled:opacity-50 transition-colors"
          >
            <svg
              className={`w-3.5 h-3.5 ${loading ? "animate-spin text-accent" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search 1,100+ coins (e.g. BTC, SOL, PEPE)..."
            className="w-full bg-paper pl-9 pr-8 py-2 rounded-xl text-xs font-medium border border-line focus:outline-none focus:border-accent text-text placeholder:text-muted/60"
          />
          {filters.search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-text cursor-pointer"
            >
              ✕
            </button>
          ) : null}
        </div>

        {/* Filter Drawer Toggle & Reset */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowDrawer(!showDrawer)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-colors ${
              showDrawer || hasActiveNumericFilters
                ? "bg-accent/15 border-accent text-accent font-bold"
                : "bg-paper border-line text-muted hover:text-text hover:border-line-hover"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            <span>Filters</span>
            {hasActiveNumericFilters ? (
              <span className="w-2 h-2 rounded-full bg-accent" />
            ) : null}
          </button>

          {hasActiveNumericFilters || filters.preset !== "all" || filters.search ? (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-muted hover:text-loss px-2 py-2 cursor-pointer transition-colors"
            >
              Reset
            </button>
          ) : null}

          <div className="text-xs text-muted font-mono ml-auto sm:ml-2">
            Matches: <strong className="text-text font-bold">{totalMatches}</strong>
          </div>
        </div>
      </div>

      {/* 3. Collapsible Filter Drawer */}
      {showDrawer ? (
        <div className="p-4 bg-paper rounded-xl border border-line grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Min Volume */}
          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
              Min 24h Volume
            </label>
            <select
              value={filters.minVolume}
              onChange={(e) => setNumericFilters({ minVolume: Number(e.target.value) })}
              className="w-full bg-paper-2 border border-line rounded-lg text-xs py-1.5 px-2.5 text-text focus:outline-none focus:border-accent"
            >
              <option value={0}>Any Volume</option>
              <option value={1_000_000}>$1M+ USDT</option>
              <option value={5_000_000}>$5M+ USDT</option>
              <option value={10_000_000}>$10M+ USDT</option>
              <option value={50_000_000}>$50M+ USDT</option>
              <option value={100_000_000}>$100M+ USDT</option>
            </select>
          </div>

          {/* Min % Change */}
          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
              Min 24h % (Gainers)
            </label>
            <select
              value={filters.minChange ?? ""}
              onChange={(e) =>
                setNumericFilters({
                  minChange: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className="w-full bg-paper-2 border border-line rounded-lg text-xs py-1.5 px-2.5 text-text focus:outline-none focus:border-accent"
            >
              <option value="">Any %</option>
              <option value={3}>+3% or more</option>
              <option value={5}>+5% or more</option>
              <option value={10}>+10% or more</option>
              <option value={20}>+20% or more</option>
            </select>
          </div>

          {/* Max % Change (Losers) */}
          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
              Max 24h % (Dips / Losers)
            </label>
            <select
              value={filters.maxChange ?? ""}
              onChange={(e) =>
                setNumericFilters({
                  maxChange: e.target.value === "" ? null : Number(e.target.value),
                })
              }
              className="w-full bg-paper-2 border border-line rounded-lg text-xs py-1.5 px-2.5 text-text focus:outline-none focus:border-accent"
            >
              <option value="">Any %</option>
              <option value={-3}>-3% or lower</option>
              <option value={-5}>-5% or lower</option>
              <option value={-10}>-10% or lower</option>
              <option value={-20}>-20% or lower</option>
            </select>
          </div>

          {/* Min Leverage */}
          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-wider mb-1.5">
              Min Max-Leverage
            </label>
            <select
              value={filters.minLeverage}
              onChange={(e) => setNumericFilters({ minLeverage: Number(e.target.value) })}
              className="w-full bg-paper-2 border border-line rounded-lg text-xs py-1.5 px-2.5 text-text focus:outline-none focus:border-accent"
            >
              <option value={0}>Any Leverage</option>
              <option value={50}>50x+</option>
              <option value={100}>100x+</option>
              <option value={200}>200x+</option>
            </select>
          </div>
        </div>
      ) : null}
    </div>
  );
}
