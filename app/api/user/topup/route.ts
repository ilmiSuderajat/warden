import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import Midtrans from "midtrans-client"

const snap = new Midtrans.Snap({
    isProduction: !process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY?.startsWith('SB-'),
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

        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
        if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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

        const { data: userData, error: userError } = await supabaseAdmin
            .from("users")
            .select("id, full_name, email")
            .eq("id", user.id)
            .maybeSingle()

        if (userError || !userData) {
            return NextResponse.json({ error: "User tidak ditemukan." }, { status: 404 })
        }

        const userIdShort = userData.id.replace(/-/g, "").substring(0, 8)
        const midtransOrderId = `USERTOPUP-${userIdShort}-${Date.now()}`

        const { data: topupReq, error: insertError } = await supabaseAdmin
            .from("user_topup_requests")
            .insert({
                user_id: userData.id,
                amount,
                midtrans_order_id: midtransOrderId,
                status: "pending",
            })
            .select("id")
            .single()

        if (insertError || !topupReq) {
            console.error("[User Topup] Insert error:", insertError)
            return NextResponse.json({ error: "Gagal membuat request topup." }, { status: 500 })
        }

        const parameter = {
            transaction_details: {
                order_id: midtransOrderId,
                gross_amount: amount,
            },
            customer_details: {
                first_name: userData.full_name || "User",
                email: userData.email || user.email || "",
            },
            item_details: [
                {
                    id: "topup-saldo-user",
                    price: amount,
                    quantity: 1,
                    name: `Topup Saldo Wallet Warden`,
                },
            ],
        }

        let transaction: any
        try {
            transaction = await snap.createTransaction(parameter)
        } catch (midError: any) {
            console.error("[User Topup Midtrans Error]:", midError.message)
            return NextResponse.json({ error: "Gagal membuat transaksi Midtrans.", details: midError.message }, { status: 500 })
        }

        await supabaseAdmin
            .from("user_topup_requests")
            .update({ snap_token: transaction.token })
            .eq("id", topupReq.id)

        return NextResponse.json({ token: transaction.token, orderId: midtransOrderId })
    } catch (err: any) {
        console.error("[User Topup Error]", err)
        return NextResponse.json({ error: "Terjadi kesalahan internal." }, { status: 500 })
    }
}
