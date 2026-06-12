"use client"

import type React from "react"
import { useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ShoppingBag, Mail, Lock, Eye, EyeOff, Zap, Shield, TrendingUp, Star } from "lucide-react"

const features = [
  { icon: Zap,        label: "Lightning Fast Billing",  desc: "Process transactions in seconds with barcode support" },
  { icon: Shield,     label: "Secure & Reliable",       desc: "End-to-end encrypted data with real-time sync"       },
  { icon: TrendingUp, label: "Real-time Analytics",     desc: "Live sales, stock insights and GST reports"          },
]

const stats = [
  { label: "Transactions", value: "10K+" },
  { label: "Products",     value: "500+"  },
  { label: "Uptime",       value: "99.9%" },
]

export function LoginForm() {
  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState("")
  const [showPass, setShowPass] = useState(false)
  const { signIn } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    const { error } = await signIn(email, password)
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-stretch">
      {/* ── Left Panel – Branding ──────────────────────────── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[52%] p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(145deg,#060612 0%,#0f0a24 40%,#0a0e28 70%,#060612 100%)" }}
      >
        {/* Animated mesh blobs */}
        <div
          className="absolute top-[-100px] left-[-80px] w-[420px] h-[420px] rounded-full pointer-events-none animate-orb-drift"
          style={{ background: "radial-gradient(circle,rgba(124,58,237,0.22),transparent 65%)", animationDelay: "0s" }}
        />
        <div
          className="absolute bottom-[-80px] right-[-60px] w-[360px] h-[360px] rounded-full pointer-events-none animate-orb-drift"
          style={{ background: "radial-gradient(circle,rgba(5,150,105,0.16),transparent 65%)", animationDelay: "-4s" }}
        />
        <div
          className="absolute top-[40%] right-[10%] w-[240px] h-[240px] rounded-full pointer-events-none animate-orb-drift"
          style={{ background: "radial-gradient(circle,rgba(2,132,199,0.12),transparent 65%)", animationDelay: "-8s" }}
        />

        {/* Fine grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Logo */}
        <div className="flex items-center gap-4 z-10 animate-fade-in-down">
          <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-2xl glow-violet animate-float">
            <ShoppingBag className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-xl leading-tight tracking-tight">Techno Bills</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
              <p className="text-violet-400 text-xs font-semibold">POS System v2.0</p>
            </div>
          </div>
        </div>

        {/* Headline + features */}
        <div className="z-10 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <h2 className="text-5xl font-bold text-white leading-[1.08] mb-5 tracking-tight">
            Smarter retail,<br />
            <span className="text-gradient-primary">faster billing.</span>
          </h2>
          <p className="text-slate-400 text-[15px] max-w-sm leading-relaxed mb-10">
            A modern point-of-sale system for Techno Bills — with GST billing, inventory, analytics and WhatsApp sharing built in.
          </p>

          {/* Stat pills */}
          <div className="flex gap-4 mb-10">
            {stats.map((s) => (
              <div
                key={s.label}
                className="px-4 py-2.5 rounded-xl text-center"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <p className="text-white font-bold text-lg leading-none font-numeric">{s.value}</p>
                <p className="text-slate-500 text-[11px] mt-1 font-medium">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Feature list */}
          <div className="space-y-4">
            {features.map(({ icon: Icon, label, desc }, i) => (
              <div
                key={label}
                className="flex items-center gap-4 animate-slide-in-left"
                style={{ animationDelay: `${0.2 + i * 0.1}s`, animationFillMode: "forwards", opacity: 0 }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.28)" }}
                >
                  <Icon className="h-4.5 w-4.5 text-violet-400 h-[18px] w-[18px]" />
                </div>
                <div>
                  <p className="text-white text-sm font-semibold leading-tight">{label}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="z-10 flex items-center justify-between">
          <p className="text-slate-600 text-xs">© 2025 Techno Bills. All rights reserved.</p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-xs font-medium">Live</span>
          </div>
        </div>
      </div>

      {/* ── Right Panel – Login Form ──────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background relative overflow-hidden">
        {/* Subtle background tint */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 60% at 50% 0%, rgba(124,58,237,0.05), transparent)" }}
        />

        <div className="w-full max-w-[380px] animate-fade-in-up relative z-10">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center glow-violet">
              <ShoppingBag className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight">Techno Bills</h1>
              <p className="text-muted-foreground text-xs">POS System</p>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold tracking-tight mb-1.5">Welcome back 👋</h2>
            <p className="text-muted-foreground text-sm">Sign in to access your POS dashboard</p>
          </div>

          {/* Card */}
          <div
            className="rounded-2xl p-6"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(20px)",
            }}
          >
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-semibold">Email address</Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-10 h-11 rounded-xl border-border bg-card"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-semibold">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-10 pr-11 h-11 rounded-xl border-border bg-card"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/25 text-destructive text-sm">
                  <Shield className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl font-semibold text-sm gradient-primary border-0 shadow-lg hover:opacity-90 glow-violet mt-2"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Signing in…
                  </div>
                ) : (
                  <span className="flex items-center gap-2">
                    Sign In
                    <span className="text-white/70">→</span>
                  </span>
                )}
              </Button>
            </form>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Need help? Contact your system administrator.
          </p>
        </div>
      </div>
    </div>
  )
}
