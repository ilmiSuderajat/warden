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
    type: "commission_online" | "commission_cod_debit" | "topup" | "withdraw"
    amount: number
    balance_after: number
    description: string | null
    created_at: string | null
}

type WithdrawRequest = {
    id: string
    amount: number
    bank_name: string | null
    account_name: string | null
    account_number: string | null
    status: string | null
    created_at: string | null
}

const LOG_TYPE_CONFIG: Record<string, any> = {
    commission_online: {
        label: "Komisi Online",
        icon: "TrendingUp",
        color: "text-emerald-600",
        bg: "bg-emerald-50",
        sign: "+",
    },
    commission_cod_debit: {
        label: "Potongan COD (20%)",
        icon: "Bike",
        color: "text-red-600",
        bg: "bg-red-50",
        sign: "-",
    },
    topup: {
        label: "Topup Saldo",
        icon: "PlusCircle",
        color: "text-blue-600",
        bg: "bg-blue-50",
        sign: "+",
    },
    withdraw: {
        label: "Penarikan",
        icon: "ArrowUpFromLine",
        color: "text-orange-600",
        bg: "bg-orange-50",
        sign: "-",
    },
}

export default function DriverWalletPage() {
    const router = useRouter()
    const [user, setUser] = useState<any>(null)
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

    const showToast = (msg: string, type: "success" | "error" = "success") => {
        setToast({ msg, type })
        setTimeout(() => setToast(null), 3500)
    }

    const fetchData = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.push("/login"); return }

        const { data: userData } = await supabase
            .from("users")
            .select("id, full_name, saldo, role")
            .eq("id", session.user.id)
            .single()

        if (!userData || userData.role !== "driver") { router.replace("/"); return }

        setUser(userData)

        const { data: logsData } = await supabase
            .from("driver_balance_logs")
            .select("*")
            .eq("driver_id", userData.id)
            .order("created_at", { ascending: false })
            .limit(50)

        setLogs(logsData || [])

        const { data: wdData } = await supabase
            .from("driver_withdraw_requests")
            .select("*")
            .eq("driver_id", userData.id)
            .order("created_at", { ascending: false })
            .limit(20)

        setWithdrawRequests(wdData || [])
        setLoading(false)
    }, [router])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Load Midtrans Snap script
    useEffect(() => {
        const script = document.createElement("script")
        script.src = "https://app.midtrans.com/snap/snap.js"
        script.setAttribute("data-client-key", process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || "")
        script.async = true
        document.head.appendChild(script)
        return () => { document.head.removeChild(script) }
    }, [])

    const handleTopup = async () => {
        const amount = parseInt(topupAmount.replace(/\D/g, ""))
        if (isNaN(amount) || amount < 10000) {
            showToast("Minimal topup Rp 10.000", "error")
            return
        }
        setTopupLoading(true)
        try {
            const res = await fetch("/api/driver/topup", {
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
                onPending: () => { showToast("Menunggu konfirmasi pembayaran...") },
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
            const res = await fetch("/api/driver/withdraw", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount, bank_name: wdBank, account_number: wdAccount, account_name: wdName }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setShowWithdraw(false)
            setWdAmount(""); setWdBank(""); setWdAccount(""); setWdName("")
            showToast("Permintaan penarikan berhasil dikirim!")
            fetchData()
        } catch (err: any) {
            showToast(err.message || "Gagal membuat penarikan.", "error")
        } finally {
            setWdLoading(false)
        }
    }

    const formatRp = (v: number) => `Rp ${Math.abs(v).toLocaleString("id-ID")}`
    const formatDate = (s: string | null) => {
        if (!s) return "-"
        return new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    }

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <Icons.Loader2 className="animate-spin text-indigo-600" size={32} />
        </div>
    )
    if (!user) return null

    const balance: number = user.saldo || 0
    const isNegative = balance < 0
    const codEnabled: boolean = balance >= -50000

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
                <div className="flex items-center gap-3 mb-2">
                    <Link href="/driver">
                        <Icons.ChevronLeft size={24} className="text-white/80 hover:text-white transition-colors" />
                    </Link>
                    <h1 className="text-lg font-black">Dompet Pengemudi</h1>
                </div>
                <p className="text-white/70 text-xs ml-9">{user.full_name}</p>

                {/* Balance Card */}
                <div className="bg-white rounded-3xl p-5 shadow-xl shadow-black/10 absolute -bottom-16 left-5 right-5 text-slate-900 border border-slate-100">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Saldo Komisi</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${codEnabled ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                            {codEnabled ? "Siap COD" : "Blokir COD"}
                        </span>
                    </div>
                    <p className={`text-3xl font-black ${isNegative ? "text-red-600" : "text-slate-900"}`}>
                        {isNegative ? "-" : ""}{formatRp(balance)}
                    </p>
                    {isNegative && (
                        <p className="text-[10px] text-red-500 font-medium mt-1">
                            {balance <= -50000
                                ? "❌ Saldo minus > Rp 50.000. Anda tidak dapat menerima order COD sebelum Topup."
                                : `⚠️ Saldo minus. Akses COD dicabut jika saldo < -Rp 50.000 (Sisa: Rp ${(-balance - 50000).toLocaleString('id-ID')})`}
                        </p>
                    )}
                    <div className="flex gap-3 mt-4">
                        <button
                            onClick={() => setShowTopup(true)}
                            className="flex-1 bg-indigo-600 text-white rounded-2xl py-3 text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md shadow-indigo-600/30 hover:bg-indigo-700"
                        >
                            <Icons.PlusCircle size={16} />
                            Topup
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
                        <h3 className="text-sm font-bold text-red-800 mb-1">Akses COD Diblokir</h3>
                        <p className="text-xs text-red-600/80 leading-relaxed">
                            Saldo komisi Anda minus melampaui batas (Rp 50.000). Segera isi ulang saldo untuk dapat menerima kembali prioritas pesanan berbasis Cash.
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
                        Riwayat Saldo
                    </button>
                    <button
                        onClick={() => setActiveTab("withdraw")}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "withdraw" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                    >
                        Penarikan
                    </button>
                </div>

                {/* Balance Log Tab */}
                {activeTab === "log" && (
                    <div className="space-y-3 pb-8">
                        {logs.length === 0 && (
                            <div className="text-center py-16 text-slate-400">
                                <Icons.ReceiptText size={40} className="mx-auto mb-3 opacity-30" />
                                <p className="text-sm font-medium">Belum ada riwayat transaksi</p>
                            </div>
                        )}
                        {logs.map((log) => {
                            const cfg = LOG_TYPE_CONFIG[log.type] || LOG_TYPE_CONFIG.commission_online
                            const Icon = (Icons as any)[cfg.icon] || Icons.Circle
                            const isPositive = log.amount > 0
                            return (
                                <div key={log.id} className="bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm border border-slate-100">
                                    <div className={`w-10 h-10 ${cfg.bg} ${cfg.color} rounded-xl flex items-center justify-center shrink-0`}>
                                        <Icon size={18} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-800">{cfg.label}</p>
                                        <p className="text-[10px] text-slate-400 truncate">{log.description}</p>
                                        <p className="text-[10px] text-slate-300 mt-0.5">{formatDate(log.created_at)}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className={`text-sm font-black ${isPositive ? "text-emerald-600" : "text-red-600"}`}>
                                            {isPositive ? "+" : "-"}{formatRp(log.amount)}
                                        </p>
                                        <p className="text-[10px] text-slate-400">saldo {formatRp(log.balance_after)}</p>
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
                                <p className="text-sm font-medium">Belum ada pengajuan pencairan</p>
                            </div>
                        )}
                        {withdrawRequests.map((wd) => {
                            const statusColors: Record<string, string> = {
                                pending: "bg-amber-50 text-amber-700 border border-amber-200",
                                approved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
                                rejected: "bg-red-50 text-red-700 border border-red-200",
                            }
                            const statusLabel: Record<string, string> = {
                                pending: "Diproses",
                                approved: "Berhasil",
                                rejected: "Gagal",
                            }
                            return (
                                <div key={wd.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="text-sm font-black text-slate-800">{formatRp(wd.amount)}</p>
                                            <p className="text-[10px] text-slate-400 mt-0.5">{wd.bank_name} · {wd.account_number}</p>
                                            <p className="text-[10px] text-slate-500 font-medium">{wd.account_name}</p>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${statusColors[wd.status || "pending"]}`}>
                                            {statusLabel[wd.status || "pending"]}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-300 mt-2 border-t border-slate-50 pt-2">{formatDate(wd.created_at)}</p>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Topup Modal */}
            {showTopup && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center backdrop-blur-sm transition-opacity" onClick={() => setShowTopup(false)}>
                    <div className="bg-white rounded-t-3xl p-6 w-full max-w-md shadow-2xl animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
                        <h2 className="text-lg font-black text-slate-900 mb-1">Isi Saldo Dompet</h2>
                        <p className="text-xs text-slate-500 mb-5">Untuk dapat menerima prioritas pesanan Cash</p>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nominal Topup</label>
                        <div className="relative mb-3">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">Rp</span>
                            <input
                                type="number"
                                placeholder="50000"
                                value={topupAmount}
                                onChange={e => setTopupAmount(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-600 outline-none text-slate-900 font-bold text-lg bg-slate-50 transition-colors focus:ring-4 focus:ring-indigo-600/10"
                            />
                        </div>
                        <div className="flex gap-2 mb-6">
                            {[20000, 50000, 100000, 200000].map(v => (
                                <button key={v} onClick={() => setTopupAmount(v.toString())} className="flex-1 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-600 hover:bg-slate-200 active:bg-indigo-600/10 active:text-indigo-600 transition-all">
                                    {(v / 1000)}rb
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={handleTopup}
                            disabled={topupLoading}
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
                <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center backdrop-blur-sm transition-opacity" onClick={() => setShowWithdraw(false)}>
                    <div className="bg-white rounded-t-3xl p-6 w-full max-w-md shadow-2xl animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
                        <h2 className="text-lg font-black text-slate-900 mb-1">Tarik Pendapatan</h2>
                        <p className="text-xs text-slate-500 mb-5">Saldo saat ini: <span className="font-bold text-slate-700">{formatRp(balance)}</span></p>
                        <div className="space-y-4 mb-6">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1">Nominal Penarikan</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">Rp</span>
                                    <input type="number" placeholder="Min. 10000" value={wdAmount} onChange={e => setWdAmount(e.target.value)} max={balance}
                                        className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-slate-50 focus:border-indigo-600 outline-none text-slate-900 font-bold bg-slate-100/50 transition-colors focus:ring-4 focus:ring-indigo-600/10" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1">Bank / E-Wallet</label>
                                    <input type="text" placeholder="BCA/Dana" value={wdBank} onChange={e => setWdBank(e.target.value)}
                                        className="w-full px-4 py-3.5 rounded-2xl border-2 border-slate-50 focus:border-indigo-600 outline-none text-slate-900 font-medium bg-slate-100/50 transition-colors focus:ring-4 focus:ring-indigo-600/10" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1">Nomor Akun</label>
                                    <input type="text" placeholder="Rekening/HP" value={wdAccount} onChange={e => setWdAccount(e.target.value)}
                                        className="w-full px-4 py-3.5 rounded-2xl border-2 border-slate-50 focus:border-indigo-600 outline-none text-slate-900 font-medium bg-slate-100/50 transition-colors focus:ring-4 focus:ring-indigo-600/10" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1">Atas Nama</label>
                                <input type="text" placeholder="Nama KTP/Rekening" value={wdName} onChange={e => setWdName(e.target.value)}
                                    className="w-full px-4 py-3.5 rounded-2xl border-2 border-slate-50 focus:border-indigo-600 outline-none text-slate-900 font-medium bg-slate-100/50 transition-colors focus:ring-4 focus:ring-indigo-600/10" />
                            </div>
                        </div>
                        <button
                            onClick={handleWithdraw}
                            disabled={wdLoading}
                            className="w-full bg-slate-900 text-white rounded-2xl py-4 font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-all hover:bg-slate-800"
                        >
                            {wdLoading ? <Icons.Loader2 className="animate-spin" size={18} /> : <Icons.ArrowUpFromLine size={18} />}
                            {wdLoading ? "Memproses..." : "Ajukan Pencairan Dana"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
