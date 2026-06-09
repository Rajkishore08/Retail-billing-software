import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase environment variables")
  console.error("URL:", supabaseUrl)
  console.error("Key:", supabaseAnonKey ? "Present" : "Missing")
}

export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          role: "admin" | "cashier" | "manager"
          created_at: string
          updated_at: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          barcode: string | null
          price: number
          stock_quantity: number
          min_stock_level: number
          category_id: string | null
          gst_rate: number
          created_at: string
          updated_at: string
        }
      }
      transactions: {
        Row: {
          id: string
          invoice_number: string
          cashier_id: string | null
          customer_id: string | null
          subtotal: number
          gst_amount: number
          total_amount: number
          payment_method: "cash" | "card" | "upi"
          cash_received: number | null
          change_amount: number | null
          status: "completed" | "cancelled" | "pending"
          created_at: string
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
        }
      }
      categories: {
        Row: {
          id: string
          name: string
          created_at: string
        }
      }
    }
  }
}
