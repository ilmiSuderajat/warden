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

        // Cek tipe topup (Driver vs Shop vs User)
        const isDriverTopup = order_id.startsWith("DRVTOPUP-")
        const isUserTopup = order_id.startsWith("USERTOPUP-")

        if (isDriverTopup) {
            return await handleDriverTopup(order_id, transaction_status)
        } else if (isUserTopup) {
            return await handleUserTopup(order_id, transaction_status)
        } else {
            return await handleShopTopup(order_id, transaction_status)
        }

    } catch (err: any) {
        console.error("🔥 [Topup Webhook Error]:", err.message)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

async function handleDriverTopup(order_id: string, transaction_status: string) {
    const { data: topupReq, error: fetchError } = await supabase
        .from("driver_topup_requests")
        .select("id, driver_id, amount, status")
        .eq("midtrans_order_id", order_id)
        .maybeSingle()

    if (fetchError || !topupReq) {
        console.log("❌ [Topup Webhook DRV] Request tidak ditemukan:", order_id)
        return NextResponse.json({ message: "Topup request not found" }, { status: 404 })
    }

    if (topupReq.status === "paid") {
        return NextResponse.json({ message: "Already processed" })
    }

    if (transaction_status === "settlement" || transaction_status === "capture") {
        const { data: user, error: userErr } = await supabase
            .from("users")
            .select("id, saldo")
            .eq("id", topupReq.driver_id)
            .single()

        if (userErr || !user) throw new Error("Driver not found")

        const newBalance = (user.saldo || 0) + topupReq.amount

        const { error: updateErr } = await supabase
            .from("users")
            .update({ saldo: newBalance })
            .eq("id", topupReq.driver_id)

        if (updateErr) throw updateErr

        await supabase.from("driver_balance_logs").insert({
            driver_id: topupReq.driver_id,
            type: "topup",
            amount: topupReq.amount,
            balance_after: newBalance,
            description: `Topup Saldo Driver via Midtrans (${order_id})`,
        })

        await supabase.from("driver_topup_requests")
            .update({ status: "paid" })
            .eq("id", topupReq.id)

        console.log(`✅ [Topup Webhook DRV] Driver ${topupReq.driver_id} balance += ${topupReq.amount} → ${newBalance}`)
    } else if (["cancel", "deny", "expire"].includes(transaction_status)) {
        await supabase.from("driver_topup_requests")
            .update({ status: "cancelled" })
            .eq("id", topupReq.id)
        console.log(`⚠️ [Topup Webhook DRV] Topup ${order_id} dibatalkan/expired`)
    }

    return NextResponse.json({ message: "OK" })
}

async function handleShopTopup(order_id: string, transaction_status: string) {
    const { data: topupReq, error: fetchError } = await supabase
        .from("shop_topup_requests")
        .select("id, shop_id, amount, status")
        .eq("midtrans_order_id", order_id)
        .maybeSingle()

    if (fetchError || !topupReq) {
        console.log("❌ [Topup Webhook SHP] Request tidak ditemukan:", order_id)
        return NextResponse.json({ message: "Topup request not found" }, { status: 404 })
    }

    if (topupReq.status === "paid") {
        return NextResponse.json({ message: "Already processed" })
    }

    if (transaction_status === "settlement" || transaction_status === "capture") {
        const { data: shop, error: shopErr } = await supabase
            .from("shops")
            .select("id, balance, cod_enabled")
            .eq("id", topupReq.shop_id)
            .single()

        if (shopErr || !shop) throw new Error("Shop not found")

        const newBalance = (shop.balance || 0) + topupReq.amount
        const shouldEnableCod = newBalance >= 0

        const { error: updateErr } = await supabase
            .from("shops")
            .update({
                balance: newBalance,
                ...(shouldEnableCod ? { cod_enabled: true } : {}),
            })
            .eq("id", topupReq.shop_id)

        if (updateErr) throw updateErr

        await supabase.from("shop_balance_logs").insert({
            shop_id: topupReq.shop_id,
            type: "topup",
            amount: topupReq.amount,
            balance_after: newBalance,
            description: `Topup Saldo Warung via Midtrans (${order_id})`,
        })

        await supabase.from("shop_topup_requests")
            .update({ status: "paid" })
            .eq("id", topupReq.id)

        console.log(`✅ [Topup Webhook SHP] Shop ${topupReq.shop_id} balance += ${topupReq.amount} → ${newBalance}, COD: ${shouldEnableCod ? "ON" : "still OFF"}`)
        console.log(`⚠️ [Topup Webhook SHP] Topup ${order_id} dibatalkan/expired`)
    }

    return NextResponse.json({ message: "OK" })
}

async function handleUserTopup(order_id: string, transaction_status: string) {
    const { data: topupReq, error: fetchError } = await supabase
        .from("user_topup_requests")
        .select("id, user_id, amount, status")
        .eq("midtrans_order_id", order_id)
        .maybeSingle()

    if (fetchError || !topupReq) {
        console.log("❌ [Topup Webhook USR] Request tidak ditemukan:", order_id)
        return NextResponse.json({ message: "Topup request not found" }, { status: 404 })
    }

    if (topupReq.status === "paid") {
        return NextResponse.json({ message: "Already processed" })
    }

    if (transaction_status === "settlement" || transaction_status === "capture") {
        // 1. Update wallet balance
        const { error: updateErr } = await supabase.rpc('increment_wallet_balance', {
            p_user_id: topupReq.user_id,
            p_amount: topupReq.amount
        })

        if (updateErr) {
            console.log("⚠️ RPC increment_wallet_balance failed, falling back to manual update:", updateErr.message)
            const { data: wallet } = await supabase.from("wallets").select("balance").eq("user_id", topupReq.user_id).single()
            const { error: manualErr } = await supabase.from("wallets").update({ balance: (wallet?.balance || 0) + topupReq.amount }).eq("user_id", topupReq.user_id)
            if (manualErr) throw manualErr
        }

        // 2. Insert secure transaction via RPC
        await supabase.rpc('create_wallet_transaction', {
            p_user_id: topupReq.user_id,
            p_order_id: null,
            p_type: 'topup',
            p_amount: topupReq.amount,
            p_desc: `Topup Saldo Wallet via Midtrans (${order_id})`
        })

        // 3. Mark request as paid
        await supabase.from("user_topup_requests")
            .update({ status: "paid" })
            .eq("id", topupReq.id)

        console.log(`✅ [Topup Webhook USR] User ${topupReq.user_id} balance += ${topupReq.amount}`)
    } else if (["cancel", "deny", "expire"].includes(transaction_status)) {
        await supabase.from("user_topup_requests")
            .update({ status: "cancelled" })
            .eq("id", topupReq.id)
        console.log(`⚠️ [Topup Webhook USR] Topup ${order_id} dibatalkan/expired`)
    }

    return NextResponse.json({ message: "OK" })
}
