"use client";

import type { TokenProfile } from "@/types/token-profile";
import { compact, compactSupply, fmtFundingRate, fmtPx } from "@/lib/format";

interface TokenMetricsGridProps {
  profile: TokenProfile;
}

export function TokenMetricsGrid({ profile }: TokenMetricsGridProps) {
  const dilutionBadge = (() => {
    if (!profile.dilutionRatio) return null;
    if (profile.dilutionRisk === "low") {
      return (
        <span className="text-[10px] font-bold text-profit bg-profit/15 px-2 py-0.5 rounded-full border border-profit/20">
          🟢 Low Dilution ({profile.dilutionRatio.toFixed(2)}x)
        </span>
      );
    }
    if (profile.dilutionRisk === "moderate") {
      return (
        <span className="text-[10px] font-bold text-amber-400 bg-amber-400/15 px-2 py-0.5 rounded-full border border-amber-400/20">
          🟡 Moderate Unlock ({profile.dilutionRatio.toFixed(2)}x)
        </span>
      );
    }
    return (
      <span className="text-[10px] font-bold text-loss bg-loss/15 px-2 py-0.5 rounded-full border border-loss/20">
        🔴 High Dilution Risk ({profile.dilutionRatio.toFixed(2)}x)
      </span>
    );
  })();

  const volRatioText = profile.volumeMcRatio
    ? `${(profile.volumeMcRatio * 100).toFixed(1)}% Vol/MC`
    : null;

  const oiRatioText = profile.oiMcRatio
    ? `${(profile.oiMcRatio * 100).toFixed(1)}% OI/MC`
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base sm:text-lg font-black tracking-tight text-text flex items-center gap-2">
          <span>📊 Fundamental Valuation & Liquidity</span>
          <span className="text-xs font-normal text-muted">
            (The 7 Core Metrics)
          </span>
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Market Cap */}
        <div className="card-base p-4 rounded-xl border border-line bg-paper flex flex-col justify-between hover:border-accent/30 transition-all duration-150">
          <div className="flex items-center justify-between text-xs text-muted font-medium mb-1.5">
            <span>Market Cap</span>
            <span className="text-[10px] bg-paper-2 font-mono px-2 py-0.5 rounded text-muted">
              Circulating
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-black text-text tracking-tight">
            {profile.marketCap ? compact(profile.marketCap) : "—"}
          </div>
          <div className="text-[11px] text-muted mt-2.5 flex items-center justify-between">
            <span>{profile.rank ? `Rank #${profile.rank}` : "Global weight"}</span>
            <span className="text-[10px] text-muted/70">Price × Circulating</span>
          </div>
        </div>

        {/* 2. Fully Diluted Valuation (FDV) */}
        <div className="card-base p-4 rounded-xl border border-line bg-paper flex flex-col justify-between hover:border-accent/30 transition-all duration-150">
          <div className="flex items-center justify-between text-xs text-muted font-medium mb-1.5">
            <span>Fully Diluted Valuation</span>
            {dilutionBadge}
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-black text-text tracking-tight">
            {profile.fdv ? compact(profile.fdv) : "—"}
          </div>
          <div className="text-[11px] text-muted mt-2.5 flex items-center justify-between">
            <span>{profile.maxSupply ? "Max supply cap" : "Total supply basis"}</span>
            <span className="text-[10px] text-muted/70">Unlock Dilution Risk</span>
          </div>
        </div>

        {/* 3. 24h Trading Volume */}
        <div className="card-base p-4 rounded-xl border border-line bg-paper flex flex-col justify-between hover:border-accent/30 transition-all duration-150">
          <div className="flex items-center justify-between text-xs text-muted font-medium mb-1.5">
            <span>24h Trading Volume</span>
            {volRatioText ? (
              <span className="text-[10px] font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded font-bold">
                {volRatioText}
              </span>
            ) : null}
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-black text-text tracking-tight">
            {profile.volume24h ? compact(profile.volume24h) : "—"}
          </div>
          <div className="text-[11px] text-muted mt-2.5 flex items-center justify-between">
            <span>Spot + Futures Turnover</span>
            <span className="text-[10px] text-muted/70">Market Liquidity</span>
          </div>
        </div>

        {/* 4. Perps 24h Open Interest */}
        <div className="card-base p-4 rounded-xl border border-line bg-paper flex flex-col justify-between hover:border-accent/30 transition-all duration-150">
          <div className="flex items-center justify-between text-xs text-muted font-medium mb-1.5">
            <span>Perps Open Interest</span>
            <span className="text-[10px] font-mono text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded font-bold">
              {profile.maxLeverage}x Max Lev
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-black text-text tracking-tight">
            {profile.openInterest ? compact(profile.openInterest) : "—"}
          </div>
          <div className="text-[11px] text-muted mt-2.5 flex items-center justify-between">
            <span>Funding: {fmtFundingRate(profile.fundingRate)}</span>
            {oiRatioText ? <span className="text-[10px] text-muted/70">{oiRatioText}</span> : null}
          </div>
        </div>

        {/* 5. Circulating Supply */}
        <div className="card-base p-4 rounded-xl border border-line bg-paper flex flex-col justify-between hover:border-accent/30 transition-all duration-150">
          <div className="flex items-center justify-between text-xs text-muted font-medium mb-1.5">
            <span>Circulating Supply</span>
            {profile.circulatingPct !== null ? (
              <span className="text-[10px] font-mono font-bold text-profit bg-profit/10 px-1.5 py-0.5 rounded">
                {profile.circulatingPct.toFixed(1)}% Active
              </span>
            ) : null}
          </div>
          <div className="text-xl sm:text-2xl font-mono font-black text-text tracking-tight truncate">
            {compactSupply(profile.circulatingSupply, profile.symbol)}
          </div>
          <div className="text-[11px] text-muted mt-2.5 flex items-center justify-between">
            <span>Freely floating in market</span>
            <span className="text-[10px] text-muted/70">Public Supply</span>
          </div>
        </div>

        {/* 6. Total Supply */}
        <div className="card-base p-4 rounded-xl border border-line bg-paper flex flex-col justify-between hover:border-accent/30 transition-all duration-150">
          <div className="flex items-center justify-between text-xs text-muted font-medium mb-1.5">
            <span>Total Supply</span>
            <span className="text-[10px] bg-paper-2 font-mono px-1.5 py-0.5 rounded text-muted">
              Created - Burned
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-mono font-black text-text tracking-tight truncate">
            {compactSupply(profile.totalSupply, profile.symbol)}
          </div>
          <div className="text-[11px] text-muted mt-2.5 flex items-center justify-between">
            <span>Includes locked reserves</span>
            <span className="text-[10px] text-muted/70">Minted Coins</span>
          </div>
        </div>

        {/* 7. Max Supply */}
        <div className="card-base p-4 rounded-xl border border-line bg-paper flex flex-col justify-between hover:border-accent/30 transition-all duration-150">
          <div className="flex items-center justify-between text-xs text-muted font-medium mb-1.5">
            <span>Max Supply</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded text-muted bg-paper-2">
              {profile.maxSupply ? "Hard Cap" : "Dynamic"}
            </span>
          </div>
          <div className="text-xl sm:text-2xl font-mono font-black text-text tracking-tight truncate">
            {profile.maxSupply
              ? compactSupply(profile.maxSupply, profile.symbol)
              : "Infinite / Dynamic"}
          </div>
          <div className="text-[11px] text-muted mt-2.5 flex items-center justify-between">
            <span>
              {profile.maxSupply ? "Ceiling limit fixed" : "Inflationary / Burn fee"}
            </span>
            <span className="text-[10px] text-muted/70">Scarcity Rule</span>
          </div>
        </div>

        {/* 8. All-Time High (ATH) */}
        <div className="card-base p-4 rounded-xl border border-line bg-paper flex flex-col justify-between hover:border-accent/30 transition-all duration-150">
          <div className="flex items-center justify-between text-xs text-muted font-medium mb-1.5">
            <span>All-Time High (ATH)</span>
            {profile.athChangePct !== null ? (
              <span className="text-[10px] font-mono font-bold text-loss bg-loss/10 px-1.5 py-0.5 rounded">
                {profile.athChangePct.toFixed(1)}%
              </span>
            ) : null}
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-black text-text tracking-tight">
            {profile.athPrice ? `$${fmtPx(profile.athPrice)}` : "—"}
          </div>
          <div className="text-[11px] text-muted mt-2.5 flex items-center justify-between">
            <span>
              {profile.athDate
                ? new Date(profile.athDate).toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric",
                  })
                : "Cycle peak"}
            </span>
            <span className="text-[10px] text-muted/70">Peak Price</span>
          </div>
        </div>
      </div>
    </div>
  );
}
