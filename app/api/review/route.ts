import { NextResponse } from "next/server"
import { getAuthenticatedUser, createAdminClient } from "@/lib/serverAuth"

interface ReviewItem {
  productId: string
  rating: number
  comment: string
  photoUrl: string | null
  existingId?: string
}

/**
 * POST /api/review
 * Submit ulasan produk menggunakan service role (bypass RLS)
 * Body: { orderId: string, reviewerName: string, reviews: ReviewItem[] }
 */
export async function POST(req: Request) {
  try {
    // 1. Auth check
    const user = await getAuthenticatedUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { orderId, reviewerName, reviews } = body as {
      orderId: string
      reviewerName: string
      reviews: ReviewItem[]
    }

    if (!orderId || !reviews?.length) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 2. Verify user owns this order
    const { data: order } = await supabase
      .from("orders")
      .select("id, user_id")
      .eq("id", orderId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (!order) {
      return NextResponse.json({ error: "Order tidak ditemukan" }, { status: 404 })
    }

    // 3. Process each review (insert new / update existing)
    const errors: string[] = []

    for (const rev of reviews) {
      const reviewData = {
        product_id: rev.productId,
        user_id: user.id,
        order_id: orderId,
        rating: Math.max(1, Math.min(5, Math.round(rev.rating))),
        comment: rev.comment?.slice(0, 1000) ?? null,
        reviewer_name: reviewerName?.slice(0, 100) || "Pembeli",
        photo_url: rev.photoUrl ?? null,
      }

      if (rev.existingId) {
        // Update existing review (verify ownership via user_id)
        const { error } = await supabase
          .from("product_reviews")
          .update(reviewData)
          .eq("id", rev.existingId)
          .eq("user_id", user.id)

        if (error) {
          console.error(`[Review] Update error for product ${rev.productId}:`, error.message)
          errors.push(rev.productId)
        }
      } else {
        // Insert new review — upsert on unique(product_id, order_id, user_id) to prevent duplicates
        const { error } = await supabase
          .from("product_reviews")
          .upsert(reviewData, { onConflict: "product_id,order_id,user_id" })

        if (error) {
          console.error(`[Review] Insert error for product ${rev.productId}:`, error.message)
          errors.push(rev.productId)
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Beberapa ulasan gagal disimpan", failedProducts: errors },
        { status: 500 }
      )
    }

    console.log(`[Review] ✅ ${reviews.length} review(s) submitted for order ${orderId} by user ${user.id}`)
    return NextResponse.json({ success: true })

  } catch (err: any) {
    console.error("[Review] Error:", err)
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 })
  }
}
