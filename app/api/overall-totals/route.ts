import { NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: userErr } = await supabase.auth.getUser()

    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Call RPC to get totals
    const { data, error } = await supabase.rpc("get_overall_totals", { p_user_id: user.id })
    if (error) {
      // More robust detection for missing function: Postgres undefined_function is 42883
      const msg = (error.message || '').toLowerCase()
      const code = (error as any).code
      if (code === '42883' || msg.includes('does not exist') || msg.includes('get_overall_totals')) {
        return NextResponse.json({
          error: "Missing RPC get_overall_totals. Please run migrations/2025-10-13_create_get_overall_totals.sql in your Supabase SQL editor.",
        }, { status: 501 })
      }
      console.error('[overall-totals] RPC error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const currencyTotals: Record<string, number> = {}
    const currencyEurTotals: Record<string, number> = {}
    let eurTotal = 0

    for (const row of data || []) {
      if (row.currency) {
        currencyTotals[row.currency] = Number(row.total || 0)
        currencyEurTotals[row.currency] = Number(row.eur_total || 0)
      }
      if (typeof row.overall_eur_total !== "undefined" && row.overall_eur_total !== null) {
        eurTotal = Number(row.overall_eur_total)
      }
    }

    return NextResponse.json({ eurTotal, currencyTotals, currencyEurTotals })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Unknown error" }, { status: 500 })
  }
}
