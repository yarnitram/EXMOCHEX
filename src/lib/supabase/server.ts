import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createServiceClientJs, type SupabaseClient } from "@supabase/supabase-js";

export function getSupabaseConfig() {
  const url =
    process.env["NEXT_PUBLIC_SUPABASE_URL"] ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://sup.ymatt.online";
  const anonKey =
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";
  const serviceKey =
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";
  return { url, anonKey, serviceKey };
}

/**
 * Server-side Supabase client bound to the request's cookies.
 * For use in Server Components, Route Handlers, and Server Actions.
 * Runs with the anon key and relies on RLS scoped to auth.uid().
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseConfig();

  if (!url || !anonKey) {
    throw new Error(
      `Supabase configuration missing: NEXT_PUBLIC_SUPABASE_URL (${url ? "set" : "missing"}), NEXT_PUBLIC_SUPABASE_ANON_KEY (${anonKey ? "set" : "missing"}). Check your .env or .env.local file.`
    );
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — safe to ignore for middleware refresh.
        }
      },
    },
  });
}

/** Structural type of a server-side Supabase client (loose, schema-agnostic). */
export type ServerSupabase = ReturnType<typeof createClient> extends Promise<infer C>
  ? C
  : never;

/**
 * A service-role client for privileged server-side operations.
 * NEVER import this into a Client Component.
 */
export async function createServiceClient() {
  const { url, serviceKey } = getSupabaseConfig();
  if (!url || !serviceKey) {
    throw new Error(
      `Supabase service role configuration missing: NEXT_PUBLIC_SUPABASE_URL (${url ? "set" : "missing"}), SUPABASE_SERVICE_ROLE_KEY (${serviceKey ? "set" : "missing"}).`
    );
  }

  return createServiceClientJs(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as SupabaseClient;
}
