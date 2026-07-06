-- SQL Migration Script: Database Performance Indices & RPC Optimizations
-- Run this script in the Supabase SQL editor to implement index optimizations and high-performance RPC functions.

-- 1. Create Index Optimizations on Products
CREATE INDEX IF NOT EXISTS idx_products_barcode_opt ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_name_opt ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_stock_quantity_opt ON products(stock_quantity);

-- 2. Create Index Optimizations on Customers
CREATE INDEX IF NOT EXISTS idx_customers_phone_opt ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email_opt ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_name_opt ON customers(name);

-- 3. Create Index Optimizations on Transactions
CREATE INDEX IF NOT EXISTS idx_transactions_created_at_opt ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id_opt ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date_status_opt ON transactions(created_at, status);

-- 4. Create Index Optimizations on Transaction Items
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction_id_opt ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_product_id_opt ON transaction_items(product_id);

-- 5. Optimized Dashboard Stats RPC Function
-- This function aggregates all dashboard KPI metrics in a single database call, avoiding separate count queries and fetching multiple transaction rows on the client.
DROP FUNCTION IF EXISTS public.get_dashboard_stats_optimized() CASCADE;
CREATE OR REPLACE FUNCTION public.get_dashboard_stats_optimized()
RETURNS TABLE (
  total_products bigint,
  total_customers bigint,
  monthly_revenue numeric,
  total_transactions_today bigint,
  total_sales_today numeric,
  total_savings_today numeric,
  unique_customers_today bigint,
  avg_transaction_value_today numeric,
  low_stock_products_count bigint
) AS $$
DECLARE
  start_of_month timestamp with time zone;
  end_of_month timestamp with time zone;
BEGIN
  start_of_month := date_trunc('month', CURRENT_DATE);
  end_of_month := start_of_month + interval '1 month' - interval '1 second';

  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM products)::bigint,
    (SELECT COUNT(*) FROM customers)::bigint,
    (SELECT COALESCE(SUM(total_amount), 0)::numeric FROM transactions WHERE created_at >= start_of_month AND created_at <= end_of_month AND status = 'completed'),
    (SELECT COUNT(*)::bigint FROM transactions WHERE created_at::date = CURRENT_DATE AND status = 'completed'),
    (SELECT COALESCE(SUM(total_amount), 0)::numeric FROM transactions WHERE created_at::date = CURRENT_DATE AND status = 'completed'),
    (SELECT COALESCE(SUM(total_savings), 0)::numeric FROM transactions WHERE created_at::date = CURRENT_DATE AND status = 'completed'),
    (SELECT COUNT(DISTINCT customer_id)::bigint FROM transactions WHERE created_at::date = CURRENT_DATE AND status = 'completed'),
    (SELECT CASE WHEN COUNT(id) > 0 THEN COALESCE(SUM(total_amount), 0)::numeric / COUNT(id) ELSE 0 END FROM transactions WHERE created_at::date = CURRENT_DATE AND status = 'completed'),
    (SELECT COUNT(*)::bigint FROM products WHERE stock_quantity <= min_stock_level);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats_optimized() TO authenticated, anon, service_role;

-- 6. Optimized Sales Analytics RPC Function
DROP FUNCTION IF EXISTS public.get_sales_analytics_optimized(date, date) CASCADE;
CREATE OR REPLACE FUNCTION public.get_sales_analytics_optimized(
  start_date date,
  end_date date
)
RETURNS TABLE (
  date_label text,
  total_sales numeric,
  total_transactions bigint,
  total_savings numeric,
  avg_transaction_value numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TO_CHAR(t.created_at::date, 'YYYY-MM-DD') as date_label,
    COALESCE(SUM(t.total_amount), 0)::numeric as total_sales,
    COUNT(t.id)::bigint as total_transactions,
    COALESCE(SUM(t.total_savings), 0)::numeric as total_savings,
    COALESCE(AVG(t.total_amount), 0)::numeric as avg_transaction_value
  FROM transactions t
  WHERE t.created_at::date BETWEEN start_date AND end_date
    AND t.status = 'completed'
  GROUP BY t.created_at::date
  ORDER BY t.created_at::date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_sales_analytics_optimized(date, date) TO authenticated, anon, service_role;

-- 7. Optimized Daily Sales Trend RPC Function
DROP FUNCTION IF EXISTS public.get_daily_sales_trend_optimized(integer) CASCADE;
CREATE OR REPLACE FUNCTION public.get_daily_sales_trend_optimized(days_back integer DEFAULT 30)
RETURNS TABLE (
  date_label text,
  sales_amount numeric,
  transaction_count bigint,
  savings_amount numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TO_CHAR(date_series.date, 'YYYY-MM-DD') as date_label,
    COALESCE(SUM(t.total_amount), 0)::numeric as sales_amount,
    COUNT(t.id)::bigint as transaction_count,
    COALESCE(SUM(t.total_savings), 0)::numeric as savings_amount
  FROM (
    SELECT generate_series(
      CURRENT_DATE - (days_back || ' days')::interval,
      CURRENT_DATE,
      '1 day'::interval
    )::date as date
  ) date_series
  LEFT JOIN transactions t ON t.created_at::date = date_series.date AND t.status = 'completed'
  GROUP BY date_series.date
  ORDER BY date_series.date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_daily_sales_trend_optimized(integer) TO authenticated, anon, service_role;

-- 8. Optimized Top Selling Products RPC Function
DROP FUNCTION IF EXISTS public.get_top_selling_products_optimized(integer) CASCADE;
CREATE OR REPLACE FUNCTION public.get_top_selling_products_optimized(limit_count integer DEFAULT 10)
RETURNS TABLE (
  product_name text,
  total_quantity bigint,
  total_revenue numeric,
  avg_price numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ti.product_name,
    SUM(ti.quantity)::bigint as total_quantity,
    COALESCE(SUM(ti.total_price), 0)::numeric as total_revenue,
    COALESCE(AVG(ti.unit_price), 0)::numeric as avg_price
  FROM transaction_items ti
  JOIN transactions t ON ti.transaction_id = t.id
  WHERE t.status = 'completed'
    AND t.created_at >= CURRENT_DATE - interval '30 days'
  GROUP BY ti.product_name
  ORDER BY total_quantity DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_top_selling_products_optimized(integer) TO authenticated, anon, service_role;

-- 9. Optimized Low Stock Products RPC Function
DROP FUNCTION IF EXISTS public.get_low_stock_products_optimized() CASCADE;
CREATE OR REPLACE FUNCTION public.get_low_stock_products_optimized()
RETURNS TABLE (
  id uuid,
  name text,
  stock_quantity integer,
  min_stock_level integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name::text,
    p.stock_quantity,
    p.min_stock_level
  FROM products p
  WHERE p.stock_quantity <= p.min_stock_level
  ORDER BY p.stock_quantity ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_low_stock_products_optimized() TO authenticated, anon, service_role;
