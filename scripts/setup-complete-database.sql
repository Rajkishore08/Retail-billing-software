-- ============================================================================
-- National Mini Mart POS System - Complete Database Setup & Recovery Script
-- ============================================================================
-- This script creates all tables, enums, indexes, functions, triggers, 
-- materialized views, RLS policies, and inserts realistic seed/demo data.
-- Run this in your Supabase SQL Editor to set up a brand new database.
-- ============================================================================

-- ---------------------------------------------------------
-- 1. Enable Required Extensions
-- ---------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------
-- 2. Drop Existing Objects (Ensures clean installation)
-- ---------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

DROP MATERIALIZED VIEW IF EXISTS public.dashboard_stats CASCADE;

DROP FUNCTION IF EXISTS public.get_products_with_stock() CASCADE;
DROP FUNCTION IF EXISTS public.get_products_optimized() CASCADE;
DROP FUNCTION IF EXISTS public.get_last_bill_number() CASCADE;
DROP FUNCTION IF EXISTS public.get_sales_analytics(date, date) CASCADE;
DROP FUNCTION IF EXISTS public.get_daily_sales_trend(integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_top_selling_products(integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_sales_by_category() CASCADE;
DROP FUNCTION IF EXISTS public.get_unique_brands() CASCADE;
DROP FUNCTION IF EXISTS public.get_products_by_brand(text) CASCADE;
DROP FUNCTION IF EXISTS public.get_low_stock_products() CASCADE;
DROP FUNCTION IF EXISTS public.get_customer_with_loyalty(text) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_product_savings(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.get_db_stats() CASCADE;
DROP FUNCTION IF EXISTS public.get_dashboard_stats() CASCADE;
DROP FUNCTION IF EXISTS public.generate_invoice_number() CASCADE;
DROP FUNCTION IF EXISTS public.refresh_dashboard_stats() CASCADE;
DROP FUNCTION IF EXISTS public.refresh_dashboard_stats_efficient() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_customer_stats() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.validate_password_strength(text) CASCADE;
DROP FUNCTION IF EXISTS public.check_weak_password(text) CASCADE;
DROP FUNCTION IF EXISTS public.validate_user_password(text) CASCADE;
DROP FUNCTION IF EXISTS public.log_auth_attempt(uuid, boolean, inet, text) CASCADE;
DROP FUNCTION IF EXISTS public.get_failed_login_attempts(uuid, integer) CASCADE;
DROP FUNCTION IF EXISTS public.create_demo_profiles() CASCADE;

DROP TABLE IF EXISTS public.auth_logs CASCADE;
DROP TABLE IF EXISTS public.settings CASCADE;
DROP TABLE IF EXISTS public.loyalty_transactions CASCADE;
DROP TABLE IF EXISTS public.stock_movements CASCADE;
DROP TABLE IF EXISTS public.transaction_items CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

DROP TYPE IF EXISTS public.user_role CASCADE;
DROP TYPE IF EXISTS public.payment_method CASCADE;
DROP TYPE IF EXISTS public.transaction_status CASCADE;

-- ---------------------------------------------------------
-- 3. Create Custom Types & Enums
-- ---------------------------------------------------------
CREATE TYPE public.user_role AS ENUM ('admin', 'cashier', 'manager');
CREATE TYPE public.payment_method AS ENUM ('cash', 'card', 'upi');
CREATE TYPE public.transaction_status AS ENUM ('completed', 'cancelled', 'pending');

-- ---------------------------------------------------------
-- 4. Create Tables
-- ---------------------------------------------------------

-- Profiles Table (Linked to Supabase Auth)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role public.user_role DEFAULT 'cashier'::public.user_role,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Categories Table
CREATE TABLE public.categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products Table
CREATE TABLE public.products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  barcode TEXT UNIQUE,
  price DECIMAL(10,2) NOT NULL,
  cost_price DECIMAL(10,2) DEFAULT 0.00,
  mrp DECIMAL(10,2) DEFAULT 0.00,
  selling_price DECIMAL(10,2) DEFAULT 0.00,
  stock_quantity INTEGER DEFAULT 0,
  min_stock_level INTEGER DEFAULT 5,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  gst_rate DECIMAL(5,2) DEFAULT 18.00,
  price_includes_gst BOOLEAN DEFAULT true,
  hsn_code TEXT NOT NULL UNIQUE,
  brand TEXT DEFAULT 'Generic',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Customers Table
CREATE TABLE public.customers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  loyalty_points INTEGER DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions Table
CREATE TABLE public.transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  cashier_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  subtotal DECIMAL(10,2) NOT NULL,
  gst_amount DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL, -- Match frontend column
  discount_amount DECIMAL(10,2) DEFAULT 0.00,
  discount_percentage DECIMAL(5,2) DEFAULT 0.00,
  total_savings DECIMAL(10,2) DEFAULT 0.00,
  payment_method public.payment_method NOT NULL,
  cash_received DECIMAL(10,2),
  change_amount DECIMAL(10,2),
  status public.transaction_status DEFAULT 'completed'::public.transaction_status,
  loyalty_points_earned INTEGER DEFAULT 0,
  loyalty_points_redeemed INTEGER DEFAULT 0,
  loyalty_discount_amount DECIMAL(10,2) DEFAULT 0.00,
  rounding_adjustment DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transaction Items Table
CREATE TABLE public.transaction_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  selling_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL, -- Match frontend checkout
  gst_rate DECIMAL(5,2) NOT NULL,
  price_includes_gst BOOLEAN DEFAULT true,
  item_discount_amount DECIMAL(10,2) DEFAULT 0.00,
  item_discount_percentage DECIMAL(5,2) DEFAULT 0.00,
  cost_price DECIMAL(10,2) DEFAULT 0.00,
  mrp DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stock Movements Table
CREATE TABLE public.stock_movements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL, -- 'sale', 'adjustment', 'restock'
  quantity INTEGER NOT NULL,
  reference_id UUID, -- transaction_id for sales
  notes TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Loyalty Transactions Table
CREATE TABLE public.loyalty_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  points_earned INTEGER DEFAULT 0,
  points_redeemed INTEGER DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0.00,
  transaction_type TEXT CHECK (transaction_type IN ('earned', 'redeemed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Settings Table
CREATE TABLE public.settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Auth Logs Table
CREATE TABLE public.auth_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  success BOOLEAN NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------
-- 5. Create Performance Indexes
-- ---------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_stock ON public.products(stock_quantity);
CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(brand);
CREATE INDEX IF NOT EXISTS idx_products_hsn_code ON public.products(hsn_code);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_cashier ON public.transactions(cashier_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON public.transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice ON public.transactions(invoice_number);

CREATE INDEX IF NOT EXISTS idx_transaction_items_product ON public.transaction_items(product_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction ON public.transaction_items(transaction_id);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer ON public.loyalty_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_transaction ON public.loyalty_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_date ON public.loyalty_transactions(created_at);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON public.stock_movements(created_at);

CREATE INDEX IF NOT EXISTS idx_settings_key ON public.settings(key);

CREATE INDEX IF NOT EXISTS idx_auth_logs_user_id ON public.auth_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_logs_created_at ON public.auth_logs(created_at);

-- ---------------------------------------------------------
-- 6. Create Base Trigger Functions & Triggers
-- ---------------------------------------------------------

-- Function to auto-update updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON public.settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user registration and synchronize profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    CASE 
      WHEN NEW.email IN ('admin@nationalmart.com', 'admin@nationalminimart.com') THEN 'admin'::public.user_role
      WHEN NEW.email IN ('manager@nationalmart.com', 'manager@nationalminimart.com') THEN 'manager'::public.user_role
      ELSE 'cashier'::public.user_role
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update customer total spent and loyalty points upon transaction completion
CREATE OR REPLACE FUNCTION public.update_customer_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed'::public.transaction_status AND (TG_OP = 'INSERT' OR OLD.status != 'completed'::public.transaction_status) THEN
    UPDATE public.customers 
    SET 
      total_spent = total_spent + NEW.total_amount,
      loyalty_points = loyalty_points + FLOOR(NEW.total_amount / 100)
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_customer_stats_trigger
  AFTER INSERT OR UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customer_stats();

-- ---------------------------------------------------------
-- 7. Create Core Database RPC Functions
-- ---------------------------------------------------------

-- Get products in stock
CREATE OR REPLACE FUNCTION public.get_products_with_stock()
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
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
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
    p.created_at,
    p.updated_at
  FROM products p
  WHERE p.stock_quantity > 0
  ORDER BY p.name;
END;
$$;

-- Optimized query equivalent to get_products_with_stock
CREATE OR REPLACE FUNCTION public.get_products_optimized()
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
  barcode TEXT
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
    p.cost_price,
    p.mrp,
    p.selling_price,
    p.stock_quantity,
    p.min_stock_level,
    p.gst_rate::DECIMAL(5,2),
    p.price_includes_gst,
    p.hsn_code,
    p.brand,
    p.barcode
  FROM products p
  WHERE p.stock_quantity > 0
  ORDER BY p.name;
END;
$$;

-- Get the last bill number
CREATE OR REPLACE FUNCTION public.get_last_bill_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Generate consecutive invoice number (for backup fallback)
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_number INTEGER;
  formatted_number TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 4) AS INTEGER)), 0) + 1
  INTO next_number
  FROM transactions
  WHERE invoice_number LIKE 'NM %';
  
  formatted_number := 'NM ' || LPAD(next_number::TEXT, 4, '0');
  RETURN formatted_number;
END;
$$;

-- Get sales analytics trends
CREATE OR REPLACE FUNCTION public.get_sales_analytics(
  start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  date_label TEXT,
  total_sales DECIMAL(12,2),
  total_transactions BIGINT,
  total_savings DECIMAL(12,2),
  avg_transaction_value DECIMAL(10,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TO_CHAR(t.created_at::DATE, 'YYYY-MM-DD') as date_label,
    COALESCE(SUM(t.total_amount), 0.00)::DECIMAL(12,2) as total_sales,
    COUNT(t.id)::BIGINT as total_transactions,
    COALESCE(SUM(t.total_savings), 0.00)::DECIMAL(12,2) as total_savings,
    COALESCE(AVG(t.total_amount), 0.00)::DECIMAL(10,2) as avg_transaction_value
  FROM transactions t
  WHERE t.created_at::DATE BETWEEN start_date AND end_date
    AND t.status = 'completed'::public.transaction_status
  GROUP BY t.created_at::DATE
  ORDER BY t.created_at::DATE;
END;
$$;

-- Get daily sales trends
CREATE OR REPLACE FUNCTION public.get_daily_sales_trend(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
  date_label TEXT,
  sales_amount DECIMAL(12,2),
  transaction_count BIGINT,
  savings_amount DECIMAL(12,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    TO_CHAR(date_series.date, 'YYYY-MM-DD') as date_label,
    COALESCE(SUM(t.total_amount), 0.00)::DECIMAL(12,2) as sales_amount,
    COUNT(t.id)::BIGINT as transaction_count,
    COALESCE(SUM(t.total_savings), 0.00)::DECIMAL(12,2) as savings_amount
  FROM (
    SELECT generate_series(
      CURRENT_DATE - (days_back || ' days')::INTERVAL,
      CURRENT_DATE,
      '1 day'::INTERVAL
    )::DATE as date
  ) date_series
  LEFT JOIN transactions t ON t.created_at::DATE = date_series.date AND t.status = 'completed'::public.transaction_status
  GROUP BY date_series.date
  ORDER BY date_series.date;
END;
$$;

-- Get top selling products
CREATE OR REPLACE FUNCTION public.get_top_selling_products(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  product_name TEXT,
  total_quantity BIGINT,
  total_revenue DECIMAL(12,2),
  avg_price DECIMAL(10,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ti.product_name,
    SUM(ti.quantity)::BIGINT as total_quantity,
    COALESCE(SUM(ti.total_price), 0.00)::DECIMAL(12,2) as total_revenue,
    COALESCE(AVG(ti.unit_price), 0.00)::DECIMAL(10,2) as avg_price
  FROM transaction_items ti
  JOIN transactions t ON ti.transaction_id = t.id
  WHERE t.status = 'completed'::public.transaction_status
    AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY ti.product_name
  ORDER BY total_quantity DESC
  LIMIT limit_count;
END;
$$;

-- Get sales by product category/brand
CREATE OR REPLACE FUNCTION public.get_sales_by_category()
RETURNS TABLE (
  category_name TEXT,
  total_sales DECIMAL(12,2),
  total_items BIGINT,
  avg_price DECIMAL(10,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(c.name, COALESCE(p.brand, 'Uncategorized')) as category_name,
    COALESCE(SUM(ti.total_price), 0.00)::DECIMAL(12,2) as total_sales,
    SUM(ti.quantity)::BIGINT as total_items,
    COALESCE(AVG(ti.unit_price), 0.00)::DECIMAL(10,2) as avg_price
  FROM transaction_items ti
  JOIN transactions t ON ti.transaction_id = t.id
  LEFT JOIN products p ON ti.product_id = p.id
  LEFT JOIN categories c ON p.category_id = c.id
  WHERE t.status = 'completed'::public.transaction_status
    AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY COALESCE(c.name, COALESCE(p.brand, 'Uncategorized'))
  ORDER BY total_sales DESC;
END;
$$;

-- Get unique brands in products list
CREATE OR REPLACE FUNCTION public.get_unique_brands()
RETURNS TABLE (brand TEXT)
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

-- Get products by brand
CREATE OR REPLACE FUNCTION public.get_products_by_brand(brand_name TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  price DECIMAL(10,2),
  stock_quantity INTEGER,
  gst_rate DECIMAL(5,2),
  price_includes_gst BOOLEAN,
  hsn_code TEXT,
  brand TEXT,
  barcode TEXT
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
  WHERE p.brand = brand_name
  ORDER BY p.name;
END;
$$;

-- Get low stock products alert
CREATE OR REPLACE FUNCTION public.get_low_stock_products()
RETURNS TABLE (
  id UUID,
  name TEXT,
  stock_quantity INTEGER,
  min_stock_level INTEGER
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
    COALESCE(p.min_stock_level, 5) as min_stock_level
  FROM products p
  WHERE p.stock_quantity <= COALESCE(p.min_stock_level, 5)
  ORDER BY p.stock_quantity ASC;
END;
$$;

-- Get customer details with loyalty stats
CREATE OR REPLACE FUNCTION public.get_customer_with_loyalty(phone_input TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  phone TEXT,
  email TEXT,
  loyalty_points INTEGER,
  total_spent DECIMAL(10,2)
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
  WHERE c.phone = phone_input;
END;
$$;

-- Calculate savings on product
CREATE OR REPLACE FUNCTION public.calculate_product_savings(product_id UUID)
RETURNS TABLE (
  savings_amount DECIMAL(10,2),
  savings_percentage DECIMAL(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(p.mrp - p.price, 0.00) as savings_amount,
    CASE 
      WHEN p.mrp > 0 AND p.mrp > p.price 
      THEN ((p.mrp - p.price) / p.mrp * 100)::DECIMAL(5,2)
      ELSE 0.00
    END as savings_percentage
  FROM products p
  WHERE p.id = product_id;
END;
$$;

-- Get system/database stats
CREATE OR REPLACE FUNCTION public.get_db_stats()
RETURNS TABLE (
  active_connections INTEGER,
  total_transactions BIGINT,
  total_products BIGINT,
  total_customers BIGINT,
  db_size TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT count(*)::integer FROM pg_stat_activity)::integer as active_connections,
    (SELECT count(*) FROM transactions) as total_transactions,
    (SELECT count(*) FROM products) as total_products,
    (SELECT count(*) FROM customers) as total_customers,
    pg_size_pretty(pg_database_size(current_database())) as db_size;
END;
$$;

-- Get dashboard overall statistics
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS TABLE (
  total_products BIGINT,
  total_customers BIGINT,
  monthly_revenue DECIMAL(10,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT count(*) FROM products) as total_products,
    (SELECT count(*) FROM customers) as total_customers,
    COALESCE(
      (SELECT sum(total_amount) 
       FROM transactions 
       WHERE created_at >= date_trunc('month', CURRENT_DATE) 
       AND status = 'completed'::public.transaction_status),
      0.00
    ) as monthly_revenue;
END;
$$;

-- ---------------------------------------------------------
-- 8. Create Materialized View & Caching
-- ---------------------------------------------------------
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

-- ---------------------------------------------------------
-- 9. Password Validation & Security RPC Functions
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_password_strength(password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Min 8 chars, one uppercase, one lowercase, one number, one special character
  IF LENGTH(password) < 8 THEN
    RETURN FALSE;
  END IF;
  IF password !~ '[A-Z]' THEN
    RETURN FALSE;
  END IF;
  IF password !~ '[a-z]' THEN
    RETURN FALSE;
  END IF;
  IF password !~ '[0-9]' THEN
    RETURN FALSE;
  END IF;
  IF password !~ '[!@#$%^&*(),.?":{}|<>]' THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_weak_password(password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF password IN (
    'password', '123456', '123456789', 'qwerty', 'abc123',
    'password123', 'admin', 'letmein', 'welcome', 'monkey',
    'dragon', 'master', 'football', 'superman', 'trustno1'
  ) THEN
    RETURN TRUE;
  END IF;
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_user_password(password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.check_weak_password(password) THEN
    RETURN 'Password is too common. Please choose a stronger password.';
  END IF;
  IF NOT public.validate_password_strength(password) THEN
    RETURN 'Password must be at least 8 characters long and contain uppercase, lowercase, digit, and special character.';
  END IF;
  RETURN 'OK';
END;
$$;

-- Auth logs logging function
CREATE OR REPLACE FUNCTION public.log_auth_attempt(
  user_id UUID,
  success BOOLEAN,
  ip_address INET DEFAULT NULL,
  user_agent TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.auth_logs (user_id, success, ip_address, user_agent, created_at)
  VALUES (user_id, success, ip_address, user_agent, CURRENT_TIMESTAMP);
END;
$$;

-- Get failed logins
CREATE OR REPLACE FUNCTION public.get_failed_login_attempts(
  user_id UUID,
  hours_back INTEGER DEFAULT 24
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  failed_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER
  INTO failed_count
  FROM public.auth_logs
  WHERE auth_logs.user_id = get_failed_login_attempts.user_id
    AND auth_logs.success = FALSE
    AND auth_logs.created_at >= CURRENT_TIMESTAMP - (hours_back || ' hours')::INTERVAL;
  
  RETURN failed_count;
END;
$$;

-- Function to insert mock demo profiles for SQL testing (re-creates them in profiles if not exists)
CREATE OR REPLACE FUNCTION public.create_demo_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES 
    ('00000000-0000-0000-0000-000000000001', 'admin@nationalmart.com', 'Admin User', 'admin'::public.user_role),
    ('00000000-0000-0000-0000-000000000002', 'cashier@nationalmart.com', 'Cashier User', 'cashier'::public.public.user_role),
    ('00000000-0000-0000-0000-000000000003', 'manager@nationalmart.com', 'Manager User', 'manager'::public.user_role)
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- ---------------------------------------------------------
-- 10. Enable Row Level Security (RLS) & Policies
-- ---------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_logs ENABLE ROW LEVEL SECURITY;

-- Permissive RLS Policies for Authenticated Users
CREATE POLICY "Allow all operations for authenticated users" ON public.profiles FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all operations for authenticated users" ON public.categories FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all operations for authenticated users" ON public.products FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all operations for authenticated users" ON public.transactions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all operations for authenticated users" ON public.transaction_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all operations for authenticated users" ON public.stock_movements FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all operations for authenticated users" ON public.loyalty_transactions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all operations for authenticated users" ON public.settings FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all operations for authenticated users" ON public.auth_logs FOR ALL USING (auth.role() = 'authenticated');

-- Selective reads for Anonymous users (to prevent blank landing pages before login)
CREATE POLICY "Allow select for anon users" ON public.settings FOR SELECT USING (true);
CREATE POLICY "Allow select for anon users" ON public.products FOR SELECT USING (true);
CREATE POLICY "Allow select for anon users" ON public.categories FOR SELECT USING (true);

-- ---------------------------------------------------------
-- 11. Grant Table & Function Permissions
-- ---------------------------------------------------------
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;

-- ---------------------------------------------------------
-- 12. Insert Default settings, categories & Products (Seed Data)
-- ---------------------------------------------------------

-- Seed Settings
INSERT INTO public.settings (key, value) VALUES
('store_name', 'National Mini Mart'),
('store_address', '123 Main Street, City, State - 123456'),
('store_phone', '+91 9876543210'),
('store_email', 'info@nationalminimart.com'),
('gst_number', '22AAAAA0000A1Z5'),
('loyalty_points_rate', '1'),
('loyalty_redemption_rate', '0.01'),
('low_stock_threshold', '5'),
('enable_discounts', 'true'),
('max_discount_percentage', '50'),
('show_savings_on_receipt', 'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Seed Categories
INSERT INTO public.categories (name, description) VALUES
('Groceries', 'Food items, grains, daily essentials'),
('Beverages', 'Soft drinks, milk, teas, juices'),
('Personal Care', 'Soaps, shampoos, hygiene items'),
('Stationery', 'Books, pens, school supplies'),
('Electronics', 'Cables, battery packs, small items')
ON CONFLICT (name) DO NOTHING;

-- Seed Products
INSERT INTO public.products (name, price, cost_price, mrp, selling_price, stock_quantity, min_stock_level, gst_rate, hsn_code, brand, barcode, category_id) VALUES
('Biscuits', 25.00, 15.00, 30.00, 25.00, 100, 10, 18.00, '19053100', 'Britannia', '8901234567890', (SELECT id FROM public.categories WHERE name = 'Groceries')),
('Milk', 60.00, 45.00, 70.00, 60.00, 50, 5, 5.00, '04011000', 'Amul', '8901234567891', (SELECT id FROM public.categories WHERE name = 'Beverages')),
('Bread', 35.00, 25.00, 40.00, 35.00, 30, 5, 5.00, '19053101', 'Britannia', '8901234567892', (SELECT id FROM public.categories WHERE name = 'Groceries')),
('Eggs (12)', 80.00, 60.00, 90.00, 80.00, 25, 5, 5.00, '04072100', 'Farm Fresh', '8901234567893', (SELECT id FROM public.categories WHERE name = 'Groceries')),
('Rice (5kg)', 250.00, 200.00, 280.00, 250.00, 20, 5, 5.00, '10063000', 'India Gate', '8901234567894', (SELECT id FROM public.categories WHERE name = 'Groceries')),
('Sugar (1kg)', 45.00, 35.00, 50.00, 45.00, 40, 5, 5.00, '17019900', 'Sakthi', '8901234567895', (SELECT id FROM public.categories WHERE name = 'Groceries')),
('Tea Powder', 120.00, 90.00, 140.00, 120.00, 30, 5, 18.00, '09024000', 'Tata', '8901234567896', (SELECT id FROM public.categories WHERE name = 'Beverages')),
('Cooking Oil', 180.00, 140.00, 200.00, 180.00, 25, 5, 5.00, '15079000', 'Fortune', '8901234567897', (SELECT id FROM public.categories WHERE name = 'Groceries')),
('Soap', 25.00, 15.00, 30.00, 25.00, 60, 10, 18.00, '34011100', 'Lux', '8901234567898', (SELECT id FROM public.categories WHERE name = 'Personal Care')),
('Toothpaste', 85.00, 60.00, 95.00, 85.00, 40, 5, 18.00, '33061000', 'Colgate', '8901234567899', (SELECT id FROM public.categories WHERE name = 'Personal Care')),
('Shampoo', 120.00, 80.00, 140.00, 120.00, 30, 5, 18.00, '33059000', 'Head & Shoulders', '8901234567900', (SELECT id FROM public.categories WHERE name = 'Personal Care')),
('Detergent', 95.00, 70.00, 110.00, 95.00, 35, 5, 18.00, '34022000', 'Surf Excel', '8901234567901', (SELECT id FROM public.categories WHERE name = 'Groceries')),
('Chocolate', 50.00, 35.00, 60.00, 50.00, 45, 10, 18.00, '18063200', 'Cadbury', '8901234567902', (SELECT id FROM public.categories WHERE name = 'Groceries')),
('Chips', 20.00, 12.00, 25.00, 20.00, 80, 15, 18.00, '19041000', 'Lay''s', '8901234567903', (SELECT id FROM public.categories WHERE name = 'Groceries')),
('Soft Drink', 35.00, 25.00, 40.00, 35.00, 70, 10, 18.00, '22021000', 'Coca Cola', '8901234567904', (SELECT id FROM public.categories WHERE name = 'Beverages'))
ON CONFLICT (hsn_code) DO NOTHING;

-- Seed Customers
INSERT INTO public.customers (name, phone, email, loyalty_points, total_spent) VALUES
('Rajesh Kumar', '+91 9876543210', 'rajesh@email.com', 150, 2500.00),
('Priya Sharma', '+91 9876543211', 'priya@email.com', 200, 3200.00),
('Amit Patel', '+91 9876543212', 'amit@email.com', 75, 1800.00),
('Sneha Reddy', '+91 9876543213', 'sneha@email.com', 300, 4500.00),
('Vikram Singh', '+91 9876543214', 'vikram@email.com', 120, 2100.00),
('Anjali Gupta', '+91 9876543215', 'anjali@email.com', 180, 2800.00),
('Rahul Verma', '+91 9876543216', 'rahul@email.com', 90, 1600.00),
('Meera Iyer', '+91 9876543217', 'meera@email.com', 250, 3800.00)
ON CONFLICT (phone) DO NOTHING;

-- Seed Past Transactions (Last 7 Days) for charts analytics
INSERT INTO public.transactions (invoice_number, cashier_id, customer_id, customer_name, customer_phone, subtotal, gst_amount, total_amount, discount_amount, discount_percentage, total_savings, payment_method, cash_received, change_amount, loyalty_points_earned, loyalty_points_redeemed, loyalty_discount_amount, rounding_adjustment, created_at) VALUES
('NM 0001', NULL, (SELECT id FROM public.customers WHERE phone = '+91 9876543210'), 'Rajesh Kumar', '+91 9876543210', 180.00, 32.40, 212.40, 10.00, 5.00, 25.00, 'cash'::public.payment_method, 220.00, 7.60, 2, 0, 0.00, 0.00, NOW() - INTERVAL '6 days'),
('NM 0002', NULL, (SELECT id FROM public.customers WHERE phone = '+91 9876543211'), 'Priya Sharma', '+91 9876543211', 320.00, 57.60, 377.60, 0.00, 0.00, 40.00, 'card'::public.payment_method, 377.60, 0.00, 3, 0, 0.00, 0.00, NOW() - INTERVAL '5 days'),
('NM 0003', NULL, (SELECT id FROM public.customers WHERE phone = '+91 9876543212'), 'Amit Patel', '+91 9876543212', 150.00, 27.00, 177.00, 5.00, 3.00, 20.00, 'upi'::public.payment_method, 177.00, 0.00, 1, 0, 0.00, 0.00, NOW() - INTERVAL '4 days'),
('NM 0004', NULL, (SELECT id FROM public.customers WHERE phone = '+91 9876543213'), 'Sneha Reddy', '+91 9876543213', 450.00, 81.00, 531.00, 20.00, 4.00, 65.00, 'cash'::public.payment_method, 550.00, 19.00, 5, 0, 0.00, 0.00, NOW() - INTERVAL '3 days'),
('NM 0005', NULL, (SELECT id FROM public.customers WHERE phone = '+91 9876543214'), 'Vikram Singh', '+91 9876543214', 280.00, 50.40, 330.40, 0.00, 0.00, 35.00, 'card'::public.payment_method, 330.40, 0.00, 3, 0, 0.00, 0.00, NOW() - INTERVAL '2 days'),
('NM 0006', NULL, (SELECT id FROM public.customers WHERE phone = '+91 9876543215'), 'Anjali Gupta', '+91 9876543215', 195.00, 35.10, 230.10, 10.00, 5.00, 30.00, 'upi'::public.payment_method, 230.10, 0.00, 2, 0, 0.00, 0.00, NOW() - INTERVAL '1 day'),
('NM 0007', NULL, (SELECT id FROM public.customers WHERE phone = '+91 9876543216'), 'Rahul Verma', '+91 9876543216', 420.00, 75.60, 495.60, 15.00, 3.00, 55.00, 'cash'::public.payment_method, 500.00, 4.40, 4, 0, 0.00, 0.00, NOW() - INTERVAL '12 hours'),
('NM 0008', NULL, (SELECT id FROM public.customers WHERE phone = '+91 9876543217'), 'Meera Iyer', '+91 9876543217', 310.00, 55.80, 365.80, 0.00, 0.00, 40.00, 'card'::public.payment_method, 365.80, 0.00, 3, 0, 0.00, 0.00, NOW() - INTERVAL '6 hours')
ON CONFLICT (invoice_number) DO NOTHING;

-- Seed Transaction Items
INSERT INTO public.transaction_items (transaction_id, product_id, product_name, quantity, unit_price, total_price, gst_rate, price_includes_gst, cost_price, mrp, selling_price) VALUES
-- Transaction 1
((SELECT id FROM public.transactions WHERE invoice_number = 'NM 0001'), (SELECT id FROM public.products WHERE name = 'Biscuits'), 'Biscuits', 2, 25.00, 50.00, 18.00, true, 15.00, 30.00, 25.00),
((SELECT id FROM public.transactions WHERE invoice_number = 'NM 0001'), (SELECT id FROM public.products WHERE name = 'Milk'), 'Milk', 2, 60.00, 120.00, 5.00, true, 45.00, 70.00, 60.00),
((SELECT id FROM public.transactions WHERE invoice_number = 'NM 0001'), (SELECT id FROM public.products WHERE name = 'Bread'), 'Bread', 1, 35.00, 35.00, 5.00, true, 25.00, 40.00, 35.00),
-- Transaction 2
((SELECT id FROM public.transactions WHERE invoice_number = 'NM 0002'), (SELECT id FROM public.products WHERE name = 'Rice (5kg)'), 'Rice (5kg)', 1, 250.00, 250.00, 5.00, true, 200.00, 280.00, 250.00),
((SELECT id FROM public.transactions WHERE invoice_number = 'NM 0002'), (SELECT id FROM public.products WHERE name = 'Sugar (1kg)'), 'Sugar (1kg)', 1, 45.00, 45.00, 5.00, true, 35.00, 50.00, 45.00),
((SELECT id FROM public.transactions WHERE invoice_number = 'NM 0002'), (SELECT id FROM public.products WHERE name = 'Tea Powder'), 'Tea Powder', 1, 120.00, 120.00, 18.00, true, 90.00, 140.00, 120.00),
-- Transaction 3
((SELECT id FROM public.transactions WHERE invoice_number = 'NM 0003'), (SELECT id FROM public.products WHERE name = 'Eggs (12)'), 'Eggs (12)', 1, 80.00, 80.00, 5.00, true, 60.00, 90.00, 80.00),
((SELECT id FROM public.transactions WHERE invoice_number = 'NM 0003'), (SELECT id FROM public.products WHERE name = 'Bread'), 'Bread', 2, 35.00, 70.00, 5.00, true, 25.00, 40.00, 35.00),
-- Transaction 4
((SELECT id FROM public.transactions WHERE invoice_number = 'NM 0004'), (SELECT id FROM public.products WHERE name = 'Cooking Oil'), 'Cooking Oil', 1, 180.00, 180.00, 5.00, true, 140.00, 200.00, 180.00),
((SELECT id FROM public.transactions WHERE invoice_number = 'NM 0004'), (SELECT id FROM public.products WHERE name = 'Rice (5kg)'), 'Rice (5kg)', 1, 250.00, 250.00, 5.00, true, 200.00, 280.00, 250.00),
((SELECT id FROM public.transactions WHERE invoice_number = 'NM 0004'), (SELECT id FROM public.products WHERE name = 'Sugar (1kg)'), 'Sugar (1kg)', 1, 45.00, 45.00, 5.00, true, 35.00, 50.00, 45.00),
-- Transaction 5
((SELECT id FROM public.transactions WHERE invoice_number = 'NM 0005'), (SELECT id FROM public.products WHERE name = 'Soap'), 'Soap', 2, 25.00, 50.00, 18.00, true, 15.00, 30.00, 25.00),
((SELECT id FROM public.transactions WHERE invoice_number = 'NM 0005'), (SELECT id FROM public.products WHERE name = 'Toothpaste'), 'Toothpaste', 1, 85.00, 85.00, 18.00, true, 60.00, 95.00, 85.00),
((SELECT id FROM public.transactions WHERE invoice_number = 'NM 0005'), (SELECT id FROM public.products WHERE name = 'Shampoo'), 'Shampoo', 1, 120.00, 120.00, 18.00, true, 80.00, 140.00, 120.00),
((SELECT id FROM public.transactions WHERE invoice_number = 'NM 0005'), (SELECT id FROM public.products WHERE name = 'Detergent'), 'Detergent', 1, 95.00, 95.00, 18.00, true, 70.00, 110.00, 95.00),
-- Transaction 6
((SELECT id FROM public.transactions WHERE invoice_number = 'NM 0006'), (SELECT id FROM public.products WHERE name = 'Chocolate'), 'Chocolate', 2, 50.00, 100.00, 18.00, true, 35.00, 60.00, 50.00),
((SELECT id FROM public.transactions WHERE invoice_number = 'NM 0006'), (SELECT id FROM public.products WHERE name = 'Chips'), 'Chips', 3, 20.00, 60.00, 18.00, true, 12.00, 25.00, 20.00),
((SELECT id FROM public.transactions WHERE invoice_number = 'NM 0006'), (SELECT id FROM public.products WHERE name = 'Soft Drink'), 'Soft Drink', 1, 35.00, 35.00, 18.00, true, 25.00, 40.00, 35.00),
-- Transaction 7
((SELECT id FROM public.transactions WHERE invoice_number = 'NM 0007'), (SELECT id FROM public.products WHERE name = 'Milk'), 'Milk', 3, 60.00, 180.00, 5.00, true, 45.00, 70.00, 60.00),
((SELECT id FROM public.transactions WHERE invoice_number = 'NM 0007'), (SELECT id FROM public.products WHERE name = 'Bread'), 'Bread', 2, 35.00, 70.00, 5.00, true, 25.00, 40.00, 35.00),
((SELECT id FROM public.transactions WHERE invoice_number = 'NM 0007'), (SELECT id FROM public.products WHERE name = 'Eggs (12)'), 'Eggs (12)', 2, 80.00, 160.00, 5.00, true, 60.00, 90.00, 80.00),
-- Transaction 8
((SELECT id FROM public.transactions WHERE invoice_number = 'NM 0008'), (SELECT id FROM public.products WHERE name = 'Tea Powder'), 'Tea Powder', 1, 120.00, 120.00, 18.00, true, 90.00, 140.00, 120.00),
((SELECT id FROM public.transactions WHERE invoice_number = 'NM 0008'), (SELECT id FROM public.products WHERE name = 'Sugar (1kg)'), 'Sugar (1kg)', 2, 45.00, 90.00, 5.00, true, 35.00, 50.00, 45.00),
((SELECT id FROM public.transactions WHERE invoice_number = 'NM 0008'), (SELECT id FROM public.products WHERE name = 'Cooking Oil'), 'Cooking Oil', 1, 180.00, 180.00, 5.00, true, 140.00, 200.00, 180.00);

-- Seed Loyalty Transactions
INSERT INTO public.loyalty_transactions (customer_id, transaction_id, points_earned, points_redeemed, discount_amount, transaction_type) VALUES
((SELECT id FROM public.customers WHERE phone = '+91 9876543210'), (SELECT id FROM public.transactions WHERE invoice_number = 'NM 0001'), 2, 0, 0.00, 'earned'),
((SELECT id FROM public.customers WHERE phone = '+91 9876543211'), (SELECT id FROM public.transactions WHERE invoice_number = 'NM 0002'), 3, 0, 0.00, 'earned'),
((SELECT id FROM public.customers WHERE phone = '+91 9876543212'), (SELECT id FROM public.transactions WHERE invoice_number = 'NM 0003'), 1, 0, 0.00, 'earned'),
((SELECT id FROM public.customers WHERE phone = '+91 9876543213'), (SELECT id FROM public.transactions WHERE invoice_number = 'NM 0004'), 5, 0, 0.00, 'earned'),
((SELECT id FROM public.customers WHERE phone = '+91 9876543214'), (SELECT id FROM public.transactions WHERE invoice_number = 'NM 0005'), 3, 0, 0.00, 'earned'),
((SELECT id FROM public.customers WHERE phone = '+91 9876543215'), (SELECT id FROM public.transactions WHERE invoice_number = 'NM 0006'), 2, 0, 0.00, 'earned'),
((SELECT id FROM public.customers WHERE phone = '+91 9876543216'), (SELECT id FROM public.transactions WHERE invoice_number = 'NM 0007'), 4, 0, 0.00, 'earned'),
((SELECT id FROM public.customers WHERE phone = '+91 9876543217'), (SELECT id FROM public.transactions WHERE invoice_number = 'NM 0008'), 3, 0, 0.00, 'earned');

-- ---------------------------------------------------------
-- 13. Refresh Materialized Views
-- ---------------------------------------------------------
SELECT public.refresh_dashboard_stats();

-- Success check
SELECT 'Database setup completed successfully! All tables, RPCs, views, RLS and seed data are configured.' as result;
