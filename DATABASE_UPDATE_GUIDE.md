# Database Update Guide

## How to Fix the 400 Errors

The 400 errors you're seeing are because the database functions haven't been properly deployed. Follow these steps to fix them:

### Step 1: Open Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to the **SQL Editor** section

### Step 2: Run the Database Update Script
1. Copy the entire contents of `scripts/20-apply-all-changes.sql`
2. Paste it into the SQL Editor
3. Click **Run** to execute the script

### Step 3: Verify the Changes
After running the script, you should see:
- A success message: "Database update completed successfully! All new features are now available."
- No error messages

### What This Script Does

The script will:

1. **Add new columns to products table:**
   - `cost_price` - Cost price of the product
   - `mrp` - Maximum Retail Price
   - `selling_price` - Current selling price

2. **Add discount fields to transactions:**
   - `discount_amount` - Total discount amount
   - `discount_percentage` - Discount percentage
   - `total_savings` - Total customer savings

3. **Add discount fields to transaction_items:**
   - `item_discount_amount` - Individual item discount
   - `item_discount_percentage` - Item discount percentage
   - `cost_price` and `mrp` - For tracking item-level pricing

4. **Create new analytics functions:**
   - `get_sales_analytics()` - For dashboard charts
   - `get_top_selling_products()` - Top products analysis
   - `get_sales_by_category()` - Category-wise sales
   - `get_daily_sales_trend()` - Daily sales trends
   - `calculate_product_savings()` - Product savings calculation

5. **Update existing functions:**
   - `get_products_with_stock()` - Now includes new pricing fields

6. **Create materialized views:**
   - `dashboard_stats` - For fast dashboard loading

7. **Add performance indexes and settings**

### Step 4: Test the Application
After running the script:
1. Refresh your application
2. Go to the Dashboard - you should see the new Sales Analytics tab
3. Go to POS - you should see discount options
4. Go to Products - you should see new pricing fields

### Troubleshooting

If you still see 400 errors after running the script:

1. **Check if the script ran successfully:**
   ```sql
   SELECT * FROM dashboard_stats LIMIT 1;
   ```

2. **Verify functions exist:**
   ```sql
   SELECT routine_name FROM information_schema.routines 
   WHERE routine_name IN ('get_sales_analytics', 'get_top_selling_products', 'get_sales_by_category');
   ```

3. **Check permissions:**
   ```sql
   SELECT grantee, privilege_type FROM information_schema.role_table_grants 
   WHERE table_name = 'dashboard_stats';
   ```

### New Features Available After Update

1. **Enhanced Product Pricing:**
   - Cost price, MRP, and selling price fields
   - Automatic savings calculation
   - Customer savings display

2. **Discount Management:**
   - Percentage and fixed amount discounts
   - Quick discount buttons (5%, 10%, etc.)
   - Discount tracking in receipts

3. **Sales Analytics Dashboard:**
   - Sales trends charts
   - Top selling products
   - Category-wise sales analysis
   - Daily sales trends

4. **Performance Improvements:**
   - Materialized views for faster loading
   - Optimized database indexes
   - Cached dashboard statistics

### Next Steps

After successfully running the script:
1. The 400 errors should be resolved
2. All new features will be available
3. The application will load faster due to optimizations

If you encounter any issues, please share the specific error messages and I'll help you resolve them. 