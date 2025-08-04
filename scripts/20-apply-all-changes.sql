-- =====================================================
-- COMPREHENSIVE DATABASE UPDATE SCRIPT
-- Run this in your Supabase SQL Editor to apply all changes
-- =====================================================

-- 1. Add new columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS mrp DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_price DECIMAL(10,2);

-- 2. Add new columns to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS total_savings DECIMAL(10,2) DEFAULT 0;

-- 3. Add new columns to transaction_items table
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS item_discount_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS item_discount_percentage DECIMAL(5,2) DEFAULT 0;
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2);
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS mrp DECIMAL(10,2);

-- 4. Update get_products_with_stock function to include new pricing fields
DROP FUNCTION IF EXISTS get_products_with_stock();
CREATE OR REPLACE FUNCTION get_products_with_stock()
RETURNS TABLE (
  id UUID,
  name TEXT,
  price DECIMAL(10,2),
  cost_price DECIMAL(10,2),
  mrp DECIMAL(10,2),
  selling_price DECIMAL(10,2),
  stock_quantity INTEGER,
  min_stock_level INTEGER,
  gst_rate DECIMAL(5,2),
  price_includes_gst BOOLEAN,
  hsn_code TEXT,
  brand TEXT,
  barcode TEXT,
  category_id UUID,
  category_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.price,
    p.cost_price,
    p.mrp,
    p.selling_price,
    p.stock_quantity,
    p.min_stock_level,
    p.gst_rate,
    p.price_includes_gst,
    p.hsn_code,
    p.brand,
    p.barcode,
    c.id as category_id,
    c.name as category_name,
    p.created_at,
    p.updated_at
  FROM products p
  LEFT JOIN categories c ON p.category_id = c.id
  WHERE p.stock_quantity > 0
  ORDER BY p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create function to calculate product savings
DROP FUNCTION IF EXISTS calculate_product_savings(UUID);
CREATE OR REPLACE FUNCTION calculate_product_savings(product_id UUID)
RETURNS TABLE (
  savings_amount DECIMAL(10,2),
  savings_percentage DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(p.mrp - p.price, 0) as savings_amount,
    CASE 
      WHEN p.mrp > 0 AND p.mrp > p.price 
      THEN ((p.mrp - p.price) / p.mrp * 100)
      ELSE 0 
    END as savings_percentage
  FROM products p
  WHERE p.id = product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create sales analytics function
DROP FUNCTION IF EXISTS get_sales_analytics(DATE, DATE);
CREATE OR REPLACE FUNCTION get_sales_analytics(
  start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  date_label TEXT,
  total_sales DECIMAL(12,2),
  total_transactions BIGINT,
  total_savings DECIMAL(12,2),
  avg_transaction_value DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TO_CHAR(t.created_at::DATE, 'YYYY-MM-DD') as date_label,
    COALESCE(SUM(t.total_amount), 0) as total_sales,
    COUNT(t.id)::BIGINT as total_transactions,
    COALESCE(SUM(t.total_savings), 0) as total_savings,
    COALESCE(AVG(t.total_amount), 0) as avg_transaction_value
  FROM transactions t
  WHERE t.created_at::DATE BETWEEN start_date AND end_date
    AND t.status = 'completed'
  GROUP BY t.created_at::DATE
  ORDER BY t.created_at::DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create top selling products function
DROP FUNCTION IF EXISTS get_top_selling_products(INTEGER);
CREATE OR REPLACE FUNCTION get_top_selling_products(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  product_name TEXT,
  total_quantity BIGINT,
  total_revenue DECIMAL(12,2),
  avg_price DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ti.product_name,
    SUM(ti.quantity)::BIGINT as total_quantity,
    COALESCE(SUM(ti.total_price), 0) as total_revenue,
    COALESCE(AVG(ti.unit_price), 0) as avg_price
  FROM transaction_items ti
  JOIN transactions t ON ti.transaction_id = t.id
  WHERE t.status = 'completed'
    AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY ti.product_name
  ORDER BY total_quantity DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Create sales by category function
DROP FUNCTION IF EXISTS get_sales_by_category();
CREATE OR REPLACE FUNCTION get_sales_by_category()
RETURNS TABLE (
  category_name TEXT,
  total_sales DECIMAL(12,2),
  total_items BIGINT,
  avg_price DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(c.name, 'Uncategorized') as category_name,
    COALESCE(SUM(ti.total_price), 0) as total_sales,
    SUM(ti.quantity)::BIGINT as total_items,
    COALESCE(AVG(ti.unit_price), 0) as avg_price
  FROM transaction_items ti
  JOIN transactions t ON ti.transaction_id = t.id
  LEFT JOIN products p ON ti.product_name = p.name
  LEFT JOIN categories c ON p.category_id = c.id
  WHERE t.status = 'completed'
    AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY c.name
  ORDER BY total_sales DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create daily sales trend function
DROP FUNCTION IF EXISTS get_daily_sales_trend(INTEGER);
CREATE OR REPLACE FUNCTION get_daily_sales_trend(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  date_label TEXT,
  sales_amount DECIMAL(12,2),
  transaction_count BIGINT,
  savings_amount DECIMAL(12,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TO_CHAR(date_series.date, 'YYYY-MM-DD') as date_label,
    COALESCE(SUM(t.total_amount), 0) as sales_amount,
    COUNT(t.id)::BIGINT as transaction_count,
    COALESCE(SUM(t.total_savings), 0) as savings_amount
  FROM (
    SELECT generate_series(
      CURRENT_DATE - (days_back || ' days')::INTERVAL,
      CURRENT_DATE,
      '1 day'::INTERVAL
    )::DATE as date
  ) date_series
  LEFT JOIN transactions t ON t.created_at::DATE = date_series.date AND t.status = 'completed'
  GROUP BY date_series.date
  ORDER BY date_series.date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Drop existing materialized view if it exists
DROP MATERIALIZED VIEW IF EXISTS dashboard_stats CASCADE;

-- 11. Create materialized view for dashboard performance optimization
CREATE MATERIALIZED VIEW dashboard_stats AS
SELECT
  COUNT(DISTINCT t.id) as total_transactions_today,
  COALESCE(SUM(t.total_amount), 0) as total_sales_today,
  COALESCE(SUM(t.total_savings), 0) as total_savings_today,
  COUNT(DISTINCT t.customer_id) as unique_customers_today,
  AVG(t.total_amount) as avg_transaction_value_today
FROM transactions t
WHERE t.created_at::DATE = CURRENT_DATE
  AND t.status = 'completed';

-- 12. Create index on the materialized view
CREATE INDEX idx_dashboard_stats ON dashboard_stats(total_transactions_today);

-- 13. Create function to refresh dashboard stats
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW dashboard_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Grant permissions
GRANT EXECUTE ON FUNCTION get_sales_analytics(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_selling_products(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sales_by_category() TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_sales_trend(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_product_savings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_dashboard_stats() TO authenticated;
GRANT SELECT ON dashboard_stats TO authenticated;

-- 15. Add default settings for discount features
INSERT INTO settings (key, value) 
VALUES 
  ('enable_discounts', 'true'),
  ('max_discount_percentage', '50'),
  ('show_savings_on_receipt', 'true')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value;

-- 16. Refresh the materialized view
REFRESH MATERIALIZED VIEW dashboard_stats;

-- Success message
SELECT 'Database update completed successfully! All new features are now available.' as status; 