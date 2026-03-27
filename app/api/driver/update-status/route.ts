import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { supabaseAdmin } from "@/lib/driverOrders"

// Maps driver_orders status to orders status displayed to users
const STATUS_MAP: Record<string, string> = {
    picked_up: "Dikirim",
    delivered: "Selesai"
}

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies()
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
        )
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const { orderId, status } = await req.json()
        if (!orderId || !["picked_up", "delivered"].includes(status)) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
        }

        const driverId = session.user.id

        // Verify this driver owns the accepted driver_order
        const { data: driverOrder } = await supabaseAdmin
            .from("driver_orders")
            .select("id, order_id")
            .eq("order_id", orderId)
            .eq("driver_id", driverId)
            .eq("status", "accepted")
            .maybeSingle() as { data: any }

        if (!driverOrder) {
            return NextResponse.json({ error: "Not your order or not accepted" }, { status: 403 })
        }

        const now = new Date().toISOString()
        const updateDriverOrder: any = { status }
        if (status === "picked_up") updateDriverOrder.picked_up_at = now
        if (status === "delivered") updateDriverOrder.delivered_at = now

        // Update driver_orders
        await supabaseAdmin
            .from("driver_orders")
            .update(updateDriverOrder)
            .eq("id", driverOrder.id)

        // Mirror the status to the orders table
        await supabaseAdmin
            .from("orders")
            .update({ status: STATUS_MAP[status] } as any)
            .eq("id", orderId)

        return NextResponse.json({ success: true, orderStatus: STATUS_MAP[status] })
    } catch (e: any) {
        console.error("Update status error:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
