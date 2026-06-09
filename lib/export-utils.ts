"use client"

import { supabase } from "./supabase-client"

export type ExportOptions = {
  dateRange: string
  startDate?: string
  endDate?: string
  reportType: "sales" | "inventory" | "customers" | "transactions"
}

export const exportToCSV = (data: any[], filename: string) => {
  if (!data || data.length === 0) {
    throw new Error("No data to export")
  }

  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(","),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header]
        const escaped = String(value).replace(/"/g, '""')
        return escaped.includes(",") ? `"${escaped}"` : escaped
      }).join(",")
    )
  ].join("\n")

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${filename}-${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  window.URL.revokeObjectURL(url)
}

export const exportSalesReport = async (options: ExportOptions) => {
  try {
    let end = new Date()
    let start = new Date()

    switch (options.dateRange) {
      case "7d": start.setDate(end.getDate() - 7); break
      case "30d": start.setDate(end.getDate() - 30); break
      case "90d": start.setDate(end.getDate() - 90); break
      case "custom":
        if (options.startDate && options.endDate) {
          start = new Date(options.startDate)
          end = new Date(options.endDate)
        }
        break
    }

    const { data: transactions, error } = await supabase
      .from("transactions")
      .select(`
        *,
        transaction_items (
          product_name,
          quantity,
          unit_price,
          total_price,
          gst_rate,
          price_includes_gst
        )
      `)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .eq("status", "completed")
      .order("created_at", { ascending: false })

    if (error) throw error

    const csvData = transactions?.map(t => ({
      "Invoice Number": t.invoice_number,
      "Date": new Date(t.created_at).toLocaleDateString(),
      "Time": new Date(t.created_at).toLocaleTimeString(),
      "Customer Name": t.customer_name || "Walk-in Customer",
      "Customer Phone": t.customer_phone || "",
      "Subtotal": t.subtotal,
      "GST Amount": t.gst_amount,
      "Total Amount": t.total_amount,
      "Payment Method": t.payment_method,
      "Cash Received": t.cash_received || "",
      "Change Amount": t.change_amount || "",
      "Loyalty Points Earned": t.loyalty_points_earned || 0,
      "Loyalty Points Redeemed": t.loyalty_points_redeemed || 0,
      "Loyalty Discount": t.loyalty_discount_amount || 0,
      "Rounding Adjustment": t.rounding_adjustment || 0,
      "Cashier": t.cashier_id,
      "Items Count": t.transaction_items?.length || 0
    })) || []

    exportToCSV(csvData, "sales-report")
    return { success: true, count: csvData.length }
  } catch (error) {
    console.error("Error exporting sales report:", error)
    throw error
  }
}

export const exportInventoryReport = async () => {
  try {
    const { data: products, error } = await supabase
      .from("products")
      .select("*")
      .order("name")

    if (error) throw error

    const csvData = products?.map(p => ({
      "Product Name": p.name,
      "Price": p.price,
      "Stock Quantity": p.stock_quantity,
      "Min Stock Level": p.min_stock_level,
      "GST Rate": p.gst_rate,
      "Price Includes GST": p.price_includes_gst ? "Yes" : "No",
      "HSN Code": p.hsn_code || "",
      "Brand": p.brand || "",
      "Barcode": p.barcode || "",
      "Status": p.stock_quantity > 0 ? "In Stock" : "Out of Stock",
      "Created At": new Date(p.created_at).toLocaleDateString()
    })) || []

    exportToCSV(csvData, "inventory-report")
    return { success: true, count: csvData.length }
  } catch (error) {
    console.error("Error exporting inventory report:", error)
    throw error
  }
}

export const exportCustomerReport = async () => {
  try {
    const { data: customers, error } = await supabase
      .from("customers")
      .select("*")
      .order("name")

    if (error) throw error

    const csvData = customers?.map(c => ({
      "Customer Name": c.name,
      "Phone": c.phone,
      "Email": c.email || "",
      "Loyalty Points": c.loyalty_points,
      "Total Spent": c.total_spent,
      "Created At": new Date(c.created_at).toLocaleDateString()
    })) || []

    exportToCSV(csvData, "customer-report")
    return { success: true, count: csvData.length }
  } catch (error) {
    console.error("Error exporting customer report:", error)
    throw error
  }
}

export const exportTransactionDetails = async (options: ExportOptions) => {
  try {
    let end = new Date()
    let start = new Date()

    switch (options.dateRange) {
      case "7d": start.setDate(end.getDate() - 7); break
      case "30d": start.setDate(end.getDate() - 30); break
      case "90d": start.setDate(end.getDate() - 90); break
      case "custom":
        if (options.startDate && options.endDate) {
          start = new Date(options.startDate)
          end = new Date(options.endDate)
        }
        break
    }

    const { data: transactions, error } = await supabase
      .from("transactions")
      .select(`
        *,
        transaction_items (
          product_name,
          quantity,
          unit_price,
          total_price,
          gst_rate,
          price_includes_gst
        )
      `)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .eq("status", "completed")
      .order("created_at", { ascending: false })

    if (error) throw error

    const csvData: any[] = []
    
    transactions?.forEach(t => {
      if (t.transaction_items && t.transaction_items.length > 0) {
        t.transaction_items.forEach((item: any) => {
          csvData.push({
            "Transaction ID": t.id,
            "Invoice Number": t.invoice_number,
            "Date": new Date(t.created_at).toLocaleDateString(),
            "Customer Name": t.customer_name || "Walk-in Customer",
            "Product Name": item.product_name,
            "Quantity": item.quantity,
            "Unit Price": item.unit_price,
            "Total Price": item.total_price,
            "GST Rate": item.gst_rate,
            "Price Includes GST": item.price_includes_gst ? "Yes" : "No",
            "Payment Method": t.payment_method,
            "Transaction Total": t.total_amount
          })
        })
      } else {
        csvData.push({
          "Transaction ID": t.id,
          "Invoice Number": t.invoice_number,
          "Date": new Date(t.created_at).toLocaleDateString(),
          "Customer Name": t.customer_name || "Walk-in Customer",
          "Product Name": "N/A",
          "Quantity": 0,
          "Unit Price": 0,
          "Total Price": 0,
          "GST Rate": 0,
          "Price Includes GST": "N/A",
          "Payment Method": t.payment_method,
          "Transaction Total": t.total_amount
        })
      }
    })

    exportToCSV(csvData, "transaction-details")
    return { success: true, count: csvData.length }
  } catch (error) {
    console.error("Error exporting transaction details:", error)
    throw error
  }
}

// Internal function for generating daily sales report
export const generateDailySalesReport = async (startDate: Date, endDate: Date) => {
  try {
    const { data: transactions, error } = await supabase
      .from("transactions")
      .select("created_at, total_amount")
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString())
      .eq("status", "completed")

    if (error) throw error

    const dailySales = new Map<string, { sales: number; count: number }>()
    
    transactions?.forEach(t => {
      const date = new Date(t.created_at).toISOString().split('T')[0]
      const existing = dailySales.get(date) || { sales: 0, count: 0 }
      dailySales.set(date, {
        sales: existing.sales + (t.total_amount || 0),
        count: existing.count + 1
      })
    })

    return Array.from(dailySales.entries()).map(([date, data]) => ({
      date,
      sales: data.sales,
      transactions: data.count
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  } catch (error) {
    console.error("Error generating daily sales report:", error)
    throw error
  }
} 