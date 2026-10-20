"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { playAlarmSound } from "@/lib/audio-alarm-engine";

export interface RealtimeAlertContextValue {
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
  refreshUnreadCount: () => Promise<void>;
  onAlertChange: (listener: () => void) => () => void;
  onWatchlistChange: (listener: () => void) => () => void;
}

const RealtimeAlertContext = createContext<RealtimeAlertContextValue | null>(null);

export function RealtimeAlertProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const alertListenersRef = useRef<Set<() => void>>(new Set());
  const watchlistListenersRef = useRef<Set<() => void>>(new Set());

  const supabase = createClient();

  const refreshUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count");
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count ?? 0);
      }
    } catch {
      // Graceful ignore
    }
  }, []);

  const onAlertChange = useCallback((listener: () => void) => {
    alertListenersRef.current.add(listener);
    return () => alertListenersRef.current.delete(listener);
  }, []);

  const onWatchlistChange = useCallback((listener: () => void) => {
    watchlistListenersRef.current.add(listener);
    return () => watchlistListenersRef.current.delete(listener);
  }, []);

  useEffect(() => {
    refreshUnreadCount();

    // Subscribe to Postgres Changes over Supabase Realtime WebSocket
    const channel = supabase
      .channel("exmochex-realtime-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          setUnreadCount((prev) => prev + 1);
          // Play notification chime
          try {
            playAlarmSound("sonar_alert");
          } catch {}
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications" },
        (payload) => {
          refreshUnreadCount();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trade_alerts" },
        (payload) => {
          // Check if TP or SL fired
          if (payload.eventType === "UPDATE") {
            const newRow = payload.new as { sl_fired_at?: string; tp_fired_at?: string };
            const oldRow = payload.old as { sl_fired_at?: string; tp_fired_at?: string };

            if (newRow?.tp_fired_at && !oldRow?.tp_fired_at) {
              playAlarmSound("take_profit_bell");
            } else if (newRow?.sl_fired_at && !oldRow?.sl_fired_at) {
              playAlarmSound("stop_loss_hit");
            }
          }

          // Notify all active trade subscribers (e.g. trades page)
          for (const fn of alertListenersRef.current) {
            fn();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "watchlist_items" },
        () => {
          // Notify active watchlist subscribers
          for (const fn of watchlistListenersRef.current) {
            fn();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, refreshUnreadCount]);

  return (
    <RealtimeAlertContext.Provider
      value={{
        unreadCount,
        setUnreadCount,
        refreshUnreadCount,
        onAlertChange,
        onWatchlistChange,
      }}
    >
      {children}
    </RealtimeAlertContext.Provider>
  );
}

export function useRealtimeAlerts(): RealtimeAlertContextValue {
  const ctx = useContext(RealtimeAlertContext);
  if (!ctx) {
    throw new Error("useRealtimeAlerts must be used within a RealtimeAlertProvider");
  }
  return ctx;
}
