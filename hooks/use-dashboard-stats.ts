import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase-client'

interface DashboardStats {
  totalProducts: number
  totalCustomers: number
  monthlyRevenue: number
  totalTransactionsToday?: number
  totalSalesToday?: number
  totalSavingsToday?: number
  uniqueCustomersToday?: number
  avgTransactionValueToday?: number
  lowStockProductsCount?: number
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalCustomers: 0,
    monthlyRevenue: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true)
      setError(null)

      // Try fetching stats using the optimized single RPC function
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_dashboard_stats_optimized')

      if (!rpcError && rpcData && rpcData.length > 0) {
        const row = rpcData[0]
        setStats({
          totalProducts: Number(row.total_products) || 0,
          totalCustomers: Number(row.total_customers) || 0,
          monthlyRevenue: Number(row.monthly_revenue) || 0,
          totalTransactionsToday: Number(row.total_transactions_today) || 0,
          totalSalesToday: Number(row.total_sales_today) || 0,
          totalSavingsToday: Number(row.total_savings_today) || 0,
          uniqueCustomersToday: Number(row.unique_customers_today) || 0,
          avgTransactionValueToday: Number(row.avg_transaction_value_today) || 0,
          lowStockProductsCount: Number(row.low_stock_products_count) || 0,
        })
      } else {
        // Fallback to legacy behavior if optimized RPC is not available in DB
        const today = new Date()
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59)

        const { count: productsCount, error: productsError } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })

        if (productsError) throw productsError

        const { count: customersCount, error: customersError } = await supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })

        if (customersError) throw customersError

        const { data: monthlyRevenueData, error: monthlyRevenueError } = await supabase
          .from('transactions')
          .select('total_amount')
          .gte('created_at', startOfMonth.toISOString())
          .lte('created_at', endOfMonth.toISOString())
          .eq('status', 'completed')

        if (monthlyRevenueError) throw monthlyRevenueError

        const monthlyRevenue = monthlyRevenueData?.reduce((sum, transaction) => sum + (transaction.total_amount || 0), 0) || 0

        setStats({
          totalProducts: productsCount || 0,
          totalCustomers: customersCount || 0,
          monthlyRevenue,
        })
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
      setError('Failed to load dashboard statistics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      fetchStats()
    }
  }, [fetchStats])

  // FIX: Empty dependency array so this interval is created ONCE and never re-created.
  // The previous bug had `lastFetch` (state) in the dep array — every fetch updated lastFetch
  // → React tore down the old interval and created a new one → after a minute you had
  // dozens of overlapping timers all firing DB calls simultaneously → runaway slowdown.
  useEffect(() => {
    const interval = setInterval(() => {
      fetchStats(true) // silent refresh every 30s, no loading skeleton flicker
    }, 30000)

    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // ← intentionally empty: one interval, one cleanup

  return { ...stats, loading, error, refresh: () => fetchStats(false) }
}