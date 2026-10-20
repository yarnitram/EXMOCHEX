-- ==============================================================================
-- Migration 033: Enable Supabase Realtime & High-Performance Indexes
-- ==============================================================================

-- 1. Enable Realtime Change Data Capture (CDC) for core tables
ALTER PUBLICATION supabase_realtime ADD TABLE watchlist_items;
ALTER PUBLICATION supabase_realtime ADD TABLE trade_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE triggered_watchlist_items;

-- 2. Optimize Replica Identity so full row payloads are pushed over WebSockets
ALTER TABLE watchlist_items REPLICA IDENTITY FULL;
ALTER TABLE trade_alerts REPLICA IDENTITY FULL;
ALTER TABLE notifications REPLICA IDENTITY FULL;
ALTER TABLE triggered_watchlist_items REPLICA IDENTITY FULL;

-- 3. Composite and Partial Performance Indexes for Sub-Millisecond Queries
CREATE INDEX IF NOT EXISTS idx_watchlist_active 
  ON watchlist_items(user_id, symbol) 
  WHERE alert_fired = false;

CREATE INDEX IF NOT EXISTS idx_trade_alerts_active 
  ON trade_alerts(user_id, symbol) 
  WHERE sl_fired_at IS NULL OR tp_fired_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_unread 
  ON notifications(user_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_triggered_watchlist_user_fired 
  ON triggered_watchlist_items(user_id, fired_at DESC);
