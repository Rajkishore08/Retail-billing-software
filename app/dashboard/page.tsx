"use client"

import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ShoppingCart, Package, UserPlus, BarChart3, ArrowRight,
  Sparkles, Clock, CheckCircle2, Zap, TrendingUp, Star,
} from "lucide-react"
import Link from "next/link"
import { DashboardStats } from "@/components/dashboard/dashboard-stats"
import { SalesCharts } from "@/components/dashboard/sales-charts"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState, useEffect } from "react"
import { RouteGuard } from "@/components/auth/route-guard"

const quickActions = [
  {
    href: "/pos",
    label: "Start Billing",
    desc: "Open POS register",
    icon: ShoppingCart,
    gradient: "linear-gradient(135deg,#059669,#047857)",
    glow: "0 0 24px rgba(5,150,105,0.35)",
    bg: "rgba(5,150,105,0.08)",
    border: "rgba(5,150,105,0.2)",
    iconColor: "#6ee7b7",
    tag: "Quick",
  },
  {
    href: "/products",
    label: "Manage Products",
    desc: "View & update stock",
    icon: Package,
    gradient: "linear-gradient(135deg,#7c3aed,#5b21b6)",
    glow: "0 0 24px rgba(124,58,237,0.35)",
    bg: "rgba(124,58,237,0.08)",
    border: "rgba(124,58,237,0.2)",
    iconColor: "#c4b5fd",
    tag: "Catalog",
  },
  {
    href: "/customers",
    label: "Add Customer",
    desc: "Register new member",
    icon: UserPlus,
    gradient: "linear-gradient(135deg,#0284c7,#075985)",
    glow: "0 0 24px rgba(2,132,199,0.35)",
    bg: "rgba(2,132,199,0.08)",
    border: "rgba(2,132,199,0.2)",
    iconColor: "#7dd3fc",
    tag: "CRM",
  },
  {
    href: "/reports",
    label: "View Reports",
    desc: "Sales & analytics",
    icon: BarChart3,
    gradient: "linear-gradient(135deg,#d97706,#b45309)",
    glow: "0 0 24px rgba(217,119,6,0.35)",
    bg: "rgba(217,119,6,0.08)",
    border: "rgba(217,119,6,0.2)",
    iconColor: "#fcd34d",
    tag: "Analytics",
  },
]

const steps = [
  { label: "Set up your products", sub: "Add items with prices and stock", done: true },
  { label: "Configure store settings", sub: "Update your store info & tax preferences", done: true },
  { label: "Start making sales", sub: "Use POS to process transactions", done: false },
]

