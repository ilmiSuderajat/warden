import { NextResponse } from "next/server"
import { getAuthenticatedUser, createAdminClient } from "@/lib/serverAuth"
import { MIN_WITHDRAW_AMOUNT } from "@/lib/constants"
import { createNotification } from "@/lib/notifications"

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

        // 2. Gunakan RPC request_withdraw (Unified for all roles)
        // RPC ini menangani: locking, balance validation, deduction, transaction logging, dan request entry.
        // Penting: user_id dari auth digunakan sebagai kunci di tabel wallets.
        const { data: requestId, error: rpcError } = await supabaseAdmin
            .rpc("request_withdraw", { 
                p_amount: withdrawAmount, 
                p_bank_name: bank_name,
                p_bank_account: account_number,
                p_bank_holder: account_name
            })

        if (rpcError) {
            console.error("[Shop Withdraw RPC Error]", rpcError.message)
            const isBalanceErr = rpcError.message.toLowerCase().includes("insufficient")
            return NextResponse.json({ 
                error: isBalanceErr ? "Saldo tidak mencukupi" : "Gagal memproses penarikan" 
            }, { status: isBalanceErr ? 400 : 500 })
        }

        // Send Notification
        await createNotification({
            userId: user.id,
            type: 'finance',
            title: 'Permintaan Penarikan Dana Warung',
            message: `Penarikan sebesar Rp ${withdrawAmount.toLocaleString("id-ID")} sedang diproses.`,
            forShop: true
        })

        return NextResponse.json({ success: true, requestId })
    } catch (err: any) {
        console.error("[Shop Withdraw Error]", err)
        return NextResponse.json({ error: "Terjadi kesalahan internal." }, { status: 500 })
    }
}
