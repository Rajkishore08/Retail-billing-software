"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createUser, updateUser } from "@/lib/services/rbac-service"
import type { UserWithStatus, CreateUserRequest } from "@/lib/types/rbac"
import { UserPlus, Eye, EyeOff, CheckCircle2, KeyRound } from "lucide-react"
import { toast } from "sonner"

interface UserFormProps {
  editing?: UserWithStatus | null
  onSuccess: () => void
  onCancel: () => void
  mode: "create" | "edit" | "reset-password"
}

export function UserForm({ editing, onSuccess, onCancel, mode }: UserFormProps) {
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [form, setForm] = useState<CreateUserRequest & { confirmPassword: string }>({
    email: editing?.email || "",
    full_name: editing?.full_name || "",
    role: (editing?.role as "manager" | "cashier") || "cashier",
    password: "",
    confirmPassword: "",
  })

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (mode === "create" || mode === "reset-password") {
      if (form.password.length < 6) {
        toast.error("Password must be at least 6 characters")
        return
      }
      if (form.password !== form.confirmPassword) {
        toast.error("Passwords do not match")
        return
      }
    }

    setLoading(true)
    try {
      if (mode === "create") {
        await createUser({
          email: form.email,
          full_name: form.full_name,
          role: form.role,
          password: form.password,
        })
        toast.success(`User ${form.full_name} created successfully!`)
      } else if (mode === "edit" && editing) {
        await updateUser({
          id: editing.id,
          full_name: form.full_name,
          role: form.role,
        })
        toast.success("User updated successfully!")
      } else if (mode === "reset-password" && editing) {
        await updateUser({ id: editing.id, password: form.password })
        toast.success("Password reset successfully!")
      }
      onSuccess()
    } catch (err: any) {
      toast.error(err.message || "Operation failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {mode !== "reset-password" && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Full Name *
            </Label>
            <Input
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              placeholder="John Doe"
              className="h-10 rounded-xl"
              required
            />
          </div>

          {mode === "create" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Email Address *
              </Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="user@example.com"
                className="h-10 rounded-xl"
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Role *
            </Label>
            <Select value={form.role} onValueChange={(v) => set("role", v)}>
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="cashier">Cashier</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">Admin role can only be assigned manually in the database.</p>
          </div>
        </>
      )}

      {(mode === "create" || mode === "reset-password") && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {mode === "create" ? "Temporary Password *" : "New Password *"}
            </Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="Min 6 characters"
                className="h-10 rounded-xl pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Confirm Password *
            </Label>
            <Input
              type={showPassword ? "text" : "password"}
              value={form.confirmPassword}
              onChange={(e) => set("confirmPassword", e.target.value)}
              placeholder="Re-enter password"
              className="h-10 rounded-xl"
              required
            />
            {form.confirmPassword && form.password !== form.confirmPassword && (
              <p className="text-xs text-rose-400">Passwords do not match</p>
            )}
          </div>
        </>
      )}

      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          disabled={loading}
          className="flex-1 h-10 rounded-xl gradient-primary border-0 font-semibold shadow-lg text-white"
        >
          {loading ? (
            <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : mode === "create" ? (
            <><UserPlus className="h-3.5 w-3.5 mr-2" />Create User</>
          ) : mode === "reset-password" ? (
            <><KeyRound className="h-3.5 w-3.5 mr-2" />Reset Password</>
          ) : (
            <><CheckCircle2 className="h-3.5 w-3.5 mr-2" />Save Changes</>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 h-10 rounded-xl">
          Cancel
        </Button>
      </div>
    </form>
  )
}
