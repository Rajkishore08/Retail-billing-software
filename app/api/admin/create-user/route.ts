import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured")
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = getAdminClient()

    // Verify caller is admin via their JWT
    const authHeader = req.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.replace("Bearer ", "")
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !caller) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 })
    }

    // Check caller is admin
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single()

    if (callerProfile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 })
    }

    const { email, full_name, role, password } = await req.json()

    // Validate inputs
    if (!email || !full_name || !role || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    if (!["manager", "cashier"].includes(role)) {
      return NextResponse.json({ error: "Invalid role. Only manager or cashier allowed." }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
    }

    // Create Supabase Auth user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role },
    })

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    const userId = newUser.user.id

    // Create or update profile row (in case database trigger already created it)
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email,
      full_name,
      role,
      status: "active",
      created_by: caller.id,
    }, { onConflict: "id" })

    if (profileError) {
      // Cleanup: delete auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: profileError.message }, { status: 500 })
    }

    // Create or update user_status row
    await supabaseAdmin.from("user_status").upsert({
      user_id: userId,
      is_active: true,
      created_by: caller.id,
    }, { onConflict: "user_id" })

    // Audit log
    await supabaseAdmin.from("permission_audit_logs").insert({
      admin_user_id: caller.id,
      action_type: "USER_CREATED",
      affected_user_id: userId,
      affected_role: role,
      new_value: { email, full_name, role },
    })

    return NextResponse.json({ success: true, userId })
  } catch (error: any) {
    console.error("Create user error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
