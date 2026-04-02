"use client"

import { useState, useEffect } from "react"
import * as Icons from "lucide-react"
import { toast } from "sonner"

declare global {
  interface Window {
    snap: any
  }
}

interface TopUpModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function TopUpModal({ isOpen, onClose, onSuccess }: TopUpModalProps) {
  const [amount, setAmount] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  // Load Midtrans Snap script once
  useEffect(() => {
    if (document.querySelector('script[src*="snap.js"]')) return
    const script = document.createElement("script")
    script.src = "https://app.midtrans.com/snap/snap.js"
    script.setAttribute("data-client-key", process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || "")
    script.async = true
    document.head.appendChild(script)
  }, [])

  if (!isOpen) return null

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
      onClose()
      setAmount("")

      // 2. Buka Midtrans Snap popup
      window.snap.pay(data.token, {
        onSuccess: () => {
          toast.success("Top up berhasil! Saldo akan diperbarui segera.")
          onSuccess()
        },
        onPending: () => {
          toast.info("Menunggu konfirmasi pembayaran...")
          onSuccess() // Refresh data meski masih pending
        },
        onError: () => {
          toast.error("Pembayaran gagal. Silakan coba lagi.")
        },
        onClose: () => {
          toast.warning("Pembayaran dibatalkan.")
        },
      })
    } catch (err: any) {
      console.error("[TopUpModal Error]", err)
      toast.error(err.message || "Gagal melakukan top up")
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom sm:slide-in-from-bottom duration-300 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
          disabled={isLoading}
        >
          <Icons.X size={20} />
        </button>

        <div className="text-center mb-6 mt-2">
          <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-3 text-indigo-600">
            <Icons.Wallet size={24} />
          </div>
          <h3 className="text-xl font-black text-slate-900">Isi Saldo Wallet</h3>
          <p className="text-xs text-slate-500 mt-1">
            Bayar via Midtrans — semua metode tersedia
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
              Nominal Top Up
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                Rp
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-black text-slate-900 focus:ring-4 focus:ring-indigo-100 outline-none transition-all placeholder:font-normal placeholder:text-slate-300"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[10000, 50000, 100000, 500000, 1000000, 2000000].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(preset.toString())}
                disabled={isLoading}
                className="py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:border-indigo-600 hover:text-indigo-600 transition-all focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
              >
                +{preset >= 1000000 ? `${preset / 1000000}jt` : `${preset / 1000}k`}
              </button>
            ))}
          </div>

          <button
            onClick={handleTopUp}
            disabled={isLoading || !amount || parseInt(amount, 10) < 10000}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl shadow-indigo-200 mt-2 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <Icons.Loader2 className="animate-spin" size={18} />
            ) : (
              <Icons.CreditCard size={18} />
            )}
            {isLoading ? "Memproses..." : "Bayar via Midtrans"}
          </button>
        </div>
      </div>
    </div>
  )
}
