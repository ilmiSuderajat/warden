import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { dispatchOrder } from "@/lib/driverOrders"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const COMMISSION_RATE = 0.05 // 5%

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      fraud_status
    } = body

    // 🔐 1. Verifikasi Signature
    const serverKey = process.env.MIDTRANS_SERVER_KEY!
    const hash = crypto
      .createHash('sha512')
      .update(order_id + status_code + gross_amount + serverKey)
      .digest('hex')

    if (hash !== signature_key) {
      console.log("❌ Signature tidak valid")
      return NextResponse.json({ message: "Invalid signature" }, { status: 403 })
    }

    // 🧠 2. Extract real Order ID (remove timestamp suffix if present)
    const realOrderId = order_id.length > 36 ? order_id.substring(0, 36) : order_id

    console.log("🔔 Webhook received for order:", order_id)
    console.log("➡ Identified Real UUID:", realOrderId)
    console.log("➡ Status:", transaction_status)

    let paymentStatus = 'pending'
    let orderStatus = 'Menunggu Pembayaran'

    // 🧠 3. Mapping Status Midtrans
    if (transaction_status === 'capture') {
      if (fraud_status === 'challenge') {
        paymentStatus = 'pending'
        orderStatus = 'Menunggu Pembayaran'
      } else if (fraud_status === 'accept') {
        paymentStatus = 'paid'
        orderStatus = 'Mencari Kurir'
      }
    }

    if (transaction_status === 'settlement') {
      paymentStatus = 'paid'
      orderStatus = 'Mencari Kurir'
    }

    if (
      transaction_status === 'cancel' ||
      transaction_status === 'deny' ||
      transaction_status === 'expire'
    ) {
      paymentStatus = 'cancelled'
      orderStatus = 'Dibatalkan'
    }

    // 📦 4. Update Database
    const { error } = await supabase
      .from('orders')
      .update({
        payment_status: paymentStatus,
        status: orderStatus,
        payment_method: 'online'
      })
      .eq('id', realOrderId)

    if (error) {
      console.log("❌ DB Error:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 💰 5. Jika pembayaran berhasil, kredit saldo warung (dikurangi komisi 5%)
    if (paymentStatus === 'paid') {
      await creditShopBalance(realOrderId)
    }

    // 🚗 6. Trigger dispatcher
    if (orderStatus === 'Mencari Kurir') {
      await dispatchOrder(realOrderId)
    }

    console.log(`✅ Success updated order ${realOrderId} to ${paymentStatus}/${orderStatus}`)
    return NextResponse.json({ message: "OK" })

  } catch (err: any) {
    console.log("🔥 Webhook Crash:", err.message)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

/** Kredit saldo shop setelah pembayaran online berhasil (dikurangi komisi 5%) */
async function creditShopBalance(orderId: string) {
  try {
    // Ambil order beserta items untuk cari shop_id
    const { data: order } = await supabase
      .from('orders')
      .select('id, subtotal_amount, total_amount, order_items(*)')
      .eq('id', orderId)
      .single()

    if (!order) return

    const shopId = extractShopId(order.order_items)
    if (!shopId) {
      console.log(`[Webhook] Tidak menemukan shop_id untuk order ${orderId}`)
      return
    }

    // Ambil saldo terbaru shop
    const { data: shop } = await supabase
      .from('shops')
      .select('id, balance')
      .eq('id', shopId)
      .single()

    if (!shop) return

    const subtotal = order.subtotal_amount || order.total_amount || 0
    const commission = Math.round(subtotal * COMMISSION_RATE)
    const shopEarnings = subtotal - commission
    const newBalance = (shop.balance || 0) + shopEarnings

    // Update saldo shop
    await supabase
      .from('shops')
      .update({ balance: newBalance })
      .eq('id', shopId)

    // Insert log
    await supabase.from('shop_balance_logs').insert({
      shop_id: shopId,
      type: 'commission',
      amount: shopEarnings,
      balance_after: newBalance,
      description: `Pembayaran online pesanan #${orderId.slice(0, 8)} (komisi 5% = Rp ${commission.toLocaleString('id-ID')})`,
      order_id: orderId,
    })

    console.log(`💰 [Webhook] Shop ${shopId} balance += ${shopEarnings} (komisi ${commission}) → ${newBalance}`)
  } catch (err) {
    console.error('[creditShopBalance] Error:', err)
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