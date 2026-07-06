-- ============================================================
-- Migration 29: Dashboard history RPCs + soft-delete columns
-- Apply in Supabase SQL Editor
-- ============================================================

-- ── 1. Add soft-delete column to products if it doesn't exist ─────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Filter soft-deleted rows in all existing product queries:
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products (deleted_at)
  WHERE deleted_at IS NULL;

-- ── 2. RPC: get_recent_product_changes ────────────────────────────────────────
-- Drop first to allow changing the return type signature
DROP FUNCTION IF EXISTS get_recent_product_changes(INT);

CREATE OR REPLACE FUNCTION get_recent_product_changes(p_limit INT DEFAULT 5)
RETURNS TABLE (
  id            UUID,
  product_name  TEXT,
  action_type   TEXT,
  changed_by_name TEXT,
  created_at    TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    ph.id,
    ph.product_name,
    ph.action_type,
    ph.changed_by_name,
    ph.created_at
  FROM product_history ph
  ORDER BY ph.created_at DESC
  LIMIT p_limit;
$$;

-- ── 3. RPC: get_top_product_modifiers ─────────────────────────────────────────
-- Drop first to allow changing the return type signature
DROP FUNCTION IF EXISTS get_top_product_modifiers(INT);

CREATE OR REPLACE FUNCTION get_top_product_modifiers(p_limit INT DEFAULT 3)
RETURNS TABLE (
  changed_by      UUID,
  changed_by_name TEXT,
  change_count    BIGINT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    ph.changed_by,
    ph.changed_by_name,
    COUNT(*)::BIGINT AS change_count
  FROM product_history ph
  WHERE ph.changed_by IS NOT NULL
  GROUP BY ph.changed_by, ph.changed_by_name
  ORDER BY change_count DESC
  LIMIT p_limit;
$$;

-- ── 4. Grant execute permissions ───────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION get_recent_product_changes(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_product_modifiers(INT) TO authenticated;

-- ── 5. Grant execute on existing history RPC (if not done in 28) ──────────────
GRANT EXECUTE ON FUNCTION get_product_history(UUID, UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, INT, INT) TO authenticated;

-- ── 6. Ensure product_history is in roles_permissions for all roles ───────────
-- This uses the actual schema from script 27: role_name TEXT, module_name TEXT
INSERT INTO roles_permissions (role_name, module_name, can_view, can_create, can_update, can_delete)
VALUES
  ('admin',   'product_history', TRUE,  TRUE,  TRUE,  TRUE),
  ('manager', 'product_history', TRUE,  FALSE, FALSE, FALSE),
  ('cashier', 'product_history', FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role_name, module_name) DO UPDATE
  SET
    can_view   = EXCLUDED.can_view,
    can_create = EXCLUDED.can_create,
    can_update = EXCLUDED.can_update,
    can_delete = EXCLUDED.can_delete;
