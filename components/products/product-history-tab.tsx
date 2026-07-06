"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ProductHistoryDetailModal } from "./product-history-detail-modal"
import {
  fetchProductHistory,
  fetchProductHistoryUsers,
  exportHistoryCSV,
  downloadCSV,
  exportHistoryPDF,
} from "@/lib/services/product-history-service"
import type { ProductHistoryEntry, ProductActionType } from "@/lib/types/rbac"
import { usePermission } from "@/hooks/use-permission"
import {
  Search, X, Download, FileText, ChevronLeft, ChevronRight,
  Clock, User, Filter, Eye, AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"

const ACTION_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  CREATED:        { bg: "rgba(5,150,105,0.15)",  text: "#6ee7b7", border: "rgba(5,150,105,0.3)",   label: "Created" },
  UPDATED:        { bg: "rgba(2,132,199,0.15)",  text: "#7dd3fc", border: "rgba(2,132,199,0.3)",   label: "Updated" },
  DELETED:        { bg: "rgba(225,29,72,0.15)",  text: "#fca5a5", border: "rgba(225,29,72,0.3)",   label: "Deleted" },
  STOCK_UPDATED:  { bg: "rgba(217,119,6,0.15)",  text: "#fcd34d", border: "rgba(217,119,6,0.3)",   label: "Stock Updated" },
  PRICE_UPDATED:  { bg: "rgba(124,58,237,0.15)", text: "#c4b5fd", border: "rgba(124,58,237,0.3)",  label: "Price Updated" },
  GST_UPDATED:    { bg: "rgba(8,145,178,0.15)",  text: "#67e8f9", border: "rgba(8,145,178,0.3)",   label: "GST Updated" },
  BARCODE_UPDATED:{ bg: "rgba(107,114,128,0.15)","text": "#9ca3af", border: "rgba(107,114,128,0.3)", label: "Barcode Updated" },
  IMAGE_UPDATED:  { bg: "rgba(245,158,11,0.15)", text: "#fbbf24", border: "rgba(245,158,11,0.3)",  label: "Image Updated" },
}

function changeSummary(entry: ProductHistoryEntry): string {
  const prev = entry.previous_values || {}
  const next = entry.new_values || {}
  const parts: string[] = []
  if (prev.price !== undefined && next.price !== undefined && prev.price !== next.price)
    parts.push(`Price: ₹${prev.price} → ₹${next.price}`)
  if (prev.stock_quantity !== undefined && next.stock_quantity !== undefined && prev.stock_quantity !== next.stock_quantity)
    parts.push(`Stock: ${prev.stock_quantity} → ${next.stock_quantity}`)
  if (prev.gst_rate !== undefined && next.gst_rate !== undefined && prev.gst_rate !== next.gst_rate)
    parts.push(`GST: ${prev.gst_rate}% → ${next.gst_rate}%`)
  if (prev.name !== undefined && next.name !== undefined && prev.name !== next.name)
    parts.push(`Name: "${prev.name}" → "${next.name}"`)
  return parts.join(" • ") || "—"
}

