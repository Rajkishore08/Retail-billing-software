import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured")
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function PATCH(req: NextRequest) {
  try {
    const supabaseAdmin = getAdminClient()

    const authHeader = req.headers.get("authorization")
    if (!authHeader) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const token = authHeader.replace("Bearer ", "")
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !caller) return NextResponse.json({ error: "Invalid session" }, { status: 401 })

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles").select("role").eq("id", caller.id).single()
    if (callerProfile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { id, full_name, role, is_active, password } = await req.json()
    if (!id) return NextResponse.json({ error: "User ID required" }, { status: 400 })

    // Get current profile for audit log
    const { data: currentProfile } = await supabaseAdmin
      .from("profiles").select("*").eq("id", id).single()

    const updates: Record<string, any> = { updated_by: caller.id }
    if (full_name !== undefined) updates.full_name = full_name
    if (role !== undefined) updates.role = role
    if (is_active !== undefined) updates.status = is_active ? "active" : "inactive"

    // Update profile
    if (Object.keys(updates).length > 1) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles").update(updates).eq("id", id)
      if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    // Update user_status
    if (is_active !== undefined) {
      await supabaseAdmin.from("user_status").upsert({
        user_id: id,
        is_active,
        updated_by: caller.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" })
    }

    // Update password via admin API
    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
      }
      const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(id, { password })
      if (pwError) return NextResponse.json({ error: pwError.message }, { status: 500 })
    }

    // Audit log
    const actionType = role !== undefined ? "ROLE_CHANGED"
      : is_active !== undefined ? "ACCOUNT_STATUS_CHANGED"
      : password ? "PASSWORD_RESET"
      : "USER_UPDATED"

    await supabaseAdmin.from("permission_audit_logs").insert({
      admin_user_id: caller.id,
      action_type: actionType,
      affected_user_id: id,
      affected_role: currentProfile?.role,
      previous_value: currentProfile,
      new_value: updates,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Update user error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
