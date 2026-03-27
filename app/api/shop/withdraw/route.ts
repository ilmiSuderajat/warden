import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const MIN_WITHDRAW = 10000

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies()
        const supabaseAuth = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
        )

        const { data: { session } } = await supabaseAuth.auth.getSession()
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const body = await req.json()
        const { amount, bank_name, account_number, account_name } = body

        const withdrawAmount = parseInt(amount)
        if (isNaN(withdrawAmount) || withdrawAmount < MIN_WITHDRAW) {
            return NextResponse.json({ error: `Minimal penarikan Rp ${MIN_WITHDRAW.toLocaleString("id-ID")}` }, { status: 400 })
        }

        if (!bank_name || !account_number || !account_name) {
            return NextResponse.json({ error: "Semua data rekening harus diisi." }, { status: 400 })
        }

        const supabaseAdmin = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { cookies: { getAll: () => [], setAll: () => {} } }
        )

        // Ambil shop owner
        const { data: shop, error: shopErr } = await supabaseAdmin
            .from("shops")
            .select("id, balance")
            .eq("owner_id", session.user.id)
            .maybeSingle()

        if (shopErr || !shop) {
            return NextResponse.json({ error: "Warung tidak ditemukan." }, { status: 404 })
        }

        if ((shop.balance || 0) < withdrawAmount) {
            return NextResponse.json({ error: "Saldo tidak mencukupi untuk penarikan ini." }, { status: 400 })
        }

        const newBalance = (shop.balance || 0) - withdrawAmount

        // Kurangi saldo (hold langsung)
        const { error: updateErr } = await supabaseAdmin
            .from("shops")
            .update({ balance: newBalance })
            .eq("id", shop.id)

        if (updateErr) throw updateErr

        // Insert withdraw request
        await supabaseAdmin.from("shop_withdraw_requests").insert({
            shop_id: shop.id,
            amount: withdrawAmount,
            bank_name,
            account_number,
            account_name,
            status: "pending",
        })

        // Insert log
        await supabaseAdmin.from("shop_balance_logs").insert({
            shop_id: shop.id,
            type: "withdraw",
            amount: -withdrawAmount,
            balance_after: newBalance,
            description: `Penarikan ke ${bank_name} ${account_number} a/n ${account_name}`,
        })

        return NextResponse.json({ success: true, newBalance })
    } catch (err: any) {
        console.error("[Shop Withdraw Error]", err)
        return NextResponse.json({ error: "Terjadi kesalahan internal." }, { status: 500 })
    }
}
