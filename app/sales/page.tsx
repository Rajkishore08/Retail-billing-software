"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/lib/supabase-client"
import { TrendingUp, IndianRupee, ShoppingCart, Calendar, Search, Eye, Filter, ArrowUpRight } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { TransactionDetailsModal } from "@/components/sales/transaction-details-modal"
import { RouteGuard } from "@/components/auth/route-guard"

type TransactionItem = { id: string; product_name: string; quantity: number; unit_price: number; total_price: number; gst_rate: number }
type Transaction = { id: string; invoice_number: string; customer_name: string | null; customer_phone: string | null; subtotal: number; gst_amount: number; total_amount: number; payment_method: string; cash_received: number | null; change_amount: number | null; status: string; created_at: string; cashier: { full_name: string } | null; customer: { name: string; phone: string } | null; transaction_items: TransactionItem[] }
type SalesStats = { todaySales: number; weekSales: number; monthSales: number; totalTransactions: number; averageOrderValue: number; topPaymentMethod: string }

export default function SalesPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [stats, setStats] = useState<SalesStats>({ todaySales: 0, weekSales: 0, monthSales: 0, totalTransactions: 0, averageOrderValue: 0, topPaymentMethod: "cash" })
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [dateFilter, setDateFilter] = useState("all")
  const [paymentFilter, setPaymentFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => { fetchSalesData(); fetchTransactions() }, [])

  const fetchSalesData = async () => {
    try {
      const today = new Date().toISOString().split("T")[0]
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const { data: todayData } = await supabase.from("transactions").select("total_amount").gte("created_at", `${today}T00:00:00`).lt("created_at", `${today}T23:59:59`).eq("status", "completed")
      const { data: weekData } = await supabase.from("transactions").select("total_amount").gte("created_at", weekAgo).eq("status", "completed")
      const { data: monthData } = await supabase.from("transactions").select("total_amount, payment_method").gte("created_at", monthAgo).eq("status", "completed")

      const todaySales = todayData?.reduce((sum, t) => sum + t.total_amount, 0) || 0
      const weekSales = weekData?.reduce((sum, t) => sum + t.total_amount, 0) || 0
      const monthSales = monthData?.reduce((sum, t) => sum + t.total_amount, 0) || 0
      const totalTransactions = monthData?.length || 0
      const averageOrderValue = totalTransactions > 0 ? monthSales / totalTransactions : 0

      const paymentMethods = monthData?.reduce((acc, t) => { acc[t.payment_method] = (acc[t.payment_method] || 0) + 1; return acc }, {} as Record<string, number>) || {}
      const topPaymentMethod = Object.entries(paymentMethods).sort(([, a], [, b]) => b - a)[0]?.[0] || "cash"

      setStats({ todaySales, weekSales, monthSales, totalTransactions, averageOrderValue, topPaymentMethod })
    } catch (error) { console.error("Error fetching sales stats:", error) }
  }

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select(`*, profiles!transactions_cashier_id_fkey (full_name), customers (name, phone), transaction_items (*)`)
        .order("created_at", { ascending: false }).limit(100)
      if (error) throw error
      setTransactions(data || [])
    } finally { setLoading(false) }
  }

  function handleViewTransaction(transaction: Transaction) {
    setSelectedTransaction(transaction)
    setIsModalOpen(true)
  }

  const filteredTransactions = transactions.filter((t) => {
    const matchesSearch = t.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) || t.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || t.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesPayment = paymentFilter === "all" || t.payment_method === paymentFilter
    const matchesStatus = statusFilter === "all" || t.status === statusFilter

    let matchesDate = true
    if (dateFilter !== "all") {
      const td = new Date(t.created_at)
      const now = new Date()
      if (dateFilter === "today") matchesDate = td.toDateString() === now.toDateString()
      if (dateFilter === "week") matchesDate = td >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      if (dateFilter === "month") matchesDate = td >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }
    return matchesSearch && matchesPayment && matchesStatus && matchesDate
  })

  const formatCurrency = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount)
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })

  const getPaymentBadge = (method: string) => {
    const map: Record<string, { bg: string; text: string }> = {
      cash: { bg: "bg-emerald-500/20", text: "text-emerald-400" },
      card: { bg: "bg-blue-500/20", text: "text-blue-400" },
      upi: { bg: "bg-blue-500/20", text: "text-blue-400" },
      credit: { bg: "bg-orange-500/20", text: "text-orange-400" }
    }
    const style = map[method] || { bg: "bg-white/10", text: "text-slate-300" }
    return <span className={`px-2.5 py-1 text-[10px] font-bold rounded-md uppercase ${style.bg} ${style.text}`}>{method}</span>
  }

  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string }> = {
      completed: { bg: "bg-emerald-500", text: "text-white" },
      pending: { bg: "bg-amber-500", text: "text-white" },
      cancelled: { bg: "bg-rose-500", text: "text-white" }
    }
    const style = map[status] || { bg: "bg-slate-500", text: "text-white" }
    return <span className={`px-2.5 py-1 text-[10px] font-bold rounded-md uppercase shadow-sm ${style.bg} ${style.text}`}>{status}</span>
  }

  if (loading) return (
    <div className="space-y-6 animate-fade-in">
      <div className="h-9 skeleton w-48 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1,2,3,4].map(i => <div key={i} className="h-32 skeleton rounded-2xl" />)}
      </div>
      <div className="h-96 skeleton rounded-2xl mt-8" />
    </div>
  )

  return (
    <RouteGuard module="sales">
    <div className="space-y-6 animate-fade-in-up">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sales Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">Track your sales performance and analytics</p>
        </div>
      </div>

      {/* ── Stats Cards ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: "Today's Sales", val: formatCurrency(stats.todaySales), icon: IndianRupee, color: "#34d399", bg: "rgba(5,150,105,0.15)", glow: "glow-emerald" },
          { label: "This Week", val: formatCurrency(stats.weekSales), icon: TrendingUp, color: "#38bdf8", bg: "rgba(2,132,199,0.15)", glow: "glow-sky" },
          { label: "This Month", val: formatCurrency(stats.monthSales), icon: Calendar, color: "#60a5fa", bg: "rgba(59,130,246,0.15)", glow: "glow-blue" },
          { label: "Total Orders (30d)", val: stats.totalTransactions, icon: ShoppingCart, color: "#fb923c", bg: "rgba(234,88,12,0.15)", glow: "glow-orange" },
        ].map((s, i) => (
          <Card key={i} className={`border-0 overflow-hidden card-hover stagger-${i+1} ${s.glow}`} style={{ background: "rgba(255,255,255,0.03)" }}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.bg }}>
                <s.icon className="h-6 w-6" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ fontFamily: "'Space Grotesk',sans-serif", color: s.color }}>{s.val}</p>
                <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Performance row ───────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 stagger-5">
        <Card className="border-border bg-card rounded-2xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <TrendingUp className="w-24 h-24 text-emerald-500" />
          </div>
          <CardContent className="p-5 relative z-10">
            <p className="text-sm text-muted-foreground mb-1">Average Order Value</p>
            <p className="text-3xl font-bold font-mono text-emerald-400 mb-2">{formatCurrency(stats.averageOrderValue)}</p>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500/80">
              <ArrowUpRight className="h-3.5 w-3.5" /> Healthy Metric
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card rounded-2xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <IndianRupee className="w-24 h-24 text-blue-500" />
          </div>
          <CardContent className="p-5 relative z-10">
            <p className="text-sm text-muted-foreground mb-1">Top Payment Method</p>
            <p className="text-3xl font-bold font-mono text-blue-400 mb-2 capitalize">{stats.topPaymentMethod}</p>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-500/80">
              <ArrowUpRight className="h-3.5 w-3.5" /> Most Popular
            </div>
          </CardContent>
        </Card>

        <Card className="border-border bg-card rounded-2xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Calendar className="w-24 h-24 text-sky-500" />
          </div>
          <CardContent className="p-5 relative z-10">
            <p className="text-sm text-muted-foreground mb-1">Daily Average (30d)</p>
            <p className="text-3xl font-bold font-mono text-sky-400 mb-2">{formatCurrency(stats.monthSales / 30)}</p>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-500/80">
              <ArrowUpRight className="h-3.5 w-3.5" /> Steady Growth
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filters ───────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-white/5 p-3 rounded-2xl border border-white/10 stagger-6">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search invoice or customer…" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-10 rounded-xl bg-card border-border" />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <div className="flex items-center justify-center bg-card border border-border h-10 px-3 rounded-xl shrink-0 text-muted-foreground">
            <Filter className="h-4 w-4" />
          </div>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-[130px] h-10 rounded-xl bg-card border-border"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="w-[130px] h-10 rounded-xl bg-card border-border"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Any Payment</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="upi">UPI</SelectItem>
              <SelectItem value="credit">Credit</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[130px] h-10 rounded-xl bg-card border-border"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Any Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Transactions List ─────────────────────────────── */}
      <Card className="border-border bg-card rounded-2xl overflow-hidden stagger-7">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-white/5">
          <h3 className="font-bold">Recent Transactions</h3>
          <Badge variant="secondary" className="bg-white/10">{filteredTransactions.length} results</Badge>
        </div>
        <div className="p-0">
          <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
            <AnimatePresence>
              {filteredTransactions.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-white/5 hover:bg-white/5 transition-colors gap-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full gradient-sidebar flex items-center justify-center shrink-0 border border-white/10 shadow-lg">
                      <ShoppingCart className="h-4 w-4 text-white/70" />
                    </div>
                    <div>
                      <p className="font-bold font-mono text-sm">{t.invoice_number}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {t.customer?.name || t.customer_name || "Walk-in Customer"}
                        <span className="md:hidden block mt-0.5 text-[10px] text-muted-foreground/80">{formatDate(t.created_at)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 justify-between sm:justify-end flex-1">
                    <div className="text-right hidden md:block">
                      <p className="text-xs text-muted-foreground">{formatDate(t.created_at)}</p>
                    </div>
                    <div className="flex gap-2">
                      {getPaymentBadge(t.payment_method)}
                      {getStatusBadge(t.status)}
                    </div>
                    <div className="text-right w-24">
                      <p className="font-bold text-emerald-400 font-mono">{formatCurrency(t.total_amount)}</p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => handleViewTransaction(t)} className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/10 text-white">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {filteredTransactions.length === 0 && (
              <div className="text-center py-20">
                <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium mb-1">No transactions found</h3>
                <p className="text-sm text-muted-foreground">Adjust filters or search term to see more.</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      <TransactionDetailsModal transaction={selectedTransaction} isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setSelectedTransaction(null) }} onTransactionUpdated={() => { fetchTransactions(); fetchSalesData() }} />
    </div>
    </RouteGuard>
  )
}
