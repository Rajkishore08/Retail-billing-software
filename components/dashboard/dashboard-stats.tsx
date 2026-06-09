"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Package, Users, RefreshCw, IndianRupee, ArrowUpRight, TrendingUp } from "lucide-react"
import { useDashboardStats } from "@/hooks/use-dashboard-stats"

const CARDS = [
  {
    key: "products",
    label: "Total Products",
    sub: (v: number) => v > 0 ? "Items in inventory" : "Add products to start",
    icon: Package,
    gradient: "linear-gradient(135deg,#7c3aed 0%,#5b21b6 100%)",
    glow: "glow-violet",
    accent: "stat-card-violet",
    iconBg: "rgba(124,58,237,0.18)",
    iconColor: "#c4b5fd",
    change: "+12 this week",
    changeBg: "rgba(124,58,237,0.15)",
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

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(amount)
}

export function DashboardStats() {
  const { totalProducts, totalCustomers, monthlyRevenue, loading, error, refresh } = useDashboardStats()

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
    <div className="space-y-4">
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
          className="h-9 px-4 text-xs gap-2 text-muted-foreground hover:text-foreground rounded-xl border border-border hover:border-violet-500/40"
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
                {/* Top row: icon + arrow */}
                <div className="flex items-start justify-between mb-5">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
                    style={{ background: card.gradient }}
                  >
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: card.iconBg }}
                  >
                    <TrendingUp className="h-3.5 w-3.5" style={{ color: card.iconColor }} />
                  </div>
                </div>

                {/* Value */}
                <div
                  className="text-3xl font-bold tracking-tight mb-1 animate-number-pop font-numeric"
                  style={{ color: card.iconColor, animationDelay: `${0.2 + i * 0.08}s`, animationFillMode: "forwards", opacity: 0 }}
                >
                  {display}
                </div>
                <p className="text-sm font-semibold text-foreground/80 mb-4">{card.label}</p>

                {/* Divider */}
                <div className="divider mb-4" />

                {/* Sub + change */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{card.sub(raw)}</p>
                  <span
                    className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: card.changeBg, color: card.iconColor }}
                  >
                    ↑ {card.change}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
