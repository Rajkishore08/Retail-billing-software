-- Add loyalty redemption functionality

-- Add loyalty_points_redeemed column to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS loyalty_points_redeemed INTEGER DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS loyalty_discount_amount DECIMAL(10,2) DEFAULT 0.00;

-- Add loyalty_points_earned column to transactions table (if not exists)
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS loyalty_points_earned INTEGER DEFAULT 0;

-- Update existing transactions to have default values
UPDATE transactions SET loyalty_points_redeemed = 0 WHERE loyalty_points_redeemed IS NULL;
UPDATE transactions SET loyalty_discount_amount = 0.00 WHERE loyalty_discount_amount IS NULL;
UPDATE transactions SET loyalty_points_earned = 0 WHERE loyalty_points_earned IS NULL;

-- Create loyalty_transactions table for tracking point history
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

-- Enable RLS for loyalty_transactions
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for loyalty_transactions
CREATE POLICY "Allow all operations for authenticated users" ON loyalty_transactions FOR ALL USING (auth.role() = 'authenticated'); 