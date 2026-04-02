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

      // Scale down to max 1200px on longest side
      const MAX_PX = 1200
      if (width > MAX_PX || height > MAX_PX) {
        const ratio = Math.min(MAX_PX / width, MAX_PX / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }

      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext("2d")!
      ctx.fillStyle = "#fff" // white bg for transparent PNGs
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)

      let quality = 0.85

      const tryCompress = (): void => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error("Compression failed")); return }
            if (blob.size <= maxKB * 1024 || quality <= 0.05) {
              resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }))
            } else {
              quality = Math.max(0.05, quality - 0.1)
              tryCompress()
            }
          },
          "image/jpeg",
          quality
        )
      }
      tryCompress()
    }

    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Gagal memuat gambar")) }
    img.src = objectUrl
  })
}

function OrdersContent() {
  const [activeTab, setActiveTab] = useState("all")
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewOrder, setReviewOrder] = useState<any>(null)
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [reviewsState, setReviewsState] = useState<Record<string, { rating: number, comment: string, photoFile?: File | null, photoPreview?: string }>>({} )
  const [reviewerName, setReviewerName] = useState<string>("")

  // Cancel order state
  const [cancelOrderObj, setCancelOrderObj] = useState<any>(null)
  const [cancelReason, setCancelReason] = useState("")
  const [isCanceling, setIsCanceling] = useState(false)

  // State untuk menyimpan ID order yang sedang di-expand
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeOrderId = searchParams.get("active")

  useEffect(() => {
    if (activeOrderId && orders.length > 0) {
      setExpandedOrderId(activeOrderId)
    }
  }, [activeOrderId, orders])

  const tabs = [
    { id: "all", label: "Semua", icon: "LayoutGrid" },
    { id: "pending", label: "Belum Bayar", icon: "CreditCard" },
    { id: "dikemas", label: "Dikemas", icon: "Package" },
    { id: "dikirim", label: "Dikirim", icon: "Truck" },
    { id: "selesai", label: "Selesai", icon: "CheckCircle2" },
  ]

  useEffect(() => {
    fetchOrders()
  }, [activeTab])

  const fetchOrders = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push("/login")

    let query = supabase
      .from("orders")
      .select("*, order_items(*), driver_orders(delivery_photo_url)")
      .eq("user_id", user.id)

    if (activeTab === "pending") query = query.eq("payment_status", "pending")
    if (activeTab === "dikemas") query = query.in("status", ["Perlu Dikemas", "Diproses"])
    if (activeTab === "dikirim") query = query.in("status", ["Mencari Kurir", "Kurir Menuju Lokasi", "Kurir di Toko", "Dikirim", "Kurir di Lokasi", "Kurir Tidak Tersedia"])
    if (activeTab === "selesai") query = query.eq("status", "Selesai")

    const { data } = await query.order("created_at", { ascending: false })
    if (data) setOrders(data)
    setLoading(false)
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Menunggu Pembayaran': return 'bg-amber-50 text-amber-600 border-amber-100'
      case 'Perlu Dikemas': return 'bg-indigo-50 text-indigo-600 border-indigo-100'
      case 'Diproses': return 'bg-blue-50 text-blue-600 border-blue-100'
      case 'Mencari Kurir': return 'bg-yellow-50 text-yellow-600 border-yellow-100 animate-pulse'
      case 'Kurir Menuju Lokasi':
      case 'Kurir di Toko':
      case 'Dikirim':
      case 'Kurir di Lokasi': return 'bg-indigo-50 text-indigo-600 border-indigo-100'
      case 'Kurir Tidak Tersedia': return 'bg-rose-50 text-rose-600 border-rose-100'
      case 'Selesai': return 'bg-emerald-50 text-emerald-600 border-emerald-100'
      case 'Dibatalkan': return 'bg-rose-50 text-rose-600 border-rose-100'
      default: return 'bg-slate-50 text-slate-600 border-slate-100'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  const toggleExpand = (orderId: string) => {
    setExpandedOrderId(prev => prev === orderId ? null : orderId)
  }

  const openReviewModal = async (order: any) => {
      const initial: Record<string, any> = {}
      let hasReviewableItems = false;
      order.order_items?.forEach((item: any) => {
         if (item.product_id) {
            initial[item.product_id] = { rating: 5, comment: "", photoFile: null, photoPreview: "" }
            hasReviewableItems = true;
         }
      })

      if (!hasReviewableItems) {
         toast.info("Pesanan ini adalah pesanan lama yang belum mendukung Ulasan Produk.");
         return;
      }

      // Ambil nama reviewer dari alamat utama user
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: addr } = await supabase
          .from("addresses")
          .select("name")
          .eq("user_id", user.id)
          .order("is_default", { ascending: false })
          .limit(1)
          .maybeSingle()
        if (addr?.name) setReviewerName(addr.name)
        else setReviewerName(order.customer_name || "Pembeli")
      }

      // Fetch existing reviews so users can edit them
      const { data: existing } = await supabase
        .from("product_reviews")
        .select("id, product_id, rating, comment, photo_url")
        .eq("order_id", order.id);
      if (existing) {
         existing.forEach(ex => {
            if (initial[ex.product_id]) {
               initial[ex.product_id] = {
                 rating: ex.rating,
                 comment: ex.comment || "",
                 photoFile: null,
                 photoPreview: ex.photo_url || "",
                 id: ex.id
               }
            }
         })
      }

      setReviewsState(initial)
      setReviewOrder(order)
  }

  const completeOrder = async (order: any) => {
    const res = await fetch("/api/orders/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id }),
    })
    if (!res.ok) {
      toast.error("Gagal menyelesaikan pesanan")
      return
    }
    toast.success("Pesanan telah selesai! Terima kasih.")
    fetchOrders()
    openReviewModal(order)
  }

  const submitReviews = async () => {
    setIsSubmittingReview(true)

    try {
      const reviewPayload = await Promise.all(
        Object.entries(reviewsState).map(async ([productId, rev]: any) => {
          let photoUrl: string | null = rev.photoPreview || null

          // Only upload if there's a NEW file (not an existing URL)
          if (rev.photoFile) {
            try {
              // Step 1: Compress to max 100KB
              const compressed = await compressImage(rev.photoFile, 100)
              console.log(`[Review] Compressed: ${(rev.photoFile.size / 1024).toFixed(1)}KB → ${(compressed.size / 1024).toFixed(1)}KB`)

              // Step 2: Upload via server API (bypasses storage RLS)
              const fd = new FormData()
              fd.append("file", compressed)
              fd.append("orderId", reviewOrder.id)
              fd.append("productId", productId)

              const uploadRes = await fetch("/api/review/photo", { method: "POST", body: fd })
              const uploadData = await uploadRes.json()

              if (uploadRes.ok && uploadData.url) {
                photoUrl = uploadData.url
              } else {
                toast.warning("Foto gagal diupload, ulasan tetap dikirim tanpa foto.")
                photoUrl = null
              }
            } catch (err) {
              console.warn("[Review] Compression/upload error:", err)
              photoUrl = null
            }
          }

          return {
            productId,
            rating: rev.rating,
            comment: rev.comment,
            photoUrl,
            existingId: rev.id || undefined,
          }
        })
      )

      // Step 3: Submit all reviews via server API (bypasses table RLS)
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: reviewOrder.id,
          reviewerName,
          reviews: reviewPayload,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Gagal mengirim ulasan.")
      } else {
        toast.success("Terima kasih atas ulasan Anda! 🎉")
        setReviewOrder(null)
      }
    } catch (err) {
      console.error("[submitReviews]", err)
      toast.error("Terjadi kesalahan saat mengirim ulasan.")
    } finally {
      setIsSubmittingReview(false)
    }
  }

  const checkPaymentStatus = async (orderId: string) => {
    setLoading(true)
    try {
      const response = await fetch("/api/payment/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      })

      const data = await response.json()
      if (data.success) {
        toast.success(data.message)
        fetchOrders() // Refresh data
      } else if (data.status === 'error') {
        toast.error(data.message || data.error)
      }
    } catch (err) {
      toast.error("Gagal mengecek status. Silakan coba lagi nanti.")
    } finally {
      setLoading(false)
    }
  }

  const handleCancelOrder = async () => {
    if (!cancelReason.trim()) {
      toast.error("Alasan pembatalan wajib diisi")
      return
    }
    
    setIsCanceling(true)
    try {
      await cancelOrder(cancelOrderObj.id, cancelReason)
      toast.success("Pesanan berhasil dibatalkan")
      setCancelOrderObj(null)
      setCancelReason("")
      fetchOrders()
    } catch (err: any) {
      toast.error(err.message || "Gagal membatalkan pesanan")
    } finally {
      setIsCanceling(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/80 font-sans max-w-md mx-auto pb-24">
      {/* HEADER */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="flex items-center gap-3 px-5 pt-12 pb-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
            <Icons.ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Pesanan Saya</h1>
        </div>

        {/* TABS WITH INDIGO ACCENT */}
        <div className="flex gap-2 px-5 pb-4 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const Icon = (Icons as any)[tab.icon]
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap border ${isActive
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-200 hover:text-indigo-600'
                  }`}
              >
                <Icon size={14} className={isActive ? "text-white" : "text-slate-400"} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* LIST CONTENT */}
      <div className="p-5 space-y-4">
        {loading ? (
          <div className="space-y-4">
            {Array(3).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden p-5">
                <div className="flex justify-between items-center mb-4">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                </div>
                <div className="flex gap-4">
                  <Skeleton className="w-16 h-16 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/4" />
                    <Skeleton className="h-5 w-1/2 mt-2" />
                  </div>
                </div>
                <Skeleton className="h-10 w-full rounded-xl mt-5" />
              </div>
            ))}
          </div>
        ) : orders.length > 0 ? (
          orders.map((order) => {
            const isExpanded = expandedOrderId === order.id

            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all duration-300"
              >
                {/* Card Header */}
                <div className="flex justify-between items-center px-5 py-3 border-b border-slate-50 bg-slate-50/50">
                  <span className="text-[11px] font-medium text-slate-400">
                    {formatDate(order.created_at)}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${getStatusStyle(
                      order.payment_status === "pending" ? "Menunggu Pembayaran" : order.status
                    )}`}
                  >
                    {order.payment_status === "pending" ? "Menunggu Pembayaran" : order.status}
                  </span>
                </div>

                {/* Card Body */}
                <div className="p-5">
                  <div className="flex gap-4">
                    <div className="w-16 h-16 bg-slate-100 rounded-xl overflow-hidden shrink-0 border border-slate-50">
                      <img
                        src={order.order_items?.[0]?.image_url || "/placeholder.png"}
                        className="w-full h-full object-cover"
                        alt="product"
                      />
                    </div>
                    <div className="flex-1 min-w-0 py-0.5">
                      <h3 className="text-sm font-semibold text-slate-800 line-clamp-1">
                        {order.order_items?.[0]?.product_name?.split(" | ")[0]}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {order.order_items?.length > 1 ? `${order.order_items.length} Produk` : '1 Produk'}
                      </p>
                      <p className="text-sm font-bold text-slate-900 mt-2 tracking-tight">
                        Rp {order.total_amount?.toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="px-5 pb-5 pt-0">
                  <button
                    onClick={() => toggleExpand(order.id)}
                    className={`w-full py-3 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 ${isExpanded
                      ? 'bg-slate-100 text-slate-600 border border-slate-200'
                      : 'bg-white border border-indigo-600 text-indigo-600 hover:bg-indigo-50'
                      }`}
                  >
                    {isExpanded ? (
                      <>
                        <Icons.ChevronUp size={14} />
                        Tutup Detail
                      </>
                    ) : (
                      <>
                        <Icons.Eye size={14} />
                        Lihat Detail
                      </>
                    )}
                  </button>
                </div>

                {/* EXPANDABLE CONTENT (Accordion) - Muncul di bawah tombol */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-5 space-y-5 animate-in slide-in-from-top-2 duration-200">

                    {/* Info Pengiriman */}
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg shrink-0 mt-0.5">
                          <Icons.MapPin size={16} className="text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Alamat Tujuan</p>
                          <p className="text-sm text-slate-700 leading-relaxed">{order.address}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-emerald-50 rounded-lg shrink-0 mt-0.5">
                          <Icons.Route size={16} className="text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Jarak Tempuh</p>
                          <p className="text-sm text-slate-700 font-medium">{order.distance_km?.toFixed(1)} KM</p>
                        </div>
                      </div>
                    </div>

                    {/* Daftar Item */}
                    <div className="border-t border-slate-100 pt-4">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Daftar Produk</p>
                      <div className="space-y-3">
                        {order.order_items?.map((item: any, idx: number) => (
                          <div key={idx} className="flex gap-3 items-center">
                            <div className="w-12 h-12 bg-slate-100 rounded-lg overflow-hidden">
                              <img src={item.image_url || "/placeholder.png"} className="w-full h-full object-cover" alt={item.product_name} />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-700 line-clamp-1">{item.product_name?.split(" | ")[0]}</p>
                              <p className="text-xs text-slate-400">{item.quantity}x @ Rp {item.price?.toLocaleString('id-ID')}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Rincian Pembayaran */}
                    <div className="border-t border-slate-100 pt-4 space-y-2.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Subtotal</span>
                        <span className="text-slate-700 font-medium">Rp {order.subtotal_amount?.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Ongkos Kirim</span>
                        <span className="text-slate-700 font-medium">Rp {order.shipping_amount?.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="border-t border-dashed border-slate-200 my-3"></div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-slate-800">Total Tagihan</span>
                        <span className="text-lg font-bold text-indigo-600">
                          Rp {order.total_amount?.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    {/* Tombol Aksi di dalam Expanded Area */}
                    <div className="pt-2 space-y-2">
                      {order.payment_status === "pending" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => router.push(`/checkout/payment?order_id=${order.id}`)}
                            className="flex-[2] py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 active:scale-[0.98]"
                          >
                            <Icons.CreditCard size={18} />
                            Bayar Sekarang
                          </button>
                          <button
                            onClick={() => checkPaymentStatus(order.id)}
                            className="flex-1 py-3 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-[10px] font-bold transition-all flex flex-col items-center justify-center leading-tight"
                            title="Klik jika Anda sudah membayar tapi status belum berubah"
                          >
                            <Icons.RefreshCw size={14} className="mb-1" />
                            Cek Status
                          </button>
                        </div>
                      )}

                      {/* Delivery Proof Photo */}
                      {order.driver_orders?.[0]?.delivery_photo_url && (
                        <div className="mt-4 pt-4 border-t border-slate-100">
                          <p className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                            <Icons.Package size={14} className="text-emerald-500" /> Bukti Pengiriman
                          </p>
                          <div className="w-full h-40 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                            <img src={order.driver_orders[0].delivery_photo_url} alt="Bukti Pengiriman" className="w-full h-full object-cover" />
                          </div>
                        </div>
                      )}

                      {/* Tombol Selesaikan Pesanan — muncul saat status Dikirim */}
                      {order.status === "Dikirim" && (
                        <button
                          onClick={() => completeOrder(order)}
                          className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 active:scale-[0.98]"
                        >
                          <Icons.CheckCircle2 size={18} />
                          Selesaikan Pesanan
                        </button>
                      )}

                      {/* Tombol Beri Ulasan — muncul saat status Selesai */}
                      {order.status === "Selesai" && (
                        <button
                          onClick={() => openReviewModal(order)}
                          className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-amber-200 flex items-center justify-center gap-2 active:scale-[0.98]"
                        >
                          <Icons.Star size={18} />
                          Nilai & Ulas Produk
                        </button>
                      )}

                      {order.status !== "Selesai" && order.status !== "Dibatalkan" && (
                        <button
                          onClick={() => setCancelOrderObj(order)}
                          className="w-full py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 bg-rose-50 hover:bg-rose-100 text-rose-600 active:scale-[0.98]"
                        >
                          <Icons.XCircle size={18} />
                          Batalkan Pesanan
                        </button>
                      )}

                      <button
                        onClick={() => window.open(`https://wa.me/${process.env.NEXT_PUBLIC_ADMIN_WHATSAPP}?text=Halo Admin, saya mau konfirmasi pesanan #${order.id.slice(0, 8)}`)}
                        className={`w-full py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 ${order.payment_status === "pending"
                          ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-100"
                          }`}
                      >
                        <Icons.MessageCircle size={18} />
                        Hubungi Admin via WA
                      </button>

                      {/* Tombol Close Tambahan di bawah sesuai permintaan */}
                      <button
                        onClick={() => setExpandedOrderId(null)}
                        className="w-full py-2.5 bg-transparent text-slate-500 text-xs font-medium hover:text-slate-700 transition-colors flex items-center justify-center gap-1"
                      >
                        <Icons.ChevronUp size={14} />
                        Tutup Detail Pesanan
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <div className="text-center py-20 flex flex-col items-center">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
              <Icons.Inbox size={28} className="text-indigo-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Belum ada pesanan</p>
            <p className="text-xs text-slate-400 mt-1">Pesanan akan muncul di sini</p>
          </div>
        )}
      </div>

      {/* REVIEW MODAL (POPUP ULASAN) */}
      {reviewOrder && (
         <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in">
            <div className="bg-white w-full max-w-md rounded-t-[1.5rem] p-5 shadow-2xl pb-safe pt-2 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom">
               <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-3" />
               <div className="mb-5 text-center">
                 <h2 className="text-lg font-bold text-slate-900">Pesanan Selesai! 🎉</h2>
                 <p className="text-xs text-slate-500 mt-1">Gimana pesanannya? Yuk kasih bintang.</p>
               </div>
               {/* Nama Reviewer */}
               <div className="flex items-center gap-2 px-1 mb-1">
                 <Icons.UserCircle2 size={14} className="text-slate-400" />
                 <span className="text-[11px] text-slate-500 font-medium">Ulasan atas nama: <span className="font-bold text-slate-700">{reviewerName || "Pembeli"}</span></span>
               </div>

               <div className="space-y-4">
                  {reviewOrder.order_items?.filter((i:any) => i.product_id).map((item: any) => {
                     const PId = item.product_id;
                     const revState = reviewsState[PId] || { rating: 5, comment: "", photoFile: null, photoPreview: "" };

                     return (
                        <div key={PId} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 shadow-sm">
                           <div className="flex gap-3 mb-3 border-b border-slate-200/50 pb-3">
                              <img src={item.image_url || "/placeholder.png"} className="w-12 h-12 rounded-lg object-cover bg-white shrink-0 border border-slate-100" alt="prod" />
                              <div className="flex-1 min-w-0 flex flex-col justify-center">
                                 <p className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight">{item.product_name?.split(" | ")[0]}</p>
                              </div>
                           </div>
                           
                           <div className="flex items-center justify-center gap-2 mb-3">
                              {[1, 2, 3, 4, 5].map((star) => (
                                 <button 
                                    key={star}
                                    onClick={() => setReviewsState(prev => ({...prev, [PId]: { ...prev[PId], rating: star }}))}
                                    className="p-1 transition-transform hover:scale-110 active:scale-90"
                                 >
                                    <Icons.Star 
                                       size={28} 
                                       className={star <= revState.rating ? "text-amber-400 fill-amber-400 drop-shadow-sm" : "text-slate-200 fill-slate-100"} 
                                    />
                                 </button>
                              ))}
                           </div>

                           <textarea 
                              placeholder="Ceritakan kepuasanmu (Opsional)..."
                              value={revState.comment}
                              onChange={(e) => setReviewsState(prev => ({...prev, [PId]: { ...prev[PId], comment: e.target.value }}))}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all resize-none h-20"
                           ></textarea>

                           {/* Upload Foto (Opsional) */}
                           <div className="mt-3">
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                               <Icons.Camera size={10} /> Foto Ulasan (Opsional)
                             </p>
                             {revState.photoPreview ? (
                               <div className="relative w-24 h-24">
                                 <img src={revState.photoPreview} className="w-24 h-24 rounded-xl object-cover border border-slate-200" alt="preview" />
                                 <button
                                   onClick={() => setReviewsState(prev => ({...prev, [PId]: { ...prev[PId], photoFile: null, photoPreview: "" }}))}
                                   className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center shadow-sm"
                                 >
                                   <Icons.X size={10} strokeWidth={3} />
                                 </button>
                               </div>
                             ) : (
                               <label className="flex items-center gap-2 w-fit cursor-pointer">
                                 <div className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center gap-1 hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors">
                                   <Icons.ImagePlus size={20} className="text-slate-400" />
                                   <span className="text-[9px] font-bold text-slate-400">Tambah</span>
                                 </div>
                                 <input
                                   type="file"
                                   accept="image/*"
                                   className="hidden"
                                   onChange={(e) => {
                                     const file = e.target.files?.[0]
                                     if (!file) return
                                     if (file.size > 5 * 1024 * 1024) {
                                       toast.error("Ukuran foto maksimal 5MB")
                                       return
                                     }
                                     const reader = new FileReader()
                                     reader.onload = (ev) => {
                                       setReviewsState(prev => ({
                                         ...prev,
                                         [PId]: { ...prev[PId], photoFile: file, photoPreview: ev.target?.result as string }
                                       }))
                                     }
                                     reader.readAsDataURL(file)
                                   }}
                                 />
                               </label>
                             )}
                           </div>
                        </div>
                     )
                  })}
               </div>

               <div className="flex gap-3 mt-6 pt-4 border-t border-slate-100 sticky bottom-0 bg-white pb-6">
                  <button 
                     onClick={() => setReviewOrder(null)}
                     className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-all active:scale-95"
                  >Nanti Saja</button>
                  <button 
                     disabled={isSubmittingReview}
                     onClick={submitReviews}
                     className="flex-[2] py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98] shadow-lg shadow-indigo-600/20 flex items-center justify-center"
                  >
                     {isSubmittingReview ? <Icons.Loader2 size={16} className="animate-spin" /> : "Kirim Ulasan"}
                  </button>
               </div>
            </div>
         </div>
      )}

      {/* CANCEL MODAL */}
      {cancelOrderObj && (
         <div className="fixed inset-0 z-[100] flex items-end justify-center px-4 pb-10 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-300 relative">
            <button
              onClick={() => {
                setCancelOrderObj(null)
                setCancelReason("")
              }}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
              disabled={isCanceling}
            >
              <Icons.X size={20} />
            </button>
            <div className="mb-4 text-center mt-2">
              <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-3 text-rose-600">
                <Icons.AlertTriangle size={24} />
              </div>
              <h3 className="text-xl font-black text-slate-900">Batalkan Pesanan?</h3>
              <p className="text-xs text-slate-500 mt-1">Pesanan #{cancelOrderObj.id.slice(0, 8)}</p>
            </div>
            {cancelOrderObj.payment_status !== "pending" && cancelOrderObj.payment_status !== "waiting_payment" && (
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl mb-4 flex items-start gap-2">
                <Icons.Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700 font-medium leading-relaxed">Pesanan ini sudah dibayar. Saldo akan dikembalikan otomatis ke Wallet Anda setelah dibatalkan.</p>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Alasan Pembatalan</label>
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ceritakan alasan Anda..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100 transition-all resize-none h-24 placeholder:font-normal placeholder:text-slate-300"
                  disabled={isCanceling}
                ></textarea>
              </div>
              <button
                onClick={handleCancelOrder}
                disabled={isCanceling || !cancelReason.trim()}
                className="w-full bg-rose-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-rose-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {isCanceling ? <Icons.Loader2 className="animate-spin" size={18} /> : null}
                {isCanceling ? "Membatalkan..." : "Ya, Batalkan"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default function MyOrdersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Skeleton className="w-10 h-10 rounded-full" />
      </div>
    }>
      <OrdersContent />
    </Suspense>
  )
}