-- Create a function to get low stock products
CREATE OR REPLACE FUNCTION get_low_stock_products(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  name TEXT,
  stock_quantity INTEGER,
  min_stock_level INTEGER,
  categories JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.stock_quantity,
    p.min_stock_level,
    CASE 
      WHEN c.name IS NOT NULL THEN 
        jsonb_build_object('name', c.name)
      ELSE 
        NULL
    END as categories
  FROM products p
  LEFT JOIN categories c ON p.category_id = c.id
  WHERE p.stock_quantity <= p.min_stock_level
  ORDER BY p.stock_quantity ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_low_stock_products(INTEGER) TO authenticated;

DO $$
BEGIN
    RAISE NOTICE 'Low stock function created successfully!';
END $$;
