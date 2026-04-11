"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Skeleton from "@/app/components/Skeleton"

declare global {
    interface Window { snap: any }
}

type BalanceLog = {
    id: string
    driver_id: string | null
    type: string
    amount: number
    balance_after: number
    description: string | null
    order_id: string | null
    created_at: string | null
}

type WithdrawReq = {
    id: string
    driver_id: string | null
    amount: number
    bank_name: string | null
    account_number: string | null
    account_name: string | null
    status: string | null
    notes: string | null
    created_at: string | null
}

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
    commission_online:   { label: "Komisi Online",        icon: Icons.TrendingUp,      color: "text-emerald-600" },
    commission_cod_debit:{ label: "Potongan COD (20%)",   icon: Icons.Bike,            color: "text-rose-500"    },
    commission:          { label: "Komisi Pengiriman",    icon: Icons.TrendingUp,      color: "text-emerald-600" },
    topup:               { label: "Isi Saldo",            icon: Icons.Download,        color: "text-indigo-600"  },
    withdraw:            { label: "Tarik Dana",           icon: Icons.Upload,          color: "text-rose-500"    },
}

const FILTER_OPTIONS = ["Semua", "Masuk", "Keluar"] as const
type FilterOption = typeof FILTER_OPTIONS[number]

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    pending:  { label: "Diproses", color: "text-amber-500"   },
    approved: { label: "Berhasil", color: "text-emerald-500" },
    rejected: { label: "Ditolak",  color: "text-slate-400"   },
}

