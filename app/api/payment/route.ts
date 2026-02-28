// app/api/payment/cod/route.ts
// ✅ Semua logika update status COD dipindah ke sini (server-side)

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

const isValidUUID = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { orderId } = body

    // ✅ 1. Validasi format UUID
    if (!orderId || !isValidUUID(orderId)) {
      return NextResponse.json({ error: "Order ID tidak valid." }, { status: 400 })
    }

    const cookieStore = await cookies()

    // ✅ 2a. Auth client (anon key) — hanya untuk verifikasi sesi user
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => { }, // read-only di route handler
        },
      }
    )

    const { data: { session } } = await supabaseAuth.auth.getSession()

    // ✅ 3. Tolak request jika tidak ada sesi aktif
    if (!session) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    // ✅ 2b. Admin client (service_role) — untuk bypass RLS saat update
    //    SUPABASE_SERVICE_ROLE_KEY hanya ada di server, TIDAK pernah ke client
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

    // ✅ 4. Ambil order dan verifikasi kepemilikan (cegah IDOR)
    const { data: order, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select("id, payment_status, user_id")
      .eq("id", orderId)
      .eq("user_id", session.user.id) // ✅ Harus milik user yang login
      .maybeSingle()

    if (fetchError || !order) {
      return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 })
    }

    // ✅ 5. Hanya izinkan jika status masih "pending"
    if (order.payment_status !== "pending") {
      return NextResponse.json({ error: "Pesanan sudah diproses." }, { status: 409 })
    }

    // ✅ 6. Update status dengan double-check kepemilikan
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({ payment_status: "processing" })
      .eq("id", orderId)
      .eq("user_id", session.user.id)

    if (updateError) throw updateError

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error("[COD Payment Error]", err)
    return NextResponse.json({ error: "Terjadi kesalahan server." }, { status: 500 })
  }
}