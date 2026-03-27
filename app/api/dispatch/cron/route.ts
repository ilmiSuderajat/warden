import { NextResponse } from "next/server"
import { supabaseAdmin, dispatchOrder } from "@/lib/dispatch"

export async function POST(req: Request) {
    try {
        const now = new Date().toISOString()
        
        const { data: expiredOrders, error } = await supabaseAdmin
            .from("orders")
            .select("id, dispatch_attempt")
            .is("driver_id", null)
            .lt("offer_expires_at", now)
            .not("offer_expires_at", "is", null) as { data: any[], error: any }
            
        if (error) throw error
        
        const results = []

        for (const order of expiredOrders || []) {
            await supabaseAdmin
                .from("orders")
                // @ts-ignore
                .update({ 
                    dispatch_attempt: (order.dispatch_attempt || 0) + 1,
                    offered_to_driver_id: null,
                    offer_expires_at: null
                })
                .eq("id", order.id)

            const dispatchRes = await dispatchOrder(order.id)
            results.push({ id: order.id, result: dispatchRes })
        }

        return NextResponse.json({ success: true, processed: expiredOrders?.length || 0, results })
    } catch (error: any) {
        console.error("Cron Worker Error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

export const GET = POST;
