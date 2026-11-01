import type { Metadata } from "next";
import { TokenProfileView } from "@/components/token/token-profile-view";
import { cleanSymbol } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}): Promise<Metadata> {
  const { symbol } = await params;
  const clean = cleanSymbol(symbol).toUpperCase();
  return {
    title: `${clean} Token Fundamentals & Valuation — MOCHEX`,
    description: `Deep-dive institutional fundamentals, circulating supply, market cap, FDV dilution risk, and project usecase for ${clean}.`,
  };
}

export default async function TokenPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  const clean = cleanSymbol(symbol).toUpperCase();
  return <TokenProfileView symbol={clean} />;
}
