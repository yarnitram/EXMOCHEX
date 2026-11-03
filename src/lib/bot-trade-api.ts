import { cleanSymbol } from "@/lib/format";

export type BotAction = "open" | "update" | "close" | "watchlist";
export type BotSide = "long" | "short";

export interface BotFieldSpec {
  field: string;
  aliases?: string[];
  type: string;
  requiredFor: string;
  defaultVal: string;
  description: string;
  example: string;
}

/**
 * Complete reference of all JSON payload fields supported by the MOCHEX Bot & Trade Webhook API
 * (`POST /api/trades/webhook` and `POST /api/webhooks/tradingview`).
 */
export const BOT_API_FIELDS_SPEC: BotFieldSpec[] = [
  {
    field: "action",
    aliases: ["event", "type"],
    type: '"open" | "update" | "close" | "watchlist"',
    requiredFor: "Optional (defaults to 'open')",
    defaultVal: '"open"',
    description:
      "Lifecycle action to perform on /trades. Use 'open' (or 'trade') to start a new active trade, 'update' to modify SL/TP/notes on an active trade, or 'close' to close an active trade and log PnL to your Journal.",
    example: '"open"',
  },
  {
    field: "symbol",
    aliases: ["ticker", "pair", "coin"],
    type: "string",
    requiredFor: "Required (unless trade_id is passed on update/close)",
    defaultVal: "—",
    description:
      "Coin symbol. Automatically normalized to MEXC USDT Perpetual format (e.g. 'BTC', 'SOLUSDT', 'ETH/USDT', 'BINANCE:BTCUSDT.P' → 'BTC_USDT').",
    example: '"SOL_USDT"',
  },
  {
    field: "side",
    aliases: ["direction", "position"],
    type: '"long" | "short" | "buy" | "sell"',
    requiredFor: "Required for 'open'",
    defaultVal: '"long" (or inferred from entry vs SL)',
    description:
      "Trade direction. Accepts 'long'/'buy' or 'short'/'sell' (case-insensitive). Automatically maps to MOCHEX's internal trigger_direction ('below' for LONG, 'above' for SHORT).",
    example: '"long"',
  },
  {
    field: "entry_price",
    aliases: ["ep", "entry", "price"],
    type: "number",
    requiredFor: "Optional (Auto-filled from live MEXC price if omitted)",
    defaultVal: "Live MEXC Mark Price",
    description:
      "Execution entry price in USDT. If omitted (e.g. market order from Mochbot), MOCHEX automatically fetches the live MEXC Futures price at the moment of the request.",
    example: "185.40",
  },
  {
    field: "stop_loss",
    aliases: ["sl", "stop_price"],
    type: "number | null",
    requiredFor: "Optional (Recommended)",
    defaultVal: "null",
    description:
      "Stop-loss price in USDT. Monitored 24/7 by the MOCHEX background WebSocket engine to fire instant SL hit alerts.",
    example: "179.50",
  },
  {
    field: "take_profit",
    aliases: ["tp", "target_price"],
    type: "number | null",
    requiredFor: "Optional (Recommended)",
    defaultVal: "null",
    description:
      "Primary take-profit price in USDT. Monitored 24/7 by the MOCHEX background WebSocket engine to fire instant TP hit alerts.",
    example: "198.00",
  },
  {
    field: "margin_usd",
    aliases: ["margin", "size_usd"],
    type: "number",
    requiredFor: "Optional",
    defaultVal: "1",
    description:
      "Initial margin committed to the position in USD (used with leverage to compute notional size and live UPNL on /trades).",
    example: "100",
  },
  {
    field: "leverage",
    aliases: ["lev"],
    type: "number",
    requiredFor: "Optional",
    defaultVal: "20",
    description:
      "Position leverage multiplier (e.g. 10, 20, 50, 100). Used to compute live ROE% and realized PnL.",
    example: "20",
  },
  {
    field: "order_type",
    aliases: ["type_order"],
    type: '"market" | "limit" | "trigger_limit"',
    requiredFor: "Optional",
    defaultVal: '"market"',
    description: "Execution order type displayed in the Trades table.",
    example: '"market"',
  },
  {
    field: "trade_id",
    aliases: ["id", "alert_id"],
    type: "string (UUID)",
    requiredFor: "Optional for 'update' / 'close'",
    defaultVal: "Latest active trade for symbol",
    description:
      "Returned when a trade is opened. Pass trade_id on 'update' or 'close' to target a specific trade, or omit it and pass symbol (+ optional side) to automatically match your latest active trade for that coin.",
    example: '"d290f1ee-6c54-4b01-90e6-d701748f0851"',
  },
  {
    field: "exit_price",
    aliases: ["close_price", "exit"],
    type: "number",
    requiredFor: "Optional for 'close' (Auto-filled from live MEXC price)",
    defaultVal: "Live MEXC Mark Price",
    description:
      "Closing execution price when action='close'. Computes realized PnL ($ and %) and logs the completed trade into your Journal.",
    example: "196.80",
  },
  {
    field: "closed_reason",
    aliases: ["reason"],
    type: '"tp_hit" | "sl_hit" | "manual_close"',
    requiredFor: "Optional for 'close'",
    defaultVal: '"manual_close"',
    description: "Reason tag recorded on close and in the Trade Journal.",
    example: '"tp_hit"',
  },
  {
    field: "notes",
    aliases: ["thesis", "message", "comment", "close_notes"],
    type: "string",
    requiredFor: "Optional",
    defaultVal: '"Mochbot LONG SOL"',
    description: "Strategy name, bot signal thesis, or closing notes.",
    example: '"Mochbot v2 Momentum Breakout"',
  },
  {
    field: "notify",
    aliases: ["send_notification"],
    type: "boolean",
    requiredFor: "Optional",
    defaultVal: "true",
    description:
      "Whether MOCHEX should fan out a notification (Telegram, Discord, In-App) for this bot event. Set to false for silent ingestion.",
    example: "true",
  },
  {
    field: "api_key",
    aliases: ["key", "secret"],
    type: "string",
    requiredFor: "Required (via Header, Query, or Body)",
    defaultVal: "—",
    description:
      "Your personal MOCHEX API key from Settings. Can be passed in the X-API-Key header, Authorization: Bearer <key>, ?key= query param, or JSON body.",
    example: '"tv_sec_..."',
  },
];

