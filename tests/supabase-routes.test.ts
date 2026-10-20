import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/watchlist/route";

// Mock Supabase server module
vi.mock("@/lib/supabase/server", () => {
  return {
    createClient: vi.fn(),
  };
});

import { createClient } from "@/lib/supabase/server";

describe("API Route - /api/watchlist (Mocked Supabase)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 Unauthorized on GET when user session is missing", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const res = await GET();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 200 and watchlist items on GET when authenticated", async () => {
    const mockItems = [
      { id: "item-1", symbol: "BTC_USDT", trigger_price: 60000 },
      { id: "item-2", symbol: "ETH_USDT", trigger_price: 3000 },
    ];

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123", email: "test@example.com" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: mockItems, error: null }),
        }),
      }),
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.items).toEqual(mockItems);
  });

  it("returns 400 Bad Request on POST when symbol is missing", async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
          error: null,
        }),
      },
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const req = new Request("http://localhost:3000/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: "Missing symbol test" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("symbol required");
  });

  it("inserts watchlist item and returns 201 on valid POST payload", async () => {
    const createdItem = {
      id: "new-item-id",
      user_id: "user-123",
      symbol: "SOL_USDT",
      trigger_price: 150,
      trigger_direction: "below",
      entry_price: 148,
      stop_loss: 140,
      take_profit: 170,
    };

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123" } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: createdItem, error: null }),
          }),
        }),
      }),
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    const req = new Request("http://localhost:3000/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        symbol: "SOL_USDT",
        trigger_price: 150,
        trigger_direction: "below",
        entry_price: 148,
        stop_loss: 140,
        take_profit: 170,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.item).toEqual(createdItem);
  });
});
