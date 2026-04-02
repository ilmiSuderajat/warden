import { NextResponse } from "next/server"
import { getAuthenticatedUser, createAdminClient } from "@/lib/serverAuth"

export async function POST(req: Request) {
    try {
        const admin = await getAuthenticatedUser()
        if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const supabaseAdmin = createAdminClient()

        // 1. Verifikasi role admin
        const { data: adminRecord, error: roleError } = await supabaseAdmin
            .from("users")
            .select("role")
            .eq("id", admin.id)
            .single()

        if (roleError || adminRecord?.role !== "admin") {
            return NextResponse.json({ error: "Akses ditolak. Fitur ini khusus Admin." }, { status: 403 })
        }

        const body = await req.json()
        const { id, type, targetId, amount } = body

        if (!id || !type || !targetId || !amount) {
            return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 })
        }

        let table = ""
        if (type === "driver") table = "driver_withdraw_requests"
        else if (type === "shop") table = "shop_withdraw_requests"
        else if (type === "user") table = "user_withdraw_requests"
        else return NextResponse.json({ error: "Tipe penarikan tidak valid" }, { status: 400 })

        // 2. Ambil request current status
        const { data: request, error: reqErr } = await supabaseAdmin
            .from(table)
            .select("status")
            .eq("id", id)
            .single()

        if (reqErr || !request) {
            return NextResponse.json({ error: "Request penarikan tidak ditemukan" }, { status: 404 })
        }

        if (request.status !== "pending") {
            return NextResponse.json({ error: `Request sudah diproses (${request.status})` }, { status: 400 })
        }

        // 3. Update status jadi rejected
        const { error: updateErr } = await supabaseAdmin
            .from(table)
            .update({ status: "rejected" })
            .eq("id", id)

        if (updateErr) throw updateErr

        // 4. REFUND SALDO
        // Karena saldo sudah dipotong saat user/driver/shop submit, kita harus kembalikan saldo.
        const refundAmount = parseInt(amount)

        if (type === "driver") {
            const { data: user } = await supabaseAdmin.from("users").select("saldo").eq("id", targetId).single()
            const newSaldo = (user?.saldo || 0) + refundAmount
            await supabaseAdmin.from("users").update({ saldo: newSaldo }).eq("id", targetId)
            
            await supabaseAdmin.from("driver_balance_logs").insert({
                driver_id: targetId,
                type: "refund",
                amount: refundAmount,
                balance_after: newSaldo,
                description: `Refund Penarikan Ditolak`
            })
        } else if (type === "shop") {
            const { data: shop } = await supabaseAdmin.from("shops").select("balance").eq("id", targetId).single()
            const newBalance = (shop?.balance || 0) + refundAmount
            await supabaseAdmin.from("shops").update({ balance: newBalance }).eq("id", targetId)
            
            await supabaseAdmin.from("shop_balance_logs").insert({
                shop_id: targetId,
                type: "refund",
                amount: refundAmount,
                balance_after: newBalance,
                description: `Refund Penarikan Ditolak`
            })
        } else if (type === "user") {
            const { data: wallet } = await supabaseAdmin.from("wallets").select("balance").eq("user_id", targetId).single()
            const newBalance = (wallet?.balance || 0) + refundAmount
            await supabaseAdmin.from("wallets").update({ balance: newBalance }).eq("user_id", targetId)
            
            await supabaseAdmin.rpc("create_wallet_transaction", {
                p_user_id: targetId,
                p_order_id: null,
                p_type: "refund",
                p_amount: refundAmount,
                p_desc: `Refund Penarikan Ditolak`
            })
        }

        return NextResponse.json({ success: true, message: "Penarikan dana ditolak dan saldo dikembalikan" })
    } catch (err: any) {
        console.error("[Reject Withdraw Error]", err)
        return NextResponse.json({ error: "Terjadi kesalahan internal" }, { status: 500 })
    }
}
