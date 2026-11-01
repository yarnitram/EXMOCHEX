import { NextResponse } from "next/server";
import type { TokenProfile, DilutionRiskLevel } from "@/types/token-profile";
import { cleanSymbol, mexcChartUrl } from "@/lib/format";

export const dynamic = "force-dynamic";

interface CacheEntry {
  data: TokenProfile;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000; // 60-second in-memory cache

const MEXC_FUTURES_BASE = "https://contract.mexc.com/api/v1/contract";

export async function GET(
  request: Request,
  context: { params: Promise<{ symbol: string }> }
) {
  const { symbol: rawSymbol } = await context.params;
  if (!rawSymbol) {
    return NextResponse.json({ error: "Symbol parameter required" }, { status: 400 });
  }

  const baseSymbol = cleanSymbol(rawSymbol).toUpperCase();
  const contractSymbol = `${baseSymbol}_USDT`;

  // Check cache
  const cached = cache.get(baseSymbol);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json({ success: true, data: cached.data });
  }

  try {
    // 1. Fetch MEXC Futures Ticker & Detail concurrently
    const [mexcTickerRes, mexcDetailRes] = await Promise.all([
      fetch(`${MEXC_FUTURES_BASE}/ticker?symbol=${encodeURIComponent(contractSymbol)}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(6000),
      }).catch(() => null),
      fetch(`${MEXC_FUTURES_BASE}/detail?symbol=${encodeURIComponent(contractSymbol)}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(6000),
      }).catch(() => null),
    ]);

    let mexcPrice = 0;
    let mexcHigh24 = 0;
    let mexcLow24 = 0;
    let mexcChange24 = 0;
    let mexcVolume24 = 0;
    let mexcOpenInterest = 0;
    let mexcFundingRate = 0;
    let mexcMaxLev = 50;
    let mexcIcon = "";
    let mexcContractSize = 1;

    if (mexcTickerRes && mexcTickerRes.ok) {
      const tickerJson = await mexcTickerRes.json();
      const t = tickerJson.data;
      if (t) {
        mexcPrice = Number(t.lastPrice) || 0;
        mexcHigh24 = Number(t.high24Price) || 0;
        mexcLow24 = Number(t.lower24Price) || 0;
        mexcChange24 = Number(t.riseFallRate) || 0;
        mexcVolume24 = Number(t.amount24) || 0;
        mexcFundingRate = Number(t.fundingRate) || 0;
      }
    }

    if (mexcDetailRes && mexcDetailRes.ok) {
      const detailJson = await mexcDetailRes.json();
      const d = detailJson.data;
      if (d) {
        mexcMaxLev = Number(d.maxLeverage) || 50;
        mexcIcon = d.baseCoinIconUrl || "";
        mexcContractSize = Number(d.contractSize) || 1;
      }
    }

    // 2. Fetch CoinPaprika Token Data
    let cpTicker: any = null;
    let cpCoin: any = null;

    try {
      const cpSearchRes = await fetch(
        `https://api.coinpaprika.com/v1/search?q=${encodeURIComponent(baseSymbol)}&c=currencies&limit=6`,
        { cache: "no-store", signal: AbortSignal.timeout(6000) }
      );
      if (cpSearchRes.ok) {
        const searchJson = await cpSearchRes.json();
        const match = searchJson.currencies?.find(
          (c: any) => c.symbol.toUpperCase() === baseSymbol
        );
        if (match?.id) {
          const [tRes, cRes] = await Promise.all([
            fetch(`https://api.coinpaprika.com/v1/tickers/${match.id}`, {
              cache: "no-store",
              signal: AbortSignal.timeout(6000),
            }).catch(() => null),
            fetch(`https://api.coinpaprika.com/v1/coins/${match.id}`, {
              cache: "no-store",
              signal: AbortSignal.timeout(6000),
            }).catch(() => null),
          ]);
          if (tRes && tRes.ok) cpTicker = await tRes.json();
          if (cRes && cRes.ok) cpCoin = await cRes.json();
        }
      }
    } catch {}

