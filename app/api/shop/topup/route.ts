import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import Midtrans from "midtrans-client"

const snap = new Midtrans.Snap({
    isProduction: true,
    serverKey: process.env.MIDTRANS_SERVER_KEY!,
    clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY!,
})

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies()
        const supabaseAuth = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { cookies: { getAll: () => cookieStore.getAll(), setAll: () => { } } }
        )

        const { data: { session } } = await supabaseAuth.auth.getSession()
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const body = await req.json()
        const amount = parseInt(body.amount)

        if (isNaN(amount) || amount < 10000) {
            return NextResponse.json({ error: "Minimal topup Rp 10.000" }, { status: 400 })
        }

        const supabaseAdmin = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { cookies: { getAll: () => [], setAll: () => { } } }
        )

        // Ambil shop milik owner
        const { data: shop, error: shopError } = await supabaseAdmin
            .from("shops")
            .select("id, name, balance")
            .eq("owner_id", session.user.id)
            .maybeSingle()

        if (shopError || !shop) {
            return NextResponse.json({ error: "Warung tidak ditemukan." }, { status: 404 })
        }

        const shopIdShort = shop.id.replace(/-/g, "").substring(0, 8)
        const midtransOrderId = `TOPUP-${shopIdShort}-${Date.now()}`

        // Insert request topup ke DB
        const { data: topupReq, error: insertError } = await supabaseAdmin
            .from("shop_topup_requests")
            .insert({
                shop_id: shop.id,
                amount,
                midtrans_order_id: midtransOrderId,
                status: "pending",
            })
            .select("id")
            .single()

        if (insertError || !topupReq) {
            console.error("[Topup] Insert error:", insertError)
            return NextResponse.json({ error: "Gagal membuat request topup." }, { status: 500 })
        }

        // Ambil data user untuk customer details
        const { data: userData } = await supabaseAdmin
            .from("users")
            .select("full_name, email")
            .eq("id", session.user.id)
            .maybeSingle()

        const parameter = {
            transaction_details: {
                order_id: midtransOrderId,
                gross_amount: amount,
            },
            customer_details: {
                first_name: userData?.full_name || shop.name,
                email: userData?.email || session.user.email || "",
            },
            item_details: [
                {
                    id: "topup-saldo",
                    price: amount,
                    quantity: 1,
                    name: `Topup Saldo Warung – ${shop.name}`,
                },
            ],
        }

        let transaction: any
        try {
            transaction = await snap.createTransaction(parameter)
        } catch (midError: any) {
            console.error("[Topup Midtrans Error]:", midError.message)
            return NextResponse.json({ error: "Gagal membuat transaksi Midtrans.", details: midError.message }, { status: 500 })
        }

        // Simpan snap token ke request
        await supabaseAdmin
            .from("shop_topup_requests")
            .update({ snap_token: transaction.token })
            .eq("id", topupReq.id)

        return NextResponse.json({ token: transaction.token, orderId: midtransOrderId })
    } catch (err: any) {
        console.error("[Shop Topup Error]", err)
        return NextResponse.json({ error: "Terjadi kesalahan internal." }, { status: 500 })
    }
}
