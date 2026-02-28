"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import {
    ArrowLeft, Search, RefreshCw,
    MessageCircle, CheckCircle2,
    Inbox, Loader2, MapPin, AlertCircle
} from "lucide-react"
import { useRouter } from "next/navigation"

export default function CompletedOrdersPage() {
    const router = useRouter()
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState("")

    const fetchCompletedOrders = async () => {
        setLoading(true)
        setError(null)
        try {
            const { data: ordersData, error: ordersError } = await supabase
                .from("orders")
                .select("*")
                .eq("status", "Selesai")
                .order("created_at", { ascending: false })

            if (ordersError) throw ordersError

            if (!ordersData || ordersData.length === 0) {
                setOrders([])
                return
            }

            const { data: prodData } = await supabase.from("products").select("name, latitude, longitude, location")

            const orderIds = ordersData.map(o => o.id)
            const { data: itemsData, error: itemsError } = await supabase
                .from("order_items")
                .select("*")
                .in("order_id", orderIds)

            if (itemsError) throw itemsError

            const combinedData = ordersData.map(order => ({
                ...order,
                order_items: itemsData ? itemsData.filter(item => item.order_id === order.id).map(item => {
                    const p = prodData?.find(p => p.name === item.product_name)
                    return { ...item, product_details: p }
                }) : []
            }))

            setOrders(combinedData)
        } catch (err: any) {
            console.error("Error fetching completed orders:", err)
            setError(err.message || "Gagal mengambil data pesanan")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchCompletedOrders()
    }, [])

    const filteredOrders = orders.filter(order =>
        (order.customer_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (order.id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (order.whatsapp_number && order.whatsapp_number.includes(searchQuery))
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
            <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
                <div className="flex items-center justify-between px-5 pt-12 pb-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.back()}
                            className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
                        >
                            <ArrowLeft size={20} strokeWidth={2.5} />
                        </button>
                        <h1 className="text-lg font-bold text-slate-900 tracking-tight">Pesanan Selesai</h1>
                    </div>
                    <button
                        onClick={fetchCompletedOrders}
                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                        disabled={loading}
                    >
                        <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>

                <div className="px-5 pb-4">
                    <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-xl px-4 py-2.5">
                        <Search size={16} className="text-slate-400" />
                        <input
                            type="text"
                            placeholder="Cari pesanan selesai..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                        />
                    </div>
                </div>
            </div>

            <div className="p-5">
                {error && (
                    <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-start gap-3 mb-4">
                        <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-xs font-bold text-red-600">Terjadi Error</p>
                            <p className="text-[10px] text-red-500 mt-1">{error}</p>
                            <button onClick={fetchCompletedOrders} className="mt-2 text-[10px] font-bold text-red-600 underline">Coba Lagi</button>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Loader2 className="animate-spin mb-3 text-emerald-600" size={24} />
                        <p className="text-xs font-medium">Memuat riwayat...</p>
                    </div>
                ) : filteredOrders.length > 0 ? (
                    <div className="space-y-4">
                        {filteredOrders.map((order) => (
                            <div key={order.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden opacity-90">
                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm font-bold text-slate-900 truncate">{order.customer_name}</h3>
                                            <p className="text-[10px] text-slate-400 mt-0.5 tracking-wider uppercase font-medium">ID: {order.id.slice(0, 8)}</p>
                                            <div className="mt-2 flex items-start gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                <MapPin size={12} className="text-slate-400 shrink-0 mt-0.5" />
                                                <p className="text-[10px] text-slate-500 leading-relaxed uppercase font-medium line-clamp-2">{order.address}</p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const query = order.latitude && order.longitude
                                                        ? `${order.latitude},${order.longitude}`
                                                        : encodeURIComponent(order.address);
                                                    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
                                                }}
                                                className="mt-2 flex items-center gap-1.5 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md hover:bg-emerald-100 transition-colors w-fit"
                                            >
                                                <MapPin size={10} />
                                                Kirim Ke Lokasi Ini (Maps)
                                            </button>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <p className="text-sm font-bold text-slate-900">Rp {order.total_amount.toLocaleString('id-ID')}</p>
                                            <div className="flex items-center gap-1 mt-1">
                                                <CheckCircle2 size={10} className="text-emerald-500" />
                                                <span className="text-[10px] text-emerald-500 font-bold uppercase">Selesai</span>
                                            </div>
                                            <p className="text-[9px] text-slate-400 mt-1">{formatDate(order.created_at)}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3 mb-4 border-t border-slate-50 pt-4">
                                        {order.order_items?.map((item: any, idx: number) => (
                                            <div key={idx} className="flex items-center gap-3 grayscale-[0.5]">
                                                <div className="w-10 h-10 bg-slate-50 rounded-lg overflow-hidden border border-slate-100 shrink-0">
                                                    <img src={Array.isArray(item.image_url) ? item.image_url[0] : item.image_url || "/placeholder.png"} className="w-full h-full object-cover" alt={item.product_name} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-semibold text-slate-700 line-clamp-1">{item.product_name}</p>
                                                    <p className="text-[10px] text-slate-400">{item.quantity} x Rp {item.price.toLocaleString('id-ID')}</p>
                                                    {item.product_details?.latitude && (
                                                        <button
                                                            onClick={() => window.open(`https://www.google.com/maps?q=${item.product_details.latitude},${item.product_details.longitude}`, '_blank')}
                                                            className="mt-1 text-[9px] text-emerald-600 font-medium flex items-center gap-1 hover:underline"
                                                        >
                                                            <MapPin size={8} />
                                                            Ambil Produk ({item.product_details.location || 'Toko'})
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        onClick={() => window.open(`https://wa.me/${(order.whatsapp_number || "").replace(/\D/g, '')}?text=Halo ${order.customer_name}, terima kasih telah berbelanja di toko kami.`)}
                                        className="w-full py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <MessageCircle size={16} />
                                        Hubungi Customer
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 flex flex-col items-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-300">
                            <CheckCircle2 size={32} />
                        </div>
                        <p className="text-sm font-semibold text-slate-700">Belum ada riwayat</p>
                        <p className="text-xs text-slate-400 mt-1">Pesanan yang telah selesai akan muncul di sini.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
