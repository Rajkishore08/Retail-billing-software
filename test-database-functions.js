// Test script to verify database functions are working
const { createClient } = require('@supabase/supabase-js')

// Replace with your actual Supabase URL and anon key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testDatabaseFunctions() {
  console.log('Testing database functions...')

  try {
    // Test 1: Check if get_products_with_stock function exists
    console.log('\n1. Testing get_products_with_stock function...')
    const { data: products, error: productsError } = await supabase.rpc('get_products_with_stock')
    
    if (productsError) {
      console.error('❌ get_products_with_stock failed:', productsError)
    } else {
      console.log('✅ get_products_with_stock working:', products?.length || 0, 'products found')
      if (products && products.length > 0) {
        console.log('Sample product:', products[0])
      }
    }

    // Test 2: Check if get_sales_analytics function exists
    console.log('\n2. Testing get_sales_analytics function...')
    const { data: analytics, error: analyticsError } = await supabase.rpc('get_sales_analytics')
    
    if (analyticsError) {
      console.error('❌ get_sales_analytics failed:', analyticsError)
    } else {
      console.log('✅ get_sales_analytics working:', analytics?.length || 0, 'records found')
    }

    // Test 3: Check if get_top_selling_products function exists
    console.log('\n3. Testing get_top_selling_products function...')
    const { data: topProducts, error: topProductsError } = await supabase.rpc('get_top_selling_products')
    
    if (topProductsError) {
      console.error('❌ get_top_selling_products failed:', topProductsError)
    } else {
      console.log('✅ get_top_selling_products working:', topProducts?.length || 0, 'products found')
    }

    // Test 4: Check if get_sales_by_category function exists
    console.log('\n4. Testing get_sales_by_category function...')
    const { data: categorySales, error: categoryError } = await supabase.rpc('get_sales_by_category')
    
    if (categoryError) {
      console.error('❌ get_sales_by_category failed:', categoryError)
    } else {
      console.log('✅ get_sales_by_category working:', categorySales?.length || 0, 'categories found')
    }

    // Test 5: Check if get_daily_sales_trend function exists
    console.log('\n5. Testing get_daily_sales_trend function...')
    const { data: dailyTrend, error: trendError } = await supabase.rpc('get_daily_sales_trend')
    
    if (trendError) {
      console.error('❌ get_daily_sales_trend failed:', trendError)
    } else {
      console.log('✅ get_daily_sales_trend working:', dailyTrend?.length || 0, 'days found')
    }

    // Test 6: Check if dashboard_stats materialized view exists
    console.log('\n6. Testing dashboard_stats materialized view...')
    const { data: dashboardStats, error: statsError } = await supabase
      .from('dashboard_stats')
      .select('*')
      .limit(1)
    
    if (statsError) {
      console.error('❌ dashboard_stats failed:', statsError)
    } else {
      console.log('✅ dashboard_stats working:', dashboardStats?.length || 0, 'records found')
      if (dashboardStats && dashboardStats.length > 0) {
        console.log('Dashboard stats:', dashboardStats[0])
      }
    }

    console.log('\n🎉 Database function tests completed!')

  } catch (error) {
    console.error('❌ Test failed with error:', error)
  }
}

testDatabaseFunctions() 