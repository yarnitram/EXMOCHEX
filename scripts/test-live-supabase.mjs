import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadDotEnv(file) {
  const out = {};
  try {
    if (!existsSync(file)) return out;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch {}
  return out;
}

const env = loadDotEnv(resolve(ROOT, ".env.local"));
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

console.log("=================================================");
console.log("🔍 LIVE PROXMOX SUPABASE HEALTH CHECK");
console.log("Endpoint:", SUPABASE_URL);
console.log("=================================================\n");

async function run() {
  // 1. Auth Service Health
  console.log("--- 1. Auth Service (GoTrue) ---");
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: ANON_KEY },
    });
    const data = await res.json();
    console.log(`✅ Auth Gateway: HTTP ${res.status} (version ${data.version}, ${data.name})`);
  } catch (err) {
    console.error(`❌ Auth Gateway Error:`, err.message);
  }

  // 2. Database Tables
  console.log("\n--- 2. Database Tables & RLS Policies ---");
  const anonClient = createClient(SUPABASE_URL, ANON_KEY);

  const tables = [
    "accounts",
    "trades",
    "tags",
    "trade_tags",
    "trade_notes",
    "watchlist_items",
    "trade_alerts",
    "archived_trade_alerts",
    "triggered_watchlist_items",
    "archived_watchlist_items",
    "user_settings",
    "public_share_links",
    "notifications",
    "setup_revisions",
  ];

  let successCount = 0;
  for (const table of tables) {
    try {
      const { data, error, status } = await anonClient
        .from(table)
        .select("*")
        .limit(1);

      if (error) {
        console.log(`❌ ${table.padEnd(28)} HTTP ${status} — ${error.message}`);
      } else {
        successCount++;
        console.log(`✅ ${table.padEnd(28)} HTTP ${status} — Active & queryable`);
      }
    } catch (err) {
      console.log(`💥 ${table.padEnd(28)} Exception: ${err.message}`);
    }
  }

  console.log(`\nTable Health: ${successCount}/${tables.length} tables verified.`);

  // 3. Service Role Key
  console.log("\n--- 3. Service Role Key ---");
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/accounts?limit=1`, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
    });
    if (res.ok) {
      console.log(`✅ Service Role Key: HTTP ${res.status} (Valid)`);
    } else {
      console.log(`⚠️ Service Role Key: HTTP ${res.status} (Unauthorized - check API secret in Studio)`);
    }
  } catch (err) {
    console.error(`Service Role Key Error:`, err.message);
  }

  console.log("\n=================================================");
  console.log("Check Complete.");
  console.log("=================================================");
}

run();
