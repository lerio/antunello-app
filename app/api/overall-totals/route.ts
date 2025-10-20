import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userErr } = await supabase.auth.getUser()

    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Call RPC to get only the overall EUR total
    const { data, error } = await supabase.rpc("get_overall_total_eur", { p_user_id: user.id })
    if (error) {
      // Detect missing function
      const msg = (error.message || '').toLowerCase()
      const errObj = error as unknown as Record<string, unknown>
      const code = (typeof errObj.code === 'string' ? errObj.code : undefined)
      if (code === '42883' || msg.includes('does not exist') || msg.includes('get_overall_total_eur')) {
        return NextResponse.json({
          error: "Missing RPC get_overall_total_eur. Please run migrations/2025-10-16_replace_overall_totals_function.sql in your Supabase SQL editor.",
        }, { status: 501 })
      }
      console.error('[overall-totals] RPC error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // RPC returns a scalar numeric; normalize and return
    const first = Array.isArray(data) ? (data as unknown[])[0] : (data as unknown)
    const eurTotal = Number(first) || 0

    return NextResponse.json({ eurTotal })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unknown error" }, { status: 500 })
  }
}
