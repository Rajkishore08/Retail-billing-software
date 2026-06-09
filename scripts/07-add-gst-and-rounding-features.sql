-- Add missing GST and rounding features to database

-- Add price_includes_gst column to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_includes_gst BOOLEAN DEFAULT false;

-- Add rounding_adjustment column to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS rounding_adjustment DECIMAL(10,2) DEFAULT 0.00;

-- Add price_includes_gst column to transaction_items table
ALTER TABLE transaction_items ADD COLUMN IF NOT EXISTS price_includes_gst BOOLEAN DEFAULT false;

-- Update existing products to have price_includes_gst = false (exclusive pricing)
UPDATE products SET price_includes_gst = false WHERE price_includes_gst IS NULL;

-- Update existing transactions to have rounding_adjustment = 0
UPDATE transactions SET rounding_adjustment = 0.00 WHERE rounding_adjustment IS NULL;

-- Update existing transaction_items to have price_includes_gst = false
UPDATE transaction_items SET price_includes_gst = false WHERE price_includes_gst IS NULL; 