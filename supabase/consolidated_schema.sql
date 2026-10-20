-- ============================================================
-- MOCHEX — Crypto Trading Setup Journal
-- Supabase / Postgres schema
--
-- Run this in the Supabase SQL editor (or via migrations).
-- Every table is gated behind Row Level Security scoped to auth.uid().
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------
-- Accounts: supports multiple brokers/accounts even though v1 is single-user
-- ------------------------------------------------------------------
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  broker text,
  starting_balance numeric(14,2) not null default 0,
  current_balance numeric(14,2) not null default 0,
  created_at timestamptz default now()
);

-- Trades: the core table
create table if not exists trades (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts not null,
  symbol text not null,
  direction text not null check (direction in ('long','short')),
  entry_price numeric(14,4) not null,
  exit_price numeric(14,4),              -- null while position is open
  size numeric(14,4) not null,
  stop_price numeric(14,4),              -- required for a meaningful R-multiple
  fees numeric(10,2) not null default 0,
  entry_time timestamptz not null,
  exit_time timestamptz,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz default now()
);
-- pnl_dollars, pnl_pct, r_multiple are COMPUTED in application code.

-- Tags
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  category text check (category in ('strategy','setup','mistake','emotion')),
  unique(user_id, name)
);

create table if not exists trade_tags (
  trade_id uuid references trades on delete cascade,
  tag_id uuid references tags on delete cascade,
  primary key (trade_id, tag_id)
);

-- Notes + screenshot reference (screenshot itself lives in Supabase Storage)
create table if not exists trade_notes (
  trade_id uuid primary key references trades on delete cascade,
  pre_trade_thesis text,
  post_trade_review text,
  discipline_score smallint check (discipline_score between 1 and 5),
  screenshot_url text
);

-- Risk settings per account
create table if not exists risk_settings (
  account_id uuid primary key references accounts on delete cascade,
  max_daily_loss numeric(14,2),
  max_position_risk_pct numeric(5,2),
  max_open_positions smallint
);

-- Watchlist
create table if not exists watchlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  symbol text not null,
  notes text,
  alert_price numeric(18,7),
  added_at timestamptz default now()
);

-- Trade alerts log: fired watchlist price-triggers, shown on /trades
create table if not exists trade_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  -- The watchlist row that fired; kept after the item is deleted.
  watchlist_item_id uuid references watchlist_items on delete set null,
  symbol text not null,
  trigger_price numeric(18,7),
  trigger_direction text check (trigger_direction in ('above','below')),
  -- Last price when the alert fired.
  fired_price numeric(18,7),
  -- Saved trade plan at fire time.
  entry_price numeric(18,7),
  stop_loss numeric(18,7),
  take_profit numeric(18,7),
  -- Intended order type when the trigger fired.
  order_type text check (order_type in ('limit','trigger_limit','market')),
  -- Position sizing for /trades (added by migration 010). NULL = page
  -- default: $1 margin, and the contract's max leverage from MEXC.
  margin_usd numeric(18,2),
  leverage numeric(18,2),
  notes text,
  -- Set once the live price crosses each plan level (added by migration 011).
  -- NULL = not hit yet; a set timestamp means the level never fires again.
  sl_fired_at timestamptz,
  tp_fired_at timestamptz,
  fired_at timestamptz not null default now(),
  created_at timestamptz default now()
);

-- ------------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------------

alter table accounts enable row level security;
alter table trades enable row level security;
alter table tags enable row level security;
alter table trade_tags enable row level security;
alter table trade_notes enable row level security;
alter table risk_settings enable row level security;
alter table watchlist_items enable row level security;
alter table trade_alerts enable row level security;

-- Owner-scoped policies. A row belongs to the user when:
--   accounts.user_id = auth.uid()
--   trades.account.author is auth.uid()
--   tags.user_id = auth.uid()
--   trade_tags through tags / trades ownership
--   trade_notes through trades
--   risk_settings through accounts
--   watchlist_items.user_id = auth.uid()
--   trade_alerts.user_id = auth.uid()

-- ACCOUNTS
create policy "accounts_select_own" on accounts
  for select to authenticated using (auth.uid() = user_id);
create policy "accounts_insert_own" on accounts
  for insert to authenticated with check (auth.uid() = user_id);
create policy "accounts_update_own" on accounts
  for update to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "accounts_delete_own" on accounts
  for delete to authenticated using (auth.uid() = user_id);

-- TRADES (owner is resolved through the account)
create policy "trades_select_own" on trades
  for select to authenticated
  using (exists (
    select 1 from accounts a
    where a.id = account_id and a.user_id = auth.uid()
  ));
create policy "trades_insert_own" on trades
  for insert to authenticated
  with check (exists (
    select 1 from accounts a
    where a.id = account_id and a.user_id = auth.uid()
  ));
