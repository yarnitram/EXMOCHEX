"use client";

import type { TokenProfile } from "@/types/token-profile";

interface TokenUsecaseCardProps {
  profile: TokenProfile;
}

export function TokenUsecaseCard({ profile }: TokenUsecaseCardProps) {
  return (
    <div className="card-base p-6 rounded-2xl border border-line bg-paper/90 backdrop-blur shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-extrabold text-text flex items-center gap-2">
          <span>📖 Project Overview & Usecase</span>
        </h3>
        <span className="text-[11px] text-muted font-medium">
          Verified Documentation
        </span>
      </div>

      {/* Description Content */}
      <div className="prose prose-invert max-w-none text-xs sm:text-sm text-text/90 leading-relaxed font-normal whitespace-pre-line bg-paper-2/50 p-4 rounded-xl border border-line">
        {profile.description}
      </div>

      {/* Ecosystem & Contract Metadata Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
        <div className="p-3 rounded-xl bg-paper-2 border border-line">
          <div className="text-muted text-[11px]">Primary Sector</div>
          <div className="font-bold text-text mt-0.5">
            {profile.categories[0] || "Cryptocurrency"}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-paper-2 border border-line">
          <div className="text-muted text-[11px]">MEXC Futures Pair</div>
          <div className="font-mono font-bold text-text mt-0.5">
            {profile.contractSymbol}
          </div>
        </div>

        <div className="p-3 rounded-xl bg-paper-2 border border-line">
          <div className="text-muted text-[11px]">Settlement Asset</div>
          <div className="font-bold text-text mt-0.5">USDT (Tether)</div>
        </div>

        <div className="p-3 rounded-xl bg-paper-2 border border-line">
          <div className="text-muted text-[11px]">Max Leverage</div>
          <div className="font-mono font-bold text-accent mt-0.5">
            Up to {profile.maxLeverage || 50}x
          </div>
        </div>
      </div>
    </div>
  );
}
