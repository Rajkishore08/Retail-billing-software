-- ============================================================
-- Script 25: Add Missing Customer Columns
-- Run this in your Supabase SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS)
-- ============================================================

-- Add address column if missing
ALTER TABLE customers ADD COLUMN IF NOT EXISTS address TEXT;

-- Add date_of_birth column if missing
ALTER TABLE customers ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Add outstanding_credit column if missing (also needed for credit feature)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS outstanding_credit DECIMAL(10,2) DEFAULT 0;

-- Add updated_at column if missing
ALTER TABLE customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Set defaults on existing optional columns
UPDATE customers SET address = NULL WHERE address = '';
UPDATE customers SET date_of_birth = NULL WHERE date_of_birth::text = '';
UPDATE customers SET outstanding_credit = 0 WHERE outstanding_credit IS NULL;

-- Confirmation
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'customers'
ORDER BY ordinal_position;
