import { NextResponse } from "next/server"
import { getAuthenticatedUser, createAdminClient } from "@/lib/serverAuth"
import { MIN_WITHDRAW_AMOUNT } from "@/lib/constants"
import { createNotification } from "@/lib/notifications"

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

        // 2. Gunakan RPC request_withdraw (Unified for all roles)
        // RPC ini menangani: locking, balance validation, deduction, transaction logging, dan request entry.
        const { data: requestId, error: rpcError } = await supabaseAdmin
            .rpc("request_withdraw", { 
                p_amount: withdrawalAmount, 
                p_bank_name: bank_name,
                p_bank_account: account_number,
                p_bank_holder: account_name
            })

        if (rpcError) {
            console.error("[Withdraw RPC Error]", rpcError.message)
            const isBalanceErr = rpcError.message.toLowerCase().includes("insufficient")
            return NextResponse.json({ 
                error: isBalanceErr ? "Saldo tidak mencukupi" : "Gagal memproses penarikan" 
            }, { status: isBalanceErr ? 400 : 500 })
        }

        // Send Notification
        await createNotification({
            userId: user.id,
            type: 'finance',
            title: 'Permintaan Penarikan Dana',
            message: `Penarikan sebesar Rp ${withdrawalAmount.toLocaleString("id-ID")} sedang diproses.`
        })

        return NextResponse.json({ success: true, requestId })
    } catch (e: any) {
        console.error("Withdraw Error:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
