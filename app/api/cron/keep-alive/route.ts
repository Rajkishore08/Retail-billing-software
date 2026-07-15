import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Runs weekly (see vercel.json crons). Writes one row into the separate
// `sales_snapshots` table — never into `transactions` — purely to generate
// DB activity so the Supabase free-tier project doesn't auto-pause after
// 7 days of inactivity. A paused project made auth hang forever on load;
// see contexts/auth-context.tsx.
export async function GET(req: NextRequest) {
  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically
  // when CRON_SECRET is set as an env var. Reject anyone else.
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get("authorization")
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured")
    }
    const supabaseAdmin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: stats, error: statsError } = await supabaseAdmin.rpc(
      "get_dashboard_stats_optimized"
    )
    if (statsError) throw statsError
    const row = stats?.[0] ?? {}

    const { error: insertError } = await supabaseAdmin.from("sales_snapshots").insert({
      total_products: row.total_products ?? 0,
      total_customers: row.total_customers ?? 0,
      monthly_revenue: row.monthly_revenue ?? 0,
      total_transactions_today: row.total_transactions_today ?? 0,
      total_sales_today: row.total_sales_today ?? 0,
    })
    if (insertError) throw insertError

    // Best-effort cleanup so this table stays small; failure here
    // shouldn't fail the keep-alive ping itself.
    try {
      await supabaseAdmin.rpc("prune_sales_snapshots")
    } catch {
      // ignore
    }

    return NextResponse.json({ success: true, pingedAt: new Date().toISOString() })
  } catch (error: any) {
    console.error("Keep-alive cron error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
