-- Fix loyalty_transactions table
-- This script creates the loyalty_transactions table if it doesn't exist and adds missing columns

-- Create loyalty_transactions table if it doesn't exist
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

-- Add missing columns if they don't exist
DO $$ 
BEGIN
    -- Add points_earned column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'loyalty_transactions' 
        AND column_name = 'points_earned'
    ) THEN
        ALTER TABLE loyalty_transactions ADD COLUMN points_earned INTEGER DEFAULT 0;
    END IF;
    
    -- Add points_redeemed column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'loyalty_transactions' 
        AND column_name = 'points_redeemed'
    ) THEN
        ALTER TABLE loyalty_transactions ADD COLUMN points_redeemed INTEGER DEFAULT 0;
    END IF;
    
    -- Add discount_amount column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'loyalty_transactions' 
        AND column_name = 'discount_amount'
    ) THEN
        ALTER TABLE loyalty_transactions ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0;
    END IF;
    
    -- Add transaction_type column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'loyalty_transactions' 
        AND column_name = 'transaction_type'
    ) THEN
        ALTER TABLE loyalty_transactions ADD COLUMN transaction_type TEXT CHECK (transaction_type IN ('earned', 'redeemed'));
    END IF;
    
    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'loyalty_transactions' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE loyalty_transactions ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer_id ON loyalty_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_transaction_id ON loyalty_transactions(transaction_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_created_at ON loyalty_transactions(created_at);

-- Grant permissions
GRANT ALL ON loyalty_transactions TO authenticated;
GRANT ALL ON loyalty_transactions TO anon;

-- Create RLS policies
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read their own loyalty transactions
CREATE POLICY "Users can view their own loyalty transactions" ON loyalty_transactions
  FOR SELECT USING (
    auth.uid() IN (
      SELECT cashier_id FROM transactions WHERE id = loyalty_transactions.transaction_id
    )
  );

-- Policy for authenticated users to insert loyalty transactions
CREATE POLICY "Users can insert loyalty transactions" ON loyalty_transactions
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT cashier_id FROM transactions WHERE id = loyalty_transactions.transaction_id
    )
  );

-- Success message
SELECT 'Loyalty transactions table updated successfully!' as message; 