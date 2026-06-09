-- Test Database Setup
-- This script checks if all required tables and columns exist

-- 1. Check if all required tables exist
SELECT 
  table_name,
  CASE WHEN table_name IN ('products', 'transactions', 'transaction_items', 'customers', 'loyalty_transactions') 
       THEN '✅ EXISTS' 
       ELSE '❌ MISSING' 
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('products', 'transactions', 'transaction_items', 'customers', 'loyalty_transactions');

-- 2. Check products table columns
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'products'
ORDER BY ordinal_position;

-- 3. Check transactions table columns
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'transactions'
ORDER BY ordinal_position;

-- 4. Check transaction_items table columns
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'transaction_items'
ORDER BY ordinal_position;

-- 5. Check if required functions exist
SELECT 
  routine_name,
  CASE WHEN routine_name IN ('get_products_with_stock', 'get_last_bill_number', 'get_unique_brands') 
       THEN '✅ EXISTS' 
       ELSE '❌ MISSING' 
  END as status
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('get_products_with_stock', 'get_last_bill_number', 'get_unique_brands');

-- 6. Test the get_products_with_stock function
SELECT * FROM get_products_with_stock() LIMIT 3;

-- 7. Test the get_last_bill_number function
SELECT get_last_bill_number();

-- 8. Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('products', 'transactions', 'transaction_items', 'customers', 'loyalty_transactions');

-- 9. Check if sample data exists
SELECT 'Products count:' as info, COUNT(*) as count FROM products
UNION ALL
SELECT 'Customers count:', COUNT(*) FROM customers
UNION ALL
SELECT 'Transactions count:', COUNT(*) FROM transactions;

-- 10. Test inserting a sample transaction item
DO $$
DECLARE
  test_transaction_id UUID;
  test_product_id UUID;
BEGIN
  -- Get a sample transaction ID
  SELECT id INTO test_transaction_id FROM transactions LIMIT 1;
  
  -- Get a sample product ID
  SELECT id INTO test_product_id FROM products LIMIT 1;
  
  IF test_transaction_id IS NOT NULL AND test_product_id IS NOT NULL THEN
    -- Try to insert a test transaction item
    INSERT INTO transaction_items (
      transaction_id,
      product_id,
      product_name,
      quantity,
      unit_price,
      total_price,
      gst_rate,
      price_includes_gst
    ) VALUES (
      test_transaction_id,
      test_product_id,
      'Test Product',
      1,
      100.00,
      100.00,
      18.00,
      false
    );
    
    RAISE NOTICE '✅ Transaction items table is working correctly';
    
    -- Clean up test data
    DELETE FROM transaction_items WHERE product_name = 'Test Product';
  ELSE
    RAISE NOTICE '❌ No sample data available for testing';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '❌ Error testing transaction_items: %', SQLERRM;
END $$; 