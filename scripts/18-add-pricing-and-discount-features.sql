-- Add pricing and discount features to the POS system

-- Add new pricing fields to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS mrp DECIMAL(10,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS selling_price DECIMAL(10,2);

-- Update existing products to have default values
UPDATE products SET 
  cost_price = price * 0.7,  -- Assume 30% margin
  mrp = price * 1.2,         -- Assume 20% markup on price
  selling_price = price       -- Current price becomes selling price
WHERE cost_price IS NULL OR mrp IS NULL OR selling_price IS NULL;

-- Add discount fields to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS total_savings DECIMAL(10,2) DEFAULT 0;

-- Add discount fields to transaction_items table
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS item_discount_amount DECIMAL(10,2) DEFAULT 0;
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS item_discount_percentage DECIMAL(5,2) DEFAULT 0;
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2);
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS mrp DECIMAL(10,2);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_cost_price ON products(cost_price);
CREATE INDEX IF NOT EXISTS idx_products_mrp ON products(mrp);
CREATE INDEX IF NOT EXISTS idx_products_selling_price ON products(selling_price);
CREATE INDEX IF NOT EXISTS idx_transactions_discount ON transactions(discount_amount);
CREATE INDEX IF NOT EXISTS idx_transaction_items_discount ON transaction_items(item_discount_amount);

-- Update the get_products_with_stock function to include new fields
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
  gst_rate DECIMAL(5,2),
  price_includes_gst BOOLEAN,
  hsn_code VARCHAR(10),
  brand VARCHAR(100),
  barcode TEXT,
  created_at TIMESTAMP WITH TIME ZONE
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
    p.gst_rate,
    p.price_includes_gst,
    p.hsn_code,
    p.brand,
    p.barcode,
    p.created_at
  FROM products p
  WHERE p.stock_quantity > 0
  ORDER BY p.brand, p.name;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate savings for a product
CREATE OR REPLACE FUNCTION calculate_product_savings(product_id UUID)
RETURNS TABLE (
  savings_amount DECIMAL(10,2),
  savings_percentage DECIMAL(5,2)
) AS $$
DECLARE
  product_record RECORD;
BEGIN
  SELECT mrp, selling_price INTO product_record
  FROM products
  WHERE id = product_id;
  
  IF product_record.mrp IS NULL OR product_record.selling_price IS NULL THEN
    RETURN QUERY SELECT 0::DECIMAL(10,2), 0::DECIMAL(5,2);
    RETURN;
  END IF;
  
  RETURN QUERY 
  SELECT 
    (product_record.mrp - product_record.selling_price)::DECIMAL(10,2),
    CASE 
      WHEN product_record.mrp > 0 THEN 
        ((product_record.mrp - product_record.selling_price) / product_record.mrp * 100)::DECIMAL(5,2)
      ELSE 0::DECIMAL(5,2)
    END;
END;
$$ LANGUAGE plpgsql;

-- Create function to get sales analytics with charts data
CREATE OR REPLACE FUNCTION get_sales_analytics(
  start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  date_label TEXT,
  total_sales DECIMAL(10,2),
  total_transactions INTEGER,
  total_savings DECIMAL(10,2),
  avg_transaction_value DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TO_CHAR(t.created_at::DATE, 'YYYY-MM-DD') as date_label,
    COALESCE(SUM(t.total_amount), 0) as total_sales,
    COUNT(t.id) as total_transactions,
    COALESCE(SUM(t.total_savings), 0) as total_savings,
    CASE 
      WHEN COUNT(t.id) > 0 THEN COALESCE(SUM(t.total_amount), 0) / COUNT(t.id)
      ELSE 0 
    END as avg_transaction_value
  FROM transactions t
  WHERE t.created_at::DATE BETWEEN start_date AND end_date
    AND t.status = 'completed'
  GROUP BY t.created_at::DATE
  ORDER BY t.created_at::DATE;
END;
$$ LANGUAGE plpgsql;

-- Create function to get top selling products
CREATE OR REPLACE FUNCTION get_top_selling_products(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  product_name TEXT,
  total_quantity INTEGER,
  total_revenue DECIMAL(10,2),
  avg_price DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ti.product_name,
    SUM(ti.quantity) as total_quantity,
    SUM(ti.total_price) as total_revenue,
    AVG(ti.unit_price) as avg_price
  FROM transaction_items ti
  JOIN transactions t ON ti.transaction_id = t.id
  WHERE t.status = 'completed'
    AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY ti.product_name
  ORDER BY total_quantity DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get sales by category
CREATE OR REPLACE FUNCTION get_sales_by_category()
RETURNS TABLE (
  category_name TEXT,
  total_sales DECIMAL(10,2),
  total_items INTEGER,
  avg_price DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(c.name, 'Uncategorized') as category_name,
    SUM(ti.total_price) as total_sales,
    SUM(ti.quantity) as total_items,
    AVG(ti.unit_price) as avg_price
  FROM transaction_items ti
  JOIN transactions t ON ti.transaction_id = t.id
  JOIN products p ON ti.product_id = p.id
  LEFT JOIN categories c ON p.category_id = c.id
  WHERE t.status = 'completed'
    AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY c.name
  ORDER BY total_sales DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to get daily sales trend
CREATE OR REPLACE FUNCTION get_daily_sales_trend(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  date_label TEXT,
  sales_amount DECIMAL(10,2),
  transaction_count INTEGER,
  savings_amount DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TO_CHAR(date_series.date, 'YYYY-MM-DD') as date_label,
    COALESCE(SUM(t.total_amount), 0) as sales_amount,
    COUNT(t.id) as transaction_count,
    COALESCE(SUM(t.total_savings), 0) as savings_amount
  FROM (
    SELECT generate_series(
      CURRENT_DATE - (days_back || ' days')::INTERVAL,
      CURRENT_DATE,
      '1 day'::INTERVAL
    )::DATE as date
  ) date_series
  LEFT JOIN transactions t ON t.created_at::DATE = date_series.date
    AND t.status = 'completed'
  GROUP BY date_series.date
  ORDER BY date_series.date;
END;
$$ LANGUAGE plpgsql;

-- Drop existing materialized view and index if they exist
DROP MATERIALIZED VIEW IF EXISTS dashboard_stats CASCADE;

-- Create materialized view for dashboard performance optimization
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

-- Create index on the materialized view
CREATE INDEX idx_dashboard_stats ON dashboard_stats(total_transactions_today);

-- Create function to refresh dashboard stats
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW dashboard_stats;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_products_with_stock() TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_product_savings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sales_analytics(DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_top_selling_products(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_sales_by_category() TO authenticated;
GRANT EXECUTE ON FUNCTION get_daily_sales_trend(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_dashboard_stats() TO authenticated;
GRANT SELECT ON dashboard_stats TO authenticated;

-- Refresh the materialized view to include the new total_savings column
REFRESH MATERIALIZED VIEW dashboard_stats;

-- Insert default settings for discount features
INSERT INTO settings (key, value) VALUES
('enable_discounts', 'true'),
('default_discount_percentage', '0'),
('show_savings_on_receipt', 'true'),
('enable_mrp_display', 'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value; 