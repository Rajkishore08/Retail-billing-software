"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { ShieldOff, ArrowLeft, Home, Shield } from "lucide-react"
import { Suspense } from "react"

function AccessDeniedContent() {
  const searchParams = useSearchParams()
  const { profile } = useAuth()
  const module = searchParams.get("module") || "this page"

  const moduleLabels: Record<string, string> = {
    dashboard: "Dashboard",
    pos: "POS Billing",
    products: "Products",
    inventory: "Inventory",
    customers: "Customers",
    sales: "Sales Overview",
    reports: "Reports",
    settings: "Settings",
    users: "User Management",
    product_history: "Product History",
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: "linear-gradient(145deg,#060612 0%,#080f26 50%,#060612 100%)" }}
    >
      {/* Background orbs */}
      <div
        className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full pointer-events-none opacity-20"
        style={{ background: "radial-gradient(circle,rgba(225,29,72,0.5),transparent 70%)" }}
      />
      <div
        className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full pointer-events-none opacity-15"
        style={{ background: "radial-gradient(circle,rgba(37,99,235,0.4),transparent 70%)" }}
      />

      <div className="relative z-10 text-center px-6 max-w-md animate-fade-in-up">
        {/* Icon */}
        <div className="relative mx-auto w-24 h-24 mb-8">
          <div className="absolute inset-0 rounded-full bg-rose-500/20 animate-ping opacity-40" />
          <div className="relative w-24 h-24 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center">
            <ShieldOff className="h-10 w-10 text-rose-400" />
          </div>
        </div>

        {/* Error code */}
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4"
          style={{ background: "rgba(225,29,72,0.12)", border: "1px solid rgba(225,29,72,0.3)" }}
        >
          <span className="text-rose-400 text-xs font-bold tracking-wider">403 ACCESS DENIED</span>
        </div>

        <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">
          Access Restricted
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed mb-2">
          You don&apos;t have permission to access{" "}
          <span className="text-white font-semibold">{moduleLabels[module] || module}</span>.
        </p>
        <p className="text-slate-500 text-xs mb-8">
          Your current role is{" "}
          <span className="text-blue-400 font-semibold capitalize">{profile?.role || "unknown"}</span>.
          Contact your Admin to request access.
        </p>

        {/* Role info card */}
        <div
          className="flex items-center gap-3 p-4 rounded-xl mb-8 text-left"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
            <Shield className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{profile?.full_name}</p>
            <p className="text-xs text-muted-foreground capitalize">Role: {profile?.role}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <Link href="/dashboard">
            <Button className="h-11 px-6 rounded-xl gradient-primary border-0 font-semibold text-white shadow-xl">
              <Home className="h-4 w-4 mr-2" />
              Go to Dashboard
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="h-11 px-6 rounded-xl border-white/20 text-white hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function AccessDeniedPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <AccessDeniedContent />
    </Suspense>
  )
}
