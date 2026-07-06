// ─── RBAC & Product History Types ─────────────────────────────────────────

export type UserRole = 'admin' | 'manager' | 'cashier'

export type ModuleName =
  | 'dashboard'
  | 'pos'
  | 'products'
  | 'inventory'
  | 'customers'
  | 'sales'
  | 'reports'
  | 'settings'
  | 'users'
  | 'product_history'

export type PermissionAction = 'view' | 'create' | 'update' | 'delete'

export interface RolePermission {
  id: string
  role_name: UserRole
  module_name: ModuleName
  can_view: boolean
  can_create: boolean
  can_update: boolean
  can_delete: boolean
  updated_by: string | null
  updated_at: string
}

// Map of module_name → permission object for a single role
export type PermissionMap = Record<string, RolePermission>

// Full matrix: role → module → permissions
export type PermissionMatrix = Record<UserRole, PermissionMap>

// ─── Extended Profile ────────────────────────────────────────────────────────

export interface UserProfile {
  id: string
  email: string
  full_name: string
  role: UserRole
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
  created_by: string | null
  updated_by: string | null
  last_login_at: string | null
  deleted_at: string | null
}

export interface UserWithStatus extends UserProfile {
  is_active: boolean
}

// ─── Product History ─────────────────────────────────────────────────────────

export type ProductActionType =
  | 'CREATED'
  | 'UPDATED'
  | 'DELETED'
  | 'STOCK_UPDATED'
  | 'PRICE_UPDATED'
  | 'GST_UPDATED'
  | 'IMAGE_UPDATED'
  | 'BARCODE_UPDATED'

export interface ProductHistoryEntry {
  id: string
  product_id: string | null
  product_name: string
  action_type: ProductActionType
  changed_by: string | null
  changed_by_name: string | null
  previous_values: Record<string, any> | null
  new_values: Record<string, any> | null
  remarks: string | null
  created_at: string
  total_count?: number
}

// ─── Permission Audit Log ────────────────────────────────────────────────────

export interface PermissionAuditLog {
  id: string
  admin_user_id: string
  action_type: string
  affected_user_id: string | null
  affected_role: string | null
  module_name: string | null
  previous_value: Record<string, any> | null
  new_value: Record<string, any> | null
  changed_at: string
}

// ─── User Status ─────────────────────────────────────────────────────────────

export interface UserStatus {
  user_id: string
  is_active: boolean
  created_by: string | null
  updated_by: string | null
  updated_at: string
}

// ─── Create/Update User Request ──────────────────────────────────────────────

export interface CreateUserRequest {
  email: string
  full_name: string
  role: 'manager' | 'cashier'
  password: string
}

export interface UpdateUserRequest {
  id: string
  full_name?: string
  role?: UserRole
  is_active?: boolean
  password?: string
}
