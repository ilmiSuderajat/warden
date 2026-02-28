import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const isValidUUID = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { orderId } = body

        if (!orderId || !isValidUUID(orderId)) {
            return NextResponse.json({ error: "Order ID tidak valid." }, { status: 400 })
        }

        const cookieStore = await cookies()

        const supabaseAuth = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll: () => cookieStore.getAll(),
                    setAll: () => { },
                },
            }
        )

        const { data: { session } } = await supabaseAuth.auth.getSession()

        if (!session) {
            return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
        }

        const supabaseAdmin = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                cookies: {
                    getAll: () => [],
                    setAll: () => { },
                },
            }
        )

        const { data: order, error: fetchError } = await supabaseAdmin
            .from("orders")
            .select("id, payment_status, user_id")
            .eq("id", orderId)
            .eq("user_id", session.user.id)
            .maybeSingle()

        if (fetchError || !order) {
            return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 })
        }

        if (order.payment_status !== "pending") {
            return NextResponse.json({ error: "Pesanan sudah diproses." }, { status: 409 })
        }

        const { error: updateError } = await supabaseAdmin
            .from("orders")
            .update({
                payment_status: "processing",
                payment_method: "cod"
            })
            .eq("id", orderId)
            .eq("user_id", session.user.id)

        if (updateError) throw updateError

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error("[COD Payment Error]", err)
        return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 })
    }
}