create policy "trades_update_own" on trades
  for update to authenticated
  using (exists (
    select 1 from accounts a
    where a.id = account_id and a.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from accounts a
    where a.id = account_id and a.user_id = auth.uid()
  ));
create policy "trades_delete_own" on trades
  for delete to authenticated
  using (exists (
    select 1 from accounts a
    where a.id = account_id and a.user_id = auth.uid()
  ));

-- TAGS
create policy "tags_select_own" on tags
  for select to authenticated using (auth.uid() = user_id);
create policy "tags_insert_own" on tags
  for insert to authenticated with check (auth.uid() = user_id);
create policy "tags_update_own" on tags
  for update to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "tags_delete_own" on tags
  for delete to authenticated using (auth.uid() = user_id);

-- TRADE_TAGS
create policy "trade_tags_select_own" on trade_tags
  for select to authenticated
  using (exists (
    select 1 from tags t where t.id = tag_id and t.user_id = auth.uid()
  ));
create policy "trade_tags_insert_own" on trade_tags
  for insert to authenticated
  with check (exists (
    select 1 from tags t where t.id = tag_id and t.user_id = auth.uid()
  ));
create policy "trade_tags_delete_own" on trade_tags
  for delete to authenticated
  using (exists (
    select 1 from tags t where t.id = tag_id and t.user_id = auth.uid()
  ));

-- TRADE_NOTES
create policy "notes_select_own" on trade_notes
  for select to authenticated
  using (exists (
    select 1 from trades tr
    join accounts a on a.id = tr.account_id
    where tr.id = trade_id and a.user_id = auth.uid()
  ));
create policy "notes_insert_own" on trade_notes
  for insert to authenticated
  with check (exists (
    select 1 from trades tr
    join accounts a on a.id = tr.account_id
    where tr.id = trade_id and a.user_id = auth.uid()
  ));
create policy "notes_update_own" on trade_notes
  for update to authenticated
  using (exists (
    select 1 from trades tr
    join accounts a on a.id = tr.account_id
    where tr.id = trade_id and a.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from trades tr
    join accounts a on a.id = tr.account_id
    where tr.id = trade_id and a.user_id = auth.uid()
  ));
create policy "notes_delete_own" on trade_notes
  for delete to authenticated
  using (exists (
    select 1 from trades tr
    join accounts a on a.id = tr.account_id
    where tr.id = trade_id and a.user_id = auth.uid()
  ));

-- RISK_SETTINGS
create policy "risk_settings_select_own" on risk_settings
  for select to authenticated
  using (exists (
    select 1 from accounts a
    where a.id = account_id and a.user_id = auth.uid()
  ));
create policy "risk_settings_upsert_own" on risk_settings
  for insert to authenticated
  with check (exists (
    select 1 from accounts a
    where a.id = account_id and a.user_id = auth.uid()
  ));
create policy "risk_settings_update_own" on risk_settings
  for update to authenticated
  using (exists (
    select 1 from accounts a
    where a.id = account_id and a.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from accounts a
    where a.id = account_id and a.user_id = auth.uid()
  ));

-- WATCHLIST
create policy "watchlist_select_own" on watchlist_items
  for select to authenticated using (auth.uid() = user_id);
create policy "watchlist_insert_own" on watchlist_items
  for insert to authenticated with check (auth.uid() = user_id);
create policy "watchlist_update_own" on watchlist_items
  for update to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "watchlist_delete_own" on watchlist_items
  for delete to authenticated using (auth.uid() = user_id);

-- TRADE ALERTS (fired watchlist triggers, shown on /trades)
create policy "trade_alerts_select_own" on trade_alerts
  for select to authenticated using (auth.uid() = user_id);
create policy "trade_alerts_insert_own" on trade_alerts
  for insert to authenticated with check (auth.uid() = user_id);
create policy "trade_alerts_update_own" on trade_alerts
  for update to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "trade_alerts_delete_own" on trade_alerts
  for delete to authenticated using (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- Storage bucket for trade screenshots
-- ------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('trade-screenshots', 'trade-screenshots', true)
on conflict (id) do nothing;

-- Public read for screenshots (they're keyed to the user's own trades anyway).
create policy "screenshots_public_read"
  on storage.objects for select
  using (bucket_id = 'trade-screenshots');

create policy "screenshots_owner_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'trade-screenshots');
-- ============================================================
-- 002 — Trade alerts
-- Extends watchlist_items with a price trigger + trade plan so a
-- background watcher can notify the user via Discord / desktop when
-- the coin's last price crosses the trigger.
-- ============================================================

-- Trigger: when the coin hits this price the alert fires.
-- Reuses existing "alert_price" as the trigger price (kept in sync in app).
alter table public.watchlist_items
  add column if not exists trigger_price numeric(14,4);

-- Direction of the trigger: fire when price rises ABOVE or falls BELOW.
alter table public.watchlist_items
  add column if not exists trigger_direction text
  check (trigger_direction in ('above','below'));

-- Trade plan the user intends to take when the trigger hits.
alter table public.watchlist_items
  add column if not exists entry_price numeric(14,4);
alter table public.watchlist_items
  add column if not exists stop_loss numeric(14,4);
alter table public.watchlist_items
  add column if not exists take_profit numeric(14,4);

-- Whether the alert has fired, so the watcher does not re-notify repeatedly.
alter table public.watchlist_items
  add column if not exists alert_fired boolean not null default false;

-- When the alert last fired (for display / re-arm bookkeeping).
alter table public.watchlist_items
  add column if not exists alert_fired_at timestamptz;

-- Keep RLS policies intact (already owner-scoped via user_id).
-- ============================================================
-- 003 — User settings (notification config)
-- Per-user notification settings, read by the app and the
-- always-on alert watcher. Owner-scoped via RLS.
-- ============================================================

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users on delete cascade,
  discord_webhook_url text,
  notify_discord boolean not null default true,
  notify_desktop boolean not null default true,
  updated_at timestamptz default now()
);

