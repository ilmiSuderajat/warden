"use client"

import { useState, useEffect } from "react"
import * as Icons from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function WithdrawPage() {
  const router = useRouter()
  const [balance, setBalance] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  const [wdAmount, setWdAmount] = useState("")
  const [wdBank, setWdBank] = useState("")
  const [wdAccount, setWdAccount] = useState("")
  const [wdName, setWdName] = useState("")
  const [wdLoading, setWdLoading] = useState(false)

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push("/login")
          return
        }
        const { data } = await supabase.from("wallets").select("balance").eq("user_id", user.id).maybeSingle()
        if (data) setBalance(data.balance || 0)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchBalance()
  }, [])

  const handleWithdraw = async () => {
    const amount = parseInt(wdAmount.replace(/\D/g, ""))
    if (isNaN(amount) || amount < 10000) return toast.error("Minimal penarikan Rp 10.000")
    if (amount > balance) return toast.error("Saldo tidak mencukupi")
    if (!wdBank || !wdAccount || !wdName) return toast.error("Lengkapi semua data rekening")

    setWdLoading(true)
    try {
      const res = await fetch("/api/user/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, bank_name: wdBank, account_number: wdAccount, account_name: wdName }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success("Permintaan penarikan berhasil dikirim!")
      router.replace("/wallet")
    } catch (err: any) {
      toast.error(err.message || "Gagal mengajukan penarikan")
    } finally {
      setWdLoading(false)
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount)

  return (
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto font-sans relative pb-24">
      {/* ── HEADER ─────────────────────────────────────────────── */}
      <div className="bg-indigo-600 px-4 pt-10 pb-6 relative">
        <header className="flex items-center justify-between text-white">
          <button onClick={() => router.back()} className="p-1 hover:bg-white/10 rounded-full transition-colors" disabled={wdLoading}>
            <Icons.ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-medium tracking-wide">Tarik Saldo</h1>
          <div className="w-8" />
        </header>
      </div>

      {/* ── CONTENT ────────────────────────────────────────────── */}
      <div className="px-4 py-6 space-y-5">
        <div className="bg-indigo-50/50 rounded-2xl p-5 border border-indigo-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1 tracking-wide">Saldo Tersedia</p>
            {loading ? (
              <div className="h-6 w-24 bg-indigo-100/50 rounded animate-pulse" />
            ) : (
              <p className="text-2xl font-bold text-indigo-700">{formatCurrency(balance)}</p>
            )}
          </div>
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-indigo-400">
            <Icons.Wallet size={20} />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2 ml-1 uppercase tracking-wider">
              Nominal Penarikan
            </label>
            <div className="relative bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">Rp</span>
              <input 
                type="number" 
                placeholder="0" 
                value={wdAmount} 
                onChange={(e) => setWdAmount(e.target.value)}
                className="w-full pl-12 pr-4 py-4 text-lg font-semibold text-slate-900 outline-none transition-colors placeholder:text-slate-300" 
                disabled={wdLoading}
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-2 ml-1">Minimal penarikan adalah Rp 10.000</p>
          </div>

          <div className="h-px bg-slate-100 my-2" />

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-2 ml-1 uppercase tracking-wider">
              Data Rekening Tujuan
            </label>
            <div className="space-y-3">
              <input 
                type="text" 
                placeholder="Nama Bank / E-Wallet (cth: BCA, DANA)" 
                value={wdBank} 
                onChange={(e) => setWdBank(e.target.value)}
                className="w-full px-4 py-3.5 bg-white rounded-xl border border-slate-200 focus:border-indigo-500 outline-none font-medium text-slate-900 text-sm shadow-sm transition-colors" 
                disabled={wdLoading}
              />
              <input 
                type="text" 
                placeholder="Nomor Rekening / No HP" 
                value={wdAccount} 
                onChange={(e) => setWdAccount(e.target.value)}
                className="w-full px-4 py-3.5 bg-white rounded-xl border border-slate-200 focus:border-indigo-500 outline-none font-medium text-slate-900 text-sm shadow-sm transition-colors" 
                disabled={wdLoading}
              />
              <input 
                type="text" 
                placeholder="Nama Atas Rekening" 
                value={wdName} 
                onChange={(e) => setWdName(e.target.value)}
                className="w-full px-4 py-3.5 bg-white rounded-xl border border-slate-200 focus:border-indigo-500 outline-none font-medium text-slate-900 text-sm shadow-sm transition-colors" 
                disabled={wdLoading}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── FIXED BOTTOM BAR ────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-100 p-4">
        <button 
          onClick={handleWithdraw} 
          disabled={wdLoading || balance <= 0 || !wdAmount || parseInt(wdAmount) < 10000}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold tracking-wide transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
        >
          {wdLoading ? <Icons.Loader2 className="animate-spin" size={20} /> : <Icons.Upload size={20} />}
          {wdLoading ? "Memproses..." : "Konfirmasi Tarik Saldo"}
        </button>
      </div>
    </div>
  )
}
