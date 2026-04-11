"use client"

import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { 
  ChevronLeft, Loader2, ChevronRight, 
  TrendingUp, Wallet, Award, Gift
} from "lucide-react"
import { toast } from "sonner"

export default function DriverIncomePage() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeRange, setActiveRange] = useState<"day" | "week">("day")

  useEffect(() => {
    const fetchTransactions = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.replace("/login")

      const { data, error } = await supabase
        .from("driver_balance_logs")
        .select("*")
        .eq("driver_id", session.user.id)
        .order("created_at", { ascending: false })

      if (!error) {
        setTransactions(data || [])
      }
      setLoading(false)
    }

    fetchTransactions()
  }, [router])

  const summary = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay()) // Sunday

    const filtered = transactions.filter(tx => {
      const txDate = new Date(tx.created_at)
      if (activeRange === "day") return txDate >= today
      return txDate >= startOfWeek
    })

    const result = {
      total: 0,
      delivery: 0,
      bonus: 0,
      tips: 0,
      count: 0
    }

    filtered.forEach(tx => {
       if (tx.amount > 0) {
          result.total += tx.amount
          if (tx.type === 'income' || tx.type === 'commission' || tx.type === 'credit') result.delivery += tx.amount
          else if (tx.type === 'bonus') result.bonus += tx.amount
          else if (tx.type === 'tip') result.tips += tx.amount
          else result.delivery += tx.amount // default to delivery if unknown but positive
          
          if (tx.type === 'income' || tx.type === 'commission' || tx.type === 'credit') result.count += 1
       }
    })

    return result
  }, [transactions, activeRange])

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
    <div className="h-[100dvh] bg-slate-50 font-sans max-w-md mx-auto shadow-2xl pb-10 flex flex-col overflow-y-auto">
      
      {/* HEADER */}
      <div className="bg-white px-4 py-4 sticky top-0 z-10 flex items-center gap-3">
        <button onClick={() => router.back()} className="p-1 hover:bg-slate-50 rounded-full transition-colors">
            <ChevronLeft size={24} className="text-slate-800" />
        </button>
        <h1 className="text-lg font-bold text-slate-800">Rangkuman Pendapatan</h1>
      </div>

      {/* TABS */}
      <div className="flex bg-white px-4 pb-1">
        <button 
            onClick={() => setActiveRange("day")}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeRange === 'day' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}
        >
            Hari Ini
        </button>
        <button 
            onClick={() => setActiveRange("week")}
            className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeRange === 'week' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}
        >
            Minggu Ini
        </button>
      </div>

      {/* SUMMARY CARD */}
      <div className="p-4">
        <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-white/80 uppercase tracking-widest">Total Pendapatan</span>
                <TrendingUp size={18} className="text-white/60" />
            </div>
            <h2 className="text-3xl font-extrabold mb-1 tracking-tight">{formatCurrency(summary.total)}</h2>
            <p className="text-[10px] font-bold text-white/70 uppercase tracking-wider">{summary.count} Pesanan Diselesaikan</p>
        </div>
      </div>

      {/* BREAKDOWN */}
      <div className="px-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Rincian Pendapatan</h3>
        
        <div className="bg-white rounded-xl overflow-hidden border border-slate-100 shadow-sm">
             <div className="p-4 flex items-center justify-between border-b border-slate-50">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                        <Wallet size={18} />
                    </div>
                    <span className="text-sm font-bold text-slate-700">Ongkos Kirim</span>
                </div>
                <span className="text-sm font-extrabold text-slate-800">{formatCurrency(summary.delivery)}</span>
             </div>

             <div className="p-4 flex items-center justify-between border-b border-slate-50">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                        <Award size={18} />
                    </div>
                    <span className="text-sm font-bold text-slate-700">Bonus Insentif</span>
                </div>
                <span className="text-sm font-extrabold text-slate-800">{formatCurrency(summary.bonus)}</span>
             </div>

             <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                        <Gift size={18} />
                    </div>
                    <span className="text-sm font-bold text-slate-700">Tip dari Pelanggan</span>
                </div>
                <span className="text-sm font-extrabold text-slate-800">{formatCurrency(summary.tips)}</span>
             </div>
        </div>

        {/* FOOTER INFO */}
        <div className="bg-slate-200/50 rounded-xl p-4">
             <p className="text-[10px] leading-relaxed text-slate-500 font-medium text-center">
                Pendapatan Anda akan dikreditkan ke saldo penjual setelah setiap pesanan selesai. Hubungi bantuan jika ada ketidaksesuaian.
             </p>
        </div>
      </div>

    </div>
  )
}