alter table public.user_settings enable row level security;

create policy "user_settings_select_own"
  on public.user_settings for select
  to authenticated using (auth.uid() = user_id);

create policy "user_settings_insert_own"
  on public.user_settings for insert
  to authenticated with check (auth.uid() = user_id);

create policy "user_settings_update_own"
  on public.user_settings for update
  to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
-- ============================================================
-- 004 — Watchlist refresh interval
-- How often (seconds) the app polls the MEXC futures API for live
-- watchlist prices. Stored per user in user_settings so the
-- watchlist page can honor it. Default is 10s, floor of 3s.
-- ============================================================

alter table public.user_settings
  add column if not exists refresh_interval_sec integer not null default 10
  check (refresh_interval_sec >= 3);

-- Backfill existing rows (should already be 10 via default, but be safe).
update public.user_settings
  set refresh_interval_sec = 10
  where refresh_interval_sec is null;
-- ============================================================
-- 005 — Watchlist trigger creation time
-- Records when the price-trigger was set so the user can see, for
-- each saved coin, both when the alert was armed (trigger_created_at)
-- and when it fired (alert_fired_at). trigger_created_at is emptied
-- when the trigger is cleared.
-- ============================================================

alter table public.watchlist_items
  add column if not exists trigger_created_at timestamptz;
-- ============================================================
-- 006 — Watchlist order type
-- Records the order type the user intends to place when a watchlist
-- coin's trigger fires. Options align with MEXC order types:
--   limit         - a standard limit order
--   trigger_limit - a triggered limit order (fires when price crosses)
--   market        - a market order
-- ============================================================

alter table public.watchlist_items
  add column if not exists order_type text
  check (order_type in ('limit','trigger_limit','market'));
-- ============================================================
-- 007 — Notifications
-- User-scoped notifications for trade alerts, risk warnings,
-- system messages, and watchlist triggers.
-- ============================================================

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  type text not null check (type in ('trade_alert','risk_warning','system','watchlist_trigger')),
  title text not null,
  message text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz default now()
);

-- Index for common queries: user's unread notifications, ordered by newest
create index if not exists notifications_user_unread_idx
  on notifications (user_id, read, created_at desc);

-- Index for pagination
create index if not exists notifications_user_created_idx
  on notifications (user_id, created_at desc);

-- ------------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------------
alter table notifications enable row level security;

create policy "notifications_select_own" on notifications
  for select to authenticated using (auth.uid() = user_id);

create policy "notifications_insert_own" on notifications
  for insert to authenticated with check (auth.uid() = user_id);

create policy "notifications_update_own" on notifications
  for update to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "notifications_delete_own" on notifications
  for delete to authenticated using (auth.uid() = user_id);

-- ------------------------------------------------------------------
-- Helper function to create a notification (for server-side use)
-- ------------------------------------------------------------------
create or replace function create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_link text default null
) returns uuid language plpgsql security definer as $$
declare
  v_id uuid;
begin
  insert into notifications (user_id, type, title, message, link)
  values (p_user_id, p_type, p_title, p_message, p_link)
  returning id into v_id;
  return v_id;
end;
$$;
-- ============================================================
-- 008 — Price precision
-- The plan/price columns were numeric(14,4), which made Postgres round
-- values like 0.003326 down to 0.0033 on save. Widen the scale to 7
-- decimals (and raise precision to 18 so large caps still fit).
-- Run in the Supabase SQL editor. Idempotent: safe to re-run.
-- ============================================================

alter table public.watchlist_items
  alter column alert_price type numeric(18,7),
  alter column trigger_price type numeric(18,7),
  alter column entry_price type numeric(18,7),
  alter column stop_loss type numeric(18,7),
  alter column take_profit type numeric(18,7);
