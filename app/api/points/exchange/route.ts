import { NextResponse } from "next/server"
import { getAuthenticatedUser, createAdminClient } from "@/lib/serverAuth"

export async function POST(req: Request) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { points } = await req.json()
  if (!points || points <= 0) return NextResponse.json({ error: "Jumlah poin tidak valid" }, { status: 400 })

  const supabase = createAdminClient()

  // CONVERSION RATE: 1 Point = Rp 1
  const CONVERSION_RATE = 1

  try {
    const { data, error } = await supabase.rpc('exchange_points_to_balance', {
      p_user_id: user.id,
      p_points_to_exchange: points,
      p_conversion_rate: CONVERSION_RATE
    })

    if (error) throw error
    if (!data.success) throw new Error(data.error)

    // Log the transaction in the unified ledger via RPC so balance_after is correctly captured automatically
    const { error: ledgerErr } = await supabase.rpc('create_transaction', {
      p_user_id: user.id,
      p_order_id: null,
      p_type: 'points_exchange',
      p_amount: points * CONVERSION_RATE,
      p_description: `Penukaran ${points} poin menjadi saldo`
    })

    if (ledgerErr) {
      console.error("[Points Exchange] Failed to log ledger:", ledgerErr)
    }

    return NextResponse.json({ 
      success: true, 
      balance_added: data.balance_added 
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Gagal menukar poin" }, { status: 500 })
  }
}
