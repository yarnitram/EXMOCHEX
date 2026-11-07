import { NextResponse } from "next/server";
import { createClient as createClientJs } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { cleanSymbol } from "@/lib/format";
import { calculateTradePnl } from "@/lib/trade-calc";
import { createTrade } from "@/lib/trade-ops";
import { sideForTrigger, type TelegramDestination } from "@/lib/types";
import {
  BOT_API_FIELDS_SPEC,
  extractApiKey,
  fetchLiveMexcPrice,
  formatBotNotificationSummary,
  normalizeBotAction,
  normalizeBotSide,
  normalizeBotSymbol,
  sideToTriggerDirection,
  type BotAction,
  type BotSide,
} from "@/lib/bot-trade-api";

export const dynamic = "force-dynamic";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://sup.ymatt.online";
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

function getAdminClient() {
  return createClientJs(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const numOrNull = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const posOrNull = (v: unknown): number | null => {
  const n = numOrNull(v);
  return n != null && n > 0 ? n : null;
};

function parseTagsInput(raw: unknown, defaultTags: string[] = ["Bot Trade"]): string[] {
  if (Array.isArray(raw)) {
    const parsed = raw.map((t) => String(t).trim()).filter(Boolean);
    return parsed.length > 0 ? parsed : defaultTags;
  }
  if (typeof raw === "string" && raw.trim()) {
    const parsed = raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    return parsed.length > 0 ? parsed : defaultTags;
  }
  return defaultTags;
}

async function resolveAccountId(
  adminClient: ReturnType<typeof getAdminClient>,
  userId: string
): Promise<string | null> {
  const { data } = await adminClient
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (data && (data as { id?: string }).id) {
    return (data as { id: string }).id;
  }

  const { data: created } = await adminClient
    .from("accounts")
    .insert({
      user_id: userId,
      name: "Default",
      broker: "Mochbot",
      starting_balance: 0,
      current_balance: 0,
    })
    .select("id")
    .single();

  return created ? (created as { id: string }).id : null;
}

async function resolveAuthenticatedUser(
  request: Request,
  body?: Record<string, unknown> | null
): Promise<{
  userId: string | null;
  userSettings: Record<string, unknown> | null;
  error?: string;
}> {
  const adminClient = getAdminClient();
  const apiKey = extractApiKey(request, body);

  if (apiKey) {
    const { data: settings, error } = await adminClient
      .from("user_settings")
      .select("*")
      .eq("webhook_secret", apiKey)
      .maybeSingle();

    if (error || !settings) {
      return {
        userId: null,
        userSettings: null,
        error: "Unauthorized: Invalid API key / webhook secret.",
      };
    }

    return {
      userId: String(settings.user_id),
      userSettings: settings as Record<string, unknown>,
    };
  }

  // Fallback to authenticated browser session (for in-app testing)
  try {
    const serverSupabase = await createServerClient();
    const {
      data: { user },
    } = await serverSupabase.auth.getUser();
    if (user) {
      const { data: settings } = await adminClient
        .from("user_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      return {
        userId: user.id,
        userSettings: (settings as Record<string, unknown>) || {
          user_id: user.id,
        },
      };
    }
  } catch {
    // ignore session errors
  }

  return {
    userId: null,
    userSettings: null,
    error:
      "Missing API key. Pass header 'X-API-Key: <key>', 'Authorization: Bearer <key>', query '?key=<key>', or body '{ \"api_key\": \"<key>\" }'.",
  };
}

async function dispatchBotNotifications(params: {
  adminClient: ReturnType<typeof getAdminClient>;
  userId: string;
  userSettings: Record<string, unknown> | null;
  action: BotAction;
  symbol: string;
  side: BotSide;
  triggerPrice?: number | null;
  entryPrice?: number | null;
  exitPrice?: number | null;
  stopLoss?: number | null;
  takeProfit?: number | null;
  marginUsd?: number | null;
  leverage?: number | null;
  pnlUsd?: number | null;
  pnlPct?: number | null;
  notes?: string | null;
  link?: string;
}) {
  const { title, message } = formatBotNotificationSummary(params);
  const link =
    params.link ||
    (params.action === "watchlist"
      ? "/watchlist"
      : params.action === "journal"
      ? "/journal"
      : "/trades");

  // 1. In-App Notification
  try {
    await params.adminClient.from("notifications").insert({
      user_id: params.userId,
      type:
        params.action === "close" || params.action === "journal"
          ? "sl_tp_hit"
          : "watchlist_trigger",
      title,
      message,
      link,
      read: false,
    });
  } catch {
    // ignore notification table error
  }

  if (!params.userSettings) return;

  // 2. Discord Webhooks
  const discordUrls: string[] = Array.isArray(
    params.userSettings.discord_webhooks
  )
    ? (params.userSettings.discord_webhooks as string[]).filter(Boolean)
    : typeof params.userSettings.discord_webhook_url === "string" &&
      params.userSettings.discord_webhook_url
    ? [params.userSettings.discord_webhook_url]
    : [];

  if (params.userSettings.notify_discord !== false && discordUrls.length > 0) {
    await Promise.all(
      discordUrls.map(async (dUrl) => {
        try {
          await fetch(dUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username: "MOCHEX Bot Engine",
              content: `🔔 **${title}**\n${message}${params.notes ? `\nNotes: *${params.notes}*` : ""}`,
            }),
            signal: AbortSignal.timeout(6000),
          });
        } catch {
          // ignore discord delivery error
        }
      })
    );
  }

  // 3. Telegram Destinations
  const telegramDests: TelegramDestination[] = Array.isArray(
    params.userSettings.telegram_destinations
  )
    ? (params.userSettings.telegram_destinations as TelegramDestination[])
    : [];

  if (
    params.userSettings.notify_telegram !== false &&
    telegramDests.length > 0
  ) {
    await Promise.all(
      telegramDests.map(async (dest) => {
        if (!dest?.bot_token || !dest?.chat_id) return;
        try {
          const tText = `🔔 <b>${title}</b>\n${message}${params.notes ? `\nNotes: <i>${params.notes}</i>` : ""}`;
          await fetch(
            `https://api.telegram.org/bot${encodeURIComponent(dest.bot_token)}/sendMessage`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: dest.chat_id,
                text: tText,
                parse_mode: "HTML",
              }),
              signal: AbortSignal.timeout(6000),
            }
          );
        } catch {
          // ignore telegram delivery error
        }
      })
    );
  }
}

