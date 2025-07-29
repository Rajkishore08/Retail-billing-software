-- Fix Supabase Security Warnings
-- This script addresses all the function_search_path_mutable warnings

-- 1. Fix get_dashboard_stats function
DROP FUNCTION IF EXISTS public.get_dashboard_stats();
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS TABLE(
  total_products bigint,
  total_customers bigint,
  monthly_revenue numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*) FROM products),
    (SELECT COUNT(*) FROM customers),
    COALESCE(
      (SELECT SUM(total_amount) 
       FROM transactions 
       WHERE created_at >= date_trunc('month', CURRENT_DATE)
       AND status = 'completed'), 
      0
    );
END;
$$;

-- 2. Fix get_customer_with_loyalty function
DROP FUNCTION IF EXISTS public.get_customer_with_loyalty(phone text);
CREATE OR REPLACE FUNCTION public.get_customer_with_loyalty(phone text)
RETURNS TABLE(
  id uuid,
  name text,
  phone text,
  email text,
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
    c.email,
    c.loyalty_points,
    c.total_spent
  FROM customers c
  WHERE c.phone = get_customer_with_loyalty.phone;
END;
$$;

-- 3. Fix get_last_bill_number function
-- Note: bill_number column doesn't exist in transactions table, commenting out this function
-- DROP FUNCTION IF EXISTS public.get_last_bill_number();
-- CREATE OR REPLACE FUNCTION public.get_last_bill_number()
-- RETURNS text
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path = public
-- AS $$
-- DECLARE
--   last_number text;
-- BEGIN
--   SELECT bill_number 
--   INTO last_number
--   FROM transactions 
--   WHERE bill_number LIKE 'NM %'
--   ORDER BY created_at DESC 
--   LIMIT 1;
--   
--   RETURN COALESCE(last_number, 'NM 0000');
-- END;
-- $$;

-- 4. Fix get_products_with_stock function
DROP FUNCTION IF EXISTS public.get_products_with_stock();
CREATE OR REPLACE FUNCTION public.get_products_with_stock()
RETURNS TABLE(
  id uuid,
  name text,
  price numeric,
  stock_quantity integer,
  gst_rate numeric,
  price_includes_gst boolean,
  hsn_code text,
  brand text,
  barcode text,
  created_at timestamptz,
  updated_at timestamptz
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
    p.hsn_code,
    p.brand,
    p.barcode,
    p.created_at,
    p.updated_at
  FROM products p
  WHERE p.stock_quantity > 0
  ORDER BY p.name;
END;
$$;

-- 5. Fix get_products_by_brand function
DROP FUNCTION IF EXISTS public.get_products_by_brand(brand_name text);
CREATE OR REPLACE FUNCTION public.get_products_by_brand(brand_name text)
RETURNS TABLE(
  id uuid,
  name text,
  price numeric,
  stock_quantity integer,
  gst_rate numeric,
  price_includes_gst boolean,
  hsn_code text,
  brand text,
  barcode text
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
    p.hsn_code,
    p.brand,
    p.barcode
  FROM products p
  WHERE p.brand = get_products_by_brand.brand_name
  ORDER BY p.name;
END;
$$;

-- 6. Fix get_unique_brands function
DROP FUNCTION IF EXISTS public.get_unique_brands();
CREATE OR REPLACE FUNCTION public.get_unique_brands()
RETURNS TABLE(brand text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.brand
  FROM products p
  WHERE p.brand IS NOT NULL AND p.brand != ''
  ORDER BY p.brand;
END;
$$;

-- 7. Fix update_updated_at_column function
DROP FUNCTION IF EXISTS public.update_updated_at_column();
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- 8. Fix generate_invoice_number function
DROP FUNCTION IF EXISTS public.generate_invoice_number();
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number integer;
  formatted_number text;
BEGIN
  -- Note: Using invoice_number instead of bill_number since bill_number column doesn't exist
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 4) AS integer)), 0) + 1
  INTO next_number
  FROM transactions
  WHERE invoice_number LIKE 'NM %';
  
  formatted_number := 'NM ' || LPAD(next_number::text, 4, '0');
  RETURN formatted_number;
END;
$$;

-- 9. Fix create_demo_profiles function
DROP FUNCTION IF EXISTS public.create_demo_profiles();
CREATE OR REPLACE FUNCTION public.create_demo_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This function is for demo purposes only
  -- In production, this should be removed or properly secured
  INSERT INTO profiles (id, email, full_name, role)
  VALUES 
    ('00000000-0000-0000-0000-000000000001', 'admin@nationalminimart.com', 'Admin User', 'admin'),
    ('00000000-0000-0000-0000-000000000002', 'cashier@nationalminimart.com', 'Cashier User', 'cashier'),
    ('00000000-0000-0000-0000-000000000003', 'manager@nationalminimart.com', 'Manager User', 'manager')
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- 10. Fix update_customer_stats function
DROP FUNCTION IF EXISTS public.update_customer_stats();
CREATE OR REPLACE FUNCTION public.update_customer_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update customer stats when transaction is completed
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE customers 
    SET 
      total_spent = total_spent + NEW.total_amount,
      loyalty_points = loyalty_points + FLOOR(NEW.total_amount / 100)
    WHERE id = NEW.customer_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 11. Fix get_low_stock_products function
DROP FUNCTION IF EXISTS public.get_low_stock_products();
CREATE OR REPLACE FUNCTION public.get_low_stock_products()
RETURNS TABLE(
  id uuid,
  name text,
  stock_quantity integer,
  min_stock_level integer
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
    p.stock_quantity,
    COALESCE(p.min_stock_level, 10) as min_stock_level
  FROM products p
  WHERE p.stock_quantity <= COALESCE(p.min_stock_level, 10)
  ORDER BY p.stock_quantity ASC;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;

-- Create trigger for customer stats update
DROP TRIGGER IF EXISTS update_customer_stats_trigger ON transactions;
CREATE TRIGGER update_customer_stats_trigger
  AFTER UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_stats();

-- Create trigger for updated_at column
DROP TRIGGER IF EXISTS update_updated_at_trigger ON products;
CREATE TRIGGER update_updated_at_trigger
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON customers;
CREATE TRIGGER update_updated_at_trigger
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_updated_at_trigger ON transactions;
CREATE TRIGGER update_updated_at_trigger
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column(); 