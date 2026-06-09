-- Add HSN code and brand fields to products table

-- Add HSN code column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(10);

-- Add brand column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS brand VARCHAR(100);

-- Update existing products to have default values
UPDATE products SET hsn_code = '999999' WHERE hsn_code IS NULL;
UPDATE products SET brand = 'Generic' WHERE brand IS NULL;

-- Create index for HSN code for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_hsn_code ON products(hsn_code);

-- Create index for brand for faster filtering
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);

-- Drop existing function first (if it exists)
DROP FUNCTION IF EXISTS get_products_with_stock();

-- Create function to get products with stock (including new fields)
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

-- Drop existing function first (if it exists)
DROP FUNCTION IF EXISTS get_products_by_brand(VARCHAR(100));

-- Create function to get products by brand
CREATE OR REPLACE FUNCTION get_products_by_brand(brand_name VARCHAR(100))
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
  WHERE p.brand = brand_name
  AND p.stock_quantity > 0
  ORDER BY p.name;
END;
$$ LANGUAGE plpgsql;

-- Drop existing function first (if it exists)
DROP FUNCTION IF EXISTS get_unique_brands();

-- Create function to get unique brands
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