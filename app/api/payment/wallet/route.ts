import { NextResponse } from "next/server"
import { getAuthenticatedUser, createAdminClient, createAuthClient } from "@/lib/serverAuth"
import { createNotification } from "@/lib/notifications"

const isValidUUID = (value: string) =>
   /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

/**
 * POST /api/payment/wallet
 *
 * CRITICAL: process_payment RPC uses auth.uid() internally in Postgres.
 * It MUST be called via the user-scoped SSR auth client — NOT the admin/service-role
 * client (which sets auth.uid() = null in Postgres context, breaking the RPC).
 */
export async function POST(req: Request) {
    try {
        const user = await getAuthenticatedUser()
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const { orderId, idempotencyKey } = await req.json()
        if (!orderId || !isValidUUID(orderId)) {
            return NextResponse.json({ error: "Order ID tidak valid." }, { status: 400 })
        }
        if (!idempotencyKey) {
            return NextResponse.json({ error: "Idempotency key diperlukan." }, { status: 400 })
        }

        // ⚠️ Use user-scoped auth client (SSR cookie session) for the RPC call.
        //    process_payment uses auth.uid() to locate the user's wallet.
        //    Service-role admin client bypasses JWT context → auth.uid() = null → RPC fails.
        const authClient = await createAuthClient()
        const { error: rpcErr } = await authClient.rpc("process_payment", {
            p_order_id: orderId,
            p_idempotency_key: idempotencyKey,
        })

        if (rpcErr) {
            console.error("[Wallet RPC Error]", rpcErr.message, rpcErr.code)
            const msg = rpcErr.message?.toLowerCase() ?? ""
            if (msg.includes("insufficient") || msg.includes("saldo") || msg.includes("balance")) {
                return NextResponse.json({ error: "Saldo Wallet tidak mencukupi." }, { status: 400 })
            }
            return NextResponse.json(
                { error: `Gagal memproses pembayaran Wallet: ${rpcErr.message}` },
                { status: 500 }
            )
        }

        // Admin client is fine for data reads (bypasses RLS safely)
        const supabase = createAdminClient()

        // Fetch order details for notifications
        const { data: order } = await supabase
            .from("orders")
            .select("id, user_id, shop_id, order_items(product_name)")
            .eq("id", orderId)
            .single()

        if (order) {
            // Notify user
            await createNotification({
                userId: user.id,
                type: 'order',
                title: 'Pembayaran Wallet Berhasil',
                message: `Pesanan #${orderId.slice(0, 8)} telah dibayar dari Wallet. Kami sedang mencari kurir.`,
                link: `/orders/${orderId}`
            })

            // Notify shop — use shop_id directly from orders, fallback to extractShopId
            const shopId = (order as any).shop_id || extractShopId((order as any).order_items || [])
            if (shopId) {
                const { data: shop } = await supabase.from("shops").select("owner_id").eq("id", shopId).single()
                if (shop) {
                    await createNotification({
                        userId: shop.owner_id,
                        type: 'order',
                        title: 'Pesanan Baru Masuk (Wallet)',
                        message: `Ada pesanan baru #${orderId.slice(0, 8)} yang dibayar lewat Wallet. Silakan siapkan produknya.`,
                        forShop: true,
                        link: `/shop/orders/${orderId}`
                    })
                }
            }
        }

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error("[Wallet Payment Error]", err)
        return NextResponse.json({ error: "Terjadi kesalahan internal." }, { status: 500 })
    }
}

function extractShopId(orderItems: any[]): string | null {
    if (!orderItems?.length) return null
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
