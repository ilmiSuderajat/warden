"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, Truck, Loader2, CreditCard, Wallet, ShieldCheck } from "lucide-react"
import { supabase } from "@/lib/supabase"

// ✅ UUID validation — cegah injeksi dari URL param
const isValidUUID = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

const loadMidtransScript = (clientKey: string) => {
  return new Promise<void>((resolve, reject) => {
    if ((window as any).snap) { resolve(); return }

    const existingScript = document.querySelector(
      'script[src="https://app.sandbox.midtrans.com/snap/snap.js"]'
    )
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve())
      return
    }

    const script = document.createElement("script")
    script.src = "https://app.sandbox.midtrans.com/snap/snap.js"
    script.setAttribute("data-client-key", clientKey)
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Gagal load Midtrans"))
    document.body.appendChild(script)
  })
}

function PaymentContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const orderId = searchParams.get("order_id")

  const [selectedMethod, setSelectedMethod] = useState<string>("online")
  const [loading, setLoading] = useState(false)
  const [fetchingData, setFetchingData] = useState(true)
  const [orderInfo, setOrderInfo] = useState<{
    id: string
    total_amount: number
    customer_name: string
    payment_status: string
  } | null>(null)

  useEffect(() => {
    const initializePage = async () => {
      // ✅ Validasi format UUID sebelum query ke DB
      if (!orderId || !isValidUUID(orderId)) {
        router.push("/cart")
        return
      }

      try {
        // ✅ Supabase RLS akan memfilter — hanya kembalikan order milik user sendiri
        // Pastikan RLS policy: auth.uid() = user_id pada tabel orders
        const { data: order, error } = await supabase
          .from("orders")
          .select("id, total_amount, customer_name, payment_status")
          .eq("id", orderId)
          .maybeSingle()

        if (error || !order) {
          // ✅ Pesan generik — jangan bocorkan apakah order ada tapi bukan miliknya
          alert("Pesanan tidak ditemukan atau Anda tidak memiliki akses.")
          router.push("/cart")
          return
        }

        if (order.payment_status !== "pending") {
          router.push("/orders")
          return
        }

        setOrderInfo(order)
      } catch (err) {
        console.error(err)
        router.push("/cart")
      } finally {
        setFetchingData(false)
      }
    }

    initializePage()
  }, [orderId, router])

  const handleProcessPayment = async () => {
    if (!orderInfo) return
    setLoading(true)

    try {
      if (selectedMethod === "cod") {
        // ✅ Menggunakan route khusus COD
        const response = await fetch("/api/payment/cod", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: orderInfo.id }),
        })

        const data = await response.json()
        console.log("[Payment] COD Response:", data)

        if (!response.ok) throw new Error(data.error || "Gagal konfirmasi COD")

        setLoading(false)
        router.push("/checkout/success?method=cod")
        return
      }

      // Online payment flow
      console.log("[Payment] Requesting Snap token for order:", orderInfo.id)
      const response = await fetch("/api/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderInfo.id }),
      })

      const data = await response.json()
      console.log("[Payment] API Response:", data)

      if (!response.ok) {
        const errorMsg = data.apiResponse?.error_messages?.[0] || data.details || data.error || "Gagal memproses pembayaran"
        throw new Error(errorMsg)
      }
      if (!data.token) throw new Error("Snap token tidak ditemukan dalam respon server.")

      const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY!
      await loadMidtransScript(clientKey)

      if (!(window as any).snap) throw new Error("Payment gateway tidak siap")

      console.log("[Payment] Calling Snap with token:", data.token)
        ; (window as any).snap.pay(data.token, {
          onSuccess: () => {
            console.log("[Payment] Success")
            setLoading(false);
            router.push("/checkout/success")
          },
          onPending: () => {
            console.log("[Payment] Pending")
            setLoading(false);
            router.push("/orders?status=unpaid")
          },
          onError: (result: any) => {
            console.error("[Payment] Error:", result)
            setLoading(false);
            alert("Terjadi kesalahan saat pembayaran.")
          },
          onClose: () => {
            console.log("[Payment] Closed")
            setLoading(false)
            alert("Pembayaran dibatalkan. Pesanan tersimpan di menu Pesanan.")
            router.push("/orders")
          },
        })
    } catch (error: any) {
      alert(error.message)
      setLoading(false)
    }
  }

  if (fetchingData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
        <p className="text-slate-400 text-sm font-medium">Memuat data...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/80 font-sans max-w-md mx-auto pb-28">
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="flex items-center gap-3 px-5 pt-12 pb-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Pembayaran</h1>
        </div>
      </div>

      <div className="p-5 space-y-6">
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 px-1">Pilih Metode</p>
          <div className="space-y-3">
            <button
              onClick={() => setSelectedMethod("online")}
              className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all border-2 ${selectedMethod === "online"
                ? "bg-white border-indigo-600 shadow-sm shadow-indigo-100"
                : "bg-white border-transparent hover:border-slate-200"
                }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${selectedMethod === "online" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
                }`}>
                <CreditCard size={22} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-slate-800">Pembayaran Online</p>
                <p className="text-[11px] text-slate-400 mt-0.5">VA, QRIS, E-Wallet, dll</p>
              </div>
              {selectedMethod === "online" && <CheckCircle2 size={20} className="text-indigo-600 shrink-0" />}
            </button>

            <button
              onClick={() => setSelectedMethod("cod")}
              className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all border-2 ${selectedMethod === "cod"
                ? "bg-white border-indigo-600 shadow-sm shadow-indigo-100"
                : "bg-white border-transparent hover:border-slate-200"
                }`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${selectedMethod === "cod" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
                }`}>
                <Truck size={22} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-bold text-slate-800">Bayar di Tempat (COD)</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Bayar tunai saat kurir tiba</p>
              </div>
              {selectedMethod === "cod" && <CheckCircle2 size={20} className="text-indigo-600 shrink-0" />}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              <Wallet size={20} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Total Tagihan</p>
              <p className="text-xl font-bold text-slate-900 tracking-tight">
                Rp {orderInfo?.total_amount?.toLocaleString("id-ID")}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 text-slate-500 text-xs">
            <ShieldCheck size={14} className="text-green-500 mt-0.5 shrink-0" />
            <span>Transaksi aman & terenkripsi. Pesanan akan diproses setelah pembayaran berhasil.</span>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-5 bg-white/80 backdrop-blur-md border-t border-slate-100 max-w-md mx-auto">
        <button
          disabled={loading}
          onClick={handleProcessPayment}
          className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:bg-indigo-300 shadow-lg shadow-indigo-200 active:scale-[0.98] transition-transform"
        >
          {loading ? (
            <><Loader2 className="animate-spin" size={18} /><span>Memproses...</span></>
          ) : selectedMethod === "online" ? "Bayar Sekarang" : "Konfirmasi Pesanan COD"}
        </button>
      </div>
    </div>
  )
}

export default function PaymentPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    }>
      <PaymentContent />
    </Suspense>
  )
}