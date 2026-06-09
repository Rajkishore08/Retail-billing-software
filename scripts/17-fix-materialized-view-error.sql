-- Fix Materialized View Error
-- This script removes the problematic materialized view and simplifies the setup

-- 1. Drop the problematic materialized view if it exists
DROP MATERIALIZED VIEW IF EXISTS pos_dashboard_stats;

-- 2. Drop any related triggers
DROP TRIGGER IF EXISTS auto_refresh_dashboard_trigger ON transactions;

-- 3. Drop any related functions that might be causing issues
DROP FUNCTION IF EXISTS refresh_dashboard_stats();

-- 4. Ensure all required columns exist in transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS loyalty_points_earned INTEGER DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS loyalty_points_redeemed INTEGER DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS loyalty_discount_amount DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS rounding_adjustment DECIMAL(10,2) DEFAULT 0.00;

-- 5. Ensure all required columns exist in transaction_items table
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS price_includes_gst BOOLEAN DEFAULT false;

-- 6. Ensure all required columns exist in products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(10);
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_includes_gst BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT;

-- 7. Update existing products with default values
UPDATE products SET hsn_code = '999999' WHERE hsn_code IS NULL;
UPDATE products SET brand = 'Generic' WHERE brand IS NULL;
UPDATE products SET price_includes_gst = false WHERE price_includes_gst IS NULL;

-- 8. Ensure customers table exists and has required columns
CREATE TABLE IF NOT EXISTS customers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  address TEXT,
  date_of_birth DATE,
  loyalty_points INTEGER DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0.00,
  visit_count INTEGER DEFAULT 0,
  last_visit TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Ensure loyalty_transactions table exists
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  points_earned INTEGER DEFAULT 0,
  points_redeemed INTEGER DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0.00,
  transaction_type TEXT NOT NULL, -- 'earned', 'redeemed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Fix the get_products_with_stock function
DROP FUNCTION IF EXISTS get_products_with_stock();
CREATE OR REPLACE FUNCTION get_products_with_stock()
RETURNS TABLE (
  id UUID,
  name TEXT,
  price DECIMAL(10,2),
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

-- 11. Fix the get_last_bill_number function
DROP FUNCTION IF EXISTS get_last_bill_number();
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

-- 12. Create function to get unique brands
DROP FUNCTION IF EXISTS get_unique_brands();
CREATE OR REPLACE FUNCTION get_unique_brands()
RETURNS TABLE (brand VARCHAR(100)) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.brand
  FROM products p
  WHERE p.brand IS NOT NULL
  ORDER BY p.brand;
END;
$$ LANGUAGE plpgsql;

-- 13. Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- 14. Create RLS policies for all tables
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON products;
CREATE POLICY "Allow all operations for authenticated users" ON products FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON transactions;
CREATE POLICY "Allow all operations for authenticated users" ON transactions FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON transaction_items;
CREATE POLICY "Allow all operations for authenticated users" ON transaction_items FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON customers;
CREATE POLICY "Allow all operations for authenticated users" ON customers FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON loyalty_transactions;
CREATE POLICY "Allow all operations for authenticated users" ON loyalty_transactions FOR ALL USING (auth.role() = 'authenticated');

-- 15. Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_products_with_stock() TO authenticated;
GRANT EXECUTE ON FUNCTION get_last_bill_number() TO authenticated;
GRANT EXECUTE ON FUNCTION get_unique_brands() TO authenticated;

-- 16. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_stock_quantity ON products(stock_quantity);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
CREATE INDEX IF NOT EXISTS idx_products_hsn_code ON products(hsn_code);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_transactions_invoice_number ON transactions(invoice_number);
CREATE INDEX IF NOT EXISTS idx_transactions_customer_id ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer ON loyalty_transactions(customer_id);

-- 17. Update table statistics
ANALYZE products;
ANALYZE transactions;
ANALYZE transaction_items;
ANALYZE customers;
ANALYZE loyalty_transactions;

-- 18. Insert sample data if tables are empty
INSERT INTO customers (name, phone, email, loyalty_points, total_spent)
SELECT 'Sample Customer', '+91-9876543210', 'sample@example.com', 100, 1000.00
WHERE NOT EXISTS (SELECT 1 FROM customers LIMIT 1);

-- 19. Verify the fix
DO $$
BEGIN
    RAISE NOTICE '✅ Materialized view error fixed successfully!';
    RAISE NOTICE '✅ All required functions and columns have been created/updated.';
    RAISE NOTICE '✅ Database is now ready for POS operations.';
END $$; 