import { NextResponse } from "next/server"
import { getAuthenticatedUser, createAdminClient } from "@/lib/serverAuth"

export async function POST(req: Request) {
  const user = await getAuthenticatedUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { orderId } = await req.json()
  if (!orderId) return NextResponse.json({ error: "Order ID required" }, { status: 400 })

  const supabase = createAdminClient()

  const { data: order } = await supabase.from("orders")
    .select("id, status, user_id")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .eq("status", "Dikirim")
    .maybeSingle()

  if (!order) return NextResponse.json({ error: "Pesanan tidak valid." }, { status: 404 })

  // UPDATE STATUS PESANAN
  await supabase.from("orders").update({ status: "Selesai" }).eq("id", orderId)

  // LOGIKA POIN: Ambil item pesanan dan hitung poin
  const { data: orderItems } = await supabase
    .from("order_items")
    .select("quantity, products(points_reward)")
    .eq("order_id", orderId)

  let earnedPoints = 0
  if (orderItems) {
    orderItems.forEach((item: any) => {
      const reward = item.products?.points_reward || 0
      earnedPoints += reward * item.quantity
    })
  }

  // TAMBAH POIN KE WALLET USER (Atomic increment)
  if (earnedPoints > 0) {
    await supabase.rpc('increment_wallet_points', { 
      p_user_id: user.id, 
      p_amount: earnedPoints 
    })
  }

  return NextResponse.json({ success: true, earnedPoints })
}
