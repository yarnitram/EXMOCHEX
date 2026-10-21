import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getLiveBubbleMapData,
  DEFAULT_PRESETS,
  SOLANA_MEME_PRESETS,
  EVM_MEME_PRESETS,
  getExplorerUrl,
} from "@/lib/live-bubblemaps";

describe("live-bubblemaps - Multi-Chain Meme Coin Aggregator", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exports valid meme token preset categories", () => {
    expect(SOLANA_MEME_PRESETS).toContain("POPCAT");
    expect(SOLANA_MEME_PRESETS).toContain("GOAT");
    expect(SOLANA_MEME_PRESETS).toContain("WIF");

    expect(EVM_MEME_PRESETS).toContain("PEPE");
    expect(EVM_MEME_PRESETS).toContain("BRETT");
    expect(EVM_MEME_PRESETS).toContain("DEGEN");

    expect(DEFAULT_PRESETS.length).toBe(SOLANA_MEME_PRESETS.length + EVM_MEME_PRESETS.length);
  });

  it("generates correct explorer URLs for different chains", () => {
    expect(getExplorerUrl("solana", "token", "7GCihg")).toBe("https://solscan.io/token/7GCihg");
    expect(getExplorerUrl("base", "account", "0x123")).toBe("https://basescan.org/address/0x123");
    expect(getExplorerUrl("ethereum", "account", "0xabc")).toBe("https://etherscan.io/address/0xabc");
    expect(getExplorerUrl("bsc", "token", "0xdef")).toBe("https://bscscan.com/token/0xdef");
  });

  it("aggregates live Solana on-chain holders from RugCheck correctly", async () => {
    const mockDexResponse = {
      pairs: [
        {
          chainId: "solana",
          dexId: "raydium",
          pairAddress: "FRhB8L7Y9Qq41qZXYLtC2nw8An1RJfLLxRF2x9RwLLMo",
          baseToken: {
            address: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
            name: "Popcat",
            symbol: "POPCAT",
          },
          priceUsd: "0.68",
          priceChange: { h24: 12.5 },
          fdv: 680000000,
          liquidity: { usd: 3500000 },
        },
      ],
    };

    const mockRugCheckResponse = {
      score: 500, // 500 / 25 = 20 normalized
      creator: "DevWallet1111111111111111111111111111111111",
      knownAccounts: {
        FRhB8L7Y9Qq41qZXYLtC2nw8An1RJfLLxRF2x9RwLLMo: {
          name: "Raydium AMM Pool",
          type: "AMM",
        },
      },
      markets: [
        {
          pubkey: "FRhB8L7Y9Qq41qZXYLtC2nw8An1RJfLLxRF2x9RwLLMo",
          liquidityA: "PoolTokenAccount11111111111111111111111111",
          mintAAccount: { supply: 1000000000000000000, decimals: 9 },
        },
      ],
      insiderNetworks: [{ id: "cluster-1", size: 3, tokenAmount: 50000000 }],
      topHolders: [
        {
          address: "FRhB8L7Y9Qq41qZXYLtC2nw8An1RJfLLxRF2x9RwLLMo",
          owner: "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
          pct: 10.5,
          uiAmount: 105000000,
          insider: false,
        },
        {
          address: "DevWallet1111111111111111111111111111111111",
          owner: "DevWallet1111111111111111111111111111111111",
          pct: 4.2,
          uiAmount: 42000000,
          insider: false,
        },
        {
          address: "InsiderWalletA11111111111111111111111111111",
          owner: "InsiderWalletA11111111111111111111111111111",
          pct: 3.5,
          uiAmount: 35000000,
          insider: true,
        },
      ],
    };

    vi.spyOn(global, "fetch").mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("dexscreener")) {
        return { ok: true, json: async () => mockDexResponse } as any;
      }
      if (urlStr.includes("rugcheck")) {
        return { ok: true, json: async () => mockRugCheckResponse } as any;
      }
      return { ok: false } as any;
    });

    const result = await getLiveBubbleMapData("POPCAT_UNIT_TEST");

    expect(result.token.symbol).toBe("POPCAT");
    expect(result.token.price).toBe(0.68);
    expect(result.token.isOnChainLive).toBe(true);
    expect(result.token.riskScore).toBe(20);

    const poolNode = result.nodes.find((n) => n.type === "pool");
    expect(poolNode).toBeDefined();
    expect(poolNode?.label).toContain("Raydium");

    const devNode = result.nodes.find((n) => n.type === "dev");
    expect(devNode).toBeDefined();

    const sniperNode = result.nodes.find((n) => n.type === "sniper");
    expect(sniperNode).toBeDefined();
  });

  it("aggregates live EVM on-chain holders from GoPlus for Ethereum/Base meme coins", async () => {
    const mockDexResponse = {
      pairs: [
        {
          chainId: "ethereum",
          dexId: "uniswap",
          pairAddress: "0xa43fe16908251ee70ef74718545e4fe6c5ccec9f",
          baseToken: {
            address: "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
            name: "Pepe",
            symbol: "PEPE",
          },
          priceUsd: "0.0000045",
          priceChange: { h24: -3.4 },
          fdv: 1800000000,
          liquidity: { usd: 25000000 },
        },
      ],
    };

    const mockGoPlusResponse = {
      code: 1,
      result: {
        "0x6982508145454ce325ddbe47a25d4ec3d2311933": {
          token_name: "Pepe",
          token_symbol: "PEPE",
          creator_address: "0xfbfEaF0DA0F2fdE5c66dF570133aE35f3eB58c9A",
          owner_percent: "0.0",
          is_honeypot: "0",
          buy_tax: "0",
          sell_tax: "0",
          cannot_sell_all: "0",
          is_open_source: "1",
          dex: [
            {
              name: "UniswapV2",
              pair: "0xa43fe16908251ee70ef74718545e4fe6c5ccec9f",
              liquidity: "15000000",
            },
          ],
          holders: [
            {
              address: "0xf977814e90da44bfa03b6295a0616a897441acec",
              percent: "0.0898",
              balance: "37816546361767",
              is_contract: 0,
              is_locked: 0,
            },
            {
              address: "0x1d48963dd8fada6ab5c2c7b92eba81ecc5030270",
              percent: "0.0616",
              balance: "25941899262095",
              is_contract: 0,
              is_locked: 0,
            },
            {
              address: "0x000000000000000000000000000000000000dead",
              percent: "0.055",
              balance: "20000000000000",
              is_contract: 1,
              is_locked: 1,
              tag: "Burn Address",
            },
          ],
        },
      },
    };

    vi.spyOn(global, "fetch").mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("dexscreener")) {
        return { ok: true, json: async () => mockDexResponse } as any;
      }
      if (urlStr.includes("gopluslabs")) {
        return { ok: true, json: async () => mockGoPlusResponse } as any;
      }
      return { ok: false } as any;
    });

    const result = await getLiveBubbleMapData("PEPE_UNIT_TEST");

    expect(result.token.symbol).toBe("PEPE");
    expect(result.token.chain).toBe("Ethereum");
    expect(result.token.isOnChainLive).toBe(true);

    const poolNode = result.nodes.find((n) => n.type === "pool");
    expect(poolNode).toBeDefined();
    expect(poolNode?.label).toContain("Uniswap");

    const devNode = result.nodes.find((n) => n.type === "dev");
    expect(devNode).toBeDefined();
    expect(devNode?.id).toBe("0xfbfEaF0DA0F2fdE5c66dF570133aE35f3eB58c9A");

    const whaleNodes = result.nodes.filter((n) => n.type === "whale");
    expect(whaleNodes.length).toBeGreaterThan(0);
    expect(whaleNodes[0].holdingPct).toBe(8.98);

    const devLink = result.links.find((l) => l.type === "dev_split");
    expect(devLink).toBeDefined();
  });
});
