import { NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/serverAuth"
import { supabaseAdmin } from "@/lib/driverOrders"

export async function GET() {
    try {
        const user = await getAuthenticatedUser()
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const driverId = user.id

        // Fetch driver's currently active orders via service role to bypass RLS
        const { data, error } = await supabaseAdmin
            .from("driver_orders")
            .select("id, status, created_at, order_id, orders(id, customer_name, address, shipping_amount, created_at, status, distance_km)")
            .eq("driver_id", driverId)
            .in("status", ["offered", "accepted", "arrived_at_store", "picked_up", "arrived_at_customer"])
            .order("created_at", { ascending: false })
            .limit(10) as { data: any[], error: any }

        if (error) {
            console.error("active-orders error:", error)
            return NextResponse.json({ error: "Failed to fetch active orders" }, { status: 500 })
        }

        return NextResponse.json({ orders: data || [] })
    } catch (e: any) {
        console.error("active-orders error:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
