"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, Truck, Loader2, CreditCard } from "lucide-react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Helper loader Midtrans (anti double inject + nunggu ready)
const loadMidtransScript = (clientKey: string) => {
  return new Promise<void>((resolve, reject) => {
    if ((window as any).snap) {
      resolve()
      return
    }

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
      if (!orderId) {
        router.push("/cart")
        return
      }

      try {
        const { data: order, error } = await supabase
          .from("orders")
          .select("id, total_amount, customer_name, payment_status")
          .eq("id", orderId)
          .single()

        if (error || !order) {
          alert("Pesanan tidak ditemukan.")
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
      // ======================
      // COD
      // ======================
      if (selectedMethod === "cod") {
        const { error } = await supabase
          .from("orders")
          .update({ payment_status: "processing" })
          .eq("id", orderInfo.id)

        if (error) throw error

        setLoading(false)
        router.push("/checkout/success?method=cod")
        return
      }

      // ======================
      // ONLINE PAYMENT
      // ======================
      const response = await fetch("/api/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderInfo.id }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Gagal memproses pembayaran")
      }

      const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY!
      await loadMidtransScript(clientKey)

      if (!(window as any).snap) {
        throw new Error("Midtrans Snap belum siap, coba lagi")
      }

      ;(window as any).snap.pay(data.token, {
        onSuccess: function () {
          setLoading(false)
          router.push("/checkout/success")
        },
        onPending: function () {
          setLoading(false)
          router.push("/orders?status=unpaid")
        },
        onError: function () {
          setLoading(false)
          alert("Terjadi kesalahan saat pembayaran.")
        },
        onClose: function () {
          setLoading(false)
          alert(
            "Pembayaran dibatalkan. Pesanan tetap tersimpan di menu Pesanan."
          )
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto pb-32">
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b flex items-center px-5 max-w-md mx-auto z-50">
        <button onClick={() => router.back()}>
          <ArrowLeft size={24} />
        </button>
        <h1 className="ml-3 font-bold">Pembayaran</h1>
      </header>

      <main className="pt-24 px-5">
        <div className="space-y-3 mb-6">
          <p className="text-xs font-bold text-slate-400 uppercase">
            Pilih Metode
          </p>

          {/* ONLINE */}
          <button
            onClick={() => setSelectedMethod("online")}
            className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${
              selectedMethod === "online"
                ? "border-indigo-600 bg-indigo-50"
                : "bg-white border-transparent"
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`p-3 rounded-xl ${
                  selectedMethod === "online"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                <CreditCard size={20} />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">Pembayaran Online</p>
                <p className="text-[10px] text-slate-400">
                  VA, QRIS, E-Wallet
                </p>
              </div>
            </div>
            {selectedMethod === "online" && (
              <CheckCircle2 size={20} className="text-indigo-600" />
            )}
          </button>

          {/* COD */}
          <button
            onClick={() => setSelectedMethod("cod")}
            className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${
              selectedMethod === "cod"
                ? "border-indigo-600 bg-indigo-50"
                : "bg-white border-transparent"
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`p-3 rounded-xl ${
                  selectedMethod === "cod"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                <Truck size={20} />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">
                  Bayar di Tempat (COD)
                </p>
                <p className="text-[10px] text-slate-400">
                  Bayar saat kurir sampai
                </p>
              </div>
            </div>
            {selectedMethod === "cod" && (
              <CheckCircle2 size={20} className="text-indigo-600" />
            )}
          </button>
        </div>

        <div className="bg-white rounded-2xl p-5 border shadow-sm">
          <div className="flex justify-between text-lg font-black">
            <span>Total Bayar</span>
            <span>
              Rp {orderInfo?.total_amount?.toLocaleString("id-ID")}
            </span>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-5 bg-white border-t max-w-md mx-auto">
        <button
          disabled={loading}
          onClick={handleProcessPayment}
          className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:bg-slate-300"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={18} />
          ) : selectedMethod === "online" ? (
            "Bayar Sekarang"
          ) : (
            "Buat Pesanan COD"
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
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
        </div>
      }
    >
      <PaymentContent />
    </Suspense>
  )
}