-- ============================================================
-- 009 — Trade alerts log
-- Every time a watchlist price-trigger fires, the token data
-- (symbol, trigger, fired price, and the saved trade plan) is
-- logged here and displayed on the /trades page table.
-- Owner-scoped via RLS. Idempotent: safe to re-run.
-- ============================================================

create table if not exists trade_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  -- The watchlist row that fired; kept after the item is deleted.
  watchlist_item_id uuid references public.watchlist_items on delete set null,
  symbol text not null,
  trigger_price numeric(18,7),
  trigger_direction text check (trigger_direction in ('above','below')),
  -- Last price when the alert fired.
  fired_price numeric(18,7),
  -- Saved trade plan at fire time.
  entry_price numeric(18,7),
  stop_loss numeric(18,7),
  take_profit numeric(18,7),
  -- Intended order type when the trigger fired.
  order_type text check (order_type in ('limit','trigger_limit','market')),
  notes text,
  fired_at timestamptz not null default now(),
  created_at timestamptz default now()
);

-- Index for the /trades page: user's fired alerts, newest first.
create index if not exists trade_alerts_user_fired_idx
  on public.trade_alerts (user_id, fired_at desc);

-- ------------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------------
alter table public.trade_alerts enable row level security;

-- Policies are dropped first so this migration is safe to re-run in the
-- Supabase SQL editor (create policy errors if the policy already exists).
drop policy if exists "trade_alerts_select_own" on trade_alerts;
drop policy if exists "trade_alerts_insert_own" on trade_alerts;
drop policy if exists "trade_alerts_update_own" on trade_alerts;
drop policy if exists "trade_alerts_delete_own" on trade_alerts;

create policy "trade_alerts_select_own" on trade_alerts
  for select to authenticated using (auth.uid() = user_id);

create policy "trade_alerts_insert_own" on trade_alerts
  for insert to authenticated with check (auth.uid() = user_id);

create policy "trade_alerts_update_own" on trade_alerts
  for update to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "trade_alerts_delete_own" on trade_alerts
  for delete to authenticated using (auth.uid() = user_id);
-- ============================================================
-- 010 — Trade alert margin & leverage
-- The /trades page sizes a position from its margin and leverage so
-- it can show Position, Unrealized P&L and Margin next to the live
-- MEXC price. Both columns are optional: NULL means "use the page
-- default" ($1 margin, and the contract's max leverage from MEXC),
-- so nothing needs backfilling and "max leverage" stays correct even
-- if the exchange raises a coin's ceiling later.
-- Run in the Supabase SQL editor. Idempotent: safe to re-run.
-- ============================================================

-- Position margin in USD.
alter table public.trade_alerts
  add column if not exists margin_usd numeric(18,2);

-- Leverage used for the position (e.g. 50 = 50x).
alter table public.trade_alerts
  add column if not exists leverage numeric(18,2);
-- ============================================================
-- 011 — Trade alert SL / TP hit tracking
-- A trade plan carries a stop-loss and a take-profit. Once the live
-- price crosses either level we notify the user and log a journal
-- entry — but each level must fire AT MOST ONCE per row, so the
-- crossing isn't re-detected on every poll.
--
-- These two timestamps mirror the existing alert_fired / alert_fired_at
-- pattern on watchlist_items: NULL means "this level has not been hit
-- yet". A level stops firing once its timestamp is set.
--
-- Run in the Supabase SQL editor. Idempotent: safe to re-run.
-- ============================================================

alter table public.trade_alerts
  add column if not exists sl_fired_at timestamptz;

alter table public.trade_alerts
  add column if not exists tp_fired_at timestamptz;
-- ============================================================
-- Migration 012: triggered_watchlist_items
-- Stores fired watchlist tokens shown in the "Triggered" tab.
-- The active watchlist row is deleted on fire; this table is
-- the permanent archive. Each row has a "Move back" action that
-- re-inserts into watchlist_items (with the full plan) and then
-- deletes from this table.
-- ============================================================

create table if not exists triggered_watchlist_items (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        references auth.users not null,
  -- Original watchlist_items id (kept for reference after the row is deleted).
  source_item_id    uuid,
  symbol            text        not null,
  -- Trigger that was set on the watchlist item.
  trigger_price     numeric(18,7),
  trigger_direction text        check (trigger_direction in ('above','below')),
  -- Actual MEXC last price at the moment the trigger fired.
  fired_price       numeric(18,7),
  -- Trade plan values at fire time.
  entry_price       numeric(18,7),
  stop_loss         numeric(18,7),
  take_profit       numeric(18,7),
  order_type        text        check (order_type in ('limit','trigger_limit','market')),
  notes             text,
  fired_at          timestamptz not null default now(),
  created_at        timestamptz          default now()
);

alter table triggered_watchlist_items enable row level security;

create policy "triggered_watchlist_select_own"
  on triggered_watchlist_items for select
  to authenticated using (auth.uid() = user_id);

