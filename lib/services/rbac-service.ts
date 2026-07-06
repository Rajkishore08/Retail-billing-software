import { supabase } from "@/lib/supabase-client"
import type {
  UserWithStatus, RolePermission, ModuleName, UserRole,
  CreateUserRequest, UpdateUserRequest,
} from "@/lib/types/rbac"

// ─── Helper: get current session token ───────────────────────────────────────
async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error("Not authenticated")
  return session.access_token
}

// ─── User Management ─────────────────────────────────────────────────────────

export async function fetchAllUsers(): Promise<UserWithStatus[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select(`
      id, email, full_name, role, status, created_at, updated_at,
      created_by, updated_by, last_login_at, deleted_at,
      user_status!user_id ( is_active )
    `)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data || []).map((p: any) => ({
    ...p,
    is_active: p.user_status?.is_active ?? p.status === "active",
  }))
}

export async function createUser(payload: CreateUserRequest): Promise<void> {
  const token = await getAuthToken()
  const res = await fetch("/api/admin/create-user", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || "Failed to create user")
}

export async function updateUser(payload: UpdateUserRequest): Promise<void> {
  const token = await getAuthToken()
  const res = await fetch("/api/admin/update-user", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || "Failed to update user")
}

export async function deleteUser(id: string): Promise<void> {
  const token = await getAuthToken()
  const res = await fetch("/api/admin/delete-user", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || "Failed to delete user")
}

// ─── Permissions Management ───────────────────────────────────────────────────

export async function fetchAllPermissions(): Promise<RolePermission[]> {
  const { data, error } = await supabase
    .from("roles_permissions")
    .select("*")
    .order("role_name")
  if (error) throw error
  return data || []
}

export async function updateRolePermission(
  roleName: UserRole,
  moduleName: ModuleName | string,
  permissions: { can_view: boolean; can_create: boolean; can_update: boolean; can_delete: boolean }
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) throw new Error("Not authenticated")

  // Get old permissions for audit
  const { data: oldPerm } = await supabase
    .from("roles_permissions")
    .select("*")
    .eq("role_name", roleName)
    .eq("module_name", moduleName)
    .single()

  const { error } = await supabase
    .from("roles_permissions")
    .upsert({
      role_name: roleName,
      module_name: moduleName,
      ...permissions,
      updated_by: session.user.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: "role_name,module_name" })

  if (error) throw error

  // Write audit log
  await supabase.from("permission_audit_logs").insert({
    admin_user_id: session.user.id,
    action_type: "PERMISSION_CHANGED",
    affected_role: roleName,
    module_name: moduleName,
    previous_value: oldPerm ? {
      can_view: oldPerm.can_view,
      can_create: oldPerm.can_create,
      can_update: oldPerm.can_update,
      can_delete: oldPerm.can_delete,
    } : null,
    new_value: permissions,
  })
}
