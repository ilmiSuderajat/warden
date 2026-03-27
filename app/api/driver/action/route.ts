import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { supabaseAdmin, dispatchOrder } from "@/lib/dispatch"

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
        const { orderId, action } = body

        if (!orderId || !["accept", "reject"].includes(action)) {
            return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
        }

        const driverId = session.user.id

        if (action === "accept") {
            const now = new Date()
            
            const { data: order } = await supabaseAdmin
                .from("orders")
                .select("driver_id, offered_to_driver_id, offer_expires_at")
                .eq("id", orderId)
                .maybeSingle() as { data: any }

            if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 })

            if (order.driver_id !== null) {
                return NextResponse.json({ error: "Order already taken" }, { status: 409 })
            }

            if (order.offered_to_driver_id !== driverId) {
                return NextResponse.json({ error: "Not offered to you" }, { status: 403 })
            }

            if (order.offer_expires_at && new Date(order.offer_expires_at) < now) {
                return NextResponse.json({ error: "Offer expired" }, { status: 410 })
            }

            const { error: updateError } = await supabaseAdmin
                .from("orders")
                // @ts-ignore
                .update({
                    driver_id: driverId,
                    accepted_at: now.toISOString(),
                    status: "Kurir Menuju Lokasi"
                })
                .eq("id", orderId)
                .is("driver_id", null)

            if (updateError) throw updateError

            return NextResponse.json({ success: true, message: "Accepted" })
        } 
        
        if (action === "reject") {
            const { data: order } = await supabaseAdmin
                .from("orders")
                .select("dispatch_attempt, offered_to_driver_id")
                .eq("id", orderId)
                .maybeSingle() as { data: any }
                
            if (order?.offered_to_driver_id === driverId) {
                await supabaseAdmin
                    .from("orders")
                    // @ts-ignore
                    .update({
                        offered_to_driver_id: null,
                        offer_expires_at: null,
                        dispatch_attempt: (order.dispatch_attempt || 0) + 1
                    })
                    .eq("id", orderId)
                
                await dispatchOrder(orderId)
                return NextResponse.json({ success: true, message: "Rejected successfully" })
            } else {
                return NextResponse.json({ success: true, message: "Already reassigned or taken" })
            }
        }

    } catch (e: any) {
        console.error("Action error:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
