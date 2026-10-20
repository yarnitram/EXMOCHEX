import { describe, it, expect, vi, beforeEach } from "vitest";
import { getLiveBubbleMapData, DEFAULT_PRESETS } from "@/lib/live-bubblemaps";

describe("live-bubblemaps - On-Chain Aggregator", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("exports valid default presets", () => {
    expect(DEFAULT_PRESETS).toContain("POPCAT");
    expect(DEFAULT_PRESETS).toContain("GOAT");
    expect(DEFAULT_PRESETS).toContain("MOODENG");
  });

  it("aggregates live Solana on-chain holders and generates nodes & links correctly", async () => {
    // Mock DexScreener response
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

    // Mock RugCheck response
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
      insiderNetworks: [
        { id: "cluster-1", size: 3, tokenAmount: 50000000 },
      ],
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
        {
          address: "WhaleWalletB1111111111111111111111111111111",
          owner: "WhaleWalletB1111111111111111111111111111111",
          pct: 2.8,
          uiAmount: 28000000,
          insider: false,
        },
      ],
    };

    vi.spyOn(global, "fetch").mockImplementation(async (url: any) => {
      const urlStr = String(url);
      if (urlStr.includes("dexscreener")) {
        return {
          ok: true,
          json: async () => mockDexResponse,
        } as any;
      }
      if (urlStr.includes("rugcheck")) {
        return {
          ok: true,
          json: async () => mockRugCheckResponse,
        } as any;
      }
      return { ok: false } as any;
    });

    const result = await getLiveBubbleMapData("POPCAT_TEST");

    expect(result.token.symbol).toBe("POPCAT");
    expect(result.token.price).toBe(0.68);
    expect(result.token.isSolanaLive).toBe(true);
    expect(result.token.riskScore).toBe(20);

    // Verify nodes
    expect(result.nodes.length).toBe(4);
    const poolNode = result.nodes.find((n) => n.type === "pool");
    expect(poolNode).toBeDefined();
    expect(poolNode?.holdingPct).toBe(10.5);

    const devNode = result.nodes.find((n) => n.type === "dev");
    expect(devNode).toBeDefined();
    expect(devNode?.clusterId).toBe(1);

    const insiderNode = result.nodes.find((n) => n.type === "sniper");
    expect(insiderNode).toBeDefined();
    expect(insiderNode?.clusterId).toBe(2);

    // Verify links
    expect(result.links.length).toBeGreaterThan(0);
    const devLink = result.links.find((l) => l.type === "dev_split");
    expect(devLink).toBeDefined();
  });

  it("handles EVM tokens with hybrid notice and live DEX price", async () => {
    const mockDexResponse = {
      pairs: [
        {
          chainId: "ethereum",
          dexId: "uniswap",
          pairAddress: "0x1234567890abcdef1234567890abcdef12345678",
          baseToken: {
            address: "0xE0f63A424a4439cBE457D80E4f4b51aD25b2c56C",
            name: "SPX6900",
            symbol: "SPX",
          },
          priceUsd: "0.75",
          priceChange: { h24: 5.2 },
          fdv: 750000000,
          liquidity: { usd: 12000000 },
        },
      ],
    };

    vi.spyOn(global, "fetch").mockImplementation(async (url: any) => {
      return {
        ok: true,
        json: async () => mockDexResponse,
      } as any;
    });

    const result = await getLiveBubbleMapData("0xE0f63A424a4439cBE457D80E4f4b51aD25b2c56C");

    expect(result.token.symbol).toBe("SPX");
    expect(result.token.chain).toBe("Ethereum");
    expect(result.token.isSolanaLive).toBe(false);
    expect(result.token.notice).toContain("Phase 2");
    expect(result.nodes.length).toBeGreaterThan(1);
    expect(result.nodes[0].type).toBe("pool");
  });
});
