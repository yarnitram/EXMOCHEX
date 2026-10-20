#!/usr/bin/env node
/**
 * EXMOCHEX — Alert Watcher (Always-On Background Engine)
 * ======================================================
 * Real-time event-driven engine combining MEXC Futures WebSocket streaming
 * (sub-50ms tick execution) with resilient REST polling fallback.
 *
 * Monitors active watchlist price triggers and open trade SL/TP targets,
 * atomically claims hits, and dispatches instant multi-channel alerts
 * across Telegram bots, Discord webhooks, in-app notifications, and desktop toasts.
 *
 * Reads Supabase config from `.env.local` or process.env.
 * Run:  node scripts/alert-watcher.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ------------------------------------------------------------------ Config
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const intervalIdx = args.indexOf("--interval");
const POLL_MS = (Number(args[intervalIdx + 1]) || 2) * 1000;

// Load .env.local if present, fallback to process.env
const env = loadDotEnv(path.join(ROOT, ".env.local"));
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const FALLBACK_DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL || env.DISCORD_WEBHOOK_URL;
const FALLBACK_TELEGRAM_BOT = process.env.TELEGRAM_BOT_TOKEN || env.TELEGRAM_BOT_TOKEN;
const FALLBACK_TELEGRAM_CHAT = process.env.TELEGRAM_CHAT_ID || env.TELEGRAM_CHAT_ID;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const MEXC_REST_TICKER = "https://contract.mexc.com/api/v1/contract/ticker";
const MEXC_WS_URL = "wss://contract.mexc.com/edge";

// ------------------------------------------------------------------ In-Memory State
let inMemoryWatchlist = [];
let inMemoryTrades = [];
let inMemorySettings = {};
let subscribedSymbols = new Set();
let ws = null;
let wsConnected = false;
let pingTimer = null;
let lastWsMessageTime = 0;

// ------------------------------------------------------------------ Helpers
function loadDotEnv(file) {
  const out = {};
  try {
    if (!existsSync(file)) return out;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch {}
  return out;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function stamp() {
  return new Date().toLocaleTimeString();
}

async function supabase(pathname, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}${pathname}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase ${pathname} → ${res.status}: ${text}`);
  }
  return res.json();
}

// ------------------------------------------------------------------ Notification Sinks
function fireDiscord(webhookUrl, content) {
  return fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "EXMOCHEX", content }),
    signal: AbortSignal.timeout(8000),
  }).catch((err) => console.error("Discord error:", err.message));
}

function fireTelegram(botToken, chatId, htmlText) {
  const url = `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`;
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: htmlText,
      parse_mode: "HTML",
      disable_web_page_preview: false,
    }),
    signal: AbortSignal.timeout(8000),
  }).catch((err) => console.error("Telegram error:", err.message));
}

function desktopNotify(title, body) {
  if (process.platform !== "win32") return Promise.resolve();
  const ps = [
    "Add-Type -AssemblyName System.Windows.Forms;",
    "$n=New-Object System.Windows.Forms.NotifyIcon;",
    "$n.Icon=[System.Drawing.SystemIcons]::Information;",
    `$n.BalloonTipTitle=[char]34+${JSON.stringify(title)}+[char]34;`,
    `$n.BalloonTipText=[char]34+${JSON.stringify(body)}+[char]34;`,
    "$n.Visible=$true;",
    "$n.ShowBalloonTip(8000);",
    "Start-Sleep -Milliseconds 200;",
    "$n.Dispose();",
  ].join(" ");
  return new Promise((resolve) => {
    const child = spawn("powershell", ["-NoProfile", "-Command", ps], {
      windowsHide: true,
    });
    child.on("close", resolve);
    child.on("error", resolve);
  });
}

// ------------------------------------------------------------------ State Sync from Supabase
async function syncDatabaseState() {
  try {
    const [watchlist, trades, settingsRows] = await Promise.all([
      supabase(
        "/rest/v1/watchlist_items?select=id,user_id,symbol,trigger_price,trigger_direction,entry_price,stop_loss,take_profit,order_type,notes,alert_fired,screenshot_url,screenshot_urls&alert_fired=eq.false"
      ),
      supabase(
        "/rest/v1/trade_alerts?select=id,user_id,symbol,trigger_direction,entry_price,stop_loss,take_profit,margin_usd,leverage,notes,sl_fired_at,tp_fired_at&or=(sl_fired_at.is.null,tp_fired_at.is.null)"
      ),
      supabase(
        "/rest/v1/user_settings?select=user_id,discord_webhook_url,discord_webhooks,notify_discord,telegram_destinations,notify_telegram,notify_desktop"
      ),
    ]);

    inMemoryWatchlist = Array.isArray(watchlist) ? watchlist.filter((i) => i.trigger_price != null) : [];
    inMemoryTrades = Array.isArray(trades) ? trades : [];

    const map = {};
    if (Array.isArray(settingsRows)) {
      for (const r of settingsRows) map[r.user_id] = r;
    }
    inMemorySettings = map;

    // Update WebSocket symbol subscriptions
    const currentSymbols = new Set();
    for (const item of inMemoryWatchlist) currentSymbols.add(item.symbol.toUpperCase());
    for (const trade of inMemoryTrades) currentSymbols.add(trade.symbol.toUpperCase());

    if (wsConnected && ws && ws.readyState === WebSocket.OPEN) {
      for (const sym of currentSymbols) {
        if (!subscribedSymbols.has(sym)) {
          subscribedSymbols.add(sym);
          ws.send(JSON.stringify({ method: "sub.ticker", param: { symbol: sym } }));
        }
      }
    }
  } catch (err) {
    console.error(`[${stamp()}] DB Sync error:`, err.message);
  }
}

// ------------------------------------------------------------------ Real-Time Trigger Evaluation
async function handlePriceTick(symbol, price) {
  if (!price || price <= 0) return;

  // 1. Check Watchlist Triggers
  const activeForSymbol = inMemoryWatchlist.filter((i) => i.symbol.toUpperCase() === symbol.toUpperCase());
  for (const item of activeForSymbol) {
    const trigger = Number(item.trigger_price);
    const hit =
      item.trigger_direction === "below"
        ? price <= trigger
        : item.trigger_direction === "above"
        ? price >= trigger
        : false;

    if (!hit) continue;

    // Remove from in-memory watchlist immediately so duplicate ticks never re-fire
    inMemoryWatchlist = inMemoryWatchlist.filter((x) => x.id !== item.id);

    // Atomically claim in Supabase
    let claimed = [];
    try {
      claimed = await supabase(
        `/rest/v1/watchlist_items?id=eq.${item.id}&alert_fired=eq.false`,
        {
          method: "PATCH",
          body: JSON.stringify({
            alert_fired: true,
            alert_fired_at: new Date().toISOString(),
          }),
          headers: { Prefer: "return=representation" },
        }
      );
    } catch (e) {
      console.error("Claim error:", e.message);
    }
    if (!Array.isArray(claimed) || claimed.length === 0) continue;

    console.log(
      `[${stamp()}] 🚀 TRIGGER FIRED: ${item.symbol} | Mark: $${price} | Trigger: $${trigger}`
    );

    const isTriggerLimit = item.order_type === "trigger_limit";
    const isLong =
      item.entry_price != null && item.stop_loss != null
        ? Number(item.entry_price) >= Number(item.stop_loss)
        : item.trigger_direction === "below";

    if (isTriggerLimit && item.entry_price != null) {
      const epDirection = isLong ? "below" : "above";
      try {
        await supabase("/rest/v1/watchlist_items", {
          method: "POST",
          body: JSON.stringify({
            user_id: item.user_id,
            symbol: item.symbol,
            trigger_price: item.entry_price,
            trigger_direction: epDirection,
            entry_price: item.entry_price,
            stop_loss: item.stop_loss,
            take_profit: item.take_profit,
            order_type: "limit",
            notes: item.notes,
            screenshot_urls: item.screenshot_urls || (item.screenshot_url ? [item.screenshot_url] : []),
            screenshot_url: item.screenshot_url ?? null,
          }),
          headers: { Prefer: "return=minimal" },
        });
      } catch (e) {
        console.error("TL spawn error:", e.message);
      }
    } else {
      try {
        await supabase("/rest/v1/trade_alerts", {
          method: "POST",
          body: JSON.stringify({
            user_id: item.user_id,
            symbol: item.symbol,
            trigger_price: item.trigger_price,
            trigger_direction: item.trigger_direction ?? null,
            fired_price: price,
            entry_price: item.entry_price ?? null,
            stop_loss: item.stop_loss ?? null,
            take_profit: item.take_profit ?? null,
            order_type: item.order_type ?? null,
            notes: item.notes ?? null,
            watchlist_item_id: item.id,
            fired_at: new Date().toISOString(),
            screenshot_urls: item.screenshot_urls || (item.screenshot_url ? [item.screenshot_url] : []),
            screenshot_url: item.screenshot_url ?? null,
          }),
          headers: { Prefer: "return=minimal" },
        });
      } catch (e) {
        console.error("Trade-alert insert error:", e.message);
      }
    }

    // Move to triggered archive and remove from active
    try {
      await supabase("/rest/v1/triggered_watchlist_items", {
        method: "POST",
        body: JSON.stringify({
          user_id: item.user_id,
          source_item_id: item.id,
          symbol: item.symbol,
          trigger_price: item.trigger_price,
          trigger_direction: item.trigger_direction ?? null,
          fired_price: price,
          entry_price: item.entry_price ?? null,
          stop_loss: item.stop_loss ?? null,
          take_profit: item.take_profit ?? null,
          order_type: item.order_type ?? null,
          notes: item.notes ?? null,
          fired_at: new Date().toISOString(),
          screenshot_urls: item.screenshot_urls || (item.screenshot_url ? [item.screenshot_url] : []),
          screenshot_url: item.screenshot_url ?? null,
        }),
        headers: { Prefer: "return=minimal" },
      });
      await supabase(`/rest/v1/watchlist_items?id=eq.${item.id}`, { method: "DELETE" });
    } catch {}

    // In-app notification
    const titleText = isTriggerLimit
      ? `${item.symbol} Trigger Limit Hit — Limit armed at $${item.entry_price}`
      : `${item.symbol} Alert Fired at $${price} (Trigger: $${trigger})`;
    const plan = [];
    if (item.entry_price != null) plan.push(`Entry: $${item.entry_price}`);
    if (item.stop_loss != null) plan.push(`Stop: $${item.stop_loss}`);
    if (item.take_profit != null) plan.push(`Target: $${item.take_profit}`);
    const planText = plan.length ? `\nPlan (${isLong ? "LONG ↗" : "SHORT ↘"}): ${plan.join(" · ")}` : "";

    try {
      await supabase("/rest/v1/notifications", {
        method: "POST",
        body: JSON.stringify({
          user_id: item.user_id,
          type: "watchlist_trigger",
          title: titleText,
          message: `Price $${price} crossed trigger $${trigger}.${planText}`,
          link: "/trades",
          read: false,
        }),
        headers: { Prefer: "return=minimal" },
      });
    } catch {}

    const settings = inMemorySettings[item.user_id];

    // Discord fan-out
    if (settings?.notify_discord !== false) {
      let discordWebhooks = Array.isArray(settings?.discord_webhooks) && settings.discord_webhooks.length > 0
        ? settings.discord_webhooks
        : settings?.discord_webhook_url
        ? [settings.discord_webhook_url]
        : [];
      if (discordWebhooks.length === 0 && FALLBACK_DISCORD_WEBHOOK) {
        discordWebhooks = [FALLBACK_DISCORD_WEBHOOK];
      }
      for (const webhook of discordWebhooks) {
        fireDiscord(webhook, `🔔 **${titleText}**\n${planText}`);
      }
    }

    // Telegram fan-out
    if (settings?.notify_telegram !== false) {
      let tgDests = Array.isArray(settings?.telegram_destinations) ? [...settings.telegram_destinations] : [];
      if (tgDests.length === 0 && FALLBACK_TELEGRAM_BOT && FALLBACK_TELEGRAM_CHAT) {
        tgDests = [{ bot_token: FALLBACK_TELEGRAM_BOT, chat_id: FALLBACK_TELEGRAM_CHAT }];
      }
      const tgMsg = `🔔 <b>${escapeHtml(titleText)}</b>\n<code>${escapeHtml(planText)}</code>`;
      for (const dest of tgDests) {
        if (dest && dest.bot_token && dest.chat_id) {
          fireTelegram(dest.bot_token, dest.chat_id, tgMsg);
        }
      }
    }

    // Desktop
    if (settings?.notify_desktop !== false) {
      desktopNotify(item.symbol, `Mark $${price} hit trigger $${trigger}. ${plan.join(" ")}`);
    }
  }

  // 2. Check Open Trade SL / TP Hits
  const activeTradesForSymbol = inMemoryTrades.filter((r) => r.symbol.toUpperCase() === symbol.toUpperCase());
  for (const row of activeTradesForSymbol) {
    for (const level of hitLevels(row, price)) {
      const column = level === "sl" ? "sl_fired_at" : "tp_fired_at";
      const levelPrice = level === "sl" ? row.stop_loss : row.take_profit;

      // Update in-memory trade to prevent double-fire
      row[column] = new Date().toISOString();

      let claimed = [];
      try {
        claimed = await supabase(
          `/rest/v1/trade_alerts?id=eq.${row.id}&${column}=is.null`,
          {
            method: "PATCH",
            body: JSON.stringify({ [column]: new Date().toISOString() }),
            headers: { Prefer: "return=representation" },
          }
        );
      } catch {}
      if (!Array.isArray(claimed) || claimed.length === 0) continue;

      const label = level === "sl" ? "🛑 Stop-Loss" : "🎯 Take-Profit";
      console.log(
        `[${stamp()}] ${label} HIT: ${row.symbol} | Mark: $${price} | Level: $${levelPrice}`
      );

      const title = `${row.symbol} ${label} Hit!`;
      const msg = `Price $${price} reached your ${level.toUpperCase()} target of $${levelPrice}.`;

      // In-app notification
      try {
        await supabase("/rest/v1/notifications", {
          method: "POST",
          body: JSON.stringify({
            user_id: row.user_id,
            type: "sl_tp_hit",
            title,
            message: msg,
            link: "/trades",
            read: false,
          }),
          headers: { Prefer: "return=minimal" },
        });
      } catch {}

      const settings = inMemorySettings[row.user_id];

      // Discord
      if (settings?.notify_discord !== false) {
        let discordWebhooks = Array.isArray(settings?.discord_webhooks) && settings.discord_webhooks.length > 0
          ? settings.discord_webhooks
          : settings?.discord_webhook_url
          ? [settings.discord_webhook_url]
          : [];
        if (discordWebhooks.length === 0 && FALLBACK_DISCORD_WEBHOOK) {
          discordWebhooks = [FALLBACK_DISCORD_WEBHOOK];
        }
        for (const webhook of discordWebhooks) {
          fireDiscord(webhook, `🔔 **${title}**\n${msg}`);
        }
      }

      // Telegram
      if (settings?.notify_telegram !== false) {
        let tgDests = Array.isArray(settings?.telegram_destinations) ? [...settings.telegram_destinations] : [];
        if (tgDests.length === 0 && FALLBACK_TELEGRAM_BOT && FALLBACK_TELEGRAM_CHAT) {
          tgDests = [{ bot_token: FALLBACK_TELEGRAM_BOT, chat_id: FALLBACK_TELEGRAM_CHAT }];
        }
        const tgMsg = `🔔 <b>${escapeHtml(title)}</b>\n${escapeHtml(msg)}`;
        for (const dest of tgDests) {
          if (dest && dest.bot_token && dest.chat_id) {
            fireTelegram(dest.bot_token, dest.chat_id, tgMsg);
          }
        }
      }

      // Desktop
      if (settings?.notify_desktop !== false) {
        desktopNotify(title, msg);
      }
    }
  }
}

function hitLevels(row, price) {
  if (!Number.isFinite(price) || price <= 0) return [];
  const isLong = row.trigger_direction !== "above";
  const out = [];

  if (row.stop_loss != null && row.sl_fired_at == null) {
    const hit = isLong ? price <= row.stop_loss : price >= row.stop_loss;
    if (hit) out.push("sl");
  }
  if (row.take_profit != null && row.tp_fired_at == null) {
    const hit = isLong ? price >= row.take_profit : price <= row.take_profit;
    if (hit) out.push("tp");
  }

  if (out.length === 2) {
    const slDist = Math.abs(price - row.stop_loss);
    const tpDist = Math.abs(price - row.take_profit);
    return slDist <= tpDist ? ["sl"] : ["tp"];
  }
  return out;
}

// ------------------------------------------------------------------ Native WebSocket Stream
function connectMexcWs() {
  if (typeof WebSocket === "undefined") {
    console.log(`[${stamp()}] Native WebSocket not available in this Node runtime, using REST mode.`);
    return;
  }

  try {
    ws = new WebSocket(MEXC_WS_URL);

    ws.onopen = () => {
      wsConnected = true;
      console.log(`[${stamp()}] ⚡ MEXC WebSocket streaming connected (sub-50ms tick execution active).`);

      // Subscribe to all tracked symbols
      for (const sym of subscribedSymbols) {
        ws.send(JSON.stringify({ method: "sub.ticker", param: { symbol: sym } }));
      }

      // 20s heartbeat keep-alive
      clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ method: "ping" }));
        }
      }, 20_000);
    };

    ws.onmessage = (event) => {
      lastWsMessageTime = Date.now();
      try {
        const raw = JSON.parse(event.data);
        if (raw.channel === "push.ticker" && raw.data) {
          const sym = raw.symbol || raw.data.symbol;
          const px = Number(raw.data.lastPrice);
          if (sym && px > 0) {
            handlePriceTick(sym, px);
          }
        }
      } catch {}
    };

    ws.onerror = () => {
      wsConnected = false;
    };

    ws.onclose = () => {
      wsConnected = false;
      clearInterval(pingTimer);
      console.log(`[${stamp()}] WebSocket closed, reconnecting in 3s (REST fallback active)...`);
      setTimeout(connectMexcWs, 3000);
    };
  } catch (err) {
    wsConnected = false;
    setTimeout(connectMexcWs, 5000);
  }
}

// ------------------------------------------------------------------ REST Safety & Polling Loop
async function restFallbackCheck() {
  try {
    const res = await fetch(MEXC_REST_TICKER, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return;
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) return;

    for (const t of json.data) {
      if (t.lastPrice > 0 && subscribedSymbols.has(t.symbol.toUpperCase())) {
        await handlePriceTick(t.symbol, t.lastPrice);
      }
    }
  } catch {}
}

async function start() {
  console.log(`🚀 EXMOCHEX background alert watcher starting...`);

  // 1. Initial Database Sync
  await syncDatabaseState();

  // 2. Connect to MEXC WebSocket Stream
  connectMexcWs();

  // 3. Periodic Background Sync & REST Heartbeat
  let cycleCount = 0;
  setInterval(async () => {
    cycleCount++;

    // Re-sync database every 30 seconds
    if (cycleCount % 15 === 0) {
      await syncDatabaseState();
    }

    // If WebSocket is disconnected or stale, run REST fallback check
    const isWsStale = Date.now() - lastWsMessageTime > 30_000;
    if (!wsConnected || isWsStale) {
      await restFallbackCheck();
    }
  }, POLL_MS);
}

start();
