import { createBrowserClient } from "@supabase/ssr";

const FALLBACK_SUPABASE_URL = "https://sup.ymatt.online";
const FALLBACK_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkyMzk5Njk1LCJleHAiOjE5NTAwNzk2OTV9.wSXO5wzneeuWZyWFR09HVgF2ZwTmVNslHp1sZNYh18Y";

/**
 * Browser-side Supabase client.
 * For use in Client Components and anywhere `cookies()` is unavailable.
 * Only handles user-anon-role operations (RLS-protected tables).
 */
export function createClient() {
  const supabaseUrl =
    process.env["NEXT_PUBLIC_SUPABASE_URL"] ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    FALLBACK_SUPABASE_URL;
  const supabaseAnonKey =
    process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    FALLBACK_SUPABASE_ANON_KEY;
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

export type SupabaseClientType = ReturnType<typeof createClient>;
