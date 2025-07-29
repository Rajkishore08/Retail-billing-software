import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Optimized Supabase client for 3 active users - Maximum Performance
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Optimized for small team
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // Faster token refresh for continuous use
    flowType: 'pkce'
  },
  global: {
    // Optimized headers for small team
    headers: {
      'X-Client-Info': 'national-mini-mart-pos',
      'X-User-Count': '3' // Indicates small team usage
    }
  },
  // Real-time optimizations for continuous use
  realtime: {
    params: {
      eventsPerSecond: 10 // Higher for active POS usage
    }
  }
})

// High-performance monitoring for small team
export const getDatabaseStats = async () => {
  try {
    const { data, error } = await supabase.rpc('get_db_stats')
    if (error) throw error
    return data
  } catch (error) {
    console.error('Error fetching database stats:', error)
    return null
  }
}

// Optimized query functions for 3 users - No limits needed
export const optimizedQueries = {
  // Get all products without limits
  getProducts: async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('name')
      // No limit for small team
    
    if (error) throw error
    return data
  },

  // Get all recent transactions
  getRecentTransactions: async (limit = 200) => {
    const { data, error } = await supabase
      .from('transactions')
      .select(`
        *,
        transaction_items (*)
      `)
      .order('created_at', { ascending: false })
      .limit(limit) // Higher limit for small team
    
    if (error) throw error
    return data
  },

  // Get dashboard stats with caching
  getDashboardStats: async () => {
    const { data, error } = await supabase.rpc('get_dashboard_stats')
    if (error) throw error
    return data
  },

  // Get all customers
  getCustomers: async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name')
    
    if (error) throw error
    return data
  },

  // Get low stock products
  getLowStockProducts: async () => {
    const { data, error } = await supabase.rpc('get_low_stock_products')
    if (error) throw error
    return data
  }
}

// High-performance real-time subscriptions for POS
export const realtimeSubscriptions = {
  // Subscribe to product changes
  subscribeToProducts: (callback: (payload: any) => void) => {
    return supabase
      .channel('products')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'products' }, 
        callback
      )
      .subscribe()
  },

  // Subscribe to transaction changes
  subscribeToTransactions: (callback: (payload: any) => void) => {
    return supabase
      .channel('transactions')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'transactions' }, 
        callback
      )
      .subscribe()
  },

  // Subscribe to customer changes
  subscribeToCustomers: (callback: (payload: any) => void) => {
    return supabase
      .channel('customers')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'customers' }, 
        callback
      )
      .subscribe()
  }
}

// Fast batch operations for POS
export const batchOperations = {
  // Batch insert transaction items
  insertTransactionItems: async (items: any[]) => {
    const { data, error } = await supabase
      .from('transaction_items')
      .insert(items)
    
    if (error) throw error
    return data
  },

  // Batch update product stock
  updateProductStock: async (updates: { id: string; stock_quantity: number }[]) => {
    const promises = updates.map(update => 
      supabase
        .from('products')
        .update({ stock_quantity: update.stock_quantity })
        .eq('id', update.id)
    )
    
    const results = await Promise.all(promises)
    const errors = results.filter(r => r.error)
    
    if (errors.length > 0) {
      throw new Error('Some stock updates failed')
    }
    
    return results.map(r => r.data)
  }
}

