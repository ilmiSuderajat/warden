import { NextResponse } from "next/server"
import { getAuthenticatedUser, createAdminClient } from "@/lib/serverAuth"

/**
 * POST /api/review/photo
 * Upload foto ulasan ke Supabase Storage menggunakan service role (bypass RLS)
 * Body: FormData { file: File, orderId: string, productId: string }
 */
export async function POST(req: Request) {
  try {
    // 1. Auth check
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const orderId = formData.get("orderId") as string
    const productId = formData.get("productId") as string

    if (!file || !orderId || !productId) {
      return NextResponse.json({ error: "Field tidak lengkap" }, { status: 400 })
    }

    // 2. Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "File harus berupa gambar" }, { status: 400 })
    }

    // Max 2MB after compression (client already compressed to ~100KB, this is a safety net)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: "Ukuran file terlalu besar" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 3. Verify user owns this order
    const { data: order } = await supabase
      .from("orders")
      .select("id")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!order) {
      return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 })
    }

    // 4. Upload to Storage (service role bypasses all RLS)
    const ext = "jpg" // always jpeg (client compresses to jpeg)
    const path = `${user.id}/${orderId.slice(0, 8)}-${productId.slice(0, 8)}.${ext}`

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const { error: uploadErr } = await supabase.storage
      .from("review-photos")
      .upload(path, buffer, {
        contentType: "image/jpeg",
        upsert: true,
      })

    if (uploadErr) {
      console.error("[Review Photo] Upload error:", uploadErr.message)
      return NextResponse.json({ error: "Gagal menyimpan foto" }, { status: 500 })
    }

    const { data: urlData } = supabase.storage
      .from("review-photos")
      .getPublicUrl(path)

    return NextResponse.json({ url: urlData.publicUrl })
  } catch (err: any) {
    console.error("[Review Photo] Error:", err)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}
