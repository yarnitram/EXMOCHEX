import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16 Proxy (formerly Middleware).
 * Guards the app routes behind auth and keeps the Supabase session fresh.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const { response, user } = await updateSession(request);
  const isAuthed = !!user;
  const isAppRoute =
    pathname.startsWith("/journal") ||
    pathname.startsWith("/analytics") ||
    pathname.startsWith("/risk") ||
    pathname.startsWith("/watchlist") ||
    pathname.startsWith("/screener") ||
    pathname.startsWith("/chart") ||
    pathname.startsWith("/trades") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/notifications") ||
    pathname.startsWith("/shares") ||
    pathname.startsWith("/settings");

  const isAuthRoute = pathname.startsWith("/login");

  // Unauthenticated users visiting the app go to the login page.
  if (isAppRoute && !isAuthed) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Logged-in users visiting the login page are sent to the journal or requested route.
  if (isAuthRoute && isAuthed) {
    const url = request.nextUrl.clone();
    url.pathname = nextPathname(request.nextUrl.searchParams.get("next")) || "/watchlist";
    return NextResponse.redirect(url);
  }

  return response;
}

function nextPathname(next: string | null): string | null {
  if (!next || !next.startsWith("/")) return null;
  return next;
}

export const config = {
  matcher: [
    "/journal/:path*",
    "/analytics/:path*",
    "/risk/:path*",
    "/watchlist/:path*",
    "/screener/:path*",
    "/chart/:path*",
    "/trades/:path*",
    "/admin/:path*",
    "/notifications/:path*",
    "/shares/:path*",
    "/settings",
    "/login",
  ],
};
