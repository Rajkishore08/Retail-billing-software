import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase-client'

interface DashboardStats {
  totalProducts: number
  totalCustomers: number
  monthlyRevenue: number
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalCustomers: 0,
    monthlyRevenue: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<number>(0)

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Get current month range
      const today = new Date()
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59)

      // Fetch total products count - using simple count query
      const { count: productsCount, error: productsError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })

      if (productsError) {
        console.error('Error fetching products count:', productsError)
        throw productsError
      }

      // Fetch total customers count - using simple count query
      const { count: customersCount, error: customersError } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })

      if (customersError) {
        console.error('Error fetching customers count:', customersError)
        throw customersError
      }

      // Fetch monthly revenue - using simple select query
      const { data: monthlyRevenueData, error: monthlyRevenueError } = await supabase
        .from('transactions')
        .select('total_amount')
        .gte('created_at', startOfMonth.toISOString())
        .lte('created_at', endOfMonth.toISOString())
        .eq('status', 'completed')

      if (monthlyRevenueError) {
        console.error('Error fetching monthly revenue:', monthlyRevenueError)
        throw monthlyRevenueError
      }

      // Calculate monthly revenue
      const monthlyRevenue = monthlyRevenueData?.reduce((sum, transaction) => sum + (transaction.total_amount || 0), 0) || 0

      setStats({
        totalProducts: productsCount || 0,
        totalCustomers: customersCount || 0,
        monthlyRevenue,
      })
      setLastFetch(Date.now())
    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
      setError('Failed to load dashboard statistics')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Only fetch if environment variables are present
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      fetchStats()
    }
  }, [fetchStats])

  // Auto-refresh every 30 seconds if data is older than 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      if (now - lastFetch > 30000) { // 30 seconds
        fetchStats()
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [lastFetch, fetchStats])

  return { ...stats, loading, error, refresh: fetchStats }
} 