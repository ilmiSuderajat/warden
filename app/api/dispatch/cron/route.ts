import { NextResponse } from "next/server"
import { supabaseAdmin, dispatchOrder } from "@/lib/driverOrders"

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

        return NextResponse.json({ success: true, processed: expiredOffers?.length || 0, results })
    } catch (error: any) {
        console.error("Cron Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export const GET = POST
