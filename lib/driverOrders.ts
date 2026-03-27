import { createClient } from "@supabase/supabase-js"

export const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const OFFER_DURATION_SECONDS = 20
const COMMISSION_RATE = 0.80 // 80% of shipping_amount

export async function addDriverCommission(driverId: string, orderId: string) {
    const { data: order } = await supabaseAdmin
        .from("orders")
        .select("shipping_amount")
        .eq("id", orderId)
        .maybeSingle() as { data: any }

    if (!order?.shipping_amount) return

    const commission = Math.floor(order.shipping_amount * COMMISSION_RATE)
    if (commission <= 0) return

    const { data: userRow } = await supabaseAdmin
        .from("users")
        .select("saldo")
        .eq("id", driverId)
        .maybeSingle() as { data: any }

    const currentSaldo = userRow?.saldo || 0
    await supabaseAdmin
        .from("users")
        .update({ saldo: currentSaldo + commission } as any)
        .eq("id", driverId)

    return commission
}

// Haversine distance in km
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371
    const dLat = (lat2 - lat1) * (Math.PI / 180)
    const dLon = (lon2 - lon1) * (Math.PI / 180)
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function dispatchOrder(orderId: string) {
    // 1. Get the order
    const { data: order } = await supabaseAdmin
        .from("orders")
        .select("id, latitude, longitude, status, created_at")
        .eq("id", orderId)
        .maybeSingle() as { data: any }

    if (!order) return { success: false, error: "Order not found" }

    // If order already has an active driver
    if (["Kurir Menuju Lokasi", "Kurir di Toko", "Dikirim", "Kurir di Lokasi", "Selesai"].includes(order.status)) {
        return { success: false, error: "Order already has a driver" }
    }

    // Check if already accepted
    const { data: existing } = await supabaseAdmin
        .from("driver_orders")
        .select("id, status")
        .eq("order_id", orderId)
        .eq("status", "accepted")
        .maybeSingle() as { data: any }

    if (existing) return { success: false, error: "Already assigned" }

    // 2. Determine store location
    const storeLat = order.latitude || 0
    const storeLng = order.longitude || 0

    // 3. Fetch online drivers
    const { data: drivers } = await supabaseAdmin
        .from("users")
        .select("id, is_auto_accept, last_lat, last_lng")
        .eq("role", "driver")
        .eq("is_online", true) as { data: any[] }

    if (!drivers || drivers.length === 0) {
        return { success: false, error: "No drivers available" }
    }

    // 4. Filter out drivers already tried in the current round
    const { data: triedDrivers } = await supabaseAdmin
        .from("driver_orders")
        .select("driver_id")
        .eq("order_id", orderId)
        .in("status", ["rejected", "expired", "offered"]) as { data: any[] }

    const triedIds = new Set((triedDrivers || []).map((d: any) => d.driver_id))
    let eligibleDrivers = drivers.filter(d => !triedIds.has(d.id))

    // 5. ♻️ All drivers exhausted → reset round and try again (infinite retry)
    if (eligibleDrivers.length === 0) {
        console.log(`[Dispatch] ♻️ All drivers tried for order ${orderId} — resetting round...`)

        // Mark expired/rejected as "expired_reset" so they're skippable next filter
        await supabaseAdmin
            .from("driver_orders")
            .update({ status: "expired_reset" } as any)
            .eq("order_id", orderId)
            .in("status", ["rejected", "expired"])

        // Keep order in "Mencari Kurir" state
        await supabaseAdmin
            .from("orders")
            .update({ status: "Mencari Kurir" } as any)
            .eq("id", orderId)

        // Start fresh with all online drivers
        eligibleDrivers = drivers
    }

    // 6. Sort: auto-accept first, then closest
    const withDistance = eligibleDrivers.map(d => ({
        ...d,
        distance: (storeLat && d.last_lat)
            ? calculateDistance(storeLat, storeLng, d.last_lat, d.last_lng)
            : 999999
    }))

    withDistance.sort((a, b) => {
        if (a.is_auto_accept && !b.is_auto_accept) return -1
        if (!a.is_auto_accept && b.is_auto_accept) return 1
        return a.distance - b.distance
    })

    const selected = withDistance[0]

    // Count total attempts for logging
    const { count: attemptCount } = await supabaseAdmin
        .from("driver_orders")
        .select("*", { count: "exact", head: true })
        .eq("order_id", orderId)

    const attemptIndex = attemptCount || 0

    if (selected.is_auto_accept) {
        await supabaseAdmin.from("driver_orders").insert({
            order_id: orderId,
            driver_id: selected.id,
            status: "accepted",
            offered_at: new Date().toISOString(),
            accepted_at: new Date().toISOString(),
            offer_expires_at: null,
            dispatch_attempt: attemptIndex + 1
        } as any)

        await supabaseAdmin.from("orders").update({ status: "Kurir Menuju Lokasi" } as any).eq("id", orderId)

        return { success: true, message: "Auto-accepted", assigned: true }
    }

    // Offer with countdown
    const expiresAt = new Date(Date.now() + OFFER_DURATION_SECONDS * 1000).toISOString()

    await supabaseAdmin.from("driver_orders").insert({
        order_id: orderId,
        driver_id: selected.id,
        status: "offered",
        offered_at: new Date().toISOString(),
        offer_expires_at: expiresAt,
        dispatch_attempt: attemptIndex + 1
    } as any)

    return { success: true, message: "Offered to driver", driver_id: selected.id }
}
