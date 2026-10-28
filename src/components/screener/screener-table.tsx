"use client";

import { useState } from "react";
import Link from "next/link";
import type { ScreenerCoin, ScreenerSortField, SortDirection } from "@/types/screener";
import { compact, fmtFundingRate, fmtPct, fmtPx, mexcChartUrl } from "@/lib/format";

interface ScreenerTableProps {
  coins: ScreenerCoin[];
  sortField: ScreenerSortField;
  sortDirection: SortDirection;
  onToggleSort: (field: ScreenerSortField) => void;
  onAddToWatchlist: (symbol: string) => void;
  loading: boolean;
  pageIndex: number;
  pageSize: number | "all";
}

export function ScreenerTable({
  coins,
  sortField,
  sortDirection,
  onToggleSort,
  onAddToWatchlist,
  loading,
  pageIndex,
  pageSize,
}: ScreenerTableProps) {
  const [brokenIcons, setBrokenIcons] = useState<Set<string>>(new Set());

  const handleIconError = (sym: string) => {
    setBrokenIcons((prev) => new Set(prev).add(sym));
  };

  const startRank = pageSize === "all" ? 1 : pageIndex * pageSize + 1;

  const renderSortIndicator = (field: ScreenerSortField) => {
    if (sortField !== field) {
      return <span className="text-muted/40 text-[10px] ml-1">⇅</span>;
    }
    return (
      <span className="text-accent text-xs ml-1 font-bold">
        {sortDirection === "asc" ? "▲" : "▼"}
      </span>
    );
  };

  return (
    <div className="w-full overflow-x-auto rounded-xl border border-line bg-paper shadow-sm">
      <table className="w-full border-collapse text-left text-xs">
        <thead className="bg-paper-2/90 sticky top-0 z-20 backdrop-blur border-b border-line select-none">
          <tr>
            {/* Rank */}
            <th
              onClick={() => onToggleSort("rank")}
              className="py-3 px-3 text-muted font-bold text-center w-12 cursor-pointer hover:text-text transition-colors"
            >
              # {renderSortIndicator("rank")}
            </th>

            {/* Coin */}
            <th
              onClick={() => onToggleSort("coin")}
              className="py-3 px-3.5 text-muted font-bold cursor-pointer hover:text-text transition-colors min-w-[150px]"
            >
              Coin / Contract {renderSortIndicator("coin")}
            </th>

            {/* Last Price */}
            <th
              onClick={() => onToggleSort("price")}
              className="py-3 px-3.5 text-muted font-bold text-right cursor-pointer hover:text-text transition-colors min-w-[110px]"
            >
              Last Price {renderSortIndicator("price")}
            </th>

            {/* 24h Change % */}
            <th
              onClick={() => onToggleSort("change")}
              className="py-3 px-3.5 text-muted font-bold text-right cursor-pointer hover:text-text transition-colors min-w-[110px]"
            >
              24h % {renderSortIndicator("change")}
            </th>

            {/* 24h Turnover Volume */}
            <th
              onClick={() => onToggleSort("volume")}
              className="py-3 px-3.5 text-muted font-bold text-right cursor-pointer hover:text-text transition-colors min-w-[125px]"
            >
              24h Volume (USDT) {renderSortIndicator("volume")}
            </th>

            {/* 24h Range */}
            <th
              onClick={() => onToggleSort("range")}
              className="py-3 px-3.5 text-muted font-bold text-center cursor-pointer hover:text-text transition-colors min-w-[170px]"
            >
              24h Range (L — H) {renderSortIndicator("range")}
            </th>

            {/* Funding Rate */}
            <th
              onClick={() => onToggleSort("funding")}
              className="py-3 px-3.5 text-muted font-bold text-right cursor-pointer hover:text-text transition-colors min-w-[100px]"
            >
              Funding (8h) {renderSortIndicator("funding")}
            </th>

            {/* Open Interest */}
            <th
              onClick={() => onToggleSort("oi")}
              className="py-3 px-3 text-muted font-bold text-right cursor-pointer hover:text-text transition-colors min-w-[100px]"
            >
              Open Interest {renderSortIndicator("oi")}
            </th>

            {/* Max Leverage */}
            <th
              onClick={() => onToggleSort("leverage")}
              className="py-3 px-3 text-muted font-bold text-center cursor-pointer hover:text-text transition-colors w-20"
            >
              Max Lev {renderSortIndicator("leverage")}
            </th>

            {/* Quick Actions */}
            <th className="py-3 px-3 text-muted font-bold text-right min-w-[140px]">
              Actions
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-line">
          {coins.length === 0 ? (
            <tr>
              <td colSpan={10} className="py-12 text-center text-muted">
                {loading ? (
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                    <span>Loading MEXC perpetual contracts…</span>
                  </div>
                ) : (
                  <div className="py-6">
                    <div className="text-base font-semibold text-text mb-1">
                      No contracts matched your search or filter
                    </div>
                    <div className="text-xs text-muted">
                      Try clearing search parameters or adjusting numeric filters.
                    </div>
                  </div>
                )}
              </td>
            </tr>
          ) : (
            coins.map((coin, idx) => {
              const rank = startRank + idx;
              const hasBrokenIcon = brokenIcons.has(coin.symbol);
              const isGain = coin.riseFallRate > 0;
              const isLoss = coin.riseFallRate < 0;

              // Price flash background/text styling
              let flashClass = "";
              if (coin.priceDirection === "up") {
                flashClass = "bg-emerald-500/15 text-emerald-400 font-bold";
              } else if (coin.priceDirection === "down") {
                flashClass = "bg-rose-500/15 text-rose-400 font-bold";
              }

              // 24h Range computation (percentage where current price sits)
              const rangeDiff = coin.high24Price - coin.lower24Price;
              const rangePct =
                rangeDiff > 0
                  ? Math.max(0, Math.min(100, ((coin.lastPrice - coin.lower24Price) / rangeDiff) * 100))
                  : 50;

              // Funding rate badge styling
              const fundingAbs = Math.abs(coin.fundingRate);
              let fundingClass = "text-muted bg-paper-2";
              if (coin.fundingRate > 0.0002) {
                fundingClass = "text-amber-400 bg-amber-400/10 font-medium";
              } else if (coin.fundingRate < 0) {
                fundingClass = "text-purple-400 bg-purple-400/10 font-medium";
              }

              return (
                <tr
                  key={coin.symbol}
                  className="hover:bg-paper-2/60 transition-colors group"
                >
                  {/* Rank */}
                  <td className="py-3 px-3 text-center text-muted font-mono font-medium text-[11px]">
                    {rank}
                  </td>

                  {/* Coin info */}
                  <td className="py-3 px-3.5">
                    <div className="flex items-center gap-2.5">
                      {coin.baseCoinIconUrl && !hasBrokenIcon ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={coin.baseCoinIconUrl}
                          alt={coin.baseCoin}
                          onError={() => handleIconError(coin.symbol)}
                          className="w-6 h-6 rounded-full shrink-0 object-cover border border-line"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-accent/15 text-accent font-black text-[11px] flex items-center justify-center shrink-0 border border-accent/20">
                          {coin.baseCoin.slice(0, 2)}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-text text-sm group-hover:text-accent transition-colors">
                            {coin.baseCoin}
                          </span>
                          <span className="text-[10px] text-muted font-semibold bg-paper-2 px-1.5 py-0.5 rounded">
                            USDT
                          </span>
                          {coin.isHot ? (
                            <span className="text-[9px] font-black text-amber-400 bg-amber-400/15 px-1 py-0.2 rounded">
                              HOT
                            </span>
                          ) : null}
                          {coin.isNew ? (
                            <span className="text-[9px] font-black text-emerald-400 bg-emerald-400/15 px-1 py-0.2 rounded">
                              NEW
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[10px] text-muted truncate max-w-[120px]">
                          {coin.displayNameEn}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Last Price */}
                  <td className="py-3 px-3.5 text-right font-mono font-bold text-sm">
                    <span className={`px-2 py-0.5 rounded-md transition-all duration-300 ${flashClass}`}>
                      ${fmtPx(coin.lastPrice)}
                    </span>
                  </td>

                  {/* 24h Change % */}
                  <td className="py-3 px-3.5 text-right">
                    <span
                      className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-xs font-bold font-mono ${
                        isGain
                          ? "text-profit bg-profit/10"
                          : isLoss
                          ? "text-loss bg-loss/10"
                          : "text-muted bg-paper-2"
                      }`}
                    >
                      <span>{isGain ? "▲" : isLoss ? "▼" : ""}</span>
                      <span>{fmtPct(coin.riseFallRate)}</span>
                    </span>
                  </td>

                  {/* 24h Volume */}
                  <td className="py-3 px-3.5 text-right font-mono">
                    <div className="text-text font-bold text-xs">
                      {compact(coin.amount24)}
                    </div>
                    <div className="text-[10px] text-muted">
                      {compact(coin.volume24).replace("$", "")} {coin.baseCoin}
                    </div>
                  </td>

                  {/* 24h Range Bar */}
                  <td className="py-3 px-3.5">
                    <div className="flex flex-col gap-1 w-full max-w-[180px] mx-auto">
                      <div className="flex items-center justify-between text-[10px] font-mono text-muted">
                        <span>${fmtPx(coin.lower24Price)}</span>
                        <span>${fmtPx(coin.high24Price)}</span>
                      </div>
                      <div className="relative w-full h-1.5 bg-paper-3 rounded-full overflow-hidden">
                        <div
                          className="absolute top-0 bottom-0 left-0 bg-accent/60 rounded-full"
                          style={{ width: `${rangePct}%` }}
                        />
                      </div>
                      <div className="text-[9px] text-muted text-center font-mono">
                        {rangePct.toFixed(0)}% of range
                      </div>
                    </div>
                  </td>

                  {/* Funding Rate */}
                  <td className="py-3 px-3.5 text-right font-mono">
                    <span className={`px-2 py-0.5 rounded text-[11px] ${fundingClass}`}>
                      {fmtFundingRate(coin.fundingRate)}
                    </span>
                  </td>

                  {/* Open Interest */}
                  <td className="py-3 px-3 text-right font-mono text-[11px] text-muted">
                    {compact(coin.holdVol).replace("$", "")}
                  </td>

                  {/* Max Leverage */}
                  <td className="py-3 px-3 text-center">
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-paper-2 border border-line text-text">
                      {coin.maxLeverage}x
                    </span>
                  </td>

                  {/* Quick Actions */}
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* + Watchlist */}
                      <button
                        type="button"
                        onClick={() => onAddToWatchlist(coin.symbol)}
                        title={`Add ${coin.baseCoin} to Watchlist`}
                        className="px-2 py-1 rounded bg-accent/15 text-accent hover:bg-accent hover:text-white font-bold text-[11px] cursor-pointer transition-colors"
                      >
                        + Setup
                      </button>

                      {/* Chart */}
                      <Link
                        href={`/chart/${coin.baseCoin}`}
                        title={`Open ${coin.baseCoin} chart`}
                        className="p-1 rounded bg-paper-2 text-muted hover:text-text hover:bg-paper-3 border border-line transition-colors"
                      >
                        📈
                      </Link>

                      {/* External MEXC */}
                      <a
                        href={mexcChartUrl(coin.symbol)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open in MEXC Futures Terminal"
                        className="p-1 rounded bg-paper-2 text-muted hover:text-text hover:bg-paper-3 border border-line transition-colors"
                      >
                        ↗
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
