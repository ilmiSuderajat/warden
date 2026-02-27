// app/api/payment/route.ts

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
const Midtrans = require('midtrans-client');

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderId } = body;

    console.log("Memproses Order ID:", orderId);

    if (!process.env.MIDTRANS_SERVER_KEY) {
      throw new Error("MIDTRANS_SERVER_KEY tidak ditemukan di env");
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // Gunakan Service Role untuk operasi server-side
    );

    const snap = new Midtrans.Snap({
      isProduction: false,
      serverKey: process.env.MIDTRANS_SERVER_KEY,
    });

    const { data: order, error: dbError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (dbError || !order) {
      return NextResponse.json({ error: "Pesanan tidak ditemukan" }, { status: 404 });
    }

    const parameter = {
      transaction_details: {
        order_id: order.id,
        gross_amount: Math.round(order.total_amount),
      },
      // --- TAMBAHKAN BAGIAN INI UNTUK MENGATASI EXAMPLE.COM ---
  callbacks: {
    finish: "http://warden-blond.vercel.app/checkout/success", // Akan dipanggil jika 200 (Settlement)
    unfinish: "http://warden-blond.vercel.app/orders",         // Akan dipanggil jika 201 (Pending/Close)
    error: "http://warden-blond.vercel.app/orders"             // Akan dipanggil jika gagal
  },
      customer_details: {
        first_name: order.customer_name,
        phone: order.whatsapp_number,
        email: "customer@example.com"
      }
    };

    const transaction = await snap.createTransaction(parameter);
    return NextResponse.json({ token: transaction.token });

  } catch (error: any) {
    console.error("DETEKSI ERROR API:", error.message);
    return NextResponse.json({ 
      error: error.message || "Internal Server Error" 
    }, { status: 500 });
  }
}