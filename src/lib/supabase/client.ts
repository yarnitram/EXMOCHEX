import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client.
 * For use in Client Components and anywhere `cookies()` is unavailable.
 * Only handles user-anon-role operations (RLS-protected tables).
 */
export function createClient() {
  const supabaseUrl =
    process.env["NEXT_PUBLIC_SUPABASE_URL"] ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://sup.ymatt.online";
  const supabaseAnonKey =
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

export type SupabaseClientType = ReturnType<typeof createClient>;
