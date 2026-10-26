import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "@/lib/supabase/server";

function isLocalOrPrivate(host: string): boolean {
  return (
    host.includes("localhost") ||
    host.includes("127.0.0.1") ||
    /^192\.168\./.test(host) ||
    /^10\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
  );
}

/**
 * Auth callback — exchanges an OAuth / magic-link code for a session
 * and stores it in cookies. Kept separate so it can use its own cookie
 * manager without the proxy-opting concerns of the app pages.
 */
function getRequestOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");
  const protoHeader = request.headers.get("x-forwarded-proto");

  if (host) {
    let cleanHost = host.split(",")[0].trim();
    if (cleanHost.includes("0.0.0.0")) {
      cleanHost = cleanHost.replace("0.0.0.0", "localhost");
    }
    const isLocal = isLocalOrPrivate(cleanHost);
    const protocol = protoHeader || (isLocal ? "http" : "https");
    return `${protocol}://${cleanHost}`;
  }

  const url = new URL(request.url);
  let cleanHost = url.host;
  if (cleanHost.includes("0.0.0.0")) {
    cleanHost = cleanHost.replace("0.0.0.0", "localhost");
  }
  const isLocal = isLocalOrPrivate(cleanHost);
  const protocol = protoHeader || (isLocal ? url.protocol.replace(":", "") : "https");
  return `${protocol}://${cleanHost}`;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = getRequestOrigin(request);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") ?? "/watchlist";
  const errorParam = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  if (errorParam || errorDescription) {
    const message = errorDescription || errorParam || "OAuth authentication failed.";
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(message)}`);
  }

  if (code) {
    const cookieStore = await cookies();
    const { url, anonKey } = getSupabaseConfig();
    const supabase = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    });
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (!exchangeError) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
    );
  }

  // Redirect the user to an error page with an optional error description.
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
