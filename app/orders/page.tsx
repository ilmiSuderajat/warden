"use client"

import { useState, useEffect, Suspense } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { cancelOrder } from "@/lib/wallet"
import * as Icons from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import Skeleton from "@/app/components/Skeleton"

/** Compress image to under maxKB using Canvas (client-side only) */
async function compressImage(file: File, maxKB = 100): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const canvas = document.createElement("canvas")
      let { width, height } = img
      const MAX_PX = 1200
      if (width > MAX_PX || height > MAX_PX) {
        const ratio = Math.min(MAX_PX / width, MAX_PX / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")!
      ctx.fillStyle = "#fff"
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)
      let quality = 0.85
      const tryCompress = (): void => {
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error("Compression failed")); return }
          if (blob.size <= maxKB * 1024 || quality <= 0.05) {
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }))
          } else {
            quality = Math.max(0.05, quality - 0.1)
            tryCompress()
          }
        }, "image/jpeg", quality)
      }
      tryCompress()
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Gagal memuat gambar")) }
    img.src = objectUrl
  })
}

// ─── STATUS CONFIG ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  "Menunggu Pembayaran": { label: "Belum Bayar", color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-100", dot: "bg-indigo-500" },
  "Perlu Dikemas": { label: "Dikemas", color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-100", dot: "bg-indigo-500" },
  "Diproses": { label: "Diproses", color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-100", dot: "bg-indigo-500" },
  "Mencari Kurir": { label: "Mencari Kurir", color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-100", dot: "bg-indigo-500" },
  "Kurir Menuju Lokasi": { label: "Kurir Menuju", color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-100", dot: "bg-indigo-500" },
  "Kurir di Toko": { label: "Kurir di Toko", color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-100", dot: "bg-indigo-500" },
  "Dikirim": { label: "Dikirim", color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-100", dot: "bg-indigo-500" },
  "Kurir di Lokasi": { label: "Tiba", color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-100", dot: "bg-indigo-500" },
  "Selesai": { label: "Selesai", color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-100", dot: "bg-indigo-500" },
  "Pengembalian": { label: "Pengembalian", color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200", dot: "bg-indigo-400" },
  "Dibatalkan": { label: "Dibatalkan", color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200", dot: "bg-indigo-400" },
  "Kurir Tidak Tersedia": { label: "Kurir N/A", color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-100", dot: "bg-indigo-500" },
}

function getStatusDisplay(order: any) {
  const isUnpaid = order.payment_status === "pending" || order.status === "Menunggu Pembayaran"
  const key = isUnpaid ? "Menunggu Pembayaran" : order.status
  return STATUS_CONFIG[key] ?? { label: order.status, color: "text-slate-500", bg: "bg-slate-50 border-slate-200", dot: "bg-slate-400" }
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
function OrdersContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const tabFromUrl = searchParams.get("tab") || "all"
  const [activeTab, setActiveTab] = useState(tabFromUrl)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)

  // Review state
  const [reviewOrder, setReviewOrder] = useState<any>(null)
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [reviewsState, setReviewsState] = useState<Record<string, { rating: number; comment: string; photoFile?: File | null; photoPreview?: string }>>({})
  const [reviewerName, setReviewerName] = useState<string>("")

  // Cancel state
  const [cancelOrderObj, setCancelOrderObj] = useState<any>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [isCanceling, setIsCanceling] = useState(false)

  // Timer global untuk sinkronisasi waktu countdown bayar
  const [now, setNow] = useState(Date.now())

  // Interaktif States
  const [unreadCount, setUnreadCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [viewCancelReason, setViewCancelReason] = useState<string | null>(null)

  const activeOrderId = searchParams.get("active")

  useEffect(() => {
    const getUnread = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from("shop_conversations").select("unread_buyer").eq("buyer_id", user.id)
      if (data) setUnreadCount(data.reduce((acc, c) => acc + (c.unread_buyer || 0), 0))
    }
    getUnread()

    const timerId = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timerId)
  }, [])

  useEffect(() => {
    if (activeOrderId && orders.length > 0) setExpandedOrderId(activeOrderId)
  }, [activeOrderId, orders])

  useEffect(() => {
    const t = searchParams.get("tab") || "all"
    if (t !== activeTab) setActiveTab(t)
  }, [searchParams])

  useEffect(() => {
    setTimeout(() => {
      const el = document.getElementById(`tab-${activeTab}`)
      if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" })
    }, 50)
  }, [activeTab])

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId)
    setExpandedOrderId(null)
    const params = new URLSearchParams(searchParams.toString())
    if (tabId === "all") params.delete("tab")
    else params.set("tab", tabId)
    router.replace(`/orders?${params.toString()}`, { scroll: false })
  }

  const tabs = [
    { id: "all", label: "Semua" },
    { id: "pending", label: "Belum Bayar" },
    { id: "dikemas", label: "Dikemas" },
    { id: "dikirim", label: "Dikirim" },
    { id: "selesai", label: "Selesai" },
    { id: "pengembalian", label: "Pengembalian" },
    { id: "dibatalkan", label: "Dibatalkan" },
  ]

  useEffect(() => { fetchOrders() }, [activeTab])

  const fetchOrders = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push("/login")

    let query = supabase
      .from("orders")
      .select("*, order_items(*), driver_orders(delivery_photo_url)")
      .eq("user_id", user.id)

    if (activeTab === "pending") query = query.or("payment_status.eq.pending,status.eq.Menunggu Pembayaran")
    if (activeTab === "dikemas") query = query.eq("payment_status", "paid").in("status", ["Perlu Dikemas", "Diproses"])
    if (activeTab === "dikirim") query = query.in("status", ["Mencari Kurir", "Kurir Menuju Lokasi", "Kurir di Toko", "Dikirim", "Kurir di Lokasi", "Kurir Tidak Tersedia"])
    if (activeTab === "selesai") query = query.eq("status", "Selesai")
    if (activeTab === "pengembalian") query = query.eq("status", "Pengembalian")
    if (activeTab === "dibatalkan") query = query.eq("status", "Dibatalkan")

    const { data } = await query.order("created_at", { ascending: false })
    if (data) {
      const shopIds = [...new Set(data.flatMap(o => {
        const parts = o.order_items?.[0]?.product_name?.split(" | ")
        return parts && parts.length > 1 ? parts[1] : null
      }).filter(Boolean))] as string[];

      let shopMap: Record<string, { name: string, image: string }> = {}
      if (shopIds.length > 0) {
        const { data: shops } = await supabase.from("shops").select("id, name, image_url").in("id", shopIds)
        if (shops) shops.forEach(s => { shopMap[s.id] = { name: s.name, image: s.image_url } })
      }

      const ordersWithShops = data.map(o => {
        const parts = o.order_items?.[0]?.product_name?.split(" | ")
        const shopId = parts && parts.length > 1 ? parts[1] : null
        return {
          ...o,
          shop_name: shopId ? (shopMap[shopId]?.name || "Official Store") : "Official Store",
          shop_image_url: shopId ? shopMap[shopId]?.image : null
        }
      })
      setOrders(ordersWithShops)
    }
    setLoading(false)
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }) + " " + new Date(d).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })

  const completeOrder = async (order: any) => {
    const res = await fetch("/api/orders/complete", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id }),
    })
    if (!res.ok) { toast.error("Gagal menyelesaikan pesanan"); return }
    toast.success("Pesanan telah selesai! Terima kasih.")
    fetchOrders()
    openReviewModal(order)
  }

  const checkPaymentStatus = async (orderId: string) => {
    try {
      const response = await fetch("/api/payment/status", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      })
      const data = await response.json()
      if (data.success) { toast.success(data.message); fetchOrders() }
      else toast.error(data.message || data.error)
    } catch { toast.error("Gagal mengecek status. Silakan coba lagi nanti.") }
  }

  const openReviewModal = async (order: any) => {
    const initial: Record<string, any> = {}
    let hasReviewable = false
    order.order_items?.forEach((item: any) => {
      if (item.product_id) { initial[item.product_id] = { rating: 5, comment: "", photoFile: null, photoPreview: "" }; hasReviewable = true }
    })
    if (!hasReviewable) { toast.info("Pesanan ini adalah pesanan lama yang belum mendukung Ulasan Produk."); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: addr } = await supabase.from("addresses").select("name").eq("user_id", user.id).order("is_default", { ascending: false }).limit(1).maybeSingle()
      setReviewerName(addr?.name || order.customer_name || "Pembeli")
    }
    const { data: existing } = await supabase.from("product_reviews").select("id, product_id, rating, comment, photo_url").eq("order_id", order.id)
    if (existing) {
      existing.forEach((ex: any) => {
        if (initial[ex.product_id]) initial[ex.product_id] = { rating: ex.rating, comment: ex.comment || "", photoFile: null, photoPreview: ex.photo_url || "", id: ex.id }
      })
    }
    setReviewsState(initial)
    setReviewOrder(order)
  }

  const submitReviews = async () => {
    setIsSubmittingReview(true)
    try {
      const reviewPayload = await Promise.all(
        Object.entries(reviewsState).map(async ([productId, rev]: any) => {
          let photoUrl: string | null = rev.photoPreview || null
          if (rev.photoFile) {
            try {
              const compressed = await compressImage(rev.photoFile, 100)
              const fd = new FormData()
              fd.append("file", compressed); fd.append("orderId", reviewOrder.id); fd.append("productId", productId)
              const uploadRes = await fetch("/api/review/photo", { method: "POST", body: fd })
              const uploadData = await uploadRes.json()
              photoUrl = uploadRes.ok && uploadData.url ? uploadData.url : null
            } catch { photoUrl = null }
          }
          return { productId, rating: rev.rating, comment: rev.comment, photoUrl, existingId: rev.id || undefined }
        })
      )
      const res = await fetch("/api/review", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: reviewOrder.id, reviewerName, reviews: reviewPayload }),
      })
      const data = await res.json()
      if (!res.ok) toast.error(data.error || "Gagal mengirim ulasan.")
      else { toast.success("Terima kasih atas ulasan Anda! 🎉"); setReviewOrder(null) }
    } catch { toast.error("Terjadi kesalahan saat mengirim ulasan.") }
    finally { setIsSubmittingReview(false) }
  }

  const handleCancelOrder = async () => {
    if (!cancelReason.trim()) { toast.error("Alasan pembatalan wajib diisi"); return }
    setIsCanceling(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Unauthorized")
      const { error } = await supabase.rpc('cancel_order_by_user', { _order_id: cancelOrderObj.id, _reason: cancelReason, _user_id: user.id })
      if (error) throw new Error(error.message)
      toast.success("Pesanan berhasil dibatalkan")
      setCancelOrderObj(null); setCancelReason(""); fetchOrders()
    } catch (err: any) {
      if (err.message.includes("cancel_order_by_user")) {
        // Fallback to JS if RPC fails
        try {
          await cancelOrder(cancelOrderObj.id, cancelReason)
          toast.success("Pesanan berhasil dibatalkan")
          setCancelOrderObj(null); setCancelReason(""); fetchOrders()
        } catch (fallbackErr: any) {
          toast.error(fallbackErr.message || "Gagal membatalkan pesanan")
        }
      } else toast.error(err.message || "Gagal membatalkan pesanan")
    }
    finally { setIsCanceling(false) }
  }

  const isUnpaid = (order: any) => order.payment_status === "pending" || order.status === "Menunggu Pembayaran"
  const getTotalItems = (order: any) => order.order_items?.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0) || 0

  // ─── EXPANDED FULL SCREEN (RINCIAN PESANAN) ───────────────────
  if (expandedOrderId) {
    const details = orders.find(o => o.id === expandedOrderId)
    if (!details) { setExpandedOrderId(null); return null; }
    const isUnpaidOrder = isUnpaid(details)
    const statusLabel = STATUS_CONFIG[isUnpaidOrder ? "Menunggu Pembayaran" : details.status]?.label || details.status
    const isSelesai = details.status === "Selesai"
    const totalItems = getTotalItems(details)

    const expiryTimeDetail = new Date(details.created_at).getTime() + 10 * 60 * 1000
    const diffDetail = expiryTimeDetail - now
    const isTimeExpiredDetail = isUnpaidOrder && diffDetail <= 0

    return (
      <div className="min-h-screen bg-[#f5f5f5] font-sans max-w-md mx-auto pb-28">
        {/* Header */}
        <div className="bg-white sticky top-0 z-40 border-b border-slate-100 flex items-center px-4 h-14">
          <button onClick={() => setExpandedOrderId(null)} className="p-1 -ml-1 text-indigo-600 shrink-0">
            <Icons.ArrowLeft size={24} />
          </button>
          <h1 className="text-[17px] font-normal text-slate-800 ml-4 flex-1">Rincian Pesanan</h1>
        </div>

        {/* Green/Indigo Status Banner */}
        <div className="bg-indigo-600 px-4 py-4 text-white">
          <h2 className="text-base font-semibold">Pesanan {statusLabel}</h2>
        </div>

        {/* Payment Deadline Banner (for unpaid) */}
        {isUnpaidOrder && !isTimeExpiredDetail && (
          <div className="mx-4 mt-3 bg-indigo-50 border border-indigo-100/50 rounded flex items-center justify-between p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <Icons.Clock size={16} className="text-indigo-500 shrink-0" />
              <p className="text-[12px] text-indigo-700 font-medium">Selesaikan pembayaran dalam</p>
            </div>
            <p className="text-[14px] font-bold text-indigo-600 tabular-nums">
              {Math.max(0, Math.floor(diffDetail / 60000)).toString().padStart(2, '0')}:
              {Math.max(0, Math.floor((diffDetail % 60000) / 1000)).toString().padStart(2, '0')}
            </p>
          </div>
        )}
        {isUnpaidOrder && isTimeExpiredDetail && (
          <div className="mx-4 mt-3 bg-red-50 border border-red-100 rounded px-3 py-2.5 flex items-center gap-2 shadow-sm">
            <Icons.AlertCircle size={15} className="text-red-500 shrink-0" />
            <p className="text-[12px] text-red-700 font-medium">Batas waktu habis. Pesanan akan otomatis dibatalkan.</p>
          </div>
        )}

        {/* Info Pengiriman */}
        <div className="bg-white px-4 py-3 border-b border-slate-100 mt-2">
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-sm font-semibold text-slate-800">Info Pengiriman</h3>
            <Icons.ChevronRight size={16} className="text-slate-400" />
          </div>
          <p className="text-xs text-slate-500 mb-2">Kurir Instan: Kurir Warung Kita</p>
          <div className="flex gap-3">
            <Icons.Truck size={16} className="text-slate-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] text-indigo-600">
                {isUnpaidOrder ? "Menunggu proses pembayaran diselesaikan." :
                  details.status === 'Selesai' ? `Pesanan tiba di alamat tujuan. Diterima oleh ${details.customer_name}.` :
                    details.status === 'Dibatalkan' ? "Pesanan ini telah dibatalkan." :
                      details.status === 'Perlu Dikemas' ? "Pesanan sedang disiapkan oleh penjual." :
                        details.status === 'Mencari Kurir' ? "Menunggu Kurir Warung Kita menjemput pesanan." :
                          "Pesanan sedang dalam proses pengiriman via Kurir Warung Kita."}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(details.created_at)}</p>
            </div>
          </div>
        </div>

        {/* Alamat Pengiriman */}
        <div className="bg-white px-4 py-3 mb-2">
          <h3 className="text-sm font-semibold text-slate-800 mb-2">Alamat Pengiriman</h3>
          <div className="flex gap-3">
            <Icons.MapPin size={16} className="text-slate-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] text-slate-800">{details.customer_name} <span className="text-slate-500 font-normal ml-1">{details.whatsapp_number || details.phone_number}</span></p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{details.address}</p>
            </div>
          </div>
        </div>

        {/* Product Card */}
        <div className="bg-white pb-3">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <Icons.Store size={14} className="text-slate-500 shrink-0" />
            <span className="text-sm font-semibold text-slate-800 truncate flex-1">{details.shop_name || "Official Store"}</span>
            <Icons.ChevronRight size={16} className="text-slate-400" />
          </div>
          {details.order_items?.map((item: any, idx: number) => (
            <div key={idx} className="px-4 py-3 flex gap-3 bg-[#fafafa] border-b border-white">
              <img src={item.image_url || "/placeholder.png"} className="w-[72px] h-[72px] object-cover border border-slate-200" alt="product" />
              <div className="flex-1 min-w-0 flex flex-col justify-between">
                <p className="text-[13px] text-slate-800 line-clamp-2 leading-snug">{item.product_name?.split(" | ")[0]}</p>
                {/* We might add variant name or 'Bebas Pengembalian' badge here */}
              </div>
              <div className="text-right shrink-0 flex flex-col justify-between">
                <p className="text-[13px] text-slate-800 font-medium">Rp{item.price?.toLocaleString("id-ID")}</p>
                <p className="text-xs text-slate-500">x{item.quantity}</p>
              </div>
            </div>
          ))}
          <div className="px-4 py-3 bg-[#f8fbfa] border-b border-slate-100 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Icons.ShieldCheck size={16} className="text-indigo-500" />
              <div>
                <p className="text-[12px] font-medium text-slate-800">Proteksi Pesanan</p>
                <p className="text-[11px] text-indigo-600">Active till {(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)).toLocaleDateString('id-ID')}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <p className="text-[12px] text-slate-500">Rp2.000 x1</p>
            </div>
          </div>

          {/* Financials */}
          <div className="px-4 pt-4 pb-2 space-y-2.5">
            <div className="flex justify-between text-[13px] text-slate-500">
              <span>Subtotal Produk</span><span>Rp{details.subtotal_amount?.toLocaleString("id-ID")}</span>
            </div>
            <div className="flex justify-between text-[13px] text-slate-500">
              <span>Total Proteksi Produk</span><span>Rp2.000</span>
            </div>
            <div className="flex justify-between text-[13px] text-slate-500">
              <span>Subtotal Pengiriman</span><span>Rp{details.shipping_amount?.toLocaleString("id-ID")}</span>
            </div>
            <div className="flex justify-between text-[13px] text-slate-500">
              <span className="flex items-center gap-1">Diskon Pengiriman <Icons.Info size={11} /></span>
              <span>-Rp0</span>
            </div>
            <div className="flex justify-between text-[13px] text-slate-500">
              <span>Voucher Digunakan</span><span>-Rp{details.discount_amount?.toLocaleString("id-ID") || 0}</span>
            </div>
            <div className="flex justify-between text-[13px] text-slate-500">
              <span className="flex items-center gap-1">Biaya Layanan <Icons.Info size={11} /></span><span>Rp1.000</span>
            </div>
            <div className="pt-4 pb-2 flex justify-end items-center gap-2">
              <span className="text-[13px] text-slate-800">Total Pesanan:</span>
              <span className="text-[15px] font-bold text-indigo-600">Rp{(details.total_amount).toLocaleString("id-ID")}</span>
            </div>
          </div>
        </div>

        {/* Footer sticky detail button */}
        <div className="fixed bottom-0 w-full max-w-md bg-white border-t border-slate-100 p-3 flex gap-2 z-50">
          <button onClick={() => router.push(`/product/${details.order_items?.[0]?.product_id}`)} className="flex-1 py-2.5 border border-slate-300 rounded text-sm font-medium text-slate-700 bg-white shadow-sm">Beli Lagi</button>
          {isSelesai && <button className="flex-[1.5] py-2.5 border border-indigo-600 rounded text-sm font-medium text-indigo-600 bg-white shadow-sm" onClick={() => openReviewModal(details)}>Nilai</button>}
          {isUnpaidOrder && !isTimeExpiredDetail && <button className="flex-[1.5] py-2.5 bg-indigo-600 rounded text-sm font-medium text-white shadow-sm" onClick={() => router.push(`/checkout/payment?order_id=${details.id}`)}>Bayar Sekarang</button>}
        </div>
      </div>
    )
  }

  const displayedOrders = Array.isArray(orders) ? orders.filter(o => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return o.id.toLowerCase().includes(q) ||
      (o.shop_name || "").toLowerCase().includes(q) ||
      o.order_items?.some((i: any) => (i.product_name || "").toLowerCase().includes(q))
  }) : []

  // ─── MAIN LIST RENDERING (PESANAN SAYA) ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f5f5f5] font-sans max-w-md mx-auto pb-28">

      {/* Shopee Style Top Navbar */}
      <div className="bg-white sticky top-0 z-40">
        <div className="flex items-center gap-3 px-4 pt-12 pb-3 h-14">
          <button onClick={() => router.back()} className="p-1 -ml-1 text-indigo-600 shrink-0">
            <Icons.ArrowLeft size={24} strokeWidth={2} />
          </button>

          {isSearching ? (
            <div className="flex-1 flex gap-2 items-center">
              <input autoFocus type="text" placeholder="Cari nama pesanan atau toko..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full px-3 py-1.5 bg-slate-100 rounded text-[13px] outline-none text-slate-800" />
              <button onClick={() => { setIsSearching(false); setSearchQuery(''); }} className="text-[13px] text-slate-500 font-medium shrink-0">Batal</button>
            </div>
          ) : (
            <>
              <h1 className="text-[18px] font-medium text-slate-800 tracking-wide flex-1 px-2">Pesanan Saya</h1>
              <button onClick={() => setIsSearching(true)} className="p-1.5 text-indigo-600 relative">
                <Icons.Search size={22} strokeWidth={2} />
              </button>
            </>
          )}

          {!isSearching && (
            <button onClick={() => router.push('/chat')} className="p-1.5 -mr-1 text-indigo-600 relative">
              <Icons.MessageSquareMore size={22} strokeWidth={2} />
              {unreadCount > 0 && <span className="absolute top-0 right-0 w-[15px] h-[15px] bg-red-500 text-[9px] font-bold text-white flex items-center justify-center rounded-full shadow-sm border border-white">{unreadCount > 9 ? "9+" : unreadCount}</span>}
            </button>
          )}
        </div>

        {/* Scrollable Tabs */}
        <div className="flex overflow-x-auto no-scrollbar bg-white border-b border-slate-100 shadow-sm relative relative top-[30px] -mt-[30px]">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => handleTabChange(tab.id)}
                className={`flex-shrink-0 px-4 py-3.5 text-[14px] transition-all whitespace-nowrap relative ${isActive ? "text-indigo-600 font-medium" : "text-slate-600 font-normal hover:text-slate-800"
                  }`}
              >
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 left-[10%] w-[80%] h-[2px] bg-indigo-600 rounded-full" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Order List */}
      <div className="py-2 space-y-2 px-0 bg-[#f5f5f5]">
        {loading ? (
          <div className="space-y-2 px-3 pt-2">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="bg-white p-4">
                <div className="flex gap-3 mb-3">
                  <Skeleton className="w-16 h-16 shrink-0" />
                  <div className="flex-1 space-y-2 pt-1">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        ) : displayedOrders.length > 0 ? (
          displayedOrders.map((order: any) => {
            const unpaid = isUnpaid(order)
            const statusLabel = STATUS_CONFIG[unpaid ? "Menunggu Pembayaran" : order.status]?.label || order.status
            const firstItem = order.order_items?.[0]
            const itemCount = getTotalItems(order)

            // Logic timer bayar
            const expiryTime = new Date(order.created_at).getTime() + 10 * 60 * 1000
            const diff = expiryTime - now
            const isTimeExpired = unpaid && diff <= 0

            return (
              <div key={order.id} className="bg-white shadow-sm mt-2">
                {/* Card Header */}
                <div className="flex items-center gap-2 px-3 py-5 border-b border-slate-50">
                  {order.shop_image_url ? (
                    <img src={order.shop_image_url} className="w-4 h-4 rounded-full object-cover shrink-0" alt="shop" />
                  ) : (
                    <Icons.Store size={14} className="text-slate-500 shrink-0" />
                  )}
                  <span className="text-[13px] font-semibold text-slate-800 flex-1 truncate">{order.shop_name || "Official Store"}</span>
                  <span className="text-[13px] text-indigo-600 font-medium">
                    {statusLabel}
                  </span>
                </div>

                {/* Card Body */}
                <div className="px-3 py-3 flex gap-3 items-start bg-[#fafafa]">
                  <div className="w-[72px] h-[72px] shrink-0 border border-slate-200 bg-white">
                    <img src={firstItem?.image_url || "/placeholder.png"} className="w-full h-full object-cover" alt="product" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-slate-800 line-clamp-2 leading-snug">{firstItem?.product_name?.split(" | ")[0]}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[13px] text-slate-800 font-medium">Rp{firstItem?.price?.toLocaleString("id-ID")}</p>
                    <p className="text-[12px] text-slate-500 mb-1 mt-0.5">x{itemCount}</p>
                  </div>
                </div>

                {/* Price Footer */}
                <div className="px-4 py-2.5 flex justify-end items-center gap-1.5 border-b border-slate-100">
                  <span className="text-[13px] text-slate-800">Total {itemCount} produk:</span>
                  <span className="text-[14px] font-bold text-slate-800">Rp{order.total_amount?.toLocaleString("id-ID")}</span>
                </div>

                {/* Dummy Coin Promo */}
                {order.status === "Selesai" && (
                  <div className="mx-3 my-2 bg-[#f8fbfa] border border-transparent rounded flex items-center justify-between p-2">
                    <div className="flex items-center gap-2">
                      <div className="bg-amber-400 w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold">C</div>
                      <div className="text-[12px] text-slate-700">
                        Nilai pesanan sebelum 11 Jun untuk dapatkan<br /><span className="text-indigo-600 font-medium">140 Koin</span>
                      </div>
                    </div>
                    <Icons.ChevronRight size={14} className="text-slate-400" />
                  </div>
                )}

                {/* Payment Deadline Banner (for unpaid) */}
                {unpaid && !isTimeExpired && (
                  <div className="mx-3 my-2 bg-indigo-50 border border-indigo-100/50 rounded flex items-center justify-between p-2">
                    <div className="flex items-center gap-2">
                      <Icons.Clock size={14} className="text-indigo-500 shrink-0" />
                      <p className="text-[11px] text-indigo-700 font-medium">Selesaikan pembayaran dalam</p>
                    </div>
                    <p className="text-[12px] font-bold text-indigo-600 tabular-nums">
                      {Math.max(0, Math.floor(diff / 60000)).toString().padStart(2, '0')}:
                      {Math.max(0, Math.floor((diff % 60000) / 1000)).toString().padStart(2, '0')}
                    </p>
                  </div>
                )}

                {/* Actions Footer */}
                <div className="px-3 py-3 flex justify-end gap-2 text-[13px]">
                  <button onClick={() => setExpandedOrderId(order.id)} className="px-5 py-1.5 border border-slate-300 rounded text-slate-700 bg-white">Detail</button>
                  {unpaid && !isTimeExpired ? (
                    <button onClick={() => router.push(`/checkout/payment?order_id=${order.id}`)} className="px-5 py-1.5 bg-indigo-600 text-white rounded font-medium">Bayar Sekarang</button>
                  ) : order.status === "Selesai" ? (
                    <>
                      <button onClick={() => router.push(`/product/${firstItem?.product_id}`)} className="px-5 py-1.5 border border-slate-300 rounded text-slate-700 bg-white">Beli Lagi</button>
                      <button onClick={() => openReviewModal(order)} className="px-5 py-1.5 border border-indigo-600 text-indigo-600 rounded bg-white">Nilai</button>
                    </>
                  ) : order.status === "Dibatalkan" ? (
                    <>
                      <button onClick={() => setViewCancelReason(order.cancel_reason || "Dibatalkan oleh sistem")} className="px-5 py-1.5 border border-slate-300 rounded text-slate-700 bg-white">Rincian Pembatalan</button>
                      <button onClick={() => router.push(`/product/${firstItem?.product_id}`)} className="px-5 py-1.5 border border-indigo-600 text-indigo-600 rounded bg-white">Beli Lagi</button>
                    </>
                  ) : order.status === "Dikirim" ? (
                    <button onClick={() => completeOrder(order)} className="px-5 py-1.5 bg-indigo-600 text-white rounded font-medium">Pesanan Diterima</button>
                  ) : null}
                </div>
              </div>
            )
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-32 px-8 text-center bg-[#f5f5f5]">
            <div className="mb-4">
              <Icons.ClipboardList size={64} className="text-[#a5d2c8]" strokeWidth={1.5} />
            </div>
            <p className="text-[14px] text-slate-500">Belum ada pesanan</p>
          </div>
        )}
      </div>

      {/* ── REVIEW MODAL ────────────────────────────────── */}
      {reviewOrder && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-t-[24px] p-5 shadow-2xl pb-safe pt-2 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom">
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto my-3" />
            <div className="mb-5 text-center">
              <h2 className="text-base font-bold text-slate-900">Beri Ulasan 🌟</h2>
              <p className="text-xs text-slate-400 mt-1">Gimana pesanannya? Ceritakan pengalamanmu.</p>
            </div>
            <div className="flex items-center gap-2 px-1 mb-3">
              <Icons.UserCircle2 size={13} className="text-slate-400" />
              <span className="text-[11px] text-slate-500">Ulasan atas nama: <span className="font-bold text-slate-700">{reviewerName || "Pembeli"}</span></span>
            </div>
            <div className="space-y-4">
              {reviewOrder.order_items?.filter((i: any) => i.product_id).map((item: any) => {
                const PId = item.product_id
                const revState = reviewsState[PId] || { rating: 5, comment: "", photoFile: null, photoPreview: "" }
                return (
                  <div key={PId} className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <div className="flex gap-3 mb-3 pb-3 border-b border-slate-100">
                      <img src={item.image_url || "/placeholder.png"} className="w-10 h-10 rounded-lg object-cover border border-slate-100 shrink-0" alt="prod" />
                      <p className="text-xs font-bold text-slate-800 line-clamp-2 self-center">{item.product_name?.split(" | ")[0]}</p>
                    </div>
                    <div className="flex items-center justify-center gap-1.5 mb-3">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button key={star} onClick={() => setReviewsState(prev => ({ ...prev, [PId]: { ...prev[PId], rating: star } }))} className="transition-transform hover:scale-110 active:scale-90">
                          <Icons.Star size={26} className={star <= revState.rating ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-100"} />
                        </button>
                      ))}
                    </div>
                    <textarea
                      placeholder="Ceritakan kepuasanmu (Opsional)..."
                      value={revState.comment}
                      onChange={(e) => setReviewsState(prev => ({ ...prev, [PId]: { ...prev[PId], comment: e.target.value } }))}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none h-20"
                    />
                    <div className="mt-3">
                      {revState.photoPreview ? (
                        <div className="relative w-20 h-20">
                          <img src={revState.photoPreview} className="w-20 h-20 rounded-xl object-cover border border-slate-200" alt="preview" />
                          <button onClick={() => setReviewsState(prev => ({ ...prev, [PId]: { ...prev[PId], photoFile: null, photoPreview: "" } }))} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-slate-700 text-white rounded-full flex items-center justify-center shadow">
                            <Icons.X size={10} strokeWidth={3} />
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer">
                          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center gap-1 hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors">
                            <Icons.ImagePlus size={18} className="text-slate-400" />
                            <span className="text-[9px] font-bold text-slate-400">Foto</span>
                          </div>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            if (file.size > 5 * 1024 * 1024) { toast.error("Ukuran foto maksimal 5MB"); return }
                            const reader = new FileReader()
                            reader.onload = (ev) => setReviewsState(prev => ({ ...prev, [PId]: { ...prev[PId], photoFile: file, photoPreview: ev.target?.result as string } }))
                            reader.readAsDataURL(file)
                          }} />
                        </label>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-3 mt-5 pt-4 border-t border-slate-100 sticky bottom-0 bg-white pb-6">
              <button onClick={() => setReviewOrder(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold">Nanti Saja</button>
              <button disabled={isSubmittingReview} onClick={submitReviews} className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center">
                {isSubmittingReview ? <Icons.Loader2 size={16} className="animate-spin" /> : "Kirim Ulasan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CANCEL MODAL ────────────────────────────────── */}
      {viewCancelReason && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm shadow-sm animate-in fade-in duration-200" onClick={() => setViewCancelReason(null)}>
          <div className="bg-white rounded-2xl p-5 max-w-xs w-full shadow-xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-slate-800 mb-2 border-b pb-2">Alasan Pembatalan</h3>
            <p className="text-[13px] text-slate-600 mb-5 leading-relaxed">{viewCancelReason}</p>
            <button className="w-full py-2.5 bg-slate-800 text-white rounded-xl font-medium text-[13px]" onClick={() => setViewCancelReason(null)}>Tutup</button>
          </div>
        </div>
      )}

      {cancelOrderObj && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-10 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-200 relative">
            <button onClick={() => { setCancelOrderObj(null); setCancelReason("") }} className="absolute top-4 right-4 p-1.5 text-slate-400 hover:bg-slate-100 rounded-full" disabled={isCanceling}>
              <Icons.X size={18} />
            </button>
            <div className="text-center mt-2 mb-5">
              <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Icons.PackageX size={22} className="text-slate-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Batalkan Pesanan?</h3>
              <p className="text-[13px] text-slate-400 mt-1">#{cancelOrderObj.id.slice(0, 8).toUpperCase()}</p>
            </div>
            {cancelOrderObj.payment_status !== "pending" && cancelOrderObj.payment_status !== "waiting_payment" && (
              <div className="bg-amber-50 border border-amber-100 p-3 rounded-xl mb-4 flex items-start gap-2">
                <Icons.Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700 leading-relaxed">Pesanan ini sudah dibayar. Saldo akan dikembalikan otomatis ke Wallet Anda.</p>
              </div>
            )}
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ceritakan alasan pembatalan..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[14px] outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none h-24 placeholder:text-slate-300 mb-4"
              disabled={isCanceling}
            />
            <button
              onClick={handleCancelOrder}
              disabled={isCanceling || !cancelReason.trim()}
              className="w-full bg-slate-800 text-white py-3.5 rounded-2xl font-bold text-[14px] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isCanceling ? <Icons.Loader2 className="animate-spin" size={16} /> : <Icons.XCircle size={16} />}
              {isCanceling ? "Membatalkan..." : "Ya, Batalkan Pesanan"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MyOrdersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-[13px] text-slate-400 font-medium">Memuat pesanan...</span>
        </div>
      </div>
    }>
      <OrdersContent />
    </Suspense>
  )
}