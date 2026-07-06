"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { fetchAllPermissions, updateRolePermission } from "@/lib/services/rbac-service"
import { useAuth } from "@/contexts/auth-context"
import type { RolePermission } from "@/lib/types/rbac"
import { Shield, Lock, Check, X, Save, RefreshCw, Info, LayoutDashboard, ShoppingCart, Package, Factory, Users, TrendingUp, FileText, Settings, KeyRound, Clock } from "lucide-react"
import { toast } from "sonner"

const MODULES = [
  { key: "dashboard",       label: "Dashboard",       icon: LayoutDashboard },
  { key: "pos",             label: "POS Billing",      icon: ShoppingCart },
  { key: "products",        label: "Products",         icon: Package },
  { key: "inventory",       label: "Inventory",        icon: Factory },
  { key: "customers",       label: "Customers",        icon: Users },
  { key: "sales",           label: "Sales Overview",   icon: TrendingUp },
  { key: "reports",         label: "Reports",          icon: FileText },
  { key: "settings",        label: "Settings",         icon: Settings },
  { key: "users",           label: "User Management",  icon: KeyRound },
  { key: "product_history", label: "Product History",  icon: Clock },
]

const ACTIONS: Array<{ key: keyof Pick<RolePermission, "can_view" | "can_create" | "can_update" | "can_delete">; label: string }> = [
  { key: "can_view",   label: "View" },
  { key: "can_create", label: "Create" },
  { key: "can_update", label: "Update" },
  { key: "can_delete", label: "Delete" },
]

type LocalPerms = Record<string, Record<string, Record<string, boolean>>>
// localPerms[role][module][action] = boolean

function ToggleCell({
  checked, onChange, locked,
}: { checked: boolean; onChange: (v: boolean) => void; locked: boolean }) {
  return (
    <button
      type="button"
      onClick={() => !locked && onChange(!checked)}
      disabled={locked}
      className={[
        "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
        locked
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer hover:scale-110",
        checked
          ? locked
            ? "bg-blue-500/30 text-blue-300"
            : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
          : "bg-white/5 text-slate-600 border border-white/10 hover:border-slate-500/40 hover:text-slate-400",
      ].join(" ")}
      title={locked ? "Admin permissions cannot be modified" : (checked ? "Click to remove" : "Click to grant")}
    >
      {checked ? <Check className="h-3.5 w-3.5" /> : <X className="h-3 w-3" />}
    </button>
  )
}

