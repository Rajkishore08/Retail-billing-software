-- Drop existing tables if they exist (for clean setup)
DROP TABLE IF EXISTS loyalty_transactions CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

-- Create customers table
CREATE TABLE customers (
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

-- Create loyalty_transactions table to track point history
CREATE TABLE loyalty_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  points_earned INTEGER NOT NULL,
  points_redeemed INTEGER DEFAULT 0,
  transaction_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add customer_id to transactions table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'transactions' AND column_name = 'customer_id') THEN
        ALTER TABLE transactions ADD COLUMN customer_id UUID REFERENCES customers(id);
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_loyalty_points ON customers(loyalty_points);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer ON loyalty_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON customers;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON loyalty_transactions;

CREATE POLICY "Allow all operations for authenticated users" ON customers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all operations for authenticated users" ON loyalty_transactions FOR ALL USING (auth.role() = 'authenticated');

-- Create or replace function for updating customer stats
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update customer stats when a transaction is completed
  IF NEW.status = 'completed' AND NEW.customer_id IS NOT NULL THEN
    -- Update customer statistics
    UPDATE customers 
    SET 
      total_spent = total_spent + NEW.total_amount,
      visit_count = visit_count + 1,
      last_visit = NEW.created_at,
      loyalty_points = loyalty_points + FLOOR(NEW.total_amount / 100)::INTEGER,
      updated_at = NOW()
    WHERE id = NEW.customer_id;
    
    -- Record loyalty transaction
    INSERT INTO loyalty_transactions (
      customer_id,
      transaction_id,
      points_earned,
      transaction_amount
    ) VALUES (
      NEW.customer_id,
      NEW.id,
      FLOOR(NEW.total_amount / 100)::INTEGER,
      NEW.total_amount
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_customer_stats_trigger ON transactions;

-- Create trigger
CREATE TRIGGER update_customer_stats_trigger
  AFTER INSERT OR UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_stats();

-- Create trigger for updating customer updated_at
DROP TRIGGER IF EXISTS update_customers_updated_at ON customers;
CREATE TRIGGER update_customers_updated_at 
  BEFORE UPDATE ON customers 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample customers
INSERT INTO customers (name, phone, email, address, loyalty_points, total_spent, visit_count, last_visit) VALUES
('Rajesh Kumar', '+91-9876543210', 'rajesh@example.com', '123 Main Street, Delhi', 150, 15000.00, 25, NOW() - INTERVAL '2 days'),
('Priya Sharma', '+91-9876543211', 'priya@example.com', '456 Park Avenue, Mumbai', 89, 8900.00, 18, NOW() - INTERVAL '1 day'),
('Amit Singh', '+91-9876543212', 'amit@example.com', '789 Garden Road, Bangalore', 234, 23400.00, 42, NOW() - INTERVAL '3 hours'),
('Sunita Patel', '+91-9876543213', 'sunita@example.com', '321 Lake View, Pune', 67, 6700.00, 12, NOW() - INTERVAL '1 week'),
('Vikram Gupta', '+91-9876543214', 'vikram@example.com', '654 Hill Station, Chennai', 178, 17800.00, 31, NOW() - INTERVAL '5 days'),
('Meera Joshi', '+91-9876543215', 'meera@example.com', '987 River Side, Kolkata', 45, 4500.00, 8, NOW() - INTERVAL '2 weeks'),
('Ravi Agarwal', '+91-9876543216', 'ravi@example.com', '147 Mountain View, Hyderabad', 312, 31200.00, 55, NOW() - INTERVAL '1 day'),
('Kavita Reddy', '+91-9876543217', 'kavita@example.com', '258 Garden City, Pune', 98, 9800.00, 22, NOW() - INTERVAL '4 days')
ON CONFLICT (phone) DO NOTHING;

-- Create some sample loyalty transactions
DO $$
DECLARE
    customer_record RECORD;
    sample_transaction_id UUID;
BEGIN
    -- Create sample transactions for existing customers
    FOR customer_record IN SELECT id, total_spent FROM customers LIMIT 3 LOOP
        -- Insert a sample transaction
        INSERT INTO transactions (
            invoice_number,
            cashier_id,
            customer_id,
            subtotal,
            gst_amount,
            total_amount,
            payment_method,
            status,
            created_at
        ) VALUES (
            'NMM-' || LPAD((RANDOM() * 999999)::INTEGER::TEXT, 6, '0'),
            (SELECT id FROM profiles LIMIT 1),
            customer_record.id,
            500.00,
            90.00,
            590.00,
            'cash',
            'completed',
            NOW() - (RANDOM() * INTERVAL '30 days')
        ) RETURNING id INTO sample_transaction_id;
        
        -- Insert transaction items
        INSERT INTO transaction_items (
            transaction_id,
            product_id,
            product_name,
            quantity,
            unit_price,
            total_price,
            gst_rate
        ) VALUES (
            sample_transaction_id,
            (SELECT id FROM products LIMIT 1),
            'Sample Product',
            2,
            250.00,
            500.00,
            18.00
        );
    END LOOP;
END $$;

DO $$
BEGIN
    RAISE NOTICE 'Customer and loyalty system setup completed successfully!';
END $$;
