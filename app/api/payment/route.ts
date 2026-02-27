import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
const Midtrans = require('midtrans-client');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

const snap = new Midtrans.Snap({
  isProduction: false,
  serverKey: process.env.MIDTRANS_SERVER_KEY,
  clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY
});

export async function POST(req: Request) {
  try {
    const { orderId } = await req.json();

    const { data: order, error: dbError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (dbError || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const parameter = {
      transaction_details: {
        order_id: order.id,
        gross_amount: order.total_amount,
      },
      customer_details: {
        first_name: order.customer_name,
        phone: order.whatsapp_number,
        email: "customer@example.com"
      },
      // Penting: Hapus callbacks jika kamu ingin setting via Dashboard Midtrans (lebih aman)
    };

    const transaction = await snap.createTransaction(parameter);
    return NextResponse.json({ token: transaction.token });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}