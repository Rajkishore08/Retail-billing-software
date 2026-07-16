"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { LoginForm } from "@/components/login-form"
import { Sidebar } from "@/components/layout/sidebar"
import { AuthProvider } from "@/contexts/auth-context"
import { ShoppingBag, Sun, Moon } from "lucide-react"
import { useTheme } from "next-themes"

export function AppContent({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    try {
      const currentVersion = '1.0.1';
      const storedVersion = localStorage.getItem('app_version');
      if (storedVersion && storedVersion !== currentVersion) {
        if ('caches' in window) {
          caches.keys().then(names => {
            names.forEach(name => caches.delete(name));
          });
        }
        localStorage.setItem('app_version', currentVersion);
        window.location.reload();
      } else if (!storedVersion) {
        localStorage.setItem('app_version', currentVersion);
      }
    } catch (e) {
      console.error("Cache clean error:", e);
    }
  }, []);

  return (
    <AuthProvider>
      <AppContentInner>{children}</AppContentInner>
    </AuthProvider>
  )
}

function AppContentInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const [stuck, setStuck] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Belt-and-suspenders: auth-context has its own request timeouts, but if
  // loading is somehow still stuck after 12s (e.g. an unrelated hang), give
  // the user a way out instead of a spinner that never resolves.
  useEffect(() => {
    if (!loading) {
      setStuck(false)
      return
    }
    const timer = setTimeout(() => setStuck(true), 12000)
    return () => clearTimeout(timer)
  }, [loading])

  if (!mounted || loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(145deg,#060612 0%,#080f26 50%,#060612 100%)" }}
      >
        {/* Ambient blobs */}
        <div
          className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full pointer-events-none animate-orb-drift opacity-30"
          style={{ background: "radial-gradient(circle, rgba(37,99,235,0.4), transparent 70%)" }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full pointer-events-none animate-orb-drift opacity-20"
          style={{ background: "radial-gradient(circle, rgba(5,150,105,0.35), transparent 70%)", animationDelay: "-5s" }}
        />

        {mounted && (
          <div className="text-center space-y-6 animate-fade-in relative z-10">
            {/* Layered spinner */}
            <div className="relative mx-auto w-32 h-32">
              {/* Outer ring */}
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-400 border-r-blue-500/50 animate-spin" />
              {/* Middle ring */}
              <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-emerald-400 border-l-emerald-500/50 animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.4s" }} />
              {/* Inner brand icon */}
              <div className="absolute inset-3.5 rounded-full flex items-center justify-center shadow-2xl glow-blue overflow-hidden bg-white/5 border border-white/10">
                <img src="/logo.png" alt="Techno Bills Logo" className="w-full h-full object-contain" />
              </div>
            </div>

            <div>
              <p className="text-white font-bold text-lg tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
                Techno Bills
              </p>
              <p className="text-slate-500 text-sm mt-1.5 font-medium">
                {stuck ? "Taking longer than usual…" : "Initializing POS System…"}
              </p>
              {/* Progress dots */}
              <div className="flex justify-center gap-1.5 mt-4">
                {[0, 1, 2].map(i => (
                  <span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce-subtle"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
              {stuck && (
                <div className="mt-5 space-y-2">
                  <p className="text-slate-500 text-xs">
                    This is usually a network or connection issue.
                  </p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white gradient-primary hover:opacity-90 transition-opacity"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (!user) {
    return <LoginForm />
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden relative">
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0 relative">
        <FloatingThemeToggle />
        <div className="p-6 min-h-full">{children}</div>
      </main>
    </div>
  )
}

function FloatingThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return null

  const isDark = theme === "dark"

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="fixed top-4 right-4 z-50 w-9 h-9 rounded-xl flex items-center justify-center border bg-card/75 hover:bg-card border-border backdrop-blur-md shadow-md text-foreground transition-all duration-200"
      title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      type="button"
    >
      {isDark ? (
        <Sun className="h-[16px] w-[16px] text-amber-400" />
      ) : (
        <Moon className="h-[16px] w-[16px] text-slate-700 dark:text-slate-200" />
      )}
    </button>
  )
}
