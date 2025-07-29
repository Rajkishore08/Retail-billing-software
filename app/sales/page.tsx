"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/lib/supabase-client"
import { TrendingUp, IndianRupee, ShoppingCart, Calendar, Search, Eye, Receipt } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { TransactionDetailsModal } from "@/components/sales/transaction-details-modal"

type TransactionItem = {
  id: string
  product_name: string
  quantity: number
  unit_price: number
  total_price: number
  gst_rate: number
}

type Transaction = {
  id: string
  invoice_number: string
  customer_name: string | null
  customer_phone: string | null
  subtotal: number
  gst_amount: number
  total_amount: number
  payment_method: string
  cash_received: number | null
  change_amount: number | null
  status: string
  created_at: string
  cashier: { full_name: string } | null
  customer: { name: string; phone: string } | null
  transaction_items: TransactionItem[]
}

type SalesStats = {
  todaySales: number
  weekSales: number
  monthSales: number
  totalTransactions: number
  averageOrderValue: number
  topPaymentMethod: string
}

type DailySales = {
  date: string
  sales: number
  transactions: number
}

export default function SalesPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [stats, setStats] = useState<SalesStats>({
    todaySales: 0,
    weekSales: 0,
    monthSales: 0,
    totalTransactions: 0,
    averageOrderValue: 0,
    topPaymentMethod: "cash",
  })
  const [dailySales, setDailySales] = useState<DailySales[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [dateFilter, setDateFilter] = useState("all")
  const [paymentFilter, setPaymentFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    fetchSalesData()
    fetchTransactions()
    fetchDailySales()
  }, [])

  const fetchSalesData = async () => {
    try {
      const today = new Date().toISOString().split("T")[0]
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      // Today's sales
      const { data: todayData } = await supabase
        .from("transactions")
        .select("total_amount")
        .gte("created_at", `${today}T00:00:00`)
        .lt("created_at", `${today}T23:59:59`)
        .eq("status", "completed")

      // Week sales
      const { data: weekData } = await supabase
        .from("transactions")
        .select("total_amount")
        .gte("created_at", weekAgo)
        .eq("status", "completed")

      // Month sales
      const { data: monthData } = await supabase
        .from("transactions")
        .select("total_amount, payment_method")
        .gte("created_at", monthAgo)
        .eq("status", "completed")

      const todaySales = todayData?.reduce((sum, t) => sum + t.total_amount, 0) || 0
      const weekSales = weekData?.reduce((sum, t) => sum + t.total_amount, 0) || 0
      const monthSales = monthData?.reduce((sum, t) => sum + t.total_amount, 0) || 0
      const totalTransactions = monthData?.length || 0
      const averageOrderValue = totalTransactions > 0 ? monthSales / totalTransactions : 0

      // Find top payment method
      const paymentMethods =
        monthData?.reduce(
          (acc, t) => {
            acc[t.payment_method] = (acc[t.payment_method] || 0) + 1
            return acc
          },
          {} as Record<string, number>,
        ) || {}

      const topPaymentMethod = Object.entries(paymentMethods).sort(([, a], [, b]) => b - a)[0]?.[0] || "cash"

      setStats({
        todaySales,
        weekSales,
        monthSales,
        totalTransactions,
        averageOrderValue,
        topPaymentMethod,
      })
    } catch (error) {
      console.error("Error fetching sales stats:", error)
    }
  }

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select(`
          *,
          profiles!transactions_cashier_id_fkey (full_name),
          customers (name, phone),
          transaction_items (*)
        `)
        .order("created_at", { ascending: false })
        .limit(100)

      if (error) throw error

      setTransactions(data || [])
    } catch (error) {
      console.error("Error fetching transactions:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchDailySales = async () => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const { data, error } = await supabase
        .from("transactions")
        .select("created_at, total_amount")
        .gte("created_at", thirtyDaysAgo)
        .eq("status", "completed")
        .order("created_at", { ascending: true })

      if (error) throw error

      // Group by date
      const salesByDate = (data || []).reduce(
        (acc, transaction) => {
          const date = new Date(transaction.created_at).toISOString().split("T")[0]
          if (!acc[date]) {
            acc[date] = { sales: 0, transactions: 0 }
          }
          acc[date].sales += transaction.total_amount
          acc[date].transactions += 1
          return acc
        },
        {} as Record<string, { sales: number; transactions: number }>,
      )

      const dailySalesArray = Object.entries(salesByDate).map(([date, data]) => ({
        date,
        sales: data.sales,
        transactions: data.transactions,
      }))

      setDailySales(dailySalesArray)
    } catch (error) {
      console.error("Error fetching daily sales:", error)
    }
  }

  const filteredTransactions = transactions.filter((transaction) => {
    const matchesSearch =
      transaction.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesPayment = paymentFilter === "all" || transaction.payment_method === paymentFilter
    const matchesStatus = statusFilter === "all" || transaction.status === statusFilter

    let matchesDate = true
    if (dateFilter !== "all") {
      const transactionDate = new Date(transaction.created_at)
      const now = new Date()

      switch (dateFilter) {
        case "today":
          matchesDate = transactionDate.toDateString() === now.toDateString()
          break
        case "week":
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          matchesDate = transactionDate >= weekAgo
          break
        case "month":
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          matchesDate = transactionDate >= monthAgo
          break
      }
    }

    return matchesSearch && matchesPayment && matchesStatus && matchesDate
  })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getPaymentMethodColor = (method: string) => {
    switch (method) {
      case "cash":
        return "bg-green-100 text-green-800"
      case "card":
        return "bg-blue-100 text-blue-800"
      case "upi":
        return "bg-purple-100 text-purple-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "cancelled":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const handleViewTransaction = async (transaction: Transaction) => {
    setSelectedTransaction(transaction)
    setIsModalOpen(true)
  }

  const handleTransactionUpdated = () => {
    fetchTransactions()
    fetchSalesData()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Sales Overview</h1>
            <p className="text-muted-foreground">Track your sales performance and analytics</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-3xl font-bold">Sales Overview</h1>
          <p className="text-muted-foreground">Track your sales performance and analytics</p>
        </div>
        {/* Export and Report buttons removed - moved to dedicated Reports page */}
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/20 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <IndianRupee className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {formatCurrency(stats.todaySales)}
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">Today's Sales</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{formatCurrency(stats.weekSales)}</p>
                <p className="text-sm text-blue-700 dark:text-blue-300">This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {formatCurrency(stats.monthSales)}
                </p>
                <p className="text-sm text-purple-700 dark:text-purple-300">This Month</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/20 dark:to-orange-900/20 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">{stats.totalTransactions}</p>
                <p className="text-sm text-orange-700 dark:text-orange-300">Total Orders</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Additional Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Average Order Value</span>
                <span className="font-bold">{formatCurrency(stats.averageOrderValue)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Top Payment Method</span>
                <Badge className={getPaymentMethodColor(stats.topPaymentMethod)}>
                  {stats.topPaymentMethod.toUpperCase()}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Daily Average</span>
                <span className="font-bold">{formatCurrency(stats.monthSales / 30)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sales Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-32 flex items-center justify-center bg-muted/20 rounded-lg">
              <div className="text-center">
                <TrendingUp className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Chart visualization</p>
                <p className="text-xs text-muted-foreground">Last 30 days trend</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex flex-wrap gap-4 items-center"
      >
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by invoice, customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
          </SelectContent>
        </Select>

        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payments</SelectItem>
            <SelectItem value="cash">Cash</SelectItem>
            <SelectItem value="card">Card</SelectItem>
            <SelectItem value="upi">UPI</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Transactions Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Recent Transactions
              <Badge variant="secondary">{filteredTransactions.length} results</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="space-y-2">
                <AnimatePresence>
                  {filteredTransactions.map((transaction, index) => (
                    <motion.div
                      key={transaction.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: index * 0.02 }}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium">{transaction.invoice_number}</p>
                            <p className="text-sm text-muted-foreground">
                              {transaction.customer?.name || transaction.customer_name || "Walk-in Customer"}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold text-green-600">{formatCurrency(transaction.total_amount)}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(transaction.created_at)}</p>
                        </div>

                        <div className="flex gap-2">
                          <Badge className={getPaymentMethodColor(transaction.payment_method)}>
                            {transaction.payment_method.toUpperCase()}
                          </Badge>
                          <Badge className={getStatusColor(transaction.status)}>
                            {transaction.status.toUpperCase()}
                          </Badge>
                        </div>

                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleViewTransaction(transaction)}
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {filteredTransactions.length === 0 && (
                <div className="text-center py-12">
                  <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No transactions found</h3>
                  <p className="text-muted-foreground">
                    {searchTerm || dateFilter !== "all" || paymentFilter !== "all" || statusFilter !== "all"
                      ? "Try adjusting your filters"
                      : "No sales data available"}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Transaction Details Modal */}
      <TransactionDetailsModal
        transaction={selectedTransaction}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedTransaction(null)
        }}
        onTransactionUpdated={handleTransactionUpdated}
      />
    </div>
  )
}
