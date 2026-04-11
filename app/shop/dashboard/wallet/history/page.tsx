"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

type Tab = "shop" | "driver" | "semua"

interface ShopLog {
    id: string
    type: string
    amount: number
    balance_after: number
    description: string | null
    order_id: string | null
    created_at: string | null
    source: "shop"
}

interface DriverLog {
    id: string
    type: string
    amount: number
    balance_after: number
    description: string | null
    order_id: string | null
    created_at: string | null
    source: "driver"
}

type CombinedLog = ShopLog | DriverLog

export default function ShopIncomeHistoryPage() {
    const router = useRouter()
    const [shop, setShop] = useState<any>(null)
    const [walletBalance, setWalletBalance] = useState(0)
    const [shopLogs, setShopLogs] = useState<ShopLog[]>([])
    const [driverLogs, setDriverLogs] = useState<DriverLog[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<Tab>("shop")
    const [isDriver, setIsDriver] = useState(false)

    useEffect(() => {
        const fetchHistory = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { router.push("/login"); return }

            const [{ data: shopData }, { data: userData }, { data: wallet }] = await Promise.all([
                supabase.from("shops").select("id, name").eq("owner_id", session.user.id).single(),
                supabase.from("users").select("id, role").eq("id", session.user.id).single(),
                supabase.from("wallets").select("balance").eq("user_id", session.user.id).maybeSingle(),
            ])

            if (!shopData) { router.replace("/shop/create"); return }

            setShop(shopData)
            setWalletBalance(wallet?.balance ?? 0)
            setIsDriver(userData?.role === "driver")

            // Fetch shop_balance_logs using shop_id
            const { data: shopLogsData } = await supabase
                .from("shop_balance_logs")
                .select("*")
                .eq("shop_id", shopData.id)
                .order("created_at", { ascending: false })
                .limit(100)

            setShopLogs((shopLogsData ?? []).map(l => ({ ...l, source: "shop" as const })))

            // If user is also a driver, fetch driver_balance_logs
            if (userData?.role === "driver") {
                const { data: driverLogsData } = await supabase
                    .from("driver_balance_logs")
                    .select("*")
                    .eq("driver_id", session.user.id)
                    .order("created_at", { ascending: false })
                    .limit(100)

                setDriverLogs((driverLogsData ?? []).map(l => ({ ...l, source: "driver" as const })))
            }

            setLoading(false)
        }

        fetchHistory()
    }, [router])

    const formatRp = (v: number) => {
        const abs = `Rp ${Math.abs(v).toLocaleString("id-ID")}`
        return v < 0 ? `−${abs}` : abs
    }

    const displayedLogs: CombinedLog[] = (() => {
        if (activeTab === "shop") return shopLogs
        if (activeTab === "driver") return driverLogs
        // "semua": merge and sort by created_at desc
        return [...shopLogs, ...driverLogs].sort((a, b) =>
            new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        )
    })()

    const typeInfo = (log: CombinedLog) => {
        const { type, amount, source } = log
        const isIn = amount > 0

        if (source === "shop") {
            const shopMap: Record<string, { label: string; icon: any; color: string }> = {
                commission: {
                    label: "Komisi Penjualan",
                    icon: Icons.ShoppingBag,
                    color: "text-emerald-600"
                },
                topup: {
                    label: "Isi Saldo Toko",
                    icon: Icons.PlusCircle,
                    color: "text-indigo-600"
                },
                withdraw: {
                    label: "Penarikan Dana",
                    icon: Icons.ArrowUpFromLine,
                    color: "text-red-500"
                },
                refund: {
                    label: "Refund / Pengembalian",
                    icon: Icons.RefreshCcw,
                    color: "text-amber-600"
                },
            }
            return shopMap[type] ?? { label: type, icon: isIn ? Icons.ArrowDownLeft : Icons.ArrowUpRight, color: isIn ? "text-emerald-600" : "text-red-500" }
        }

        // driver source
        const driverMap: Record<string, { label: string; icon: any; color: string }> = {
            commission_online: {
                label: "Komisi Antar Online",
                icon: Icons.TrendingUp,
                color: "text-emerald-600"
            },
            commission_cod_debit: {
                label: "Potongan COD (20%)",
                icon: Icons.Bike,
                color: "text-red-500"
            },
            topup: {
                label: "Topup Saldo Driver",
                icon: Icons.PlusCircle,
                color: "text-blue-600"
            },
            withdraw: {
                label: "Penarikan Driver",
                icon: Icons.ArrowUpFromLine,
                color: "text-orange-600"
            },
        }
        return driverMap[type] ?? { label: type, icon: isIn ? Icons.ArrowDownLeft : Icons.ArrowUpRight, color: isIn ? "text-emerald-600" : "text-red-500" }
    }

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <Icons.Loader2 className="animate-spin text-indigo-600" size={32} />
        </div>
    )

    const tabs: [Tab, string][] = isDriver
        ? [["shop", "🏪 Toko"], ["driver", "🛵 Driver"], ["semua", "📋 Semua"]]
        : [["shop", "🏪 Toko"], ["semua", "📋 Semua"]]

    return (
        <div className="min-h-screen bg-[#F5F5F5] max-w-md mx-auto font-sans pb-12">
            {/* HEADER */}
            <div className="bg-white border-b border-black/5 sticky top-0 z-40">
                <div className="flex items-center gap-3 px-4 h-14">
                    <Link href="/shop/dashboard/wallet" className="p-1 -ml-1 text-indigo-600">
                        <Icons.ArrowLeft size={24} />
                    </Link>
                    <h1 className="text-lg font-medium text-slate-800">Riwayat Saldo</h1>
                </div>
            </div>

            {/* SALDO CARD */}
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-5 m-3 rounded-2xl text-white shadow-lg">
                <p className="text-xs font-medium opacity-75 mb-1">Total Saldo Wallet</p>
                <p className="text-3xl font-bold tracking-tight">Rp {walletBalance.toLocaleString("id-ID")}</p>
                <p className="text-xs mt-2 opacity-60">{shop?.name}</p>
            </div>

            {/* TABS */}
            <div className="bg-white mx-3 rounded-xl shadow-sm border border-black/5 mb-2 overflow-hidden">
                <div className="flex text-xs font-semibold">
                    {tabs.map(([tab, label]) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`flex-1 py-3 transition-colors ${activeTab === tab ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* SUMMARY STATS */}
            {displayedLogs.length > 0 && (
                <div className="mx-3 mb-2 grid grid-cols-2 gap-2">
                    <div className="bg-white rounded-xl shadow-sm border border-black/5 p-3">
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-1">Total Masuk</p>
                        <p className="text-sm font-bold text-emerald-600">
                            +Rp {displayedLogs.filter(l => l.amount > 0).reduce((s, l) => s + l.amount, 0).toLocaleString("id-ID")}
                        </p>
                    </div>
                    <div className="bg-white rounded-xl shadow-sm border border-black/5 p-3">
                        <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-1">Total Keluar</p>
                        <p className="text-sm font-bold text-red-500">
                            -Rp {Math.abs(displayedLogs.filter(l => l.amount < 0).reduce((s, l) => s + l.amount, 0)).toLocaleString("id-ID")}
                        </p>
                    </div>
                </div>
            )}

            {/* TRANSACTION LIST */}
            <div className="bg-white mx-3 rounded-xl shadow-sm border border-black/5 px-4 py-2">
                {displayedLogs.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center opacity-60">
                        <Icons.Inbox className="w-12 h-12 text-slate-300 mb-3" />
                        <p className="text-sm font-medium text-slate-500">
                            {activeTab === "driver" ? "Belum ada riwayat pengiriman" : "Belum ada transaksi"}
                        </p>
                        {activeTab === "driver" && !isDriver && (
                            <p className="text-xs text-slate-400 mt-1">Akun ini bukan driver</p>
                        )}
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {displayedLogs.map((log) => {
                            const { label, icon: TxIcon, color } = typeInfo(log)
                            const isIncoming = log.amount > 0
                            return (
                                <div key={`${log.source}-${log.id}`} className="flex justify-between items-center py-4">
                                    <div className="flex gap-3 items-center">
                                        <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center ${isIncoming ? "bg-emerald-50" : "bg-red-50"}`}>
                                            <TxIcon size={18} className={color} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <p className="text-[13px] font-semibold text-slate-800 leading-tight">{label}</p>
                                                {log.source === "driver" && (
                                                    <span className="text-[9px] bg-blue-100 text-blue-600 font-bold px-1.5 py-0.5 rounded-full">DRIVER</span>
                                                )}
                                            </div>
                                            {log.description && (
                                                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{log.description}</p>
                                            )}
                                            <p className="text-[10px] text-slate-400 mt-0.5">
                                                {new Date(log.created_at!).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-2">
                                        <p className={`text-sm font-bold ${isIncoming ? "text-emerald-600" : "text-slate-800"}`}>
                                            {isIncoming ? "+" : ""}{formatRp(log.amount)}
                                        </p>
                                        {log.balance_after !== undefined && (
                                            <p className="text-[10px] text-slate-400 mt-0.5">Sisa {formatRp(log.balance_after)}</p>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
