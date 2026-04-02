"use client"

import { useEffect, useState } from "react"
import { getWalletBalance, getTransactionHistory, Transaction } from "@/lib/wallet"
import * as Icons from "lucide-react"
import { useRouter } from "next/navigation"
import Skeleton from "@/app/components/Skeleton"
import { toast } from "sonner"
import TopUpModal from "@/app/components/TopUpModal"
import { supabase } from "@/lib/supabase"

type WithdrawRequest = {
  id: string
  amount: number
  bank_name: string
  account_number: string
  account_name: string
  status: "pending" | "approved" | "rejected"
  created_at: string
}

export default function WalletPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState<number>(0)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [withdrawRequests, setWithdrawRequests] = useState<WithdrawRequest[]>([])
  const [activeTab, setActiveTab] = useState<"transactions" | "withdrawals">("transactions")

  // Topup
  const [showTopupModal, setShowTopupModal] = useState(false)

  // Withdraw modal states
  const [showWithdraw, setShowWithdraw] = useState(false)
  const [wdAmount, setWdAmount] = useState("")
  const [wdBank, setWdBank] = useState("")
  const [wdAccount, setWdAccount] = useState("")
  const [wdName, setWdName] = useState("")
  const [wdLoading, setWdLoading] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const bal = await getWalletBalance()
      setBalance(bal)
      const history = await getTransactionHistory()
      setTransactions(history)

      // Fetch withdraw requests
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: wdData } = await supabase
          .from("user_withdraw_requests")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(20)
        setWithdrawRequests(wdData || [])
      }
    } catch (err: any) {
      if (err.message === "User not authenticated") {
        router.push("/login")
        return
      }
      toast.error("Gagal memuat data wallet")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleWithdraw = async () => {
    const amount = parseInt(wdAmount.replace(/\D/g, ""))
    if (isNaN(amount) || amount < 10000) {
      toast.error("Minimal penarikan Rp 10.000")
      return
    }
    if (amount > balance) {
      toast.error("Saldo tidak mencukupi")
      return
    }
    if (!wdBank || !wdAccount || !wdName) {
      toast.error("Lengkapi semua data rekening")
      return
    }

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
      setShowWithdraw(false)
      setWdAmount(""); setWdBank(""); setWdAccount(""); setWdName("")
      fetchData()
    } catch (err: any) {
      toast.error(err.message || "Gagal mengajukan penarikan")
    } finally {
      setWdLoading(false)
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount)

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

  const statusConfig: Record<string, { label: string; color: string }> = {
    pending: { label: "Menunggu", color: "bg-amber-50 text-amber-700 border border-amber-200" },
    approved: { label: "Berhasil", color: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
    rejected: { label: "Ditolak", color: "bg-red-50 text-red-700 border border-red-200" },
  }

  return (
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto font-sans pb-10">
      {/* HEADER */}
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-center bg-white border-b border-slate-100">
        <div className="w-full max-w-md h-14 flex items-center px-4 gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <Icons.ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold text-slate-900">Wallet Saya</h1>
        </div>
      </header>

      <div className="pt-20 px-4">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        ) : (
          <>
            {/* BALANCE CARD */}
            <div className="bg-indigo-600 rounded-2xl p-6 shadow-lg shadow-indigo-100 text-white mb-6 relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-indigo-100 text-xs font-medium uppercase tracking-wider mb-1">Total Saldo</p>
                <h2 className="text-3xl font-black mb-6">{formatCurrency(balance)}</h2>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowTopupModal(true)}
                    className="flex-1 bg-white/20 backdrop-blur-md border border-white/30 py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-sm hover:bg-white/30 transition-colors"
                  >
                    <Icons.PlusCircle size={18} />
                    Top Up
                  </button>
                  <button
                    onClick={() => setShowWithdraw(true)}
                    disabled={balance <= 0}
                    className="flex-1 bg-white/20 backdrop-blur-md border border-white/30 py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-sm hover:bg-white/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Icons.ArrowUpRight size={18} />
                    Withdraw
                  </button>
                </div>
              </div>
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-400/20 rounded-full blur-3xl"></div>
            </div>

            {/* TABS */}
            <div className="flex bg-slate-100 rounded-2xl p-1 mb-4">
              <button
                onClick={() => setActiveTab("transactions")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "transactions" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
              >
                Riwayat Transaksi
              </button>
              <button
                onClick={() => setActiveTab("withdrawals")}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "withdrawals" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
              >
                Penarikan
              </button>
            </div>

            {/* TRANSACTIONS TAB */}
            {activeTab === "transactions" && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-50 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800 text-sm italic">Riwayat Transaksi</h3>
                  <Icons.History size={16} className="text-slate-400" />
                </div>
                {transactions.length === 0 ? (
                  <div className="p-10 flex flex-col items-center justify-center text-center opacity-50">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                      <Icons.Inbox size={24} className="text-slate-400" />
                    </div>
                    <p className="text-xs font-medium text-slate-500">Belum ada transaksi</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-50">
                    {transactions.map((trx) => (
                      <div key={trx.id} className="p-4 flex items-center justify-between active:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-xl ${trx.amount > 0 ? "bg-emerald-50 text-emerald-600" : "bg-slate-50 text-slate-600"}`}>
                            {trx.type === "topup" && <Icons.Plus size={18} />}
                            {trx.type === "refund" && <Icons.RotateCcw size={18} />}
                            {trx.type === "payment" && <Icons.ShoppingBag size={18} />}
                            {trx.type === "commission" && <Icons.Coins size={18} />}
                            {trx.type === "withdraw" && <Icons.ArrowUpRight size={18} />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800 capitalize">{trx.type}</p>
                            <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap">{formatDate(trx.created_at)}</p>
                          </div>
                        </div>
                        <div className="text-right flex flex-col justify-end">
                          <p className={`text-sm font-black ${trx.amount > 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {trx.amount > 0 ? "+" : ""}{formatCurrency(trx.amount)}
                          </p>
                          <p className="text-[10px] text-slate-500 font-medium truncate max-w-[120px]" title={trx.description}>
                            {trx.description}
                          </p>
                          <p className="text-[9px] text-slate-400 font-medium mt-0.5">
                            Saldo: {formatCurrency(trx.balance_after)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* WITHDRAWALS TAB */}
            {activeTab === "withdrawals" && (
              <div className="space-y-3">
                {withdrawRequests.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-100 p-10 flex flex-col items-center text-center opacity-50">
                    <Icons.ArrowUpFromLine size={36} className="text-slate-400 mb-3" />
                    <p className="text-xs font-medium text-slate-500">Belum ada pengajuan penarikan</p>
                  </div>
                ) : (
                  withdrawRequests.map((wd) => {
                    const s = statusConfig[wd.status] || statusConfig.pending
                    return (
                      <div key={wd.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="text-sm font-black text-slate-800">{formatCurrency(wd.amount)}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{wd.bank_name} · {wd.account_number}</p>
                            <p className="text-[10px] text-slate-500 font-medium">{wd.account_name}</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${s.color}`}>{s.label}</span>
                        </div>
                        <p className="text-[10px] text-slate-300 border-t border-slate-50 pt-2">{formatDate(wd.created_at)}</p>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* TOPUP MODAL */}
      <TopUpModal
        isOpen={showTopupModal}
        onClose={() => setShowTopupModal(false)}
        onSuccess={() => { setShowTopupModal(false); fetchData() }}
      />

      {/* WITHDRAW MODAL */}
      {showWithdraw && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center backdrop-blur-sm" onClick={() => setShowWithdraw(false)}>
          <div className="bg-white rounded-t-3xl p-6 w-full max-w-md shadow-2xl animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
            <h2 className="text-lg font-black text-slate-900 mb-1">Tarik Saldo Wallet</h2>
            <p className="text-xs text-slate-500 mb-5">Saldo saat ini: <span className="font-bold text-slate-700">{formatCurrency(balance)}</span></p>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1">Nominal Penarikan</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">Rp</span>
                  <input type="number" placeholder="Min. 10.000" value={wdAmount} onChange={e => setWdAmount(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-slate-100 focus:border-indigo-600 outline-none text-slate-900 font-bold bg-slate-50 transition-colors focus:ring-4 focus:ring-indigo-600/10" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1">Bank / E-Wallet</label>
                  <input type="text" placeholder="BCA / Dana / GoPay" value={wdBank} onChange={e => setWdBank(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-2xl border-2 border-slate-100 focus:border-indigo-600 outline-none text-slate-900 font-medium bg-slate-50 transition-colors focus:ring-4 focus:ring-indigo-600/10" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1">Nomor Akun</label>
                  <input type="text" placeholder="Rekening / No. HP" value={wdAccount} onChange={e => setWdAccount(e.target.value)}
                    className="w-full px-4 py-3.5 rounded-2xl border-2 border-slate-100 focus:border-indigo-600 outline-none text-slate-900 font-medium bg-slate-50 transition-colors focus:ring-4 focus:ring-indigo-600/10" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1">Atas Nama</label>
                <input type="text" placeholder="Nama sesuai rekening" value={wdName} onChange={e => setWdName(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl border-2 border-slate-100 focus:border-indigo-600 outline-none text-slate-900 font-medium bg-slate-50 transition-colors focus:ring-4 focus:ring-indigo-600/10" />
              </div>
            </div>
            <button
              onClick={handleWithdraw}
              disabled={wdLoading}
              className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-all shadow-lg shadow-indigo-600/30 hover:bg-indigo-700"
            >
              {wdLoading ? <Icons.Loader2 className="animate-spin" size={18} /> : <Icons.ArrowUpFromLine size={18} />}
              {wdLoading ? "Memproses..." : "Ajukan Penarikan"}
            </button>
            <p className="text-[10px] text-slate-400 text-center mt-3">Penarikan akan diproses dalam 1×24 jam kerja</p>
          </div>
        </div>
      )}
    </div>
  )
}
