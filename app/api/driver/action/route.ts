import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { supabaseAdmin, dispatchOrder } from "@/lib/driverOrders"
import { createNotification } from "@/lib/notifications"

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

        const { driverOrderId, action } = await req.json()
        if (!driverOrderId || !["accept", "reject"].includes(action)) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
        }

        const driverId = session.user.id

        // Fetch the driver_order row
        const { data: driverOrder } = await supabaseAdmin
            .from("driver_orders")
            .select("*")
            .eq("id", driverOrderId)
            .eq("driver_id", driverId)
            .eq("status", "offered")
            .maybeSingle() as { data: any }

        if (!driverOrder) {
            return NextResponse.json({ error: "Offer not found or already handled" }, { status: 404 })
        }

        // Check expiry
        if (driverOrder.offer_expires_at && new Date(driverOrder.offer_expires_at) < new Date()) {
            await supabaseAdmin.from("driver_orders").update({ status: "expired" } as any).eq("id", driverOrderId)
            return NextResponse.json({ error: "Offer expired" }, { status: 410 })
        }

        if (action === "accept") {
            // Mark as accepted
            await supabaseAdmin
                .from("driver_orders")
                .update({ status: "accepted", accepted_at: new Date().toISOString() } as any)
                .eq("id", driverOrderId)

            // Auto-update order status and assign driver_id
            await supabaseAdmin
                .from("orders")
                .update({ 
                    status: "Kurir Menuju Lokasi",
                    driver_id: driverId
                } as any)
                .eq("id", driverOrder.order_id)

            // Send Notification to User
            const { data: order } = await supabaseAdmin
                .from("orders")
                .select("user_id")
                .eq("id", driverOrder.order_id)
                .single()
            
            const { data: driver } = await supabaseAdmin
                .from("users")
                .select("full_name")
                .eq("id", driverId)
                .single()

            if (order && driver) {
                await createNotification({
                    userId: order.user_id,
                    type: 'order',
                    title: 'Kurir Sedang Menuju Toko',
                    message: `Driver ${driver.full_name} telah menerima pesanan Anda dan sedang menuju ke toko.`,
                    link: `/orders/${driverOrder.order_id}`
                })
            }

            return NextResponse.json({ success: true, message: "Accepted", orderId: driverOrder.order_id })
        }

        if (action === "reject") {
            // Mark as rejected
            await supabaseAdmin
                .from("driver_orders")
                .update({ status: "rejected" } as any)
                .eq("id", driverOrderId)

            // Immediately try next driver
            await dispatchOrder(driverOrder.order_id)

            return NextResponse.json({ success: true, message: "Rejected, dispatching next driver" })
        }

    } catch (e: any) {
        console.error("Action error:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
