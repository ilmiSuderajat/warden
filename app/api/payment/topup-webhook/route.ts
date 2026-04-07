import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import crypto from "crypto"
import { createNotification } from "@/lib/notifications"

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
    try {
        const body = await req.json()
        console.log("📦 [Topup Webhook] Received Body:", JSON.stringify(body, null, 2))

        const {
            order_id,
            status_code,
            gross_amount,
            signature_key,
            transaction_status,
        } = body

        // 1. Verifikasi signature Midtrans
        // Gunakan gross_amount persis seperti yang dikirim Midtrans (bisa berupa string "50000.00")
        const serverKey = process.env.MIDTRANS_SERVER_KEY!
        const payload = order_id + status_code + gross_amount + serverKey
        const hash = crypto
            .createHash("sha512")
            .update(payload)
            .digest("hex")

        if (hash !== signature_key) {
            console.error("❌ [Topup Webhook] Signature mismatch!")
            console.error("Expected:", hash)
            console.error("Received:", signature_key)
            return NextResponse.json({ message: "Invalid signature" }, { status: 403 })
        }

        console.log(`🔔 [Topup Webhook] Validated: ${order_id}, status: ${transaction_status}`)

        // Cek tipe topup (Driver vs Shop vs User)
        let response: NextResponse
        if (order_id.startsWith("DRVTOPUP-")) {
            response = await handleDriverTopup(order_id, transaction_status)
        } else if (order_id.startsWith("USERTOPUP-")) {
            response = await handleUserTopup(order_id, transaction_status)
        } else {
            response = await handleShopTopup(order_id, transaction_status)
        }

        console.log(`✅ [Topup Webhook] Finished processing ${order_id}`)
        return response

    } catch (err: any) {
        console.error("🔥 [Topup Webhook Error]:", err.message)
        return NextResponse.json({ error: "Internal Server Error", details: err.message }, { status: 500 })
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
        // 1. Update wallet balance FIRST so that create_transaction captures the correct post-topup balance_after
        const { error: updateErr } = await supabase.rpc('increment_wallet_balance', {
            p_user_id: topupReq.driver_id,
            p_amount: topupReq.amount
        })

        if (updateErr) {
            console.error("⚠️ RPC increment_wallet_balance failed:", updateErr.message)
            // Manual fallback if RPC fails
            const { data: wallet } = await supabase.from("wallets").select("balance").eq("user_id", topupReq.driver_id).single()
            await supabase.from("wallets").update({ balance: (wallet?.balance || 0) + topupReq.amount }).eq("user_id", topupReq.driver_id)
        }

        // 2. Record ledger AFTER balance is updated so balance_after is correct
        const { error: ledgerErr } = await supabase.rpc('create_transaction', {
            p_user_id: topupReq.driver_id,
            p_order_id: null,
            p_type: 'topup',
            p_amount: topupReq.amount,
            p_description: `Topup Saldo Driver via Midtrans (${order_id})`
        })
        if (ledgerErr) throw ledgerErr

        // 3. Mark request as paid
        await supabase.from("driver_topup_requests")
            .update({ status: "paid" })
            .eq("id", topupReq.id)

        // 4. Send Notification
        await createNotification({
            userId: topupReq.driver_id,
            type: 'finance',
            title: 'Top Up Driver Berhasil',
            message: `Dana sebesar Rp ${topupReq.amount.toLocaleString("id-ID")} telah ditambahkan ke saldo driver Anda.`
        })

        console.log(`✅ [Topup Webhook DRV] Driver ${topupReq.driver_id} wallet topped up by ${topupReq.amount}`)
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
        // 1. Get owner_id for the shop to update the unified wallet
        const { data: shop } = await supabase.from("shops").select("owner_id, balance").eq("id", topupReq.shop_id).single()
        if (!shop) throw new Error("Shop not found")

        // 2. Update wallet balance FIRST so that create_transaction captures correct post-topup balance_after
        const { error: updateErr } = await supabase.rpc('increment_wallet_balance', {
            p_user_id: shop.owner_id,
            p_amount: topupReq.amount
        })

        if (updateErr) {
            console.error("⚠️ RPC increment_wallet_balance (Shop) failed:", updateErr.message)
            // Manual fallback to wallets table
            const { data: wallet } = await supabase.from("wallets").select("balance").eq("user_id", shop.owner_id).single()
            await supabase.from("wallets").update({ balance: (wallet?.balance || 0) + topupReq.amount }).eq("user_id", shop.owner_id)
        }

        // 3. Record ledger AFTER balance is updated so balance_after is correct
        const { error: ledgerErr } = await supabase.rpc('create_transaction', {
            p_user_id: shop.owner_id,
            p_order_id: null,
            p_type: 'topup',
            p_amount: topupReq.amount,
            p_description: `Topup Saldo Warung via Midtrans (${order_id})`
        })
        if (ledgerErr) throw ledgerErr

        await supabase.from("shop_topup_requests")
            .update({ status: "paid" })
            .eq("id", topupReq.id)

        // 4. Send Notification
        await createNotification({
            userId: shop.owner_id,
            type: 'finance',
            title: 'Top Up Warung Berhasil',
            message: `Dana sebesar Rp ${topupReq.amount.toLocaleString("id-ID")} telah ditambahkan ke saldo warung Anda.`,
            forShop: true
        })

        console.log(`✅ [Topup Webhook SHP] Shop owner ${shop.owner_id} wallet topped up by ${topupReq.amount}`)
    } else if (["cancel", "deny", "expire"].includes(transaction_status)) {
        await supabase.from("shop_topup_requests")
            .update({ status: "cancelled" })
            .eq("id", topupReq.id)
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
        // 1. Update wallet balance FIRST so that create_transaction captures correct post-topup balance_after
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

        // 2. Record ledger AFTER balance is updated so balance_after is correct
        const { error: ledgerErr } = await supabase.rpc('create_transaction', {
            p_user_id: topupReq.user_id,
            p_order_id: null,
            p_type: 'topup',
            p_amount: topupReq.amount,
            p_description: `Topup Saldo Wallet via Midtrans (${order_id})`
        })
        if (ledgerErr) throw ledgerErr

        // 3. Mark request as paid
        await supabase.from("user_topup_requests")
            .update({ status: "paid" })
            .eq("id", topupReq.id)

        // 4. Send Notification
        await createNotification({
            userId: topupReq.user_id,
            type: 'finance',
            title: 'Top Up Wallet Berhasil',
            message: `Dana sebesar Rp ${topupReq.amount.toLocaleString("id-ID")} telah ditambahkan ke wallet Anda.`
        })

        console.log(`✅ [Topup Webhook USR] User ${topupReq.user_id} balance += ${topupReq.amount}`)
    } else if (["cancel", "deny", "expire"].includes(transaction_status)) {
        await supabase.from("user_topup_requests")
            .update({ status: "cancelled" })
            .eq("id", topupReq.id)
        console.log(`⚠️ [Topup Webhook USR] Topup ${order_id} dibatalkan/expired`)
    }

    return NextResponse.json({ message: "OK" })
}
