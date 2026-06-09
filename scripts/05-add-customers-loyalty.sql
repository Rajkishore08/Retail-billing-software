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

-- Add customer_id to transactions table
ALTER TABLE transactions ADD COLUMN customer_id UUID REFERENCES customers(id);

-- Create indexes for better performance
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_loyalty_points ON customers(loyalty_points);
CREATE INDEX idx_loyalty_transactions_customer ON loyalty_transactions(customer_id);

-- Enable RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow all operations for authenticated users" ON customers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all operations for authenticated users" ON loyalty_transactions FOR ALL USING (auth.role() = 'authenticated');

-- Create trigger for updating customer stats
CREATE OR REPLACE FUNCTION update_customer_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update customer stats when a transaction is completed
  IF NEW.status = 'completed' AND NEW.customer_id IS NOT NULL THEN
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

-- Create trigger
CREATE TRIGGER update_customer_stats_trigger
  AFTER INSERT OR UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_stats();

-- Create trigger for updating customer updated_at
CREATE TRIGGER update_customers_updated_at 
  BEFORE UPDATE ON customers 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample customers
INSERT INTO customers (name, phone, email, address, loyalty_points, total_spent, visit_count) VALUES
('Rajesh Kumar', '+91-9876543210', 'rajesh@example.com', '123 Main Street, Delhi', 150, 15000.00, 25),
('Priya Sharma', '+91-9876543211', 'priya@example.com', '456 Park Avenue, Mumbai', 89, 8900.00, 18),
('Amit Singh', '+91-9876543212', 'amit@example.com', '789 Garden Road, Bangalore', 234, 23400.00, 42),
('Sunita Patel', '+91-9876543213', 'sunita@example.com', '321 Lake View, Pune', 67, 6700.00, 12),
('Vikram Gupta', '+91-9876543214', 'vikram@example.com', '654 Hill Station, Chennai', 178, 17800.00, 31);

DO $$
BEGIN
    RAISE NOTICE 'Customer and loyalty system setup completed successfully!';
END $$;
