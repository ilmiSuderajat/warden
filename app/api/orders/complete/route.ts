import { NextResponse } from "next/server"
import { getAuthenticatedUser, createAdminClient } from "@/lib/serverAuth"
import { createNotification } from "@/lib/notifications"

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

  // Send Notifications
  // To User
  await createNotification({
    userId: user.id,
    type: 'order',
    title: 'Pesanan Selesai',
    message: `Pesanan #${orderId.slice(0, 8)} telah selesai. Terima kasih telah berbelanja!`,
    link: `/orders/${orderId}`
  })

  // LOGIKA POIN & NOTIF: Ambil item pesanan
  const { data: orderItems } = await supabase
    .from("order_items")
    .select("product_name, quantity, products(points_reward)")
    .eq("order_id", orderId)
  
  let earnedPoints = 0
  if (orderItems) {
    // 1. Send Notification to Shop
    const extractShopId_internal = (items: any[]) => {
        for (const item of items) {
            const parts = item.product_name?.split(" | ")
            if (parts && parts.length >= 2) {
                const potentialId = parts[parts.length - 1].trim()
                if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(potentialId)) {
                    return potentialId
                }
            }
        }
        return null
    }
    const shopId = extractShopId_internal(orderItems)
    if (shopId) {
        const { data: shop } = await supabase.from("shops").select("owner_id").eq("id", shopId).single()
        if (shop) {
            await createNotification({
                userId: shop.owner_id,
                type: 'order',
                title: 'Pesanan Selesai',
                message: `Pesanan #${orderId.slice(0, 8)} telah diselesaikan oleh pembeli.`,
                forShop: true,
                link: `/shop/orders/${orderId}`
            })
        }
    }

    // 2. Hitung Poin
    orderItems.forEach((item: any) => {
      const reward = item.products?.points_reward || 0
      earnedPoints += reward * item.quantity
    })

    // TAMBAH POIN KE WALLET USER (Atomic increment)
    if (earnedPoints > 0) {
      await supabase.rpc('increment_wallet_points', { 
        p_user_id: user.id, 
        p_amount: earnedPoints 
      })
    }
  }

  return NextResponse.json({ success: true, earnedPoints })
}
