import { supabase } from "@/lib/supabase-client"
import type { ProductHistoryEntry, ProductActionType } from "@/lib/types/rbac"

export interface ProductHistoryFilters {
  product_id?: string
  changed_by?: string
  action_type?: ProductActionType | ""
  start_date?: string
  end_date?: string
  search?: string
  page?: number
  page_size?: number
}

export interface ProductHistoryResult {
  data: ProductHistoryEntry[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// ─── Fetch product history with filters & pagination ─────────────────────────

export async function fetchProductHistory(
  filters: ProductHistoryFilters = {}
): Promise<ProductHistoryResult> {
  const page = filters.page ?? 1
  const page_size = filters.page_size ?? 20
  const offset = (page - 1) * page_size

  const { data, error } = await supabase.rpc("get_product_history", {
    p_product_id: filters.product_id || null,
    p_changed_by: filters.changed_by || null,
    p_action_type: filters.action_type || null,
    p_start_date: filters.start_date || null,
    p_end_date: filters.end_date || null,
    p_search: filters.search || null,
    p_limit: page_size,
    p_offset: offset,
  })

  if (error) throw error

  const total = (data?.[0]?.total_count as number) ?? 0
  return {
    data: data || [],
    total,
    page,
    page_size,
    total_pages: Math.ceil(total / page_size),
  }
}

// ─── Fetch list of users who made changes (for filter dropdown) ──────────────

export async function fetchProductHistoryUsers(): Promise<
  { id: string; name: string }[]
> {
  const { data, error } = await supabase
    .from("product_history")
    .select("changed_by, changed_by_name")
    .not("changed_by", "is", null)

  if (error) return []

  const unique = new Map<string, string>()
  ;(data || []).forEach((row: any) => {
    if (row.changed_by && !unique.has(row.changed_by)) {
      unique.set(row.changed_by, row.changed_by_name || "Unknown")
    }
  })

  return Array.from(unique.entries()).map(([id, name]) => ({ id, name }))
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function formatValue(val: any): string {
  if (val === null || val === undefined) return ""
  if (typeof val === "boolean") return val ? "Yes" : "No"
  return String(val)
}

export function exportHistoryCSV(entries: ProductHistoryEntry[]): string {
  const headers = [
    "Date/Time",
    "Product Name",
    "Action",
    "Modified By",
    "Previous Price",
    "New Price",
    "Previous Stock",
    "New Stock",
    "Previous GST",
    "New GST",
  ]

  const rows = entries.map((e) => {
    const prev = e.previous_values || {}
    const next = e.new_values || {}
    return [
      new Date(e.created_at).toLocaleString("en-IN"),
      e.product_name,
      e.action_type,
      e.changed_by_name || "System",
      formatValue(prev.price),
      formatValue(next.price),
      formatValue(prev.stock_quantity),
      formatValue(next.stock_quantity),
      formatValue(prev.gst_rate),
      formatValue(next.gst_rate),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  })

  return [headers.join(","), ...rows].join("\n")
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

// ─── Client-side PDF export using jsPDF ──────────────────────────────────────

export async function exportHistoryPDF(entries: ProductHistoryEntry[]): Promise<void> {
  // Dynamic import to avoid SSR issues
  const { default: jsPDF } = await import("jspdf")
  const { default: autoTable } = await import("jspdf-autotable")

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })

  doc.setFontSize(16)
  doc.text("Product Change History", 14, 14)
  doc.setFontSize(10)
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 22)

  autoTable(doc, {
    startY: 28,
    head: [["Date/Time", "Product Name", "Action", "Modified By", "Changes"]],
    body: entries.map((e) => {
      const prev = e.previous_values || {}
      const next = e.new_values || {}
      const changes: string[] = []
      if (prev.price !== next.price && next.price !== undefined)
        changes.push(`Price: ₹${prev.price} → ₹${next.price}`)
      if (prev.stock_quantity !== next.stock_quantity && next.stock_quantity !== undefined)
        changes.push(`Stock: ${prev.stock_quantity} → ${next.stock_quantity}`)
      if (prev.gst_rate !== next.gst_rate && next.gst_rate !== undefined)
        changes.push(`GST: ${prev.gst_rate}% → ${next.gst_rate}%`)
      return [
        new Date(e.created_at).toLocaleString("en-IN"),
        e.product_name,
        e.action_type,
        e.changed_by_name || "System",
        changes.join("; ") || "—",
      ]
    }),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [124, 58, 237] },
    alternateRowStyles: { fillColor: [245, 245, 255] },
  })

  doc.save(`product-history-${Date.now()}.pdf`)
}