    // 3. Optional DexScreener Fallback for Socials and Web
    let dexWebsites: string[] = [];
    let dexTwitter: string | null = null;
    let dexTelegram: string | null = null;
    let dexMarketCap = 0;
    let dexFdv = 0;

    try {
      const dexRes = await fetch(
        `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(baseSymbol)}`,
        { cache: "no-store", signal: AbortSignal.timeout(5000) }
      );
      if (dexRes.ok) {
        const dexJson = await dexRes.json();
        const matchPair = dexJson.pairs?.find(
          (p: any) =>
            p.baseToken?.symbol?.toUpperCase() === baseSymbol &&
            (p.info?.websites || p.info?.socials)
        );
        if (matchPair) {
          dexMarketCap = Number(matchPair.marketCap) || 0;
          dexFdv = Number(matchPair.fdv) || 0;
          if (Array.isArray(matchPair.info?.websites)) {
            dexWebsites = matchPair.info.websites.map((w: any) => w.url).filter(Boolean);
          }
          if (Array.isArray(matchPair.info?.socials)) {
            for (const s of matchPair.info.socials) {
              if (s.type === "twitter" && !dexTwitter) dexTwitter = s.url;
              if (s.type === "telegram" && !dexTelegram) dexTelegram = s.url;
            }
          }
        }
      }
    } catch {}

    // 4. Resolve Metrics & Synthesize Fundamentals
    const finalPrice = mexcPrice > 0 ? mexcPrice : Number(cpTicker?.quotes?.USD?.price) || 0;
    const finalHigh24 = mexcHigh24 > 0 ? mexcHigh24 : finalPrice * 1.05;
    const finalLow24 = mexcLow24 > 0 ? mexcLow24 : finalPrice * 0.95;
    const finalChange24 =
      mexcChange24 !== 0
        ? mexcChange24
        : (Number(cpTicker?.quotes?.USD?.percent_change_24h) || 0) / 100;

    const name = cpCoin?.name || cpTicker?.name || baseSymbol;
    const rank = cpTicker?.rank || cpCoin?.rank || null;

    let marketCap: number | null =
      Number(cpTicker?.quotes?.USD?.market_cap) ||
      dexMarketCap ||
      null;

    let totalSupply: number | null = Number(cpTicker?.total_supply) || null;
    let maxSupply: number | null =
      cpTicker?.max_supply && Number(cpTicker.max_supply) > 0
        ? Number(cpTicker.max_supply)
        : null;

    let circulatingSupply: number | null =
      Number(cpTicker?.circulating_supply) ||
      (marketCap && finalPrice > 0 ? marketCap / finalPrice : null) ||
      null;

    if (!marketCap && circulatingSupply && finalPrice > 0) {
      marketCap = circulatingSupply * finalPrice;
    }

    let fdv: number | null =
      dexFdv ||
      (maxSupply && finalPrice > 0
        ? maxSupply * finalPrice
        : totalSupply && finalPrice > 0
        ? totalSupply * finalPrice
        : marketCap);

    let circulatingPct: number | null = null;
    const denominatorSupply = maxSupply || totalSupply;
    if (circulatingSupply && denominatorSupply && denominatorSupply > 0) {
      circulatingPct = Math.min(100, Math.max(0, (circulatingSupply / denominatorSupply) * 100));
    } else if (circulatingSupply && !denominatorSupply) {
      circulatingPct = 100;
    }

    // Dilution Risk Score
    let dilutionRatio: number | null = null;
    let dilutionRisk: DilutionRiskLevel = "low";
    if (marketCap && fdv && marketCap > 0) {
      dilutionRatio = fdv / marketCap;
      if (dilutionRatio > 3) {
        dilutionRisk = "high";
      } else if (dilutionRatio > 1.25) {
        dilutionRisk = "moderate";
      } else {
        dilutionRisk = "low";
      }
    }

