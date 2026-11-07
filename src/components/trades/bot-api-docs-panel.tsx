"use client";

import { useState, useMemo } from "react";
import { BOT_API_FIELDS_SPEC, type BotAction, type BotSide } from "@/lib/bot-trade-api";

interface BotApiDocsPanelProps {
  initialSecret: string;
  onSecretChange?: (newSecret: string) => void;
  onTradeExecuted?: () => void;
  compact?: boolean;
}

type CodeTab = "json" | "python" | "node" | "curl";

export function BotApiDocsPanel({
  initialSecret,
  onSecretChange,
  onTradeExecuted,
  compact = false,
}: BotApiDocsPanelProps) {
  const [apiKey, setApiKey] = useState(initialSecret || "");
  const [showKey, setShowKey] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  // Interactive Builder State
  const [action, setAction] = useState<BotAction>("open");
  const [symbol, setSymbol] = useState("SOL_USDT");
  const [side, setSide] = useState<BotSide>("long");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [triggerPrice, setTriggerPrice] = useState("184.00");
  const [entryPrice, setEntryPrice] = useState("185.50");
  const [stopLoss, setStopLoss] = useState("178.00");
  const [takeProfit, setTakeProfit] = useState("202.00");
  const [marginUsd, setMarginUsd] = useState("100");
  const [leverage, setLeverage] = useState("20");
  const [exitPrice, setExitPrice] = useState("198.50");
  const [closedReason, setClosedReason] = useState<"tp_hit" | "sl_hit" | "manual_close">("tp_hit");
  const [tradeId, setTradeId] = useState("");
  const [moveToBe, setMoveToBe] = useState(false);
  const [notes, setNotes] = useState("Mochbot Momentum Signal");
  const [tagsInput, setTagsInput] = useState("Mochbot, Momentum");
  const [feesInput, setFeesInput] = useState("0.80");
  const [disciplineScore, setDisciplineScore] = useState("5");
  const [notify, setNotify] = useState(true);

  const [codeTab, setCodeTab] = useState<CodeTab>("json");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
    raw?: unknown;
  } | null>(null);

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://mochex.app";
  const endpointUrl = `${origin}/api/trades/webhook`;
  const endpointWithKey = `${endpointUrl}?key=${apiKey}`;

  function copyText(key: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedItem(key);
    setTimeout(() => setCopiedItem(null), 2000);
  }

  async function handleRegenerateKey() {
    if (
      !window.confirm(
        "Regenerate your API Key? Existing Mochbot scripts or TradingView webhooks using the old key will need to be updated."
      )
    ) {
      return;
    }
    setRegenerating(true);
    try {
      const res = await fetch("/api/settings/webhook-secret", { method: "POST" });
      if (!res.ok) throw new Error("Failed to regenerate API key");
      const data = await res.json();
      if (data.webhook_secret) {
        setApiKey(data.webhook_secret);
        onSecretChange?.(data.webhook_secret);
      }
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setRegenerating(false);
    }
  }

  const payloadObject = useMemo(() => {
    if (action === "open") {
      const obj: Record<string, unknown> = {
        action: "open",
        symbol: symbol.trim() || "SOL_USDT",
        side,
        order_type: orderType,
      };
      if (entryPrice.trim() !== "") {
        const ep = Number(entryPrice);
        obj.entry_price = Number.isFinite(ep) ? ep : entryPrice;
      }
      if (stopLoss.trim() !== "") {
        const sl = Number(stopLoss);
        obj.stop_loss = Number.isFinite(sl) ? sl : stopLoss;
      }
      if (takeProfit.trim() !== "") {
        const tp = Number(takeProfit);
        obj.take_profit = Number.isFinite(tp) ? tp : takeProfit;
      }
      obj.margin_usd = Number(marginUsd) || 100;
      obj.leverage = Number(leverage) || 20;
      if (notes.trim()) obj.notes = notes.trim();
      if (!notify) obj.notify = false;
      return obj;
    }

    if (action === "update") {
      const obj: Record<string, unknown> = {
        action: "update",
      };
      if (tradeId.trim()) {
        obj.trade_id = tradeId.trim();
      } else {
        obj.symbol = symbol.trim() || "SOL_USDT";
      }
      if (moveToBe) {
        obj.breakeven = true;
      } else {
        if (stopLoss.trim() !== "") obj.stop_loss = Number(stopLoss) || stopLoss;
      }
      if (takeProfit.trim() !== "") {
        obj.take_profit = Number(takeProfit) || takeProfit;
      }
      if (notes.trim()) obj.notes = notes.trim();
      if (!notify) obj.notify = false;
      return obj;
    }

    if (action === "close") {
      const obj: Record<string, unknown> = {
        action: "close",
      };
      if (tradeId.trim()) {
        obj.trade_id = tradeId.trim();
      } else {
        obj.symbol = symbol.trim() || "SOL_USDT";
      }
      if (exitPrice.trim() !== "") {
        obj.exit_price = Number(exitPrice) || exitPrice;
      }
      obj.closed_reason = closedReason;
      if (notes.trim()) obj.close_notes = notes.trim();
      if (!notify) obj.notify = false;
      return obj;
    }

    if (action === "journal") {
      const parsedTags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const obj: Record<string, unknown> = {
        action: "journal",
        symbol: symbol.trim() || "SOL_USDT",
        side,
        entry_price: Number(entryPrice) || 185.5,
      };
      if (exitPrice.trim() !== "") {
        obj.exit_price = Number(exitPrice) || exitPrice;
      }
      if (stopLoss.trim() !== "") {
        obj.stop_loss = Number(stopLoss) || stopLoss;
      }
      obj.margin_usd = Number(marginUsd) || 100;
      obj.leverage = Number(leverage) || 20;
      if (feesInput.trim() !== "") {
        obj.fees = Number(feesInput) || 0;
      }
      if (parsedTags.length > 0) {
        obj.tags = parsedTags;
      }
      if (disciplineScore.trim() !== "") {
        obj.discipline_score = Number(disciplineScore) || 5;
      }
      if (notes.trim()) {
        obj.post_trade_review = notes.trim();
      }
      if (!notify) obj.notify = false;
      return obj;
    }

    // watchlist
    const obj: Record<string, unknown> = {
      action: "watchlist",
      symbol: symbol.trim() || "SOL_USDT",
      side,
      order_type: orderType === "market" ? "limit" : orderType,
      trigger_price: Number(triggerPrice) || Number(entryPrice) || 184.0,
      entry_price: Number(entryPrice) || 185.5,
      stop_loss: Number(stopLoss) || 178.0,
      take_profit: Number(takeProfit) || 202.0,
      notes: notes.trim() || "Watchlist Setup",
    };
    if (!notify) obj.notify = false;
    return obj;
  }, [
    action,
    symbol,
    side,
    orderType,
    triggerPrice,
    entryPrice,
    stopLoss,
    takeProfit,
    marginUsd,
    leverage,
    exitPrice,
    closedReason,
    tradeId,
    moveToBe,
    notes,
    tagsInput,
    feesInput,
    disciplineScore,
    notify,
  ]);

  const jsonSnippet = useMemo(
    () => JSON.stringify(payloadObject, null, 2),
    [payloadObject]
  );

  const pythonSnippet = useMemo(() => {
    return `import requests

MOCHEX_URL = "${endpointUrl}"
MOCHEX_API_KEY = "${apiKey || "YOUR_API_KEY"}"

payload = ${JSON.stringify(payloadObject, null, 4)
      .replace(/\btrue\b/g, "True")
      .replace(/\bfalse\b/g, "False")
      .replace(/\bnull\b/g, "None")}

res = requests.post(
    MOCHEX_URL,
    headers={
        "Content-Type": "application/json",
        "X-API-Key": MOCHEX_API_KEY,
    },
    json=payload,
    timeout=10,
)
data = res.json()
print("MOCHEX Response:", data)`;
  }, [endpointUrl, apiKey, payloadObject]);

  const nodeSnippet = useMemo(() => {
    return `const response = await fetch("${endpointUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "${apiKey || "YOUR_API_KEY"}",
  },
  body: JSON.stringify(${JSON.stringify(payloadObject, null, 2)}),
});

const result = await response.json();
console.log("MOCHEX Result:", result);`;
  }, [endpointUrl, apiKey, payloadObject]);

  const curlSnippet = useMemo(() => {
    return `curl -X POST "${endpointUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${apiKey || "YOUR_API_KEY"}" \\
  -d '${JSON.stringify(payloadObject)}'`;
  }, [endpointUrl, apiKey, payloadObject]);

  const activeSnippet =
    codeTab === "python"
      ? pythonSnippet
      : codeTab === "node"
      ? nodeSnippet
      : codeTab === "curl"
      ? curlSnippet
      : jsonSnippet;

  async function handleRunLiveTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(endpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "X-API-Key": apiKey } : {}),
        },
        body: JSON.stringify(payloadObject),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      if (data.trade_id && action === "open") {
        setTradeId(String(data.trade_id));
      }
      setTestResult({
        ok: true,
        message:
          data.message ||
          `✓ Action '${data.action}' succeeded for ${data.symbol || "item"} (ID: ${
            data.trade_id || data.watchlist_id || data.journal_trade_id || "ok"
          })`,
        raw: data,
      });
      onTradeExecuted?.();
    } catch (err) {
      setTestResult({
        ok: false,
        message: `✕ ${(err as Error).message}`,
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ── 1. API Key & Webhook Endpoint Card ── */}
      <div className="rounded-2xl border border-line bg-panel/40 p-5 sm:p-6 flex flex-col gap-4 shadow-xs">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-semibold text-text flex items-center gap-2">
              <span>🔑</span>
              <span>Mochbot &amp; Unified Webhook API Credentials</span>
            </h3>
            <p className="text-xs text-muted">
              Push live trades to <code className="text-accent font-mono">/trades</code>, price-trigger setups to{" "}
              <code className="text-accent font-mono">/watchlist</code>, or completed records directly to{" "}
              <code className="text-accent font-mono">/journal</code> using a single API Key.
            </p>
          </div>
          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono uppercase tracking-wider font-bold">
            Trades · Watchlist · Journal
          </span>
        </div>

        {/* Endpoint & API Key Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {/* Endpoint URL */}
          <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-canvas/60 border border-line">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted font-semibold">
                POST / GET Endpoint URL
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => copyText("endpoint", endpointUrl)}
                  className="px-2.5 py-1 rounded text-[11px] font-semibold bg-panel hover:bg-panel-soft border border-line text-text cursor-pointer"
                >
                  {copiedItem === "endpoint" ? "✓ Copied" : "Copy URL"}
                </button>
                <button
                  type="button"
                  onClick={() => copyText("webhookUrl", endpointWithKey)}
                  className="px-2.5 py-1 rounded text-[11px] font-semibold bg-accent text-white hover:opacity-90 cursor-pointer"
                >
                  {copiedItem === "webhookUrl" ? "✓ Copied!" : "📋 Copy URL + Key"}
                </button>
              </div>
            </div>
            <input
              type="text"
              readOnly
              value={endpointUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="w-full px-2.5 py-1.5 text-xs font-mono rounded bg-panel border border-line text-accent select-all outline-none"
            />
            <span className="text-[11px] text-muted">
              Supports <code className="font-mono text-text">POST</code> (open / update / close / watchlist / journal) &amp;{" "}
              <code className="font-mono text-text">GET</code> (list active trades &amp; watchlist).
            </span>
          </div>

          {/* Personal API Key */}
          <div className="flex flex-col gap-1.5 p-3.5 rounded-xl bg-canvas/60 border border-line">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted font-semibold">
                Personal API Key (X-API-Key)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowKey((prev) => !prev)}
                  className="px-2 py-1 rounded text-[11px] text-muted hover:text-text border border-line cursor-pointer"
                >
                  {showKey ? "Hide" : "Show"}
                </button>
                <button
                  type="button"
                  onClick={() => copyText("apiKey", apiKey)}
                  className="px-2.5 py-1 rounded text-[11px] font-semibold bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25 cursor-pointer"
                >
                  {copiedItem === "apiKey" ? "✓ Key Copied!" : "📋 Copy Key"}
                </button>
                <button
                  type="button"
                  onClick={handleRegenerateKey}
                  disabled={regenerating}
                  className="px-2 py-1 rounded text-[11px] text-muted hover:text-loss border border-line hover:border-loss/40 cursor-pointer disabled:opacity-50"
                  title="Generate a new API Key"
                >
                  {regenerating ? "…" : "🔄 Roll"}
                </button>
              </div>
            </div>
            <input
              type={showKey ? "text" : "password"}
              readOnly
              value={apiKey}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="w-full px-2.5 py-1.5 text-xs font-mono rounded bg-panel border border-line text-text select-all outline-none"
            />
            <span className="text-[11px] text-muted">
              Pass via header <code className="font-mono text-accent">X-API-Key</code>,{" "}
              <code className="font-mono text-accent">Authorization: Bearer</code>, query{" "}
              <code className="font-mono text-accent">?key=</code>, or JSON{" "}
              <code className="font-mono text-accent">&quot;api_key&quot;</code>.
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. Quick Guide: What Data Is Needed for Trades, Watchlist & Journal ── */}
      <div className="rounded-2xl border border-line bg-panel/40 p-5 sm:p-6 flex flex-col gap-4 shadow-xs">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold text-text flex items-center gap-2">
            <span>📋</span>
            <span>Supported Actions &amp; Required Data Fields</span>
          </h3>
          <p className="text-xs text-muted">
            Use the <code className="font-mono text-accent">action</code> field in your JSON body to route data to{" "}
            <code className="font-mono text-text">/trades</code>, <code className="font-mono text-text">/watchlist</code>, or{" "}
            <code className="font-mono text-text">/journal</code>:
          </p>
        </div>

        {/* 5 Action Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          <div className="p-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-emerald-400 uppercase text-[11px]">
                1. &quot;open&quot;
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300">
                /trades
              </span>
            </div>
            <p className="text-[11px] text-muted leading-snug">
              Opens an active trade &amp; monitors SL/TP 24/7.
            </p>
            <div className="text-[10px] font-mono text-muted pt-1 border-t border-emerald-500/15 flex flex-col gap-0.5">
              <span><b className="text-text">Req:</b> symbol, side</span>
              <span><b className="text-text">Opt:</b> entry_price, stop_loss, take_profit, margin_usd, leverage</span>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-amber-500/25 bg-amber-500/5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-amber-400 uppercase text-[11px]">
                2. &quot;update&quot;
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                /trades
              </span>
            </div>
            <p className="text-[11px] text-muted leading-snug">
              Modifies SL, TP, or moves SL to entry breakeven.
            </p>
            <div className="text-[10px] font-mono text-muted pt-1 border-t border-amber-500/15 flex flex-col gap-0.5">
              <span><b className="text-text">Match:</b> trade_id or symbol</span>
              <span><b className="text-text">Opt:</b> stop_loss, take_profit, breakeven: true</span>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-sky-500/25 bg-sky-500/5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-sky-400 uppercase text-[11px]">
                3. &quot;close&quot;
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300">
                /trades → /journal
              </span>
            </div>
            <p className="text-[11px] text-muted leading-snug">
              Closes active trade, computes PnL &amp; logs to Journal.
            </p>
            <div className="text-[10px] font-mono text-muted pt-1 border-t border-sky-500/15 flex flex-col gap-0.5">
              <span><b className="text-text">Match:</b> trade_id or symbol</span>
              <span><b className="text-text">Opt:</b> exit_price, closed_reason, close_notes</span>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-purple-500/25 bg-purple-500/5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-purple-400 uppercase text-[11px]">
                4. &quot;watchlist&quot;
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300">
                /watchlist
              </span>
            </div>
            <p className="text-[11px] text-muted leading-snug">
              Arms a pending price-trigger setup on Watchlist.
            </p>
            <div className="text-[10px] font-mono text-muted pt-1 border-t border-purple-500/15 flex flex-col gap-0.5">
              <span><b className="text-text">Req:</b> symbol, side</span>
              <span><b className="text-text">Opt:</b> trigger_price, entry_price, stop_loss, take_profit</span>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-pink-500/25 bg-pink-500/5 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-pink-400 uppercase text-[11px]">
                5. &quot;journal&quot;
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-pink-500/15 text-pink-300">
                /journal
              </span>
            </div>
            <p className="text-[11px] text-muted leading-snug">
              Directly logs a trade into your Trade Journal.
            </p>
            <div className="text-[10px] font-mono text-muted pt-1 border-t border-pink-500/15 flex flex-col gap-0.5">
              <span><b className="text-text">Req:</b> symbol, side</span>
              <span><b className="text-text">Opt:</b> entry_price, exit_price, margin_usd, leverage, tags, fees</span>
            </div>
          </div>
        </div>

        {/* Full Data Schema Reference Table */}
        <div className="overflow-x-auto rounded-xl border border-line bg-canvas/40">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-line bg-panel/70 text-[10px] font-mono uppercase tracking-wider text-muted">
                <th className="py-2.5 px-3">Field</th>
                <th className="py-2.5 px-3">Aliases</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Requirement / Default</th>
                <th className="py-2.5 px-3">Description &amp; Behavior</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {BOT_API_FIELDS_SPEC.map((spec) => (
                <tr key={spec.field} className="hover:bg-panel/40 transition-colors">
                  <td className="py-2 px-3 font-mono font-bold text-accent whitespace-nowrap">
                    {spec.field}
                  </td>
                  <td className="py-2 px-3 font-mono text-[11px] text-muted whitespace-nowrap">
                    {spec.aliases?.length ? spec.aliases.join(", ") : "—"}
                  </td>
                  <td className="py-2 px-3 font-mono text-[11px] text-text whitespace-nowrap">
                    {spec.type}
                  </td>
                  <td className="py-2 px-3 text-[11px] whitespace-nowrap">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded font-mono text-[10px] ${
                        spec.requiredFor.startsWith("Required")
                          ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                          : "bg-panel text-muted border border-line"
                      }`}
                    >
                      {spec.requiredFor}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-[11px] text-muted leading-relaxed min-w-[240px]">
                    {spec.description}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 3. Interactive Payload Builder, Code Snippets & 1-Click Live Tester ── */}
      <div className="rounded-2xl border border-line bg-panel/40 p-5 sm:p-6 flex flex-col gap-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-semibold text-text flex items-center gap-2">
              <span>🛠️</span>
              <span>Interactive Mochbot Payload Builder &amp; Live Tester</span>
            </h3>
            <p className="text-xs text-muted">
              Select an action below to generate ready-to-paste code or fire a real test call into{" "}
              <code className="font-mono text-accent">/trades</code>,{" "}
              <code className="font-mono text-accent">/watchlist</code>, or{" "}
              <code className="font-mono text-accent">/journal</code>.
            </p>
          </div>

          {/* Action Selector Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: "open", label: "🚀 Open Trade" },
                { id: "update", label: "🎯 Update SL/TP" },
                { id: "close", label: "🏁 Close Trade" },
                { id: "watchlist", label: "📡 Add Watchlist" },
                { id: "journal", label: "📓 Add Journal" },
              ] as { id: BotAction; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAction(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                  action === tab.id
                    ? "bg-accent/15 text-accent border-accent/40 shadow-xs"
                    : "bg-panel text-muted hover:text-text border-line"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Form Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-muted font-medium">Symbol (USDT Pair)</span>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="SOL_USDT"
              className="hairline bg-panel px-2.5 py-1.5 rounded text-xs font-mono outline-none focus:border-accent"
            />
          </label>

          {(action === "open" || action === "watchlist" || action === "journal") && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted font-medium">Side / Direction</span>
              <select
                value={side}
                onChange={(e) => setSide(e.target.value as BotSide)}
                className="hairline bg-panel px-2.5 py-1.5 rounded text-xs outline-none focus:border-accent cursor-pointer"
              >
                <option value="long">↗ LONG (buy)</option>
                <option value="short">↘ SHORT (sell)</option>
              </select>
            </label>
          )}

          {(action === "open" || action === "watchlist") && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted font-medium">Order Type</span>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as "market" | "limit")}
                className="hairline bg-panel px-2.5 py-1.5 rounded text-xs outline-none focus:border-accent cursor-pointer"
              >
                <option value="market">Market</option>
                <option value="limit">Limit</option>
              </select>
            </label>
          )}

          {action === "watchlist" && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted font-medium">Trigger Price</span>
              <input
                type="text"
                value={triggerPrice}
                onChange={(e) => setTriggerPrice(e.target.value)}
                placeholder="184.00"
                className="hairline bg-panel px-2.5 py-1.5 rounded text-xs font-mono outline-none focus:border-accent"
              />
            </label>
          )}

          {(action === "open" || action === "watchlist" || action === "journal") && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted font-medium">
                Entry Price <span className="text-[10px] opacity-75">(blank = live MEXC)</span>
              </span>
              <input
                type="text"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                placeholder="Auto live price if empty"
                className="hairline bg-panel px-2.5 py-1.5 rounded text-xs font-mono outline-none focus:border-accent"
              />
            </label>
          )}

          {(action === "update" || action === "close") && (
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-[11px] text-muted font-medium">
                Target Trade ID <span className="text-[10px] opacity-75">(optional — leave blank to match latest active {symbol || "coin"} trade)</span>
              </span>
              <input
                type="text"
                value={tradeId}
                onChange={(e) => setTradeId(e.target.value)}
                placeholder="Leave blank to match by symbol automatically"
                className="hairline bg-panel px-2.5 py-1.5 rounded text-xs font-mono outline-none focus:border-accent"
              />
            </label>
          )}

          {action !== "close" && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted font-medium">Stop Loss (SL)</span>
              <input
                type="text"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                disabled={action === "update" && moveToBe}
                placeholder="178.00"
                className="hairline bg-panel px-2.5 py-1.5 rounded text-xs font-mono outline-none focus:border-accent disabled:opacity-50"
              />
            </label>
          )}

          {action !== "close" && action !== "journal" && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted font-medium">Take Profit (TP)</span>
              <input
                type="text"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                placeholder="202.00"
                className="hairline bg-panel px-2.5 py-1.5 rounded text-xs font-mono outline-none focus:border-accent"
              />
            </label>
          )}

          {(action === "open" || action === "journal") && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted font-medium">Margin (USD)</span>
                <input
                  type="number"
                  value={marginUsd}
                  onChange={(e) => setMarginUsd(e.target.value)}
                  placeholder="100"
                  className="hairline bg-panel px-2.5 py-1.5 rounded text-xs font-mono outline-none focus:border-accent"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted font-medium">Leverage (x)</span>
                <input
                  type="number"
                  value={leverage}
                  onChange={(e) => setLeverage(e.target.value)}
                  placeholder="20"
                  className="hairline bg-panel px-2.5 py-1.5 rounded text-xs font-mono outline-none focus:border-accent"
                />
              </label>
            </>
          )}

          {action === "update" && (
            <label className="flex items-center gap-2 pt-5 cursor-pointer">
              <input
                type="checkbox"
                checked={moveToBe}
                onChange={(e) => setMoveToBe(e.target.checked)}
                className="accent-accent"
              />
              <span className="text-xs text-text font-medium">
                Move Stop-Loss to Breakeven (SL = Entry)
              </span>
            </label>
          )}

          {(action === "close" || action === "journal") && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted font-medium">
                Exit Price <span className="text-[10px] opacity-75">({action === "journal" ? "blank = open trade" : "blank = live MEXC"})</span>
              </span>
              <input
                type="text"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
                placeholder={action === "journal" ? "198.50 (or blank if open)" : "Auto live price if empty"}
                className="hairline bg-panel px-2.5 py-1.5 rounded text-xs font-mono outline-none focus:border-accent"
              />
            </label>
          )}

          {action === "close" && (
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-muted font-medium">Close Reason</span>
              <select
                value={closedReason}
                onChange={(e) =>
                  setClosedReason(e.target.value as "tp_hit" | "sl_hit" | "manual_close")
                }
                className="hairline bg-panel px-2.5 py-1.5 rounded text-xs outline-none focus:border-accent cursor-pointer"
              >
                <option value="tp_hit">🎯 Take Profit Hit (tp_hit)</option>
                <option value="sl_hit">🛑 Stop Loss Hit (sl_hit)</option>
                <option value="manual_close">✋ Manual / Bot Close (manual_close)</option>
              </select>
            </label>
          )}

          {action === "journal" && (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted font-medium">Tags (comma-separated)</span>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="Mochbot, Momentum"
                  className="hairline bg-panel px-2.5 py-1.5 rounded text-xs font-mono outline-none focus:border-accent"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted font-medium">Fees (USD)</span>
                <input
                  type="number"
                  step="0.01"
                  value={feesInput}
                  onChange={(e) => setFeesInput(e.target.value)}
                  placeholder="0.80"
                  className="hairline bg-panel px-2.5 py-1.5 rounded text-xs font-mono outline-none focus:border-accent"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted font-medium">Discipline Score (1–5)</span>
                <select
                  value={disciplineScore}
                  onChange={(e) => setDisciplineScore(e.target.value)}
                  className="hairline bg-panel px-2.5 py-1.5 rounded text-xs font-mono outline-none focus:border-accent cursor-pointer"
                >
                  <option value="5">5 ★ — Flawless Execution</option>
                  <option value="4">4 ★ — Solid Execution</option>
                  <option value="3">3 ★ — Average</option>
                  <option value="2">2 ★ — Suboptimal</option>
                  <option value="1">1 ★ — Rule Violation</option>
                </select>
              </label>
            </>
          )}

          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-[11px] text-muted font-medium">Notes / Thesis / Review</span>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Mochbot Momentum Signal"
              className="hairline bg-panel px-2.5 py-1.5 rounded text-xs font-mono outline-none focus:border-accent"
            />
          </label>

          <label className="flex items-center gap-2 pt-5 cursor-pointer">
            <input
              type="checkbox"
              checked={notify}
              onChange={(e) => setNotify(e.target.checked)}
              className="accent-accent"
            />
            <span className="text-xs text-muted">
              Send Telegram/Discord notification (<code className="font-mono">notify: true</code>)
            </span>
          </label>
        </div>

        {/* Code Format Selector Tabs */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-line pb-2">
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: "json", label: "{ } JSON Payload" },
                  { id: "python", label: "🐍 Python (Mochbot)" },
                  { id: "node", label: "🟩 Node.js / TS" },
                  { id: "curl", label: "💻 cURL" },
                ] as { id: CodeTab; label: string }[]
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setCodeTab(t.id)}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
                    codeTab === t.id
                      ? "bg-accent text-white font-semibold"
                      : "bg-panel text-muted hover:text-text border border-line"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => copyText("snippet", activeSnippet)}
                className="px-3 py-1 rounded-lg text-xs font-semibold bg-panel hover:bg-panel-soft border border-line text-text hover:text-accent transition-colors cursor-pointer"
              >
                {copiedItem === "snippet" ? "✓ Copied Code!" : "📋 Copy Code"}
              </button>
              <button
                type="button"
                onClick={handleRunLiveTest}
                disabled={testing}
                className="px-3.5 py-1 rounded-lg text-xs font-semibold bg-accent text-white hover:opacity-90 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
              >
                <span>⚡</span>
                <span>
                  {testing
                    ? "Sending…"
                    : `Test '${action.toUpperCase()}' Now`}
                </span>
              </button>
            </div>
          </div>

          <pre
            className={`p-3.5 rounded-xl bg-canvas border border-line text-accent font-mono text-[11px] overflow-x-auto select-all leading-relaxed ${
              compact ? "max-h-60" : "max-h-80"
            }`}
          >
            {activeSnippet}
          </pre>

          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs font-mono flex flex-col gap-1.5 ${
                testResult.ok
                  ? "bg-gain/10 border-gain/30 text-gain"
                  : "bg-loss/10 border-loss/30 text-loss"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold">{testResult.message}</span>
                <button
                  type="button"
                  onClick={() => setTestResult(null)}
                  className="text-muted hover:text-text cursor-pointer"
                >
                  ✕
                </button>
              </div>
              {Boolean(testResult.raw) && (
                <pre className="text-[10px] text-muted bg-canvas/70 p-2 rounded border border-line overflow-x-auto max-h-36">
                  {JSON.stringify(testResult.raw, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
