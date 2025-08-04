-- Performance Optimization Script
-- This script adds indexes and optimizes database queries for better performance

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock_quantity);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_hsn_code ON products(hsn_code);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

-- Transaction indexes
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_cashier ON transactions(cashier_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice ON transactions(invoice_number);

-- Transaction items indexes
CREATE INDEX IF NOT EXISTS idx_transaction_items_product ON transaction_items(product_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction ON transaction_items(transaction_id);

-- Customer indexes
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- Loyalty indexes
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer ON loyalty_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_transaction ON loyalty_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_date ON loyalty_transactions(created_at);

-- Stock movements indexes
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);

-- Settings indexes
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- Analyze tables for better query planning
ANALYZE products;
ANALYZE transactions;
ANALYZE transaction_items;
ANALYZE customers;
ANALYZE loyalty_transactions;
ANALYZE stock_movements;
ANALYZE settings;

-- Create a function to refresh dashboard stats efficiently
CREATE OR REPLACE FUNCTION refresh_dashboard_stats_efficient()
RETURNS void AS $$
BEGIN
  -- Refresh materialized view with better performance
  REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_stats;
  
  -- Update statistics
  ANALYZE dashboard_stats;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION refresh_dashboard_stats_efficient() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_dashboard_stats_efficient() TO anon;

-- Create a function to get products with optimized query
CREATE OR REPLACE FUNCTION get_products_optimized()
RETURNS TABLE (
  id UUID,
  name TEXT,
  price DECIMAL(10,2),
  cost_price DECIMAL(10,2),
  mrp DECIMAL(10,2),
  selling_price DECIMAL(10,2),
  stock_quantity INTEGER,
  min_stock_level INTEGER,
  gst_rate INTEGER,
  price_includes_gst BOOLEAN,
  hsn_code TEXT,
  brand TEXT,
  barcode TEXT
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
    p.barcode
  FROM products p
  WHERE p.stock_quantity > 0
  ORDER BY p.name;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_products_optimized() TO authenticated;
GRANT EXECUTE ON FUNCTION get_products_optimized() TO anon;

-- Success message
SELECT 'Performance optimization completed successfully!' as message; 