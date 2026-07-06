"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { ProductHistoryEntry } from "@/lib/types/rbac"
import { Clock, User, Tag, ArrowRight } from "lucide-react"

const ACTION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  CREATED:        { bg: "rgba(5,150,105,0.15)",  text: "#6ee7b7",  border: "rgba(5,150,105,0.3)"  },
  UPDATED:        { bg: "rgba(2,132,199,0.15)",  text: "#7dd3fc",  border: "rgba(2,132,199,0.3)"  },
  DELETED:        { bg: "rgba(225,29,72,0.15)",  text: "#fca5a5",  border: "rgba(225,29,72,0.3)"  },
  STOCK_UPDATED:  { bg: "rgba(217,119,6,0.15)",  text: "#fcd34d",  border: "rgba(217,119,6,0.3)"  },
  PRICE_UPDATED:  { bg: "rgba(124,58,237,0.15)", text: "#c4b5fd",  border: "rgba(124,58,237,0.3)" },
  GST_UPDATED:    { bg: "rgba(8,145,178,0.15)",  text: "#67e8f9",  border: "rgba(8,145,178,0.3)"  },
  BARCODE_UPDATED:{ bg: "rgba(107,114,128,0.15)","text": "#9ca3af", border: "rgba(107,114,128,0.3)"},
  IMAGE_UPDATED:  { bg: "rgba(245,158,11,0.15)", text: "#fbbf24",  border: "rgba(245,158,11,0.3)" },
}

const TRACKED_FIELDS: Array<{ key: string; label: string; format?: (v: any) => string }> = [
  { key: "name",            label: "Product Name" },
  { key: "price",           label: "MRP (₹)",          format: (v) => `₹${Number(v).toFixed(2)}` },
  { key: "selling_price",   label: "Selling Price (₹)", format: (v) => `₹${Number(v).toFixed(2)}` },
  { key: "cost_price",      label: "Cost Price (₹)",    format: (v) => `₹${Number(v).toFixed(2)}` },
  { key: "stock_quantity",  label: "Stock Quantity" },
  { key: "min_stock_level", label: "Min Stock Level" },
  { key: "gst_rate",        label: "GST Rate (%)",      format: (v) => `${v}%` },
  { key: "hsn_code",        label: "HSN Code" },
  { key: "brand",           label: "Brand" },
  { key: "barcode",         label: "Barcode" },
  { key: "price_includes_gst", label: "Price Incl. GST", format: (v) => (v ? "Yes" : "No") },
]

interface ProductHistoryDetailModalProps {
  entry: ProductHistoryEntry | null
  open: boolean
  onClose: () => void
}

export function ProductHistoryDetailModal({ entry, open, onClose }: ProductHistoryDetailModalProps) {
  if (!entry) return null

  const prev = entry.previous_values || {}
  const next = entry.new_values || {}
  const colors = ACTION_COLORS[entry.action_type] || ACTION_COLORS.UPDATED

  const changedFields = TRACKED_FIELDS.filter(
    (f) => prev[f.key] !== undefined && next[f.key] !== undefined && prev[f.key] !== next[f.key]
  )
  const onlyInPrev = TRACKED_FIELDS.filter(
    (f) => prev[f.key] !== undefined && next[f.key] === undefined
  )
  const onlyInNext = TRACKED_FIELDS.filter(
    (f) => prev[f.key] === undefined && next[f.key] !== undefined
  )

  const formatVal = (field: typeof TRACKED_FIELDS[0], obj: Record<string, any>) => {
    const raw = obj[field.key]
    if (raw === null || raw === undefined) return <span className="text-slate-500 italic">—</span>
    return <span>{field.format ? field.format(raw) : String(raw)}</span>
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl rounded-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", paddingBottom: "1rem" }}>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
                >
                  {entry.action_type.replace("_", " ")}
                </span>
                <span className="font-bold text-base truncate">{entry.product_name}</span>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {entry.changed_by_name || "System"}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(entry.created_at).toLocaleString("en-IN", {
                    day: "numeric", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 mt-3">
          {/* Changed fields */}
          {changedFields.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <Tag className="h-3 w-3" /> Changed Fields
              </p>
              <div className="space-y-2">
                {changedFields.map((field) => (
                  <div
                    key={field.key}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: "rgba(217,119,6,0.06)", border: "1px solid rgba(217,119,6,0.2)" }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-muted-foreground mb-1">{field.label}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-rose-400 line-through">
                          {formatVal(field, prev)}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span className="text-sm font-bold text-emerald-400">
                          {formatVal(field, next)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Before / After comparison */}
          {(entry.action_type === "CREATED" || entry.action_type === "DELETED" || changedFields.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Before */}
              {Object.keys(prev).length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-rose-400/80 mb-2">
                    ← Before
                  </p>
                  <div
                    className="rounded-xl p-4 space-y-2 text-sm"
                    style={{ background: "rgba(225,29,72,0.06)", border: "1px solid rgba(225,29,72,0.15)" }}
                  >
                    {TRACKED_FIELDS.filter((f) => prev[f.key] !== undefined && prev[f.key] !== null).map((field) => (
                      <div key={field.key} className="flex justify-between gap-2">
                        <span className="text-muted-foreground text-xs">{field.label}</span>
                        <span className={`text-xs font-semibold ${
                          changedFields.some(f => f.key === field.key) ? "text-rose-400" : ""
                        }`}>
                          {field.format ? field.format(prev[field.key]) : String(prev[field.key])}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* After */}
              {Object.keys(next).length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-400/80 mb-2">
                    → After
                  </p>
                  <div
                    className="rounded-xl p-4 space-y-2 text-sm"
                    style={{ background: "rgba(5,150,105,0.06)", border: "1px solid rgba(5,150,105,0.15)" }}
                  >
                    {TRACKED_FIELDS.filter((f) => next[f.key] !== undefined && next[f.key] !== null).map((field) => (
                      <div key={field.key} className="flex justify-between gap-2">
                        <span className="text-muted-foreground text-xs">{field.label}</span>
                        <span className={`text-xs font-semibold ${
                          changedFields.some(f => f.key === field.key) ? "text-emerald-400" : ""
                        }`}>
                          {field.format ? field.format(next[field.key]) : String(next[field.key])}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* No changes to show */}
          {changedFields.length === 0 && Object.keys(prev).length === 0 && Object.keys(next).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No detailed change data available.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
