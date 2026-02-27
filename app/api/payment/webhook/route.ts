import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  const body = await req.json();
  
  // 1. Verifikasi Signature (Keamanan)
  const signature = crypto
    .createHash('sha512')
    .update(body.order_id + body.status_code + body.gross_amount + process.env.MIDTRANS_SERVER_KEY)
    .digest('hex');

  if (signature !== body.signature_key) {
    return NextResponse.json({ message: "Invalid signature" }, { status: 403 });
  }

  const status = body.transaction_status;
  const orderId = body.order_id;
  let paymentStatus = 'pending';

  if (status === 'settlement' || status === 'capture') {
    paymentStatus = 'paid';
  } else if (status === 'expire' || status === 'cancel') {
    paymentStatus = 'cancelled';
  }

  // 2. Update Database
  const { error } = await supabase
    .from('orders')
    .update({ payment_status: paymentStatus })
    .eq('id', orderId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ message: "OK" });
}