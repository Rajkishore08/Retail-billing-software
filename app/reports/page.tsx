"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Download, TrendingUp, ShoppingCart, Users, Package, BarChart3, RefreshCw, IndianRupee, Percent, Award, Calendar, MessageCircle, AlertTriangle, FileText } from "lucide-react"
import { supabase } from "@/lib/supabase-client"
import { toast } from "sonner"
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { RouteGuard } from "@/components/auth/route-guard"

type ReportType = "sales" | "inventory" | "customers" | "daily"

interface MonthData { month: string; sales: number; transactions: number }

interface ReportData {
  totalSales: number; totalTransactions: number; averageOrderValue: number; totalGST: number; totalDiscount: number; totalSavings: number
  topProducts: Array<{ name: string; quantity: number; revenue: number }>
  dailySales: Array<{ date: string; sales: number; transactions: number; gst: number; savings: number }>
  paymentMethods: Array<{ method: string; count: number; amount: number }>
  customerStats: { totalCustomers: number; repeatCustomers: number; loyaltyPointsEarned: number; loyaltyPointsRedeemed: number }
  creditStats: { totalCreditSales: number; creditTransactions: number; totalOutstanding: number; customersWithCredit: number; topDebtors: Array<{ name: string; phone: string; outstanding_credit: number }> }
}

const PAYMENT_COLORS: Record<string, string> = { cash: "#10b981", card: "#3b82f6", upi: "#8b5cf6", credit: "#f97316", unknown: "#64748b" }
const CHART_COLORS = ["#8b5cf6", "#10b981", "#f59e0b", "#f43f5e", "#0ea5e9"]