create policy "triggered_watchlist_insert_own"
  on triggered_watchlist_items for insert
  to authenticated with check (auth.uid() = user_id);

create policy "triggered_watchlist_delete_own"
  on triggered_watchlist_items for delete
  to authenticated using (auth.uid() = user_id);
-- ============================================================
-- Migration 013: archived_watchlist_items
-- Holds soft-deleted items from active Watchlist and Triggered tabs.
-- ============================================================

create table if not exists archived_watchlist_items (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        references auth.users not null,
  symbol            text        not null,
  trigger_price     numeric(18,7),
  trigger_direction text        check (trigger_direction in ('above','below')),
  fired_price       numeric(18,7),
  entry_price       numeric(18,7),
  stop_loss         numeric(18,7),
  take_profit       numeric(18,7),
  order_type        text        check (order_type in ('limit','trigger_limit','market')),
  notes             text,
  archive_source    text        check (archive_source in ('active_deleted','triggered_deleted')) not null default 'active_deleted',
  fired_at          timestamptz,
  archived_at       timestamptz not null default now()
);

alter table archived_watchlist_items enable row level security;

create policy "archived_watchlist_select_own"
  on archived_watchlist_items for select
  to authenticated using (auth.uid() = user_id);

create policy "archived_watchlist_insert_own"
  on archived_watchlist_items for insert
  to authenticated with check (auth.uid() = user_id);

create policy "archived_watchlist_delete_own"
  on archived_watchlist_items for delete
  to authenticated using (auth.uid() = user_id);
-- ============================================================
-- Migration 014: telegram_and_multi_webhooks
-- Add multi-webhook support for Discord and Telegram destinations
-- ============================================================

alter table public.user_settings
  add column if not exists discord_webhooks jsonb default '[]'::jsonb,
  add column if not exists telegram_destinations jsonb default '[]'::jsonb,
  add column if not exists notify_telegram boolean not null default true;

-- Backfill discord_webhooks array from legacy discord_webhook_url column
update public.user_settings
set discord_webhooks = jsonb_build_array(discord_webhook_url)
where discord_webhook_url is not null
  and (discord_webhooks is null or jsonb_array_length(discord_webhooks) = 0);
-- ============================================================
-- Migration 015: Trades Page Overhaul (Status, Manual Close, Archive)
-- Adds status, closed metadata, realized PnL fields to trade_alerts.
-- Creates archived_trade_alerts for soft-deleting trade alerts.
-- ============================================================

-- Add status & closure fields to trade_alerts if they don't exist
alter table public.trade_alerts 
  add column if not exists status text not null default 'active' check (status in ('active', 'closed')),
  add column if not exists closed_reason text check (closed_reason in ('tp_hit', 'sl_hit', 'manual_close')),
  add column if not exists exit_price numeric(18,7),
  add column if not exists closed_at timestamptz,
  add column if not exists close_notes text,
  add column if not exists realized_pnl_usd numeric(18,4),
  add column if not exists realized_pnl_pct numeric(18,4);

-- Table for archived trade alerts (soft-deleted trade alerts)
create table if not exists archived_trade_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  original_trade_alert_id uuid,
  watchlist_item_id uuid,
  symbol text not null,
  trigger_price numeric(18,7),
  trigger_direction text check (trigger_direction in ('above','below')),
  fired_price numeric(18,7),
  entry_price numeric(18,7),
  stop_loss numeric(18,7),
  take_profit numeric(18,7),
  order_type text check (order_type in ('limit','trigger_limit','market')),
  notes text,
  margin_usd numeric(18,4),
  leverage numeric(18,4),
  sl_fired_at timestamptz,
  tp_fired_at timestamptz,
  fired_at timestamptz,
  status_at_archive text not null default 'active' check (status_at_archive in ('active', 'closed')),
  closed_reason text check (closed_reason in ('tp_hit', 'sl_hit', 'manual_close')),
  exit_price numeric(18,7),
  closed_at timestamptz,
  close_notes text,
  realized_pnl_usd numeric(18,4),
  realized_pnl_pct numeric(18,4),
  archived_at timestamptz not null default now()
);

-- Row Level Security for archived_trade_alerts
alter table public.archived_trade_alerts enable row level security;

drop policy if exists "archived_trade_alerts_select_own" on archived_trade_alerts;
drop policy if exists "archived_trade_alerts_insert_own" on archived_trade_alerts;
drop policy if exists "archived_trade_alerts_update_own" on archived_trade_alerts;
drop policy if exists "archived_trade_alerts_delete_own" on archived_trade_alerts;

create policy "archived_trade_alerts_select_own" on archived_trade_alerts
  for select to authenticated using (auth.uid() = user_id);

create policy "archived_trade_alerts_insert_own" on archived_trade_alerts
  for insert to authenticated with check (auth.uid() = user_id);

