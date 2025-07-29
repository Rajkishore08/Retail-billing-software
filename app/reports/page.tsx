"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, Download, BarChart3, TrendingUp, Users, Package } from "lucide-react"
import { supabase } from "@/lib/supabase-client"
import { toast } from "sonner"
import { exportSalesReport, exportInventoryReport, exportCustomerReport } from "@/lib/export-utils"

type ReportType = "sales" | "inventory" | "customers" | "daily"

interface ReportData {
  totalSales: number
  totalTransactions: number
  averageOrderValue: number
  topProducts: Array<{ name: string; quantity: number; revenue: number }>
  dailySales: Array<{ date: string; sales: number; transactions: number }>
  paymentMethods: Array<{ method: string; count: number; amount: number }>
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [dateRange, setDateRange] = useState("7")
  const [reportType, setReportType] = useState<ReportType>("sales")

  const fetchReportData = async () => {
    setLoading(true)
    try {
      let start = new Date()
      let end = new Date()
      
      switch (dateRange) {
        case "7":
          start.setDate(start.getDate() - 7)
          break
        case "30":
          start.setDate(start.getDate() - 30)
          break
        case "90":
          start.setDate(start.getDate() - 90)
          break
        case "365":
          start.setDate(start.getDate() - 365)
          break
      }

      // Fetch transactions
      const { data: transactions, error: transactionsError } = await supabase
        .from("transactions")
        .select("*")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .eq("status", "completed")

      if (transactionsError) {
        console.error("Error fetching transactions:", transactionsError)
        toast.error("Failed to fetch transaction data")
        return
      }

      // Fetch products
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("*")

      if (productsError) {
        console.error("Error fetching products:", productsError)
        toast.error("Failed to fetch product data")
        return
      }

      // Fetch customers
      const { data: customers, error: customersError } = await supabase
        .from("customers")
        .select("*")

      if (customersError) {
        console.error("Error fetching customers:", customersError)
        toast.error("Failed to fetch customer data")
        return
      }

      // Process data
      const totalSales = transactions?.reduce((sum, t) => sum + (t.total_amount || 0), 0) || 0
      const totalTransactions = transactions?.length || 0
      const averageOrderValue = totalTransactions > 0 ? totalSales / totalTransactions : 0

      // Calculate top products
      const productSales = new Map<string, { name: string; quantity: number; revenue: number }>()
      
      transactions?.forEach((t: any) => {
        t.transaction_items?.forEach((item: any) => {
          const existing = productSales.get(item.product_name)
          if (existing) {
            existing.quantity += item.quantity
            existing.revenue += item.total_price
          } else {
            productSales.set(item.product_name, {
              name: item.product_name,
              quantity: item.quantity,
              revenue: item.total_price
            })
          }
        })
      })

      const topProducts = Array.from(productSales.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)

      // Calculate daily sales
      const dailySalesMap = new Map<string, { sales: number; transactions: number }>()
      
      transactions?.forEach((t: any) => {
        const date = new Date(t.created_at).toISOString().split('T')[0]
        const existing = dailySalesMap.get(date)
        if (existing) {
          existing.sales += t.total_amount || 0
          existing.transactions += 1
        } else {
          dailySalesMap.set(date, {
            sales: t.total_amount || 0,
            transactions: 1
          })
        }
      })

      const dailySales = Array.from(dailySalesMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date))

      // Calculate payment methods
      const paymentMethodsMap = new Map<string, { count: number; amount: number }>()
      
      transactions?.forEach((t: any) => {
        const method = t.payment_method || 'unknown'
        const existing = paymentMethodsMap.get(method)
        if (existing) {
          existing.count += 1
          existing.amount += t.total_amount || 0
        } else {
          paymentMethodsMap.set(method, {
            count: 1,
            amount: t.total_amount || 0
          })
        }
      })

      const paymentMethods = Array.from(paymentMethodsMap.entries())
        .map(([method, data]) => ({ method, ...data }))

      setReportData({
        totalSales,
        totalTransactions,
        averageOrderValue,
        topProducts,
        dailySales,
        paymentMethods
      })

    } catch (error) {
      console.error("Error generating report:", error)
      toast.error("Failed to generate report")
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    if (!reportData) return

    try {
      let start = new Date()
      let end = new Date()
      
      switch (dateRange) {
        case "7":
          start.setDate(start.getDate() - 7)
          break
        case "30":
          start.setDate(start.getDate() - 30)
          break
        case "90":
          start.setDate(start.getDate() - 90)
          break
        case "365":
          start.setDate(start.getDate() - 365)
          break
      }

      switch (reportType) {
        case "sales":
          await exportSalesReport({
            dateRange: dateRange === "7" ? "7d" : dateRange === "30" ? "30d" : dateRange === "90" ? "90d" : "custom",
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            reportType: "sales"
          })
          break
        case "inventory":
          await exportInventoryReport()
          break
        case "customers":
          await exportCustomerReport()
          break
      }
      
      toast.success("Report exported successfully")
    } catch (error) {
      console.error("Error exporting report:", error)
      toast.error("Failed to export report")
    }
  }

  useEffect(() => {
    fetchReportData()
  }, [dateRange])

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground">Generate and export detailed reports</p>
        </div>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Report Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateRange">Date Range</Label>
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="365">Last year</SelectItem>
                </SelectContent>
              </Select>
            </div>

                         <div className="space-y-2">
               <Label htmlFor="reportType">Report Type</Label>
               <Select value={reportType} onValueChange={(value: string) => setReportType(value as ReportType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">Sales Report</SelectItem>
                  <SelectItem value="inventory">Inventory Report</SelectItem>
                  <SelectItem value="customers">Customer Report</SelectItem>
                  <SelectItem value="daily">Daily Sales</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Actions</Label>
              <Button onClick={handleExport} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Data */}
      {loading ? (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2">Generating report...</span>
            </div>
          </CardContent>
        </Card>
      ) : reportData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Summary Cards */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{reportData.totalSales.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {reportData.totalTransactions} transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Order</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{reportData.averageOrderValue.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">
                per transaction
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Top Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {reportData.topProducts.slice(0, 3).map((product, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="truncate">{product.name}</span>
                    <span className="font-medium">₹{product.revenue.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Payment Methods</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {reportData.paymentMethods.map((method, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="capitalize">{method.method}</span>
                    <span className="font-medium">{method.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">No data available</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 