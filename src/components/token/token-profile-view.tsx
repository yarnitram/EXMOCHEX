"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { TokenProfile } from "@/types/token-profile";
import { TokenHeader } from "./token-header";
import { TokenMetricsGrid } from "./token-metrics-grid";
import { TokenSupplyBar } from "./token-supply-bar";
import { TokenUsecaseCard } from "./token-usecase-card";
import { AddTokenModal, type AddSetupPayload } from "@/components/watchlist/add-token-modal";
import type { WatchlistItem } from "@/lib/types";

interface TokenProfileViewProps {
  symbol: string;
  initialProfile?: TokenProfile | null;
}

export function TokenProfileView({ symbol, initialProfile }: TokenProfileViewProps) {
  const [profile, setProfile] = useState<TokenProfile | null>(initialProfile || null);
  const [loading, setLoading] = useState(!initialProfile);
  const [error, setError] = useState<string | null>(null);

  // Modal & Toast State
  const [modalOpen, setModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/token/${encodeURIComponent(symbol)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load token fundamentals");
      }
      setProfile(data.data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    if (!initialProfile) {
      fetchProfile();
    }
  }, [initialProfile, fetchProfile]);

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

      setToastMessage(`✓ Added ${payload.symbol} plan to your Watchlist!`);
      setTimeout(() => setToastMessage(null), 4000);
      return data.item;
    } catch (err) {
      throw err;
    }
  };

  return (
    <div className="w-full space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Breadcrumb & Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-muted">
          <Link href="/screener" className="hover:text-text transition-colors">
            📡 Screener
          </Link>
          <span>/</span>
          <span className="text-text font-bold uppercase">{symbol}</span>
          <span>/</span>
          <span className="text-accent font-semibold">Token Intelligence</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Add Setup Button */}
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent text-white font-bold hover:opacity-90 shadow-sm cursor-pointer transition-all"
          >
            <span>+</span>
            <span>Add Setup to Watchlist</span>
          </button>

          {/* Chart Link */}
          <Link
            href={`/chart/${symbol}`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-paper-2 text-text font-semibold hover:bg-paper-3 border border-line transition-colors"
          >
            <span>📈</span>
            <span>Chart</span>
          </Link>

          {/* External MEXC Link */}
          <a
            href={profile?.links.mexcFutures || `https://www.mexc.co/futures/${symbol}_USDT`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-paper-2 text-text font-semibold hover:bg-paper-3 border border-line transition-colors"
          >
            <span>↗</span>
            <span>MEXC Futures</span>
          </a>

          {/* Manual Refresh */}
          <button
            type="button"
            onClick={fetchProfile}
            disabled={loading}
            title="Refresh Token Fundamentals"
            className="p-1.5 rounded-xl bg-paper-2 text-muted hover:text-text border border-line transition-colors disabled:opacity-50 cursor-pointer"
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

      {/* Error Message */}
      {error ? (
        <div className="p-4 bg-loss/10 border border-loss/20 text-loss text-xs rounded-xl flex items-center justify-between">
          <span>Failed to load token profile: {error}</span>
          <button
            type="button"
            onClick={fetchProfile}
            className="underline font-bold ml-2 cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : null}

      {/* Loading Skeleton */}
      {loading && !profile ? (
        <div className="py-24 flex flex-col items-center justify-center gap-3 text-muted">
          <span className="w-8 h-8 border-3 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-medium">
            Fetching institutional fundamentals for {symbol.toUpperCase()}…
          </span>
        </div>
      ) : profile ? (
        <>
          {/* 2. Token Header & Official Links */}
          <TokenHeader profile={profile} />

          {/* 3. The 7 Fundamental Metrics Grid */}
          <TokenMetricsGrid profile={profile} />

          {/* 4. Token Supply & Dilution Structure Bar */}
          <TokenSupplyBar profile={profile} />

          {/* 5. Usecase & Overview */}
          <TokenUsecaseCard profile={profile} />
        </>
      ) : null}

      {/* Quick Add Setup Modal */}
      {modalOpen ? (
        <AddTokenModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onAddSetup={handleAddSetup}
          existingSymbols={new Set()}
          initialSymbol={symbol}
        />
      ) : null}
    </div>
  );
}