/**
 * GET /api/trades/webhook
 * Returns API documentation & field specification, plus the user's active trades and watchlist items if authenticated.
 */
export async function GET(request: Request) {
  const auth = await resolveAuthenticatedUser(request, null);

  if (!auth.userId) {
    return NextResponse.json({
      ok: true,
      endpoint: "/api/trades/webhook",
      authenticated: false,
      supported_actions: ["open", "update", "close", "watchlist", "journal"],
      auth_methods: [
        "Header: X-API-Key: <your_key>",
        "Header: Authorization: Bearer <your_key>",
        "Query: ?key=<your_key>",
        "JSON Body: { \"api_key\": \"<your_key>\" }",
      ],
      fields_spec: BOT_API_FIELDS_SPEC,
    });
  }

  const adminClient = getAdminClient();
  const [{ data: activeTrades }, { data: watchlistItems }] = await Promise.all([
    adminClient
      .from("trade_alerts")
      .select(
        "id, symbol, trigger_direction, entry_price, stop_loss, take_profit, margin_usd, leverage, order_type, status, notes, fired_at"
      )
      .eq("user_id", auth.userId)
      .eq("status", "active")
      .order("fired_at", { ascending: false })
      .limit(50),
    adminClient
      .from("watchlist_items")
      .select(
        "id, symbol, trigger_price, trigger_direction, entry_price, stop_loss, take_profit, order_type, notes, added_at"
      )
      .eq("user_id", auth.userId)
      .eq("alert_fired", false)
      .order("added_at", { ascending: false })
      .limit(50),
  ]);

  const formattedTrades = (activeTrades ?? []).map((t) => ({
    trade_id: t.id,
    symbol: t.symbol,
    side: sideForTrigger(
      t.trigger_direction as "above" | "below" | null,
      t as { entry_price?: number | null; stop_loss?: number | null }
    ),
    entry_price: t.entry_price,
    stop_loss: t.stop_loss,
    take_profit: t.take_profit,
    margin_usd: t.margin_usd,
    leverage: t.leverage,
    order_type: t.order_type,
    status: t.status,
    notes: t.notes,
    fired_at: t.fired_at,
  }));

  return NextResponse.json({
    ok: true,
    endpoint: "/api/trades/webhook",
    authenticated: true,
    supported_actions: ["open", "update", "close", "watchlist", "journal"],
    active_count: formattedTrades.length,
    active_trades: formattedTrades,
    watchlist_count: (watchlistItems ?? []).length,
    watchlist_items: watchlistItems ?? [],
    fields_spec: BOT_API_FIELDS_SPEC,
  });
}