export default function PermissionsPage() {
  const { refreshPermissions } = useAuth()
  const [allPerms, setAllPerms] = useState<RolePermission[]>([])
  const [localPerms, setLocalPerms] = useState<LocalPerms>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const loadPermissions = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAllPermissions()
      setAllPerms(data)
      // Build local state
      const local: LocalPerms = {}
      data.forEach((p) => {
        if (!local[p.role_name]) local[p.role_name] = {}
        local[p.role_name][p.module_name] = {
          can_view:   p.can_view,
          can_create: p.can_create,
          can_update: p.can_update,
          can_delete: p.can_delete,
        }
      })
      setLocalPerms(local)
      setDirty(false)
    } catch (err: any) {
      toast.error("Failed to load permissions")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPermissions() }, [loadPermissions])

  const handleToggle = (role: string, module: string, action: string, value: boolean) => {
    if (role === "admin") return // immutable
    setLocalPerms((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [module]: {
          ...prev[role]?.[module],
          [action]: value,
        },
      },
    }))
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const promises: Promise<void>[] = []
      for (const role of ["manager", "cashier"] as const) {
        for (const mod of MODULES) {
          const perms = localPerms[role]?.[mod.key]
          if (!perms) continue
          promises.push(
            updateRolePermission(role, mod.key as any, {
              can_view:   perms.can_view ?? false,
              can_create: perms.can_create ?? false,
              can_update: perms.can_update ?? false,
              can_delete: perms.can_delete ?? false,
            })
          )
        }
      }
      await Promise.all(promises)
      await refreshPermissions()
      setDirty(false)
      toast.success("Permissions saved! Changes take effect on next login.")
    } catch (err: any) {
      toast.error(err.message || "Failed to save permissions")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="h-32 skeleton rounded-2xl" />
        {[1,2,3,4,5].map(i => <div key={i} className="h-16 skeleton rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in-up">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="page-header-banner">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Permissions Matrix</h1>
            </div>
            <p className="text-blue-300/70 text-sm">
              Configure page-level access for Manager and Cashier roles.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={loadPermissions}
              className="h-10 px-4 rounded-xl border-white/20 text-white hover:bg-white/10"
            >
              <RefreshCw className="h-4 w-4 mr-2" />Reset
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !dirty}
              className={`h-10 px-5 rounded-xl font-semibold text-white border-0 shadow-lg transition-all ${
                dirty ? "gradient-primary glow-blue" : "bg-slate-600/50 cursor-not-allowed"
              }`}
            >
              {saving ? (
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      {/* ── Legend ─────────────────────────────────────────── */}
      <div
        className="flex flex-wrap items-center gap-4 p-4 rounded-xl text-xs"
        style={{ background: "rgba(2,132,199,0.06)", border: "1px solid rgba(2,132,199,0.2)" }}
      >
        <Info className="h-4 w-4 text-sky-400 shrink-0" />
        <span className="text-sky-400/90">
          <strong>Admin</strong> always has full access — these cannot be changed.
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="w-5 h-5 rounded bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Check className="h-3 w-3 text-emerald-400" />
          </span>Permission granted
        </span>
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <span className="w-5 h-5 rounded bg-white/5 border border-white/10 flex items-center justify-center">
            <X className="h-2.5 w-2.5 text-slate-600" />
          </span>Access denied
        </span>
      </div>

      {/* ── Permissions Matrix Table ────────────────────────── */}
      <div className="rounded-2xl border border-border overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                <th className="text-left px-5 py-4 font-bold text-muted-foreground w-48">
                  Module / Page
                </th>
                {/* Admin column */}
                <th className="px-4 py-4 text-center min-w-[160px]">
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1.5">
                      <Lock className="h-3 w-3 text-blue-400" />
                      <span className="font-bold text-blue-300">Admin</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">Full Access (Locked)</span>
                  </div>
                </th>
                {/* Manager column */}
                <th className="px-4 py-4 text-center min-w-[200px]">
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-bold text-sky-300">Manager</span>
                    <div className="flex gap-1.5 text-[10px] text-muted-foreground">
                      {ACTIONS.map(a => <span key={a.key} className="w-8 text-center">{a.label}</span>)}
                    </div>
                  </div>
                </th>
                {/* Cashier column */}
                <th className="px-4 py-4 text-center min-w-[200px]">
                  <div className="flex flex-col items-center gap-1">
                    <span className="font-bold text-amber-300">Cashier</span>
                    <div className="flex gap-1.5 text-[10px] text-muted-foreground">
                      {ACTIONS.map(a => <span key={a.key} className="w-8 text-center">{a.label}</span>)}
                    </div>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {MODULES.map((mod, i) => (
                <tr
                  key={mod.key}
                  style={{
                    borderBottom: i < MODULES.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                    background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                  }}
                >
                  {/* Module name */}
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <mod.icon className="h-4 w-4 text-blue-400 shrink-0" />
                      <span className="font-semibold text-sm">{mod.label}</span>
                    </div>
                  </td>

                  {/* Admin cell — always full, locked */}
                  <td className="px-4 py-3.5">
                    <div className="flex justify-center gap-1.5">
                      {ACTIONS.map((action) => (
                        <ToggleCell key={action.key} checked={true} onChange={() => {}} locked={true} />
                      ))}
                    </div>
                  </td>

                  {/* Manager cell */}
                  <td className="px-4 py-3.5">
                    <div className="flex justify-center gap-1.5">
                      {ACTIONS.map((action) => (
                        <ToggleCell
                          key={action.key}
                          checked={localPerms["manager"]?.[mod.key]?.[action.key] ?? false}
                          onChange={(v) => handleToggle("manager", mod.key, action.key, v)}
                          locked={false}
                        />
                      ))}
                    </div>
                  </td>

                  {/* Cashier cell */}
                  <td className="px-4 py-3.5">
                    <div className="flex justify-center gap-1.5">
                      {ACTIONS.map((action) => (
                        <ToggleCell
                          key={action.key}
                          checked={localPerms["cashier"]?.[mod.key]?.[action.key] ?? false}
                          onChange={(v) => handleToggle("cashier", mod.key, action.key, v)}
                          locked={false}
                        />
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dirty indicator */}
      {dirty && (
        <div
          className="flex items-center gap-2 p-3 rounded-xl text-sm animate-fade-in"
          style={{ background: "rgba(217,119,6,0.1)", border: "1px solid rgba(217,119,6,0.25)" }}
        >
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-amber-300/90 font-medium">You have unsaved changes. Click "Save Changes" to apply.</span>
        </div>
      )}
    </div>
  )
}
