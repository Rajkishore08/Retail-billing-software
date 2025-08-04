-- Fix transaction_items table to include selling_price column
-- This script adds missing columns to the transaction_items table

-- Add selling_price column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transaction_items' 
        AND column_name = 'selling_price'
    ) THEN
        ALTER TABLE transaction_items ADD COLUMN selling_price DECIMAL(10,2);
    END IF;
END $$;

-- Add item_discount_amount column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transaction_items' 
        AND column_name = 'item_discount_amount'
    ) THEN
        ALTER TABLE transaction_items ADD COLUMN item_discount_amount DECIMAL(10,2) DEFAULT 0;
    END IF;
END $$;

-- Add item_discount_percentage column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transaction_items' 
        AND column_name = 'item_discount_percentage'
    ) THEN
        ALTER TABLE transaction_items ADD COLUMN item_discount_percentage DECIMAL(5,2) DEFAULT 0;
    END IF;
END $$;

-- Add cost_price column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transaction_items' 
        AND column_name = 'cost_price'
    ) THEN
        ALTER TABLE transaction_items ADD COLUMN cost_price DECIMAL(10,2);
    END IF;
END $$;

-- Add mrp column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transaction_items' 
        AND column_name = 'mrp'
    ) THEN
        ALTER TABLE transaction_items ADD COLUMN mrp DECIMAL(10,2);
    END IF;
END $$;

-- Update existing records to set selling_price = unit_price if selling_price is null
UPDATE transaction_items 
SET selling_price = unit_price 
WHERE selling_price IS NULL;

-- Update existing records to set cost_price = 0 if cost_price is null
UPDATE transaction_items 
SET cost_price = 0 
WHERE cost_price IS NULL;

-- Update existing records to set mrp = unit_price if mrp is null
UPDATE transaction_items 
SET mrp = unit_price 
WHERE mrp IS NULL;

-- Grant permissions
GRANT ALL ON transaction_items TO authenticated;
GRANT ALL ON transaction_items TO anon;

-- Success message
SELECT 'Transaction items table updated successfully!' as message; 