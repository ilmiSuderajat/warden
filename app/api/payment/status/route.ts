import { NextResponse } from "next/server"
import Midtrans from "midtrans-client"
import { getAuthenticatedUser, createAdminClient } from "@/lib/serverAuth"

const isValidUUID = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

const snap = new Midtrans.Snap({
  isProduction: true,
  serverKey: process.env.MIDTRANS_SERVER_KEY!,
  clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY!,
})

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { orderId } = body

    if (!orderId || !isValidUUID(orderId)) {
      return NextResponse.json({ error: "Order ID tidak valid." }, { status: 400 })
    }

    // ── 1. Auth: verify identity ──────────────────────────────────
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    const supabase = createAdminClient()

    // ── 2. Fetch order with ownership check ───────────────────────
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, payment_status, midtrans_order_id")
      .eq("id", orderId)
      .eq("user_id", user.id)  // ✅ ownership enforcement
      .maybeSingle()

    if (orderError || !order) {
      return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 })
    }

    // ── 3. Short-circuit if already paid ─────────────────────────
    if (order.payment_status === "paid") {
      return NextResponse.json({
        success: true,
        message: "Pembayaran sudah terverifikasi.",
        status: "paid",
      })
    }

    // ── 4. Require midtrans_order_id to query Midtrans ────────────
    if (!order.midtrans_order_id) {
      return NextResponse.json({
        success: false,
        message: "Transaksi belum diinisiasi. Silakan klik 'Bayar Sekarang' terlebih dahulu.",
        status: order.payment_status,
      })
    }

    // ── 5. Query Midtrans for live status ─────────────────────────
    let statusResponse: any
    try {
      statusResponse = await snap.transaction.status(order.midtrans_order_id)
    } catch (err: any) {
      console.warn(`[Status] Midtrans query failed for ${order.midtrans_order_id}:`, err.message)
      return NextResponse.json({
        success: false,
        message: "Belum ada update dari payment gateway. Coba beberapa saat lagi.",
        status: order.payment_status,
      })
    }

    const transactionStatus = statusResponse.transaction_status
    console.log(`[Status] Order ${orderId} → Midtrans: ${transactionStatus}`)

    // ── 6. Map status ─────────────────────────────────────────────
    let paymentStatus = order.payment_status
    let orderStatus = "Menunggu Pembayaran"

    if (transactionStatus === "settlement" || transactionStatus === "capture") {
      paymentStatus = "paid"
      orderStatus = "Mencari Kurir"
    } else if (transactionStatus === "cancel" || transactionStatus === "deny") {
      paymentStatus = "failed"
      orderStatus = "Dibatalkan"
    } else if (transactionStatus === "expire") {
      paymentStatus = "expired"
      orderStatus = "Dibatalkan"
    }

    // ── 7. Sync DB only on state change ──────────────────────────
    if (paymentStatus !== order.payment_status) {
      const updatePayload: Record<string, any> = {
        payment_status: paymentStatus,
        status: orderStatus,
        payment_method: "online",
      }
      if (paymentStatus === "paid") {
        updatePayload.paid_at = new Date().toISOString()
      }

      await supabase
        .from("orders")
        .update(updatePayload)
        .eq("id", orderId)
    }

    return NextResponse.json({
      success: paymentStatus === "paid",
      message:
        paymentStatus === "paid"
          ? "Pembayaran terverifikasi!"
          : `Status saat ini: ${transactionStatus}`,
      status: paymentStatus,
    })

  } catch (err: any) {
    console.error("[Status Check Error]", err)
    return NextResponse.json(
      { error: "Gagal memeriksa status pembayaran." },
      { status: 500 }
    )
  }
}
