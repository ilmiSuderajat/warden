import { NextResponse } from "next/server"
import Midtrans from "midtrans-client"
import { getAuthenticatedUser, createAdminClient } from "@/lib/serverAuth"

const isValidUUID = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

const snap = new Midtrans.Snap({
  isProduction: false,
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
  clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY!,
})

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
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .eq("user_id", user.id)   // ✅ ownership enforcement
      .maybeSingle()

    if (orderError || !order) {
      console.warn(`[Payment] Order not found or access denied. order=${orderId} user=${user.id}`)
      if (orderError) console.error(`[Payment] Supabase Error:`, orderError)

      // Generic message — do not reveal whether order exists but belongs to someone else
      return NextResponse.json({
        error: "Pesanan tidak ditemukan.",
        debug: process.env.NODE_ENV === 'development' ? { orderId, userId: user.id } : undefined
      }, { status: 404 })
    }

    // ── 3. Prevent re-processing ──────────────────────────────────
    if (order.payment_status !== "pending") {
      return NextResponse.json({ error: "Pesanan ini sudah pernah diproses." }, { status: 409 })
    }

    // ── 4. Atomic lock: waiting_payment (prevents race condition) ─
    const { error: lockError } = await supabase
      .from("orders")
      .update({ payment_status: "waiting_payment" })
      .eq("id", orderId)
      .eq("payment_status", "pending")  // only update if still pending (atomic guard)

    if (lockError) {
      console.error(`[Payment] Lock failed for order ${orderId}:`, lockError)
      return NextResponse.json({ error: "Pesanan sedang diproses, coba beberapa saat lagi." }, { status: 409 })
    }

    // ── 5. Recalculate total server-side (NEVER trust client data) ─
    //    Use final_price (includes variant addon) per item
    const itemDetails = order.order_items.map((item: any) => ({
      id: item.id.toString(),
      price: Math.round(Number(item.final_price ?? item.price)),
      quantity: Math.round(Number(item.quantity)),
      name: (item.product_name ?? "Produk").slice(0, 50),
    }))

    const shippingFee = order.shipping_amount ? Math.round(Number(order.shipping_amount)) : 0
    if (shippingFee > 0) {
      itemDetails.push({ id: "shipping-fee", price: shippingFee, quantity: 1, name: "Ongkos Kirim" })
    }

    const discountAmount = order.discount_amount ? Math.round(Number(order.discount_amount)) : 0
    if (discountAmount > 0) {
      itemDetails.push({ id: "discount", price: -discountAmount, quantity: 1, name: "Diskon Voucher" })
    }

    const recalculatedTotal = itemDetails.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0
    )

    console.log(`[Payment] Order ${orderId}: recalculated=${recalculatedTotal}, db_total=${order.total_amount}`)

    // ── 6. Build Midtrans order ID (short enough, unique, traceable) ─
    //    Format: 16 hex chars from UUID + timestamp = max 30 chars
    const midtransOrderId = `${orderId.replace(/-/g, "").substring(0, 16)}-${Date.now()}`

    const parameter = {
      transaction_details: {
        order_id: midtransOrderId,
        gross_amount: recalculatedTotal,
      },
      customer_details: {
        first_name: order.customer_name ?? "Customer",
        phone: order.whatsapp_number ?? "",
      },
      item_details: itemDetails,
    }

    // ── 7. Create Snap token (server-side only, never expose server key) ─
    let transaction: any
    try {
      transaction = await snap.createTransaction(parameter)
    } catch (midError: any) {
      // Rollback lock on Midtrans failure so user can retry
      await supabase
        .from("orders")
        .update({ payment_status: "pending" })
        .eq("id", orderId)

      // Log full error server-side only, never expose to client
      console.error(`[Payment] Midtrans error for order ${orderId}:`, midError.message)
      return NextResponse.json(
        { error: "Gagal menghubungi payment gateway. Silakan coba beberapa saat lagi." },
        { status: 502 }
      )
    }

    // ── 8. Persist Midtrans order ID → enables reliable status polling ─
    await supabase
      .from("orders")
      .update({
        payment_method: "online",
        midtrans_order_id: midtransOrderId,
      })
      .eq("id", orderId)

    console.log(`[Payment] ✅ Snap token created. order=${orderId}, midtrans_id=${midtransOrderId}`)

    // Return only the token — never return server-side data to client
    return NextResponse.json({ token: transaction.token })

  } catch (err: any) {
    console.error("[Payment] Unexpected error:", err)
    return NextResponse.json(
      { error: "Terjadi kesalahan saat memproses pembayaran." },
      { status: 500 }
    )
  }
}