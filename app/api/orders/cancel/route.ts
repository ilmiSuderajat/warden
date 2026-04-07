import { NextResponse } from "next/server"
import { getAuthenticatedUser, createAdminClient } from "@/lib/serverAuth"
import { createNotification } from "@/lib/notifications"

/**
 * POST /api/orders/cancel
 * Cancels an order and issues a refund if the order was paid via Wallet.
 *
 * Body: { orderId: string, reason: string }
 */
export async function POST(req: Request) {
  try {
    const user = await getAuthenticatedUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { orderId, reason } = await req.json()
    if (!orderId) return NextResponse.json({ error: "orderId wajib diisi" }, { status: 400 })
    if (!reason?.trim()) return NextResponse.json({ error: "Alasan pembatalan wajib diisi" }, { status: 400 })

    const supabase = createAdminClient()

    // 1. Fetch the order to verify ownership and current state
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, user_id, status, payment_status, total_amount, is_refunded")
      .eq("id", orderId)
      .single()

    if (orderErr || !order) {
      return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 })
    }

    if (order.user_id !== user.id) {
      return NextResponse.json({ error: "Anda tidak berhak membatalkan pesanan ini" }, { status: 403 })
    }

    if (order.status === "Dibatalkan") {
      return NextResponse.json({ error: "Pesanan sudah dibatalkan sebelumnya" }, { status: 400 })
    }

    if (order.status === "Selesai") {
      return NextResponse.json({ error: "Pesanan yang sudah selesai tidak bisa dibatalkan" }, { status: 400 })
    }

    const nonCancellable = ["Dikirim", "Kurir di Lokasi", "Kurir Menuju Lokasi"]
    if (nonCancellable.includes(order.status)) {
      return NextResponse.json({ error: `Pesanan dengan status "${order.status}" tidak bisa dibatalkan` }, { status: 400 })
    }

    // 2. Mark order as cancelled
    const { error: cancelErr } = await supabase
      .from("orders")
      .update({
        status: "Dibatalkan",
        canceled_by: "user",
        cancel_reason: reason,
        canceled_at: new Date().toISOString(),
      })
      .eq("id", orderId)

    if (cancelErr) {
      console.error("[Cancel Order] Error cancelling:", cancelErr)
      return NextResponse.json({ error: "Gagal membatalkan pesanan: " + cancelErr.message }, { status: 500 })
    }

    // 3. Issue refund if order was paid via Wallet and not yet refunded
    if (order.payment_status === "paid" && !order.is_refunded) {
      try {
        // Check if a wallet payment transaction exists for this order
        const { data: paymentTx } = await supabase
          .from("transactions")
          .select("id, amount")
          .eq("order_id", orderId)
          .eq("type", "payment")
          .maybeSingle()

        // Only refund if there's actually a wallet payment
        if (paymentTx) {
          const refundAmount = order.total_amount

          // Get or create the wallet
          const { data: wallet } = await supabase
            .from("wallets")
            .select("balance")
            .eq("user_id", user.id)
            .maybeSingle()

          const currentBalance = Number(wallet?.balance ?? 0)
          const newBalance = currentBalance + Number(refundAmount)

          // Update wallet balance
          await supabase
            .from("wallets")
            .upsert({ user_id: user.id, balance: newBalance, updated_at: new Date().toISOString() })

          // Check if a refund transaction already exists (avoid duplicate)
          const { data: existingRefund } = await supabase
            .from("transactions")
            .select("id")
            .eq("order_id", orderId)
            .eq("type", "refund")
            .maybeSingle()

          if (!existingRefund) {
            // Get last transaction hash for chain
            const { data: lastTx } = await supabase
              .from("transactions")
              .select("hash")
              .eq("user_id", user.id)
              .order("seq", { ascending: false })
              .limit(1)
              .maybeSingle()

            const prevHash = lastTx?.hash ?? "GENESIS"

            // Create refund transaction record
            const hashInput = user.id + orderId + "refund" + refundAmount + prevHash
            const hashBuf = await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(hashInput)
            )
            const newHash = Array.from(new Uint8Array(hashBuf))
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("")

            await supabase.from("transactions").insert({
              user_id: user.id,
              order_id: orderId,
              type: "refund",
              amount: Number(refundAmount),
              balance_after: newBalance,
              description: `Refund pembatalan pesanan ${orderId.slice(0, 8).toUpperCase()}`,
              prev_hash: prevHash,
              hash: newHash,
            })
          }

          // Mark order as refunded
          await supabase.from("orders").update({ is_refunded: true }).eq("id", orderId)

          // Notify user: refund issued
          await createNotification({
            userId: user.id,
            type: 'finance',
            title: 'Refund Berhasil',
            message: `Dana Rp${Number(refundAmount).toLocaleString('id-ID')} dari pesanan #${orderId.slice(0, 8).toUpperCase()} telah dikembalikan ke Wallet Anda.`,
            link: '/wallet'
          })
        }
      } catch (refundErr: any) {
        // Log refund error but don't fail the whole cancel
        console.error("[Cancel Order] Refund error:", refundErr)
        // Insert into pending_refunds so admin can process it later
        await supabase.from("pending_refunds").upsert({
          order_id: orderId,
          last_error: refundErr.message,
        })
      }
    }

    // 4. Notify user: order cancelled
    await createNotification({
      userId: user.id,
      type: 'order',
      title: 'Pesanan Dibatalkan',
      message: `Pesanan #${orderId.slice(0, 8).toUpperCase()} telah dibatalkan. Alasan: ${reason}`,
      link: '/orders?tab=dibatalkan'
    })

    return NextResponse.json({ success: true, message: "Pesanan berhasil dibatalkan" })
  } catch (err: any) {
    console.error("[Cancel Order] Unexpected error:", err)
    return NextResponse.json({ error: "Terjadi kesalahan internal" }, { status: 500 })
  }
}
