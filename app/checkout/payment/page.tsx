"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft, CheckCircle2, Truck, Loader2, CreditCard,
  Wallet, ShieldCheck, MapPin, AlertCircle, Info, Clock
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { getWalletBalance, processPayment } from "@/lib/wallet"
import Link from "next/link"

const isValidUUID = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

// Load Midtrans Snap script — environment aware
const loadMidtransScript = (clientKey: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if ((window as any).snap) { resolve(); return }

    const isSandbox = clientKey.startsWith('SB-');
    const scriptSrc = isSandbox 
      ? "https://app.sandbox.midtrans.com/snap/snap.js"
      : "https://app.snap.midtrans.com/snap/snap.js";

    const existing = document.querySelector(`script[src="${scriptSrc}"]`)
    if (existing) {
      existing.addEventListener("load", () => resolve())
      return
    }

    const script = document.createElement("script")
    script.src = scriptSrc
    script.setAttribute("data-client-key", clientKey)
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Gagal memuat payment gateway"))
    document.body.appendChild(script)
  })
}

interface OrderInfo {
  id: string
  total_amount: number
  customer_name: string
  payment_status: string
  distance_km: number | null
  created_at: string
}

function PaymentContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = searchParams.get("order_id")

  const [selectedMethod, setSelectedMethod] = useState<"online" | "cod" | "wallet">("online")
  const [loading, setLoading] = useState(false)
  const [fetchingData, setFetchingData] = useState(true)
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null)
  const [codError, setCodError] = useState<string | null>(null)
  const [walletBalance, setWalletBalance] = useState<number>(0)

  // Timer logic
  const [now, setNow] = useState(Date.now())
  const [expiryTime, setExpiryTime] = useState<number | null>(null)
  
  // ✅ Ref guard: prevents concurrent payment requests entirely
  const isProcessingRef = useRef(false)

  useEffect(() => {
    const timerId = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timerId)
  }, [])

  const COD_MAX_KM = 15

  useEffect(() => {
    const init = async () => {
      if (!orderId || !isValidUUID(orderId)) {
        router.push("/cart")
        return
      }

      try {
        // RLS ensures only own orders are returned
        const { data: order, error } = await supabase
          .from("orders")
          .select("id, total_amount, customer_name, payment_status, distance_km, created_at")
          .eq("id", orderId)
          .maybeSingle()

        if (error || !order) {
          toast.error("Pesanan tidak ditemukan atau Anda tidak memiliki akses.")
          router.push("/cart")
          return
        }

        // If already processed, redirect to orders
        if (order.payment_status !== "pending" && order.payment_status !== "waiting_payment") {
          router.push("/orders")
          return
        }

        setOrderInfo(order)
        setExpiryTime(new Date(order.created_at || Date.now()).getTime() + 10 * 60 * 1000)

        // Fetch user wallet balance
        const balance = await getWalletBalance()
        setWalletBalance(balance)
        // Auto-select wallet if enough balance
        if (balance >= order.total_amount) {
          setSelectedMethod("wallet")
        }

        // Preemptively warn if COD won't be available
        const dist = Number(order.distance_km ?? 0)
        if (dist > COD_MAX_KM) {
          setCodError(
            `COD tidak tersedia — jarak pesanan Anda ${dist.toFixed(1)} km melebihi batas ${COD_MAX_KM} km.`
          )
        }
      } catch (err) {
        console.error(err)
        router.push("/cart")
      } finally {
        setFetchingData(false)
      }
    }

    init()
  }, [orderId, router])

  // Reset COD error when switching methods
  useEffect(() => {
    if (selectedMethod === "online" || selectedMethod === "wallet") setCodError(null)
  }, [selectedMethod])

  const handleProcessPayment = async () => {
    if (!orderInfo) return

    // ✅ Hard guard: block concurrent requests even if button state is stale
    if (isProcessingRef.current) return
    isProcessingRef.current = true
    setLoading(true)

    try {
      if (selectedMethod === "wallet") {
        if (walletBalance < orderInfo.total_amount) {
          toast.error("Saldo Wallet tidak mencukupi.")
          isProcessingRef.current = false
          setLoading(false)
          return
        }

        try {
          const idempotencyKey = crypto.randomUUID()
          await processPayment(orderInfo.id, idempotencyKey)
          router.push(`/checkout/success?method=wallet&order_id=${orderInfo.id}`)
          return
        } catch (walletErr: any) {
          toast.error(walletErr.message || "Gagal memproses pembayaran Wallet.")
          isProcessingRef.current = false
          setLoading(false)
          return
        }
      }

      if (selectedMethod === "cod") {
        const response = await fetch("/api/payment/cod", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: orderInfo.id }),
        })

        const data = await response.json()

        if (!response.ok) {
          // Show specific COD errors (distance, disabled) clearly
          if (data.code === "COD_DISTANCE_EXCEEDED" || data.code === "COD_DISABLED") {
            setCodError(data.error)
            toast.error(data.error)
            setSelectedMethod("online")
          } else {
            toast.error(data.error || "Gagal konfirmasi COD. Coba lagi.")
          }
          return
        }

        router.push(`/checkout/success?method=cod&order_id=${orderInfo.id}`)
        return
      }

      // ── Online payment ─────────────────────────────────────────
      const response = await fetch("/api/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderInfo.id }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Gagal memproses pembayaran.")
      }
      if (!data.token) {
        throw new Error("Token pembayaran tidak diterima dari server.")
      }

      const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY!
      await loadMidtransScript(clientKey)

      if (!(window as any).snap) {
        throw new Error("Payment gateway tidak siap. Refresh halaman dan coba lagi.")
      }

      ;(window as any).snap.pay(data.token, {
        onSuccess: () => {
          router.push(`/checkout/success?order_id=${orderInfo.id}`)
        },
        onPending: () => {
          toast.info("Pembayaran sedang diproses. Cek status di Pesanan saya.")
          router.push(`/orders?active=${orderInfo.id}`)
        },
        onError: () => {
          toast.error("Terjadi kesalahan saat pembayaran. Pesanan tersimpan di menu Pesanan.")
          router.push(`/orders?active=${orderInfo.id}`)
        },
        onClose: () => {
          toast.info("Pembayaran dibatalkan. Pesanan masih tersimpan.")
          router.push(`/orders?active=${orderInfo.id}`)
        },
      })

    } catch (error: any) {
      toast.error(error.message || "Terjadi kesalahan. Silakan coba lagi.")
    } finally {
      isProcessingRef.current = false
      setLoading(false)
    }
  }

  const distanceKm = Number(orderInfo?.distance_km ?? 0)
  const codUnavailable = distanceKm > COD_MAX_KM
  
  const diff = expiryTime ? expiryTime - now : 0
  const isTimeExpired = diff <= 0 && expiryTime !== null

  if (fetchingData) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-orange-500" size={32} />
        <p className="text-slate-400 text-sm font-medium">Memuat data pesanan...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F5F5] font-sans max-w-md mx-auto pb-32">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap'); * { font-family: 'Inter', sans-serif; }`}</style>

      {/* ── Header ── */}
      <div className="bg-white sticky top-0 z-40 border-b border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 px-4 pt-14 pb-4">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-slate-700 active:scale-90 transition-transform"
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
          </button>
          <h1 className="text-[15px] font-bold text-slate-900 flex-1">Pilih Pembayaran</h1>
          {/* Step indicator */}
          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[10px] font-bold">1</span>
            <span className="w-8 h-px bg-slate-200" />
            <span className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px] font-bold">2</span>
            <span className="text-orange-500 font-semibold ml-0.5">Bayar</span>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">

        {/* ── Order Total Card ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 py-4 flex items-center gap-3">
            <div className="w-11 h-11 bg-orange-50 rounded-xl flex items-center justify-center shrink-0">
              <Wallet size={20} className="text-orange-500" />
            </div>
            <div className="flex-1">
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Total Tagihan</p>
              <p className="text-[22px] font-black text-slate-900 leading-none mt-0.5">
                Rp {orderInfo?.total_amount?.toLocaleString("id-ID")}
              </p>
            </div>
          </div>

          {/* Distance info */}
          {distanceKm > 0 && (
            <div className="px-4 py-2.5 bg-blue-50 border-t border-blue-100 flex items-center gap-2">
              <MapPin size={12} className="text-blue-500 shrink-0" />
              <span className="text-[11px] text-blue-700 font-semibold">
                Jarak pengiriman: {distanceKm.toFixed(1)} km
              </span>
            </div>
          )}
        </div>

        {/* ── COUNTDOWN BANNER ── */}
        {!isTimeExpired && expiryTime && (
          <div className="bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3.5 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-orange-500 shrink-0" />
              <p className="text-[12px] text-orange-800 font-medium">Selesaikan proses pembayaran dalam</p>
            </div>
            <p className="text-[14px] font-black text-orange-600 tabular-nums bg-white px-2.5 py-1 rounded-lg border border-orange-100 shadow-sm">
              {Math.max(0, Math.floor(diff / 60000)).toString().padStart(2, '0')}:
              {Math.max(0, Math.floor((diff % 60000) / 1000)).toString().padStart(2, '0')}
            </p>
          </div>
        )}
        
        {isTimeExpired && (
          <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-sm">
            <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-[13px] text-red-700 font-medium leading-relaxed">
              Waktu pembayaran telah habis. Pesanan ini akan dibatalkan secara otomatis jika Anda belum melakukan pembayaran.
            </p>
          </div>
        )}

        {/* ── Method Selection ── */}
        <div className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-4 space-y-2.5 ${isTimeExpired ? 'opacity-50 pointer-events-none' : ''}`}>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">
            Metode Pembayaran
          </p>

          {/* Wallet */}
          <button
            onClick={() => setSelectedMethod("wallet")}
            className={`w-full p-3.5 rounded-xl flex items-center gap-3.5 transition-all border-2 active:scale-[0.99]
              ${selectedMethod === "wallet"
                ? "bg-indigo-50 border-indigo-400 shadow-sm"
                : "bg-slate-50 border-transparent hover:border-slate-200"
              }`}
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors
              ${selectedMethod === "wallet" ? "bg-indigo-600 text-white shadow-sm shadow-indigo-300/40" : "bg-white text-slate-400 border border-slate-200"}`}
            >
              <Wallet size={20} />
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-bold text-slate-800">Saldo Wallet</p>
                <p className={`text-[12px] font-black ${walletBalance < (orderInfo?.total_amount || 0) ? 'text-red-500' : 'text-indigo-600'}`}>
                  Rp {walletBalance.toLocaleString("id-ID")}
                </p>
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {walletBalance < (orderInfo?.total_amount || 0)
                  ? (
                    <span className="flex items-center gap-1 flex-wrap">
                      Saldo tidak mencukupi untuk pesanan ini.
                      <Link href="/wallet" className="text-indigo-600 font-bold hover:underline">
                        Top Up sekarang
                      </Link>
                    </span>
                  )
                  : "Bayar instan menggunakan saldo Anda"}
              </div>
            </div>
            {selectedMethod === "wallet" && (
              <CheckCircle2 size={18} className="text-indigo-600 shrink-0" />
            )}
          </button>

          {/* Online */}
          <button
            onClick={() => setSelectedMethod("online")}
            className={`w-full p-3.5 rounded-xl flex items-center gap-3.5 transition-all border-2 active:scale-[0.99]
              ${selectedMethod === "online"
                ? "bg-orange-50 border-orange-400 shadow-sm"
                : "bg-slate-50 border-transparent hover:border-slate-200"
              }`}
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors
              ${selectedMethod === "online" ? "bg-orange-500 text-white shadow-sm shadow-orange-300/40" : "bg-white text-slate-400 border border-slate-200"}`}
            >
              <CreditCard size={20} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-[13px] font-bold text-slate-800">Pembayaran Online</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Transfer VA, QRIS, E-Wallet, Kartu Kredit</p>
            </div>
            {selectedMethod === "online" && (
              <CheckCircle2 size={18} className="text-orange-500 shrink-0" />
            )}
          </button>

          {/* COD */}
          <button
            onClick={() => !codUnavailable && setSelectedMethod("cod")}
            disabled={codUnavailable}
            className={`w-full p-3.5 rounded-xl flex items-center gap-3.5 transition-all border-2 active:scale-[0.99]
              ${codUnavailable
                ? "bg-slate-50 border-dashed border-slate-200 opacity-60 cursor-not-allowed"
                : selectedMethod === "cod"
                  ? "bg-orange-50 border-orange-400 shadow-sm"
                  : "bg-slate-50 border-transparent hover:border-slate-200"
              }`}
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors
              ${codUnavailable
                ? "bg-white text-slate-300 border border-slate-200"
                : selectedMethod === "cod"
                  ? "bg-orange-500 text-white shadow-sm shadow-orange-300/40"
                  : "bg-white text-slate-400 border border-slate-200"
              }`}
            >
              <Truck size={20} />
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-bold text-slate-800">Bayar di Tempat (COD)</p>
                {codUnavailable && (
                  <span className="text-[9px] font-bold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                    Tidak Tersedia
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {codUnavailable
                  ? `Hanya tersedia untuk jarak ≤ ${COD_MAX_KM} km`
                  : "Bayar tunai saat kurir tiba di lokasi"}
              </p>
            </div>
            {!codUnavailable && selectedMethod === "cod" && (
              <CheckCircle2 size={18} className="text-orange-500 shrink-0" />
            )}
          </button>
        </div>

        {/* ── COD Error Banner ── */}
        {codError && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex gap-3">
            <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-[12px] text-amber-700 font-medium leading-relaxed">{codError}</p>
          </div>
        )}

        {/* ── Trust Badges ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-4 py-3.5">
          <div className="flex items-start gap-2.5">
            <ShieldCheck size={15} className="text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-[12px] font-semibold text-slate-700">Transaksi Aman & Terenkripsi</p>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Pembayaran diproses oleh Midtrans — payment gateway terpercaya. Data Anda tidak disimpan di server kami.
              </p>
            </div>
          </div>
        </div>

        {/* Info: online payment note */}
        {selectedMethod === "online" && (
          <div className="flex items-start gap-2 px-1">
            <Info size={12} className="text-slate-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Setelah klik Bayar, jendela pembayaran Midtrans akan terbuka. Pesanan dikonfirmasi otomatis setelah pembayaran berhasil.
            </p>
          </div>
        )}

      </div>

      {/* ── Sticky Footer CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-100 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] px-4 pt-4 pb-6">
        <button
          disabled={loading || !orderInfo || isTimeExpired}
          onClick={handleProcessPayment}
          style={{
            background: loading || isTimeExpired ? undefined : "linear-gradient(135deg, #f97316 0%, #ea580c 100%)"
          }}
          className="w-full h-13 py-3.5 text-white rounded-2xl text-[14px] font-bold
            flex items-center justify-center gap-2
            disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none
            shadow-lg shadow-orange-500/25 active:scale-[0.98] transition-transform"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Memproses...</span>
            </>
          ) : isTimeExpired ? (
            "Waktu Habis"
          ) : selectedMethod === "online" ? (
            "Bayar Sekarang"
          ) : (
            "Konfirmasi Pesanan COD"
          )}
        </button>
      </div>
    </div>
  )
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
          <Loader2 className="animate-spin text-orange-500" size={32} />
        </div>
      }
    >
      <PaymentContent />
    </Suspense>
  )
}