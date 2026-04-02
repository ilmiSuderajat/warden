import { NextResponse } from "next/server"
import { getAuthenticatedUser, createAdminClient } from "@/lib/serverAuth"
import { MIN_WITHDRAW_AMOUNT } from "@/lib/constants"

export async function POST(req: Request) {
    try {
        const user = await getAuthenticatedUser()
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const body = await req.json()
        const { bank_name, account_number, account_name, amount } = body

        if (!bank_name || !account_number || !account_name || !amount) {
            return NextResponse.json({ error: "Semua field harus diisi" }, { status: 400 })
        }

        const withdrawalAmount = parseInt(amount)
        if (isNaN(withdrawalAmount) || withdrawalAmount < MIN_WITHDRAW_AMOUNT) {
            return NextResponse.json({ error: `Minimal penarikan Rp ${MIN_WITHDRAW_AMOUNT.toLocaleString("id-ID")}` }, { status: 400 })
        }

        const supabaseAdmin = createAdminClient()

        // 1. Verifikasi role driver (Security Fix)
        const { data: userRecord, error: roleError } = await supabaseAdmin
            .from("users")
            .select("role")
            .eq("id", user.id)
            .single()

        if (roleError || userRecord?.role !== "driver") {
            return NextResponse.json({ error: "Akses ditolak. Hanya untuk driver." }, { status: 403 })
        }

        // 2. Potong saldo secara atomic (Race Condition Fix)
        const { data: newSaldo, error: rpcError } = await supabaseAdmin
            .rpc("decrement_saldo", { 
                p_user_id: user.id, 
                p_amount: withdrawalAmount 
            })

        if (rpcError) {
            console.error("[Withdraw RPC Error]", rpcError.message)
            const isBalanceErr = rpcError.message.includes("Saldo tidak mencukupi")
            return NextResponse.json({ 
                error: isBalanceErr ? "Saldo tidak mencukupi" : "Gagal memproses penarikan" 
            }, { status: isBalanceErr ? 400 : 500 })
        }

        // 3. Catat riwayat log saldo
        await supabaseAdmin.from("driver_balance_logs").insert({
            driver_id: user.id,
            type: "withdraw",
            amount: -withdrawalAmount,
            balance_after: newSaldo,
            description: `Penarikan ke ${bank_name} - ${account_number}`
        })

        // 4. Catat request penarikan
        await supabaseAdmin.from("driver_withdraw_requests").insert({
            driver_id: user.id,
            amount: withdrawalAmount,
            bank_name,
            account_number,
            account_name,
            status: "pending"
        })

        return NextResponse.json({ success: true, newSaldo })
    } catch (e: any) {
        console.error("Withdraw Error:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