// Database types for better type safety
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          role: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          role?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          role?: string
          created_at?: string
          updated_at?: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          price: number
          stock_quantity: number
          min_stock_level: number
          gst_rate: number
          price_includes_gst: boolean
          hsn_code: string | null
          brand: string | null
          barcode: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          price: number
          stock_quantity: number
          min_stock_level?: number
          gst_rate?: number
          price_includes_gst?: boolean
          hsn_code?: string | null
          brand?: string | null
          barcode?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          price?: number
          stock_quantity?: number
          min_stock_level?: number
          gst_rate?: number
          price_includes_gst?: boolean
          hsn_code?: string | null
          brand?: string | null
          barcode?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      customers: {
        Row: {
          id: string
          name: string
          phone: string
          email: string | null
          loyalty_points: number
          total_spent: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          phone: string
          email?: string | null
          loyalty_points?: number
          total_spent?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          phone?: string
          email?: string | null
          loyalty_points?: number
          total_spent?: number
          created_at?: string
          updated_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          invoice_number: string
          bill_number: string
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          subtotal: number
          gst_amount: number
          total_amount: number
          payment_method: string
          cash_received: number | null
          change_amount: number | null
          status: string
          loyalty_points_earned: number | null
          loyalty_points_redeemed: number | null
          loyalty_discount_amount: number | null
          rounding_adjustment: number | null
          cashier_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          invoice_number?: string
          bill_number?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          subtotal: number
          gst_amount: number
          total_amount: number
          payment_method: string
          cash_received?: number | null
          change_amount?: number | null
          status?: string
          loyalty_points_earned?: number | null
          loyalty_points_redeemed?: number | null
          loyalty_discount_amount?: number | null
          rounding_adjustment?: number | null
          cashier_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          invoice_number?: string
          bill_number?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          subtotal?: number
          gst_amount?: number
          total_amount?: number
          payment_method?: string
          cash_received?: number | null
          change_amount?: number | null
          status?: string
          loyalty_points_earned?: number | null
          loyalty_points_redeemed?: number | null
          loyalty_discount_amount?: number | null
          rounding_adjustment?: number | null
          cashier_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      transaction_items: {
        Row: {
          id: string
          transaction_id: string
          product_name: string
          quantity: number
          unit_price: number
          total_price: number
          gst_rate: number
          price_includes_gst: boolean
          created_at: string
        }
        Insert: {
          id?: string
          transaction_id: string
          product_name: string
          quantity: number
          unit_price: number
          total_price: number
          gst_rate: number
          price_includes_gst: boolean
          created_at?: string
        }
        Update: {
          id?: string
          transaction_id?: string
          product_name?: string
          quantity?: number
          unit_price?: number
          total_price?: number
          gst_rate?: number
          price_includes_gst?: boolean
          created_at?: string
        }
      }
      loyalty_transactions: {
        Row: {
          id: string
          customer_id: string
          transaction_id: string
          points_earned: number
          points_redeemed: number
          discount_amount: number
          transaction_type: string
          created_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          transaction_id: string
          points_earned?: number
          points_redeemed?: number
          discount_amount?: number
          transaction_type: string
          created_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          transaction_id?: string
          points_earned?: number
          points_redeemed?: number
          discount_amount?: number
          transaction_type?: string
          created_at?: string
        }
      }
      auth_logs: {
        Row: {
          id: string
          user_id: string
          success: boolean
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          success: boolean
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          success?: boolean
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      dashboard_stats: {
        Row: {
          total_products: number | null
          total_customers: number | null
          monthly_revenue: number | null
        }
      }
    }
    Functions: {
      get_dashboard_stats: {
        Args: Record<string, never>
        Returns: {
          total_products: number
          total_customers: number
          monthly_revenue: number
        }[]
      }
      get_customer_with_loyalty: {
        Args: {
          phone: string
        }
        Returns: {
          id: string
          name: string
          phone: string
          email: string | null
          loyalty_points: number
          total_spent: number
        }[]
      }
      get_last_bill_number: {
        Args: Record<string, never>
        Returns: string
      }
      get_products_with_stock: {
        Args: Record<string, never>
        Returns: {
          id: string
          name: string
          price: number
          stock_quantity: number
          gst_rate: number
          price_includes_gst: boolean
          hsn_code: string | null
          brand: string | null
          barcode: string | null
          created_at: string
          updated_at: string
        }[]
      }
      get_products_by_brand: {
        Args: {
          brand_name: string
        }
        Returns: {
          id: string
          name: string
          price: number
          stock_quantity: number
          gst_rate: number
          price_includes_gst: boolean
          hsn_code: string | null
          brand: string | null
          barcode: string | null
        }[]
      }
      get_unique_brands: {
        Args: Record<string, never>
        Returns: {
          brand: string
        }[]
      }
      get_low_stock_products: {
        Args: Record<string, never>
        Returns: {
          id: string
          name: string
          stock_quantity: number
          min_stock_level: number
        }[]
      }
      get_db_stats: {
        Args: Record<string, never>
        Returns: {
          active_connections: number
          total_transactions: number
          total_products: number
          total_customers: number
          db_size: string
        }[]
      }
    }
  }
}
