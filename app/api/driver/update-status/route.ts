import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { supabaseAdmin } from "@/lib/driverOrders"
import { createNotification } from "@/lib/notifications"
import { randomUUID } from "crypto"

/**
 * Distribusi komisi manual (fallback jika RPC database gagal).
 * - Merchant menerima 95% dari harga barang (dipotong 5% komisi platform)
 * - Driver menerima 80% dari ongkos kirim (dipotong 20% komisi platform)
 */
async function distributeCommissionManual(orderId: string) {
    // Ambil data order
    const { data: order } = await supabaseAdmin
        .from("orders")
        .select("id, total_amount, shipping_amount, driver_id, is_commission_distributed")
        .eq("id", orderId)
        .single()

    if (!order) throw new Error("Order tidak ditemukan")
    if (order.is_commission_distributed) {
        console.log("[Commission] Sudah didistribusikan, skip.")
        return
    }

    const totalAmount: number = order.total_amount ?? 0
    const shippingAmount: number = order.shipping_amount ?? 0
    const baseShopEarning = totalAmount - shippingAmount
    const shopEarning = Math.floor(baseShopEarning * 0.95)   // potong 5% platform
    const driverEarning = Math.floor(shippingAmount * 0.80)  // potong 20% platform

    // Cari shop owner dari order_items
    const { data: items } = await supabaseAdmin
        .from("order_items")
        .select("product_name")
        .eq("order_id", orderId)
        .limit(1)

    const productName = items?.[0]?.product_name ?? ""
    const parts = productName.split(" | ")
    const shopId = parts.length >= 2 ? parts[parts.length - 1].trim() : null
    if (!shopId) throw new Error(`Gagal ekstrak Shop ID dari product_name: ${productName}`)

    const { data: shop } = await supabaseAdmin
        .from("shops")
        .select("owner_id")
        .eq("id", shopId)
        .single()
    if (!shop?.owner_id) throw new Error("Shop owner tidak ditemukan")

    // ── Merchant wallet ──
    if (shopEarning > 0) {
        const { data: shopWallet } = await supabaseAdmin
            .from("wallets").select("balance").eq("user_id", shop.owner_id).single()
        const newShopBal = (shopWallet?.balance ?? 0) + shopEarning
        await supabaseAdmin.from("wallets")
            .upsert({ user_id: shop.owner_id, balance: newShopBal, updated_at: new Date().toISOString() })
        // Catat transaksi
        await supabaseAdmin.from("transactions").upsert({
            user_id: shop.owner_id,
            order_id: orderId,
            type: "commission",
            amount: shopEarning,
            balance_after: newShopBal,
            description: `Hasil penjualan order #${orderId.slice(0, 8)}`,
            idempotency_key: `sys-comm-shop-${orderId}`,
            prev_hash: "GENESIS",
            hash: randomUUID().replace(/-/g, "")
        }, { onConflict: "idempotency_key" })
        console.log(`[Commission] Merchant +Rp${shopEarning} (saldo baru: Rp${newShopBal})`)
    }

    // ── Driver wallet ──
    const driverId = order.driver_id
    if (driverId && driverEarning > 0) {
        const { data: driverWallet } = await supabaseAdmin
            .from("wallets").select("balance").eq("user_id", driverId).single()
        const newDrvBal = (driverWallet?.balance ?? 0) + driverEarning
        await supabaseAdmin.from("wallets")
            .upsert({ user_id: driverId, balance: newDrvBal, updated_at: new Date().toISOString() })
        // Catat transaksi
        await supabaseAdmin.from("transactions").upsert({
            user_id: driverId,
            order_id: orderId,
            type: "commission",
            amount: driverEarning,
            balance_after: newDrvBal,
            description: `Komisi ongkir order #${orderId.slice(0, 8)}`,
            idempotency_key: `sys-comm-drv-${orderId}`,
            prev_hash: "GENESIS",
            hash: randomUUID().replace(/-/g, "")
        }, { onConflict: "idempotency_key" })
        console.log(`[Commission] Driver +Rp${driverEarning} (saldo baru: Rp${newDrvBal})`)
    }

    // Tandai sudah didistribusikan
    await supabaseAdmin.from("orders")
        .update({ is_commission_distributed: true })
        .eq("id", orderId)

    console.log(`✅ [Commission Fallback] Berhasil untuk order ${orderId}`)
}

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

        // Commission: credit wallets automatically
        let commission = 0
        if (status === "delivered") {
            // Try RPC first
            const { error: rpcErr } = await supabaseAdmin.rpc("distribute_commission", { p_order_id: orderId })
            if (rpcErr) {
                console.warn(`[Commission] RPC gagal (${rpcErr.message}), beralih ke distribusi manual TS...`)
                // ── Fallback: Distribusi komisi manual via TypeScript ──
                try {
                    await distributeCommissionManual(orderId)
                } catch (fallbackErr: any) {
                    console.error("[Commission Fallback Error]", fallbackErr.message)
                }
            } else {
                console.log(`✅ [Commission] RPC distribute_commission berhasil untuk order ${orderId}`)
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