/**
 * POST /api/trades/webhook
 * Unified Mochbot / External Bot Trade, Watchlist & Journal Webhook & REST API.
 * Supports actions:
 * - "open" (default): Open an active trade on /trades (monitored 24/7 by background watcher)
 * - "update": Update SL, TP, entry, leverage, margin, or move SL to breakeven on an active trade
 * - "close": Close an active trade, compute realized PnL, and log to the Trade Journal
 * - "watchlist": Add a price-trigger setup to /watchlist (monitored 24/7 by background watcher)
 * - "journal": Directly log a trade (open or closed) into /journal with tags, thesis, review, and fees
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

  const auth = await resolveAuthenticatedUser(request, body);
  if (!auth.userId) {
    return NextResponse.json(
      { error: auth.error || "Unauthorized" },
      { status: 401 }
    );
  }

  const userId = auth.userId;
  const userSettings = auth.userSettings;
  const adminClient = getAdminClient();

  const action = normalizeBotAction(body);
  const shouldNotify =
    body.notify !== false && body.send_notification !== false;

  const rawSymbol =
    body.symbol ?? body.ticker ?? body.pair ?? body.coin ?? "";
  const symbol = rawSymbol ? normalizeBotSymbol(rawSymbol) : "";
  const side = normalizeBotSide(body);
  const triggerDirection = sideToTriggerDirection(side);

  // =========================================================================
  // 1. ACTION: WATCHLIST SETUP (`/watchlist`)
  // =========================================================================
  if (action === "watchlist") {
    if (!symbol) {
      return NextResponse.json(
        { error: "Field 'symbol' is required for watchlist setups." },
        { status: 400 }
      );
    }

    const entryPrice =
      posOrNull(body.entry_price) ??
      posOrNull(body.ep) ??
      posOrNull(body.entry) ??
      posOrNull(body.price);
    const triggerPrice =
      posOrNull(body.trigger_price) ??
      posOrNull(body.trigger) ??
      posOrNull(body.alert_price) ??
      entryPrice ??
      (await fetchLiveMexcPrice(symbol));
    const stopLoss =
      posOrNull(body.stop_loss) ??
      posOrNull(body.sl) ??
      posOrNull(body.stop_price);
    const takeProfit =
      posOrNull(body.take_profit) ??
      posOrNull(body.tp) ??
      posOrNull(body.target_price);
    const orderType =
      body.order_type === "market" || body.order_type === "trigger_limit"
        ? body.order_type
        : "limit";
    const notes = String(
      body.notes ??
        body.thesis ??
        body.message ??
        body.comment ??
        `Bot Watchlist: ${side.toUpperCase()} ${cleanSymbol(symbol)}`
    );

    const nowIso = new Date().toISOString();
    const watchInsert: Record<string, unknown> = {
      user_id: userId,
      symbol,
      trigger_price: triggerPrice,
      trigger_direction:
        body.trigger_direction === "above" || body.trigger_direction === "below"
          ? body.trigger_direction
          : triggerDirection,
      entry_price: entryPrice ?? triggerPrice,
      stop_loss: stopLoss,
      take_profit: takeProfit,
      order_type: orderType,
      notes,
      added_at: nowIso,
      trigger_created_at: triggerPrice != null ? nowIso : null,
    };

    const screenshotUrls = Array.isArray(body.screenshot_urls)
      ? (body.screenshot_urls as unknown[]).map(String).filter(Boolean)
      : body.screenshot_url
      ? [String(body.screenshot_url)]
      : [];
    if (screenshotUrls.length > 0) {
      watchInsert.screenshot_urls = screenshotUrls;
      watchInsert.screenshot_url = screenshotUrls[0] ?? null;
    }

    let { data: watchData, error: watchErr } = await adminClient
      .from("watchlist_items")
      .insert(watchInsert)
      .select("*")
      .single();

    if (
      watchErr &&
      (watchErr.message.includes("screenshot") ||
        watchErr.code === "PGRST204" ||
        watchErr.code === "42703")
    ) {
      delete watchInsert.screenshot_urls;
      delete watchInsert.screenshot_url;
      const retry = await adminClient
        .from("watchlist_items")
        .insert(watchInsert)
        .select("*")
        .single();
      watchData = retry.data;
      watchErr = retry.error;
    }

    if (watchErr || !watchData) {
      return NextResponse.json(
        { error: watchErr?.message || "Failed to insert watchlist setup" },
        { status: 400 }
      );
    }

    if (shouldNotify) {
      await dispatchBotNotifications({
        adminClient,
        userId,
        userSettings,
        action: "watchlist",
        symbol,
        side,
        triggerPrice,
        entryPrice: entryPrice ?? triggerPrice,
        stopLoss,
        takeProfit,
        notes,
        link: "/watchlist",
      });
    }

    return NextResponse.json({
      ok: true,
      action: "watchlist",
      watchlist_id: watchData.id,
      symbol,
      side,
      trigger_price: triggerPrice,
      entry_price: entryPrice ?? triggerPrice,
      stop_loss: stopLoss,
      take_profit: takeProfit,
      item: watchData,
      message: `Added ${side.toUpperCase()} ${symbol} setup (Trigger: $${triggerPrice ?? "—"}) to /watchlist.`,
    });
  }

  // =========================================================================
  // 2. ACTION: DIRECT JOURNAL ENTRY (`/journal`)
  // =========================================================================
  if (action === "journal") {
    if (!symbol) {
      return NextResponse.json(
        { error: "Field 'symbol' is required to log a trade to the Journal." },
        { status: 400 }
      );
    }

    let entryPrice =
      posOrNull(body.entry_price) ??
      posOrNull(body.ep) ??
      posOrNull(body.entry) ??
      posOrNull(body.price);

    if (!entryPrice) {
      entryPrice = await fetchLiveMexcPrice(symbol);
    }
    if (!entryPrice) {
      return NextResponse.json(
        {
          error: `Could not resolve entry_price for '${symbol}'. Please provide a positive 'entry_price' number.`,
        },
        { status: 400 }
      );
    }

    const exitPrice =
      posOrNull(body.exit_price) ??
      posOrNull(body.close_price) ??
      posOrNull(body.exit);
    const stopPrice =
      posOrNull(body.stop_loss) ??
      posOrNull(body.sl) ??
      posOrNull(body.stop_price);
    const leverage = posOrNull(body.leverage) ?? posOrNull(body.lev) ?? 1;
    const marginUsd =
      posOrNull(body.margin_usd) ??
      posOrNull(body.margin) ??
      posOrNull(body.size_usd) ??
      100;
    const explicitSize =
      posOrNull(body.size) ??
      posOrNull(body.quantity) ??
      posOrNull(body.qty) ??
      posOrNull(body.contracts);
    const size = explicitSize ?? (marginUsd * leverage) / entryPrice;
    const fees = numOrNull(body.fees ?? body.fee ?? body.commission) ?? 0;

    const nowIso = new Date().toISOString();
    const entryTime =
      typeof body.entry_time === "string" && body.entry_time.trim()
        ? body.entry_time.trim()
        : nowIso;
    const exitTime =
      exitPrice != null
        ? typeof body.exit_time === "string" && body.exit_time.trim()
          ? body.exit_time.trim()
          : nowIso
        : null;

    const accountId =
      typeof body.account_id === "string" && body.account_id.trim()
        ? body.account_id.trim()
        : await resolveAccountId(adminClient, userId);

    if (!accountId) {
      return NextResponse.json(
        { error: "Could not resolve or create a trading account for Journal." },
        { status: 500 }
      );
    }

    const tags = parseTagsInput(body.tags ?? body.tag ?? body.labels, [
      "Bot Trade",
    ]);

    const preTradeThesis =
      typeof body.pre_trade_thesis === "string"
        ? body.pre_trade_thesis
        : typeof body.thesis === "string"
        ? body.thesis
        : undefined;

    const postTradeReview =
      typeof body.post_trade_review === "string"
        ? body.post_trade_review
        : typeof body.close_notes === "string"
        ? body.close_notes
        : typeof body.notes === "string"
        ? body.notes
        : typeof body.message === "string"
        ? body.message
        : `Logged via Bot API (${side.toUpperCase()} ${cleanSymbol(symbol)})`;

    const rawScore = numOrNull(
      body.discipline_score ?? body.score ?? body.rating
    );
    const disciplineScore =
      rawScore != null
        ? Math.min(5, Math.max(1, Math.round(rawScore)))
        : null;

    const screenshotUrls = Array.isArray(body.screenshot_urls)
      ? (body.screenshot_urls as unknown[]).map(String).filter(Boolean)
      : body.screenshot_url
      ? [String(body.screenshot_url)]
      : undefined;

    const pnl =
      exitPrice != null
        ? calculateTradePnl(
            entryPrice,
            exitPrice,
            triggerDirection,
            marginUsd,
            leverage
          )
        : { realizedPnlUsd: null, realizedPnlPct: null };

    try {
      const { id: journalTradeId, leveragePersisted } = await createTrade(
        adminClient as never,
        {
          account_id: accountId,
          symbol,
          direction: side,
          size,
          entry_price: entryPrice,
          exit_price: exitPrice,
          stop_price: stopPrice,
          fees,
          entry_time: entryTime,
          exit_time: exitTime,
          tags,
          pre_trade_thesis: preTradeThesis,
          post_trade_review: postTradeReview,
          discipline_score: disciplineScore,
          leverage,
          screenshot_url: screenshotUrls?.[0] ?? null,
          screenshot_urls: screenshotUrls,
        },
        userId
      );

      if (shouldNotify) {
        await dispatchBotNotifications({
          adminClient,
          userId,
          userSettings,
          action: "journal",
          symbol,
          side,
          entryPrice,
          exitPrice,
          stopLoss: stopPrice,
          marginUsd,
          leverage,
          pnlUsd: pnl.realizedPnlUsd,
          pnlPct: pnl.realizedPnlPct,
          notes: postTradeReview,
          link: "/journal",
        });
      }

      return NextResponse.json({
        ok: true,
        action: "journal",
        journal_trade_id: journalTradeId,
        account_id: accountId,
        symbol,
        side,
        status: exitPrice != null ? "closed" : "open",
        entry_price: entryPrice,
        exit_price: exitPrice,
        size,
        margin_usd: marginUsd,
        leverage,
        fees,
        tags,
        realized_pnl_usd: pnl.realizedPnlUsd,
        realized_pnl_pct: pnl.realizedPnlPct,
        leverage_persisted: leveragePersisted,
        message: `Logged ${side.toUpperCase()} ${symbol} (${exitPrice != null ? "closed" : "open"}) to /journal.`,
      });
    } catch (err) {
      return NextResponse.json(
        { error: (err as Error).message || "Failed to create journal trade" },
        { status: 400 }
      );
    }
  }

  // =========================================================================
  // 3. ACTION: UPDATE ACTIVE TRADE (SL / TP / Breakeven / Notes / Leverage)
  // =========================================================================
  if (action === "update") {
    const targetId = String(
      body.trade_id ?? body.id ?? body.alert_id ?? ""
    ).trim();

    let query = adminClient
      .from("trade_alerts")
      .select("*")
      .eq("user_id", userId);

    if (targetId) {
      query = query.eq("id", targetId);
    } else if (symbol) {
      query = query
        .eq("symbol", symbol)
        .eq("status", "active")
        .order("fired_at", { ascending: false })
        .limit(1);
    } else {
      return NextResponse.json(
        {
          error:
            "Provide either 'trade_id' or 'symbol' to identify the active trade to update.",
        },
        { status: 400 }
      );
    }

    const { data: matchedRows, error: findErr } = await query;
    const current = Array.isArray(matchedRows) ? matchedRows[0] : null;

    if (findErr || !current) {
      return NextResponse.json(
        {
          error: targetId
            ? `Active trade with trade_id '${targetId}' not found.`
            : `No active trade found for symbol '${symbol}'.`,
        },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};
    const rawActionStr = String(body.action ?? "").trim().toLowerCase();
    const isMoveToBe =
      rawActionStr === "breakeven" ||
      rawActionStr === "move_sl" ||
      body.move_to_be === true ||
      body.breakeven === true;

    if (isMoveToBe && body.stop_loss === undefined && body.sl === undefined) {
      updates.stop_loss = current.entry_price ?? current.fired_price;
      updates.sl_fired_at = null;
    }

    if (
      body.stop_loss !== undefined ||
      body.sl !== undefined ||
      body.stop_price !== undefined
    ) {
      updates.stop_loss = numOrNull(
        body.stop_loss ?? body.sl ?? body.stop_price
      );
      updates.sl_fired_at = null;
    }

    if (
      body.take_profit !== undefined ||
      body.tp !== undefined ||
      body.target_price !== undefined
    ) {
      updates.take_profit = numOrNull(
        body.take_profit ?? body.tp ?? body.target_price
      );
      updates.tp_fired_at = null;
    }

    if (
      body.entry_price !== undefined ||
      body.ep !== undefined ||
      body.entry !== undefined
    ) {
      const nextEp = posOrNull(body.entry_price ?? body.ep ?? body.entry);
      if (nextEp) updates.entry_price = nextEp;
    }

    if (
      body.margin_usd !== undefined ||
      body.margin !== undefined ||
      body.size_usd !== undefined
    ) {
      const nextMargin = posOrNull(
        body.margin_usd ?? body.margin ?? body.size_usd
      );
      if (nextMargin) updates.margin_usd = nextMargin;
    }

    if (body.leverage !== undefined || body.lev !== undefined) {
      const nextLev = posOrNull(body.leverage ?? body.lev);
      if (nextLev) updates.leverage = nextLev;
    }

    if (
      body.notes !== undefined ||
      body.thesis !== undefined ||
      body.message !== undefined ||
      body.comment !== undefined
    ) {
      updates.notes = String(
        body.notes ?? body.thesis ?? body.message ?? body.comment ?? ""
      );
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        {
          error:
            "No update fields provided. Pass stop_loss, take_profit, entry_price, margin_usd, leverage, notes, or breakeven: true.",
        },
        { status: 400 }
      );
    }

    const { data: updated, error: updateErr } = await adminClient
      .from("trade_alerts")
      .update(updates)
      .eq("id", current.id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 });
    }

    const updatedSide = sideForTrigger(
      updated.trigger_direction as "above" | "below" | null,
      updated
    );

    if (shouldNotify) {
      await dispatchBotNotifications({
        adminClient,
        userId,
        userSettings,
        action: "update",
        symbol: updated.symbol,
        side: updatedSide,
        entryPrice: updated.entry_price,
        stopLoss: updated.stop_loss,
        takeProfit: updated.take_profit,
        marginUsd: updated.margin_usd,
        leverage: updated.leverage,
        notes: updated.notes,
      });
    }

    return NextResponse.json({
      ok: true,
      action: "update",
      trade_id: updated.id,
      symbol: updated.symbol,
      side: updatedSide,
      entry_price: updated.entry_price,
      stop_loss: updated.stop_loss,
      take_profit: updated.take_profit,
      margin_usd: updated.margin_usd,
      leverage: updated.leverage,
      alert: updated,
    });
  }

  // =========================================================================
  // 4. ACTION: CLOSE ACTIVE TRADE & LOG TO JOURNAL
  // =========================================================================
  if (action === "close") {
    const targetId = String(
      body.trade_id ?? body.id ?? body.alert_id ?? ""
    ).trim();

    let query = adminClient
      .from("trade_alerts")
      .select("*")
      .eq("user_id", userId);

    if (targetId) {
      query = query.eq("id", targetId);
    } else if (symbol) {
      query = query
        .eq("symbol", symbol)
        .eq("status", "active")
        .order("fired_at", { ascending: false })
        .limit(1);
    } else {
      return NextResponse.json(
        {
          error:
            "Provide either 'trade_id' or 'symbol' to identify the active trade to close.",
        },
        { status: 400 }
      );
    }

    const { data: matchedRows, error: findErr } = await query;
    const current = Array.isArray(matchedRows) ? matchedRows[0] : null;

    if (findErr || !current) {
      return NextResponse.json(
        {
          error: targetId
            ? `Trade with trade_id '${targetId}' not found.`
            : `No active trade found for symbol '${symbol}'.`,
        },
        { status: 404 }
      );
    }

    const rawReason = String(
      body.closed_reason ?? body.reason ?? body.action ?? "manual_close"
    )
      .trim()
      .toLowerCase();
    const closedReason: "tp_hit" | "sl_hit" | "manual_close" =
      rawReason === "tp_hit" || rawReason === "take_profit"
        ? "tp_hit"
        : rawReason === "sl_hit" || rawReason === "stop_loss"
        ? "sl_hit"
        : "manual_close";

    let exitPrice =
      posOrNull(body.exit_price) ??
      posOrNull(body.close_price) ??
      posOrNull(body.exit) ??
      posOrNull(body.price);

    if (!exitPrice) {
      exitPrice = await fetchLiveMexcPrice(current.symbol);
    }
    if (!exitPrice) {
      exitPrice =
        closedReason === "tp_hit" && current.take_profit
          ? Number(current.take_profit)
          : closedReason === "sl_hit" && current.stop_loss
          ? Number(current.stop_loss)
          : Number(current.entry_price ?? current.fired_price ?? 0);
    }

    const effEntry = Number(current.entry_price ?? current.fired_price ?? 0);
    const effMargin =
      posOrNull(body.margin_usd) ?? posOrNull(current.margin_usd) ?? 1;
    const effLeverage =
      posOrNull(body.leverage) ?? posOrNull(current.leverage) ?? 1;
    const effDirection = (current.trigger_direction ?? "below") as
      | "above"
      | "below";

    const pnl = calculateTradePnl(
      effEntry > 0 ? effEntry : null,
      exitPrice > 0 ? exitPrice : null,
      effDirection,
      effMargin,
      effLeverage
    );

    const nowIso = new Date().toISOString();
    const closeNotes = String(
      body.close_notes ??
        body.notes ??
        body.comment ??
        body.message ??
        `Closed by Mochbot (${closedReason})`
    );

    const closeUpdates: Record<string, unknown> = {
      status: "closed",
      closed_reason: closedReason,
      exit_price: exitPrice,
      close_notes: closeNotes,
      realized_pnl_usd: pnl.realizedPnlUsd,
      realized_pnl_pct: pnl.realizedPnlPct,
      closed_at: nowIso,
    };

    const { data: closedAlert, error: closeErr } = await adminClient
      .from("trade_alerts")
      .update(closeUpdates)
      .eq("id", current.id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (closeErr) {
      return NextResponse.json({ error: closeErr.message }, { status: 400 });
    }

    const tradeSide = sideForTrigger(effDirection, current);
    let journalTradeId: string | null = null;

    // Log to Trade Journal (`trades` table)
    if (effEntry > 0 && exitPrice && exitPrice > 0) {
      try {
        const accountId = await resolveAccountId(adminClient, userId);
        if (accountId) {
          const notional = effMargin * effLeverage;
          const size = notional / effEntry;
          const reasonTag =
            closedReason === "tp_hit"
              ? "TP Hit"
              : closedReason === "sl_hit"
              ? "SL Hit"
              : "Bot Trade";
          const tags = parseTagsInput(body.tags ?? body.tag, [
            "Bot Trade",
            reasonTag,
          ]);

          const createdJournal = await createTrade(
            adminClient as never,
            {
              account_id: accountId,
              symbol: current.symbol,
              direction: tradeSide,
              size,
              entry_price: effEntry,
              exit_price: exitPrice,
              stop_price: current.stop_loss ? Number(current.stop_loss) : null,
              fees: numOrNull(body.fees ?? body.fee) ?? 0,
              entry_time: current.fired_at || current.created_at || nowIso,
              exit_time: nowIso,
              tags,
              post_trade_review: [
                `Closed via Bot API (${reasonTag}).`,
                `Entry: ${effEntry} | Exit: ${exitPrice}`,
                `Margin: $${effMargin} | Leverage: ${effLeverage}x`,
                pnl.realizedPnlUsd != null
                  ? `PnL: $${pnl.realizedPnlUsd.toFixed(2)} (${((pnl.realizedPnlPct ?? 0) * 100).toFixed(2)}%)`
                  : "",
                closeNotes ? `Notes: ${closeNotes}` : "",
              ]
                .filter(Boolean)
                .join("\n"),
              leverage: effLeverage,
            },
            userId
          );
          journalTradeId = createdJournal.id;
        }
      } catch (err) {
        console.error("Failed to write bot closed trade to journal:", err);
      }
    }

    if (shouldNotify) {
      await dispatchBotNotifications({
        adminClient,
        userId,
        userSettings,
        action: "close",
        symbol: current.symbol,
        side: tradeSide,
        entryPrice: effEntry,
        exitPrice,
        stopLoss: current.stop_loss,
        takeProfit: current.take_profit,
        marginUsd: effMargin,
        leverage: effLeverage,
        pnlUsd: pnl.realizedPnlUsd,
        pnlPct: pnl.realizedPnlPct,
        notes: closeNotes,
      });
    }

    return NextResponse.json({
      ok: true,
      action: "close",
      trade_id: closedAlert.id,
      journal_trade_id: journalTradeId,
      symbol: closedAlert.symbol,
      side: tradeSide,
      entry_price: effEntry,
      exit_price: exitPrice,
      closed_reason: closedReason,
      realized_pnl_usd: pnl.realizedPnlUsd,
      realized_pnl_pct: pnl.realizedPnlPct,
      alert: closedAlert,
    });
  }

  // =========================================================================
  // 5. ACTION: OPEN NEW TRADE ON /trades (Default)
  // =========================================================================
  if (!symbol) {
    return NextResponse.json(
      {
        error:
          "Field 'symbol' is required to open a trade (e.g. 'BTC_USDT', 'SOL', 'ETHUSDT').",
      },
      { status: 400 }
    );
  }

  let entryPrice =
    posOrNull(body.entry_price) ??
    posOrNull(body.ep) ??
    posOrNull(body.entry) ??
    posOrNull(body.price) ??
    posOrNull(body.fired_price) ??
    posOrNull(body.trigger_price);

  if (!entryPrice) {
    entryPrice = await fetchLiveMexcPrice(symbol);
  }

  if (!entryPrice) {
    return NextResponse.json(
      {
        error: `Could not resolve entry_price for '${symbol}'. Please provide a positive 'entry_price' number in your JSON body.`,
      },
      { status: 400 }
    );
  }

  const stopLoss =
    numOrNull(body.stop_loss) ??
    numOrNull(body.sl) ??
    numOrNull(body.stop_price);
  const takeProfit =
    numOrNull(body.take_profit) ??
    numOrNull(body.tp) ??
    numOrNull(body.target_price);
  const triggerPrice =
    numOrNull(body.trigger_price) ?? numOrNull(body.trigger) ?? entryPrice;
  const marginUsd =
    posOrNull(body.margin_usd) ??
    posOrNull(body.margin) ??
    posOrNull(body.size_usd) ??
    1;
  const leverage = posOrNull(body.leverage) ?? posOrNull(body.lev) ?? 20;
  const orderType =
    body.order_type === "limit" ||
    body.order_type === "trigger_limit" ||
    body.order_type === "market"
      ? body.order_type
      : "market";

  const notes = String(
    body.notes ??
      body.thesis ??
      body.message ??
      body.comment ??
      `Mochbot ${side.toUpperCase()} ${cleanSymbol(symbol)}`
  );

  const nowIso = new Date().toISOString();

  const insertData: Record<string, unknown> = {
    user_id: userId,
    symbol,
    trigger_direction: triggerDirection,
    trigger_price: triggerPrice,
    fired_price: posOrNull(body.fired_price) ?? entryPrice,
    entry_price: entryPrice,
    stop_loss: stopLoss,
    take_profit: takeProfit,
    margin_usd: marginUsd,
    leverage,
    order_type: orderType,
    notes,
    status: "active",
    fired_at: nowIso,
  };

  const screenshotUrls = Array.isArray(body.screenshot_urls)
    ? (body.screenshot_urls as unknown[]).map(String).filter(Boolean)
    : body.screenshot_url
    ? [String(body.screenshot_url)]
    : [];

  if (screenshotUrls.length > 0) {
    insertData.screenshot_urls = screenshotUrls;
    insertData.screenshot_url = screenshotUrls[0] ?? null;
  }

  let { data: createdAlert, error: insertErr } = await adminClient
    .from("trade_alerts")
    .insert(insertData)
    .select("*")
    .single();

  if (
    insertErr &&
    (insertErr.message.includes("screenshot") ||
      insertErr.code === "PGRST204" ||
      insertErr.code === "42703")
  ) {
    delete insertData.screenshot_urls;
    delete insertData.screenshot_url;
    const retry = await adminClient
      .from("trade_alerts")
      .insert(insertData)
      .select("*")
      .single();
    createdAlert = retry.data;
    insertErr = retry.error;
  }

  if (insertErr || !createdAlert) {
    return NextResponse.json(
      { error: insertErr?.message || "Failed to insert bot trade" },
      { status: 400 }
    );
  }

  if (shouldNotify) {
    await dispatchBotNotifications({
      adminClient,
      userId,
      userSettings,
      action: "open",
      symbol,
      side,
      entryPrice,
      stopLoss,
      takeProfit,
      marginUsd,
      leverage,
      notes,
    });
  }

  return NextResponse.json({
    ok: true,
    action: "open",
    trade_id: createdAlert.id,
    symbol,
    side,
    entry_price: entryPrice,
    stop_loss: stopLoss,
    take_profit: takeProfit,
    margin_usd: marginUsd,
    leverage,
    order_type: orderType,
    status: "active",
    alert: createdAlert,
    message: `Opened ${side.toUpperCase()} ${symbol} at $${entryPrice} on /trades.`,
  });
}
