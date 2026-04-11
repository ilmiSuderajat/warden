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

type ShopLog = {
    id: string
    shop_id: string | null
    type: string
    amount: number
    balance_after: number
    description: string | null
    order_id: string | null
    created_at: string | null
}

type WithdrawReq = {
    id: string
    shop_id: string | null
    amount: number
    bank_name: string | null
    account_number: string | null
    account_name: string | null
    status: string | null
    notes: string | null
    created_at: string | null
}

const TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
    commission: { label: "Komisi Penjualan",   icon: Icons.ShoppingBag,     color: "text-emerald-600" },
    topup:      { label: "Isi Saldo",           icon: Icons.Download,        color: "text-indigo-600"  },
    withdraw:   { label: "Tarik Dana",          icon: Icons.Upload,          color: "text-rose-500"    },
    refund:     { label: "Refund",              icon: Icons.RotateCcw,       color: "text-amber-600"   },
}

const FILTER_OPTIONS = ["Semua", "Masuk", "Keluar"] as const
type FilterOption = typeof FILTER_OPTIONS[number]

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    pending:  { label: "Diproses",  color: "text-amber-500"   },
    approved: { label: "Berhasil",  color: "text-emerald-500" },
    rejected: { label: "Ditolak",   color: "text-slate-400"   },
}

