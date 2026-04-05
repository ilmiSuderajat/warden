"use client"

import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

declare global {
    interface Window {
        snap: any
    }
}

type BalanceLog = {
    id: string
    seq: number
    type: string
    amount: number
    balance_after: number
    description: string | null
    order_id: string | null
    created_at: string | null
}

type WithdrawRequest = {
    id: string
    amount: number
    bank_name: string | null
    bank_holder: string | null
    bank_account: string | null
    status: string | null
    requested_at: string | null
    created_at: string | null
}

const LOG_TYPE_CONFIG: Record<string, any> = {
    commission: { label: "Komisi Penjualan", icon: "TrendingUp", color: "text-emerald-600", bg: "bg-emerald-50", sign: "+" },
    topup: { label: "Topup Saldo", icon: "PlusCircle", color: "text-blue-600", bg: "bg-blue-50", sign: "+" },
    withdraw: { label: "Penarikan Dana", icon: "ArrowUpFromLine", color: "text-orange-600", bg: "bg-orange-50", sign: "-" },
    refund: { label: "Refund Pembeli", icon: "RotateCcw", color: "text-red-600", bg: "bg-red-50", sign: "-" },
}

export default function ShopWalletPage() {
    const router = useRouter()
    const [shop, setShop] = useState<any>(null)
    const [logs, setLogs] = useState<BalanceLog[]>([])
    const [withdrawRequests, setWithdrawRequests] = useState<WithdrawRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<"log" | "withdraw">("log")

    // Topup modal
    const [showTopup, setShowTopup] = useState(false)
    const [topupAmount, setTopupAmount] = useState("")
    const [topupLoading, setTopupLoading] = useState(false)

    // Withdraw modal
    const [showWithdraw, setShowWithdraw] = useState(false)
    const [wdAmount, setWdAmount] = useState("")
    const [wdBank, setWdBank] = useState("")
    const [wdAccount, setWdAccount] = useState("")
    const [wdName, setWdName] = useState("")
    const [wdLoading, setWdLoading] = useState(false)

    const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null)

    // Transaction Detail Modal
    const [selectedTx, setSelectedTx] = useState<BalanceLog | null>(null)
    const [orderDetail, setOrderDetail] = useState<any | null>(null)
    const [loadingDetail, setLoadingDetail] = useState(false)

    const showToast = (msg: string, type: "success" | "error" = "success") => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3500)
    }

    const fetchData = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.push("/login"); return }

        // Fetch Shop Data
        const { data: shopData } = await supabase
            .from("shops")
            .select("id, name, balance, cod_enabled, owner_id")
            .eq("owner_id", session.user.id)
            .single()

        if (!shopData) {
            router.replace("/shop/create")
            return
        }

        // Fetch unified wallet balance (Source of Truth)
        const { data: walletData } = await supabase
            .from("wallets")
            .select("balance")
            .eq("user_id", session.user.id)
            .maybeSingle()

        setShop({ ...shopData, balance: walletData?.balance ?? shopData.balance })

        // Fetch unified Transactions
        const { data: logsData } = await supabase
            .from("transactions")
            .select("*")
            .eq("user_id", session.user.id)
            .order("seq", { ascending: false })
            .limit(50)
        setLogs(logsData || [])

        // Fetch unified Withdraw Requests
        const { data: wdData } = await supabase
            .from("withdraw_requests")
            .select("*")
            .eq("user_id", session.user.id)
            .order("requested_at", { ascending: false })
            .limit(20)
        setWithdrawRequests(wdData || [])
        
        setLoading(false)
    }, [router])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Load Midtrans Snap script
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

    const handleTopup = async () => {
        const amount = parseInt(topupAmount.replace(/\D/g, ""))
        if (isNaN(amount) || amount < 10000) { showToast("Minimal topup Rp 10.000", "error"); return }
        
        setTopupLoading(true)
        try {
            const res = await fetch("/api/shop/topup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            setShowTopup(false)
            setTopupAmount("")

            window.snap.pay(data.token, {
                onSuccess: () => { showToast("Topup berhasil! Saldo akan diperbarui."); fetchData() },
                onPending: () => { showToast("Menunggu konfirmasi pembayaran..."); fetchData() },
                onError: () => { showToast("Pembayaran gagal.", "error") },
                onClose: () => { showToast("Pembayaran dibatalkan.", "error") },
            })
        } catch (err: any) {
            showToast(err.message || "Gagal membuat topup.", "error")
        } finally {
            setTopupLoading(false)
        }
    }

    const handleWithdraw = async () => {
        const amount = parseInt(wdAmount.replace(/\D/g, ""))
        if (isNaN(amount) || amount < 10000) { showToast("Minimal penarikan Rp 10.000", "error"); return }
        if (!wdBank || !wdAccount || !wdName) { showToast("Lengkapi semua data rekening.", "error"); return }
        
        setWdLoading(true)
        try {
            const res = await fetch("/api/shop/withdraw", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount, bank_name: wdBank, account_number: wdAccount, account_name: wdName }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            
            setShowWithdraw(false)
            setWdAmount(""); setWdBank(""); setWdAccount(""); setWdName("")
            showToast("Pengajuan penarikan dana berhasil! Menunggu konfirmasi Admin.")
            fetchData()
        } catch (err: any) {
            showToast(err.message || "Gagal membuat penarikan.", "error")
        } finally {
            setWdLoading(false)
        }
    }

    const formatRp = (v: number) => `Rp ${Math.abs(v).toLocaleString("id-ID")}`
    const formatDate = (s: string | null, full = false) => {
        if (!s) return "-"
        const opts: Intl.DateTimeFormatOptions = full 
            ? { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }
            : { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
        return new Date(s).toLocaleDateString("id-ID", opts)
    }

    const fetchOrderDetail = useCallback(async (orderId: string) => {
        setLoadingDetail(true)
        try {
            // Fetch order basic info
            const { data: order } = await supabase
                .from("orders")
                .select("*")
                .eq("id", orderId)
                .single()
            
            // Fetch order items
            const { data: items } = await supabase
                .from("order_items")
                .select("*")
                .eq("order_id", orderId)
            
            setOrderDetail({ ...order, items: items || [] })
        } catch (err) {
            console.error("Error fetching order detail:", err)
        } finally {
            setLoadingDetail(false)
        }
    }, [])

    useEffect(() => {
        if (selectedTx?.order_id) {
            fetchOrderDetail(selectedTx.order_id)
        } else {
            setOrderDetail(null)
        }
    }, [selectedTx, fetchOrderDetail])

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <Icons.Loader2 className="animate-spin text-indigo-600" size={32} />
        </div>
    )
    if (!shop) return null

    const balance: number = shop.balance || 0
    const isNegative = balance < 0
    const codEnabled: boolean = shop.cod_enabled

    return (
        <div className="min-h-screen bg-slate-50 max-w-md mx-auto font-sans pb-12 relative">
            {/* Toast */}
            {toast && (
                <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white transition-all ${toast.type === "success" ? "bg-emerald-500" : "bg-red-500"}`}>
                    {toast.msg}
                </div>
            )}

            {/* Header */}
            <div className="bg-indigo-600 text-white pt-12 pb-28 px-5 rounded-b-[40px] shadow-lg relative">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                        <Link href="/shop/dashboard">
                            <Icons.ChevronLeft size={24} className="text-white/80 hover:text-white transition-colors" />
                        </Link>
                        <h1 className="text-lg font-black">Dompet Warung</h1>
                    </div>
                </div>
                <p className="text-white/70 text-xs ml-9">{shop.name}</p>

                {/* Balance Card */}
                <div className="bg-white rounded-3xl p-5 shadow-xl shadow-black/10 absolute -bottom-16 left-5 right-5 text-slate-900 border border-slate-100">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Saldo Toko</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${codEnabled ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                            {codEnabled ? <Icons.Check size={12} /> : <Icons.Lock size={12} />}
                            {codEnabled ? "COD Aktif" : "COD Diblokir"}
                        </span>
                    </div>
                    <p className={`text-3xl font-black ${isNegative ? "text-red-600" : "text-slate-900"}`}>
                        {isNegative ? "-" : ""}{formatRp(balance)}
                    </p>
                    {isNegative && (
                        <p className="text-[10px] text-red-500 font-medium mt-1 leading-tight">
                            ⚠️ Saldo Toko minus akibat pembatalan pesanan / refund. Jika terus dibiarkan, akses toko akan dibatasi.
                        </p>
                    )}
                    <div className="flex gap-3 mt-4">
                        <button
                            onClick={() => setShowTopup(true)}
                            className="flex-1 bg-indigo-600 text-white rounded-2xl py-3 text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md shadow-indigo-600/30 hover:bg-indigo-700"
                        >
                            <Icons.PlusCircle size={16} />
                            Isi Saldo
                        </button>
                        <button
                            onClick={() => setShowWithdraw(true)}
                            disabled={balance <= 0}
                            className="flex-1 border-2 border-slate-200 rounded-2xl py-3 text-sm font-bold text-slate-600 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                        >
                            <Icons.ArrowUpFromLine size={16} />
                            Tarik Dana
                        </button>
                    </div>
                </div>
            </div>

            {/* COD Warning Banner */}
            {!codEnabled && (
                <div className="mx-5 mt-24 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
                    <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                        <Icons.AlertTriangle size={20} className="text-red-500" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-red-800 mb-1">Akses COD Toko Diblokir</h3>
                        <p className="text-xs text-red-600/80 leading-relaxed">
                            Saldo toko minus melampaui batas kewajaran. Segera isi ulang saldo untuk mengaktifkan kembali fitur pemesanan COD bagi pelanggan.
                        </p>
                    </div>
                </div>
            )}

            <div className={`px-5 relative z-0 ${!codEnabled ? "mt-4" : "mt-24"}`}>
                {/* Tabs */}
                <div className="flex bg-slate-100 rounded-2xl p-1 mb-5">
                    <button
                        onClick={() => setActiveTab("log")}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "log" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                    >
                        Riwayat Transaksi
                    </button>
                    <button
                        onClick={() => setActiveTab("withdraw")}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "withdraw" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                    >
                        Penarikan Dana
                    </button>
                </div>

                {/* Balance Log Tab */}
                {activeTab === "log" && (
                    <div className="space-y-3 pb-8">
                        {logs.length === 0 && (
                            <div className="text-center py-16 text-slate-400">
                                <Icons.ReceiptText size={40} className="mx-auto mb-3 opacity-30" />
                                <p className="text-sm font-medium">Belum ada riwayat pendapatan</p>
                            </div>
                        )}
                        {logs.map((log) => {
                            const cfg = LOG_TYPE_CONFIG[log.type] || LOG_TYPE_CONFIG.commission
                            const Icon = (Icons as any)[cfg.icon] || Icons.Circle
                            const isPositive = log.amount > 0
                            const orderIdShort = log.order_id ? `#${log.order_id.slice(0, 8).toUpperCase()}` : null
                            
                            return (
                                <div 
                                    key={log.id} 
                                    onClick={() => setSelectedTx(log)}
                                    className="bg-white rounded-[24px] p-5 shadow-sm border border-slate-100 hover:border-indigo-200 active:scale-[0.98] transition-all group cursor-pointer"
                                >
                                    <div className="flex items-start gap-4">
                                        <div className={`w-12 h-12 ${cfg.bg} ${cfg.color} rounded-2xl flex items-center justify-center shrink-0 shadow-inner group-hover:scale-110 transition-transform`}>
                                            <Icon size={22} strokeWidth={2.5} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-0.5">
                                                <p className="text-[13px] font-black text-slate-800">{cfg.label}</p>
                                                <p className={`text-sm font-black tracking-tight ${isPositive ? "text-emerald-600" : "text-slate-800"}`}>
                                                    {isPositive ? "+" : ""}{formatRp(log.amount)}
                                                </p>
                                            </div>
                                            
                                            <p className="text-[11px] text-slate-500 leading-snug mb-2 font-medium">
                                                {log.description}
                                            </p>

                                            <div className="flex flex-wrap gap-2 items-center">
                                                <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                                                    <Icons.Clock size={10} className="text-slate-400" />
                                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{formatDate(log.created_at)}</span>
                                                </div>
                                                
                                                {orderIdShort && (
                                                    <div className="flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                                                        <Icons.Hash size={10} className="text-indigo-400" />
                                                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tight">{orderIdShort}</span>
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Seq: #{log.seq}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-slate-50 flex justify-between items-center text-[10px]">
                                        <span className="text-slate-400 font-medium">Saldo Akhir</span>
                                        <span className="font-black text-slate-700">{formatRp(log.balance_after)}</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Withdraw History Tab */}
                {activeTab === "withdraw" && (
                    <div className="space-y-3 pb-8">
                        {withdrawRequests.length === 0 && (
                            <div className="text-center py-16 text-slate-400">
                                <Icons.ArrowUpFromLine size={40} className="mx-auto mb-3 opacity-30" />
                                <p className="text-sm font-medium">Belum ada pengajuan pencairan dana</p>
                            </div>
                        )}
                        {withdrawRequests.map((wd) => {
                            const statusColors: Record<string, string> = {
                                pending: "bg-amber-100 text-amber-700 border-amber-200",
                                approved: "bg-emerald-100 text-emerald-700 border-emerald-200",
                                rejected: "bg-red-100 text-red-700 border-red-200",
                            }
                            const statusLabel: Record<string, string> = {
                                pending: "Menunggu Peninjauan",
                                approved: "Selesai Ditransfer",
                                rejected: "Dibatalkan / Gagal",
                            }
                            return (
                                <div key={wd.id} className="bg-white rounded-[24px] p-5 shadow-sm border border-slate-100 relative overflow-hidden group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex gap-3 items-center">
                                            <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center shadow-inner">
                                                <Icons.ArrowUpFromLine size={18} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-black text-slate-800">{formatRp(wd.amount)}</p>
                                                <p className="text-[11px] text-slate-400 font-medium">Pengajuan Pencairan</p>
                                            </div>
                                        </div>
                                        <span className={`text-[9px] font-black px-2.5 py-1 rounded-full border-2 tracking-wide uppercase ${statusColors[wd.status || "pending"]}`}>
                                            {statusLabel[wd.status || "pending"]}
                                        </span>
                                    </div>

                                    <div className="bg-slate-50/50 rounded-2xl p-3 border border-slate-100/50 mb-4">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <Icons.Library size={12} className="text-slate-400" />
                                            <p className="text-[11px] font-black text-slate-700 uppercase tracking-tight">{wd.bank_name}</p>
                                        </div>
                                        <div className="pl-5 space-y-1">
                                            <p className="text-[11px] text-slate-500 font-bold">{wd.bank_account}</p>
                                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">a/n {wd.bank_holder}</p>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center text-[10px]">
                                        <div className="flex items-center gap-1.5 text-slate-400">
                                            <Icons.Calendar size={10} />
                                            <span className="font-bold uppercase tracking-tight">{formatDate(wd.requested_at || wd.created_at)}</span>
                                        </div>
                                        <span className="font-mono text-slate-300 font-bold">TX-ID: {wd.id.split('-')[0].toUpperCase()}</span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Topup Modal */}
            {showTopup && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end justify-center backdrop-blur-sm transition-opacity" onClick={() => setShowTopup(false)}>
                    <div className="bg-white rounded-t-3xl p-6 w-full max-w-md shadow-2xl animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
                        <h2 className="text-lg font-black text-slate-900 mb-1">Isi Saldo Warung</h2>
                        <p className="text-xs text-slate-500 mb-5">Untuk keamanan toko & buka blokir COD</p>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nominal Topup</label>
                        <div className="relative mb-3">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">Rp</span>
                            <input
                                type="number"
                                placeholder="Min. 50.000"
                                value={topupAmount}
                                onChange={e => setTopupAmount(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-600 outline-none text-slate-900 font-bold text-lg bg-slate-50 transition-colors focus:ring-4 focus:ring-indigo-600/10"
                            />
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-6">
                            {[50000, 100000, 200000, 500000, 1000000, 2000000].map(v => (
                                <button key={v} onClick={() => setTopupAmount(v.toString())} className="py-2.5 rounded-xl bg-slate-100 text-xs font-bold text-slate-600 hover:bg-slate-200 active:bg-indigo-600/10 active:text-indigo-600 transition-all border border-transparent">
                                    {v >= 1000000 ? `${v/1000000}jt` : `${v/1000}k`}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={handleTopup}
                            disabled={topupLoading || !topupAmount}
                            className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-all shadow-lg shadow-indigo-600/30 hover:bg-indigo-700"
                        >
                            {topupLoading ? <Icons.Loader2 className="animate-spin" size={18} /> : <Icons.CreditCard size={18} />}
                            {topupLoading ? "Memproses..." : "Bayar via Midtrans"}
                        </button>
                    </div>
                </div>
            )}

            {/* Withdraw Modal */}
            {showWithdraw && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end justify-center backdrop-blur-sm transition-opacity" onClick={() => setShowWithdraw(false)}>
                    <div className="bg-white rounded-t-[32px] p-6 w-full max-w-md shadow-2xl animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
                        <h2 className="text-xl font-black text-slate-900 mb-1">Tarik Omzet Toko</h2>
                        <p className="text-xs text-slate-500 mb-5">Maksimal penarikan: <span className="font-bold text-slate-800">{formatRp(balance)}</span></p>
                        
                        <div className="space-y-4 mb-8">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Nominal Pencairan</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">Rp</span>
                                    <input type="number" placeholder="Min. 20000" value={wdAmount} onChange={e => setWdAmount(e.target.value)} max={balance}
                                        className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-slate-100 focus:border-slate-400 outline-none text-slate-900 font-bold bg-slate-50 transition-colors" />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Bank Tujuan</label>
                                    <input type="text" placeholder="BCA / Mandiri / Dana" value={wdBank} onChange={e => setWdBank(e.target.value)}
                                        className="w-full px-4 py-3.5 rounded-2xl border-2 border-slate-100 focus:border-slate-400 outline-none text-slate-900 font-semibold bg-slate-50 transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Nomor Rekening / HP</label>
                                    <input type="text" placeholder="No. Rek / HP" value={wdAccount} onChange={e => setWdAccount(e.target.value)}
                                        className="w-full px-4 py-3.5 rounded-2xl border-2 border-slate-100 focus:border-slate-400 outline-none text-slate-900 font-semibold bg-slate-50 transition-colors" />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Nama Pemilik Rekening</label>
                                <input type="text" placeholder="Atas Nama" value={wdName} onChange={e => setWdName(e.target.value)}
                                    className="w-full px-4 py-3.5 rounded-2xl border-2 border-slate-100 focus:border-slate-400 outline-none text-slate-900 font-semibold bg-slate-50 transition-colors" />
                            </div>
                        </div>
                        
                        <button
                            onClick={handleWithdraw}
                            disabled={wdLoading || !wdAmount || !wdBank || !wdAccount || !wdName}
                            className="w-full bg-slate-900 text-white rounded-2xl py-4 font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-all hover:bg-slate-800"
                        >
                            {wdLoading ? <Icons.Loader2 className="animate-spin" size={18} /> : <Icons.ArrowUpFromLine size={18} />}
                            {wdLoading ? "Memproses Pengajuan..." : "Ajukan Pencairan Dana"}
                        </button>
                    </div>
                </div>
            )}

            {/* Transaction Detail Bottom Sheet */}
            {selectedTx && (
                <div 
                    className="fixed inset-0 bg-slate-900/60 z-[60] flex items-end justify-center backdrop-blur-sm transition-opacity"
                    onClick={() => setSelectedTx(null)}
                >
                    <div 
                        className="bg-white rounded-t-[32px] w-full max-w-md shadow-2xl animate-in slide-in-from-bottom max-h-[85vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="sticky top-0 bg-white pt-4 pb-2 px-6 z-10">
                            <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-4" />
                            <div className="flex justify-between items-center">
                                <h2 className="text-xl font-black text-slate-900">Detail Transaksi</h2>
                                <button onClick={() => setSelectedTx(null)} className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                                    <Icons.X size={20} />
                                </button>
                            </div>
                        </div>

                        <div className="px-6 pb-12">
                            {/* Amount Highlight */}
                            <div className="text-center py-6 mb-6 bg-slate-50/50 rounded-3xl border border-slate-100">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Mutasi</p>
                                <p className={`text-3xl font-black ${selectedTx.amount > 0 ? "text-emerald-600" : "text-slate-800"}`}>
                                    {selectedTx.amount > 0 ? "+" : ""}{formatRp(selectedTx.amount)}
                                </p>
                                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-100 rounded-full shadow-sm">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Status: Berhasil</span>
                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                </div>
                            </div>

                            <div className="space-y-6">
                                {/* Core Info Section */}
                                <div>
                                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] mb-3 ml-1">Informasi Dasar</h3>
                                    <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-slate-400 font-medium">Tipe</span>
                                            <span className="text-xs text-slate-700 font-black uppercase tracking-tight">{LOG_TYPE_CONFIG[selectedTx.type]?.label || selectedTx.type}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-slate-400 font-medium">Waktu</span>
                                            <span className="text-xs text-slate-700 font-bold">{formatDate(selectedTx.created_at, true)}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-slate-400 font-medium">Referensi #</span>
                                            <span className="text-xs font-mono text-slate-500 font-bold">{selectedTx.id.split('-')[0].toUpperCase()}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Order Content / Product List */}
                                {selectedTx.type === 'commission' && (
                                    <div>
                                        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] mb-3 ml-1">Rincian Pesanan</h3>
                                        {loadingDetail ? (
                                            <div className="flex justify-center py-8 bg-slate-50 rounded-2xl animate-pulse">
                                                <Icons.Loader2 size={24} className="text-indigo-400 animate-spin" />
                                            </div>
                                        ) : orderDetail ? (
                                            <div className="space-y-4">
                                                <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-3">
                                                    {orderDetail.items.map((item: any) => (
                                                        <div key={item.id} className="flex justify-between items-center">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0">
                                                                    {item.quantity}x
                                                                </div>
                                                                <span className="text-xs font-bold text-slate-700">{item.product_name.split(' | ')[0]}</span>
                                                            </div>
                                                            <span className="text-xs font-bold text-slate-600">{formatRp(item.price * item.quantity)}</span>
                                                        </div>
                                                    ))}
                                                    <div className="pt-3 mt-3 border-t border-slate-50 flex justify-between items-center font-black">
                                                        <span className="text-xs text-slate-400">Total Harga Barang</span>
                                                        <span className="text-xs text-slate-800">{formatRp(orderDetail.subtotal_amount || 0)}</span>
                                                    </div>
                                                </div>

                                                <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-2xl p-4 space-y-3 border-dashed">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs text-slate-500 font-medium italic">Pendapatan Kotor</span>
                                                        <span className="text-xs text-slate-600 font-bold">{formatRp(orderDetail.subtotal_amount || 0)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs text-red-500 font-medium">Beban App (5%)</span>
                                                        <span className="text-xs text-red-500 font-bold">-{formatRp((orderDetail.subtotal_amount || 0) * 0.05)}</span>
                                                    </div>
                                                    <div className="pt-3 mt-3 border-t border-indigo-100/50 flex justify-between items-center font-black">
                                                        <span className="text-xs text-indigo-900">Total Diterima</span>
                                                        <span className="text-sm text-indigo-600">{formatRp(selectedTx.amount)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-4 bg-amber-50 text-amber-600 rounded-2xl text-[10px] font-bold text-center">
                                                ⚠️ Data pesanan tidak ditemukan atau diarsipkan.
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Topup / Withdraw Metadata Backup */}
                                {(selectedTx.type === 'topup' || selectedTx.type === 'withdraw') && (
                                    <div>
                                        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] mb-3 ml-1">Keterangan</h3>
                                        <div className="bg-slate-50 rounded-2xl p-4">
                                            <p className="text-xs text-slate-600 font-medium leading-relaxed italic">
                                                "{selectedTx.description}"
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Audit Info Section */}
                                <div>
                                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] mb-3 ml-1">Audit Ledger</h3>
                                    <div className="bg-slate-900 rounded-2xl p-4 font-mono">
                                        <div className="flex justify-between items-start text-[10px]">
                                            <span className="text-slate-500 uppercase tracking-tighter">Seq# {selectedTx.seq}</span>
                                            <span className="text-emerald-400/80 uppercase tracking-tighter">Verified Integrity</span>
                                        </div>
                                        <div className="mt-3 pt-3 border-t border-slate-800">
                                            <p className="text-slate-500 text-[10px] mb-1">Balance After Transaction</p>
                                            <p className="text-white text-sm font-bold tracking-tight">{formatRp(selectedTx.balance_after)}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
