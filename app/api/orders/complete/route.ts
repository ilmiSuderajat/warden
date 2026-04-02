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

  await supabase.from("orders").update({ status: "Selesai" }).eq("id", orderId)

  return NextResponse.json({ success: true })
}
