import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { supabaseAdmin } from "@/lib/driverOrders"

export async function GET() {
    try {
        const cookieStore = await cookies()
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
        )
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const driverId = session.user.id

        // Use service role to bypass RLS on driver_orders table
        // Get active order (accepted or picked_up)
        const { data: activeDriverOrder } = await supabaseAdmin
            .from("driver_orders")
            .select("*")
            .eq("driver_id", driverId)
            .in("status", ["accepted", "arrived_at_store", "picked_up", "arrived_at_customer"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle() as { data: any }

        if (!activeDriverOrder) {
            // Also check for pending offer that hasn't expired
            const now = new Date().toISOString()
            const { data: pendingOffer } = await supabaseAdmin
                .from("driver_orders")
                .select("*")
                .eq("driver_id", driverId)
                .eq("status", "offered")
                .gte("offer_expires_at", now)
                .maybeSingle() as { data: any }

            if (pendingOffer) {
                return NextResponse.json({ type: "offer", driverOrder: pendingOffer })
            }

            return NextResponse.json({ type: "none" })
        }

        // Fetch the linked order details
        const { data: order } = await supabaseAdmin
            .from("orders")
            .select("*")
            .eq("id", activeDriverOrder.order_id)
            .maybeSingle() as { data: any }

        // Fetch order items
        const { data: items } = await supabaseAdmin
            .from("order_items")
            .select("product_name, quantity, price, image_url")
            .eq("order_id", activeDriverOrder.order_id) as { data: any[] }

        // Fetch shop coordinates
        let shop_lat = null;
        let shop_lng = null;
        if (items && items.length > 0) {
            const shopId = items[0].product_name?.split(" | ")?.[1]
            if (shopId) {
                const { data: shopResult } = await supabaseAdmin.from("shops").select("latitude, longitude").eq("id", shopId).maybeSingle()
                if (shopResult) {
                    shop_lat = shopResult.latitude
                    shop_lng = shopResult.longitude
                }
            }
        }

        return NextResponse.json({
            type: "active",
            driverOrder: { ...activeDriverOrder, orders: { ...order, shop_latitude: shop_lat, shop_longitude: shop_lng }, order_items: items || [] }
        })
    } catch (e: any) {
        console.error("my-order error:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
