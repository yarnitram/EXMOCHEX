import { NextResponse } from "next/server";
import { POST as handleBotWebhookPost, GET as handleBotWebhookGet } from "@/app/api/trades/webhook/route";

export const dynamic = "force-dynamic";

/**
 * GET /api/webhooks/tradingview
 * Returns webhook schema & active trades when authenticated.
 */
export async function GET(request: Request) {
  return handleBotWebhookGet(request);
}

/**
 * POST /api/webhooks/tradingview
 * Ingest external TradingView alerts or Mochbot signals into Watchlist or Trades.
 * Preserves legacy TradingView behavior (defaults to "watchlist" if no `action` field is passed,
 * whereas `/api/trades/webhook` defaults to "open" trade).
 */
export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    try {
      const text = await request.text();
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }
  }

  // If no explicit action/event/type was provided on the legacy /api/webhooks/tradingview route,
  // default to "watchlist" unless trade-specific fields (like trade_id or action="trade") are present.
  const rawAction = String(
    body.action ?? body.event ?? body.type ?? ""
  )
    .trim()
    .toLowerCase();

  let effectiveAction = rawAction;
  if (!effectiveAction) {
    effectiveAction = body.trade_id ? "update" : "watchlist";
  } else if (effectiveAction === "trade" || effectiveAction === "execute") {
    effectiveAction = "open";
  }

  const forwardedBody = {
    ...body,
    action: effectiveAction,
  };

  const clonedRequest = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(forwardedBody),
  });

  return handleBotWebhookPost(clonedRequest);
}
