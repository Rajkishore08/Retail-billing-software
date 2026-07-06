-- ============================================================
-- Migration 28: Product History & Audit Tracking
-- Run this in Supabase SQL Editor AFTER migration 27
-- ============================================================

-- ── 1. Add soft-delete to products ───────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- ── 2. Create product_history table ──────────────────────────
CREATE TABLE IF NOT EXISTS product_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (
    action_type IN ('CREATED','UPDATED','DELETED','STOCK_UPDATED','PRICE_UPDATED','GST_UPDATED','IMAGE_UPDATED','BARCODE_UPDATED')
  ),
  changed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  changed_by_name TEXT,
  previous_values JSONB,
  new_values JSONB,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ── 3. Indexes for fast querying ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_product_history_product_id ON product_history(product_id);
CREATE INDEX IF NOT EXISTS idx_product_history_changed_by ON product_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_product_history_created_at ON product_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_history_action_type ON product_history(action_type);

-- ── 4. RLS for product_history ────────────────────────────────
ALTER TABLE product_history ENABLE ROW LEVEL SECURITY;

-- Admin & Manager can read all history
DROP POLICY IF EXISTS "Admin manager read product history" ON product_history;
CREATE POLICY "Admin manager read product history"
  ON product_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'manager')
    )
  );

-- All authenticated can insert (service will handle this)
DROP POLICY IF EXISTS "Authenticated insert product history" ON product_history;
CREATE POLICY "Authenticated insert product history"
  ON product_history FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- NOBODY can update or delete history (immutable audit log)
-- (No UPDATE or DELETE policies means those operations are blocked by RLS)

-- ── 5. Trigger function to auto-log product changes ──────────
CREATE OR REPLACE FUNCTION log_product_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_action_type TEXT;
  v_changed_by UUID;
  v_changed_by_name TEXT;
  v_prev JSONB;
  v_next JSONB;
BEGIN
  -- Determine the changed_by user from current session
  BEGIN
    v_changed_by := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_changed_by := NULL;
  END;

  -- Get user name
  IF v_changed_by IS NOT NULL THEN
    SELECT full_name INTO v_changed_by_name
    FROM profiles WHERE id = v_changed_by;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action_type := 'CREATED';
    v_prev := NULL;
    v_next := to_jsonb(NEW);

  ELSIF TG_OP = 'DELETE' THEN
    v_action_type := 'DELETED';
    v_prev := to_jsonb(OLD);
    v_next := NULL;

  ELSIF TG_OP = 'UPDATE' THEN
    v_prev := to_jsonb(OLD);
    v_next := to_jsonb(NEW);

    -- Determine specific action type based on what changed
    IF OLD.stock_quantity IS DISTINCT FROM NEW.stock_quantity
       AND OLD.price = NEW.price
       AND (OLD.gst_rate = NEW.gst_rate OR NEW.gst_rate IS NULL) THEN
      v_action_type := 'STOCK_UPDATED';
    ELSIF OLD.price IS DISTINCT FROM NEW.price
          OR OLD.selling_price IS DISTINCT FROM NEW.selling_price
          OR OLD.mrp IS DISTINCT FROM NEW.mrp
          OR OLD.cost_price IS DISTINCT FROM NEW.cost_price THEN
      v_action_type := 'PRICE_UPDATED';
    ELSIF OLD.gst_rate IS DISTINCT FROM NEW.gst_rate THEN
      v_action_type := 'GST_UPDATED';
    ELSIF OLD.barcode IS DISTINCT FROM NEW.barcode THEN
      v_action_type := 'BARCODE_UPDATED';
    ELSIF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
      v_action_type := 'DELETED';
    ELSE
      v_action_type := 'UPDATED';
    END IF;
  END IF;

  INSERT INTO product_history (
    product_id,
    product_name,
    action_type,
    changed_by,
    changed_by_name,
    previous_values,
    new_values
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.name, OLD.name),
    v_action_type,
    v_changed_by,
    v_changed_by_name,
    v_prev,
    v_next
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 6. Attach trigger to products table ──────────────────────
DROP TRIGGER IF EXISTS trg_log_product_changes ON products;
CREATE TRIGGER trg_log_product_changes
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION log_product_changes();

-- ── 7. RPC function to get product history with filters ──────
CREATE OR REPLACE FUNCTION get_product_history(
  p_product_id UUID DEFAULT NULL,
  p_changed_by UUID DEFAULT NULL,
  p_action_type TEXT DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  product_id UUID,
  product_name TEXT,
  action_type TEXT,
  changed_by UUID,
  changed_by_name TEXT,
  previous_values JSONB,
  new_values JSONB,
  remarks TEXT,
  created_at TIMESTAMPTZ,
  total_count BIGINT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    ph.id,
    ph.product_id,
    ph.product_name,
    ph.action_type,
    ph.changed_by,
    ph.changed_by_name,
    ph.previous_values,
    ph.new_values,
    ph.remarks,
    ph.created_at,
    COUNT(*) OVER() AS total_count
  FROM product_history ph
  WHERE
    (p_product_id IS NULL OR ph.product_id = p_product_id)
    AND (p_changed_by IS NULL OR ph.changed_by = p_changed_by)
    AND (p_action_type IS NULL OR ph.action_type = p_action_type)
    AND (p_start_date IS NULL OR ph.created_at >= p_start_date)
    AND (p_end_date IS NULL OR ph.created_at <= p_end_date)
    AND (p_search IS NULL OR
         ph.product_name ILIKE '%' || p_search || '%' OR
         ph.changed_by_name ILIKE '%' || p_search || '%')
  ORDER BY ph.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- ── 8. RPC for dashboard: recent product changes ──────────────
CREATE OR REPLACE FUNCTION get_recent_product_changes(p_limit INT DEFAULT 5)
RETURNS TABLE (
  product_name TEXT,
  action_type TEXT,
  changed_by_name TEXT,
  created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT ph.product_name, ph.action_type, ph.changed_by_name, ph.created_at
  FROM product_history ph
  ORDER BY ph.created_at DESC
  LIMIT p_limit;
END;
$$;

-- ── 9. RPC for dashboard: most modified products ──────────────
CREATE OR REPLACE FUNCTION get_most_modified_products(p_limit INT DEFAULT 5)
RETURNS TABLE (
  product_name TEXT,
  change_count BIGINT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT ph.product_name, COUNT(*) AS change_count
  FROM product_history ph
  GROUP BY ph.product_name
  ORDER BY change_count DESC
  LIMIT p_limit;
END;
$$;

-- ── 10. RPC for dashboard: top modifiers ─────────────────────
CREATE OR REPLACE FUNCTION get_top_product_modifiers(p_limit INT DEFAULT 5)
RETURNS TABLE (
  changed_by_name TEXT,
  change_count BIGINT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT ph.changed_by_name, COUNT(*) AS change_count
  FROM product_history ph
  WHERE ph.changed_by_name IS NOT NULL
  GROUP BY ph.changed_by_name
  ORDER BY change_count DESC
  LIMIT p_limit;
END;
$$;
