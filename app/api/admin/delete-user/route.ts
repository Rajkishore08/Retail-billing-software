import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured")
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function DELETE(req: NextRequest) {
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

    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: "User ID required" }, { status: 400 })
    if (id === caller.id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 })
    }

    // Get profile before soft delete for audit
    const { data: targetProfile } = await supabaseAdmin
      .from("profiles").select("*").eq("id", id).single()

    // Soft delete: set deleted_at and deactivate
    const now = new Date().toISOString()
    await supabaseAdmin.from("profiles").update({
      deleted_at: now,
      status: "inactive",
      updated_by: caller.id,
    }).eq("id", id)

    await supabaseAdmin.from("user_status").upsert({
      user_id: id,
      is_active: false,
      updated_by: caller.id,
      updated_at: now,
    }, { onConflict: "user_id" })

    // Audit log
    await supabaseAdmin.from("permission_audit_logs").insert({
      admin_user_id: caller.id,
      action_type: "USER_DELETED",
      affected_user_id: id,
      affected_role: targetProfile?.role,
      previous_value: targetProfile,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Delete user error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