export default function DriverWalletPage() {
    const router = useRouter()
    const [user, setUser] = useState<any>(null)
    const [balance, setBalance] = useState(0)
    const [loading, setLoading] = useState(true)
    const [logs, setLogs] = useState<BalanceLog[]>([])
    const [withdraws, setWithdraws] = useState<WithdrawReq[]>([])

    const [activeTab, setActiveTab] = useState<"history" | "withdrawals">("history")
    const [activeFilter, setActiveFilter] = useState<FilterOption>("Semua")

    // Detail modal
    const [selectedLog, setSelectedLog] = useState<BalanceLog | null>(null)
    const [orderDetail, setOrderDetail] = useState<any>(null)
    const [loadingDetail, setLoadingDetail] = useState(false)

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

    const [toastMsg, setToastMsg] = useState<{ msg: string; type: "success" | "error" } | null>(null)

    const showToast = (msg: string, type: "success" | "error" = "success") => {
        setToastMsg({ msg, type })
        setTimeout(() => setToastMsg(null), 3500)
    }

    const fetchData = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.push("/login"); return }

        const { data: userData } = await supabase
            .from("users")
            .select("id, full_name, role")
            .eq("id", session.user.id)
            .single()

        if (!userData || userData.role !== "driver") { router.replace("/"); return }

        const { data: walletData } = await supabase
            .from("wallets")
            .select("balance")
            .eq("user_id", userData.id)
            .maybeSingle()

        setUser({ ...userData, balance: walletData?.balance ?? 0 })
        setBalance(walletData?.balance ?? 0)

        // Fetch driver_balance_logs and driver_withdraw_requests in parallel
        const [{ data: logsData }, { data: wdData }] = await Promise.all([
            supabase.from("driver_balance_logs")
                .select("*")
                .eq("driver_id", userData.id)
                .order("created_at", { ascending: false })
                .limit(100),
            supabase.from("driver_withdraw_requests")
                .select("*")
                .eq("driver_id", userData.id)
                .order("created_at", { ascending: false })
                .limit(30),
        ])

        setLogs(logsData ?? [])
        setWithdraws(wdData ?? [])
        setLoading(false)
    }, [router])

    useEffect(() => { fetchData() }, [fetchData])

    // Midtrans Snap script
    useEffect(() => {
        if (document.querySelector('script[src*="snap.js"]')) return
        const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ""
        const isSandbox = clientKey.startsWith("SB-")
        const script = document.createElement("script")
        script.src = isSandbox
            ? "https://app.sandbox.midtrans.com/snap/snap.js"
            : "https://app.midtrans.com/snap/snap.js"
        script.setAttribute("data-client-key", clientKey)
        script.async = true
        document.head.appendChild(script)
    }, [])

    // Fetch order detail when selected
    useEffect(() => {
        if (!selectedLog?.order_id) { setOrderDetail(null); return }
        setLoadingDetail(true)
        Promise.all([
            supabase.from("orders").select("*").eq("id", selectedLog.order_id).single(),
            supabase.from("order_items").select("*, products(image_url)").eq("order_id", selectedLog.order_id),
        ]).then(([orderRes, itemsRes]) => {
            setOrderDetail({ ...orderRes.data, items: itemsRes.data ?? [] })
        }).finally(() => setLoadingDetail(false))
    }, [selectedLog])

    const handleTopup = async () => {
        const amount = parseInt(topupAmount.replace(/\D/g, ""))
        if (isNaN(amount) || amount < 10000) { showToast("Minimal topup Rp 10.000", "error"); return }
        setTopupLoading(true)
        try {
            const res = await fetch("/api/driver/topup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setShowTopup(false); setTopupAmount("")
            window.snap.pay(data.token, {
                onSuccess: () => { showToast("Topup berhasil!"); fetchData() },
                onPending: () => showToast("Menunggu konfirmasi pembayaran..."),
                onError: () => showToast("Pembayaran gagal.", "error"),
                onClose: () => showToast("Pembayaran dibatalkan.", "error"),
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

    const formatCurrency = (v: number) =>
        new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(v)

    const formatDate = (s: string | null) =>
        s ? new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"

    const formatDateShort = (s: string | null) =>
        s ? new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "-"

    const filteredLogs = useMemo(() => {
        if (activeFilter === "Masuk") return logs.filter(l => l.amount > 0)
        if (activeFilter === "Keluar") return logs.filter(l => l.amount <= 0)
        return logs
    }, [logs, activeFilter])

    const isNegative = balance < 0
    const codEnabled = balance >= -50000

    return (
        <div className="min-h-screen bg-slate-50 max-w-md mx-auto font-sans pb-6">

            {/* Toast */}
            {toastMsg && (
                <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white transition-all ${toastMsg.type === "success" ? "bg-emerald-500" : "bg-red-500"}`}>
                    {toastMsg.msg}
                </div>
            )}

            {/* ── INDIGO HEADER ─────────────────────────────────── */}
            <div className={`${isNegative ? "bg-rose-600" : "bg-indigo-600"} px-4 pt-10 pb-20 relative transition-colors`}>
                <header className="flex items-center justify-between mb-6 text-white">
                    <Link href="/driver" className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <Icons.ArrowLeft size={24} />
                    </Link>
                    <h1 className="text-lg font-medium tracking-wide">Dompet Pengemudi</h1>
                    <div className="w-8 opacity-0"><Icons.Settings size={22} /></div>
                </header>

                <div className="text-white px-2">
                    <div className="flex items-center gap-2 mb-1 opacity-90">
                        <Icons.Bike size={16} />
                        <span className="text-sm">{loading ? "Memuat..." : (user?.full_name ?? "Pengemudi")}</span>
                        {!loading && (
                            <span className={`ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${codEnabled ? "bg-white/20 text-white" : "bg-white/20 text-white"}`}>
                                {codEnabled ? "✓ Siap COD" : "⚠ Blokir COD"}
                            </span>
                        )}
                    </div>
                    {loading ? (
                        <Skeleton className="h-10 w-40 bg-white/20 rounded-lg mt-1" />
                    ) : (
                        <div className="flex items-baseline gap-1.5 mt-1">
                            <span className="text-4xl font-semibold tracking-tight">{formatCurrency(balance)}</span>
                        </div>
                    )}
                    {isNegative && !loading && (
                        <p className="text-white/80 text-[11px] mt-1.5">
                            {balance <= -50000
                                ? "❌ Saldo minus > Rp 50.000 — COD diblokir"
                                : `⚠️ Topup sebelum saldo kurang dari -Rp 50.000`}
                        </p>
                    )}
                </div>
            </div>

            {/* ── FLOATING ACTION CARD ───────────────────────────── */}
            <div className="px-4 -mt-10 relative z-10">
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4">
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { label: "Isi Saldo",  icon: Icons.ArrowDownSquare, onClick: () => setShowTopup(true) },
                            { label: "Tarik Dana", icon: Icons.ArrowUpSquare,   onClick: () => setShowWithdraw(true), disabled: balance <= 0 },
                            { label: "Riwayat",    icon: Icons.ClockArrowUp,    onClick: () => setActiveTab("history") },
                        ].map(({ label, icon: Icon, onClick, disabled }) => (
                            <button
                                key={label}
                                onClick={onClick}
                                disabled={disabled}
                                className="flex flex-col items-center justify-start gap-2.5 disabled:opacity-50"
                            >
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 transition-transform active:scale-95">
                                    <Icon size={24} strokeWidth={2} />
                                </div>
                                <span className="text-[11px] font-medium text-slate-700 leading-tight text-center">{label}</span>
                            </button>
                        ))}
                    </div>

                    {/* COD status row */}
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Icons.Bike size={18} className={codEnabled ? "text-emerald-500" : "text-rose-500"} />
                            <span className="text-sm font-semibold text-slate-700">Status COD</span>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${codEnabled ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                            {codEnabled ? "Aktif" : "Diblokir"}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── TRANSACTIONS CONTENT ───────────────────────────── */}
            <div className="px-4 mt-2">
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden min-h-[50vh]">

                    {/* Tabs */}
                    <div className="flex border-b border-slate-100">
                        {(["history", "withdrawals"] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-3 text-sm font-semibold transition-colors relative ${activeTab === tab ? "text-indigo-600" : "text-slate-500"}`}
                            >
                                {tab === "history" ? "Riwayat Komisi" : "Penarikan"}
                                {activeTab === tab && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-indigo-600 rounded-t-full" />}
                            </button>
                        ))}
                    </div>

                    {/* HISTORY TAB */}
                    {activeTab === "history" && (
                        <>
                            {/* Filter pills */}
                            <div className="flex gap-2 p-3 border-b border-slate-50 overflow-x-auto scrollbar-hide">
                                {FILTER_OPTIONS.map((f) => (
                                    <button
                                        key={f}
                                        onClick={() => setActiveFilter(f)}
                                        className={`px-4 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-colors ${activeFilter === f
                                            ? "bg-indigo-50 text-indigo-600 border border-indigo-200"
                                            : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                                        }`}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>

                            {loading ? (
                                <div className="divide-y divide-slate-100">
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className="p-4 flex gap-3">
                                            <Skeleton className="w-10 h-10 rounded-full" />
                                            <div className="flex-1 space-y-2">
                                                <Skeleton className="h-4 w-1/2" />
                                                <Skeleton className="h-3 w-1/3" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : filteredLogs.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-12 text-center">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                                        <Icons.Receipt className="text-slate-300" size={32} />
                                    </div>
                                    <p className="text-sm font-medium text-slate-500">Belum ada riwayat komisi</p>
                                    <p className="text-xs text-slate-400 mt-1">Komisi muncul setelah menyelesaikan pengiriman</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {filteredLogs.map((log) => {
                                        const cfg = TYPE_CONFIG[log.type] ?? {
                                            label: log.type,
                                            icon: log.amount > 0 ? Icons.ArrowDownLeft : Icons.ArrowUpRight,
                                            color: log.amount > 0 ? "text-emerald-600" : "text-slate-500",
                                        }
                                        const Icon = cfg.icon
                                        return (
                                            <div
                                                key={log.id}
                                                onClick={() => setSelectedLog(log)}
                                                className="px-4 py-3 flex items-center gap-3 hover:bg-slate-50 active:bg-slate-100 cursor-pointer transition-colors"
                                            >
                                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                                                    <Icon size={20} className={cfg.color} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start mb-0.5">
                                                        <p className="text-[13px] font-semibold text-slate-800 truncate pr-2">{cfg.label}</p>
                                                        <p className={`text-[13px] font-semibold flex-shrink-0 ${log.amount > 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                                            {log.amount > 0 ? "+" : ""}{formatCurrency(log.amount)}
                                                        </p>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <p className="text-[11px] text-slate-400">{formatDateShort(log.created_at)}</p>
                                                        <p className="text-[11px] text-slate-400">Berhasil</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </>
                    )}

                    {/* WITHDRAWALS TAB */}
                    {activeTab === "withdrawals" && (
                        <div>
                            {loading ? (
                                <div className="divide-y divide-slate-100">
                                    {[...Array(3)].map((_, i) => (
                                        <div key={i} className="p-4 space-y-2">
                                            <Skeleton className="h-4 w-3/4" />
                                            <Skeleton className="h-5 w-1/3" />
                                            <Skeleton className="h-3 w-1/2" />
                                        </div>
                                    ))}
                                </div>
                            ) : withdraws.length === 0 ? (
                                <div className="flex flex-col items-center justify-center p-12 text-center">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                                        <Icons.ArrowUpSquare className="text-slate-300" size={32} />
                                    </div>
                                    <p className="text-sm font-medium text-slate-500">Belum ada pengajuan penarikan</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-slate-100">
                                    {withdraws.map((wd) => {
                                        const s = STATUS_CONFIG[wd.status ?? "pending"] ?? STATUS_CONFIG.pending
                                        return (
                                            <div key={wd.id} className="p-4 flex gap-3 hover:bg-slate-50 transition-colors">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-500">
                                                    <Icons.Building2 size={20} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start mb-0.5">
                                                        <p className="text-[13px] font-semibold text-slate-800 tracking-tight">Tarik Dana — {wd.bank_name}</p>
                                                        <p className={`text-[13px] font-semibold flex-shrink-0 ${s.color}`}>{s.label}</p>
                                                    </div>
                                                    <p className="text-[13px] font-semibold text-slate-700">{formatCurrency(wd.amount)}</p>
                                                    <p className="text-xs text-slate-500 mb-0.5">{wd.account_number} a.n. {wd.account_name}</p>
                                                    {wd.notes && <p className="text-[11px] text-slate-400 italic">{wd.notes}</p>}
                                                    <p className="text-[11px] text-slate-400">{formatDate(wd.created_at)}</p>
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

            {/* ── TRANSACTION DETAIL MODAL ──────────────────────── */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-end justify-center backdrop-blur-sm" onClick={() => setSelectedLog(null)}>
                    <div className="bg-white rounded-t-2xl w-full max-w-md shadow-2xl animate-in slide-in-from-bottom max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="sticky top-0 bg-white flex justify-between items-center p-4 border-b border-slate-100 z-10">
                            <h2 className="text-base font-semibold text-slate-900">Rincian Transaksi</h2>
                            <button onClick={() => setSelectedLog(null)} className="text-slate-400"><Icons.X size={24} /></button>
                        </div>
                        <div className="px-5 pb-8 pt-6">
                            <div className="flex flex-col items-center justify-center mb-6">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${selectedLog.amount > 0 ? "bg-emerald-50 text-emerald-500" : "bg-slate-100 text-slate-500"}`}>
                                    {selectedLog.amount > 0 ? <Icons.TrendingUp size={26} /> : <Icons.TrendingDown size={26} />}
                                </div>
                                <h3 className="text-sm font-medium text-slate-500 mb-1">{TYPE_CONFIG[selectedLog.type]?.label ?? selectedLog.type}</h3>
                                <p className={`text-3xl font-semibold tracking-tight ${selectedLog.amount > 0 ? "text-emerald-600" : "text-slate-900"}`}>
                                    {selectedLog.amount > 0 ? "+" : ""}{formatCurrency(selectedLog.amount)}
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-100">
                                    <DetailRow label="Jenis" value={TYPE_CONFIG[selectedLog.type]?.label ?? selectedLog.type} />
                                    <DetailRow label="Waktu" value={formatDate(selectedLog.created_at)} />
                                    <DetailRow label="Saldo Akhir" value={formatCurrency(selectedLog.balance_after)} />
                                    <DetailRow label="No. Referensi" value={selectedLog.id.split("-")[0].toUpperCase()} highlight />
                                    {selectedLog.description && <DetailRow label="Catatan" value={selectedLog.description} />}
                                </div>

                                {selectedLog.order_id && (
                                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                                        <div className="p-3 bg-slate-50 border-b border-slate-100">
                                            <p className="text-xs font-semibold text-slate-700">Rincian Pengiriman</p>
                                        </div>
                                        <div className="p-3">
                                            {loadingDetail ? (
                                                <div className="flex justify-center py-4">
                                                    <Icons.Loader2 size={20} className="text-indigo-400 animate-spin" />
                                                </div>
                                            ) : orderDetail ? (
                                                <div className="space-y-2">
                                                    {/* Daftar item pesanan — dengan foto, tanpa harga */}
                                                    {orderDetail.items.map((item: any) => {
                                                        const rawImg = item.products?.image_url
                                                        const imgSrc = Array.isArray(rawImg) ? rawImg[0] : rawImg
                                                        return (
                                                            <div key={item.id} className="flex items-center gap-3">
                                                                {imgSrc ? (
                                                                    <img src={imgSrc} alt={item.product_name} className="w-10 h-10 rounded-lg object-cover shrink-0 border border-slate-100" />
                                                                ) : (
                                                                    <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
                                                                        <Icons.Package size={16} className="text-indigo-300" />
                                                                    </div>
                                                                )}
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-[13px] font-medium text-slate-800 truncate">{item.product_name.split(" | ")[0]}</p>
                                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                                        <p className="text-[11px] text-slate-500 font-bold">{item.quantity} item</p>
                                                                        {item.variants && Object.keys(item.variants).length > 0 && (
                                                                            <>
                                                                                <span className="text-slate-300 text-[10px]">•</span>
                                                                                <p className="text-[11px] text-slate-400 truncate">
                                                                                    {Object.values(item.variants as Record<string, any>).map(v => v.label).join(", ")}
                                                                                </p>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                    <div className="pt-3 mt-2 border-t border-dashed border-slate-200 space-y-2">
                                                        {/* Metode pembayaran */}
                                                        <div className="flex justify-between text-[12px] text-slate-500">
                                                            <span>Metode Bayar</span>
                                                            <span className="font-semibold text-indigo-600 uppercase">{orderDetail.payment_method}</span>
                                                        </div>
                                                        {/* Pendapatan bersih driver — nilai yang sudah masuk ke dompet */}
                                                        <div className="flex justify-between text-[13px] font-bold text-emerald-700 pt-1.5 border-t border-slate-100">
                                                            <span>Pendapatan Pengiriman</span>
                                                            <span>+{formatCurrency(selectedLog.amount)}</span>
                                                        </div>
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

            {/* ── TOPUP MODAL ───────────────────────────────────── */}
            {showTopup && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-end justify-center backdrop-blur-sm" onClick={() => setShowTopup(false)}>
                    <div className="bg-white rounded-t-2xl p-5 w-full max-w-md animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-5" />
                        <h2 className="text-base font-semibold text-slate-900 mb-1">Isi Saldo Driver</h2>
                        <p className="text-xs text-slate-500 mb-5">Untuk dapat menerima pesanan COD</p>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5 ml-1">Nominal Topup</label>
                        <div className="relative mb-4">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">Rp</span>
                            <input
                                type="number"
                                placeholder="Min. 10.000"
                                value={topupAmount}
                                onChange={e => setTopupAmount(e.target.value)}
                                className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-sm font-medium outline-none transition-colors"
                            />
                        </div>
                        <div className="flex gap-2 mb-5">
                            {[20000, 50000, 100000, 200000].map(v => (
                                <button key={v} onClick={() => setTopupAmount(v.toString())}
                                    className="flex-1 py-2 rounded-xl bg-indigo-50 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition-all">
                                    {(v / 1000)}rb
                                </button>
                            ))}
                        </div>
                        <button onClick={handleTopup} disabled={topupLoading || !topupAmount}
                            className="w-full py-3.5 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors bg-indigo-600 hover:bg-indigo-700 flex items-center justify-center gap-2">
                            {topupLoading ? <Icons.Loader2 size={16} className="animate-spin" /> : <Icons.CreditCard size={16} />}
                            {topupLoading ? "Memproses..." : "Bayar via Midtrans"}
                        </button>
                    </div>
                </div>
            )}

            {/* ── WITHDRAW MODAL ────────────────────────────────── */}
            {showWithdraw && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-end justify-center backdrop-blur-sm" onClick={() => setShowWithdraw(false)}>
                    <div className="bg-white rounded-t-2xl p-5 w-full max-w-md animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-5" />
                        <h2 className="text-base font-semibold text-slate-900 mb-1">Tarik Pendapatan</h2>
                        <p className="text-xs text-slate-500 mb-5">Saldo tersedia: <span className="font-bold text-slate-800">{formatCurrency(balance)}</span></p>
                        <div className="space-y-3 mb-5">
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">Rp</span>
                                <input type="number" placeholder="Nominal penarikan" value={wdAmount}
                                    onChange={e => setWdAmount(e.target.value)}
                                    className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-sm font-medium outline-none transition-colors" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <input type="text" placeholder="Bank / E-Wallet" value={wdBank}
                                    onChange={e => setWdBank(e.target.value)}
                                    className="px-4 py-3.5 bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-sm font-medium outline-none transition-colors" />
                                <input type="text" placeholder="Nomor Rekening/HP" value={wdAccount}
                                    onChange={e => setWdAccount(e.target.value)}
                                    className="px-4 py-3.5 bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-sm font-medium outline-none transition-colors" />
                            </div>
                            <input type="text" placeholder="Atas Nama" value={wdName}
                                onChange={e => setWdName(e.target.value)}
                                className="w-full px-4 py-3.5 bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-sm font-medium outline-none transition-colors" />
                        </div>
                        <button onClick={handleWithdraw} disabled={wdLoading || !wdAmount || !wdBank || !wdAccount || !wdName}
                            className="w-full py-3.5 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors bg-slate-900 hover:bg-slate-800 flex items-center justify-center gap-2">
                            {wdLoading ? <Icons.Loader2 size={16} className="animate-spin" /> : <Icons.Upload size={16} />}
                            {wdLoading ? "Memproses..." : "Ajukan Pencairan Dana"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
    return (
        <div className="flex justify-between items-center p-3.5 bg-white">
            <span className="text-[13px] text-slate-500">{label}</span>
            <span className={`text-[13px] ${highlight ? "font-semibold text-indigo-600" : "font-medium text-slate-800"}`}>{value}</span>
        </div>
    )
}
