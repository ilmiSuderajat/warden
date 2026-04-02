import { NextResponse } from "next/server"
import { getAuthenticatedUser, createAdminClient } from "@/lib/serverAuth"
import { MIN_WITHDRAW_AMOUNT } from "@/lib/constants"

export async function POST(req: Request) {
    try {
        const user = await getAuthenticatedUser()
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const body = await req.json()
        const { amount, bank_name, account_number, account_name } = body

        const withdrawAmount = parseInt(amount)
        if (isNaN(withdrawAmount) || withdrawAmount < MIN_WITHDRAW_AMOUNT) {
            return NextResponse.json({ error: `Minimal penarikan Rp ${MIN_WITHDRAW_AMOUNT.toLocaleString("id-ID")}` }, { status: 400 })
        }

        if (!bank_name || !account_number || !account_name) {
            return NextResponse.json({ error: "Semua data rekening harus diisi." }, { status: 400 })
        }

        const supabaseAdmin = createAdminClient()

        // 1. Ambil info toko dan validasi ownership
        const { data: shop, error: shopErr } = await supabaseAdmin
            .from("shops")
            .select("id")
            .eq("owner_id", user.id)
            .maybeSingle()

        if (shopErr || !shop) {
            return NextResponse.json({ error: "Warung tidak ditemukan." }, { status: 404 })
        }

        // 2. Potong saldo secara atomic (Race Condition Fix)
        const { data: newBalance, error: rpcError } = await supabaseAdmin
            .rpc("decrement_shop_balance", { 
                p_shop_id: shop.id, 
                p_amount: withdrawAmount 
            })

        if (rpcError) {
            console.error("[Shop Withdraw RPC Error]", rpcError.message)
            const isBalanceErr = rpcError.message.includes("Saldo tidak mencukupi")
            return NextResponse.json({ 
                error: isBalanceErr ? "Saldo tidak mencukupi" : "Gagal memproses penarikan" 
            }, { status: isBalanceErr ? 400 : 500 })
        }

        // 3. Insert withdraw request
        await supabaseAdmin.from("shop_withdraw_requests").insert({
            shop_id: shop.id,
            amount: withdrawAmount,
            bank_name,
            account_number,
            account_name,
            status: "pending",
        })

        // 4. Insert log riwayat saldo
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
