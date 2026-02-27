import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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

    let paymentStatus = 'pending'
    let orderStatus = 'Menunggu Pembayaran'

    // 🧠 2. Mapping Status Midtrans
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

    console.log("✅ Update Order:", order_id)
    console.log("➡ Payment:", paymentStatus)
    console.log("➡ Status:", orderStatus)

    // 📦 3. Update Database
    const { error } = await supabase
      .from('orders')
      .update({
        payment_status: paymentStatus,
        status: orderStatus
      })
      .eq('id', order_id)

    if (error) {
      console.log("❌ DB Error:", error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: "OK" })

  } catch (err: any) {
    console.log("🔥 Webhook Crash:", err.message)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}