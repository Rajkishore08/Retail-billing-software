"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Package, Users, RefreshCw, IndianRupee, TrendingUp, Clock, Edit3, Zap } from "lucide-react"
import { useDashboardStats } from "@/hooks/use-dashboard-stats"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase-client"
import { useAuth } from "@/contexts/auth-context"
import { usePermission } from "@/hooks/use-permission"
import Link from "next/link"

const CARDS = [
  {
    key: "products",
    label: "Total Products",
    sub: (v: number) => v > 0 ? "Items in inventory" : "Add products to start",
    icon: Package,
    gradient: "linear-gradient(135deg,#2563eb 0%,#1d4ed8 100%)",
    glow: "glow-blue",
    accent: "stat-card-blue",
    iconBg: "rgba(37,99,235,0.18)",
    iconColor: "#93c5fd",
    change: "+12 this week",
    changeBg: "rgba(37,99,235,0.15)",
  },
  {
    key: "customers",
    label: "Total Customers",
    sub: (v: number) => v > 0 ? "Registered members" : "Build your base",
    icon: Users,
    gradient: "linear-gradient(135deg,#0284c7 0%,#075985 100%)",
    glow: "glow-sky",
    accent: "stat-card-sky",
    iconBg: "rgba(2,132,199,0.18)",
    iconColor: "#7dd3fc",
    change: "+3 this week",
    changeBg: "rgba(2,132,199,0.15)",
  },
  {
    key: "revenue",
    label: "Monthly Revenue",
    sub: () => "This calendar month",
    icon: IndianRupee,
    gradient: "linear-gradient(135deg,#059669 0%,#047857 100%)",
    glow: "glow-emerald",
    accent: "stat-card-emerald",
    iconBg: "rgba(5,150,105,0.18)",
    iconColor: "#6ee7b7",
    change: "+8.2% vs last month",
    changeBg: "rgba(5,150,105,0.15)",
    isCurrency: true,
  },
]

const ACTION_COLOR: Record<string, string> = {
  CREATED:        "#6ee7b7",
  UPDATED:        "#7dd3fc",
  DELETED:        "#fca5a5",
  STOCK_UPDATED:  "#fcd34d",
  PRICE_UPDATED:  "#93c5fd",
  GST_UPDATED:    "#67e8f9",
  BARCODE_UPDATED:"#9ca3af",
  IMAGE_UPDATED:  "#fbbf24",
}
const ACTION_BG: Record<string, string> = {
  CREATED:        "rgba(5,150,105,0.12)",
  UPDATED:        "rgba(2,132,199,0.12)",
  DELETED:        "rgba(225,29,72,0.12)",
  STOCK_UPDATED:  "rgba(217,119,6,0.12)",
  PRICE_UPDATED:  "rgba(37,99,235,0.12)",
  GST_UPDATED:    "rgba(8,145,178,0.12)",
  BARCODE_UPDATED:"rgba(107,114,128,0.12)",
  IMAGE_UPDATED:  "rgba(245,158,11,0.12)",
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(amount)
}

