"use client"

import type React from "react"
import { useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { LoginForm } from "@/components/login-form"
import { Sidebar } from "@/components/layout/sidebar"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/contexts/auth-context"
import { ShoppingBag } from "lucide-react"

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
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <AppContentInner>{children}</AppContentInner>
      </AuthProvider>
    </ThemeProvider>
  )
}

function AppContentInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(145deg,#060612 0%,#0f0a24 50%,#060612 100%)" }}
      >
        {/* Ambient blobs */}
        <div
          className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full pointer-events-none animate-orb-drift opacity-30"
          style={{ background: "radial-gradient(circle, rgba(124,58,237,0.4), transparent 70%)" }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full pointer-events-none animate-orb-drift opacity-20"
          style={{ background: "radial-gradient(circle, rgba(5,150,105,0.35), transparent 70%)", animationDelay: "-5s" }}
        />

        <div className="text-center space-y-6 animate-fade-in relative z-10">
          {/* Layered spinner */}
          <div className="relative mx-auto w-20 h-20">
            {/* Outer ring */}
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-violet-400 border-r-violet-500/50 animate-spin" />
            {/* Middle ring */}
            <div className="absolute inset-2 rounded-full border-2 border-transparent border-b-emerald-400 border-l-emerald-500/50 animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.4s" }} />
            {/* Inner brand icon */}
            <div className="absolute inset-4 rounded-full gradient-primary flex items-center justify-center shadow-xl glow-violet">
              <ShoppingBag className="h-5 w-5 text-white" />
            </div>
          </div>

          <div>
            <p className="text-white font-bold text-lg tracking-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              National Mini Mart
            </p>
            <p className="text-slate-500 text-sm mt-1.5 font-medium">Initializing POS System…</p>
            {/* Progress dots */}
            <div className="flex justify-center gap-1.5 mt-4">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce-subtle"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginForm />
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto min-w-0">
        <div className="p-6 min-h-full">{children}</div>
      </main>
    </div>
  )
}
