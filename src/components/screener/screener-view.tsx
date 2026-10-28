"use client";

import { useState } from "react";
import { useCexScreener } from "@/hooks/use-cex-screener";
import { ScreenerStats } from "./screener-stats";
import { ScreenerToolbar } from "./screener-toolbar";
import { ScreenerTable } from "./screener-table";
import { ScreenerPagination } from "./screener-pagination";
import { AddTokenModal, type AddSetupPayload } from "@/components/watchlist/add-token-modal";
import type { WatchlistItem } from "@/lib/types";

export function ScreenerView() {
  const {
    sortedCoins,
    pagedCoins,
    stats,
    loading,
    error,
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
    totalFilteredCount,
  } = useCexScreener();

  // Watchlist Modal Integration
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialSymbol, setModalInitialSymbol] = useState<string | undefined>(undefined);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleOpenAddToWatchlist = (symbol: string) => {
    setModalInitialSymbol(symbol);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setModalInitialSymbol(undefined);
  };

  const handleAddSetup = async (payload: AddSetupPayload): Promise<WatchlistItem | void> => {
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add setup");
      }

      setToastMessage(`✓ Added ${payload.symbol} setup to your Watchlist!`);
      setTimeout(() => setToastMessage(null), 4000);
      return data.item;
    } catch (err) {
      throw err;
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-text flex items-center gap-2.5">
            <span>📡 CEX Futures Screener</span>
            <span className="text-xs font-bold text-accent bg-accent/10 px-2.5 py-1 rounded-full border border-accent/20">
              MEXC Perpetuals
            </span>
          </h1>
          <p className="text-xs text-muted mt-1">
            Real-time scanner covering 1,100+ USDT perpetual futures with sub-5s tick metrics, leverage rankings, and instant setup triggers.
          </p>
        </div>
      </div>

      {/* Floating Success Toast */}
      {toastMessage ? (
        <div className="fixed bottom-6 right-6 z-50 bg-paper border border-profit/40 text-profit px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span className="text-base font-bold">✓</span>
          <span className="text-xs font-semibold">{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-muted hover:text-text text-xs ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      ) : null}

      {/* Error Banner */}
      {error ? (
        <div className="p-3 bg-loss/10 border border-loss/20 text-loss text-xs rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => refresh()}
            className="underline font-bold ml-2 cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : null}

      {/* 2. Market Stat Cards */}
      <ScreenerStats stats={stats} loading={loading} />

      {/* 3. Toolbar & Presets */}
      <ScreenerToolbar
        filters={filters}
        setPreset={setPreset}
        setSearch={setSearch}
        setNumericFilters={setNumericFilters}
        resetFilters={resetFilters}
        totalMatches={totalFilteredCount}
        isPaused={isPaused}
        countdown={countdown}
        togglePause={togglePause}
        refresh={refresh}
        loading={loading}
      />

      {/* 4. Pro Screener Table */}
      <ScreenerTable
        coins={pagedCoins}
        sortField={sortField}
        sortDirection={sortDirection}
        onToggleSort={toggleSort}
        onAddToWatchlist={handleOpenAddToWatchlist}
        loading={loading}
        pageIndex={pageIndex}
        pageSize={pageSize}
      />

      {/* 5. Pagination */}
      <ScreenerPagination
        totalItems={sortedCoins.length}
        pageIndex={pageIndex}
        pageSize={pageSize}
        pageCount={pageCount}
        onPageChange={setPageIndex}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize);
          setPageIndex(0);
        }}
      />

      {/* 6. Quick Add to Watchlist Modal */}
      {modalOpen ? (
        <AddTokenModal
          open={modalOpen}
          onClose={handleCloseModal}
          onAddSetup={handleAddSetup}
          existingSymbols={new Set()}
          initialSymbol={modalInitialSymbol}
        />
      ) : null}
    </div>
  );
}
