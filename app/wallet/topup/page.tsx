"use client"

import { useState, useEffect } from "react"
import * as Icons from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

declare global {
  interface Window {
    snap: any
  }
}

export default function TopUpPage() {
  const router = useRouter()
  const [amount, setAmount] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Load Midtrans Snap script once
  useEffect(() => {
    if (document.querySelector('script[src*="snap.js"]')) return
    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ""
    const isSandbox = clientKey.startsWith('SB-')
    const scriptSrc = isSandbox 
      ? "https://app.sandbox.midtrans.com/snap/snap.js"
      : "https://app.midtrans.com/snap/snap.js"

    const script = document.createElement("script")
    script.src = scriptSrc
    script.setAttribute("data-client-key", clientKey)
    script.async = true
    document.head.appendChild(script)
  }, [])

  const handleTopUp = async () => {
    const numAmount = parseInt(amount, 10)

    if (isNaN(numAmount) || numAmount < 10000) {
      toast.error("Minimal top up adalah Rp 10.000")
      return
    }

    if (numAmount > 10000000) {
      toast.error("Maksimal top up adalah Rp 10.000.000")
      return
    }

    setIsLoading(true)

    try {
      // 1. Minta snap token dari backend
      const res = await fetch("/api/user/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: numAmount }),
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || "Gagal membuat transaksi")

      setIsLoading(false)
      setAmount("")

      // 2. Buka Midtrans Snap popup
      window.snap.pay(data.token, {
        onSuccess: () => {
          toast.success("Top up berhasil! Saldo akan diperbarui segera.")
          router.replace("/wallet")
        },
        onPending: () => {
          toast.info(`Menunggu konfirmasi pembayaran... (Order ID: ${data.orderId})`)
          router.replace("/wallet")
        },
        onError: () => {
          toast.error("Pembayaran gagal. Silakan coba lagi.")
        },
        onClose: () => {
          toast.warning("Pembayaran dibatalkan.")
        },
      })
    } catch (err: any) {
      console.error("[TopUp Error]", err)
      toast.error(err.message || "Gagal melakukan top up")
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto font-sans relative">
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div className="bg-indigo-600 px-4 pt-10 pb-6 relative">
        <header className="flex items-center justify-between text-white">
          <button onClick={() => router.back()} className="p-1 hover:bg-white/10 rounded-full transition-colors" disabled={isLoading}>
            <Icons.ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-medium tracking-wide">Isi Saldo Wallet</h1>
          <div className="w-8" /> {/* Spacer */}
        </header>
      </div>

      {/* ── CONTENT ────────────────────────────────────────────── */}
      <div className="px-4 py-6 space-y-6">
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2 ml-1">
            Masukkan Nominal Top Up
          </label>
          <div className="relative bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-lg">
              Rp
            </span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full pl-14 pr-5 py-5 text-2xl font-bold text-slate-900 outline-none transition-all placeholder:font-medium placeholder:text-slate-300"
              disabled={isLoading}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-3 ml-1 uppercase tracking-wider">
            Pilihan Nominal Cepat
          </label>
          <div className="grid grid-cols-3 gap-3">
            {[10000, 50000, 100000, 500000, 1000000, 2000000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(preset.toString())}
                disabled={isLoading}
                className="py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:border-indigo-600 hover:text-indigo-600 transition-colors focus:border-indigo-600 disabled:opacity-50"
              >
                {preset >= 1000000 ? `${preset / 1000000} Jt` : `${preset / 1000} Rb`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── FIXED BOTTOM BAR ────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-100 p-4">
        <button
          onClick={handleTopUp}
          disabled={isLoading || !amount || parseInt(amount, 10) < 10000}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold tracking-wide transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <Icons.Loader2 className="animate-spin" size={20} />
          ) : (
            <Icons.CreditCard size={20} />
          )}
          {isLoading ? "Memproses..." : "Bayar via Midtrans"}
        </button>
      </div>
    </div>
  )
}