create policy "archived_trade_alerts_update_own" on archived_trade_alerts
  for update to authenticated using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "archived_trade_alerts_delete_own" on archived_trade_alerts
  for delete to authenticated using (auth.uid() = user_id);
-- Migration 016: Multi-TP Targets & Auto-Breakeven Stop Loss Support
-- Adds TP1, TP2, TP3 targets and Auto-Breakeven flags to watchlist and trades tables.

ALTER TABLE watchlist_items
ADD COLUMN IF NOT EXISTS tp1_price NUMERIC,
ADD COLUMN IF NOT EXISTS tp2_price NUMERIC,
ADD COLUMN IF NOT EXISTS tp3_price NUMERIC,
ADD COLUMN IF NOT EXISTS auto_be_on_tp1 BOOLEAN DEFAULT TRUE;

ALTER TABLE trade_alerts
ADD COLUMN IF NOT EXISTS tp1_price NUMERIC,
ADD COLUMN IF NOT EXISTS tp2_price NUMERIC,
ADD COLUMN IF NOT EXISTS tp3_price NUMERIC,
ADD COLUMN IF NOT EXISTS tp1_hit BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS tp2_hit BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_be_on_tp1 BOOLEAN DEFAULT TRUE;

ALTER TABLE archived_trade_alerts
ADD COLUMN IF NOT EXISTS tp1_price NUMERIC,
ADD COLUMN IF NOT EXISTS tp2_price NUMERIC,
ADD COLUMN IF NOT EXISTS tp3_price NUMERIC,
ADD COLUMN IF NOT EXISTS auto_be_on_tp1 BOOLEAN DEFAULT TRUE;
-- Migration 017: Public Shareable Setup Links
-- Adds share_token and is_public columns to watchlist_items and trade_alerts tables.

ALTER TABLE watchlist_items
ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

ALTER TABLE trade_alerts
ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

ALTER TABLE archived_trade_alerts
ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

-- Create index for fast public lookup
CREATE INDEX IF NOT EXISTS idx_watchlist_items_share_token ON watchlist_items(share_token) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_trade_alerts_share_token ON trade_alerts(share_token) WHERE is_public = TRUE;
-- Migration 018: Dedicated Public Share Links & User Handle/Username

-- 1. Add username to user_settings
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS username text UNIQUE;

-- 2. Create public_share_links table
CREATE TABLE IF NOT EXISTS public_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text NOT NULL,
  share_type text NOT NULL CHECK (share_type IN ('watchlist', 'trade')),
  symbol text NOT NULL,
  watchlist_item_id uuid REFERENCES watchlist_items(id) ON DELETE SET NULL,
  trade_alert_id uuid REFERENCES trade_alerts(id) ON DELETE SET NULL,
  entry_price numeric,
  stop_loss numeric,
  take_profit numeric,
  trigger_direction text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  view_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_user_slug UNIQUE (user_id, slug)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_public_share_links_user_id ON public_share_links(user_id);
CREATE INDEX IF NOT EXISTS idx_public_share_links_user_slug ON public_share_links(user_id, slug);

-- 4. Enable RLS
ALTER TABLE public_share_links ENABLE ROW LEVEL SECURITY;

-- Owner can read, insert, update, delete their own share links
CREATE POLICY "Users can manage their own public share links"
  ON public_share_links FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Unauthenticated/public users can read active share links
CREATE POLICY "Public users can view active share links"
  ON public_share_links FOR SELECT
  USING (is_active = true);
-- Migration 019: Multi-Token Support for Public Share Links

ALTER TABLE public_share_links
  ADD COLUMN IF NOT EXISTS items jsonb NOT NULL DEFAULT '[]'::jsonb;
-- Migration 020: Soft Delete Support for Public Share Links

-- 1. Add deleted_at column
ALTER TABLE public_share_links
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- 2. Drop existing unique constraint if present
ALTER TABLE public_share_links
  DROP CONSTRAINT IF EXISTS unique_user_slug;

-- 3. Create partial unique index on (user_id, slug) for active links
CREATE UNIQUE INDEX IF NOT EXISTS idx_public_share_links_active_slug
  ON public_share_links (user_id, slug)
  WHERE deleted_at IS NULL;

-- 4. Index for filtering active vs deleted items by user
CREATE INDEX IF NOT EXISTS idx_public_share_links_deleted_at
  ON public_share_links (user_id, deleted_at);

-- 5. Update public access RLS policy to ensure soft-deleted links cannot be viewed by public
DROP POLICY IF EXISTS "Public users can view active share links" ON public_share_links;

CREATE POLICY "Public users can view active share links"
  ON public_share_links FOR SELECT
  USING (is_active = true AND deleted_at IS NULL);
-- Migration 021: Public Trader Profile Settings

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS twitter_handle text,
  ADD COLUMN IF NOT EXISTS telegram_channel text,
  ADD COLUMN IF NOT EXISTS is_profile_public boolean NOT NULL DEFAULT true;
