import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
    // Format: UUID (36 chars) + optional suffix "-timestamp"
    const realOrderId = order_id.length > 36 ? order_id.substring(0, 36) : order_id;

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
        orderStatus = 'Perlu Dikemas'
      }
    }

    if (transaction_status === 'settlement') {
      paymentStatus = 'paid'
      orderStatus = 'Perlu Dikemas'
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
        payment_method: 'online' // Pastikan terupdate jika via webhook
      })
      .eq('id', realOrderId)

    if (error) {
      console.log("❌ DB Error:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log(`✅ Success updated order ${realOrderId} to ${paymentStatus}/${orderStatus}`)
    return NextResponse.json({ message: "OK" })

  } catch (err: any) {
    console.log("🔥 Webhook Crash:", err.message)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}