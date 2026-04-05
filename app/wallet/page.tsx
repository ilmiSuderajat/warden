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
  const [points, setPoints] = useState<number>(0)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [withdrawRequests, setWithdrawRequests] = useState<WithdrawRequest[]>([])
  const [activeTab, setActiveTab] = useState<"transactions" | "withdrawals">("transactions")

  // Transaction Detail Modal
  const [selectedTrx, setSelectedTrx] = useState<Transaction | null>(null)
  const [orderDetail, setOrderDetail] = useState<any | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

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
      // Fetch wallet data (balance & points)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: walletData } = await supabase
          .from("wallets")
          .select("balance, points_balance")
          .eq("user_id", user.id)
          .maybeSingle()
        
        if (walletData) {
          setBalance(walletData.balance || 0)
          setPoints(walletData.points_balance || 0)
        }

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

  const fetchOrderDetail = async (orderId: string) => {
    setLoadingDetail(true)
    try {
      const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).single()
      const { data: items } = await supabase.from("order_items").select("*").eq("order_id", orderId)
      setOrderDetail({ ...order, items: items || [] })
    } catch (err) {
      console.error("Error fetching order detail:", err)
    } finally {
      setLoadingDetail(false)
    }
  }

  useEffect(() => {
    if (selectedTrx?.order_id) {
      fetchOrderDetail(selectedTrx.order_id)
    } else {
      setOrderDetail(null)
    }
  }, [selectedTrx])

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

  const [showExchangeModal, setShowExchangeModal] = useState(false)
  const [exchangeAmount, setExchangeAmount] = useState("")
  const [exchanging, setExchanging] = useState(false)

  const handleExchangePoints = async () => {
    const pts = parseInt(exchangeAmount)
    if (isNaN(pts) || pts <= 0) return toast.error("Minimal penukaran 1 poin")
    if (pts > points) return toast.error("Poin tidak mencukupi")

    setExchanging(true)
    try {
      const res = await fetch("/api/points/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points: pts })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      toast.success("Penukaran poin berhasil!")
      setExchangeAmount("")
      setShowExchangeModal(false)
      fetchData()
    } catch (err: any) {
      toast.error(err.message || "Gagal menukar poin")
    } finally {
      setExchanging(false)
    }
  }

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
            <div className="bg-indigo-600 rounded-[2rem] p-6 shadow-xl shadow-indigo-100 text-white mb-4 relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-white/60 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Total Saldo</p>
                <div className="flex items-baseline gap-1 mb-6">
                   <h2 className="text-3xl font-black">{formatCurrency(balance).replace('Rp', '')}</h2>
                   <span className="text-sm font-black text-white/50 tracking-tighter">IDR</span>
                </div>
                <div className="flex gap-2.5">
                  <button
                    onClick={() => setShowTopupModal(true)}
                    className="flex-1 bg-white p-3.5 rounded-2xl flex items-center justify-center gap-2 font-black text-xs text-indigo-700 hover:bg-indigo-50 shadow-lg shadow-indigo-900/10 transition-all active:scale-[0.98]"
                  >
                    <Icons.PlusCircle size={16} strokeWidth={3} />
                    TOP UP
                  </button>
                  <button
                    onClick={() => setShowWithdraw(true)}
                    disabled={balance <= 0}
                    className="flex-1 bg-indigo-500/50 backdrop-blur-md border border-white/20 p-3.5 rounded-2xl flex items-center justify-center gap-2 font-black text-xs hover:bg-indigo-500/70 transition-all active:scale-[0.98] disabled:opacity-40"
                  >
                    <Icons.ArrowUpRight size={16} strokeWidth={3} />
                    TARIK
                  </button>
                </div>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl"></div>
              <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-900/20 rounded-full -ml-20 -mb-20 blur-3xl"></div>
            </div>

             {/* POINTS CARD */}
             <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-100 mb-6 flex items-center justify-between group overflow-hidden relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-yellow-50 to-transparent -z-0 opacity-50 group-hover:rotate-12 transition-transform duration-700"></div>
                <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 bg-yellow-50 rounded-2xl flex items-center justify-center border border-yellow-100 shadow-sm shadow-yellow-50 transition-colors group-hover:bg-yellow-100">
                        <Icons.Coins size={22} className="text-yellow-600" />
                    </div>
                    <div>
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Loyalty Points</p>
                        <div className="flex items-center gap-1.5">
                           <span className="text-lg font-black text-slate-900 leading-none">{points.toLocaleString()}</span>
                           <span className="text-[10px] font-bold text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded-md">POIN</span>
                        </div>
                    </div>
                </div>
                <button 
                  onClick={() => setShowExchangeModal(true)}
                  className="relative z-10 px-5 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-slate-100 hover:bg-slate-800 transition-all active:scale-95"
                >
                  Tukar
                </button>
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
                      <div 
                        key={trx.id} 
                        onClick={() => setSelectedTrx(trx)}
                        className="p-4 flex items-center justify-between active:bg-slate-50 hover:bg-slate-50 transition-all cursor-pointer group border-b border-slate-50 last:border-0"
                      >
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
      {/* TRANSACTION DETAIL MODAL */}
      {selectedTrx && (
        <div 
          className="fixed inset-0 bg-slate-900/60 z-[60] flex items-end justify-center backdrop-blur-sm transition-opacity"
          onClick={() => setSelectedTrx(null)}
        >
          <div 
            className="bg-white rounded-t-[32px] w-full max-w-md shadow-2xl animate-in slide-in-from-bottom max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white pt-5 pb-3 px-6 z-10">
              <div className="w-12 h-1 bg-slate-100 rounded-full mx-auto mb-4" />
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-black text-slate-900">Rincian Transaksi</h2>
                <button onClick={() => setSelectedTrx(null)} className="p-2 bg-slate-100 text-slate-400 rounded-full hover:text-slate-600 transition-colors">
                  <Icons.X size={20} />
                </button>
              </div>
            </div>

            <div className="px-6 pb-12">
              {/* Amount Area */}
              <div className="text-center py-8 mb-6 bg-slate-50/50 rounded-3xl border border-slate-100/80">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Jumlah Mutasi</p>
                <p className={`text-3xl font-black ${selectedTrx.amount > 0 ? "text-emerald-600" : "text-slate-900"}`}>
                  {selectedTrx.amount > 0 ? "+" : ""}{formatCurrency(selectedTrx.amount)}
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-100 rounded-lg shadow-sm">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Status: Berhasil</span>
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                </div>
              </div>

              <div className="space-y-6">
                {/* Meta Section */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <div className="w-1 h-3 bg-indigo-500 rounded-full" />
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Informasi Umum</h3>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3.5 shadow-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-tight">Kategori</span>
                      <span className="text-[11px] text-slate-800 font-black uppercase tracking-tight">{selectedTrx.type}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-tight">Waktu Transaksi</span>
                      <span className="text-[11px] text-slate-700 font-bold tracking-tight">{formatDate(selectedTrx.created_at)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-tight">ID Referensi</span>
                      <span className="text-[11px] text-slate-500 font-mono font-bold uppercase">{selectedTrx.id.split('-')[0]}</span>
                    </div>
                  </div>
                </div>

                {/* Items Section (For Payments/Refunds) */}
                {selectedTrx.order_id && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-3 px-1">
                      <div className="w-1 h-3 bg-indigo-500 rounded-full" />
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Pesanan</h3>
                    </div>
                    {loadingDetail ? (
                      <div className="flex justify-center py-10 bg-slate-50 rounded-2xl animate-pulse">
                        <Icons.Loader2 size={24} className="text-indigo-400 animate-spin" />
                      </div>
                    ) : orderDetail ? (
                      <div className="space-y-4">
                        <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3.5 shadow-sm">
                          {orderDetail.items.map((item: any) => (
                            <div key={item.id} className="flex justify-between items-center">
                              <div className="flex items-center gap-3">
                                <span className="text-[11px] font-black text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md">{item.quantity}x</span>
                                <span className="text-[11px] font-black text-slate-700">{item.product_name.split(' | ')[0]}</span>
                              </div>
                              <span className="text-[11px] font-bold text-slate-600">{formatCurrency(item.price * item.quantity)}</span>
                            </div>
                          ))}
                          <div className="pt-3 border-t border-slate-50 flex justify-between items-center">
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-tight">Subtotal Order</span>
                            <span className="text-[11px] text-slate-800 font-black tracking-tight">{formatCurrency(orderDetail.subtotal_amount)}</span>
                          </div>
                   {orderDetail.shipping_amount > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-tight">Ongkos Kirim</span>
                            <span className="text-[11px] text-slate-800 font-black tracking-tight">{formatCurrency(orderDetail.shipping_amount)}</span>
                          </div>
                      )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-5 bg-amber-50 text-amber-600 rounded-2xl text-[10px] font-bold text-center border border-amber-100">
                         Rincian item tidak tersedia untuk transaksi ini.
                      </div>
                    )}
                  </div>
                )}

                {/* Description logic for generic logs */}
                {(!selectedTrx.order_id) && (
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 border-dashed">
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed italic">
                      "{selectedTrx.description || 'Tidak ada catatan tambahan.'}"
                    </p>
                  </div>
                )}

                {/* Ledger info */}
                <div className="bg-slate-900 rounded-2xl p-4 text-center">
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em] mb-1">Buku Besar Transaksi Verifikasi</p>
                  <p className="text-white text-xs font-bold font-mono">Saldo Sesudah: {formatCurrency(selectedTrx.balance_after)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* EXCHANGE MODAL */}
      {showExchangeModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-[70] flex items-end justify-center backdrop-blur-sm" onClick={() => setShowExchangeModal(false)}>
           <div className="bg-white rounded-t-[2.5rem] p-8 w-full max-w-md shadow-2xl animate-in slide-in-from-bottom duration-500" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-8" />
              <div className="text-center mb-8">
                 <div className="w-16 h-16 bg-yellow-50 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-yellow-100 italic group translate-y-0 hover:-translate-y-2 transition-transform duration-500">
                    <Icons.Coins size={32} className="text-yellow-600 group-hover:rotate-12 transition-transform" />
                 </div>
                 <h2 className="text-xl font-black text-slate-900">Tukar Poin Jadi Saldo</h2>
                 <p className="text-xs text-slate-400 font-medium px-10 mt-1 leading-relaxed">Poin Anda akan dikonversi menjadi saldo wallet secara instan.</p>
              </div>

              <div className="space-y-6 mb-8">
                <div className="bg-slate-50 p-4 rounded-2xl flex items-center justify-between border border-dashed border-slate-200 shadow-inner">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Poin Tersedia</span>
                    <span className="text-sm font-black text-slate-800">{points.toLocaleString()}</span>
                </div>

                <div className="relative">
                   <Icons.Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" size={18} />
                   <input 
                     type="number" 
                     placeholder="Jumlah poin yang ditukar..." 
                     value={exchangeAmount}
                     onChange={e => setExchangeAmount(e.target.value)}
                     className="w-full pl-12 pr-4 py-5 bg-white border-2 border-slate-100 focus:border-indigo-600 rounded-3xl text-sm font-black outline-none transition-all focus:ring-8 focus:ring-indigo-600/5 shadow-sm"
                   />
                </div>
                
                <div className="p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100 flex items-center gap-3">
                   <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse"></div>
                   <p className="text-[10px] font-bold text-indigo-700 italic">Nilai Tukar: 1 Poin = Rp 1</p>
                </div>
              </div>

              <div className="flex gap-3">
                 <button 
                   onClick={() => setShowExchangeModal(false)}
                   className="flex-1 px-5 py-4 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all active:scale-[0.98]"
                 >
                   Batal
                 </button>
                 <button 
                   onClick={handleExchangePoints}
                   disabled={exchanging || !exchangeAmount || parseInt(exchangeAmount) <= 0}
                   className="flex-[2] px-5 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:bg-slate-100 disabled:shadow-none"
                 >
                   {exchanging ? <Icons.Loader2 size={16} className="animate-spin mx-auto" /> : "Konfirmasi Tukar"}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  )
}
