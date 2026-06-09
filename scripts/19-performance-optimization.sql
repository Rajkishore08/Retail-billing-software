-- Performance optimization for National Mini Mart POS System

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_brand_name ON products(brand, name);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_cashier_id ON transactions(cashier_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_product_id ON transaction_items(product_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_products_stock_brand ON products(stock_quantity, brand);
CREATE INDEX IF NOT EXISTS idx_transactions_date_status ON transactions(created_at, status);
CREATE INDEX IF NOT EXISTS idx_transaction_items_quantity ON transaction_items(quantity, total_price);

-- Create partial indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_in_stock ON products(id, name, price, stock_quantity) 
WHERE stock_quantity > 0;

CREATE INDEX IF NOT EXISTS idx_transactions_completed ON transactions(id, total_amount, created_at) 
WHERE status = 'completed';

-- Create function for optimized product search
CREATE OR REPLACE FUNCTION search_products_optimized(search_term TEXT)
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
    AND (
      p.name ILIKE '%' || search_term || '%'
      OR p.barcode ILIKE '%' || search_term || '%'
      OR p.brand ILIKE '%' || search_term || '%'
      OR p.hsn_code ILIKE '%' || search_term || '%'
    )
  ORDER BY 
    CASE 
      WHEN p.name ILIKE search_term || '%' THEN 1
      WHEN p.barcode = search_term THEN 2
      WHEN p.name ILIKE '%' || search_term || '%' THEN 3
      ELSE 4
    END,
    p.brand,
    p.name
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- Create function for optimized dashboard stats
CREATE OR REPLACE FUNCTION get_dashboard_stats_optimized()
RETURNS TABLE (
  total_sales_today DECIMAL(10,2),
  total_transactions_today INTEGER,
  total_savings_today DECIMAL(10,2),
  unique_customers_today INTEGER,
  avg_transaction_value_today DECIMAL(10,2),
  low_stock_products_count INTEGER,
  total_products INTEGER,
  total_customers INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(t.total_amount), 0) as total_sales_today,
    COUNT(t.id) as total_transactions_today,
    COALESCE(SUM(t.total_savings), 0) as total_savings_today,
    COUNT(DISTINCT t.customer_id) as unique_customers_today,
    CASE 
      WHEN COUNT(t.id) > 0 THEN COALESCE(SUM(t.total_amount), 0) / COUNT(t.id)
      ELSE 0 
    END as avg_transaction_value_today,
    (SELECT COUNT(*) FROM products WHERE stock_quantity <= min_stock_level) as low_stock_products_count,
    (SELECT COUNT(*) FROM products) as total_products,
    (SELECT COUNT(*) FROM customers) as total_customers
  FROM transactions t
  WHERE t.created_at::DATE = CURRENT_DATE
    AND t.status = 'completed';
END;
$$ LANGUAGE plpgsql;

-- Create function for optimized recent transactions
CREATE OR REPLACE FUNCTION get_recent_transactions_optimized(limit_count INTEGER DEFAULT 20)
RETURNS TABLE (
  id UUID,
  invoice_number TEXT,
  customer_name TEXT,
  total_amount DECIMAL(10,2),
  payment_method TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  item_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.invoice_number,
    t.customer_name,
    t.total_amount,
    t.payment_method::TEXT,
    t.created_at,
    COUNT(ti.id) as item_count
  FROM transactions t
  LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
  WHERE t.status = 'completed'
  GROUP BY t.id, t.invoice_number, t.customer_name, t.total_amount, t.payment_method, t.created_at
  ORDER BY t.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Create materialized view for frequently accessed data
CREATE MATERIALIZED VIEW IF NOT EXISTS product_summary AS
SELECT 
  p.id,
  p.name,
  p.price,
  p.cost_price,
  p.mrp,
  p.selling_price,
  p.stock_quantity,
  p.brand,
  p.hsn_code,
  p.barcode,
  COALESCE(p.mrp - p.price, 0) as savings_amount,
  CASE 
    WHEN p.mrp > 0 AND p.price > 0 THEN ((p.mrp - p.price) / p.mrp * 100)
    ELSE 0 
  END as savings_percentage
FROM products p
WHERE p.stock_quantity > 0;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_product_summary_brand ON product_summary(brand);
CREATE INDEX IF NOT EXISTS idx_product_summary_savings ON product_summary(savings_amount);

-- Create function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_materialized_views()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW dashboard_stats;
  REFRESH MATERIALIZED VIEW product_summary;
END;
$$ LANGUAGE plpgsql;

-- Create function for bulk product operations
CREATE OR REPLACE FUNCTION bulk_update_product_prices(
  product_ids UUID[],
  new_prices DECIMAL(10,2)[]
)
RETURNS INTEGER AS $$
DECLARE
  i INTEGER;
  updated_count INTEGER := 0;
BEGIN
  FOR i IN 1..array_length(product_ids, 1) LOOP
    UPDATE products 
    SET 
      price = new_prices[i],
      updated_at = NOW()
    WHERE id = product_ids[i];
    
    IF FOUND THEN
      updated_count := updated_count + 1;
    END IF;
  END LOOP;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Create function for inventory alerts
CREATE OR REPLACE FUNCTION get_low_stock_alerts()
RETURNS TABLE (
  product_id UUID,
  product_name TEXT,
  current_stock INTEGER,
  min_stock_level INTEGER,
  days_until_out_of_stock INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as product_id,
    p.name as product_name,
    p.stock_quantity as current_stock,
    p.min_stock_level,
    CASE 
      WHEN p.stock_quantity > 0 THEN 
        GREATEST(1, p.stock_quantity / GREATEST(1, 
          (SELECT AVG(ti.quantity) 
           FROM transaction_items ti 
           JOIN transactions t ON ti.transaction_id = t.id 
           WHERE ti.product_id = p.id 
             AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'
             AND t.status = 'completed')
        ))
      ELSE 0 
    END as days_until_out_of_stock
  FROM products p
  WHERE p.stock_quantity <= p.min_stock_level
  ORDER BY p.stock_quantity ASC;
END;
$$ LANGUAGE plpgsql;

-- Create function for sales performance analysis
CREATE OR REPLACE FUNCTION get_sales_performance_analysis(
  start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  metric_name TEXT,
  metric_value DECIMAL(10,2),
  percentage_change DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  WITH current_period AS (
    SELECT 
      SUM(total_amount) as total_sales,
      COUNT(*) as transaction_count,
      AVG(total_amount) as avg_transaction_value,
      SUM(total_savings) as total_savings
    FROM transactions 
    WHERE created_at::DATE BETWEEN start_date AND end_date
      AND status = 'completed'
  ),
  previous_period AS (
    SELECT 
      SUM(total_amount) as total_sales,
      COUNT(*) as transaction_count,
      AVG(total_amount) as avg_transaction_value,
      SUM(total_savings) as total_savings
    FROM transactions 
    WHERE created_at::DATE BETWEEN start_date - INTERVAL '30 days' AND end_date - INTERVAL '30 days'
      AND status = 'completed'
  )
  SELECT 
    'Total Sales'::TEXT,
    cp.total_sales,
    CASE 
      WHEN pp.total_sales > 0 THEN ((cp.total_sales - pp.total_sales) / pp.total_sales * 100)
      ELSE 0 
    END
  FROM current_period cp, previous_period pp
  UNION ALL
  SELECT 
    'Transaction Count'::TEXT,
    cp.transaction_count::DECIMAL(10,2),
    CASE 
      WHEN pp.transaction_count > 0 THEN ((cp.transaction_count - pp.transaction_count)::DECIMAL / pp.transaction_count * 100)
      ELSE 0 
    END
  FROM current_period cp, previous_period pp
  UNION ALL
  SELECT 
    'Average Transaction Value'::TEXT,
    cp.avg_transaction_value,
    CASE 
      WHEN pp.avg_transaction_value > 0 THEN ((cp.avg_transaction_value - pp.avg_transaction_value) / pp.avg_transaction_value * 100)
      ELSE 0 
    END
  FROM current_period cp, previous_period pp
  UNION ALL
  SELECT 
    'Total Savings'::TEXT,
    cp.total_savings,
    CASE 
      WHEN pp.total_savings > 0 THEN ((cp.total_savings - pp.total_savings) / pp.total_savings * 100)
      ELSE 0 
    END
  FROM current_period cp, previous_period pp;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions for optimized functions
GRANT EXECUTE ON FUNCTION search_products_optimized(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dashboard_stats_optimized() TO authenticated;
GRANT EXECUTE ON FUNCTION get_recent_transactions_optimized(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_materialized_views() TO authenticated;
GRANT EXECUTE ON FUNCTION bulk_update_product_prices(UUID[], DECIMAL(10,2)[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_low_stock_alerts() TO authenticated;
GRANT EXECUTE ON FUNCTION get_sales_performance_analysis(DATE, DATE) TO authenticated;
GRANT SELECT ON product_summary TO authenticated;

-- Create trigger to automatically refresh materialized views
CREATE OR REPLACE FUNCTION trigger_refresh_materialized_views()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM refresh_materialized_views();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic refresh
CREATE TRIGGER refresh_views_after_transaction
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_materialized_views();

CREATE TRIGGER refresh_views_after_product
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_materialized_views();

-- Insert performance settings
INSERT INTO settings (key, value) VALUES
('enable_caching', 'true'),
('cache_duration_minutes', '5'),
('enable_optimized_queries', 'true'),
('auto_refresh_interval_seconds', '300')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value; 