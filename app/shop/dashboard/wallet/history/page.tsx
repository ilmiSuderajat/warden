"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

type TxType = "payment" | "refund" | "topup" | "commission" | "withdraw" | string

type Tab = "merchant" | "driver" | "semua"

// Since backend uses "commission" for both shop and driver, we check description
const isMerchantTx = (t: Transaction) => 
    t.type === "withdraw" || (t.type === "commission" && !t.description?.toLowerCase().includes("ongkir"))

const isDriverTx = (t: Transaction) => 
    t.type === "withdraw" || (t.type === "commission" && t.description?.toLowerCase().includes("ongkir"))

interface Transaction {
    id: string
    type: TxType
    amount: number
    description: string | null
    created_at: string
    order_id: string | null
    balance_after?: number
}

export default function ShopIncomeHistoryPage() {
    const router = useRouter()
    const [shop, setShop] = useState<any>(null)
    const [walletBalance, setWalletBalance] = useState(0)
    const [logs, setLogs] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<Tab>("merchant")
    const [isDriver, setIsDriver] = useState(false)

    useEffect(() => {
        const fetchHistory = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) { router.push("/login"); return }

            const [{ data: shopData }, { data: userData }, { data: wallet }, { data: allTx }] = await Promise.all([
                supabase.from("shops").select("id, name").eq("owner_id", session.user.id).single(),
                supabase.from("users").select("role").eq("id", session.user.id).single(),
                supabase.from("wallets").select("balance").eq("user_id", session.user.id).single(),
                supabase.from("transactions").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false }),
            ])

            if (!shopData) { router.replace("/shop/create"); return }

            setShop(shopData)
            setWalletBalance(wallet?.balance ?? 0)
            setLogs(allTx ?? [])
            setIsDriver(userData?.role === "driver")
            setLoading(false)
        }

        fetchHistory()
    }, [router])

    const formatRp = (v: number) => {
        const abs = `Rp ${Math.abs(v).toLocaleString("id-ID")}`
        return v < 0 ? `−${abs}` : abs
    }

    const filteredLogs = (() => {
        if (activeTab === "merchant") return logs.filter(isMerchantTx)
        if (activeTab === "driver") return logs.filter(isDriverTx)
        return logs // semua
    })()

    const typeInfo = (type: TxType, amount: number) => {
        const isIn = amount > 0
        const map: Record<string, { label: string; icon: any; color: string }> = {
            commission: { 
                label: amount > 0 ? "Asal Penjualan" : "Komisi Penjualan", 
                icon: Icons.ShoppingBag, 
                color: "text-emerald-600" 
            },
            refund:     { label: "Refund / Pengembalian", icon: Icons.RefreshCcw, color: "text-amber-600" },
            withdraw:   { label: "Penarikan Dana", icon: Icons.ArrowUpFromLine, color: "text-red-500" },
        }
        return map[type] ?? { label: type, icon: isIn ? Icons.ArrowDownLeft : Icons.ArrowUpRight, color: isIn ? "text-emerald-600" : "text-red-500" }
    }

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <Icons.Loader2 className="animate-spin text-indigo-600" size={32} />
        </div>
    )

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
                <p className="text-xs font-medium opacity-75 mb-1">Total Saldo</p>
                <p className="text-3xl font-bold tracking-tight">Rp {walletBalance.toLocaleString("id-ID")}</p>
                <p className="text-xs mt-2 opacity-60">{shop?.name}</p>
            </div>

            {/* TABS */}
            <div className="bg-white mx-3 rounded-xl shadow-sm border border-black/5 mb-2 overflow-hidden">
                <div className="flex text-xs font-semibold">
                    {([["merchant", "🏪 Toko"], ["driver", "🛵 Driver"], ["semua", "📋 Semua"]] as [Tab, string][]).map(([tab, label]) => (
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

            {/* TRANSACTION LIST */}
            <div className="bg-white mx-3 rounded-xl shadow-sm border border-black/5 px-4 py-2">
                {filteredLogs.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center opacity-60">
                        <Icons.Inbox className="w-12 h-12 text-slate-300 mb-3" />
                        <p className="text-sm font-medium text-slate-500">Belum ada transaksi</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {filteredLogs.map((log) => {
                            const { label, icon: TxIcon, color } = typeInfo(log.type, log.amount)
                            const isIncoming = log.amount > 0
                            return (
                                <div key={log.id} className="flex justify-between items-center py-4">
                                    <div className="flex gap-3 items-center">
                                        <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center ${isIncoming ? "bg-emerald-50" : "bg-red-50"}`}>
                                            <TxIcon size={18} className={color} />
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-semibold text-slate-800 leading-tight">{label}</p>
                                            {log.description && (
                                                <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{log.description}</p>
                                            )}
                                            <p className="text-[10px] text-slate-400 mt-0.5">
                                                {new Date(log.created_at).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
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
