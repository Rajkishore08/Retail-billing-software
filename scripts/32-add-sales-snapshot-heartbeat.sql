-- ============================================================
-- Migration 32: Weekly sales snapshot / keep-alive heartbeat
-- Apply in Supabase SQL Editor
--
-- Purpose: a scheduled route (app/api/cron/keep-alive) writes one row
-- here every 7 days. It is a SEPARATE table from `transactions` — it
-- never touches real sales data, it just records a point-in-time
-- snapshot of the dashboard totals. The write itself is what matters:
-- Supabase free-tier projects auto-pause after 7 days with no activity,
-- and a paused project is what caused the app to hang on load forever
-- (see contexts/auth-context.tsx timeout fix). A weekly write keeps the
-- project active so that never happens again.
-- ============================================================

CREATE TABLE IF NOT EXISTS sales_snapshots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_products        BIGINT NOT NULL DEFAULT 0,
  total_customers       BIGINT NOT NULL DEFAULT 0,
  monthly_revenue       NUMERIC NOT NULL DEFAULT 0,
  total_transactions_today NUMERIC NOT NULL DEFAULT 0,
  total_sales_today     NUMERIC NOT NULL DEFAULT 0,
  note                  TEXT NOT NULL DEFAULT 'weekly keep-alive snapshot'
);

CREATE INDEX IF NOT EXISTS idx_sales_snapshots_snapshot_at ON sales_snapshots (snapshot_at DESC);

-- Locked down: only the server-side service-role client (used by the
-- cron route) can read/write. No anon/authenticated policies are
-- defined, so RLS denies all client-side access by default.
ALTER TABLE sales_snapshots ENABLE ROW LEVEL SECURITY;

-- Keep only the last 26 snapshots (~6 months of weekly pings) so this
-- table never grows unbounded.
CREATE OR REPLACE FUNCTION public.prune_sales_snapshots()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM sales_snapshots
  WHERE id NOT IN (
    SELECT id FROM sales_snapshots ORDER BY snapshot_at DESC LIMIT 26
  );
$$;

GRANT EXECUTE ON FUNCTION public.prune_sales_snapshots() TO service_role;
