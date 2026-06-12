"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { UserForm } from "./user-form"
import { updateUser, deleteUser } from "@/lib/services/rbac-service"
import type { UserWithStatus } from "@/lib/types/rbac"
import { Edit2, Trash2, KeyRound, ToggleLeft, ToggleRight, Shield, User, Clock } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/contexts/auth-context"

const roleColors: Record<string, string> = {
  admin: "bg-violet-500/20 text-violet-300 border border-violet-500/30",
  manager: "bg-sky-500/20 text-sky-300 border border-sky-500/30",
  cashier: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
}

interface UserTableProps {
  users: UserWithStatus[]
  onRefresh: () => void
}

export function UserTable({ users, onRefresh }: UserTableProps) {
  const { profile } = useAuth()
  const [editingUser, setEditingUser] = useState<UserWithStatus | null>(null)
  const [resetUser, setResetUser] = useState<UserWithStatus | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const handleToggleStatus = async (user: UserWithStatus) => {
    setTogglingId(user.id)
    try {
      await updateUser({ id: user.id, is_active: !user.is_active })
      toast.success(`${user.full_name} ${!user.is_active ? "activated" : "deactivated"}`)
      onRefresh()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (user: UserWithStatus) => {
    if (!confirm(`Delete ${user.full_name}? This will deactivate their account (soft delete).`)) return
    try {
      await deleteUser(user.id)
      toast.success(`${user.full_name} removed`)
      onRefresh()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-20 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 glow-violet">
          <User className="h-8 w-8 text-white" />
        </div>
        <h3 className="font-bold text-lg mb-1">No users found</h3>
        <p className="text-sm text-muted-foreground">Create a new user to get started.</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {users.map((user, i) => (
          <div
            key={user.id}
            className={`flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:border-violet-500/30 transition-all animate-fade-in-up`}
            style={{ animationDelay: `${i * 0.04}s`, animationFillMode: "forwards" }}
          >
            {/* Avatar */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm text-white gradient-primary`}>
              {user.full_name?.charAt(0)?.toUpperCase() || "U"}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm truncate">{user.full_name}</p>
                {user.id === profile?.id && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    You
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${roleColors[user.role] || ""}`}>
                  <Shield className="h-2.5 w-2.5 inline mr-1" />{user.role}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  user.is_active
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-slate-500/20 text-slate-400 border border-slate-500/30"
                }`}>
                  {user.is_active ? "● Active" : "○ Inactive"}
                </span>
              </div>
            </div>

            {/* Last login */}
            <div className="hidden md:flex flex-col items-end shrink-0">
              {user.last_login_at ? (
                <>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />Last login
                  </p>
                  <p className="text-xs font-medium">
                    {new Date(user.last_login_at).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric"
                    })}
                  </p>
                </>
              ) : (
                <p className="text-[10px] text-muted-foreground">Never logged in</p>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">
                Created {new Date(user.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </p>
            </div>

            {/* Actions */}
            {user.id !== profile?.id && (
              <div className="flex gap-1.5 shrink-0">
                {/* Toggle active */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleStatus(user)}
                  disabled={togglingId === user.id}
                  className={`h-8 w-8 p-0 rounded-lg transition-colors ${
                    user.is_active
                      ? "hover:border-rose-500/50 hover:text-rose-400 hover:bg-rose-500/5"
                      : "hover:border-emerald-500/50 hover:text-emerald-400 hover:bg-emerald-500/5"
                  }`}
                  title={user.is_active ? "Deactivate" : "Activate"}
                >
                  {user.is_active
                    ? <ToggleRight className="h-3.5 w-3.5 text-emerald-400" />
                    : <ToggleLeft className="h-3.5 w-3.5 text-slate-400" />
                  }
                </Button>
                {/* Edit */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingUser(user)}
                  className="h-8 w-8 p-0 rounded-lg hover:border-violet-500/50 hover:text-violet-400"
                  title="Edit user"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                {/* Reset password */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setResetUser(user)}
                  className="h-8 w-8 p-0 rounded-lg hover:border-sky-500/50 hover:text-sky-400"
                  title="Reset password"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                </Button>
                {/* Delete */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(user)}
                  className="h-8 w-8 p-0 rounded-lg hover:border-rose-500/50 hover:text-rose-400 hover:bg-rose-500/5"
                  title="Delete user"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingUser} onOpenChange={(v) => !v && setEditingUser(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                <Edit2 className="h-4 w-4 text-white" />
              </div>
              Edit User — {editingUser?.full_name}
            </DialogTitle>
          </DialogHeader>
          {editingUser && (
            <UserForm
              mode="edit"
              editing={editingUser}
              onSuccess={() => { setEditingUser(null); onRefresh() }}
              onCancel={() => setEditingUser(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!resetUser} onOpenChange={(v) => !v && setResetUser(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center">
                <KeyRound className="h-4 w-4 text-sky-400" />
              </div>
              Reset Password — {resetUser?.full_name}
            </DialogTitle>
          </DialogHeader>
          {resetUser && (
            <UserForm
              mode="reset-password"
              editing={resetUser}
              onSuccess={() => { setResetUser(null); onRefresh() }}
              onCancel={() => setResetUser(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
