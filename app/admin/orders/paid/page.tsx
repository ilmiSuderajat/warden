"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import {
    ArrowLeft, Search, RefreshCw,
    MessageCircle, Clock, Truck,
    ChevronRight, Inbox, Loader2, CheckCircle2
} from "lucide-react"
import { useRouter } from "next/navigation"

export default function PaidOrdersPage() {
    const router = useRouter()
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [updatingId, setUpdatingId] = useState<string | null>(null)

    const fetchPaidOrders = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from("orders")
                .select("*, order_items(*)")
                .eq("payment_status", "paid")
                .neq("status", "Selesai") // Tampilkan yang belum selesai
                .order("created_at", { ascending: false })

            if (error) throw error
            setOrders(data || [])
        } catch (err) {
            console.error("Error fetching paid orders:", err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchPaidOrders()
    }, [])

    const handleUpdateToShipping = async (orderId: string) => {
        setUpdatingId(orderId)
        try {
            const { error } = await supabase
                .from("orders")
                .update({ status: "Dikirim" })
                .eq("id", orderId)

            if (error) throw error

            // Update local state
            setOrders(prev => prev.map(order =>
                order.id === orderId ? { ...order, status: "Dikirim" } : order
            ))

            alert("Status pesanan berhasil diupdate menjadi Dikirim")
        } catch (err) {
            console.error("Error updating status:", err)
            alert("Gagal mengupdate status")
        } finally {
            setUpdatingId(null)
        }
    }

    const filteredOrders = orders.filter(order =>
        order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.id.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    return (
        <div className="min-h-screen bg-slate-50/80 font-sans max-w-md mx-auto pb-24">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
                <div className="flex items-center justify-between px-5 pt-12 pb-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.back()}
                            className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
                        >
                            <ArrowLeft size={20} strokeWidth={2.5} />
                        </button>
                        <h1 className="text-lg font-bold text-slate-900 tracking-tight">Sudah Dibayar</h1>
                    </div>
                    <button
                        onClick={fetchPaidOrders}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                        disabled={loading}
                    >
                        <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>

                {/* SEARCH BAR */}
                <div className="px-5 pb-4">
                    <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5">
                        <Search size={16} className="text-slate-400" />
                        <input
                            type="text"
                            placeholder="Cari nama atau ID pesanan..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                        />
                    </div>
                </div>
            </div>

            <div className="p-5">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Loader2 className="animate-spin mb-3 text-indigo-600" size={24} />
                        <p className="text-xs font-medium">Memuat data pesanan...</p>
                    </div>
                ) : filteredOrders.length > 0 ? (
                    <div className="space-y-4">
                        {filteredOrders.map((order) => (
                            <div
                                key={order.id}
                                className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden"
                            >
                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-900">{order.customer_name}</h3>
                                            <p className="text-[10px] text-slate-400 mt-0.5 tracking-wider uppercase font-medium">ID: {order.id.slice(0, 8)}</p>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <p className="text-sm font-bold text-emerald-600">Rp {order.total_amount.toLocaleString('id-ID')}</p>
                                            <div className="flex items-center gap-1 mt-1">
                                                <Clock size={10} className="text-slate-400" />
                                                <span className="text-[10px] text-slate-400 font-medium">{formatDate(order.created_at)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status Badge */}
                                    <div className="mb-4">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${order.status === 'Dikirim'
                                                ? 'bg-blue-50 text-blue-600 border-blue-100'
                                                : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                                            }`}>
                                            {order.status}
                                        </span>
                                    </div>

                                    <div className="space-y-3 mb-5 border-t border-slate-50 pt-4">
                                        {order.order_items?.map((item: any, idx: number) => (
                                            <div key={idx} className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-slate-50 rounded-lg overflow-hidden border border-slate-100 shrink-0">
                                                    <img
                                                        src={Array.isArray(item.image_url) ? item.image_url[0] : item.image_url || "/placeholder.png"}
                                                        className="w-full h-full object-cover"
                                                        alt={item.product_name}
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold text-slate-700 line-clamp-1">{item.product_name}</p>
                                                    <p className="text-[10px] text-slate-400">{item.quantity} x Rp {item.price.toLocaleString('id-ID')}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        {order.status !== "Dikirim" && (
                                            <button
                                                onClick={() => handleUpdateToShipping(order.id)}
                                                disabled={updatingId === order.id}
                                                className="w-full py-3 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                                            >
                                                {updatingId === order.id ? <Loader2 size={16} className="animate-spin" /> : <Truck size={16} />}
                                                Update ke Dikirim
                                            </button>
                                        )}

                                        <button
                                            onClick={() => window.open(`https://wa.me/${order.whatsapp_number.replace(/\D/g, '')}?text=Halo ${order.customer_name}, pesanan Anda #${order.id.slice(0, 8)} sedang kami proses.`)}
                                            className="w-full py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                                        >
                                            <MessageCircle size={16} />
                                            Hubungi Customer
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 flex flex-col items-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-300">
                            <CheckCircle2 size={32} />
                        </div>
                        <p className="text-sm font-semibold text-slate-700">Tidak ada pesanan dibayar</p>
                        <p className="text-xs text-slate-400 mt-1">Semua pesanan dibayar telah diproses atau belum ada.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
