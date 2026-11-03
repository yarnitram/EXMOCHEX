import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TradesClient } from "@/components/trades/trades-client";
import type { TradeAlert } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Server component to fetch fired trade alerts and pass to the client. */
export default async function TradesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("trade_alerts")
    .select("*")
    .eq("user_id", user.id)
    .order("fired_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch trade alerts:", error);
  }

  // Read the user's preferred refresh interval (seconds) and webhook_secret so
  // the client can poll for newly fired alerts and expose Bot API credentials.
  let refreshIntervalSec = 10;
  let webhookSecret = "";
  const { data: settings } = await supabase
    .from("user_settings")
    .select("refresh_interval_sec, webhook_secret")
    .eq("user_id", user.id)
    .maybeSingle();
  const s = settings as {
    refresh_interval_sec?: number | null;
    webhook_secret?: string | null;
  } | null;
  const n = Number(s?.refresh_interval_sec ?? 10);
  if (Number.isFinite(n) && n >= 3) refreshIntervalSec = n;

  if (s?.webhook_secret) {
    webhookSecret = s.webhook_secret;
  } else {
    webhookSecret = `tv_sec_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`;
    await supabase
      .from("user_settings")
      .upsert(
        { user_id: user.id, webhook_secret: webhookSecret },
        { onConflict: "user_id" }
      );
  }

  return (
    <TradesClient
      initialAlerts={(data ?? []) as TradeAlert[]}
      refreshIntervalSec={refreshIntervalSec}
      webhookSecret={webhookSecret}
    />
  );
}