export function DashboardStats() {
  const { totalProducts, totalCustomers, monthlyRevenue, loading, error, refresh } = useDashboardStats()
  const { hasPermission } = useAuth()
  const { canView: canViewHistory } = usePermission("product_history")

  const [recentChanges, setRecentChanges] = useState<any[]>([])
  const [topModifiers, setTopModifiers] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  useEffect(() => {
    if (!canViewHistory) { setHistoryLoading(false); return }
    async function loadHistory() {
      setHistoryLoading(true)
      try {
        const [changesRes, modifiersRes] = await Promise.all([
          supabase.rpc("get_recent_product_changes", { p_limit: 5 }),
          supabase.rpc("get_top_product_modifiers", { p_limit: 3 }),
        ])
        setRecentChanges(changesRes.data || [])
        setTopModifiers(modifiersRes.data || [])
      } catch {}
      setHistoryLoading(false)
    }
    loadHistory()
  }, [canViewHistory])

  const values: Record<string, number> = {
    products: totalProducts,
    customers: totalCustomers,
    revenue: monthlyRevenue,
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 skeleton rounded-lg w-28" />
          <div className="h-8 skeleton rounded-xl w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {CARDS.map((c) => (
            <div key={c.key} className={`rounded-2xl border-0 overflow-hidden ${c.accent}`}
              style={{ background: "rgba(255,255,255,0.03)", minHeight: "160px" }}>
              <div className="p-6 space-y-3">
                <div className="skeleton h-11 w-11 rounded-xl" />
                <div className="skeleton h-8 w-24 rounded-lg" />
                <div className="skeleton h-3 w-32 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {CARDS.map((c) => (
          <Card key={c.key} className={`border-0 overflow-hidden rounded-2xl ${c.accent}`}>
            <CardContent className="p-6 text-center space-y-2">
              <p className="text-destructive text-sm font-semibold">Failed to load</p>
              <Button variant="ghost" size="sm" onClick={refresh} className="h-7 text-xs gap-1">
                <RefreshCw className="h-3 w-3" /> Retry
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Key Metrics</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Live store performance overview</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={loading}
          className="h-9 px-4 text-xs gap-2 text-muted-foreground hover:text-foreground rounded-xl border border-border hover:border-blue-500/40"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {CARDS.map((card, i) => {
          const Icon = card.icon
          const raw  = values[card.key] ?? 0
          const display = card.isCurrency ? formatCurrency(raw) : raw.toLocaleString("en-IN")

          return (
            <div
              key={card.key}
              className={`rounded-2xl overflow-hidden card-hover ${card.accent} ${card.glow} stagger-${i + 1} animate-fade-in-up`}
              style={{
                background: "linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
                border: "1px solid rgba(255,255,255,0.07)",
                animationDelay: `${i * 0.08}s`,
                animationFillMode: "forwards",
              }}
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-5">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg" style={{ background: card.gradient }}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: card.iconBg }}>
                    <TrendingUp className="h-3.5 w-3.5" style={{ color: card.iconColor }} />
                  </div>
                </div>
                <div
                  className="text-3xl font-bold tracking-tight mb-1 animate-number-pop font-numeric"
                  style={{ color: card.iconColor, animationDelay: `${0.2 + i * 0.08}s`, animationFillMode: "forwards", opacity: 0 }}
                >
                  {display}
                </div>
                <p className="text-sm font-semibold text-foreground/80 mb-4">{card.label}</p>
                <div className="divider mb-4" />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{card.sub(raw)}</p>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full" style={{ background: card.changeBg, color: card.iconColor }}>
                    ↑ {card.change}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Product History Widgets (admin/manager only) ─── */}
      {canViewHistory && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Recent Changes widget */}
          <div
            className="rounded-2xl p-5 animate-fade-in-up"
            style={{
              background: "linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Clock className="h-3.5 w-3.5 text-blue-400" />
                </div>
                <h3 className="font-bold text-sm">Recent Product Changes</h3>
              </div>
              <Link href="/products?tab=history">
                <Button variant="ghost" size="sm" className="h-7 text-xs hover:text-blue-400 px-2 rounded-lg">
                  View all
                </Button>
              </Link>
            </div>
            {historyLoading ? (
              <div className="space-y-2">
                {[1,2,3,4,5].map(i => <div key={i} className="h-9 skeleton rounded-lg" />)}
              </div>
            ) : recentChanges.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No changes recorded yet.</p>
            ) : (
              <div className="space-y-1.5">
                {recentChanges.map((c, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 transition-colors">
                    <span
                      className="text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0"
                      style={{
                        background: ACTION_BG[c.action_type] || "rgba(255,255,255,0.08)",
                        color: ACTION_COLOR[c.action_type] || "#9ca3af",
                      }}
                    >
                      {c.action_type?.replace("_", " ")}
                    </span>
                    <p className="text-xs font-medium truncate flex-1">{c.product_name}</p>
                    <p className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(c.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Modifiers widget */}
          <div
            className="rounded-2xl p-5 animate-fade-in-up"
            style={{
              background: "linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
              border: "1px solid rgba(255,255,255,0.07)",
              animationDelay: "0.07s",
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Edit3 className="h-3.5 w-3.5 text-amber-400" />
              </div>
              <h3 className="font-bold text-sm">Top Product Modifiers</h3>
            </div>
            {historyLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-12 skeleton rounded-lg" />)}
              </div>
            ) : topModifiers.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No activity recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {topModifiers.map((m, i) => {
                  const max = topModifiers[0]?.change_count || 1
                  const pct = Math.round((m.change_count / max) * 100)
                  return (
                    <div key={i} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full gradient-primary flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                            {i + 1}
                          </span>
                          <span className="font-medium">{m.changed_by_name || "Unknown"}</span>
                        </div>
                        <span className="font-bold text-amber-400">{m.change_count} changes</span>
                      </div>
                      <div className="progress-track h-1.5">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            background: "linear-gradient(90deg,#f59e0b,#d97706)",
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
