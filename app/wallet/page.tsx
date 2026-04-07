"use client"

import { useEffect, useState, useMemo } from "react"
import { getTransactionHistory, Transaction } from "@/lib/wallet"
import * as Icons from "lucide-react"
import { useRouter } from "next/navigation"
import Skeleton from "@/app/components/Skeleton"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"

type WithdrawRequest = {
  id: string
  amount: number
  bank_name: string
  bank_account: string
  bank_holder: string
  status: "pending" | "approved" | "rejected"
  requested_at: string
}

type AllTransaction = {
  id: string
  type: string
  amount: number
  balance_after: number
  description: string
  order_id?: string
  created_at: string
  source: "ledger" | "wallet_tx"
}

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  topup:          { label: "Top Up",        icon: Icons.Download,       color: "text-indigo-600", bg: "bg-indigo-50" },
  refund:         { label: "Refund",         icon: Icons.RotateCcw,      color: "text-indigo-600", bg: "bg-indigo-50" },
  payment:        { label: "Pembayaran",     icon: Icons.ShoppingBag,    color: "text-indigo-600", bg: "bg-indigo-50" },
  commission:     { label: "Komisi",         icon: Icons.Coins,          color: "text-indigo-600", bg: "bg-indigo-50" },
  withdraw:       { label: "Tarik Saldo",    icon: Icons.Upload,         color: "text-indigo-600", bg: "bg-indigo-50" },
  points_exchange:{ label: "Tukar Poin",    icon: Icons.Sparkles,       color: "text-indigo-600", bg: "bg-indigo-50" },
}

const FILTER_OPTIONS = ["Semua", "Masuk", "Keluar"] as const
type FilterOption = typeof FILTER_OPTIONS[number]

