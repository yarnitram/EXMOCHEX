import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/archived-trades
 * Fetch all archived trade alerts for the signed-in user.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("archived_trade_alerts")
    .select("*")
    .eq("user_id", user.id)
    .order("archived_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ archivedAlerts: data ?? [] });
}

/**
 * POST /api/archived-trades
 * Archive (soft-delete) one or more trade alert rows by moving them to archived_trade_alerts.
 * Body: { trade_alert_id?: string, trade_alert_ids?: string[] }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as { trade_alert_id?: string; trade_alert_ids?: string[] };
  const rawIds = Array.isArray(b.trade_alert_ids)
    ? (b.trade_alert_ids as unknown[]).map(String).filter(Boolean)
    : b.trade_alert_id
    ? [String(b.trade_alert_id)]
    : [];

  if (rawIds.length === 0) {
    return NextResponse.json(
      { error: "trade_alert_id or trade_alert_ids is required" },
      { status: 400 }
    );
  }

  // 1. Fetch source trade_alerts rows
  const { data: sources, error: fetchErr } = await supabase
    .from("trade_alerts")
    .select("*")
    .in("id", rawIds)
    .eq("user_id", user.id);

  if (fetchErr || !sources || sources.length === 0) {
    return NextResponse.json({ error: "Trade alert(s) not found" }, { status: 404 });
  }

  // 2. Insert into archived_trade_alerts
  const nowIso = new Date().toISOString();
  const archiveRows = sources.map((source) => ({
    user_id: user.id,
    original_trade_alert_id: source.id,
    watchlist_item_id: source.watchlist_item_id,
    symbol: source.symbol,
    trigger_price: source.trigger_price,
    trigger_direction: source.trigger_direction,
    fired_price: source.fired_price,
    entry_price: source.entry_price,
    stop_loss: source.stop_loss,
    take_profit: source.take_profit,
    order_type: source.order_type,
    notes: source.notes,
    margin_usd: source.margin_usd,
    leverage: source.leverage,
    sl_fired_at: source.sl_fired_at,
    tp_fired_at: source.tp_fired_at,
    fired_at: source.fired_at,
    status_at_archive: source.status || "active",
    closed_reason: source.closed_reason,
    exit_price: source.exit_price,
    closed_at: source.closed_at,
    close_notes: source.close_notes,
    realized_pnl_usd: source.realized_pnl_usd,
    realized_pnl_pct: source.realized_pnl_pct,
    archived_at: nowIso,
  }));

  const { data: inserted, error: insertErr } = await supabase
    .from("archived_trade_alerts")
    .insert(archiveRows)
    .select("*");

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 400 });
  }

  // 3. Delete from trade_alerts
  const foundIds = sources.map((s) => s.id);
  const { error: deleteErr } = await supabase
    .from("trade_alerts")
    .delete()
    .in("id", foundIds)
    .eq("user_id", user.id);

  if (deleteErr) {
    return NextResponse.json({ error: deleteErr.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    archived: inserted && inserted.length === 1 ? inserted[0] : inserted,
    count: inserted?.length ?? 0,
  });
}
