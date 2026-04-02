import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { supabaseAdmin } from "@/lib/driverOrders"

const STATUS_MAP: Record<string, string> = {
    arrived_at_store: "Kurir di Toko",
    picked_up: "Dikirim",
    arrived_at_customer: "Kurir di Lokasi",
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

        const body = await req.json()
        const { orderId, status, pickupPhotoUrl, deliveryPhotoUrl, deliveryLat, deliveryLng } = body

        if (!orderId || !["arrived_at_store", "picked_up", "arrived_at_customer", "delivered"].includes(status)) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
        }

        // Enforce proof requirements
        if (status === "picked_up" && !pickupPhotoUrl) {
            return NextResponse.json({ error: "Foto bukti pengambilan barang diperlukan" }, { status: 400 })
        }
        if (status === "delivered") {
            if (!deliveryPhotoUrl) return NextResponse.json({ error: "Foto bukti serah terima diperlukan" }, { status: 400 })
            if (!deliveryLat || !deliveryLng) return NextResponse.json({ error: "Lokasi GPS diperlukan" }, { status: 400 })
        }

        const driverId = session.user.id

        // Verify this driver owns the active driver_order (accepted OR already picked_up)
        const { data: driverOrder } = await supabaseAdmin
            .from("driver_orders")
            .select("id, order_id, status")
            .eq("order_id", orderId)
            .eq("driver_id", driverId)
            .in("status", ["accepted", "arrived_at_store", "picked_up", "arrived_at_customer"])
            .maybeSingle() as { data: any }

        if (!driverOrder) {
            return NextResponse.json({ error: "Not your order or not accepted" }, { status: 403 })
        }

        const now = new Date().toISOString()
        const updateDriverOrder: any = { status }

        if (status === "picked_up") {
            updateDriverOrder.picked_up_at = now
            updateDriverOrder.pickup_photo_url = pickupPhotoUrl
        }
        if (status === "delivered") {
            updateDriverOrder.delivered_at = now
            updateDriverOrder.delivery_photo_url = deliveryPhotoUrl
            updateDriverOrder.delivery_lat = deliveryLat
            updateDriverOrder.delivery_lng = deliveryLng
        }

        // Update driver_orders
        await supabaseAdmin.from("driver_orders").update(updateDriverOrder).eq("id", driverOrder.id)

        // Mirror to orders table
        const orderUpdatePayload: any = { status: STATUS_MAP[status] }
        await supabaseAdmin.from("orders").update(orderUpdatePayload).eq("id", orderId)

        // Commission: credit wallets automatically via RPC
        let commission = 0
        if (status === "delivered") {
            const { error: rpcErr } = await supabaseAdmin.rpc("distribute_commission", { p_order_id: orderId })
            if (rpcErr) {
                console.error("[Commission RPC Error]", rpcErr)
                // Fallback or handle accordingly. For now, we log it.
            } else {
                console.log(`✅ [Commission] Admin RPC distribute_commission success for order ${orderId}`)
            }

            // Increment sold_count for each product in the order
            try {
                const { data: orderItems } = await supabaseAdmin
                    .from("order_items")
                    .select("product_id, quantity")
                    .eq("order_id", orderId)
                
                if (orderItems && orderItems.length > 0) {
                    for (const item of orderItems) {
                        if (item.product_id && item.quantity) {
                            await supabaseAdmin.rpc("increment_product_sold_count", {
                                p_id: item.product_id,
                                qty: item.quantity
                            })
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to increment product sold count:", err)
            }
        }

        return NextResponse.json({ success: true, orderStatus: STATUS_MAP[status], commission })
    } catch (e: any) {
        console.error("Update status error:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
