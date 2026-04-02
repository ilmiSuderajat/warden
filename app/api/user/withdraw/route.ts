import { NextResponse } from "next/server"
import { getAuthenticatedUser, createAdminClient } from "@/lib/serverAuth"

const MIN_WITHDRAW = 10000

export async function POST(req: Request) {
    try {
        const user = await getAuthenticatedUser()
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const body = await req.json()
        const { amount, bank_name, account_number, account_name } = body

        const withdrawAmount = parseInt(amount)
        if (isNaN(withdrawAmount) || withdrawAmount < MIN_WITHDRAW) {
            return NextResponse.json({ error: `Minimal penarikan Rp ${MIN_WITHDRAW.toLocaleString("id-ID")}` }, { status: 400 })
        }

        if (!bank_name || !account_number || !account_name) {
            return NextResponse.json({ error: "Semua data rekening harus diisi." }, { status: 400 })
        }

        const supabaseAdmin = createAdminClient()

        // 1. Cek saldo wallet user
        const { data: wallet, error: walletErr } = await supabaseAdmin
            .from("wallets")
            .select("balance")
            .eq("user_id", user.id)
            .single()

        if (walletErr || !wallet) {
            return NextResponse.json({ error: "Wallet tidak ditemukan." }, { status: 404 })
        }

        if ((wallet.balance || 0) < withdrawAmount) {
            return NextResponse.json({ error: "Saldo tidak mencukupi." }, { status: 400 })
        }

        // 2. Potong saldo wallet secara atomic
        const newBalance = wallet.balance - withdrawAmount
        const { error: updateErr } = await supabaseAdmin
            .from("wallets")
            .update({ balance: newBalance })
            .eq("user_id", user.id)

        if (updateErr) throw updateErr

        // 3. Catat transaksi withdraw
        await supabaseAdmin.rpc("create_wallet_transaction", {
            p_user_id: user.id,
            p_order_id: null,
            p_type: "withdraw",
            p_amount: -withdrawAmount,
            p_desc: `Penarikan ke ${bank_name} - ${account_number} a/n ${account_name}`,
        })

        // 4. Simpan withdraw request
        const { error: insertErr } = await supabaseAdmin
            .from("user_withdraw_requests")
            .insert({
                user_id: user.id,
                amount: withdrawAmount,
                bank_name,
                account_number,
                account_name,
                status: "pending",
            })

        if (insertErr) throw insertErr

        return NextResponse.json({ success: true, newBalance })
    } catch (err: any) {
        console.error("[User Withdraw Error]", err)
        return NextResponse.json({ error: "Terjadi kesalahan internal." }, { status: 500 })
    }
}
