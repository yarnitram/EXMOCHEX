"use client";

import { useState } from "react";
import Link from "next/link";
import type { TokenProfile } from "@/types/token-profile";
import { compact, fmtPct, fmtPx } from "@/lib/format";

interface TokenHeaderProps {
  profile: TokenProfile;
}

export function TokenHeader({ profile }: TokenHeaderProps) {
  const [iconBroken, setIconBroken] = useState(false);
  const isGain = profile.priceChange24h > 0;
  const isLoss = profile.priceChange24h < 0;

  // Range percentage
  const rangeDiff = profile.high24h - profile.low24h;
  const rangePct =
    rangeDiff > 0
      ? Math.max(0, Math.min(100, ((profile.price - profile.low24h) / rangeDiff) * 100))
      : 50;

  return (
    <div className="card-base p-6 rounded-2xl border border-line bg-paper/90 backdrop-blur shadow-sm space-y-6">
      {/* 1. Main Row: Identity & Price */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left: Token Identity & Badges */}
        <div className="flex items-start gap-4">
          {profile.iconUrl && !iconBroken ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={profile.iconUrl}
              alt={profile.symbol}
              onError={() => setIconBroken(true)}
              className="w-14 h-14 rounded-2xl object-cover border border-line p-1 bg-paper-2 shrink-0 shadow-sm"
            />
          ) : (
            <div className="w-14 h-14 rounded-2xl bg-accent/15 text-accent font-black text-xl flex items-center justify-center border border-accent/25 shrink-0 shadow-sm">
              {profile.symbol.slice(0, 3)}
            </div>
          )}

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-text">
                {profile.name}
              </h1>
              <span className="text-sm font-extrabold text-muted bg-paper-2 px-2 py-0.5 rounded-lg border border-line">
                {profile.symbol}
              </span>
              {profile.rank ? (
                <span className="text-xs font-black text-accent bg-accent/15 px-2.5 py-0.5 rounded-full border border-accent/25">
                  Rank #{profile.rank}
                </span>
              ) : null}
              <span className="text-[11px] font-bold text-muted bg-paper-2 px-2 py-0.5 rounded-full border border-line">
                USDT Perpetual
              </span>
            </div>

            {/* Categories / Narrative Tags */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
              {profile.categories.map((cat) => (
                <span
                  key={cat}
                  className="text-[10px] font-semibold text-muted bg-paper-3 px-2 py-0.5 rounded-md hover:text-text transition-colors"
                >
                  {cat}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Price & 24h Range */}
        <div className="flex flex-col sm:flex-row sm:items-end lg:items-end gap-5">
          {/* Price & Change */}
          <div className="lg:text-right">
            <div className="text-xs text-muted font-medium mb-0.5">Live Mark Price</div>
            <div className="flex items-baseline gap-2.5 lg:justify-end">
              <span className="text-3xl sm:text-4xl font-mono font-black text-text tracking-tight">
                ${fmtPx(profile.price)}
              </span>
              <span
                className={`inline-flex items-center gap-0.5 px-2.5 py-1 rounded-lg text-xs font-bold font-mono ${
                  isGain
                    ? "text-profit bg-profit/10 border border-profit/20"
                    : isLoss
                    ? "text-loss bg-loss/10 border border-loss/20"
                    : "text-muted bg-paper-2 border border-line"
                }`}
              >
                <span>{isGain ? "▲" : isLoss ? "▼" : ""}</span>
                <span>{fmtPct(profile.priceChange24h)}</span>
              </span>
            </div>
          </div>

          {/* 24h Range Bar */}
          <div className="w-full sm:w-48 flex flex-col gap-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] font-mono text-muted">
              <span>Low: ${fmtPx(profile.low24h)}</span>
              <span>High: ${fmtPx(profile.high24h)}</span>
            </div>
            <div className="relative w-full h-2 bg-paper-3 rounded-full overflow-hidden">
              <div
                className="absolute top-0 bottom-0 left-0 bg-accent rounded-full transition-all duration-300"
                style={{ width: `${rangePct}%` }}
              />
            </div>
            <div className="text-[10px] text-muted text-right font-mono">
              24h Range Position: {rangePct.toFixed(0)}%
            </div>
          </div>
        </div>
      </div>

      {/* 2. Official Links Dock */}
      <div className="hairline-t pt-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted font-semibold mr-1">Official Links:</span>

        {/* Websites */}
        {profile.links.websites.map((url, idx) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-paper-2 text-text font-semibold hover:bg-accent/15 hover:text-accent border border-line transition-colors"
          >
            <span>🌐</span>
            <span>{idx === 0 ? "Website" : `Website ${idx + 1}`}</span>
            <span className="text-[10px] text-muted">↗</span>
          </a>
        ))}

        {/* Whitepaper */}
        {profile.links.whitepaper ? (
          <a
            href={profile.links.whitepaper}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-paper-2 text-text font-semibold hover:bg-accent/15 hover:text-accent border border-line transition-colors"
          >
            <span>📄</span>
            <span>Whitepaper</span>
            <span className="text-[10px] text-muted">↗</span>
          </a>
        ) : null}

        {/* Twitter / X */}
        {profile.links.twitter ? (
          <a
            href={profile.links.twitter}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-paper-2 text-text font-semibold hover:bg-accent/15 hover:text-accent border border-line transition-colors"
          >
            <span>𝕏</span>
            <span>Twitter</span>
            <span className="text-[10px] text-muted">↗</span>
          </a>
        ) : null}

        {/* Telegram */}
        {profile.links.telegram ? (
          <a
            href={profile.links.telegram}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-paper-2 text-text font-semibold hover:bg-accent/15 hover:text-accent border border-line transition-colors"
          >
            <span>💬</span>
            <span>Telegram</span>
            <span className="text-[10px] text-muted">↗</span>
          </a>
        ) : null}

        {/* Explorers */}
        {profile.links.explorers.map((url, idx) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-paper-2 text-text font-semibold hover:bg-accent/15 hover:text-accent border border-line transition-colors"
          >
            <span>🔍</span>
            <span>{idx === 0 ? "Explorer" : `Explorer ${idx + 1}`}</span>
            <span className="text-[10px] text-muted">↗</span>
          </a>
        ))}

        {/* Source Code */}
        {profile.links.sourceCode ? (
          <a
            href={profile.links.sourceCode}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-paper-2 text-text font-semibold hover:bg-accent/15 hover:text-accent border border-line transition-colors"
          >
            <span>💻</span>
            <span>GitHub</span>
            <span className="text-[10px] text-muted">↗</span>
          </a>
        ) : null}

        {/* Chart Quick Jump */}
        <Link
          href={`/chart/${profile.symbol}`}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 text-accent font-bold hover:bg-accent hover:text-white border border-accent/25 transition-colors ml-auto"
        >
          <span>📈</span>
          <span>Open Chart</span>
        </Link>
      </div>
    </div>
  );
}