const formatCurrency = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(amount)
const formatShort = (amount: number) => {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`
  return `₹${amount.toFixed(0)}`
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [dateRange, setDateRange] = useState("30")
  const [reportType, setReportType] = useState<ReportType>("sales")
  const [monthComparison, setMonthComparison] = useState<MonthData[]>([])
  const [compLoading, setCompLoading] = useState(false)
  const [inventoryData, setInventoryData] = useState<any[]>([])

  const getDateBounds = (range: string) => {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - parseInt(range))
    return { start, end }
  }

  const fetchReportData = useCallback(async () => {
    setLoading(true)
    try {
      const { start, end } = getDateBounds(dateRange)
      const [transResult, custResult] = await Promise.all([
        supabase.from("transactions").select("*, transaction_items(*)").gte("created_at", start.toISOString()).lte("created_at", end.toISOString()).eq("status", "completed"),
        supabase.from("customers").select("id, name, phone, loyalty_points, total_spent, outstanding_credit")
      ])
      
      if (transResult.error) { toast.error("Failed to fetch transaction data"); return }

      const transactions = transResult.data || []
      const customersArr = custResult.data || []

      const totalSales = transactions.reduce((s, t) => s + (t.total_amount || 0), 0)
      const totalTransactions = transactions.length
      const averageOrderValue = totalTransactions > 0 ? totalSales / totalTransactions : 0
      const totalGST = transactions.reduce((s, t) => s + (t.gst_amount || 0), 0)
      const totalDiscount = transactions.reduce((s, t) => s + (t.discount_amount || 0), 0)
      const totalSavings = transactions.reduce((s, t) => s + (t.total_savings || 0), 0)

      const productMap = new Map<string, { name: string; quantity: number; revenue: number }>()
      transactions.forEach((t: any) => {
        ;(t.transaction_items || []).forEach((item: any) => {
          const existing = productMap.get(item.product_name)
          if (existing) { existing.quantity += item.quantity; existing.revenue += item.total_price || 0 }
          else { productMap.set(item.product_name, { name: item.product_name, quantity: item.quantity, revenue: item.total_price || 0 }) }
        })
      })
      const topProducts = Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 8)

      const dailyMap = new Map<string, { sales: number; transactions: number; gst: number; savings: number }>()
      transactions.forEach((t: any) => {
        const date = new Date(t.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
        const ex = dailyMap.get(date)
        if (ex) { ex.sales += t.total_amount || 0; ex.transactions += 1; ex.gst += t.gst_amount || 0; ex.savings += t.total_savings || 0 }
        else { dailyMap.set(date, { sales: t.total_amount || 0, transactions: 1, gst: t.gst_amount || 0, savings: t.total_savings || 0 }) }
      })
      const dailySales = Array.from(dailyMap.entries()).map(([date, d]) => ({ date, ...d })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      const payMap = new Map<string, { count: number; amount: number }>()
      transactions.forEach((t: any) => {
        const m = t.payment_method || "unknown"
        const ex = payMap.get(m)
        if (ex) { ex.count += 1; ex.amount += t.total_amount || 0 }
        else { payMap.set(m, { count: 1, amount: t.total_amount || 0 }) }
      })
      const paymentMethods = Array.from(payMap.entries()).map(([method, d]) => ({ method, ...d }))

      const uniqueCustomerIds = new Set(transactions.filter((t: any) => t.customer_id).map((t: any) => t.customer_id))
      const loyaltyPointsEarned = transactions.reduce((s, t: any) => s + (t.loyalty_points_earned || 0), 0)
      const loyaltyPointsRedeemed = transactions.reduce((s, t: any) => s + (t.loyalty_points_redeemed || 0), 0)

      const creditTxns = transactions.filter((t: any) => t.payment_method === "credit")
      const totalCreditSales = creditTxns.reduce((s, t: any) => s + (t.total_amount || 0), 0)
      const creditTransactions = creditTxns.length
      const customersWithCredit = customersArr.filter((c: any) => (c.outstanding_credit || 0) > 0).length
      const totalOutstanding = customersArr.reduce((s, c: any) => s + (c.outstanding_credit || 0), 0)
      const topDebtors = [...customersArr]
        .filter((c: any) => (c.outstanding_credit || 0) > 0)
        .sort((a: any, b: any) => (b.outstanding_credit || 0) - (a.outstanding_credit || 0))
        .slice(0, 5)
        .map((c: any) => ({ name: c.name, phone: c.phone, outstanding_credit: c.outstanding_credit || 0 }))

      setReportData({
        totalSales, totalTransactions, averageOrderValue, totalGST, totalDiscount, totalSavings,
        topProducts, dailySales, paymentMethods,
        customerStats: { totalCustomers: customersArr.length, repeatCustomers: uniqueCustomerIds.size, loyaltyPointsEarned, loyaltyPointsRedeemed },
        creditStats: { totalCreditSales, creditTransactions, totalOutstanding, customersWithCredit, topDebtors }
      })
    } catch (error) { toast.error("Failed to generate report") } finally { setLoading(false) }
  }, [dateRange])

  const fetchMonthComparison = useCallback(async () => {
    setCompLoading(true)
    try {
      const results: MonthData[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i)
        const start = new Date(d.getFullYear(), d.getMonth(), 1)
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
        const { data } = await supabase.from("transactions").select("total_amount").gte("created_at", start.toISOString()).lte("created_at", end.toISOString()).eq("status", "completed")
        results.push({
          month: start.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
          sales: data?.reduce((s, t) => s + (t.total_amount || 0), 0) || 0,
          transactions: data?.length || 0,
        })
      }
      setMonthComparison(results)
    } finally { setCompLoading(false) }
  }, [])

  const fetchInventory = useCallback(async () => {
    const { data } = await supabase.from("products").select("id, name, brand, stock_quantity, min_stock_level, selling_price, price, cost_price, hsn_code").order("name")
    setInventoryData(data || [])
  }, [])

  useEffect(() => { fetchReportData(); fetchMonthComparison(); fetchInventory() }, [fetchReportData, fetchMonthComparison, fetchInventory])

  // ── PDF Export ───────────────────────────────────────────────────
  const handleExport = () => {
    if (!reportData) return
    const dateLabel2 = dateRange === "7" ? "Last 7 Days" : dateRange === "30" ? "Last 30 Days" : dateRange === "90" ? "Last 90 Days" : "Last Year"
    const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })
    const lowStock = inventoryData.filter(p => p.stock_quantity > 0 && p.stock_quantity <= (p.min_stock_level || 5))
    const outOfStock = inventoryData.filter(p => p.stock_quantity === 0)
    const totalStockValue = inventoryData.reduce((s, p) => s + ((p.cost_price || p.selling_price || p.price || 0) * p.stock_quantity), 0)

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Business Report — ${dateLabel2}</title>
<style>
  body{font-family:Arial,sans-serif;margin:0;padding:32px;color:#111;font-size:13px;}
  h1{font-size:26px;font-weight:800;margin:0 0 4px;color:#1e1b4b;}
  h2{font-size:16px;font-weight:700;margin:28px 0 10px;color:#4338ca;border-bottom:2px solid #e0e7ff;padding-bottom:6px;}
  h3{font-size:13px;font-weight:700;margin:18px 0 8px;color:#374151;}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:20px;border-bottom:3px solid #1e1b4b;}
  .kpi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:16px 0;}
  .kpi{background:#f5f3ff;padding:14px;border-radius:10px;border-left:4px solid #6366f1;}
  .kpi-label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;font-weight:700;}
  .kpi-value{font-size:22px;font-weight:800;color:#1e1b4b;margin-top:4px;}
  table{width:100%;border-collapse:collapse;margin:10px 0;font-size:12px;}
  th{background:#f0f0ff;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#374151;}
  td{padding:7px 10px;border-bottom:1px solid #e5e7eb;}
  tr:nth-child(even) td{background:#fafafa;}
  .badge{display:inline-block;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700;}
  .badge-red{background:#fee2e2;color:#b91c1c;}
  .badge-yellow{background:#fef9c3;color:#92400e;}
  .badge-green{background:#dcfce7;color:#15803d;}
  .footer{text-align:center;margin-top:40px;padding-top:14px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:11px;}
  @media print{@page{margin:1.5cm;size:A4;}}
</style></head><body>
<div class="header">
  <div>
    <h1>📊 Business Report</h1>
    <div style="color:#6b7280;font-size:13px;margin-top:4px;">${dateLabel2} &nbsp;·&nbsp; Generated on ${today}</div>
  </div>
  <div style="text-align:right;">
    <div style="font-size:18px;font-weight:800;color:#1e1b4b;">Techno Bills</div>
    <div style="font-size:12px;color:#6b7280;margin-top:2px;">POS System Report</div>
  </div>
</div>

<h2>📈 Sales Summary</h2>
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-label">Total Revenue</div><div class="kpi-value">₹${reportData.totalSales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</div></div>
  <div class="kpi"><div class="kpi-label">Total Transactions</div><div class="kpi-value">${reportData.totalTransactions}</div></div>
  <div class="kpi"><div class="kpi-label">Average Order</div><div class="kpi-value">₹${reportData.averageOrderValue.toFixed(2)}</div></div>
  <div class="kpi"><div class="kpi-label">GST Collected</div><div class="kpi-value">₹${reportData.totalGST.toFixed(2)}</div></div>
  <div class="kpi"><div class="kpi-label">Total Savings Given</div><div class="kpi-value">₹${reportData.totalSavings.toFixed(2)}</div></div>
  <div class="kpi"><div class="kpi-label">Repeat Customers</div><div class="kpi-value">${reportData.customerStats.repeatCustomers}</div></div>
</div>

<h2>🏆 Top Selling Products</h2>
<table><thead><tr><th>#</th><th>Product</th><th>Units Sold</th><th style="text-align:right">Revenue</th></tr></thead><tbody>
${reportData.topProducts.slice(0, 10).map((p, i) => `<tr><td>${i + 1}</td><td>${p.name}</td><td>${p.quantity}</td><td style="text-align:right;font-weight:700;">₹${p.revenue.toFixed(2)}</td></tr>`).join("")}
</tbody></table>

<h2>💳 Payment Methods</h2>
<table><thead><tr><th>Method</th><th>Transactions</th><th style="text-align:right">Amount</th><th style="text-align:right">Share</th></tr></thead><tbody>
${reportData.paymentMethods.map(p => `<tr><td style="text-transform:capitalize;font-weight:600;">${p.method}</td><td>${p.count}</td><td style="text-align:right;">₹${p.amount.toFixed(2)}</td><td style="text-align:right;">${reportData.totalSales > 0 ? ((p.amount / reportData.totalSales) * 100).toFixed(1) : 0}%</td></tr>`).join("")}
</tbody></table>

<h2>📦 Inventory Summary</h2>
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-label">Total SKUs</div><div class="kpi-value">${inventoryData.length}</div></div>
  <div class="kpi"><div class="kpi-label">Low Stock Items</div><div class="kpi-value" style="color:#d97706;">${lowStock.length}</div></div>
  <div class="kpi"><div class="kpi-label">Out of Stock</div><div class="kpi-value" style="color:#dc2626;">${outOfStock.length}</div></div>
  <div class="kpi"><div class="kpi-label">Total Stock Value (Cost)</div><div class="kpi-value">₹${totalStockValue.toLocaleString("en-IN", { minimumFractionDigits: 0 })}</div></div>
</div>
${lowStock.length > 0 || outOfStock.length > 0 ? `
<h3>⚠️ Items Needing Reorder</h3>
<table><thead><tr><th>Product</th><th>Brand</th><th>Stock</th><th>Min Level</th><th style="text-align:right">Status</th></tr></thead><tbody>
${[...outOfStock, ...lowStock].slice(0, 20).map(p => `<tr>
  <td>${p.name}</td>
  <td>${p.brand || "-"}</td>
  <td style="font-weight:700;color:${p.stock_quantity === 0 ? "#dc2626" : "#d97706"}">${p.stock_quantity}</td>
  <td>${p.min_stock_level || 5}</td>
  <td style="text-align:right;"><span class="badge ${p.stock_quantity === 0 ? "badge-red" : "badge-yellow"}">${p.stock_quantity === 0 ? "OUT OF STOCK" : "LOW STOCK"}</span></td>
</tr>`).join("")}
</tbody></table>` : "<p style='color:#16a34a;font-weight:600;'>✅ All products are well-stocked.</p>"}

<h3>All Products</h3>
<table><thead><tr><th>Product</th><th>Brand</th><th>HSN</th><th>Stock</th><th style="text-align:right">Selling Price</th></tr></thead><tbody>
${inventoryData.slice(0, 50).map(p => `<tr>
  <td>${p.name}</td><td>${p.brand || "-"}</td><td>${p.hsn_code || "-"}</td>
  <td style="font-weight:700;color:${p.stock_quantity === 0 ? "#dc2626" : p.stock_quantity <= (p.min_stock_level || 5) ? "#d97706" : "#16a34a"}">${p.stock_quantity}</td>
  <td style="text-align:right;">₹${(p.selling_price || p.price || 0).toFixed(2)}</td>
</tr>`).join("")}
</tbody></table>

<h2>📅 Month-over-Month</h2>
<table><thead><tr><th>Month</th><th style="text-align:right">Revenue</th><th style="text-align:right">Transactions</th><th style="text-align:right">Change</th></tr></thead><tbody>
${monthComparison.map((m, i) => {
  const prev = monthComparison[i - 1]
  const change = prev && prev.sales > 0 ? ((m.sales - prev.sales) / prev.sales * 100) : null
  return `<tr><td style="font-weight:600">${m.month}</td><td style="text-align:right;font-weight:700;">₹${m.sales.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td><td style="text-align:right">${m.transactions}</td><td style="text-align:right">${change !== null ? `<span class="badge ${change >= 0 ? "badge-green" : "badge-red"}">${change >= 0 ? "▲" : "▼"} ${Math.abs(change).toFixed(1)}%</span>` : "—"}</td></tr>`
}).join("")}
</tbody></table>

<div class="footer">Generated by Techno Bills POS System &nbsp;&middot;&nbsp; ${today}</div>
</body></html>`

    const printWin = window.open("", "_blank")
    if (!printWin) { toast.error("Pop-up blocked — allow pop-ups and try again"); return }
    printWin.document.write(html)
    printWin.document.close()
    setTimeout(() => {
      printWin.print()
      toast.success("Report opened — use 'Save as PDF' in the print dialog")
    }, 600)
  }

  const shareWhatsApp = () => {
    if (!reportData) return
    const today = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    let msg = `📊 *Daily Sales Report — ${today}*\nStore: Techno Bills\n\n💰 Total Revenue: ₹${reportData.totalSales.toFixed(2)}\n🛒 Transactions: ${reportData.totalTransactions}\n📦 Avg Order: ₹${reportData.averageOrderValue.toFixed(2)}\n🔶 GST Collected: ₹${reportData.totalGST.toFixed(2)}\n`
    if (reportData.topProducts[0]) msg += `🏆 Top Product: ${reportData.topProducts[0].name} (₹${reportData.topProducts[0].revenue.toFixed(2)})\n`
    msg += `\n*Payment Breakdown:*\n`
    reportData.paymentMethods.forEach((p) => { msg += `  • ${p.method.toUpperCase()}: ₹${p.amount.toFixed(2)} (${p.count} txns)\n` })
    msg += `\nGenerated by POS System 🧾`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank")
  }

  const dateLabel = dateRange === "7" ? "Last 7 Days" : dateRange === "30" ? "Last 30 Days" : dateRange === "90" ? "Last 90 Days" : "Last Year"

  if (loading) return (
    <div className="space-y-6 animate-fade-in">
      <div className="h-9 skeleton w-48 rounded-xl" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
        {[1,2,3,4,5,6].map(i => <div key={i} className="h-28 skeleton rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="h-80 skeleton rounded-2xl" />
        <div className="h-80 skeleton rounded-2xl" />
      </div>
    </div>
  )

  return (
    <RouteGuard module="reports">
    <div className="space-y-6 animate-fade-in-up">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">Detailed business insights for {dateLabel}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[140px] h-10 rounded-xl bg-card border-border"><Calendar className="h-4 w-4 mr-2 text-violet-400" /><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
            <SelectTrigger className="w-[160px] h-10 rounded-xl bg-card border-border"><SelectValue /></SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="sales">Sales Report</SelectItem>
              <SelectItem value="inventory">Inventory Report</SelectItem>
              <SelectItem value="customers">Customer Report</SelectItem>
              <SelectItem value="daily">Daily Sales</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchReportData} className="h-10 w-10 rounded-xl bg-card border-border hover:bg-white/5">
            <RefreshCw className="h-4 w-4 text-sky-400" />
          </Button>
          <Button onClick={shareWhatsApp} disabled={!reportData} className="h-10 rounded-xl gradient-emerald border-0 shadow-lg glow-emerald text-white font-bold">
            <MessageCircle className="h-4 w-4 mr-2" /> Share
          </Button>
          <Button onClick={handleExport} disabled={!reportData} className="h-10 rounded-xl gradient-primary border-0 shadow-lg glow-violet text-white font-bold">
            <FileText className="h-4 w-4 mr-2" /> Export PDF
          </Button>
        </div>
      </div>

      {!reportData && !loading ? (
        <Card className="border-border bg-card rounded-2xl"><CardContent className="p-10 text-center text-muted-foreground">No data available.</CardContent></Card>
      ) : reportData ? (
        <div className="space-y-6">
          {/* ── KPI Summary Cards ──────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5">
            {[
              { label: "Total Revenue", val: formatShort(reportData.totalSales), sub: formatCurrency(reportData.totalSales), icon: IndianRupee, color: "#10b981", bg: "rgba(16,185,129,0.15)", glow: "glow-emerald" },
              { label: "Transactions", val: reportData.totalTransactions, sub: "completed bills", icon: ShoppingCart, color: "#3b82f6", bg: "rgba(59,130,246,0.15)", glow: "glow-sky" },
              { label: "Avg Order Value", val: formatShort(reportData.averageOrderValue), sub: "per transaction", icon: TrendingUp, color: "#8b5cf6", bg: "rgba(139,92,246,0.15)", glow: "glow-violet" },
              { label: "GST Collected", val: formatShort(reportData.totalGST), sub: formatCurrency(reportData.totalGST), icon: Percent, color: "#f97316", bg: "rgba(249,115,22,0.15)", glow: "glow-orange" },
              { label: "Total Savings", val: formatShort(reportData.totalSavings), sub: "given to customers", icon: Award, color: "#ec4899", bg: "rgba(236,72,153,0.15)", glow: "glow-pink" },
              { label: "Returning Cust", val: reportData.customerStats.repeatCustomers, sub: `of ${reportData.customerStats.totalCustomers} total`, icon: Users, color: "#14b8a6", bg: "rgba(20,184,166,0.15)", glow: "glow-teal" },
            ].map((s, i) => (
              <Card key={i} className={`border-0 overflow-hidden card-hover stagger-${i+1} ${s.glow}`} style={{ background: "rgba(255,255,255,0.03)" }}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <s.icon className="h-4 w-4" style={{ color: s.color }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.label}</span>
                  </div>
                  <div className="text-2xl font-bold font-mono tracking-tight" style={{ color: s.color }}>{s.val}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── Revenue + Txns Charts ──────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 stagger-7">
            <Card className="border-border bg-card rounded-2xl overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><TrendingUp className="w-32 h-32 text-emerald-500" /></div>
              <div className="p-5 border-b border-white/5 flex items-center justify-between relative z-10">
                <div>
                  <h3 className="font-bold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-400" /> Revenue Trend</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Daily revenue over selected period</p>
                </div>
              </div>
              <div className="p-5 h-[280px] relative z-10">
                {reportData.dailySales.length === 0 ? <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data</div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={reportData.dailySales}>
                      <defs>
                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={formatShort} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px" }} formatter={(v: number) => [formatCurrency(v), "Revenue"]} />
                      <Area type="monotone" dataKey="sales" stroke="#10b981" strokeWidth={3} fill="url(#salesGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card className="border-border bg-card rounded-2xl overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none"><ShoppingCart className="w-32 h-32 text-sky-500" /></div>
              <div className="p-5 border-b border-white/5 flex items-center justify-between relative z-10">
                <div>
                  <h3 className="font-bold flex items-center gap-2"><ShoppingCart className="h-4 w-4 text-sky-400" /> Daily Transactions</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Number of bills processed</p>
                </div>
              </div>
              <div className="p-5 h-[280px] relative z-10">
                {reportData.dailySales.length === 0 ? <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data</div> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reportData.dailySales}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px" }} cursor={{ fill: "rgba(255,255,255,0.05)" }} />
                      <Bar dataKey="transactions" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>
          </div>

          {/* ── Payments & Products ────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 stagger-8">
            <Card className="border-border bg-card rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-white/5">
                <h3 className="font-bold flex items-center gap-2"><BarChart3 className="h-4 w-4 text-violet-400" /> Payment Methods</h3>
              </div>
              <div className="p-5">
                {reportData.paymentMethods.length === 0 ? <p className="text-center text-sm text-muted-foreground py-10">No data</p> : (
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="w-40 h-40 shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={reportData.paymentMethods} dataKey="amount" nameKey="method" cx="50%" cy="50%" innerRadius={45} outerRadius={70} stroke="none">
                            {reportData.paymentMethods.map(e => <Cell key={e.method} fill={PAYMENT_COLORS[e.method] || PAYMENT_COLORS.unknown} />)}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", fontSize: "12px" }} formatter={(v: number) => formatCurrency(v)} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 w-full space-y-4">
                      {reportData.paymentMethods.map(pm => {
                        const pct = reportData.totalSales > 0 ? (pm.amount / reportData.totalSales) * 100 : 0
                        const color = PAYMENT_COLORS[pm.method] || PAYMENT_COLORS.unknown
                        return (
                          <div key={pm.method}>
                            <div className="flex justify-between items-center mb-1 text-sm">
                              <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                                <span className="font-semibold capitalize text-slate-200">{pm.method}</span>
                                <span className="text-[10px] text-slate-400 bg-white/5 px-1.5 rounded">{pm.count}</span>
                              </div>
                              <span className="font-mono font-bold" style={{ color }}>{formatCurrency(pm.amount)}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                              <div className="h-full rounded-full transition-all shadow-[0_0_8px_rgba(255,255,255,0.2)]" style={{ width: `${pct}%`, backgroundColor: color }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <Card className="border-border bg-card rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-white/5">
                <h3 className="font-bold flex items-center gap-2"><Package className="h-4 w-4 text-orange-400" /> Top Selling Products</h3>
              </div>
              <div className="p-5">
                {reportData.topProducts.length === 0 ? <p className="text-center text-sm text-muted-foreground py-10">No data</p> : (
                  <div className="space-y-4 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                    {reportData.topProducts.map((p, i) => {
                      const max = reportData.topProducts[0].revenue
                      const pct = max > 0 ? (p.revenue / max) * 100 : 0
                      const color = CHART_COLORS[i % CHART_COLORS.length]
                      return (
                        <div key={p.name}>
                          <div className="flex justify-between items-start mb-1 text-sm">
                            <div className="flex items-center gap-2 min-w-0 pr-2">
                              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 text-white" style={{ backgroundColor: color }}>{i+1}</span>
                              <span className="truncate font-semibold text-slate-200">{p.name}</span>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="font-mono font-bold" style={{ color }}>{formatCurrency(p.revenue)}</div>
                              <div className="text-[10px] text-muted-foreground">Qty: {p.quantity}</div>
                            </div>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* ── Month over Month ───────────────────────────────────── */}
          <Card className="border-border bg-card rounded-2xl overflow-hidden stagger-9">
            <div className="p-5 border-b border-white/5 flex justify-between items-center">
              <div>
                <h3 className="font-bold flex items-center gap-2"><BarChart3 className="h-4 w-4 text-indigo-400" /> Month-over-Month Comparison</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Revenue vs Transactions across last 6 months</p>
              </div>
              {compLoading && <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />}
            </div>
            <div className="p-5">
              {compLoading ? <div className="h-72 skeleton rounded-xl" /> : monthComparison.length === 0 ? <p className="text-center text-muted-foreground py-10 text-sm">No data</p> : (
                <div className="space-y-6">
                  {/* ── Bar Chart ── */}
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthComparison} barCategoryGap="28%">
                        <defs>
                          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#818cf8" stopOpacity={1} />
                            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.75} />
                          </linearGradient>
                          <linearGradient id="txnGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#34d399" stopOpacity={1} />
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0.75} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8", fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="rev" tickFormatter={formatShort} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={52} />
                        <YAxis yAxisId="txn" orientation="right" allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={36} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "12px" }}
                          cursor={{ fill: "rgba(255,255,255,0.04)" }}
                          formatter={(value: number, name: string) =>
                            name === "Revenue" ? [formatCurrency(value), "Revenue"] : [value, "Transactions"]
                          }
                        />
                        <Legend
                          wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
                          formatter={(v) => <span style={{ color: "#94a3b8", fontWeight: 600 }}>{v}</span>}
                        />
                        <Bar yAxisId="rev" dataKey="sales" name="Revenue" fill="url(#revGrad)" radius={[6, 6, 0, 0]} maxBarSize={48} />
                        <Bar yAxisId="txn" dataKey="transactions" name="Transactions" fill="url(#txnGrad)" radius={[6, 6, 0, 0]} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* ── Summary Row Cards ── */}
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                    {monthComparison.map((m, i) => {
                      const prev = monthComparison[i - 1]
                      const change = prev && prev.sales > 0 ? ((m.sales - prev.sales) / prev.sales) * 100 : null
                      const isUp = change !== null && change >= 0
                      return (
                        <div key={m.month} className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">{m.month}</p>
                          <p className="text-sm font-bold font-mono text-indigo-400">{formatShort(m.sales)}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{m.transactions} bills</p>
                          {change !== null && (
                            <span className={`inline-block mt-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${isUp ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
                              {isUp ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      ) : null}

      {/* ── Inventory Section ───────────────────────────────────── */}
      {reportType === "inventory" || reportType === "sales" ? (
        <div className="space-y-6 mt-6">
          <Card className="border-border bg-card rounded-2xl overflow-hidden stagger-10">
            <div className="p-5 border-b border-white/5 flex justify-between items-center">
              <div>
                <h3 className="font-bold flex items-center gap-2"><Package className="h-4 w-4 text-emerald-400" /> Inventory Overview</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Current stock status and reorder alerts</p>
              </div>
            </div>
            <CardContent className="p-5">
              {inventoryData.length === 0 ? (
                <div className="h-32 flex items-center justify-center text-muted-foreground text-sm">No inventory data available</div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5 text-center">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">Total SKUs</p>
                      <p className="text-2xl font-bold text-foreground mt-1">{inventoryData.length}</p>
                    </div>
                    <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 text-center">
                      <p className="text-xs text-emerald-400 uppercase tracking-wider font-bold">Total Stock Value</p>
                      <p className="text-xl font-bold text-emerald-300 mt-1 font-mono">
                        {formatShort(inventoryData.reduce((s, p) => s + ((p.cost_price || p.selling_price || p.price || 0) * p.stock_quantity), 0))}
                      </p>
                    </div>
                    <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/20 text-center">
                      <p className="text-xs text-amber-400 uppercase tracking-wider font-bold">Low Stock Items</p>
                      <p className="text-2xl font-bold text-amber-300 mt-1">
                        {inventoryData.filter(p => p.stock_quantity > 0 && p.stock_quantity <= (p.min_stock_level || 5)).length}
                      </p>
                    </div>
                    <div className="bg-rose-500/10 p-4 rounded-xl border border-rose-500/20 text-center">
                      <p className="text-xs text-rose-400 uppercase tracking-wider font-bold">Out of Stock</p>
                      <p className="text-2xl font-bold text-rose-300 mt-1">
                        {inventoryData.filter(p => p.stock_quantity === 0).length}
                      </p>
                    </div>
                  </div>

                  {inventoryData.filter(p => p.stock_quantity <= (p.min_stock_level || 5)).length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold flex items-center gap-2 mb-3 text-amber-400"><AlertTriangle className="h-4 w-4" /> Needs Reorder</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-white/10 text-left text-muted-foreground">
                              <th className="pb-2 font-semibold text-xs uppercase tracking-wider pl-2">Product</th>
                              <th className="pb-2 text-center font-semibold text-xs uppercase tracking-wider">Stock</th>
                              <th className="pb-2 text-center font-semibold text-xs uppercase tracking-wider">Min Level</th>
                              <th className="pb-2 text-right font-semibold text-xs uppercase tracking-wider pr-2">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {inventoryData.filter(p => p.stock_quantity <= (p.min_stock_level || 5)).slice(0, 10).map((p) => (
                              <tr key={p.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                <td className="py-2.5 pl-2 font-medium">{p.name}</td>
                                <td className={`py-2.5 text-center font-bold ${p.stock_quantity === 0 ? "text-rose-400" : "text-amber-400"}`}>{p.stock_quantity}</td>
                                <td className="py-2.5 text-center text-muted-foreground">{p.min_stock_level || 5}</td>
                                <td className="py-2.5 text-right pr-2">
                                  {p.stock_quantity === 0 ? (
                                    <Badge variant="destructive" className="bg-rose-500/20 text-rose-400 border-0 hover:bg-rose-500/30">OUT OF STOCK</Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-amber-500/20 text-amber-400 border-0 hover:bg-amber-500/30">LOW STOCK</Badge>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
    </RouteGuard>
  )
}