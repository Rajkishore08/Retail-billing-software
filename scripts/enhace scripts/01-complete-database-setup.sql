-- Complete Database Setup for National Mini Mart POS System
-- This script creates all tables, functions, and optimizations in one go
-- Run this in your Supabase SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing objects to ensure clean setup
DROP MATERIALIZED VIEW IF EXISTS dashboard_stats CASCADE;
DROP FUNCTION IF EXISTS get_products_with_stock() CASCADE;
DROP FUNCTION IF EXISTS get_sales_analytics(date, date) CASCADE;
DROP FUNCTION IF EXISTS get_top_selling_products(date, date) CASCADE;
DROP FUNCTION IF EXISTS get_sales_by_category(date, date) CASCADE;
DROP FUNCTION IF EXISTS get_daily_sales_trend(date, date) CASCADE;
DROP FUNCTION IF EXISTS refresh_dashboard_stats() CASCADE;
DROP FUNCTION IF EXISTS get_last_bill_number() CASCADE;
DROP FUNCTION IF EXISTS calculate_product_savings(UUID) CASCADE;
DROP FUNCTION IF EXISTS refresh_dashboard_stats_efficient() CASCADE;
DROP FUNCTION IF EXISTS get_products_optimized() CASCADE;

-- Create tables
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT DEFAULT 'cashier',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  cost_price DECIMAL(10,2) DEFAULT 0,
  mrp DECIMAL(10,2) DEFAULT 0,
  selling_price DECIMAL(10,2) DEFAULT 0,
  stock_quantity INTEGER DEFAULT 0,
  min_stock_level INTEGER DEFAULT 5,
  gst_rate INTEGER DEFAULT 18,
  price_includes_gst BOOLEAN DEFAULT true,
  hsn_code TEXT NOT NULL UNIQUE,
  brand TEXT DEFAULT 'Generic',
  barcode TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE,
  email TEXT,
  loyalty_points INTEGER DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  cashier_id UUID REFERENCES profiles(id),
  customer_id UUID REFERENCES customers(id),
  subtotal DECIMAL(10,2) NOT NULL,
  gst_amount DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  total_savings DECIMAL(10,2) DEFAULT 0,
  payment_method TEXT NOT NULL,
  cash_received DECIMAL(10,2),
  change_amount DECIMAL(10,2),
  loyalty_points_earned INTEGER DEFAULT 0,
  loyalty_points_redeemed INTEGER DEFAULT 0,
  loyalty_discount_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transaction_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  selling_price DECIMAL(10,2) NOT NULL,
  item_discount_amount DECIMAL(10,2) DEFAULT 0,
  item_discount_percentage DECIMAL(5,2) DEFAULT 0,
  cost_price DECIMAL(10,2) DEFAULT 0,
  mrp DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  product_id UUID REFERENCES products(id),
  movement_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  points_earned INTEGER DEFAULT 0,
  points_redeemed INTEGER DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  transaction_type TEXT CHECK (transaction_type IN ('earned', 'redeemed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock_quantity);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_hsn_code ON products(hsn_code);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_cashier ON transactions(cashier_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice ON transactions(invoice_number);
CREATE INDEX IF NOT EXISTS idx_transaction_items_product ON transaction_items(product_id);
CREATE INDEX IF NOT EXISTS idx_transaction_items_transaction ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer ON loyalty_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_transaction ON loyalty_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_date ON loyalty_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_date ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- Create functions
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

CREATE OR REPLACE FUNCTION get_sales_analytics(start_date DATE, end_date DATE)
RETURNS TABLE (
  total_sales DECIMAL(10,2),
  total_transactions BIGINT,
  average_order_value DECIMAL(10,2),
  total_savings DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(t.total), 0) as total_sales,
    COUNT(t.id)::BIGINT as total_transactions,
    CASE 
      WHEN COUNT(t.id) > 0 THEN COALESCE(SUM(t.total), 0) / COUNT(t.id)
      ELSE 0 
    END as average_order_value,
    COALESCE(SUM(t.total_savings), 0) as total_savings
  FROM transactions t
  WHERE DATE(t.created_at) BETWEEN start_date AND end_date;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_top_selling_products(start_date DATE, end_date DATE)
RETURNS TABLE (
  product_name TEXT,
  total_quantity BIGINT,
  total_revenue DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.name as product_name,
    SUM(ti.quantity)::BIGINT as total_quantity,
    SUM(ti.total) as total_revenue
  FROM transaction_items ti
  JOIN products p ON ti.product_id = p.id
  JOIN transactions t ON ti.transaction_id = t.id
  WHERE DATE(t.created_at) BETWEEN start_date AND end_date
  GROUP BY p.id, p.name
  ORDER BY total_quantity DESC
  LIMIT 10;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_sales_by_category(start_date DATE, end_date DATE)
RETURNS TABLE (
  category_name TEXT,
  total_sales DECIMAL(10,2),
  total_quantity BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(p.brand, 'Generic') as category_name,
    SUM(ti.total) as total_sales,
    SUM(ti.quantity)::BIGINT as total_quantity
  FROM transaction_items ti
  JOIN products p ON ti.product_id = p.id
  JOIN transactions t ON ti.transaction_id = t.id
  WHERE DATE(t.created_at) BETWEEN start_date AND end_date
  GROUP BY p.brand
  ORDER BY total_sales DESC;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_daily_sales_trend(start_date DATE, end_date DATE)
RETURNS TABLE (
  date DATE,
  total_sales DECIMAL(10,2),
  total_transactions BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    DATE(t.created_at) as date,
    SUM(t.total) as total_sales,
    COUNT(t.id)::BIGINT as total_transactions
  FROM transactions t
  WHERE DATE(t.created_at) BETWEEN start_date AND end_date
  GROUP BY DATE(t.created_at)
  ORDER BY date;
END;
$$ LANGUAGE plpgsql;

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

CREATE OR REPLACE FUNCTION calculate_product_savings(product_id UUID)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  savings DECIMAL(10,2);
BEGIN
  SELECT (mrp - selling_price) INTO savings
  FROM products
  WHERE id = product_id;
  
  RETURN COALESCE(savings, 0);
END;
$$ LANGUAGE plpgsql;

-- Create materialized view for dashboard stats
CREATE MATERIALIZED VIEW dashboard_stats AS
SELECT 
  (SELECT COUNT(*) FROM products) as total_products,
  (SELECT COUNT(*) FROM products WHERE stock_quantity <= min_stock_level) as low_stock_items,
  (SELECT COALESCE(SUM(stock_quantity), 0) FROM products) as total_stock_units,
  (SELECT COUNT(*) FROM transactions WHERE DATE(created_at) = CURRENT_DATE) as total_transactions_today,
  (SELECT COALESCE(SUM(total), 0) FROM transactions WHERE DATE(created_at) = CURRENT_DATE) as total_sales_today,
  (SELECT COALESCE(SUM(total_savings), 0) FROM transactions WHERE DATE(created_at) = CURRENT_DATE) as total_savings_today,
  (SELECT COUNT(*) FROM customers) as total_customers,
  (SELECT COALESCE(SUM(loyalty_points), 0) FROM customers) as total_loyalty_points
WITH DATA;

-- Create refresh function
CREATE OR REPLACE FUNCTION refresh_dashboard_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW dashboard_stats;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;

-- Insert default settings
INSERT INTO settings (key, value) VALUES
('store_name', 'National Mini Mart'),
('store_address', '123 Main Street, City, State'),
('store_phone', '+91 9876543210'),
('store_email', 'info@nationalminimart.com'),
('gst_number', 'GST123456789'),
('loyalty_points_rate', '1'),
('loyalty_redemption_rate', '0.01'),
('low_stock_threshold', '5')
ON CONFLICT (key) DO NOTHING;

-- Success message
SELECT 'Complete database setup completed successfully!' as message; 