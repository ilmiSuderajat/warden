"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { 
  ChevronLeft, ArrowUpCircle, ArrowDownCircle, 
  History, BarChart3, Receipt, ChevronRight,
  Plus, ArrowUpRight, Loader2, Info
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

export default function DriverWalletPage() {
  const router = useRouter()
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchBalance = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.replace("/login")

      const { data, error } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", session.user.id)
        .maybeSingle()

      if (error) {
        toast.error("Gagal mengambil saldo")
      } else {
        setBalance(data?.balance || 0)
      }
      setLoading(false)
    }

    fetchBalance()
  }, [router])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  if (loading) return (
    <div className="h-screen bg-white flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
    </div>
  )

  return (
    <div className="h-screen bg-slate-50 font-sans max-w-md mx-auto shadow-2xl pb-10 flex flex-col overflow-y-auto">
      
      {/* ─── INDIGO HEADER ─── */}
      <div className="bg-indigo-600 pt-12 pb-8 px-4 relative">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="text-white p-1 hover:bg-white/10 rounded-full transition-colors">
            <ChevronLeft size={24} />
          </button>
          <h1 className="text-xl font-bold text-white">Saldo Saya</h1>
        </div>

        <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 text-white/80 mb-1">
                <span className="text-sm font-medium">Saldo Penjual</span>
                <Info size={14} />
            </div>
            <div className="flex items-center gap-2 mb-6">
                <span className="text-3xl font-bold text-white tracking-tight">
                    {formatCurrency(balance || 0)}
                </span>
                <ChevronRight size={20} className="text-white/60" />
            </div>

            {/* QUICK ACTIONS */}
            <div className="grid grid-cols-2 gap-4 w-full px-4">
                <button 
                  onClick={() => toast.info("Fitur Isi Saldo akan segera hadir")}
                  className="flex items-center justify-center gap-2 bg-white/20 backdrop-blur-md text-white py-2.5 rounded-lg border border-white/20 font-bold text-sm active:scale-95 transition-transform"
                >
                    <Plus size={18} />
                    Isi Saldo
                </button>
                <button 
                  onClick={() => toast.info("Fitur Tarik Saldo akan segera hadir")}
                  className="flex items-center justify-center gap-2 bg-white/20 backdrop-blur-md text-white py-2.5 rounded-lg border border-white/20 font-bold text-sm active:scale-95 transition-transform"
                >
                    <ArrowUpRight size={18} />
                    Tarik Saldo
                </button>
            </div>
        </div>
      </div>

      {/* ─── CONTENT ─── */}
      <div className="mt-4 px-4 space-y-3">
        
        {/* ACTION LIST */}
        <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100">
            <Link href="/driver/wallet/transactions" className="flex items-center justify-between p-4 active:bg-slate-50 transition-colors border-b border-slate-50 group">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <History size={20} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-800">Transaksi</p>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Cek Riwayat Saldo</p>
                    </div>
                </div>
                <ChevronRight size={18} className="text-slate-300 group-hover:translate-x-0.5 transition-transform" />
            </Link>

            <Link href="/driver/wallet/income" className="flex items-center justify-between p-4 active:bg-slate-50 transition-colors border-b border-slate-50 group">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <BarChart3 size={20} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-800">Rangkuman Pendapatan</p>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Berdasarkan Hari & Minggu</p>
                    </div>
                </div>
                <ChevronRight size={18} className="text-slate-300 group-hover:translate-x-0.5 transition-transform" />
            </Link>

            <div className="flex items-center justify-between p-4 active:bg-slate-50 transition-colors group cursor-pointer">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                        <Receipt size={20} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-800">Catatan Pembayaran</p>
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Rincian Per-Order</p>
                    </div>
                </div>
                <ChevronRight size={18} className="text-slate-300 group-hover:translate-x-0.5 transition-transform" />
            </div>
        </div>

        {/* PROMO / INFO BANNER */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex items-start gap-3">
             <div className="bg-indigo-500 text-white rounded-full p-1.5 mt-0.5">
                <Info size={14} />
             </div>
             <div>
                <p className="text-[13px] font-bold text-indigo-800 mb-0.5">Tips Keamanan</p>
                <p className="text-xs text-indigo-700/80 leading-relaxed font-medium">Jangan pernah memberikan kode OTP atau PIN Anda kepada siapa pun, termasuk pihak yang mengaku sebagai kami.</p>
             </div>
        </div>

      </div>

    </div>
  )
}
