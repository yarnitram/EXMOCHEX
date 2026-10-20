"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { playAlarmSound, AlarmSoundPreset } from "@/lib/audio-alarm-engine";
import { cleanSymbol, fmtPx } from "@/lib/format";
import { useMarketData } from "@/context/market-data-context";
import { useRealtimeAlerts } from "@/context/realtime-alert-context";

interface ProximityAlarmToast {
  id: string;
  symbol: string;
  distancePct: number;
  triggerPrice: number;
  lastPrice: number;
  timestamp: number;
}

interface WatchlistItem {
  id: string;
  symbol: string;
  trigger_price: number | null;
  alert_fired: boolean;
}

export function AudioAlarmNotifier() {
  const [toasts, setToasts] = useState<ProximityAlarmToast[]>([]);
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [settings, setSettings] = useState<{
    sound_enabled?: boolean;
    proximity_alarm_enabled?: boolean;
    proximity_threshold_pct?: number;
    alarm_sound_preset?: AlarmSoundPreset;
  } | null>(null);

  const cooldownsRef = useRef<Record<string, number>>({});
  const { getLatestPrice, subscribeSymbols } = useMarketData();
  const { onWatchlistChange } = useRealtimeAlerts();

  // Load user settings on mount
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data?.settings) setSettings(data.settings);
      })
      .catch(() => {});
  }, []);

  // Fetch active watchlist items once on mount or when Realtime fires
  const loadWatchlist = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.items)) {
        setItems(data.items);
        const activeSymbols = data.items
          .filter((i: WatchlistItem) => !i.alert_fired && i.trigger_price)
          .map((i: WatchlistItem) => i.symbol);
        if (activeSymbols.length > 0) {
          subscribeSymbols(activeSymbols);
        }
      }
    } catch {
      // Graceful ignore
    }
  }, [subscribeSymbols]);

  useEffect(() => {
    loadWatchlist();
    return onWatchlistChange(() => {
      loadWatchlist();
    });
  }, [loadWatchlist, onWatchlistChange]);

  // Pure in-memory proximity evaluation on live price ticks
  useEffect(() => {
    if (!settings?.sound_enabled || !settings?.proximity_alarm_enabled) return;
    if (items.length === 0) return;

    const thresholdPct = Number(settings.proximity_threshold_pct || 0.5);
    const preset: AlarmSoundPreset = settings.alarm_sound_preset || "radar_ping";
    const now = Date.now();
    const newToasts: ProximityAlarmToast[] = [];
    let triggeredSound = false;

    for (const item of items) {
      if (item.alert_fired || !item.trigger_price || item.trigger_price <= 0) continue;

      const lastPx = getLatestPrice(item.symbol);
      if (!lastPx || lastPx <= 0) continue;

      const diff = Math.abs(lastPx - item.trigger_price);
      const distPct = (diff / item.trigger_price) * 100;

      if (distPct <= thresholdPct) {
        const cooldownKey = `${item.symbol}_${item.trigger_price}`;
        const lastFiredTime = cooldownsRef.current[cooldownKey] || 0;

        // 60-second cooldown per trigger level
        if (now - lastFiredTime > 60_000) {
          cooldownsRef.current[cooldownKey] = now;
          triggeredSound = true;

          newToasts.push({
            id: `toast_${Date.now()}_${item.id}`,
            symbol: item.symbol,
            distancePct: distPct,
            triggerPrice: item.trigger_price,
            lastPrice: lastPx,
            timestamp: now,
          });
        }
      }
    }

    if (triggeredSound) {
      playAlarmSound(preset);
    }

    if (newToasts.length > 0) {
      setToasts((prev) => [...newToasts, ...prev].slice(0, 3));
    }
  }, [items, settings, getLatestPrice]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const cleanSym = cleanSymbol(toast.symbol);
        return (
          <div
            key={toast.id}
            className="pointer-events-auto bg-panel/95 border border-amber-500/50 shadow-2xl shadow-amber-500/10 p-4 rounded-2xl text-text flex items-start justify-between gap-3 animate-in slide-in-from-bottom-5 duration-300 backdrop-blur-md"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center text-lg font-bold shrink-0 animate-pulse">
                🔊
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-extrabold text-sm font-mono text-amber-400">
                    {cleanSym} / USDT
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono">
                    {toast.distancePct.toFixed(2)}% Away
                  </span>
                </div>
                <p className="text-xs text-text mt-1">
                  Near Trigger: <strong className="text-amber-400">{fmtPx(toast.triggerPrice)}</strong> (Last: {fmtPx(toast.lastPrice)})
                </p>
              </div>
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 text-muted hover:text-text rounded-lg hover:bg-panel-soft transition-colors cursor-pointer"
              title="Dismiss Alarm Toast"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
