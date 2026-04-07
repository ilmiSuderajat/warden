import { NextResponse } from "next/server"
import { supabaseAdmin, dispatchOrder } from "@/lib/driverOrders"
import { createNotification } from "@/lib/notifications"

export async function POST(req: Request) {
    try {
        const now = new Date().toISOString()

        // Find offered driver_orders rows that have expired
        const { data: expiredOffers } = await supabaseAdmin
            .from("driver_orders")
            .select("id, order_id, driver_id")
            .eq("status", "offered")
            .lt("offer_expires_at", now) as { data: any[] }

        const results = []

        for (const offer of expiredOffers || []) {
            // Mark this offer as expired
            await supabaseAdmin
                .from("driver_orders")
                .update({ status: "expired" } as any)
                .eq("id", offer.id)

            // Try dispatching to next driver
            const result = await dispatchOrder(offer.order_id)
            results.push({ order_id: offer.order_id, result })
        }

        // ==========================================
        // Auto-complete orders after 3 hours of delivery
        // ==========================================
        const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
        
        const { data: deliveredDriverOrders } = await supabaseAdmin
            .from("driver_orders")
            .select("order_id, delivered_at")
            .eq("status", "delivered")
            .lt("delivered_at", threeHoursAgo) as { data: any[] }

        let autoCompleteCount = 0
        for (const ddo of deliveredDriverOrders || []) {
            // Check if the order is still "Dikirim" (meaning user hasn't clicked Selesaikan)
            const { data: order } = await supabaseAdmin
                .from("orders")
                .select("id, status, user_id")
                .eq("id", ddo.order_id)
                .eq("status", "Dikirim")
                .maybeSingle() as { data: any }
                
            if (order) {
                await supabaseAdmin
                    .from("orders")
                    .update({ status: "Selesai" } as any)
                    .eq("id", order.id)
                
                // Send Notifications
                // To User
                await createNotification({
                    userId: order.user_id,
                    type: 'order',
                    title: 'Pesanan Selesai Otomatis',
                    message: `Pesanan #${order.id.slice(0, 8)} telah diselesaikan secara otomatis oleh sistem.`,
                    link: `/orders/${order.id}`
                })

                // To Shop (simplified fetch for cron)
                const { data: orderItems } = await supabaseAdmin.from("order_items").select("product_name").eq("order_id", order.id)
                if (orderItems) {
                    const extractShopId_cron = (items: any[]) => {
                        for (const item of items) {
                            const parts = item.product_name?.split(" | ")
                            if (parts && parts.length >= 2) {
                                const id = parts[parts.length - 1].trim()
                                if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return id
                            }
                        }
                        return null
                    }
                    const shopId = extractShopId_cron(orderItems)
                    if (shopId) {
                        const { data: shop } = await supabaseAdmin.from("shops").select("owner_id").eq("id", shopId).single()
                        if (shop) {
                            await createNotification({
                                userId: shop.owner_id,
                                type: 'order',
                                title: 'Pesanan Selesai Otomatis',
                                message: `Pesanan #${order.id.slice(0, 8)} telah diselesaikan secara otomatis oleh sistem.`,
                                forShop: true,
                                link: `/shop/orders/${order.id}`
                            })
                        }
                    }
                }

                autoCompleteCount++
            }
        }

        return NextResponse.json({ 
            success: true, 
            processedOffers: expiredOffers?.length || 0, 
            autoCompleted: autoCompleteCount,
            results 
        })
    } catch (error: any) {
        console.error("Cron Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export const GET = POST
