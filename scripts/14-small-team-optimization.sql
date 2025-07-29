-- Small Team Optimization for 3 Active Users
-- Maximum Performance, No Downtime, No Rate Limiting

-- Note: ALTER SYSTEM commands removed as they cannot run inside transaction blocks
-- These settings should be configured at the database server level by your DBA
-- ALTER SYSTEM SET max_connections = 50; -- More than enough for 3 users
-- ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
-- ALTER SYSTEM SET track_activity_query_size = 2048;

-- 1. Create high-performance indexes for POS operations
-- Note: Removed CONCURRENTLY as it cannot run inside transaction blocks
CREATE INDEX IF NOT EXISTS idx_products_barcode_active ON products(barcode) WHERE stock_quantity > 0;
CREATE INDEX IF NOT EXISTS idx_products_name_brand ON products(name, brand) WHERE stock_quantity > 0;
-- Note: bill_number column doesn't exist, removing this index
-- CREATE INDEX IF NOT EXISTS idx_transactions_bill_number_status ON transactions(bill_number, status);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_phone ON transactions(customer_phone);
CREATE INDEX IF NOT EXISTS idx_customers_phone_active ON customers(phone) WHERE loyalty_points > 0;

-- 2. Create composite indexes for fast POS queries
CREATE INDEX IF NOT EXISTS idx_products_pos_query ON products(name, price, stock_quantity, brand) WHERE stock_quantity > 0;
-- Note: Removing this index as it uses non-immutable functions in predicate
-- CREATE INDEX IF NOT EXISTS idx_transactions_pos_query ON transactions(created_at, status, total_amount) WHERE status = 'completed';

-- 3. Create materialized views for instant dashboard data
CREATE MATERIALIZED VIEW IF NOT EXISTS pos_dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM products WHERE stock_quantity > 0) as active_products,
  (SELECT COUNT(*) FROM customers) as total_customers,
  (SELECT COUNT(*) FROM transactions WHERE created_at >= CURRENT_DATE) as today_transactions,
  COALESCE(SUM(total_amount), 0) as today_sales
FROM transactions
WHERE created_at >= CURRENT_DATE AND status = 'completed';

