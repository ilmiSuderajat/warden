import { NextResponse } from "next/server"
import { getAuthenticatedUser, createAdminClient } from "@/lib/serverAuth"
import { dispatchOrder } from "@/lib/driverOrders"
import { PLATFORM_COMMISSION_RATE, COD_DISABLE_THRESHOLD, COD_MAX_DISTANCE_KM } from "@/lib/constants"

const isValidUUID = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { orderId } = body

    // ── Input validation ──────────────────────────────────────────
    if (!orderId || !isValidUUID(orderId)) {
      return NextResponse.json({ error: "Order ID tidak valid." }, { status: 400 })
    }

    // ── 1. Auth: verify identity via Supabase Auth server ─────────
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json({ error: "Sesi tidak valid. Silakan login ulang." }, { status: 401 })
    }

    const supabase = createAdminClient()

    // ── 2. Fetch order + enforce ownership ────────────────────────
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, payment_status, user_id, total_amount, subtotal_amount, distance_km, order_items(*)")
      .eq("id", orderId)
      .eq("user_id", user.id)  // ✅ ownership enforcement
      .maybeSingle()

    if (fetchError || !order) {
      console.warn(`[COD] Order not found or access denied. order=${orderId} user=${user.id}`)
      return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 })
    }

    // ── 3. Prevent re-processing ──────────────────────────────────
    if (order.payment_status !== "pending") {
      return NextResponse.json({ error: "Pesanan ini sudah pernah diproses." }, { status: 409 })
    }

    // ── 4. COD distance limit (max 15 km) ─────────────────────────
    const distanceKm = Number(order.distance_km ?? 0)
    if (distanceKm > COD_MAX_DISTANCE_KM) {
      return NextResponse.json(
        {
          error: `COD hanya tersedia untuk jarak di bawah ${COD_MAX_DISTANCE_KM} km. Jarak pesanan Anda: ${distanceKm.toFixed(1)} km. Silakan pilih pembayaran online.`,
          code: "COD_DISTANCE_EXCEEDED",
        },
        { status: 400 }
      )
    }

    // ── 5. COD shop eligibility check ─────────────────────────────
    const shopId = extractShopId(order.order_items)
    if (shopId) {
      const { data: shop, error: shopErr } = await supabase
        .from("shops")
        .select("id, balance, cod_enabled")
        .eq("id", shopId)
        .maybeSingle()

      if (shopErr || !shop) {
        console.error("[COD] Shop not found for order:", orderId, "shop_id:", shopId)
      } else if (!shop.cod_enabled) {
        return NextResponse.json(
          {
            error: "Pembayaran COD untuk warung ini sementara tidak tersedia. Mohon pilih metode pembayaran lain.",
            code: "COD_DISABLED",
          },
          { status: 403 }
        )
      }
    }

    // ── 6. Update order to COD processing ─────────────────────────
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        payment_status: "processing",
        payment_method: "cod",
        status: "Mencari Kurir",
      })
      .eq("id", orderId)
      .eq("user_id", user.id)

    if (updateError) throw updateError

    // ── 7. Deduct shop commission ──────────────────────────────────
    if (shopId) {
      await deductShopCommission(supabase, shopId, order, orderId)
    }

    // ── 8. Trigger driver dispatch ────────────────────────────────
    await dispatchOrder(orderId)

    console.log(`[COD] ✅ Order ${orderId} confirmed via COD. distance=${distanceKm.toFixed(1)}km`)
    return NextResponse.json({ success: true })

  } catch (err: any) {
    console.error("[COD Payment Error]", err)
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memproses pesanan." },
      { status: 500 }
    )
  }
}

/** Extract shop_id embedded in product_name format: "Nama Produk | {uuid}" */
function extractShopId(orderItems: any[]): string | null {
  if (!orderItems?.length) return null
  for (const item of orderItems) {
    const parts = item.product_name?.split(" | ")
    if (parts && parts.length >= 2) {
      const potentialId = parts[parts.length - 1].trim()
      if (isValidUUID(potentialId)) return potentialId
    }
  }
  return null
}


async function deductShopCommission(
  supabase: any,
  shopId: string,
  order: any,
  orderId: string
) {
  try {
    const { data: shop } = await supabase
      .from("shops")
      .select("id, balance, cod_enabled")
      .eq("id", shopId)
      .single()

    if (!shop) return

    const subtotal = order.subtotal_amount || order.total_amount || 0
    const commission = Math.round(subtotal * PLATFORM_COMMISSION_RATE)
    const newBalance = (shop.balance || 0) - commission
    const shouldDisableCod = newBalance < COD_DISABLE_THRESHOLD

    await supabase
      .from("shops")
      .update({
        balance: newBalance,
        ...(shouldDisableCod ? { cod_enabled: false } : {}),
      })
      .eq("id", shopId)

    await supabase.from("shop_balance_logs").insert({
      shop_id: shopId,
      type: "cod_debit",
      amount: -commission,
      balance_after: newBalance,
      description: `Komisi COD 5% dari pesanan #${orderId.slice(0, 8)}`,
      order_id: orderId,
    })

    if (shouldDisableCod) {
      console.warn(`⚠️ [COD] Shop ${shopId} saldo ${newBalance} < ${COD_DISABLE_THRESHOLD} → COD dinonaktifkan`)
    }
  } catch (err) {
    console.error("[deductShopCommission] Error:", err)
  }
}
