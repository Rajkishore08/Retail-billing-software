-- Performance Optimization for Billing Website
-- Run this after the security fixes script

-- 1. Add critical indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
-- Note: bill_number column doesn't exist, removing this index
-- CREATE INDEX IF NOT EXISTS idx_transactions_bill_number ON transactions(bill_number);

CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock_quantity);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_loyalty ON customers(loyalty_points);

CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_product_name ON transaction_items(product_name);

-- 2. Add composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_transactions_date_status ON transactions(created_at, status);
CREATE INDEX IF NOT EXISTS idx_products_stock_brand ON products(stock_quantity, brand);

-- 3. Add partial indexes for active data (removing problematic ones)
CREATE INDEX IF NOT EXISTS idx_products_active ON products(id) WHERE stock_quantity > 0;
-- Note: Removing this index as it uses CURRENT_DATE which is not immutable
-- CREATE INDEX IF NOT EXISTS idx_transactions_recent ON transactions(created_at) WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

-- 4. Optimize table statistics
ANALYZE transactions;
ANALYZE products;
ANALYZE customers;
ANALYZE transaction_items;

-- 5. Create materialized view for dashboard stats (optional)
CREATE MATERIALIZED VIEW IF NOT EXISTS dashboard_stats AS
SELECT 
  (SELECT COUNT(*) FROM products) as total_products,
  (SELECT COUNT(*) FROM customers) as total_customers,
  COALESCE(SUM(total_amount), 0) as monthly_revenue
FROM transactions 
WHERE created_at >= date_trunc('month', CURRENT_DATE)
  AND status = 'completed';

-- Refresh materialized view (run this periodically)
-- REFRESH MATERIALIZED VIEW dashboard_stats;

-- 6. Add connection monitoring function
CREATE OR REPLACE FUNCTION public.get_db_stats()
RETURNS TABLE(
  active_connections integer,
  total_transactions bigint,
  total_products bigint,
  total_customers bigint,
  db_size text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT count(*) FROM pg_stat_activity) as active_connections,
    (SELECT count(*) FROM transactions) as total_transactions,
    (SELECT count(*) FROM products) as total_products,
    (SELECT count(*) FROM customers) as total_customers,
    (SELECT pg_size_pretty(pg_database_size(current_database()))) as db_size;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_db_stats() TO authenticated;
GRANT SELECT ON dashboard_stats TO authenticated; 