/**
 * Extract the user's API / Webhook key from headers, query string, or JSON body.
 */
export function extractApiKey(
  request: Request,
  body?: Record<string, unknown> | null
): string | null {
  // 1. Check X-API-Key header
  const headerKey =
    request.headers.get("x-api-key") ||
    request.headers.get("x-mochex-key") ||
    request.headers.get("x-webhook-secret");
  if (headerKey && headerKey.trim()) {
    return headerKey.trim();
  }

  // 2. Check Authorization: Bearer <key>
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match && match[1].trim()) {
      return match[1].trim();
    }
  }

  // 3. Check URL query parameters (?api_key=..., ?key=..., ?secret=...)
  try {
    const url = new URL(request.url);
    const qKey =
      url.searchParams.get("api_key") ||
      url.searchParams.get("key") ||
      url.searchParams.get("secret");
    if (qKey && qKey.trim()) {
      return qKey.trim();
    }
  } catch {
    // ignore malformed URL
  }

  // 4. Check JSON body fields
  if (body) {
    const bodyKey = body.api_key ?? body.key ?? body.secret;
    if (typeof bodyKey === "string" && bodyKey.trim()) {
      return bodyKey.trim();
    }
  }

  return null;
}

/**
 * Normalize any coin symbol format into MEXC's `BASE_USDT` convention.
 * Examples:
 * - "btc" -> "BTC_USDT"
 * - "SOLUSDT" -> "SOL_USDT"
 * - "BINANCE:ETHUSDT.P" -> "ETH_USDT"
 * - "PEPE/USDT" -> "PEPE_USDT"
 */
export function normalizeBotSymbol(raw: unknown): string {
  let s = String(raw ?? "").trim().toUpperCase();
  if (!s) return "";

  // Strip exchange prefix e.g. "MEXC:BTCUSDT.P"
  if (s.includes(":")) {
    s = s.split(":").pop() || s;
  }
  // Strip perpetual suffixes e.g. ".P" or "-PERP"
  s = s.replace(/(\.P|-PERP|_PERP)$/i, "");
  // Replace "/" or "-" with "_"
  s = s.replace(/[\/\-]/g, "_");
  // Collapse multiple underscores
  s = s.replace(/_+/g, "_");

  if (!s.includes("_")) {
    if (s.endsWith("USDT") && s.length > 4) {
      s = `${s.slice(0, -4)}_USDT`;
    } else {
      s = `${s}_USDT`;
    }
  } else if (!s.endsWith("_USDT")) {
    const parts = s.split("_").filter(Boolean);
    s = `${parts[0]}_USDT`;
  }

  return s;
}

/**
 * Determine the lifecycle action requested by the bot payload.
 */
export function normalizeBotAction(body: Record<string, unknown>): BotAction {
  const raw = String(
    body.action ?? body.event ?? body.type ?? "open"
  )
    .trim()
    .toLowerCase();

  if (
    [
      "close",
      "exit",
      "closed",
      "close_trade",
      "take_profit",
      "stop_loss",
      "tp_hit",
      "sl_hit",
    ].includes(raw)
  ) {
    return "close";
  }

  if (
    [
      "update",
      "modify",
      "edit",
      "patch",
      "sl_tp",
      "update_sl_tp",
      "move_sl",
      "breakeven",
    ].includes(raw)
  ) {
    return "update";
  }

  if (["watchlist", "setup", "alert", "watch"].includes(raw)) {
    return "watchlist";
  }

  // If status is explicitly passed as "closed", treat as close (unless opening pre-closed)
  if (
    body.status === "closed" &&
    (body.trade_id != null || body.id != null || body.alert_id != null)
  ) {
    return "close";
  }

  return "open";
}

