"use client"

import { useAuth } from "@/contexts/auth-context"
import type { ModuleName } from "@/lib/types/rbac"

/**
 * Hook to retrieve permission flags for a specific module.
 * Admins always get full access.
 */
export function usePermission(module: ModuleName | string) {
  const { hasPermission } = useAuth()
  const hasPerm = typeof hasPermission === "function" ? hasPermission : () => false
  return {
    canView:   hasPerm(module, "view"),
    canCreate: hasPerm(module, "create"),
    canUpdate: hasPerm(module, "update"),
    canDelete: hasPerm(module, "delete"),
  }
}
