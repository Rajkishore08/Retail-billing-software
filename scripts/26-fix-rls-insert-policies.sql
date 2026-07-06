-- ============================================================
-- Script 26: Fix RLS Policies for INSERT operations
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Fix customers table RLS (most important - fixes "new row violates row level security")
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON customers;
CREATE POLICY "Allow all operations for authenticated users"
  ON customers FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Fix credit_ledger table RLS
DROP POLICY IF EXISTS "Allow all operations for authenticated users on credit_ledger" ON credit_ledger;
CREATE POLICY "Allow all operations for authenticated users on credit_ledger"
  ON credit_ledger FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Fix loyalty_transactions table RLS
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON loyalty_transactions;
CREATE POLICY "Allow all operations for authenticated users"
  ON loyalty_transactions FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Fix transactions table RLS
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON transactions;
CREATE POLICY "Allow all operations for authenticated users"
  ON transactions FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Fix transaction_items table RLS
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON transaction_items;
CREATE POLICY "Allow all operations for authenticated users"
  ON transaction_items FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Fix products table RLS
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON products;
CREATE POLICY "Allow all operations for authenticated users"
  ON products FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Fix stock_movements table RLS
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON stock_movements;
CREATE POLICY "Allow all operations for authenticated users"
  ON stock_movements FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Fix settings table RLS
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON settings;
CREATE POLICY "Allow all operations for authenticated users"
  ON settings FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Fix categories table RLS
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON categories;
CREATE POLICY "Allow all operations for authenticated users"
  ON categories FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Fix profiles table RLS
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON profiles;
CREATE POLICY "Allow all operations for authenticated users"
  ON profiles FOR ALL
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Verify all policies are set correctly
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
