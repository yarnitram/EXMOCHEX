import type { Metadata } from "next";
import { ScreenerView } from "@/components/screener/screener-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CEX Screener — MEXC USDT Perpetuals | MOCHEX",
  description:
    "Real-time market screener for 1,100+ MEXC USDT perpetual contracts with sub-5s tick metrics, leverage rankings, and instant setup triggers.",
};

export default function ScreenerPage() {
  return <ScreenerView />;
}
