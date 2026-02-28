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
      console.error("[Payment API] Order not found or error:", orderError)
      return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 })
    }

    if (order.payment_status !== "pending") {
      return NextResponse.json({ error: "Pesanan sudah diproses." }, { status: 409 })
    }

    // 2. Buat parameter Midtrans (Gunakan ID asli sebagai basis)
    const itemDetails = order.order_items.map((item: any) => ({
      id: item.id.toString(),
      price: Math.round(Number(item.price)),
      quantity: Math.round(Number(item.quantity)),
      name: item.product_name.slice(0, 50),
    }))

    const shippingFee = order.shipping_amount ? Math.round(Number(order.shipping_amount)) : 0
    if (shippingFee > 0) {
      itemDetails.push({
        id: 'shipping-fee',
        price: shippingFee,
        quantity: 1,
        name: 'Ongkos Kirim',
      })
    }

    const itemsSum = itemDetails.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)

    // PENTING: Untuk testing, kita gunakan suffix. 
    // Tapi kita SIMPAN Midtrans ID ini ke kolom `payment_method` atau kolom khusus supaya bisa di-track saat polling.
    // Karena belum ada kolom khusus, kita taruh di log dulu.
    const midtransOrderId = `${order.id}-${Date.now()}`

    const parameter = {
      transaction_details: {
        order_id: midtransOrderId,
        gross_amount: itemsSum,
      },
      customer_details: {
        first_name: order.customer_name,
        phone: order.whatsapp_number,
      },
      item_details: itemDetails,
    }

    console.log("[Midtrans] Request Payload:", JSON.stringify(parameter, null, 2))

    // 3. Request Snap Token
    let transaction;
    try {
      transaction = await snap.createTransaction(parameter)
    } catch (midError: any) {
      console.error("[Midtrans API ERROR]:", midError.message)
      return NextResponse.json({
        error: "Gagal memproses pembayaran Midtrans.",
        details: midError.message,
        apiResponse: midError.ApiResponse
      }, { status: 500 })
    }

    // 4. Update order (Kita simpan ID Midtrans-nya di database agar bisa di-poll nanti jika perlu)
    // SEMENTARA kita update payment_method saja.
    await supabaseAdmin
      .from("orders")
      .update({ payment_method: "online" })
      .eq("id", orderId)

    return NextResponse.json({ token: transaction.token })
  } catch (err: any) {
    console.error("[Global API Error]", err)
    return NextResponse.json({ error: "Terjadi kesalahan internal." }, { status: 500 })
  }
}