"use client";

import React from "react";
import { MarketDataProvider } from "@/context/market-data-context";
import { RealtimeAlertProvider } from "@/context/realtime-alert-context";

export function RealtimeProviders({ children }: { children: React.ReactNode }) {
  return (
    <MarketDataProvider>
      <RealtimeAlertProvider>{children}</RealtimeAlertProvider>
    </MarketDataProvider>
  );
}