export default function ShopWalletPage() {
    const router = useRouter()
    const [shop, setShop] = useState<any>(null)
    const [balance, setBalance] = useState(0)
    const [loading, setLoading] = useState(true)
    const [logs, setLogs] = useState<ShopLog[]>([])
    const [withdraws, setWithdraws] = useState<WithdrawReq[]>([])

    const [activeTab, setActiveTab] = useState<"history" | "withdrawals">("history")
    const [activeFilter, setActiveFilter] = useState<FilterOption>("Semua")

    // Detail modal
    const [selectedLog, setSelectedLog] = useState<ShopLog | null>(null)
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

        const [{ data: shopData }, { data: walletData }] = await Promise.all([
            supabase.from("shops").select("id, name, owner_id").eq("owner_id", session.user.id).single(),
            supabase.from("wallets").select("balance").eq("user_id", session.user.id).maybeSingle(),
        ])

        if (!shopData) { router.replace("/shop/create"); return }

        setShop(shopData)
        setBalance(walletData?.balance ?? 0)

        // Fetch shop-specific balance history and withdraw requests in parallel
        const [{ data: logsData }, { data: wdData }] = await Promise.all([
            supabase.from("shop_balance_logs")
                .select("*")
                .eq("shop_id", shopData.id)
                .order("created_at", { ascending: false })
                .limit(100),
            supabase.from("shop_withdraw_requests")
                .select("*")
                .eq("shop_id", shopData.id)
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

    // Fetch order detail when a log with order_id is selected
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
            const res = await fetch("/api/shop/topup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setShowTopup(false); setTopupAmount("")
            window.snap.pay(data.token, {
                onSuccess: () => { showToast("Topup berhasil!"); fetchData() },
                onPending: () => { showToast("Menunggu konfirmasi pembayaran..."); fetchData() },
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
            const res = await fetch("/api/shop/withdraw", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount, bank_name: wdBank, account_number: wdAccount, account_name: wdName }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            setShowWithdraw(false)
            setWdAmount(""); setWdBank(""); setWdAccount(""); setWdName("")
            showToast("Pengajuan penarikan dana berhasil!")
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

    return (
        <div className="min-h-screen bg-slate-50 max-w-md mx-auto font-sans pb-6">

            {/* Toast */}
            {toastMsg && (
                <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white transition-all ${toastMsg.type === "success" ? "bg-emerald-500" : "bg-red-500"}`}>
                    {toastMsg.msg}
                </div>
            )}

            {/* ── INDIGO HEADER ─────────────────────────────────── */}
            <div className="bg-indigo-600 px-4 pt-10 pb-20 relative">
                <header className="flex items-center justify-between mb-6 text-white">
                    <Link href="/shop/dashboard" className="p-1 hover:bg-white/10 rounded-full transition-colors">
                        <Icons.ArrowLeft size={24} />
                    </Link>
                    <h1 className="text-lg font-medium tracking-wide">Keuangan Toko</h1>
                    <div className="w-8 opacity-0"><Icons.Settings size={22} /></div>
                </header>

                <div className="text-white px-2">
                    <div className="flex items-center gap-2 mb-1 opacity-90">
                        <Icons.Store size={16} />
                        <span className="text-sm">{loading ? "Memuat..." : (shop?.name ?? "Toko Saya")}</span>
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

                    {/* Shop name badge */}
                    <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-indigo-600">
                            <Icons.Store size={18} />
                            <span className="text-sm font-semibold text-slate-700">{shop?.name ?? "Toko Saya"}</span>
                        </div>
                        <span className="text-xs text-slate-400">Warung Warden</span>
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
                                {tab === "history" ? "Riwayat Transaksi" : "Penarikan"}
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
                                    <p className="text-sm font-medium text-slate-500">Belum ada transaksi toko</p>
                                    <p className="text-xs text-slate-400 mt-1">Transaksi muncul setelah ada pesanan masuk</p>
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
                                        // Untuk commission: amount adalah pendapatan bersih (sudah dipotong 5%)
                                        // Hitung balik: gross = amount / 0.95, fee = gross - amount
                                        const isCommission = log.type === "commission" && log.amount > 0
                                        const grossAmount = isCommission ? Math.round(log.amount / 0.95) : null
                                        const platformFee = isCommission && grossAmount ? grossAmount - log.amount : null
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
                                                        <p className={`text-[13px] font-semibold flex-shrink-0 ${log.amount > 0 ? "text-emerald-500" : "text-slate-800"}`}>
                                                            {log.amount > 0 ? "+" : ""}{formatCurrency(log.amount)}
                                                        </p>
                                                    </div>
                                                    {isCommission && platformFee !== null && (
                                                        <p className="text-[11px] text-rose-400 mb-0.5">Komisi platform: -{formatCurrency(platformFee)}</p>
                                                    )}
                                                    <div className="flex justify-between items-center">
                                                        <p className="text-[11px] text-slate-400">{formatDateShort(log.created_at)}</p>
                                                        <p className="text-[11px] text-slate-400 bg-slate-100 px-1.5 rounded">Berhasil</p>
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
                                    <DetailRow label="Waktu" value={formatDate(selectedLog.created_at)} />
                                    <DetailRow label="Saldo Akhir" value={formatCurrency(selectedLog.balance_after)} />
                                    <DetailRow label="No. Referensi" value={selectedLog.id.split("-")[0].toUpperCase()} highlight />
                                    {selectedLog.description && <DetailRow label="Catatan" value={selectedLog.description} />}
                                </div>

                                {selectedLog.order_id && (
                                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                                        <div className="p-3 bg-slate-50 border-b border-slate-100">
                                            <p className="text-xs font-semibold text-slate-700">Rincian Pesanan</p>
                                        </div>
                                        <div className="p-3">
                                            {loadingDetail ? (
                                                <div className="flex justify-center py-4">
                                                    <Icons.Loader2 size={20} className="text-indigo-400 animate-spin" />
                                                </div>
                                            ) : orderDetail ? (() => {
                                                // Merchant hanya mendapat dari subtotal (harga produk), bukan ongkir
                                                const subtotal = orderDetail.subtotal_amount ?? 0
                                                const platformFeeAmt = Math.round(subtotal * 0.05)
                                                const netEarning = subtotal - platformFeeAmt
                                                return (
                                                    <div className="space-y-3">
                                                        {orderDetail.items.map((item: any) => {
                                                            const rawImg = item.products?.image_url
                                                            const imgSrc = Array.isArray(rawImg) ? rawImg[0] : rawImg
                                                            return (
                                                                <div key={item.id} className="flex items-center gap-2.5">
                                                                    {imgSrc ? (
                                                                        <img src={imgSrc} alt={item.product_name} className="w-11 h-11 rounded-lg object-cover shrink-0 border border-slate-100" />
                                                                    ) : (
                                                                        <div className="w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                                                            <Icons.ShoppingBag size={16} className="text-slate-300" />
                                                                        </div>
                                                                    )}
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-[13px] font-medium text-slate-800 truncate">{item.product_name.split(" | ")[0]}</p>
                                                                        {item.variants && Object.keys(item.variants).length > 0 && (
                                                                            <p className="text-[10px] text-slate-500 leading-tight mb-0.5">
                                                                                Variasi: {Object.entries(item.variants as Record<string, any>).map(([key, val]) => `${val.label}`).join(", ")}
                                                                            </p>
                                                                        )}
                                                                        <p className="text-xs text-slate-400">{item.quantity} x {formatCurrency(item.price)}</p>
                                                                    </div>
                                                                    <span className="text-[13px] font-medium text-slate-800 shrink-0">{formatCurrency(item.price * item.quantity)}</span>
                                                                </div>
                                                            )
                                                        })}
                                                        <div className="pt-2 mt-1 border-t border-dashed border-slate-200 space-y-1.5">
                                                            {/* Total penjualan produk (tanpa ongkir) */}
                                                            <div className="flex justify-between text-[12px] text-slate-600 font-medium">
                                                                <span>Total Penjualan Produk</span>
                                                                <span>{formatCurrency(subtotal)}</span>
                                                            </div>
                                                            {/* Potongan komisi platform */}
                                                            <div className="flex justify-between text-[12px] text-rose-500">
                                                                <span className="flex items-center gap-1">
                                                                    <Icons.Percent size={11} />
                                                                    Komisi Platform (5%)
                                                                </span>
                                                                <span>-{formatCurrency(platformFeeAmt)}</span>
                                                            </div>
                                                            {/* Pendapatan bersih */}
                                                            <div className="flex justify-between text-[13px] font-bold text-emerald-700 pt-2 border-t border-slate-100">
                                                                <span>Pendapatan Bersih</span>
                                                                <span>+{formatCurrency(netEarning)}</span>
                                                            </div>
                                                            {/* Catatan: ongkir bukan urusan merchant */}
                                                            <p className="text-[10px] text-slate-400 pt-1">* Ongkos kirim dikelola langsung oleh kurir</p>
                                                        </div>
                                                    </div>
                                                )
                                            })() : (
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
                        <h2 className="text-base font-semibold text-slate-900 mb-1">Isi Saldo Toko</h2>
                        <p className="text-xs text-slate-500 mb-5">Untuk keamanan toko & buka blokir COD</p>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5 ml-1">Nominal Topup</label>
                        <div className="relative mb-5">
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
                        <h2 className="text-base font-semibold text-slate-900 mb-1">Tarik Dana Toko</h2>
                        <p className="text-xs text-slate-500 mb-5">Saldo tersedia: <span className="font-bold text-slate-800">{formatCurrency(balance)}</span></p>
                        <div className="space-y-3 mb-5">
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">Rp</span>
                                <input type="number" placeholder="Nominal pencairan" value={wdAmount}
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

function DetailRow({ label, value, highlight }: { label: string; value: string; isFirst?: boolean; highlight?: boolean }) {
    return (
        <div className="flex justify-between items-center p-3.5 bg-white">
            <span className="text-[13px] text-slate-500">{label}</span>
            <span className={`text-[13px] ${highlight ? "font-semibold text-indigo-600" : "font-medium text-slate-800"}`}>{value}</span>
        </div>
    )
}
