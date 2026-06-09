const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables from .env.local
try {
  const envPath = path.resolve(process.cwd(), '.env.local')
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8')
    envFile.split('\n').forEach(line => {
      const parts = line.split('=')
      if (parts.length >= 2) {
        const key = parts[0].trim()
        const val = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '')
        if (key) process.env[key] = val
      }
    })
  }
} catch (err) {
  console.warn('Warning: Could not parse .env.local file:', err.message)
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing')
  console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'Set' : 'Missing')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testDatabaseConnection() {
  console.log('Testing database connection...')
  
  try {
    // Test 1: Basic connection
    console.log('\n1. Testing basic connection...')
    const { data: testData, error: testError } = await supabase
      .from('products')
      .select('id, name')
      .limit(1)
    
    if (testError) {
      console.error('❌ Basic connection failed:', testError)
      return
    }
    console.log('✅ Basic connection successful')
    
    // Test 2: Check if new columns exist
    console.log('\n2. Checking for new columns...')
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, cost_price, mrp, selling_price')
      .limit(1)
    
    if (productsError) {
      console.error('❌ New columns check failed:', productsError)
      console.log('This suggests the database script needs to be run')
      return
    }
    
    console.log('✅ New columns exist')
    console.log('Sample product data:', products?.[0])
    
    // Test 3: Check settings table
    console.log('\n3. Checking settings table...')
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('key, value')
      .limit(5)
    
    if (settingsError) {
      console.error('❌ Settings table check failed:', settingsError)
    } else {
      console.log('✅ Settings table accessible')
      console.log('Settings:', settings)
    }
    
    // Test 4: Check transactions table structure
    console.log('\n4. Checking transactions table...')
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('id, discount_amount, discount_percentage, total_savings')
      .limit(1)
    
    if (transactionsError) {
      console.error('❌ Transactions table check failed:', transactionsError)
      console.log('This suggests the database script needs to be run')
    } else {
      console.log('✅ Transactions table has new columns')
    }
    
    console.log('\n🎉 Database connection test completed successfully!')
    
  } catch (error) {
    console.error('❌ Test failed with error:', error)
  }
}

testDatabaseConnection() 