export default function DashboardPage() {
  const { profile } = useAuth()
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const firstName = profile?.full_name?.split(" ")[0] || "there"

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 700)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => { setMounted(true) }, [])

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const greetingEmoji = hour < 12 ? "🌅" : hour < 17 ? "☀️" : "🌙"
  const dateString = mounted
    ? now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : ""

  if (loading) {
    return (
      <div className="space-y-8 animate-fade-in">
        <div className="h-44 skeleton rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => <div key={i} className="h-40 skeleton rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-36 skeleton rounded-2xl" />)}
        </div>
      </div>
    )
  }

  return (
    <RouteGuard module="dashboard">
    <div className="space-y-8 animate-fade-in-up">

      {/* ── Hero Banner ───────────────────────────────────── */}
      <div className="page-header-banner">
        {/* Extra decorative blobs */}
        <div
          className="absolute top-[-60px] right-[-40px] w-56 h-56 rounded-full pointer-events-none animate-float-slow"
          style={{ background: "radial-gradient(circle,rgba(124,58,237,0.3),transparent 65%)" }}
        />
        <div
          className="absolute bottom-[-30px] right-[200px] w-36 h-36 rounded-full pointer-events-none animate-float-slow opacity-60"
          style={{ background: "radial-gradient(circle,rgba(5,150,105,0.25),transparent 65%)", animationDelay: "-3s" }}
        />
        <div
          className="absolute top-[20%] right-[35%] w-20 h-20 rounded-full pointer-events-none opacity-40"
          style={{ background: "radial-gradient(circle,rgba(2,132,199,0.3),transparent 65%)" }}
        />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div>
            {/* Greeting chip */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4"
              style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.25)" }}>
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-amber-300 text-xs font-semibold">{greeting}, {firstName}!</span>
            </div>

            <h1 className="text-4xl font-bold text-white tracking-tight mb-2">
              Your Store Dashboard {greetingEmoji}
            </h1>
            <p className="text-violet-300/80 text-sm font-medium">
              Techno Bills POS — Here&apos;s your store at a glance.
            </p>

            {/* Date + quick stats row */}
            <div className="flex flex-wrap items-center gap-4 mt-4">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-slate-400 text-xs font-medium" suppressHydrationWarning>
                  {dateString}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ background: "rgba(5,150,105,0.15)", border: "1px solid rgba(5,150,105,0.25)" }}>
                <TrendingUp className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400 text-[11px] font-semibold">Store Active</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 flex-wrap shrink-0">
            <Link href="/pos">
              <Button
                className="h-11 px-6 font-semibold text-sm rounded-xl border-0 shadow-xl hover:opacity-90"
                style={{ background: "linear-gradient(135deg,#059669,#047857)", boxShadow: "0 4px 20px rgba(5,150,105,0.4)" }}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Open POS
              </Button>
            </Link>
            <Link href="/products">
              <Button
                variant="outline"
                className="h-11 px-6 font-semibold text-sm rounded-xl text-white hover:bg-white/10 hover:text-white"
                style={{ borderColor: "rgba(255,255,255,0.2)" }}
              >
                <Package className="h-4 w-4 mr-2" />
                Products
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────── */}
      <Tabs defaultValue="overview" className="space-y-7">
        <TabsList className="h-11 px-1.5 rounded-xl bg-card border border-border gap-1">
          <TabsTrigger value="overview" className="rounded-lg text-sm font-semibold px-6">Overview</TabsTrigger>
          <TabsTrigger value="analytics" className="rounded-lg text-sm font-semibold px-6">Sales Analytics</TabsTrigger>
        </TabsList>

        {/* ── Overview tab ──────────────────────────────── */}
        <TabsContent value="overview" className="space-y-8 mt-0">
          {/* Stats */}
          <DashboardStats />

          {/* Quick Actions */}
          <div>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold tracking-tight">Quick Actions</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Jump to the most-used features</p>
              </div>
              <Star className="h-4 w-4 text-amber-400" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {quickActions.map((action, i) => {
                const Icon = action.icon
                return (
                  <Link key={action.href} href={action.href}>
                    <div
                      className={`rounded-2xl p-5 flex flex-col gap-4 cursor-pointer card-hover border stagger-${i + 1} animate-fade-in-up group`}
                      style={{
                        background: action.bg,
                        borderColor: action.border,
                        animationDelay: `${i * 0.07}s`,
                        animationFillMode: "forwards",
                      }}
                    >
                      {/* Tag */}
                      <div className="flex items-center justify-between">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide"
                          style={{ background: action.bg, color: action.iconColor, border: `1px solid ${action.border}` }}
                        >
                          {action.tag}
                        </span>
                        <ArrowRight
                          className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1"
                          style={{ color: action.iconColor }}
                        />
                      </div>

                      {/* Icon */}
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center shadow-lg"
                        style={{ background: action.gradient, boxShadow: action.glow }}
                      >
                        <Icon className="h-5 w-5 text-white" />
                      </div>

                      <div>
                        <p className="font-bold text-sm leading-tight">{action.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">{action.desc}</p>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Getting Started */}
          <Card className="border border-border rounded-2xl overflow-hidden">
            <CardHeader className="pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <CardTitle className="text-base font-bold flex items-center gap-2.5">
                <span className="inline-flex w-7 h-7 rounded-lg gradient-emerald items-center justify-center shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                </span>
                Getting Started
                <span className="ml-auto text-xs font-semibold px-2.5 py-1 rounded-full"
                  style={{ background: "rgba(5,150,105,0.15)", color: "#6ee7b7" }}>
                  {steps.filter(s => s.done).length}/{steps.length} done
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {steps.map((step, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className={[
                    "w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold shadow-md",
                    step.done
                      ? "gradient-emerald text-white"
                      : "text-violet-400 border border-violet-500/30",
                  ].join(" ")}
                    style={!step.done ? { background: "rgba(124,58,237,0.1)" } : {}}>
                    {step.done ? <CheckCircle2 className="h-4 w-4" /> : (
                      <span className="font-numeric">{i + 1}</span>
                    )}
                  </div>
                  <div className="pt-1 flex-1">
                    <p className={`text-sm font-semibold ${step.done ? "line-through text-muted-foreground" : ""}`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.sub}</p>
                  </div>
                  {!step.done && (
                    <Link href="/pos">
                      <Button size="sm" className="h-7 text-xs px-3 rounded-lg gradient-primary border-0 text-white shrink-0">
                        <Zap className="h-3 w-3 mr-1" /> Start
                      </Button>
                    </Link>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Analytics tab ──────────────────────────────── */}
        <TabsContent value="analytics" className="space-y-6 mt-0">
          <SalesCharts />
        </TabsContent>
      </Tabs>
    </div>
    </RouteGuard>
  )
}
