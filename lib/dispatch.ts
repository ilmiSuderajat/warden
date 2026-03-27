import { createClient } from "@supabase/supabase-js"
import { Database } from "./database.types"

// Create a supabase admin client to bypass RLS
export const supabaseAdmin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const OFFER_DURATION_SECONDS = 20

// Utility for Distance
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

export async function dispatchOrder(orderId: string) {
    // 1. Get order details
    const { data: order, error: orderError } = await supabaseAdmin
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle()

    if (!order || orderError) {
        console.error("Order not found:", orderId)
        return { success: false, error: "Order not found" }
    }

    if (order.driver_id) {
        console.log("Order already has a driver assigned:", orderId)
        return { success: false, error: "Already assigned" }
    }

    // Attempt to get Store Location from product items
    const { data: items } = await supabaseAdmin
        .from("order_items")
        .select("product_name")
        .eq("order_id", orderId)
        .limit(1)
        .maybeSingle()

    let storeLat = 0
    let storeLng = 0
    let hasLocation = false

    if (items?.product_name) {
        const namePart = items.product_name.split(' | ')[0].trim()
        const { data: product } = await supabaseAdmin
            .from("products")
            .select("latitude, longitude")
            .ilike("name", `${namePart}%`)
            .limit(1)
            .maybeSingle()
            
        if (product?.latitude && product?.longitude) {
            storeLat = product.latitude
            storeLng = product.longitude
            hasLocation = true
        }
    }

    // Fallback to customer's delivery exact spot if no product store geo is found
    if (!hasLocation && order.latitude && order.longitude) {
        storeLat = order.latitude
        storeLng = order.longitude
        hasLocation = true
    }

    // 2. Fetch all online drivers
    const { data: drivers } = await supabaseAdmin
        .from("users")
        .select("id, is_auto_accept, last_lat, last_lng")
        .eq("role", "driver")
        .eq("is_online", true)

    if (!drivers || drivers.length === 0) {
        console.log("No drivers online/available for:", orderId)
        return { success: false, error: "No drivers available" }
    }

    // Calculate distance and priority
    const driversWithDistance = drivers.map(d => ({
        ...d,
        distance: (hasLocation && d.last_lat && d.last_lng) 
            ? calculateDistance(storeLat, storeLng, d.last_lat, d.last_lng) 
            : 999999 // fallback if no GPS
    }))

    // Sort: auto-accept true first, then distance ascending
    driversWithDistance.sort((a, b) => {
        if (a.is_auto_accept && !b.is_auto_accept) return -1;
        if (!a.is_auto_accept && b.is_auto_accept) return 1;
        return a.distance - b.distance;
    });

    const attemptIndex = order.dispatch_attempt || 0;
    
    // Choose driver in the sorted queue using attempt index
    const selectedDriver = driversWithDistance[attemptIndex % driversWithDistance.length];

    if (selectedDriver.is_auto_accept) {
        // Immediate assign
        await supabaseAdmin
            .from("orders")
            .update({
                driver_id: selectedDriver.id,
                offered_to_driver_id: null,
                offer_expires_at: null,
                accepted_at: new Date().toISOString(),
                status: "Kurir Menuju Lokasi",
                dispatch_attempt: attemptIndex + 1
            })
            .eq("id", orderId);
            
        return { success: true, message: "Assigned immediately via auto-accept", assigned: true }
    }

    // Else: offer to specific driver with 20-second timeout
    const expiresAt = new Date(Date.now() + OFFER_DURATION_SECONDS * 1000).toISOString();
    
    await supabaseAdmin
        .from("orders")
        .update({
            offered_to_driver_id: selectedDriver.id,
            offer_expires_at: expiresAt,
        })
        .eq("id", orderId);

    // Firebase FCM Notification payload skeleton based on instructions
    /*
    sendFCM({
        to: getDriverFcmToken(selectedDriver.id),
        notification: { title: "Order Baru", body: "Segera ambil order" },
        data: { order_id: orderId, url: `/driver/order/${orderId}` }
    })
    */
    
    return { success: true, message: "Offered to driver successfully", driver_id: selectedDriver.id }
}
