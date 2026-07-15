"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  LayoutDashboard, Package, ShoppingCart, Users, Warehouse,
  TrendingUp, Settings, LogOut, Moon, Sun, ShoppingBag,
  BarChart3, Sparkles, Zap, UserCog, Shield,
} from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { getStoreLogo } from "@/lib/store-image-store"

const ALL_NAV = [
  { name: "Dashboard",      href: "/dashboard",            icon: LayoutDashboard, module: "dashboard",       gradient: "from-blue-600 to-blue-900",  glow: "rgba(29,78,216,0.35)"  },
  { name: "Products",       href: "/products",             icon: Package,          module: "products",        gradient: "from-sky-500 to-blue-700",        glow: "rgba(2,132,199,0.35)"   },
  { name: "POS Billing",    href: "/pos",                  icon: ShoppingCart,     module: "pos",             gradient: "from-emerald-500 to-green-700",   glow: "rgba(5,150,105,0.35)"   },
  { name: "Customers",      href: "/customers",            icon: Users,            module: "customers",       gradient: "from-amber-500 to-orange-600",    glow: "rgba(217,119,6,0.35)"   },
  { name: "Inventory",      href: "/inventory",            icon: Warehouse,        module: "inventory",       gradient: "from-rose-500 to-red-700",        glow: "rgba(225,29,72,0.35)"   },
  { name: "Sales Overview", href: "/sales",                icon: TrendingUp,       module: "sales",           gradient: "from-cyan-500 to-teal-700",       glow: "rgba(8,145,178,0.35)"   },
  { name: "Reports",        href: "/reports",              icon: BarChart3,        module: "reports",         gradient: "from-indigo-500 to-blue-700",     glow: "rgba(79,70,229,0.35)"   },
  { name: "Settings",       href: "/settings",             icon: Settings,         module: "settings",        gradient: "from-slate-500 to-slate-700",     glow: "rgba(100,116,139,0.35)" },
  { name: "Nav Users",      href: "/settings/users",       icon: UserCog,          module: "users",           gradient: "from-blue-600 to-blue-900",   glow: "rgba(29,78,216,0.35)"  },
  { name: "Permissions",    href: "/settings/permissions", icon: Shield,           module: "users",           gradient: "from-blue-600 to-blue-900",   glow: "rgba(29,78,216,0.35)"  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { profile, signOut, hasPermission } = useAuth()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    setLogoUrl(getStoreLogo())

    const handleLogoUpdate = () => {
      setLogoUrl(getStoreLogo())
    }

    window.addEventListener("store-logo-changed", handleLogoUpdate)
    window.addEventListener("storage", handleLogoUpdate)
    return () => {
      window.removeEventListener("store-logo-changed", handleLogoUpdate)
      window.removeEventListener("storage", handleLogoUpdate)
    }
  }, [])

  const initials = profile?.full_name
    ? profile.full_name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : "U"

  // Filter nav items based on user permissions
  const navigation = ALL_NAV.filter((item) => typeof hasPermission === "function" ? hasPermission(item.module, "view") : false)

  // Group: split admin-only items visually
  const mainNav = navigation.filter(
    (item) => !["users", "permissions"].includes(item.href.replace("/settings/", ""))
  )
  const adminNav = navigation.filter(
    (item) => item.href === "/settings/users" || item.href === "/settings/permissions"
  )

  return (
    <div
      className="gradient-sidebar text-white w-72 min-h-screen flex flex-col shrink-0 relative"
      style={{ borderRight: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Ambient top glow */}
      <div
        className="absolute top-0 left-0 right-0 h-48 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(29,78,216,0.18), transparent)" }}
      />

      {/* ── Logo / Brand ─────────────────────────────────── */}
      <div className="relative z-10 px-5 pt-6 pb-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3.5">
          <div className="relative animate-float shrink-0">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-xl overflow-hidden border border-white/10" style={{ background: "rgba(255,255,255,0.05)" }}>
              <img src={logoUrl || "/logo.png"} alt="Store Logo" className="w-full h-full object-contain p-1" />
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#060612] animate-pulse" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-[15px] leading-tight text-gradient-primary tracking-tight">
              Techno Bills
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Zap className="h-3 w-3 text-amber-400 shrink-0" />
              <p className="text-[11px] text-slate-500 font-medium">POS System v2.0</p>
            </div>
          </div>
        </div>

        <div
          className="mt-4 flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: "rgba(5,150,105,0.08)", border: "1px solid rgba(5,150,105,0.18)" }}
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-[11px] text-emerald-400 font-semibold">System Online</span>
          <span className="ml-auto text-[10px] text-slate-500">All services up</span>
        </div>
      </div>

      {/* ── Navigation ───────────────────────────────────── */}
      <nav className="relative z-10 flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="section-label px-3 mb-3">Navigation</p>
        {mainNav.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))
          return <NavItem key={item.href} item={item} isActive={isActive} />
        })}

        {/* Admin section */}
        {adminNav.length > 0 && (
          <>
            <div className="px-3 pt-4 pb-2">
              <p className="section-label">Admin</p>
            </div>
            {adminNav.map((item) => {
              const isActive = pathname === item.href
              return <NavItem key={item.href} item={item} isActive={isActive} />
            })}
          </>
        )}
      </nav>

      {/* ── Theme Toggle ─────────────────────────────────── */}
      <div className="relative z-10 px-3 pb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="w-full justify-start text-slate-400 hover:text-white hover:bg-white/6 rounded-xl px-3 py-2.5 h-auto gap-3"
          suppressHydrationWarning
        >
          <span className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0" suppressHydrationWarning>
            {mounted ? (
              theme === "dark" ? <Sun className="h-[15px] w-[15px]" /> : <Moon className="h-[15px] w-[15px]" />
            ) : (
              <Moon className="h-[15px] w-[15px]" />
            )}
          </span>
          <span className="text-sm font-medium" suppressHydrationWarning>
            {mounted ? (theme === "dark" ? "Light Mode" : "Dark Mode") : "Dark Mode"}
          </span>
        </Button>
      </div>

      {/* ── User Profile ─────────────────────────────────── */}
      <div className="relative z-10 p-3 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <div
          className="flex items-center gap-3 px-3 py-3 rounded-xl mb-2"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <Avatar className="h-9 w-9 shrink-0 ring-2 ring-blue-500/40 ring-offset-1 ring-offset-transparent">
            <AvatarFallback
              className="text-white text-xs font-bold"
              style={{ background: "linear-gradient(135deg,#1d4ed8,#1e3a8a)" }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate text-white leading-tight">
              {profile?.full_name || "User"}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <Sparkles className="h-2.5 w-2.5 text-amber-400 shrink-0" />
              <p className="text-[11px] text-slate-400 capitalize font-medium">
                {profile?.role || "cashier"}
              </p>
            </div>
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="w-full justify-start text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl px-3 py-2.5 h-auto gap-3 group"
        >
          <span className="w-8 h-8 rounded-xl bg-white/5 group-hover:bg-rose-500/15 flex items-center justify-center shrink-0 transition-colors">
            <LogOut className="h-[14px] w-[14px]" />
          </span>
          <span className="text-sm font-medium">Sign Out</span>
        </Button>
      </div>
    </div>
  )
}

function NavItem({ item, isActive }: { item: typeof ALL_NAV[0]; isActive: boolean }) {
  return (
    <Link
      href={item.href}
      className={[
        "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 overflow-hidden",
        isActive
          ? "bg-white/10 text-white nav-active-glow"
          : "text-slate-400 hover:text-white hover:bg-white/6",
      ].join(" ")}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-blue-400 shadow-[0_0_8px_rgba(147,197,253,0.8)]" />
      )}
      <span className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))" }} />
      <span
        className={[
          "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all duration-200 relative z-10",
          isActive
            ? `bg-gradient-to-br ${item.gradient} shadow-lg`
            : "bg-white/5 group-hover:bg-white/10",
        ].join(" ")}
        style={isActive ? { boxShadow: `0 0 12px ${item.glow}` } : {}}
      >
        <item.icon className="h-[15px] w-[15px]" />
      </span>
      <span className="truncate relative z-10 font-[500]">{item.name}</span>
      {isActive && (
        <span
          className={`ml-auto w-2 h-2 rounded-full shrink-0 bg-gradient-to-br ${item.gradient} relative z-10`}
          style={{ boxShadow: `0 0 6px ${item.glow}` }}
        />
      )}
    </Link>
  )
}
