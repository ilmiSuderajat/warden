import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import Midtrans from "midtrans-client"

const isValidUUID = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

const snap = new Midtrans.Snap({
  isProduction: false, // Sandbox
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

    const cookieStore = await cookies()

    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => { },
        },
      }
    )

    const { data: { session } } = await supabaseAuth.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    const supabaseAdmin = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll: () => [],
          setAll: () => { },
        },
      }
    )

    // 1. Ambil detail order
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*, order_items(*)")
      .eq("id", orderId)
      .eq("user_id", session.user.id)
      .maybeSingle()

    if (orderError || !order) {
      return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 })
    }

    if (order.payment_status !== "pending") {
      return NextResponse.json({ error: "Pesanan sudah diproses." }, { status: 409 })
    }

    // 2. Buat parameter Midtrans
    const parameter = {
      transaction_details: {
        order_id: order.id,
        gross_amount: order.total_amount,
      },
      customer_details: {
        first_name: order.customer_name,
        phone: order.whatsapp_number,
      },
      item_details: order.order_items.map((item: any) => ({
        id: item.id,
        price: item.price,
        quantity: item.quantity,
        name: item.product_name,
      })),
    }

    // Tambahkan biaya pengiriman sebagai item jika ada
    if (order.shipping_amount > 0) {
      (parameter.item_details as any[]).push({
        id: 'shipping-fee',
        price: order.shipping_amount,
        quantity: 1,
        name: 'Ongkos Kirim',
      })
    }

    // 3. Request Snap Token
    const transaction = await snap.createTransaction(parameter)

    // 4. Update order dengan payment_method online
    await supabaseAdmin
      .from("orders")
      .update({ payment_method: "online" })
      .eq("id", orderId)

    return NextResponse.json({ token: transaction.token })
  } catch (err: any) {
    console.error("[Midtrans Payment Error]", err)
    return NextResponse.json({ error: "Gagal memproses pembayaran Midtrans." }, { status: 500 })
  }
}