-- 4. Create fast lookup functions for POS
CREATE OR REPLACE FUNCTION public.get_product_by_barcode(barcode_input text)
RETURNS TABLE(
  id uuid,
  name text,
  price numeric,
  stock_quantity integer,
  gst_rate numeric,
  price_includes_gst boolean,
  brand text,
  hsn_code text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.price,
    p.stock_quantity,
    p.gst_rate,
    p.price_includes_gst,
    p.brand,
    p.hsn_code
  FROM products p
  WHERE p.barcode = barcode_input AND p.stock_quantity > 0
  LIMIT 1;
END;
$$;

-- 5. Create fast customer lookup
CREATE OR REPLACE FUNCTION public.get_customer_by_phone(phone_input text)
RETURNS TABLE(
  id uuid,
  name text,
  phone text,
  loyalty_points integer,
  total_spent numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.phone,
    c.loyalty_points,
    c.total_spent
  FROM customers c
  WHERE c.phone = phone_input
  LIMIT 1;
END;
$$;

-- 6. Create fast transaction processing
CREATE OR REPLACE FUNCTION public.process_transaction(
  transaction_data jsonb,
  items_data jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  transaction_id uuid;
  item_record jsonb;
BEGIN
  -- Insert transaction
  INSERT INTO transactions (
    invoice_number,
    -- Note: bill_number column doesn't exist, removing from insert
    -- bill_number,
    customer_id,
    customer_name,
    customer_phone,
    subtotal,
    gst_amount,
    total_amount,
    payment_method,
    cash_received,
    change_amount,
    status,
    loyalty_points_earned,
    loyalty_points_redeemed,
    loyalty_discount_amount,
    rounding_adjustment,
    cashier_id
  )
  SELECT
    (transaction_data->>'invoice_number')::text,
    -- (transaction_data->>'bill_number')::text,
    (transaction_data->>'customer_id')::uuid,
    (transaction_data->>'customer_name')::text,
    (transaction_data->>'customer_phone')::text,
    (transaction_data->>'subtotal')::numeric,
    (transaction_data->>'gst_amount')::numeric,
    (transaction_data->>'total_amount')::numeric,
    (transaction_data->>'payment_method')::text,
    (transaction_data->>'cash_received')::numeric,
    (transaction_data->>'change_amount')::numeric,
    (transaction_data->>'status')::text,
    (transaction_data->>'loyalty_points_earned')::integer,
    (transaction_data->>'loyalty_points_redeemed')::integer,
    (transaction_data->>'loyalty_discount_amount')::numeric,
    (transaction_data->>'rounding_adjustment')::numeric,
    (transaction_data->>'cashier_id')::uuid
  RETURNING id INTO transaction_id;

  -- Insert transaction items
  FOR item_record IN SELECT * FROM jsonb_array_elements(items_data)
  LOOP
    INSERT INTO transaction_items (
      transaction_id,
      product_name,
      quantity,
      unit_price,
      total_price,
      gst_rate,
      price_includes_gst
    )
    VALUES (
      transaction_id,
      (item_record->>'product_name')::text,
      (item_record->>'quantity')::integer,
      (item_record->>'unit_price')::numeric,
      (item_record->>'total_price')::numeric,
      (item_record->>'gst_rate')::numeric,
      (item_record->>'price_includes_gst')::boolean
    );
  END LOOP;

  RETURN transaction_id;
END;
$$;

-- 7. Create fast stock update function
CREATE OR REPLACE FUNCTION public.update_product_stock(
  product_id_input uuid,
  quantity_change integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE products
  SET stock_quantity = stock_quantity + quantity_change
  WHERE id = product_id_input;

  RETURN FOUND;
END;
$$;

-- 8. Create instant dashboard refresh function
CREATE OR REPLACE FUNCTION public.refresh_dashboard_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW pos_dashboard_stats;
END;
$$;

-- 9. Create performance monitoring for small team
CREATE OR REPLACE FUNCTION public.get_system_performance()
RETURNS TABLE(
  active_connections integer,
  cache_hit_ratio numeric,
  db_size text,
  slow_queries integer,
  uptime interval
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
    (SELECT round(100.0 * sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)), 2) FROM pg_statio_user_tables) as cache_hit_ratio,
    (SELECT pg_size_pretty(pg_database_size(current_database()))) as db_size,
    (SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND query_start < now() - interval '5 seconds') as slow_queries,
    (SELECT now() - pg_postmaster_start_time()) as uptime;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_product_by_barcode(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_customer_by_phone(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_transaction(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_product_stock(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_system_performance() TO authenticated;
GRANT SELECT ON pos_dashboard_stats TO authenticated;

-- Create trigger to auto-refresh dashboard stats
CREATE OR REPLACE FUNCTION public.auto_refresh_dashboard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Refresh dashboard stats after transaction changes
  IF TG_TABLE_NAME = 'transactions' THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY pos_dashboard_stats;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS auto_refresh_dashboard_trigger ON transactions;
CREATE TRIGGER auto_refresh_dashboard_trigger
  AFTER INSERT OR UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION auto_refresh_dashboard();

-- Optimize table statistics for small team
ANALYZE products;
ANALYZE customers;
ANALYZE transactions;
ANALYZE transaction_items;

-- Set up monitoring for small team
CREATE OR REPLACE VIEW public.performance_monitor AS
SELECT
  'Active Connections' as metric,
  count(*)::text as value
FROM pg_stat_activity
WHERE state = 'active'
UNION ALL
SELECT
  'Database Size' as metric,
  pg_size_pretty(pg_database_size(current_database())) as value
UNION ALL
SELECT
  'Cache Hit Ratio' as metric,
  round(100.0 * sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)), 2)::text || '%' as value
FROM pg_statio_user_tables;

GRANT SELECT ON public.performance_monitor TO authenticated; 