"use client"

import { useAuth } from "@/contexts/auth-context"
import type { ModuleName } from "@/lib/types/rbac"

interface PermissionGuardProps {
  module: ModuleName | string
  action?: "view" | "create" | "update" | "delete"
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * Renders children only if the user has the required permission.
 * Falls back to `fallback` content (default: null) if no access.
 */
export function PermissionGuard({
  module,
  action = "view",
  children,
  fallback = null,
}: PermissionGuardProps) {
  const { hasPermission, loading } = useAuth()

  if (loading) return null
  if (typeof hasPermission !== "function" || !hasPermission(module, action)) return <>{fallback}</>
  return <>{children}</>
}
