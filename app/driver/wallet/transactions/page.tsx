"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { 
  ChevronLeft, Loader2, ArrowUpRight, 
  ArrowDownLeft, Filter, Calendar,
  History as HistoryIcon
} from "lucide-react"
import { toast } from "sonner"

export default function DriverTransactionsPage() {
  const router = useRouter()
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTransactions = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.replace("/login")

      // Fetch from driver_balance_logs (correct table per schema)
      const { data, error } = await supabase
        .from("driver_balance_logs")
        .select("*")
        .eq("driver_id", session.user.id)
        .order("created_at", { ascending: false })

      if (error) {
        toast.error("Gagal mengambil riwayat transaksi")
      } else {
        setTransactions(data || [])
      }
      setLoading(false)
    }

    fetchTransactions()
  }, [router])

  const formatCurrency = (amount: number) => {
    const isPositive = amount > 0
    const formatted = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(Math.abs(amount))
    return `${isPositive ? "+" : "-"}${formatted}`
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    })
  }

  if (loading) return (
    <div className="h-screen bg-white flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
    </div>
  )

  return (
    <div className="h-[100dvh] bg-white font-sans max-w-md mx-auto shadow-2xl pb-10 flex flex-col">
      
      {/* HEADER */}
      <div className="bg-white border-b border-slate-100 px-4 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-1 hover:bg-slate-50 rounded-full transition-colors">
                <ChevronLeft size={24} className="text-slate-800" />
            </button>
            <h1 className="text-lg font-bold text-slate-800">Riwayat Transaksi</h1>
        </div>
        <div className="flex items-center gap-3">
            <button className="p-2 hover:bg-slate-50 rounded-lg text-slate-500"><Filter size={20} /></button>
            <button className="p-2 hover:bg-slate-50 rounded-lg text-slate-500"><Calendar size={20} /></button>
        </div>
      </div>

      {/* TRANSACTION LIST */}
      <div className="flex-1 overflow-y-auto">
        {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-10 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <HistoryIcon size={32} className="text-slate-200" />
                </div>
                <h3 className="text-slate-800 font-bold mb-1">Belum Ada Transaksi</h3>
                <p className="text-xs text-slate-400 font-medium">Transaksi Anda akan muncul di sini setelah Anda mulai bekerja.</p>
            </div>
        ) : (
            <div className="divide-y divide-slate-50">
                {transactions.map((tx) => (
                    <div key={tx.id} className="p-4 active:bg-slate-50 transition-colors flex items-start gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${tx.amount > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-600'}`}>
                            {tx.amount > 0 ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-[13px] font-bold text-slate-800 mb-0.5 line-clamp-1 truncate">{tx.description || tx.type}</h4>
                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{formatDate(tx.created_at)}</p>
                        </div>
                        <div className={`text-sm font-extrabold ${tx.amount > 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                            {formatCurrency(tx.amount)}
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

    </div>
  )
}