    // 24h Total Volume (Spot + Perps)
    const spotVolume = Number(cpTicker?.quotes?.USD?.volume_24h) || 0;
    const volume24h = Math.max(spotVolume, mexcVolume24) || (spotVolume + mexcVolume24) || null;

    // Perps Open Interest
    const holdVolContracts = Number(mexcTickerRes ? (await mexcTickerRes.clone().json().catch(() => ({})))?.data?.holdVol : 0) || 0;
    const openInterest = holdVolContracts > 0
      ? holdVolContracts * mexcContractSize * (finalPrice || 1)
      : null;

    const volumeMcRatio = marketCap && volume24h ? volume24h / marketCap : null;
    const oiMcRatio = marketCap && openInterest ? openInterest / marketCap : null;

    // Historical ATH
    const athPrice = Number(cpTicker?.quotes?.USD?.ath_price) || null;
    const athDate = cpTicker?.quotes?.USD?.ath_date || null;
    const athChangePct = Number(cpTicker?.quotes?.USD?.percent_from_price_ath) || null;

    // Project Description & Narrative
    let description = cpCoin?.description || "";
    if (!description && cpCoin?.org_structure) {
      description = `${name} (${baseSymbol}) is a cryptocurrency project focused on decentralized blockchain infrastructure.`;
    }
    if (!description) {
      description = `${name} (${baseSymbol}) is actively traded as a perpetual futures contract on MEXC and global cryptocurrency markets.`;
    }

    // Categories / Tags
    const categories: string[] = [];
    if (Array.isArray(cpCoin?.tags)) {
      for (const t of cpCoin.tags) {
        if (t.name && categories.length < 6) categories.push(t.name);
      }
    }
    if (categories.length === 0) {
      categories.push("Crypto", "Perpetuals", "USDT Futures");
    }

    // Links Assembly
    const websites: string[] = [];
    if (Array.isArray(cpCoin?.links?.website)) {
      websites.push(...cpCoin.links.website.filter(Boolean));
    }
    if (dexWebsites.length > 0) {
      for (const w of dexWebsites) {
        if (!websites.includes(w)) websites.push(w);
      }
    }

    const explorers: string[] = [];
    if (Array.isArray(cpCoin?.links?.explorer)) {
      explorers.push(...cpCoin.links.explorer.filter(Boolean).slice(0, 4));
    }

    const whitepaper = cpCoin?.whitepaper?.link || null;
    const twitter = cpCoin?.links?.twitter?.[0] || dexTwitter || null;
    const telegram = cpCoin?.links?.telegram?.[0] || dexTelegram || null;
    const sourceCode = cpCoin?.links?.source_code?.[0] || null;
    const reddit = cpCoin?.links?.reddit?.[0] || null;
    const mexcFutures = mexcChartUrl(contractSymbol);

    const profile: TokenProfile = {
      symbol: baseSymbol,
      name,
      contractSymbol,
      rank,
      iconUrl: mexcIcon || cpCoin?.logo || null,
      price: finalPrice,
      priceChange24h: finalChange24,
      high24h: finalHigh24,
      low24h: finalLow24,
      marketCap,
      fdv,
      volume24h,
      openInterest,
      fundingRate: mexcFundingRate,
      maxLeverage: mexcMaxLev,
      circulatingSupply,
      totalSupply,
      maxSupply,
      circulatingPct,
      dilutionRatio,
      dilutionRisk,
      volumeMcRatio,
      oiMcRatio,
      athPrice,
      athDate,
      athChangePct,
      description,
      categories,
      links: {
        websites,
        whitepaper,
        twitter,
        telegram,
        explorers,
        sourceCode,
        reddit,
        mexcFutures,
      },
      fetchedAt: Date.now(),
    };

    // Cache the profile
    cache.set(baseSymbol, {
      data: profile,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return NextResponse.json({ success: true, data: profile });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to fetch token profile" },
      { status: 502 }
    );
  }
}
