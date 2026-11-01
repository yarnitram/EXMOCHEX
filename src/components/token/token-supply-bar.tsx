"use client";

import type { TokenProfile } from "@/types/token-profile";
import { compactSupply } from "@/lib/format";

interface TokenSupplyBarProps {
  profile: TokenProfile;
}

export function TokenSupplyBar({ profile }: TokenSupplyBarProps) {
  const circPct = profile.circulatingPct !== null ? profile.circulatingPct : 100;
  const lockedPct = Math.max(0, 100 - circPct);

  return (
    <div className="card-base p-6 rounded-2xl border border-line bg-paper/90 backdrop-blur shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-extrabold text-text flex items-center gap-2">
            <span>🪙 Token Supply & Dilution Structure</span>
          </h3>
          <p className="text-xs text-muted mt-0.5">
            Breakdown of active circulating tokens versus future team, VC, and foundation unlocks.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-muted">Circulating:</span>
            <strong className="text-text font-bold">{circPct.toFixed(1)}%</strong>
          </div>
          {lockedPct > 0 ? (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-muted">Locked / Vesting:</span>
              <strong className="text-text font-bold">{lockedPct.toFixed(1)}%</strong>
            </div>
          ) : null}
        </div>
      </div>

      {/* Visual Multi-Segment Bar */}
      <div className="w-full h-3.5 bg-paper-3 rounded-full overflow-hidden flex shadow-inner">
        <div
          className="bg-emerald-500 h-full transition-all duration-500 ease-out"
          style={{ width: `${circPct}%` }}
          title={`Circulating Supply: ${circPct.toFixed(1)}%`}
        />
        {lockedPct > 0 ? (
          <div
            className="bg-amber-500/80 h-full transition-all duration-500 ease-out"
            style={{ width: `${lockedPct}%` }}
            title={`Locked / Unreleased: ${lockedPct.toFixed(1)}%`}
          />
        ) : null}
      </div>

      {/* Detailed Numbers & Guidance */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
        <div className="p-3 rounded-xl bg-paper-2 border border-line">
          <div className="text-muted text-[11px] mb-0.5">Circulating Float</div>
          <div className="text-sm font-mono font-bold text-text">
            {compactSupply(profile.circulatingSupply, profile.symbol)}
          </div>
          <div className="text-[10px] text-muted mt-1">Available for immediate trade</div>
        </div>

        <div className="p-3 rounded-xl bg-paper-2 border border-line">
          <div className="text-muted text-[11px] mb-0.5">Total Minted Supply</div>
          <div className="text-sm font-mono font-bold text-text">
            {compactSupply(profile.totalSupply, profile.symbol)}
          </div>
          <div className="text-[10px] text-muted mt-1">Includes treasury and staked vaults</div>
        </div>

        <div className="p-3 rounded-xl bg-paper-2 border border-line">
          <div className="text-muted text-[11px] mb-0.5">Max Supply Ceiling</div>
          <div className="text-sm font-mono font-bold text-text">
            {profile.maxSupply ? compactSupply(profile.maxSupply, profile.symbol) : "Infinite / Dynamic"}
          </div>
          <div className="text-[10px] text-muted mt-1">
            {profile.maxSupply ? "No more tokens can ever be minted" : "Programmatic burn or inflation model"}
          </div>
        </div>
      </div>

      {/* Dilution Alert / Risk Summary */}
      <div
        className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
          profile.dilutionRisk === "high"
            ? "bg-loss/10 border-loss/30 text-loss"
            : profile.dilutionRisk === "moderate"
            ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
            : "bg-profit/10 border-profit/30 text-profit"
        }`}
      >
        <span className="text-base leading-none">
          {profile.dilutionRisk === "high"
            ? "⚠️"
            : profile.dilutionRisk === "moderate"
            ? "ℹ️"
            : "✓"}
        </span>
        <div className="leading-relaxed">
          {profile.dilutionRisk === "high" ? (
            <>
              <strong>High Unlock Dilution Risk:</strong> Over 70% of tokens are yet to enter circulation (FDV is {profile.dilutionRatio?.toFixed(1)}x Market Cap). Expect downward price pressure during scheduled team/investor vesting cliff dates.
            </>
          ) : profile.dilutionRisk === "moderate" ? (
            <>
              <strong>Moderate Unlock Schedule:</strong> Approximately {circPct.toFixed(0)}% of tokens are circulating. Monitor tokenomics roadmap for upcoming cliff releases.
            </>
          ) : (
            <>
              <strong>Low Dilution Risk:</strong> Over 80% of supply is already in active circulation (Market Cap is nearly equal to FDV). Minimal dilution threat from sudden team or VC dumps.
            </>
          )}
        </div>
      </div>
    </div>
  );
}
