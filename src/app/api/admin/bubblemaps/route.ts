import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { getLiveBubbleMapData } from "@/lib/live-bubblemaps";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Admin-only protection
  const { isAdmin } = await requireAdmin(false);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") || "POPCAT";

  try {
    const data = await getLiveBubbleMapData(token);
    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (err: any) {
    console.error("[API Bubblemaps Error]", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate live bubble map data" },
      { status: 500 }
    );
  }
}
