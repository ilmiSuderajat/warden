"use client"

import { useState, useEffect, Suspense } from "react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { cancelOrder } from "@/lib/wallet"
import * as Icons from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import Skeleton from "@/app/components/Skeleton"
import ProductList from "@/app/components/ProductList"

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
  const [reviewsState, setReviewsState] = useState<Record<string, { rating: number; comment: string; photos?: { file: File | null; url: string }[] }>>({})
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
  const [viewCancelOrder, setViewCancelOrder] = useState<any>(null)

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
      if (item.product_id) { initial[item.product_id] = { rating: 5, comment: "", photos: [] }; hasReviewable = true }
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
        const urls = ex.photo_url ? ex.photo_url.split(',') : []
        if (initial[ex.product_id]) initial[ex.product_id] = { rating: ex.rating, comment: ex.comment || "", photos: urls.filter(Boolean).map((u: string) => ({ file: null, url: u.trim() })), id: ex.id }
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
          let urls: string[] = []
          if (rev.photos && Array.isArray(rev.photos)) {
            for (let i = 0; i < rev.photos.length; i++) {
              const p = rev.photos[i]
              if (p.file) {
                try {
                  const compressed = await compressImage(p.file, 100)
                  const fd = new FormData()
                  fd.append("file", compressed); fd.append("orderId", reviewOrder.id); fd.append("productId", productId + "_" + i)
                  const uploadRes = await fetch("/api/review/photo", { method: "POST", body: fd })
                  const uploadData = await uploadRes.json()
                  if (uploadRes.ok && uploadData.url) urls.push(uploadData.url)
                } catch { /* ignore */ }
              } else if (p.url) {
                urls.push(p.url)
              }
            }
          }
          return { productId, rating: rev.rating, comment: rev.comment, photoUrl: urls.length > 0 ? urls.join(',') : null, existingId: rev.id || undefined }
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

  // ─── CANCEL DETAILS FULL SCREEN (RINCIAN PEMBATALAN) ──────────
  if (viewCancelOrder) {
    const details = orders.find(o => o.id === viewCancelOrder.id) || viewCancelOrder
    const firstItem = details.order_items?.[0]
    return (
      <div className="min-h-screen bg-[#f5f5f5] font-sans max-w-md mx-auto">
        <div className="bg-white sticky top-0 z-40 border-b border-slate-100 flex items-center px-4 h-14">
          <button onClick={() => setViewCancelOrder(null)} className="p-1 -ml-1 text-[#ee4d2d] shrink-0">
            <Icons.ArrowLeft size={24} />
          </button>
          <h1 className="text-[17px] font-normal text-slate-800 ml-4 flex-1">Rincian Pembatalan</h1>
        </div>

        <div className="bg-white px-4 py-6 mb-2 flex justify-between items-center">
          <div>
            <h2 className="text-[#ee4d2d] text-lg font-medium">Pembatalan Berhasil</h2>
            <p className="text-xs text-slate-500 mt-1">pada {formatDate(details.created_at)}</p>
          </div>
          <div className="w-10 h-10 rounded-full border border-[#ee4d2d] shrink-0 flex items-center justify-center">
            <Icons.Check size={24} className="text-[#ee4d2d] stroke-[1.5px]" />
          </div>
        </div>

        <div className="bg-white px-4 py-3 border-b border-slate-100 mt-2 flex items-center gap-2">
          <div className="bg-[#ee4d2d] text-white text-[9px] font-bold px-1 rounded-sm">Star</div>
          <span className="text-[13px] font-semibold text-slate-800">{details.shop_name || "Official Store"}</span>
          <Icons.ChevronRight size={14} className="text-slate-400" />
        </div>
        <div className="bg-white px-4 py-3 flex gap-3 border-b border-white">
          <img src={firstItem?.image_url || "/placeholder.png"} className="w-[72px] h-[72px] object-cover border border-slate-200" alt="product" />
          <div className="flex-1 min-w-0 flex flex-col justify-start pt-1">
            <p className="text-[13px] text-slate-800 line-clamp-2 leading-snug">{firstItem?.product_name?.split(" | ")[0]}</p>
          </div>
          <div className="text-right shrink-0 flex flex-col justify-start pt-1">
            <p className="text-[13px] text-slate-800 font-medium">Rp{firstItem?.price?.toLocaleString("id-ID")}</p>
            <p className="text-xs text-slate-400 line-through">Rp{((firstItem?.price || 0) * 1.2)?.toLocaleString("id-ID")}</p>
            <p className="text-xs text-slate-500 mt-1">x{firstItem?.quantity || 1}</p>
          </div>
        </div>

        <div className="bg-white px-4 py-4 mb-2">
          <div className="flex justify-between text-[13px] text-slate-500 mb-3">
            <span className="w-1/3">Diminta oleh</span>
            <span className="text-slate-800 text-right">Sistem / Pembeli</span>
          </div>
          <div className="flex justify-between text-[13px] text-slate-500 mb-3">
            <span className="w-1/3">Diminta pada</span>
            <span className="text-slate-800 text-right">{formatDate(details.created_at)}</span>
          </div>
          <div className="flex justify-between text-[13px] text-slate-500 mb-3">
            <span className="w-1/3">Alasan</span>
            <span className="text-slate-800 text-right max-w-[60%] ml-auto">{details.cancel_reason || "Tidak ada pembayaran / Dibatalkan"}</span>
          </div>
          <div className="flex justify-between text-[13px] text-slate-500">
            <span className="w-1/3">Metode pembayaran</span>
            <span className="text-slate-800 text-right">Belum Bayar</span>
          </div>
        </div>

        <div className="bg-[#f5f5f5] px-4 py-4">
          <button onClick={() => { setExpandedOrderId(details.id); setViewCancelOrder(null); }} className="w-full py-2.5 bg-white border border-slate-300 rounded text-sm text-slate-700 font-medium tracking-wide">Rincian Pesanan</button>
        </div>
      </div>
    )
  }

  // ─── REVIEW FULL SCREEN (NILAI PRODUK) ─────────────────────────
  if (reviewOrder) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] font-sans max-w-md mx-auto pb-20">
        <div className="bg-white sticky top-0 z-40 flex items-center px-4 h-14 shadow-sm relative">
          <button onClick={() => setReviewOrder(null)} className="p-1 -ml-1 text-[#ee4d2d] shrink-0">
            <Icons.ArrowLeft size={24} />
          </button>
          <h1 className="text-[18px] font-normal text-slate-800 ml-4 flex-1">Nilai Produk</h1>
        </div>

        <div className="py-2 space-y-2">
          {reviewOrder.order_items?.filter((i: any) => i.product_id).map((item: any) => {
            const PId = item.product_id
            const revState = reviewsState[PId] || { rating: 5, comment: "", photos: [] }
            return (
              <div key={PId}>
                {/* Section 1: Item & Review Input */}
                <div className="bg-white p-4">
                  <div className="flex gap-3 mb-4">
                    <img src={item.image_url || "/placeholder.png"} className="w-12 h-12 object-cover rounded border border-slate-100" alt="product" />
                    <div>
                      <p className="text-[13px] font-semibold text-slate-800 line-clamp-1">{item.product_name?.split(" | ")[0]}</p>
                      <p className="text-[11px] text-slate-400">Variasi: -</p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 mb-4">
                    <p className="text-[13px] text-slate-500">Nilai Produk</p>
                    <div className="flex items-center gap-3">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button key={star} onClick={() => setReviewsState(prev => ({ ...prev, [PId]: { ...prev[PId], rating: star } }))} className="transition-transform active:scale-95">
                          <Icons.Star size={32} className={star <= revState.rating ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-100"} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-[12px] text-slate-600">Tambahkan 2 foto dan video</p>
                      <span className="text-[11px] text-amber-500 font-medium flex items-center">+30 <Icons.CircleDollarSign size={10} className="ml-1" /></span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar snap-x pb-2">
                      {revState.photos?.map((p: any, idx: number) => (
                        <div key={idx} className="relative w-20 h-20 shrink-0 snap-start rounded border border-slate-200 bg-white">
                          <img src={p.url} className="w-full h-full object-cover rounded" alt="preview" />
                          <button onClick={() => {
                            const newPhotos = [...(revState.photos || [])];
                            newPhotos.splice(idx, 1);
                            setReviewsState(prev => ({ ...prev, [PId]: { ...prev[PId], photos: newPhotos } }))
                          }} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-slate-700/80 text-white rounded-full flex items-center justify-center shadow backdrop-blur-sm z-10 transition-transform active:scale-95">
                            <Icons.X size={10} strokeWidth={3} />
                          </button>
                        </div>
                      ))}
                      {(revState.photos?.length || 0) < 2 && (
                        <label className="cursor-pointer shrink-0 w-20 h-20 border-2 border-dashed border-slate-300 rounded bg-white flex flex-col items-center justify-center gap-1.5 hover:border-indigo-400 hover:bg-slate-50 transition-colors snap-start relative overflow-hidden">
                          <Icons.Camera size={26} className="text-slate-400" strokeWidth={1} />
                          <span className="text-[9px] font-medium text-slate-500 text-center leading-tight">Video/Foto</span>
                          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
                            const files = Array.from(e.target.files || []);
                            if (!files.length) return;
                            const currentCount = revState.photos?.length || 0;
                            let added = 0;
                            files.forEach(file => {
                              if (currentCount + added < 2) {
                                if (file.size > 5 * 1024 * 1024) { toast.error("Ukuran foto maksimal 5MB"); return; }
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                  setReviewsState(prev => {
                                    const prevPhotos = prev[PId]?.photos || [];
                                    return { ...prev, [PId]: { ...prev[PId], photos: [...prevPhotos, { file, url: ev.target?.result as string }] } }
                                  })
                                };
                                reader.readAsDataURL(file);
                                added++;
                              }
                            });
                          }} />
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="mb-4 bg-slate-50 rounded-lg p-3 relative">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-[12px] text-slate-600">Tulis ulasan minimal 50 karakter</p>
                      <span className="text-[11px] text-amber-500 font-medium flex items-center">+10 <Icons.CircleDollarSign size={10} className="ml-1" /></span>
                    </div>
                    <textarea
                      placeholder="Desain: 
Bahan: 

Bagikan penilaianmu dan bantu Pengguna lain membuat pilihan yang lebih baik!"
                      value={revState.comment}
                      onChange={(e) => setReviewsState(prev => ({ ...prev, [PId]: { ...prev[PId], comment: e.target.value } }))}
                      className="w-full bg-transparent text-[13px] border-none outline-none resize-none h-32 placeholder:text-slate-300 mt-1 text-slate-700 focus:ring-0 leading-relaxed"
                    />
                    <span className="absolute bottom-2 right-3 text-[10px] text-slate-300">{(revState.comment || "").length} karakter</span>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer mt-2 pt-2">
                    <input type="checkbox" className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 border-slate-300" />
                    <span className="text-[12px] text-slate-600">Sembunyikan username pada penilaian</span>
                  </label>
                </div>

                {/* Section 2: Seller & Shipping Ratings */}
                <div className="bg-white p-4 mt-2">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[13px] text-slate-800">Pelayanan Penjual</span>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => <Icons.Star key={star} size={24} className="text-amber-400 fill-amber-400" />)}
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[13px] text-slate-800">Kecepatan Jasa Kirim</span>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => <Icons.Star key={star} size={24} className="text-amber-400 fill-amber-400" />)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="fixed bottom-0 w-full max-w-md bg-white p-3 z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] border-t border-slate-100">
          <button disabled={isSubmittingReview} onClick={submitReviews} className="w-full py-3 bg-[#ee4d2d] text-white rounded-[2px] font-medium text-[15px] flex justify-center items-center">
            {isSubmittingReview ? <Icons.Loader2 className="animate-spin mr-2" size={18} /> : null}
            KIRIM
          </button>
        </div>
      </div>
    )
  }

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
              <div key={order.id} className="bg-white mt-2">
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
                      <button onClick={() => setViewCancelOrder(order)} className="px-5 py-1.5 border border-slate-300 rounded text-slate-700 bg-white">Rincian Pembatalan</button>
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

      {/* --- REKOMENDASI PRODUK --- */}
      <div className="mt-2 bg-white pb-6 pt-4 border-t border-slate-200">
        <div className="flex flex-col items-center mb-6 pt-2">
          <div className="flex items-center gap-3 w-full px-6">
            <div className="flex-1 h-[1px] bg-slate-200"></div>
            <div className="flex items-center gap-2 px-1 text-slate-500">
              <Icons.Heart size={16} className="text-red-400 fill-red-400" />
              <h3 className="text-[12px] font-bold text-red-500 uppercase">Anda mungkin juga suka</h3>
            </div>
            <div className="flex-1 h-[1px] bg-slate-200"></div>
          </div>
        </div>
        <ProductList sortBy="popular" />
      </div>

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