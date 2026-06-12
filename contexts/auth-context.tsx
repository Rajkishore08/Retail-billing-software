"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState, useCallback } from "react"
import type { User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase-client"
import type { UserRole, ModuleName, RolePermission, PermissionMap } from "@/lib/types/rbac"

export type Profile = {
  id: string
  email: string
  full_name: string
  role: UserRole
  status: "active" | "inactive"
  last_login_at: string | null
  created_by: string | null
}

type AuthContextType = {
  user: User | null
  profile: Profile | null
  permissions: PermissionMap
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error?: any }>
  signOut: () => Promise<void>
  hasPermission: (module: ModuleName | string, action: "view" | "create" | "update" | "delete") => boolean
  refreshPermissions: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [permissions, setPermissions] = useState<PermissionMap>({})
  const [loading, setLoading] = useState(true)

  // Fetch permissions for a given role
  const fetchPermissions = useCallback(async (role: UserRole) => {
    try {
      const { data, error } = await supabase
        .from("roles_permissions")
        .select("*")
        .eq("role_name", role)

      if (!error && data) {
        const map: PermissionMap = {}
        data.forEach((p: RolePermission) => {
          map[p.module_name] = p
        })
        setPermissions(map)
      }
    } catch (err) {
      console.error("Failed to fetch permissions:", err)
    }
  }, [])

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id,email,full_name,role,status,last_login_at,created_by")
        .eq("id", userId)
        .single()

      if (error && error.code === "PGRST116") {
        // Profile doesn't exist — create one
        const { data: userData } = await supabase.auth.getUser()
        if (userData.user) {
          const newProfile = {
            id: userId,
            email: userData.user.email || "",
            full_name: userData.user.email?.split("@")[0] || "User",
            role: "cashier" as UserRole,
            status: "active" as const,
          }
          const { data: created, error: createError } = await supabase
            .from("profiles")
            .insert(newProfile)
            .select("id,email,full_name,role,status,last_login_at,created_by")
            .single()
          if (!createError && created) {
            setProfile(created)
            await fetchPermissions(created.role)
            // Also ensure user_status row exists
            await supabase
              .from("user_status")
              .upsert({ user_id: userId, is_active: true }, { onConflict: "user_id" })
          }
        }
      } else if (!error && data) {
        setProfile(data)
        await fetchPermissions(data.role)
        // Update last_login_at
        supabase.rpc("update_last_login", { user_id: userId }).then(() => {})
      }
    } catch (err) {
      console.error("Profile fetch error:", err)
    } finally {
      setLoading(false)
    }
  }, [fetchPermissions])

  useEffect(() => {
    let active = true

    async function initAuth() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) throw error
        if (active) {
          setUser(session?.user ?? null)
          if (session?.user) {
            await fetchProfile(session.user.id)
          } else {
            setLoading(false)
          }
        }
      } catch (err) {
        console.error("Error initializing auth session:", err)
        if (active) {
          try { localStorage.clear() } catch {}
          setUser(null)
          setProfile(null)
          setPermissions({})
          setLoading(false)
        }
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return
      try {
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
          setPermissions({})
          setLoading(false)
        }
      } catch (err) {
        console.error("Auth state change error:", err)
        setLoading(false)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signOut = async () => {
    setPermissions({})
    await supabase.auth.signOut()
  }

  const refreshPermissions = useCallback(async () => {
    if (profile?.role) {
      await fetchPermissions(profile.role)
    }
  }, [profile?.role, fetchPermissions])

  // Permission helper — admin always has full access
  const hasPermission = useCallback(
    (module: string, action: "view" | "create" | "update" | "delete"): boolean => {
      if (!profile) return false
      if (profile.role === "admin") return true
      const perm = permissions[module]
      if (!perm) return false
      switch (action) {
        case "view":   return perm.can_view
        case "create": return perm.can_create
        case "update": return perm.can_update
        case "delete": return perm.can_delete
        default:       return false
      }
    },
    [profile, permissions]
  )

  return (
    <AuthContext.Provider
      value={{ user, profile, permissions, loading, signIn, signOut, hasPermission, refreshPermissions }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used within AuthProvider")
  return context
}
