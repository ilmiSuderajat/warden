import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`

export async function POST(req: NextRequest) {
  try {
    const { userId, userName } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )

    // 1. Fetch chat history
    const { data: chatHistory } = await supabase
      .from("chats")
      .select("message, sender_type, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(30)

    // 2. Fetch user's orders
    const { data: orders } = await supabase
      .from("orders")
      .select("id, status, total_amount, created_at, customer_name, address, shipping_address, payment_status, payment_method")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5)

    // 3. Fetch user's order items (for recent orders)
    const orderIds = orders?.map(o => o.id) || []
    let orderItems: any[] = []
    if (orderIds.length > 0) {
      const { data: items } = await supabase
        .from("order_items")
        .select("product_name, quantity, price")
        .in("order_id", orderIds)
      orderItems = items || []
    }

    // 4. Fetch products (for stock inquiries)
    const { data: products } = await supabase
      .from("products")
      .select("name, price, stock, category")
      .order("stock", { ascending: true })
      .limit(20)

    // Build data context string
    const ordersText = orders?.length
      ? orders.map(o =>
          `- Order #${o.id.slice(0, 8)}: Status="${o.status}", Total=Rp${o.total_amount?.toLocaleString('id-ID')}, Pembayaran="${o.payment_status}", Metode="${o.payment_method}", Alamat="${o.shipping_address || o.address}", Tgl=${new Date(o.created_at).toLocaleDateString('id-ID')}`
        ).join("\n")
      : "Belum ada pesanan."

    const productsText = products?.length
      ? products.map(p =>
          `- ${p.name}: Harga=Rp${Number(p.price).toLocaleString('id-ID')}, Stok=${p.stock}`
        ).join("\n")
      : "Data produk tidak tersedia."

    const orderItemsText = orderItems.length
      ? orderItems.map(i => `  * ${i.product_name} x${i.quantity} @ Rp${Number(i.price).toLocaleString('id-ID')}`).join("\n")
      : ""

    // Build conversation history for gemini
    const conversationHistory = chatHistory?.map(m => ({
      role: m.sender_type === "user" ? "user" : "model",
      parts: [{ text: m.message }]
    })) || []

    // Get the last message from user (most recent)
    const lastUserMsg = chatHistory?.filter(m => m.sender_type === "user").pop()
    if (!lastUserMsg) {
      return NextResponse.json({ reply: "Halo! Ada yang bisa kami bantu?" })
    }

    const systemPrompt = `Kamu adalah customer service AI untuk toko online "Warung Kita" — toko yang menjual produk fashion/apparel.  
Nama pelanggan yang sedang kamu layani adalah: ${userName || "Pelanggan"}.

Panduan berbicara:
- Gunakan bahasa Indonesia yang ramah, santai tapi tetap sopan, seperti CS manusia sungguhan.
- Jangan pernah menyebut dirimu AI atau bot. Kamu adalah "Tim Warung Kita CS".
- Jawab pertanyaan berdasarkan data yang tersedia. Jika tidak tahu, katakan akan dicek terlebih dahulu.
- Jika ada masalah pesanan, tunjukkan empati dan tawarkan solusi konkret.
- Balasan harus SINGKAT dan FOKUS ke poin utama (maks 4-5 kalimat).

DATA PESANAN PELANGGAN INI:
${ordersText}

ITEM PESANAN:
${orderItemsText || "Tidak ada detail item."}

DATA PRODUK (STOK SAAT INI):
${productsText}

Balas pesan terakhir dari pelanggan secara natural dan sesuai konteks di atas.`

    // Gemini API call
    const geminiBody = {
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: conversationHistory,
      generationConfig: {
        temperature: 0.85,
        maxOutputTokens: 256,
        topP: 0.95,
      }
    }

    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody)
    })

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      console.error("Gemini API Error:", errText)
      return NextResponse.json({ error: "Gemini API gagal" }, { status: 500 })
    }

    const geminiData = await geminiRes.json()
    const reply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Maaf, ada kendala teknis. Kami akan segera membalas."

    return NextResponse.json({ reply })
  } catch (err) {
    console.error("AI Chat Error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
