import { NextResponse } from "next/server"
import { getAuthenticatedUser } from "@/lib/serverAuth"
import { supabaseAdmin } from "@/lib/driverOrders"

export async function GET() {
    try {
        const user = await getAuthenticatedUser()
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const driverId = user.id

        // Fetch driver's completed/ended orders via service role to bypass RLS
        const { data, error } = await supabaseAdmin
            .from("driver_orders")
            .select("id, status, created_at, order_id, orders(id, customer_name, address, shipping_amount, created_at, status)")
            .eq("driver_id", driverId)
            .in("status", ["delivered", "rejected", "expired", "cancelled"])
            .order("created_at", { ascending: false })
            .limit(30) as { data: any[], error: any }

        if (error) {
            console.error("order-history error:", error)
            return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 })
        }

        return NextResponse.json({ history: data || [] })
    } catch (e: any) {
        console.error("order-history error:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
