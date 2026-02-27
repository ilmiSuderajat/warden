import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  const body = await req.json()

  // 1️⃣ Verifikasi Signature
  const signature = crypto
    .createHash('sha512')
    .update(
      body.order_id +
      body.status_code +
      body.gross_amount +
      process.env.MIDTRANS_SERVER_KEY
    )
    .digest('hex')

  if (signature !== body.signature_key) {
    return NextResponse.json({ message: "Invalid signature" }, { status: 403 })
  }

  const transactionStatus = body.transaction_status
  const orderId = body.order_id

  let paymentStatus = 'pending'
  let orderStatus = 'Menunggu Pembayaran'

  // 2️⃣ Mapping Status
  if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
    paymentStatus = 'paid'
    orderStatus = 'Perlu Dikemas'
  } 
  else if (transactionStatus === 'expire' || transactionStatus === 'cancel') {
    paymentStatus = 'cancelled'
    orderStatus = 'Menunggu Pembayaran'
  }

  // 3️⃣ Update Database
  const { error } = await supabase
    .from('orders')
    .update({
      payment_status: paymentStatus,
      status: orderStatus
    })
    .eq('id', orderId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ message: "OK" })
}