import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { supabaseAdmin } from "@/lib/driverOrders"
import { createNotification } from "@/lib/notifications"

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

        // Send Notifications
        const { data: order } = await supabaseAdmin
            .from("orders")
            .select("id, user_id, order_items(product_name)")
            .eq("id", orderId)
            .single()

        if (order) {
            let userTitle = ""
            let userMsg = ""

            if (status === "arrived_at_store") {
                userTitle = "Kurir Tiba di Toko"
                userMsg = `Driver sedang mengambil pesanan Anda di toko.`
            } else if (status === "picked_up") {
                userTitle = "Pesanan Dikirim"
                userMsg = `Pesanan Anda sedang dalam perjalanan oleh driver.`
            } else if (status === "arrived_at_customer") {
                userTitle = "Kurir Tiba di Lokasi"
                userMsg = `Driver sudah sampai di lokasi tujuan. Silakan temui driver.`
            } else if (status === "delivered") {
                userTitle = "Pesanan Telah Sampai"
                userMsg = `Pesanan #${orderId.slice(0, 8)} telah sampai. Silakan konfirmasi penerimaan.`
            }

            if (userTitle && userMsg) {
                await createNotification({
                    userId: order.user_id,
                    type: 'order',
                    title: userTitle,
                    message: userMsg,
                    link: `/orders/${orderId}`
                })
            }

            // Also notify shop when arrived_at_store or picked_up? 
            // Maybe just picked_up to let shop know it's gone
            if (status === "picked_up") {
                // Extract shopId from items (it's in the name "Product | ID")
                const extractShopId_internal = (orderItems: any[]) => {
                    for (const item of orderItems) {
                        const parts = item.product_name?.split(" | ")
                        if (parts && parts.length >= 2) {
                            const potentialId = parts[parts.length - 1].trim()
                            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(potentialId)) {
                                return potentialId
                            }
                        }
                    }
                    return null
                }
                const shopId = extractShopId_internal(order.order_items)
                if (shopId) {
                    const { data: shop } = await supabaseAdmin.from("shops").select("owner_id").eq("id", shopId).single()
                    if (shop) {
                        await createNotification({
                            userId: shop.owner_id,
                            type: 'order',
                            title: 'Pesanan Diambil Kurir',
                            message: `Pesanan #${orderId.slice(0, 8)} telah diambil oleh kurir.`,
                            forShop: true,
                            link: `/shop/orders/${orderId}`
                        })
                    }
                }
            }
        }

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