export default function WalletPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState<number>(0)
  const [points, setPoints] = useState<number>(0)
  const [allTransactions, setAllTransactions] = useState<AllTransaction[]>([])
  const [withdrawRequests, setWithdrawRequests] = useState<WithdrawRequest[]>([])

  const [activeTab, setActiveTab] = useState<"history" | "withdrawals">("history")
  const [activeFilter, setActiveFilter] = useState<FilterOption>("Semua")

  // Transaction Detail Modal
  const [selectedTrx, setSelectedTrx] = useState<AllTransaction | null>(null)
  const [orderDetail, setOrderDetail] = useState<any | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Exchange modal
  const [showExchangeModal, setShowExchangeModal] = useState(false)
  const [exchangeAmount, setExchangeAmount] = useState("")
  const [exchanging, setExchanging] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }

      // Parallel fetch: wallet data, main ledger, withdraw requests
      const [walletRes, ledgerRes, wdRes] = await Promise.all([
        supabase.from("wallets").select("balance, points_balance").eq("user_id", user.id).maybeSingle(),
        getTransactionHistory(100).catch(() => [] as Transaction[]),
        supabase.from("withdraw_requests")
          .select("*")
          .eq("user_id", user.id)
          .order("requested_at", { ascending: false })
          .limit(30),
      ])

      if (walletRes.data) {
        setBalance(walletRes.data.balance || 0)
        setPoints(walletRes.data.points_balance || 0)
      }

      const ledgerTxs: AllTransaction[] = (ledgerRes || []).map((t) => ({ ...t, source: "ledger" as const }))
      const merged = ledgerTxs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      
      setAllTransactions(merged)
      setWithdrawRequests(wdRes.data || [])

    } catch (err: any) {
      if (err.message === "User not authenticated") { router.push("/login"); return }
      toast.error("Gagal memuat data wallet")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const fetchOrderDetail = async (orderId: string) => {
    setLoadingDetail(true)
    try {
      const [orderRes, itemsRes] = await Promise.all([
        supabase.from("orders").select("*").eq("id", orderId).single(),
        supabase.from("order_items").select("*").eq("order_id", orderId),
      ])
      setOrderDetail({ ...orderRes.data, items: itemsRes.data || [] })
    } catch (err) {
      console.error("Error fetching order detail:", err)
    } finally {
      setLoadingDetail(false)
    }
  }

  useEffect(() => {
    if (selectedTrx?.order_id) fetchOrderDetail(selectedTrx.order_id)
    else setOrderDetail(null)
  }, [selectedTrx])

  useEffect(() => { fetchData() }, [])

  const handleExchangePoints = async () => {
    const pts = parseInt(exchangeAmount)
    if (isNaN(pts) || pts <= 0) return toast.error("Masukkan jumlah poin yang valid")
    if (pts > points) return toast.error("Poin tidak mencukupi")

    setExchanging(true)
    try {
      const res = await fetch("/api/points/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points: pts }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success("Penukaran poin berhasil!")
      setExchangeAmount(""); setShowExchangeModal(false)
      fetchData()
    } catch (err: any) {
      toast.error(err.message || "Gagal menukar poin")
    } finally {
      setExchanging(false)
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount)

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

  const formatDateShort = (s: string) =>
    new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })

  // Filtered transactions
  const filteredTrx = useMemo(() => {
    if (activeFilter === "Semua") return allTransactions
    if (activeFilter === "Masuk") return allTransactions.filter(t => t.amount > 0)
    if (activeFilter === "Keluar") return allTransactions.filter(t => t.amount <= 0)
    return allTransactions
  }, [allTransactions, activeFilter])

  const statusConfig: Record<string, { label: string; color: string }> = {
    pending:  { label: "Sedang Diproses",  color: "text-amber-500" },
    approved: { label: "Berhasil", color: "text-emerald-500" },
    rejected: { label: "Batal",  color: "text-slate-500" },
  }

  return (
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto font-sans pb-6">

      {/* ── SHOPEEPAY-STYLE HEADER (INDIGO) ─────────────────────── */}
      <div className="bg-indigo-600 px-4 pt-10 pb-20 relative">
        <header className="flex items-center justify-between mb-6 text-white">
          <button onClick={() => router.back()} className="p-1 hover:bg-white/10 rounded-full transition-colors">
            <Icons.ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-medium tracking-wide">Wallet</h1>
          <button className="p-1 hover:bg-white/10 rounded-full transition-colors">
            <Icons.Settings size={22} className="opacity-0" /> {/* Spacer for centering */}
          </button>
        </header>

        <div className="text-white px-2">
          <div className="flex items-center gap-2 mb-1 opacity-90">
            <Icons.Wallet size={16} />
            <span className="text-sm">Total Saldo Aktif</span>
          </div>
          {loading ? (
            <Skeleton className="h-10 w-40 bg-white/20 rounded-lg mt-1" />
          ) : (
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-4xl font-semibold tracking-tight">{formatCurrency(balance)}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── FLOATING ACTION CARD ────────────────────────────────── */}
      <div className="px-4 -mt-10 relative z-10">
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4">
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Isi Saldo",  icon: Icons.ArrowDownSquare, onClick: () => router.push('/wallet/topup'), color: "text-indigo-600" },
              { label: "Minta Dana", icon: Icons.QrCode,          onClick: () => toast.info("Fitur akan datang!"), color: "text-indigo-600", disabled: false },
              { label: "Penarikan",  icon: Icons.ArrowUpSquare,   onClick: () => router.push('/wallet/withdraw'), color: "text-indigo-600", disabled: false },
              { label: "Tukar Poin", icon: Icons.Sparkles,        onClick: () => setShowExchangeModal(true), color: "text-indigo-600", disabled: points <= 0 },
            ].map(({ label, icon: Icon, onClick, color, disabled }) => (
              <button
                key={label}
                onClick={onClick}
                disabled={disabled}
                className="flex flex-col items-center justify-start gap-2.5 group disabled:opacity-50"
              >
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 transition-transform active:scale-95">
                  <Icon size={24} strokeWidth={2} />
                </div>
                <span className="text-[11px] font-medium text-slate-700 leading-tight text-center">{label}</span>
              </button>
            ))}
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-500">
              <Icons.Coins size={20} />
              <span className="text-sm font-semibold text-slate-700">Koin Reward</span>
            </div>
            <span className="font-semibold text-amber-500">{points.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* ── TRANSACTIONS CONTENT ────────────────────────────────── */}
      <div className="px-4 mt-2">

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden min-h-[50vh]">
          {/* Tabs header */}
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => setActiveTab("history")}
              className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${
                activeTab === "history" ? "text-indigo-600" : "text-slate-500"
              }`}
            >
              Riwayat Transaksi
              {activeTab === "history" && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-indigo-600 rounded-t-full" />}
            </button>
            <button
              onClick={() => setActiveTab("withdrawals")}
              className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${
                activeTab === "withdrawals" ? "text-indigo-600" : "text-slate-500"
              }`}
            >
              Penarikan
              {activeTab === "withdrawals" && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-indigo-600 rounded-t-full" />}
            </button>
          </div>

          <div className="p-0">
            {/* HISTORY TAB */}
            {activeTab === "history" && (
              <>
                <div className="flex gap-2 p-3 border-b border-slate-50 overflow-x-auto scrollbar-hide">
                  {FILTER_OPTIONS.map((f) => (
                    <button
                      key={f}
                      onClick={() => setActiveFilter(f as FilterOption)}
                      className={`px-4 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${
                        activeFilter === f
                          ? "bg-indigo-50 text-indigo-600 border border-indigo-200"
                          : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                {loading ? (
                  <div className="divide-y divide-slate-100 p-0">
                    {[...Array(5)].map((_, i) => (
                       <div key={i} className="p-4 flex gap-3"><Skeleton className="w-10 h-10 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-1/3" /></div></div>
                    ))}
                  </div>
                ) : filteredTrx.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                      <Icons.Receipt className="text-slate-300" size={32} />
                    </div>
                    <p className="text-sm font-medium text-slate-500">Belum ada transaksi</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredTrx.map((trx) => (
                      <ShopeeTrxRow key={trx.id} trx={trx} onTap={() => setSelectedTrx(trx)} formatCurrency={formatCurrency} formatDate={formatDateShort} />
                    ))}
                  </div>
                )}
              </>
            )}

            {/* WITHDRAWALS TAB */}
            {activeTab === "withdrawals" && (
              <div className="p-0">
                {loading ? (
                  <div className="divide-y divide-slate-100 p-0">
                     {[...Array(3)].map((_, i) => (
                       <div key={i} className="p-4 space-y-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-5 w-1/3" /><Skeleton className="h-3 w-1/2" /></div>
                     ))}
                  </div>
                ) : withdrawRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                      <Icons.ArrowUpSquare className="text-slate-300" size={32} />
                    </div>
                    <p className="text-sm font-medium text-slate-500">Belum ada pengajuan penarikan</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {withdrawRequests.map((wd) => {
                      const s = statusConfig[wd.status] || statusConfig.pending
                      return (
                        <div key={wd.id} className="p-4 flex gap-3 hover:bg-slate-50 transition-colors">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-500">
                            <Icons.Building2 size={20} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-0.5">
                              <p className="text-[13px] font-semibold text-slate-800 tracking-tight capitalize">Tarik Dana - {wd.bank_name}</p>
                              <p className={`text-[13px] font-semibold ${s.color}`}>{s.label}</p>
                            </div>
                            <p className="text-xs text-slate-500 mb-1">{wd.bank_account} a.n. {wd.bank_holder}</p>
                            <p className="text-[11px] text-slate-400">{formatDate(wd.requested_at)}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── TRANSACTION DETAIL MODAL ────────────────────────────── */}
      {selectedTrx && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-end justify-center backdrop-blur-sm" onClick={() => setSelectedTrx(null)}>
          <div className="bg-white rounded-t-2xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white flex justify-between items-center p-4 border-b border-slate-100 z-10">
               <h2 className="text-base font-semibold text-slate-900">Rincian Transaksi</h2>
               <button onClick={() => setSelectedTrx(null)} className="text-slate-400">
                 <Icons.X size={24} />
               </button>
            </div>
            
            <div className="px-5 pb-8 pt-6">
              {/* Status Header */}
              <div className="flex flex-col items-center justify-center mb-6">
                <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mb-3">
                   <Icons.Check size={28} />
                </div>
                <h3 className="text-sm font-medium text-slate-500 mb-1">Pembayaran Berhasil</h3>
                <p className="text-3xl font-semibold text-slate-900 tracking-tight">
                  {formatCurrency(Math.abs(selectedTrx.amount))}
                </p>
              </div>

              {/* Details */}
              <div className="space-y-4">
                 <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100">
                    <DetailRow label="Kategori" value={TYPE_CONFIG[selectedTrx.type]?.label ?? selectedTrx.type} isFirst />
                    <DetailRow label="Waktu" value={formatDate(selectedTrx.created_at)} />
                    <DetailRow label="No. Referensi" value={selectedTrx.id.split("-")[0].toUpperCase()} highlight />
                    {selectedTrx.description && <DetailRow label="Catatan" value={selectedTrx.description} />}
                 </div>

                 {/* Order Items Section - Flat Shopee Style */}
                 {selectedTrx.order_id && (
                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                       <div className="p-3 bg-slate-50 border-b border-slate-100">
                         <p className="text-xs font-semibold text-slate-700">Rincian Pesanan</p>
                       </div>
                       <div className="p-3">
                         {loadingDetail ? (
                           <div className="flex justify-center py-4">
                             <Icons.Loader2 size={20} className="text-indigo-400 animate-spin" />
                           </div>
                         ) : orderDetail ? (
                           <div className="space-y-3">
                             {orderDetail.items.map((item: any) => (
                               <div key={item.id} className="flex justify-between items-start">
                                 <div className="flex-1">
                                   <p className="text-[13px] font-medium text-slate-800 line-clamp-1">{item.product_name.split(" | ")[0]}</p>
                                   <p className="text-xs text-slate-400">{item.quantity} x {formatCurrency(item.price)}</p>
                                 </div>
                                 <span className="text-[13px] font-medium text-slate-800 pl-4">{formatCurrency(item.price * item.quantity)}</span>
                               </div>
                             ))}
                             <div className="pt-3 mt-1 border-t border-dashed border-slate-200 flex justify-between items-center text-[13px]">
                               <span className="font-medium text-slate-600">Subtotal</span>
                               <span className="font-semibold text-slate-900">{formatCurrency(orderDetail.subtotal_amount)}</span>
                             </div>
                           </div>
                         ) : (
                           <p className="text-xs text-slate-500 text-center py-2">Data pesanan tidak ditemukan</p>
                         )}
                       </div>
                    </div>
                 )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── EXCHANGE MODAL ──────────────────────────────────────── */}
      {showExchangeModal && (
        <div className="fixed inset-0 bg-black/60 z-[70] flex items-end justify-center backdrop-blur-sm" onClick={() => setShowExchangeModal(false)}>
          <div className="bg-white rounded-t-2xl p-5 w-full max-w-md animate-in slide-in-from-bottom" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
               <h2 className="text-base font-semibold text-slate-900">Tukar Poin</h2>
               <button onClick={() => setShowExchangeModal(false)} className="text-slate-400">
                 <Icons.X size={24} />
               </button>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 flex justify-between items-center mb-5 border border-amber-100/50">
              <div className="flex items-center gap-2">
                 <Icons.Coins className="text-amber-500" size={20} />
                 <span className="text-sm font-medium text-slate-700">Poin Anda</span>
              </div>
              <span className="text-sm font-semibold text-amber-600">{points.toLocaleString()}</span>
            </div>
            
            <div className="mb-5">
              <label className="block text-xs font-medium text-slate-600 mb-1.5 ml-1">Jumlah Tukar</label>
              <div className="relative">
                <Icons.Sparkles className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="number" placeholder="Masukkan jumlah poin" value={exchangeAmount} onChange={(e) => setExchangeAmount(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 focus:border-amber-500 rounded-xl text-sm font-medium outline-none transition-colors" />
              </div>
            </div>

            {exchangeAmount && parseInt(exchangeAmount) > 0 && (
              <div className="mb-6 flex justify-between items-center text-sm">
                <span className="text-slate-500">Akan menjadi saldo</span>
                <span className="font-semibold text-emerald-600">+{formatCurrency(parseInt(exchangeAmount))}</span>
              </div>
            )}
            
            <button onClick={handleExchangePoints} disabled={exchanging || !exchangeAmount || parseInt(exchangeAmount) <= 0 || parseInt(exchangeAmount) > points}
              className="w-full py-3.5 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center gap-2">
              {exchanging ? <Icons.Loader2 size={16} className="animate-spin" /> : null}
              {exchanging ? "Memproses..." : "Konfirmasi Tukar"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ──────────────────────────────────────────────

function ShopeeTrxRow({ trx, onTap, formatCurrency, formatDate }: {
  trx: AllTransaction
  onTap: () => void
  formatCurrency: (n: number) => string
  formatDate: (s: string) => string
}) {
  const cfg = TYPE_CONFIG[trx.type] || { label: trx.type, icon: Icons.Circle, color: "text-slate-500" }
  const Icon = cfg.icon
  
  return (
    <div
      onClick={onTap}
      className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 active:bg-slate-100 cursor-pointer transition-colors"
    >
      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
        <Icon size={20} className={cfg.color} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-0.5">
          <p className="text-[13px] font-semibold text-slate-800 tracking-tight capitalize truncate pr-2">{cfg.label}</p>
          <p className={`text-[13px] font-semibold flex-shrink-0 ${trx.amount > 0 ? "text-emerald-500" : "text-slate-800"}`}>
            {trx.amount > 0 ? "+" : ""}{formatCurrency(trx.amount)}
          </p>
        </div>
        <div className="flex justify-between items-center">
          <p className="text-[11px] text-slate-400">{formatDate(trx.created_at)}</p>
          <p className="text-[11px] text-slate-400 capitalize bg-slate-100 px-1.5 rounded">{trx.source === 'ledger' ? 'Berhasil' : 'Selesai'}</p>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value, isFirst, highlight }: { label: string; value: string; isFirst?: boolean; highlight?: boolean }) {
  return (
    <div className={`flex justify-between items-center p-3.5 bg-white`}>
      <span className="text-[13px] text-slate-500">{label}</span>
      <span className={`text-[13px] ${highlight ? "font-semibold text-indigo-600" : "font-medium text-slate-800"}`}>{value}</span>
    </div>
  )
}