/**
 * Determine whether the trade is LONG or SHORT from flexible payload fields.
 */
export function normalizeBotSide(body: Record<string, unknown>): BotSide {
  const rawSide = String(
    body.side ?? body.direction ?? body.position ?? ""
  )
    .trim()
    .toLowerCase();

  if (["short", "sell", "put", "bear", "down", "s", "-1"].includes(rawSide)) {
    return "short";
  }
  if (["long", "buy", "call", "bull", "up", "l", "1"].includes(rawSide)) {
    return "long";
  }

  // Check if action itself was "sell" or "short"
  const rawAction = String(body.action ?? "").trim().toLowerCase();
  if (["short", "sell"].includes(rawAction)) {
    return "short";
  }
  if (["long", "buy"].includes(rawAction)) {
    return "long";
  }

  // Check explicit trigger_direction
  if (body.trigger_direction === "above") return "short";
  if (body.trigger_direction === "below") return "long";

  // Infer from entry_price vs stop_loss or take_profit if available
  const ep = Number(body.entry_price ?? body.ep ?? body.entry ?? body.price);
  const sl = Number(body.stop_loss ?? body.sl ?? body.stop_price);
  const tp = Number(body.take_profit ?? body.tp ?? body.target_price);

  if (Number.isFinite(ep) && ep > 0) {
    if (Number.isFinite(sl) && sl > 0 && sl > ep) return "short";
    if (Number.isFinite(tp) && tp > 0 && tp < ep) return "short";
  }

  return "long";
}

/**
 * Map 'long' | 'short' to MOCHEX's internal `trigger_direction` column on `trade_alerts`.
 * In MOCHEX (`sideForTrigger` in `src/lib/types.ts`):
 * - "below" = LONG
 * - "above" = SHORT
 */
export function sideToTriggerDirection(side: BotSide): "below" | "above" {
  return side === "short" ? "above" : "below";
}

/**
 * Fetch the live mark/last price for a symbol from MEXC Futures REST API.
 * Used when `entry_price` (on open) or `exit_price` (on close) is omitted.
 */
export async function fetchLiveMexcPrice(symbol: string): Promise<number | null> {
  const norm = normalizeBotSymbol(symbol);
  if (!norm) return null;
  try {
    const res = await fetch(
      `https://contract.mexc.com/api/v1/contract/ticker?symbol=${encodeURIComponent(norm)}`,
      {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      success?: boolean;
      data?: { lastPrice?: number; fairPrice?: number } | null;
    };
    const price = Number(json?.data?.lastPrice ?? json?.data?.fairPrice);
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

/**
 * Format a concise human-readable summary for bot trade notifications.
 */
export function formatBotNotificationSummary(params: {
  action: BotAction;
  symbol: string;
  side: BotSide;
  entryPrice?: number | null;
  exitPrice?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  marginUsd?: number | null;
  leverage?: number | null;
  pnlUsd?: number | null;
  pnlPct?: number | null;
  notes?: string | null;
}): { title: string; message: string } {
  const sym = cleanSymbol(params.symbol);
  const sideLabel = params.side.toUpperCase();
  const dirArrow = params.side === "long" ? "↗" : "↘";

  if (params.action === "close") {
    const pnlStr =
      params.pnlUsd != null
        ? `${params.pnlUsd >= 0 ? "+" : ""}$${params.pnlUsd.toFixed(2)} (${params.pnlPct != null ? `${(params.pnlPct * 100).toFixed(2)}%` : "—"})`
        : "Closed";
    return {
      title: `🤖 Bot Trade Closed: ${sideLabel} ${sym} (${pnlStr})`,
      message: `Entry: $${params.entryPrice ?? "—"} → Exit: $${params.exitPrice ?? "—"} | PnL: ${pnlStr}${params.notes ? ` | ${params.notes}` : ""}`,
    };
  }

  if (params.action === "update") {
    return {
      title: `🤖 Bot Updated Trade: ${sideLabel} ${sym}`,
      message: `Updated levels — EP: $${params.entryPrice ?? "—"} | SL: $${params.stopLoss ?? "—"} | TP: $${params.takeProfit ?? "—"}${params.notes ? ` | ${params.notes}` : ""}`,
    };
  }

  return {
    title: `🤖 Bot Trade Opened: ${dirArrow} ${sideLabel} ${sym}`,
    message: `EP: $${params.entryPrice ?? "—"} | SL: $${params.stopLoss ?? "—"} | TP: $${params.takeProfit ?? "—"} | Margin: $${params.marginUsd ?? 1} × ${params.leverage ?? 20}x`,
  };
}
