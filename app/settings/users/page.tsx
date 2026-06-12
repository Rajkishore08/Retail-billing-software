"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { UserTable } from "@/components/admin/user-table"
import { UserForm } from "@/components/admin/user-form"
import { fetchAllUsers } from "@/lib/services/rbac-service"
import type { UserWithStatus } from "@/lib/types/rbac"
import {
  Users, UserPlus, Search, X, Shield, ShieldAlert,
  RefreshCw, UserCog,
} from "lucide-react"
import { toast } from "sonner"

export default function UsersPage() {
  const [users, setUsers] = useState<UserWithStatus[]>([])
  const [filtered, setFiltered] = useState<UserWithStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "manager" | "cashier">("all")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const loadUsers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const data = await fetchAllUsers()
      setUsers(data)
    } catch (err: any) {
      toast.error(err.message || "Failed to load users")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  useEffect(() => {
    let list = users
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      list = list.filter(
        (u) =>
          u.full_name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q)
      )
    }
    if (roleFilter !== "all") list = list.filter((u) => u.role === roleFilter)
    setFiltered(list)
  }, [users, searchTerm, roleFilter])

  const stats = {
    total: users.length,
    active: users.filter((u) => u.is_active).length,
    admins: users.filter((u) => u.role === "admin").length,
    managers: users.filter((u) => u.role === "manager").length,
    cashiers: users.filter((u) => u.role === "cashier").length,
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-36 skeleton rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 skeleton rounded-2xl" />)}
        </div>
        <div className="h-12 skeleton rounded-xl" />
        {[1, 2, 3].map((i) => <div key={i} className="h-20 skeleton rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in-up">

      {/* ── Page Header ────────────────────────────────────── */}
      <div className="page-header-banner">
        <div
          className="absolute top-[-40px] right-[-30px] w-40 h-40 rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle,rgba(124,58,237,0.3),transparent 70%)" }}
        />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <UserCog className="h-4 w-4 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">User Management</h1>
            </div>
            <p className="text-violet-300/70 text-sm">
              Manage all system users, roles, and account access.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={() => loadUsers(true)}
              disabled={refreshing}
              className="h-10 px-4 rounded-xl border-white/20 text-white hover:bg-white/10"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="h-10 px-5 rounded-xl gradient-primary border-0 font-semibold text-white shadow-lg"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>
        </div>
      </div>

      {/* ── Stats Row ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Users",  value: stats.total,    color: "text-violet-400", bg: "rgba(124,58,237,0.1)", border: "rgba(124,58,237,0.2)" },
          { label: "Active",       value: stats.active,   color: "text-emerald-400", bg: "rgba(5,150,105,0.1)",  border: "rgba(5,150,105,0.2)" },
          { label: "Admins",       value: stats.admins,   color: "text-violet-400", bg: "rgba(124,58,237,0.06)", border: "rgba(124,58,237,0.15)" },
          { label: "Managers",     value: stats.managers, color: "text-sky-400",    bg: "rgba(2,132,199,0.08)", border: "rgba(2,132,199,0.2)" },
          { label: "Cashiers",     value: stats.cashiers, color: "text-amber-400",  bg: "rgba(217,119,6,0.08)", border: "rgba(217,119,6,0.2)" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl p-4 flex flex-col gap-1"
            style={{ background: s.bg, border: `1px solid ${s.border}` }}
          >
            <p className={`text-2xl font-bold font-numeric ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Search & Filters ───────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-10 rounded-xl border-border bg-card"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          {(["all", "admin", "manager", "cashier"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={[
                "px-3 h-10 rounded-xl text-sm font-semibold border transition-all capitalize",
                roleFilter === r
                  ? "gradient-primary border-0 text-white shadow-md"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-card",
              ].join(" ")}
            >
              {r === "all" ? "All Roles" : r}
            </button>
          ))}
        </div>
      </div>

      {/* ── Security Notice ────────────────────────────────── */}
      <div
        className="flex items-center gap-3 p-4 rounded-xl"
        style={{ background: "rgba(217,119,6,0.08)", border: "1px solid rgba(217,119,6,0.2)" }}
      >
        <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
        <p className="text-xs text-amber-400/90">
          <span className="font-bold">Admin permissions are immutable.</span>{" "}
          Changes here are logged and audited. Deactivating a user immediately revokes their access.
        </p>
      </div>

      {/* ── User List ──────────────────────────────────────── */}
      <UserTable users={filtered} onRefresh={() => loadUsers(true)} />

      {/* ── Create User Dialog ─────────────────────────────── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <UserPlus className="h-4 w-4 text-white" />
              </div>
              Create New User
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <p className="text-xs text-muted-foreground mb-4">
              The user will receive a temporary password which they can change after first login.
            </p>
            <UserForm
              mode="create"
              onSuccess={() => { setShowCreateDialog(false); loadUsers(true) }}
              onCancel={() => setShowCreateDialog(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
