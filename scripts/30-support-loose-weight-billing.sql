-- SQL Migration to support weight-based billing (e.g., 1.200 kg)
-- Paste this script into the Supabase SQL Editor and click Run.

-- 1. Drop dependent materialized view and functions first
DROP MATERIALIZED VIEW IF EXISTS public.dashboard_stats CASCADE;
DROP FUNCTION IF EXISTS public.refresh_dashboard_stats() CASCADE;
DROP FUNCTION IF EXISTS public.refresh_dashboard_stats_efficient() CASCADE;

-- 2. Alter quantity columns to support decimal values (three decimal places)
ALTER TABLE products ALTER COLUMN stock_quantity TYPE DECIMAL(10,3);
ALTER TABLE transaction_items ALTER COLUMN quantity TYPE DECIMAL(10,3);
ALTER TABLE stock_movements ALTER COLUMN quantity TYPE DECIMAL(10,3);

-- 3. Add sale_unit column to products table to specify 'pcs', 'kg', 'g', etc.
ALTER TABLE products ADD COLUMN IF NOT EXISTS sale_unit VARCHAR(10) DEFAULT 'pcs';

-- 4. Recreate materialized view for dashboard performance optimization
CREATE MATERIALIZED VIEW public.dashboard_stats AS
SELECT 
  (SELECT COUNT(*) FROM public.products) as total_products,
  (SELECT COUNT(*) FROM public.products WHERE stock_quantity <= min_stock_level) as low_stock_items,
  (SELECT COALESCE(SUM(stock_quantity), 0) FROM public.products) as total_stock_units,
  (SELECT COUNT(*) FROM public.transactions WHERE DATE(created_at) = CURRENT_DATE) as total_transactions_today,
  (SELECT COALESCE(SUM(total_amount), 0) FROM public.transactions WHERE DATE(created_at) = CURRENT_DATE) as total_sales_today,
  (SELECT COALESCE(SUM(total_savings), 0) FROM public.transactions WHERE DATE(created_at) = CURRENT_DATE) as total_savings_today,
  (SELECT COUNT(*) FROM public.customers) as total_customers,
  (SELECT COALESCE(SUM(loyalty_points), 0) FROM public.customers) as total_loyalty_points
WITH DATA;

-- 5. Recreate functions to refresh stats
CREATE OR REPLACE FUNCTION public.refresh_dashboard_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.dashboard_stats;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_dashboard_stats_efficient()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.dashboard_stats;
  ANALYZE public.dashboard_stats;
END;
$$;

-- 6. Re-grant permissions
GRANT SELECT ON public.dashboard_stats TO authenticated;
GRANT SELECT ON public.dashboard_stats TO anon;
GRANT EXECUTE ON FUNCTION public.refresh_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_dashboard_stats_efficient() TO authenticated;

-- 7. Add loose weight-based supermarket products for testing
INSERT INTO products (name, price, cost_price, mrp, selling_price, stock_quantity, min_stock_level, gst_rate, hsn_code, brand, barcode, sale_unit)
VALUES
('Loose Basmati Rice Premium (1kg)', 90, 70, 100, 90, 500.000, 20.000, 5, '100601', 'Generic', 'LOOSE-RICE-01', 'kg'),
('Loose Toor Dal (1kg)', 150, 120, 165, 150, 300.000, 15.000, 5, '071301', 'Generic', 'LOOSE-DAL-01', 'kg'),
('Loose Sugar (1kg)', 44, 34, 48, 44, 400.000, 25.000, 5, '170101', 'Generic', 'LOOSE-SUGAR-01', 'kg'),
('Fresh Onions (1kg)', 35, 25, 40, 35, 200.000, 10.000, 0, '070301', 'Local Farm', 'FRESH-ONION-01', 'kg'),
('Fresh Potatoes (1kg)', 30, 22, 35, 30, 250.000, 10.000, 0, '070101', 'Local Farm', 'FRESH-POTATO-01', 'kg')
ON CONFLICT (hsn_code) DO NOTHING;

-- 8. Refresh view
SELECT public.refresh_dashboard_stats();