-- Migration 022: Web Audio Price Proximity Alarm Settings

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS sound_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS proximity_alarm_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS proximity_threshold_pct numeric NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS alarm_sound_preset text NOT NULL DEFAULT 'radar_ping';
-- Migration 023: Trade Setup Revision History & Timeline Log

CREATE TABLE IF NOT EXISTS setup_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('watchlist', 'trade', 'share')),
  item_id uuid NOT NULL,
  symbol text NOT NULL,
  revision_type text NOT NULL, -- e.g. 'CREATED', 'SL_ADJUSTED', 'SL_BREAKEVEN', 'TP_ADJUSTED', 'NOTE_UPDATED', 'TRIGGER_FIRED'
  title text NOT NULL,
  description text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by item_id & chronological order
CREATE INDEX IF NOT EXISTS idx_setup_revisions_item_id_created 
  ON setup_revisions (item_id, created_at DESC);

-- Enable RLS
ALTER TABLE setup_revisions ENABLE ROW LEVEL SECURITY;

-- Owner policy
CREATE POLICY "Users can manage own setup revisions"
  ON setup_revisions FOR ALL
  USING (auth.uid() = user_id);

-- Public read policy for setup revisions on shared links
CREATE POLICY "Public read setup revisions"
  ON setup_revisions FOR SELECT
  USING (true);
-- Migration 024: TradingView Webhook Integration Secret
-- Adds a unique per-user webhook_secret to user_settings for authenticating external TradingView alerts.

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS webhook_secret TEXT UNIQUE DEFAULT ('tv_sec_' || encode(gen_random_bytes(16), 'hex'));

-- Backfill any existing user_settings rows with a unique secret
UPDATE public.user_settings
SET webhook_secret = ('tv_sec_' || encode(gen_random_bytes(16), 'hex'))
WHERE webhook_secret IS NULL;
-- ============================================================
-- Migration 025: archived_journal_trades
-- Stores soft-deleted trades from the Journal (/journal) table.
-- Allows 1-click restore back to active trades or permanent delete.
-- ============================================================

create table if not exists archived_journal_trades (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references auth.users not null,
  account_id        uuid references accounts on delete set null,
  trade_id          uuid, -- Original trade id before archiving
  symbol            text not null,
  direction         text check (direction in ('long','short')),
  entry_price       numeric(18,7) not null,
  exit_price        numeric(18,7),
  size              numeric(18,7) not null,
  stop_price        numeric(18,7),
  fees              numeric(18,7) default 0,
  entry_time        timestamptz not null,
  exit_time         timestamptz,
  status            text check (status in ('open','closed')),
  pnl_dollars       numeric(18,7),
  pnl_pct           numeric(18,7),
  r_multiple        numeric(18,7),
  tags              jsonb default '[]'::jsonb,
  notes             jsonb,
  archived_at       timestamptz not null default now(),
  created_at        timestamptz default now()
);

alter table archived_journal_trades enable row level security;

create policy "archived_journal_select_own"
  on archived_journal_trades for select
  to authenticated using (auth.uid() = user_id);

create policy "archived_journal_insert_own"
  on archived_journal_trades for insert
  to authenticated with check (auth.uid() = user_id);

create policy "archived_journal_delete_own"
  on archived_journal_trades for delete
  to authenticated using (auth.uid() = user_id);
-- Migration: 026_google_drive_storage.sql
-- Add Google Drive credentials and screenshot storage settings to user_settings

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS google_drive_connected boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS google_drive_email text,
ADD COLUMN IF NOT EXISTS google_drive_refresh_token text,
ADD COLUMN IF NOT EXISTS screenshot_storage_backend text DEFAULT 'auto';
-- Migration: 027_app_settings.sql
-- Table for global application-level settings (e.g. site-wide Google Drive bucket token)

CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read app_settings (e.g. storage status)
DROP POLICY IF EXISTS "Allow authenticated read app_settings" ON public.app_settings;
CREATE POLICY "Allow authenticated read app_settings" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

-- Allow service role full access
DROP POLICY IF EXISTS "Allow service role all app_settings" ON public.app_settings;
CREATE POLICY "Allow service role all app_settings" ON public.app_settings
  FOR ALL TO service_role USING (true);
-- Migration: 028_admin_dashboard.sql
-- Add is_admin column to user_settings and create system_announcements table

ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Grant admin rights to user 'ymatt'
UPDATE public.user_settings
SET is_admin = true
WHERE username = 'ymatt' OR user_id = '8704a735-585f-4d7c-9427-b47326988034';

-- System-wide Broadcast Announcements
CREATE TABLE IF NOT EXISTS public.system_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'info', -- 'info', 'warning', 'success', 'announcement'
  link_url text,
  link_text text,
  is_active boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_announcements ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read active announcements
