import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const FALLBACK_SUPABASE_URL = "https://sup.ymatt.online";
const FALLBACK_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkyMzk5Njk1LCJleHAiOjE5NTAwNzk2OTV9.wSXO5wzneeuWZyWFR09HVgF2ZwTmVNslHp1sZNYh18Y";

export function getSupabaseConfig() {
  const url =
    process.env["NEXT_PUBLIC_SUPABASE_URL"] ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    FALLBACK_SUPABASE_URL;
  const anonKey =
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    FALLBACK_SUPABASE_ANON_KEY;
  return { url, anonKey };
}

/**
 * Refreshes the Supabase auth session on any request that carries our
 * cookie, rewriting the stored cookie set so a near-expiry token is
 * rotated before it lapses. Returns the (possibly modified) response
 * plus the current user.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse: NextResponse = NextResponse.next({ request });
  const { url, anonKey } = getSupabaseConfig();

  if (!url || !anonKey) {
    return { response: supabaseResponse, user: null };
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Important: do not run code between createServerClient and this call —
  // it will not be reflected in the refreshed cookie set.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response: supabaseResponse, user };
}