export function ProductHistoryTab() {
  const { canView } = usePermission("product_history")
  const [entries, setEntries] = useState<ProductHistoryEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [actionFilter, setActionFilter] = useState<ProductActionType | "">("")
  const [userFilter, setUserFilter] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])
  const [selectedEntry, setSelectedEntry] = useState<ProductHistoryEntry | null>(null)
  const [exporting, setExporting] = useState(false)

  const PAGE_SIZE = 15

  const loadHistory = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchProductHistory({
        search: search || undefined,
        action_type: actionFilter || undefined,
        changed_by: userFilter || undefined,
        start_date: startDate ? new Date(startDate).toISOString() : undefined,
        end_date: endDate ? new Date(endDate + "T23:59:59").toISOString() : undefined,
        page,
        page_size: PAGE_SIZE,
      })
      setEntries(result.data)
      setTotal(result.total)
      setTotalPages(result.total_pages)
    } catch (err: any) {
      toast.error("Failed to load history")
    } finally {
      setLoading(false)
    }
  }, [search, actionFilter, userFilter, startDate, endDate, page])

  useEffect(() => { loadHistory() }, [loadHistory])
  useEffect(() => {
    fetchProductHistoryUsers().then(setUsers)
  }, [])

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [search, actionFilter, userFilter, startDate, endDate])

  const handleExportCSV = async () => {
    setExporting(true)
    try {
      // Fetch all without pagination
      const all = await fetchProductHistory({ search, action_type: actionFilter || undefined, page_size: 10000 })
      const csv = exportHistoryCSV(all.data)
      downloadCSV(csv, `product-history-${new Date().toISOString().slice(0, 10)}.csv`)
      toast.success("CSV exported!")
    } catch { toast.error("Export failed") }
    finally { setExporting(false) }
  }

  const handleExportPDF = async () => {
    setExporting(true)
    try {
      const all = await fetchProductHistory({ search, action_type: actionFilter || undefined, page_size: 10000 })
      await exportHistoryPDF(all.data)
      toast.success("PDF exported!")
    } catch { toast.error("PDF export failed") }
    finally { setExporting(false) }
  }

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-8 w-8 text-rose-400" />
        </div>
        <h3 className="font-bold text-lg mb-1">Access Restricted</h3>
        <p className="text-sm text-muted-foreground">You don&apos;t have permission to view product history.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in-up">

      {/* ── Filters Row ────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by product or user…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 rounded-xl border-border bg-card"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Action type */}
          <Select value={actionFilter || "all"} onValueChange={(v) => setActionFilter(v === "all" ? "" : v as any)}>
            <SelectTrigger className="h-10 rounded-xl w-48">
              <Filter className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="All Actions" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">All Actions</SelectItem>
              {Object.entries(ACTION_COLORS).map(([key, val]) => (
                <SelectItem key={key} value={key}>{val.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Modified by */}
          {users.length > 0 && (
            <Select value={userFilter || "all"} onValueChange={(v) => setUserFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="h-10 rounded-xl w-44">
                <User className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Users</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-center">
          {/* Date range */}
          <div className="flex items-center gap-2 flex-1">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="h-10 rounded-xl flex-1" />
            <span className="text-muted-foreground text-sm shrink-0">to</span>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="h-10 rounded-xl flex-1" />
            {(startDate || endDate) && (
              <button onClick={() => { setStartDate(""); setEndDate("") }} className="text-muted-foreground hover:text-foreground shrink-0">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Exports */}
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={exporting}
              className="h-10 px-4 rounded-xl gap-2 text-xs font-semibold hover:border-emerald-500/50 hover:text-emerald-400"
            >
              <Download className="h-3.5 w-3.5" />CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={exporting}
              className="h-10 px-4 rounded-xl gap-2 text-xs font-semibold hover:border-blue-500/50 hover:text-blue-400"
            >
              <FileText className="h-3.5 w-3.5" />PDF
            </Button>
          </div>
        </div>
      </div>

      {/* ── Stats bar ──────────────────────────────────────── */}
      {!loading && (
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-bold text-foreground">{entries.length}</span> of{" "}
          <span className="font-bold text-foreground">{total}</span> records
          {page > 1 && ` (page ${page} of ${totalPages})`}
        </p>
      )}

      {/* ── History List ────────────────────────────────────── */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-20 skeleton rounded-xl" />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-20 animate-fade-in">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <h3 className="font-bold text-lg mb-1">No history found</h3>
          <p className="text-sm text-muted-foreground">Try adjusting your filters.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry, i) => {
            const colors = ACTION_COLORS[entry.action_type] || ACTION_COLORS.UPDATED
            const summary = changeSummary(entry)
            return (
              <div
                key={entry.id}
                className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card hover:border-blue-500/30 transition-all animate-fade-in-up group"
                style={{ animationDelay: `${i * 0.03}s`, animationFillMode: "forwards" }}
              >
                {/* Action badge */}
                <span
                  className="shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded-lg mt-0.5"
                  style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
                >
                  {colors.label}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{entry.product_name}</p>
                  {summary !== "—" && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{summary}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <User className="h-3 w-3" />{entry.changed_by_name || "System"}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {new Date(entry.created_at).toLocaleString("en-IN", {
                        day: "numeric", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                {/* View details */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedEntry(entry)}
                  className="h-8 px-3 rounded-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-blue-500/10 hover:text-blue-400 shrink-0"
                >
                  <Eye className="h-3 w-3 mr-1.5" />Details
                </Button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Pagination ──────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="h-9 rounded-xl"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[100px] text-center">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="h-9 rounded-xl"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Detail modal */}
      <ProductHistoryDetailModal
        entry={selectedEntry}
        open={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
      />
    </div>
  )
}
