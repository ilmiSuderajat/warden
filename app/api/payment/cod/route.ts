import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { dispatchOrder } from "@/lib/driverOrders"

const isValidUUID = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

const COMMISSION_RATE = 0.05 // 5%
const COD_DISABLE_THRESHOLD = -50000 // saldo di bawah -50.000 → nonaktifkan COD

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { orderId } = body

        if (!orderId || !isValidUUID(orderId)) {
            return NextResponse.json({ error: "Order ID tidak valid." }, { status: 400 })
        }

        const cookieStore = await cookies()
        const supabaseAuth = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll: () => cookieStore.getAll(),
                    setAll: () => {},
                },
            }
        )

        const { data: { session } } = await supabaseAuth.auth.getSession()
        if (!session) {
            return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
        }

        const supabaseAdmin = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                cookies: {
                    getAll: () => [],
                    setAll: () => {},
                },
            }
        )

        // 1. Ambil order beserta items
        const { data: order, error: fetchError } = await supabaseAdmin
            .from("orders")
            .select("id, payment_status, user_id, total_amount, subtotal_amount, order_items(*)")
            .eq("id", orderId)
            .eq("user_id", session.user.id)
            .maybeSingle()

        if (fetchError || !order) {
            return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 })
        }

        if (order.payment_status !== "pending") {
            return NextResponse.json({ error: "Pesanan sudah diproses." }, { status: 409 })
        }

        // 2. Cari shop dari order_items (format: "nama produk | shop_id")
        const shopId = extractShopId(order.order_items)

        if (shopId) {
            // 3. Cek apakah COD diizinkan untuk shop ini
            const { data: shop, error: shopErr } = await supabaseAdmin
                .from("shops")
                .select("id, balance, cod_enabled")
                .eq("id", shopId)
                .maybeSingle()

            if (shopErr || !shop) {
                console.error("[COD] Shop not found for order:", orderId, "shop_id:", shopId)
            } else if (!shop.cod_enabled) {
                return NextResponse.json(
                    {
                        error: "Pembayaran COD untuk warung ini sementara tidak tersedia. Silakan pilih metode pembayaran lain.",
                        code: "COD_DISABLED",
                    },
                    { status: 403 }
                )
            }
        }

        // 4. Update status order ke COD
        const { error: updateError } = await supabaseAdmin
            .from("orders")
            .update({
                payment_status: "processing",
                payment_method: "cod",
                status: "Mencari Kurir",
            })
            .eq("id", orderId)
            .eq("user_id", session.user.id)

        if (updateError) throw updateError

        // 5. Potong komisi 5% dari saldo warung (COD berarti shop belum terima uang, komisi didebit)
        if (shopId) {
            await deductShopCommission(supabaseAdmin, shopId, order, orderId)
        }

        // 6. Trigger dispatch driver
        await dispatchOrder(orderId)

        return NextResponse.json({ success: true })
    } catch (err: any) {
        console.error("[COD Payment Error]", err)
        return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 })
    }
}

/** Ekstrak shop_id dari order_items (format: "nama produk | {shop_id}") */
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

/** Potong komisi 5% dari saldo warung, log aktivitas, dan nonaktifkan COD jika perlu */
async function deductShopCommission(
    supabaseAdmin: any,
    shopId: string,
    order: any,
    orderId: string
) {
    try {
        const { data: shop } = await supabaseAdmin
            .from("shops")
            .select("id, balance, cod_enabled")
            .eq("id", shopId)
            .single()

        if (!shop) return

        const subtotal = order.subtotal_amount || order.total_amount || 0
        const commission = Math.round(subtotal * COMMISSION_RATE)
        const newBalance = (shop.balance || 0) - commission
        const shouldDisableCod = newBalance < COD_DISABLE_THRESHOLD

        await supabaseAdmin
            .from("shops")
            .update({
                balance: newBalance,
                ...(shouldDisableCod ? { cod_enabled: false } : {}),
            })
            .eq("id", shopId)

        await supabaseAdmin.from("shop_balance_logs").insert({
            shop_id: shopId,
            type: "cod_debit",
            amount: -commission,
            balance_after: newBalance,
            description: `Komisi COD 5% dari pesanan #${orderId.slice(0, 8)}`,
            order_id: orderId,
        })

        if (shouldDisableCod) {
            console.warn(`⚠️ [COD] Shop ${shopId} saldo ${newBalance} < ${COD_DISABLE_THRESHOLD} → COD DINONAKTIFKAN`)
        }
    } catch (err) {
        console.error("[deductShopCommission] Error:", err)
    }
}
