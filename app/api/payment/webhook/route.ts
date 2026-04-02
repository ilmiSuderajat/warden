import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/serverAuth"
import { dispatchOrder } from "@/lib/driverOrders"
import { PLATFORM_COMMISSION_RATE } from "@/lib/constants"
import crypto from "crypto"

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status,
    } = body

    // ── 1. Validate Midtrans signature (anti-spoofing) ────────────
    const serverKey = process.env.MIDTRANS_SERVER_KEY!
    const expectedHash = crypto
      .createHash("sha512")
      .update(order_id + status_code + gross_amount + serverKey)
      .digest("hex")

    if (expectedHash !== signature_key) {
      console.warn(`[Webhook] ❌ Invalid signature. order_id=${order_id}`)
      return NextResponse.json({ message: "Invalid signature" }, { status: 403 })
    }

    const supabase = createAdminClient()

    // ── 2. Resolve Midtrans order_id → DB order UUID ──────────────
    const realOrderId = await resolveOrderId(supabase, order_id)
    if (!realOrderId) {
      // Return 200 to prevent Midtrans retry spam for unknown orders
      console.warn(`[Webhook] Could not resolve order_id=${order_id} — ignoring`)
      return NextResponse.json({ message: "Order not found, acknowledged" })
    }

    console.log(`[Webhook] 🔔 order_id=${order_id}, resolved=${realOrderId}, status=${transaction_status}`)

    // ── 3. Idempotency: skip if already in a final state ─────────
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id, payment_status")
      .eq("id", realOrderId)
      .maybeSingle()

    if (!existingOrder) {
      console.warn(`[Webhook] Order ${realOrderId} missing from DB`)
      return NextResponse.json({ message: "Order not found, acknowledged" })
    }

    const FINAL_STATUSES = ["paid", "failed", "expired", "cancelled"]
    if (FINAL_STATUSES.includes(existingOrder.payment_status)) {
      console.log(`[Webhook] ⏭ Order ${realOrderId} already finalized as '${existingOrder.payment_status}', skipping`)
      return NextResponse.json({ message: "Already processed" })
    }

    // ── 4. Map Midtrans transaction_status → internal status ──────
    let paymentStatus = "pending"
    let orderStatus = "Menunggu Pembayaran"
    let isPaid = false

    if (transaction_status === "capture") {
      if (fraud_status === "challenge") {
        paymentStatus = "pending"
        orderStatus = "Menunggu Pembayaran"
      } else if (fraud_status === "accept") {
        paymentStatus = "paid"
        orderStatus = "Mencari Kurir"
        isPaid = true
      }
    } else if (transaction_status === "settlement") {
      paymentStatus = "paid"
      orderStatus = "Mencari Kurir"
      isPaid = true
    } else if (transaction_status === "pending") {
      paymentStatus = "waiting_payment"
      orderStatus = "Menunggu Pembayaran"
    } else if (transaction_status === "cancel") {
      paymentStatus = "cancelled"
      orderStatus = "Dibatalkan"
    } else if (transaction_status === "deny") {
      paymentStatus = "failed"
      orderStatus = "Dibatalkan"
    } else if (transaction_status === "expire") {
      paymentStatus = "expired"
      orderStatus = "Dibatalkan"
    }

    // ── 5. Persist status update ──────────────────────────────────
    const updatePayload: Record<string, any> = {
      payment_status: paymentStatus,
      status: orderStatus,
      payment_method: "online",
    }
    if (isPaid) {
      updatePayload.paid_at = new Date().toISOString()
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", realOrderId)

    if (updateError) {
      console.error(`[Webhook] DB update error for ${realOrderId}:`, updateError.message)
      return NextResponse.json({ error: "DB update failed" }, { status: 500 })
    }

    // ── 6. On paid: credit shop balance + trigger dispatch ────────
    if (isPaid) {
      await creditShopBalance(supabase, realOrderId)
      await dispatchOrder(realOrderId)
      console.log(`[Webhook] ✅ Order ${realOrderId} PAID → driver dispatch triggered`)
    }

    console.log(`[Webhook] ✅ Order ${realOrderId} → payment_status=${paymentStatus}`)
    return NextResponse.json({ message: "OK" })

  } catch (err: any) {
    console.error("[Webhook] 🔥 Unhandled crash:", err.message)
    // Return 500 so Midtrans retries
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

/**
 * Resolves a Midtrans order_id string back to the real DB order UUID.
 * Priority: midtrans_order_id column → raw UUID fallback (legacy orders)
 */
async function resolveOrderId(supabase: any, midtransOrderId: string): Promise<string | null> {
  // Primary: look up via stored midtrans_order_id column (new orders)
  const { data: byMidtransId } = await supabase
    .from("orders")
    .select("id")
    .eq("midtrans_order_id", midtransOrderId)
    .maybeSingle()

  if (byMidtransId?.id) return byMidtransId.id

  // Fallback: if the value is itself a raw UUID (legacy orders before this patch)
  const isRawUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(midtransOrderId)
  if (isRawUUID) return midtransOrderId

  // Fallback: old format was "{uuid}-{timestamp}" — first 36 chars
  if (midtransOrderId.length > 36) {
    const candidate = midtransOrderId.substring(0, 36)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate)
    if (isUUID) return candidate
  }

  return null
}

/** Credit shop balance after successful online payment (net of 5% platform commission) */
async function creditShopBalance(supabase: any, orderId: string) {
  try {
    const { data: order } = await supabase
      .from("orders")
      .select("id, subtotal_amount, total_amount, order_items(*)")
      .eq("id", orderId)
      .single()

    if (!order) return

    const shopId = extractShopId(order.order_items)
    if (!shopId) {
      console.warn(`[Webhook] No shop_id found in order_items for order ${orderId}`)
      return
    }

    const { data: shop } = await supabase
      .from("shops")
      .select("id, balance")
      .eq("id", shopId)
      .single()

    if (!shop) return

    const subtotal = order.subtotal_amount || order.total_amount || 0
    const commission = Math.round(subtotal * PLATFORM_COMMISSION_RATE)
    const shopEarnings = subtotal - commission
    const newBalance = (shop.balance || 0) + shopEarnings

    await supabase.from("shops").update({ balance: newBalance }).eq("id", shopId)

    await supabase.from("shop_balance_logs").insert({
      shop_id: shopId,
      type: "commission",
      amount: shopEarnings,
      balance_after: newBalance,
      description: `Pembayaran online pesanan #${orderId.slice(0, 8)} (komisi ${PLATFORM_COMMISSION_RATE * 100}% = Rp ${commission.toLocaleString("id-ID")})`,
      order_id: orderId,
    })

    console.log(`[Webhook] 💰 Shop ${shopId} +${shopEarnings} (komisi ${commission}) → ${newBalance}`)
  } catch (err) {
    console.error("[creditShopBalance] Error:", err)
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