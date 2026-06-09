-- Performance optimization functions and indexes

-- Create function to get dashboard stats in a single query
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE (
  total_products BIGINT,
  total_customers BIGINT,
  monthly_revenue DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM products) as total_products,
    (SELECT COUNT(*) FROM customers) as total_customers,
    COALESCE(
      (SELECT SUM(total_amount) 
       FROM transactions 
       WHERE status = 'completed' 
       AND created_at >= date_trunc('month', CURRENT_DATE)
       AND created_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'), 
      0
    ) as monthly_revenue;
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_products_stock_quantity ON products(stock_quantity);
CREATE INDEX IF NOT EXISTS idx_customers_loyalty_points ON customers(loyalty_points);
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id ON transaction_items(transaction_id);

-- Create function to get customer with loyalty points
CREATE OR REPLACE FUNCTION get_customer_with_loyalty(customer_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  phone TEXT,
  email TEXT,
  loyalty_points INTEGER,
  total_spent DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.phone,
    c.email,
    c.loyalty_points,
    c.total_spent,
    c.created_at
  FROM customers c
  WHERE c.id = customer_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to get products with stock
CREATE OR REPLACE FUNCTION get_products_with_stock()
RETURNS TABLE (
  id UUID,
  name TEXT,
  price DECIMAL(10,2),
  stock_quantity INTEGER,
  gst_rate DECIMAL(5,2),
  price_includes_gst BOOLEAN,
  barcode TEXT,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.price,
    p.stock_quantity,
    p.gst_rate,
    p.price_includes_gst,
    p.barcode,
    p.created_at
  FROM products p
  WHERE p.stock_quantity > 0
  ORDER BY p.name;
END;
$$ LANGUAGE plpgsql;

-- Create function to get last bill number
CREATE OR REPLACE FUNCTION get_last_bill_number()
RETURNS TEXT AS $$
DECLARE
  last_number TEXT;
BEGIN
  SELECT invoice_number INTO last_number
  FROM transactions
  WHERE invoice_number LIKE 'NM %'
  ORDER BY invoice_number DESC
  LIMIT 1;
  
  RETURN COALESCE(last_number, 'NM 0000');
END;
$$ LANGUAGE plpgsql;

-- Enable query result caching for frequently accessed data
ALTER TABLE products SET (fillfactor = 90);
ALTER TABLE customers SET (fillfactor = 90);
ALTER TABLE transactions SET (fillfactor = 90);

-- Create materialized view for dashboard stats (optional for very large datasets)
-- CREATE MATERIALIZED VIEW dashboard_stats AS
-- SELECT 
--   (SELECT COUNT(*) FROM products) as total_products,
--   (SELECT COUNT(*) FROM customers) as total_customers,
--   COALESCE(
--     (SELECT SUM(total_amount) 
--      FROM transactions 
--      WHERE status = 'completed' 
--      AND created_at >= date_trunc('month', CURRENT_DATE)
--      AND created_at < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'), 
--     0
--   ) as monthly_revenue;

-- Refresh materialized view every hour (uncomment if using materialized view)
-- CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
-- RETURNS void AS $$
-- BEGIN
--   REFRESH MATERIALIZED VIEW dashboard_stats;
-- END;
-- $$ LANGUAGE plpgsql;

-- Create a cron job to refresh materialized view (if using)
-- SELECT cron.schedule('refresh-dashboard-stats', '0 * * * *', 'SELECT refresh_dashboard_stats();'); 