DROP POLICY IF EXISTS "Allow read active announcements" ON public.system_announcements;
CREATE POLICY "Allow read active announcements" ON public.system_announcements
  FOR SELECT TO authenticated USING (true);

-- Allow service role full access
DROP POLICY IF EXISTS "Allow service role all announcements" ON public.system_announcements;
CREATE POLICY "Allow service role all announcements" ON public.system_announcements
  FOR ALL TO service_role USING (true);
-- Migration 029: Multi-screenshot support for Watchlist and Trades
-- Adds screenshot_urls (text array) and screenshot_url (text fallback) to watchlist tables and trades

-- 1. Active Watchlist Items
ALTER TABLE public.watchlist_items
ADD COLUMN IF NOT EXISTS screenshot_urls text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS screenshot_url text;

-- 2. Triggered Watchlist Items
ALTER TABLE public.triggered_watchlist_items
ADD COLUMN IF NOT EXISTS screenshot_urls text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS screenshot_url text;

-- 3. Archived Watchlist Items
ALTER TABLE public.archived_watchlist_items
ADD COLUMN IF NOT EXISTS screenshot_urls text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS screenshot_url text;

-- 4. Trade Notes (Journal)
ALTER TABLE public.trade_notes
ADD COLUMN IF NOT EXISTS screenshot_urls text[] DEFAULT '{}';

-- 5. Trade Alerts
ALTER TABLE public.trade_alerts
ADD COLUMN IF NOT EXISTS screenshot_urls text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS screenshot_url text;

-- Create GIN index on screenshot_urls for fast query/existence checks where needed
CREATE INDEX IF NOT EXISTS idx_watchlist_items_has_screenshots 
ON public.watchlist_items USING gin(screenshot_urls);
-- Create admin_tracked_wallets table
create table if not exists public.admin_tracked_wallets (
    id uuid default gen_random_uuid() primary key,
    admin_id uuid not null references auth.users(id) on delete cascade,
    wallet_address text not null,
    label text,
    notes text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS policies
alter table public.admin_tracked_wallets enable row level security;

create policy "Admins can view their tracked wallets"
    on public.admin_tracked_wallets for select
    using (auth.uid() = admin_id);

create policy "Admins can insert tracked wallets"
    on public.admin_tracked_wallets for insert
    with check (auth.uid() = admin_id);

create policy "Admins can update their tracked wallets"
    on public.admin_tracked_wallets for update
    using (auth.uid() = admin_id);

create policy "Admins can delete their tracked wallets"
    on public.admin_tracked_wallets for delete
    using (auth.uid() = admin_id);

-- Create index for faster querying
create index if not exists admin_tracked_wallets_admin_id_idx on public.admin_tracked_wallets (admin_id);
create unique index if not exists admin_tracked_wallets_admin_id_wallet_address_idx on public.admin_tracked_wallets (admin_id, wallet_address);
-- 1. Create admin_tracked_tokens table
create table if not exists public.admin_tracked_tokens (
    id uuid default gen_random_uuid() primary key,
    admin_id uuid not null references auth.users(id) on delete cascade,
    symbol text not null,
    alert_enabled boolean default true not null,
    min_usd_threshold numeric default 10000 not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for admin_tracked_tokens
alter table public.admin_tracked_tokens enable row level security;

create policy "Admins can view their tracked tokens"
    on public.admin_tracked_tokens for select
    using (auth.uid() = admin_id);

create policy "Admins can insert tracked tokens"
    on public.admin_tracked_tokens for insert
    with check (auth.uid() = admin_id);

create policy "Admins can update their tracked tokens"
    on public.admin_tracked_tokens for update
    using (auth.uid() = admin_id);

create policy "Admins can delete their tracked tokens"
    on public.admin_tracked_tokens for delete
    using (auth.uid() = admin_id);

create unique index if not exists admin_tracked_tokens_admin_id_symbol_idx on public.admin_tracked_tokens (admin_id, symbol);


-- 2. Modify admin_tracked_wallets to add alert config
alter table public.admin_tracked_wallets
    add column if not exists alert_enabled boolean default true not null,
    add column if not exists min_usd_threshold numeric default 5000 not null;
-- ============================================================
-- 032 — Add leverage to journal trades and archived journal trades
-- Supports persisting the leverage configured on the /trades page
-- or entered in the journal trade form, factoring into Return on
-- Margin (ROE %) calculations across the trade ledger, detail modal,
-- analytics, and spreadsheet export.
-- Run in the Supabase SQL editor. Idempotent: safe to re-run.
-- ============================================================

-- Leverage applied to the journal trade (e.g. 20 = 20x).
alter table public.trades
  add column if not exists leverage numeric(18,2);

-- Leverage in the archived journal trades archive table.
alter table public.archived_journal_trades
  add column if not exists leverage numeric(18,2);
