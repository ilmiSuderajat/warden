import { NextResponse } from "next/server"
import { getAuthenticatedUser, createAdminClient } from "@/lib/serverAuth"
import { createNotification } from "@/lib/notifications"

/**
 * POST /api/orders/create
 * Server-side order creation that handles all columns including
 * customer_note, final_price, variants, image_url (admin bypasses RLS).
 */
export async function POST(req: Request) {
    try {
        const user = await getAuthenticatedUser()
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const body = await req.json()
        const {
            customer_name,
            whatsapp_number,
            address,
            latitude,
            longitude,
            maps_link,
            subtotal_amount,
            shipping_amount,
            distance_km,
            total_amount,
            voucher_code,
            discount_amount,
            customer_note,
            items,  // array of order_items to insert
            shop_id,
        } = body

        const supabase = createAdminClient()

        // Verify cart is not empty before creating order (prevents double checkout)
        const { data: cartData, error: cartErr } = await supabase
            .from("cart")
            .select("id")
            .eq("user_id", user.id)
            .limit(1)

        if (cartErr || !cartData || cartData.length === 0) {
            return NextResponse.json({ error: "Keranjang kosong atau pesanan sudah pernah diproses." }, { status: 400 })
        }

        // Insert order (admin client bypasses RLS and column restrictions)
        const { data: order, error: orderErr } = await supabase
            .from("orders")
            .insert({
                customer_name,
                whatsapp_number,
                address,
                latitude,
                longitude,
                maps_link,
                subtotal_amount,
                shipping_amount,
                distance_km,
                total_amount,
                status: "Menunggu Pembayaran",
                payment_status: "pending",
                user_id: user.id,
                voucher_code: voucher_code || null,
                discount_amount: discount_amount || 0,
                customer_note: customer_note || null,
            } as any)
            .select()
            .single()

        if (orderErr || !order) {
            console.error("[Create Order] Error:", orderErr)
            return NextResponse.json({ error: orderErr?.message || "Gagal membuat pesanan." }, { status: 500 })
        }

        // Insert order items
        const itemsToInsert = items.map((item: any) => ({
            order_id: order.id,
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            price: item.price,
            final_price: item.final_price,
            variants: item.variants || null,
            image_url: item.image_url || null,
        }))

        const { error: itemsErr } = await supabase.from("order_items").insert(itemsToInsert as any)

        if (itemsErr) {
            // Rollback
            await supabase.from("orders").delete().eq("id", order.id)
            return NextResponse.json({ error: "Gagal finalisasi item: " + itemsErr.message }, { status: 500 })
        }

        // Clear cart
        await supabase.from("cart").delete().eq("user_id", user.id)

        // Notify user
        await createNotification({
            userId: user.id,
            type: 'order',
            title: 'Pesanan Berhasil Dibuat',
            message: `Pesanan #${order.id.slice(0, 8)} berhasil dibuat. Silakan selesaikan pembayaran.`,
            link: `/checkout/payment?order_id=${order.id}`
        })

        // Notify shop
        if (shop_id) {
            const { data: shop } = await supabase.from("shops").select("owner_id").eq("id", shop_id).single()
            if (shop) {
                await createNotification({
                    userId: shop.owner_id,
                    type: 'order',
                    title: 'Pesanan Baru Menunggu Pembayaran',
                    message: `Ada pesanan baru #${order.id.slice(0, 8)} yang menunggu pembayaran dari pelanggan.`,
                    forShop: true,
                    link: `/shop/orders/${order.id}`
                })
            }
        }

        return NextResponse.json({ success: true, orderId: order.id })
    } catch (err: any) {
        console.error("[Create Order Error]", err)
        return NextResponse.json({ error: "Terjadi kesalahan internal." }, { status: 500 })
    }
}
