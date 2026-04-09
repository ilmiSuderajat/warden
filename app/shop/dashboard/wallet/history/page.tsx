"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function ShopIncomeHistoryPage() {
    const router = useRouter()
    const [shop, setShop] = useState<any>(null)
    const [logs, setLogs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchHistory = async () => {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                router.push("/login")
                return
            }

            const { data: shopData } = await supabase
                .from("shops")
                .select("id, name, balance")
                .eq("owner_id", session.user.id)
                .single()

            if (!shopData) {
                router.replace("/shop/create")
                return
            }
            setShop(shopData)

            const { data: logsData, error } = await supabase
                .from("shop_balance_logs")
                .select("*")
                .eq("shop_id", shopData.id)
                .order("created_at", { ascending: false })

            if (logsData) {
                setLogs(logsData)
            }
            setLoading(false)
        }

        fetchHistory()
    }, [router])

    const formatRp = (v: number) => `Rp ${Math.abs(v).toLocaleString("id-ID")}`

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Icons.Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#F5F5F5] max-w-md mx-auto font-sans pb-12">
            {/* HEADER */}
            <div className="bg-white border-b border-black/5 sticky top-0 z-40">
                <div className="flex items-center justify-between px-4 h-14">
                    <div className="flex items-center gap-3">
                        <Link href="/shop/dashboard/wallet" className="p-1 -ml-1 text-indigo-600">
                            <Icons.ArrowLeft size={24} />
                        </Link>
                        <h1 className="text-lg font-medium text-slate-800">Riwayat Penghasilan</h1>
                    </div>
                </div>
            </div>

            {/* BALANCE OVERVIEW */}
            <div className="bg-white p-4 mb-2 shadow-sm">
                <p className="text-xs font-semibold text-slate-500 mb-1">Saldo Toko Saat Ini</p>
                <p className="text-2xl font-bold text-indigo-600">
                    {formatRp(shop?.balance || 0)}
                </p>
            </div>

            {/* TRANSACTION HISTORY */}
            <div className="bg-white px-4 py-2 mt-2">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 mt-2">Riwayat Transaksi</h2>

                {logs.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center opacity-60">
                        <Icons.Inbox className="w-12 h-12 text-slate-300 mb-3" />
                        <p className="text-sm font-medium text-slate-500">Belum ada riwayat transaksi</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {logs.map((log) => {
                            const isIncoming = log.amount > 0 || log.type === 'deposit_success' || log.type === 'order_completion'
                            return (
                                <div key={log.id} className="flex justify-between items-start border-b border-slate-50 pb-4 last:border-0 last:pb-0">
                                    <div className="flex gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isIncoming ? 'bg-emerald-50' : 'bg-red-50'}`}>
                                            {isIncoming ? (
                                                <Icons.ArrowDownLeft size={18} className="text-emerald-500" />
                                            ) : (
                                                <Icons.ArrowUpRight size={18} className="text-red-500" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-[13px] font-semibold text-slate-800 leading-tight">
                                                {log.description || (isIncoming ? "Pemasukan" : "Pengeluaran")}
                                            </p>
                                            {log.order_id && (
                                                <p className="text-[10px] text-slate-400 mt-0.5">Order: #{log.order_id.slice(0, 8)}</p>
                                            )}
                                            <p className="text-[11px] text-slate-500 mt-1">
                                                {new Date(log.created_at).toLocaleString("id-ID", {
                                                    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                                                })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-sm font-bold ${isIncoming ? 'text-emerald-600' : 'text-slate-800'}`}>
                                            {isIncoming ? '+' : ''}{formatRp(log.amount)}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-medium mt-1">Sisa: {formatRp(log.balance_after)}</p>
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
