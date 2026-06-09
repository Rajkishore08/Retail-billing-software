-- ============================================================
-- Script 24: Add Credit Payment + Fix Customer Save
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Step 1: Add 'credit' to payment_method ENUM
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'credit';

-- Step 2: Create credit_ledger table to track all credit transactions
CREATE TABLE IF NOT EXISTS credit_ledger (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,            -- positive = credit given, negative = payment received
  entry_type TEXT NOT NULL CHECK (entry_type IN ('credit_sale', 'payment_received', 'adjustment')),
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Add outstanding_credit column to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS outstanding_credit DECIMAL(10,2) DEFAULT 0;

-- Step 4: Enable RLS on credit_ledger
ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations for authenticated users on credit_ledger"
  ON credit_ledger FOR ALL
  USING (auth.role() = 'authenticated');

-- Step 5: Create index for fast customer credit lookups
CREATE INDEX IF NOT EXISTS idx_credit_ledger_customer_id ON credit_ledger(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_created_at ON credit_ledger(created_at DESC);

-- Step 6: Ensure customers table has all required columns with defaults
ALTER TABLE customers ALTER COLUMN loyalty_points SET DEFAULT 0;
ALTER TABLE customers ALTER COLUMN total_spent SET DEFAULT 0;
ALTER TABLE customers ALTER COLUMN visit_count SET DEFAULT 0;
ALTER TABLE customers ALTER COLUMN outstanding_credit SET DEFAULT 0;

-- Confirmation
SELECT 'Credit system setup complete!' as status;
