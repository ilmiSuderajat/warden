import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { supabaseAdmin } from "@/lib/driverOrders"

export async function GET(req: Request) {
    try {
        const cookieStore = await cookies()
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
        )
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const { searchParams } = new URL(req.url)
        const driverOrderId = searchParams.get("driverOrderId")
        if (!driverOrderId) return NextResponse.json({ error: "driverOrderId required" }, { status: 400 })

        // Fetch with service role to bypass RLS
        const { data: driverOrder } = await supabaseAdmin
            .from("driver_orders")
            .select("*")
            .eq("id", driverOrderId)
            .eq("driver_id", session.user.id)
            .maybeSingle() as { data: any }

        if (!driverOrder) return NextResponse.json({ driverOrder: null })

        // Fetch linked order details
        const { data: order } = await supabaseAdmin
            .from("orders")
            .select("*")
            .eq("id", driverOrder.order_id)
            .maybeSingle() as { data: any }

        const { data: items } = await supabaseAdmin
            .from("order_items")
            .select("product_name, quantity, price, image_url")
            .eq("order_id", driverOrder.order_id) as { data: any[] }

        return NextResponse.json({ driverOrder: { ...driverOrder, orders: order, order_items: items || [] } })
    } catch (e: any) {
        console.error("check-offer error:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
