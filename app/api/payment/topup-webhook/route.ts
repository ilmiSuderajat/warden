import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const {
            order_id,
            status_code,
            gross_amount,
            signature_key,
            transaction_status,
        } = body

        // 1. Verifikasi signature Midtrans
        const serverKey = process.env.MIDTRANS_SERVER_KEY!
        const hash = crypto
            .createHash("sha512")
            .update(order_id + status_code + gross_amount + serverKey)
            .digest("hex")

        if (hash !== signature_key) {
            console.log("❌ [Topup Webhook] Signature tidak valid")
            return NextResponse.json({ message: "Invalid signature" }, { status: 403 })
        }

        console.log(`🔔 [Topup Webhook] order_id: ${order_id}, status: ${transaction_status}`)

        // 2. Ambil topup request
        const { data: topupReq, error: fetchError } = await supabase
            .from("shop_topup_requests")
            .select("id, shop_id, amount, status")
            .eq("midtrans_order_id", order_id)
            .maybeSingle()

        if (fetchError || !topupReq) {
            console.log("❌ [Topup Webhook] Request tidak ditemukan:", order_id)
            return NextResponse.json({ message: "Topup request not found" }, { status: 404 })
        }

        // 3. Sudah diproses sebelumnya? skip
        if (topupReq.status === "paid") {
            return NextResponse.json({ message: "Already processed" })
        }

        // 4. Handle status
        if (
            transaction_status === "settlement" ||
            transaction_status === "capture"
        ) {
            // Ambil saldo terbaru
            const { data: shop, error: shopErr } = await supabase
                .from("shops")
                .select("id, balance, cod_enabled")
                .eq("id", topupReq.shop_id)
                .single()

            if (shopErr || !shop) throw new Error("Shop not found")

            const newBalance = (shop.balance || 0) + topupReq.amount
            const shouldEnableCod = newBalance >= 0

            // Update saldo shop
            const { error: updateErr } = await supabase
                .from("shops")
                .update({
                    balance: newBalance,
                    ...(shouldEnableCod ? { cod_enabled: true } : {}),
                })
                .eq("id", topupReq.shop_id)

            if (updateErr) throw updateErr

            // Insert log
            await supabase.from("shop_balance_logs").insert({
                shop_id: topupReq.shop_id,
                type: "topup",
                amount: topupReq.amount,
                balance_after: newBalance,
                description: `Topup via Midtrans (${order_id})`,
            })

            // Update status topup request
            await supabase
                .from("shop_topup_requests")
                .update({ status: "paid" })
                .eq("id", topupReq.id)

            console.log(
                `✅ [Topup Webhook] Shop ${topupReq.shop_id} balance += ${topupReq.amount} → ${newBalance}, COD: ${shouldEnableCod ? "ON" : "still OFF"}`
            )
        } else if (
            transaction_status === "cancel" ||
            transaction_status === "deny" ||
            transaction_status === "expire"
        ) {
            await supabase
                .from("shop_topup_requests")
                .update({ status: "cancelled" })
                .eq("id", topupReq.id)

            console.log(`⚠️ [Topup Webhook] Topup ${order_id} dibatalkan/expired`)
        }

        return NextResponse.json({ message: "OK" })
    } catch (err: any) {
        console.error("🔥 [Topup Webhook Error]:", err.message)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
