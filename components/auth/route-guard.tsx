"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import type { ModuleName } from "@/lib/types/rbac"
import { supabase } from "@/lib/supabase-client"

interface RouteGuardProps {
  module: ModuleName | string
  action?: "view" | "create" | "update" | "delete"
  children: React.ReactNode
}

/**
 * Wraps a page and redirects to /access-denied if the user lacks the required permission.
 * Also logs unauthorized attempts to permission_audit_logs.
 */
export function RouteGuard({ module, action = "view", children }: RouteGuardProps) {
  const { user, profile, hasPermission, loading } = useAuth()
  const router = useRouter()
  const loggedRef = useRef(false)

  useEffect(() => {
    if (loading) return
    if (!user || !profile) {
      router.replace("/")
      return
    }
    if (typeof hasPermission !== "function" || !hasPermission(module, action)) {
      // Log unauthorized attempt (once per render cycle)
      if (!loggedRef.current && profile) {
        loggedRef.current = true
        supabase.from("permission_audit_logs").insert({
          admin_user_id: profile.id,
          action_type: "UNAUTHORIZED_ACCESS_ATTEMPT",
          affected_role: profile.role,
          module_name: module,
          new_value: { attempted_action: action, path: window.location.pathname },
        }).then(() => {})
      }
      router.replace(`/access-denied?module=${module}`)
    }
  }, [loading, user, profile, hasPermission, module, action, router])

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="h-36 skeleton rounded-2xl" />
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-28 skeleton rounded-2xl" />)}
        </div>
      </div>
    )
  }

  if (!user || !profile || typeof hasPermission !== "function" || !hasPermission(module, action)) return null

  return <>{children}</>
}
