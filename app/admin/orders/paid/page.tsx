"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import {
    ArrowLeft, Search, RefreshCw,
    MessageCircle, Clock, Truck,
    ChevronRight, Inbox, Loader2, CheckCircle2, MapPin, AlertCircle
} from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

interface DebugInfo {
    totalWide: number;
    filtered: number;
    statuses: any[];
    itemsCount?: number;
}

export default function PaidOrdersPage() {
    const router = useRouter()
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [searchQuery, setSearchQuery] = useState("")
    const [updatingId, setUpdatingId] = useState<string | null>(null)

    const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)
    const [showDebug, setShowDebug] = useState(false)
    const [allProducts, setAllProducts] = useState<any[]>([])

    const fetchPaidOrders = async () => {
        setLoading(true)
        setError(null)
        try {
            console.log("🔍 Fetching Paid/Processing Orders...")
            // 1. Ambil data orders secara luas untuk debug
            const { data: allOrders, error: debugError } = await supabase
                .from("orders")
                .select("id, payment_status, status")

            console.log("📊 Debug All Orders Status:", allOrders?.map(o => `${o.payment_status}/${o.status}`));

            // 2. Ambil data yang difilter
            const { data: ordersData, error: ordersError } = await supabase
                .from("orders")
                .select("*")
                .in("payment_status", ["paid", "processing"])
                .neq("status", "Selesai")
                .order("created_at", { ascending: false })

            if (ordersError) {
                console.error("❌ Orders Query Error:", ordersError)
                throw ordersError
            }

            console.log("📦 Filtered Orders Data:", ordersData)
            setDebugInfo({
                totalWide: allOrders?.length || 0,
                filtered: ordersData?.length || 0,
                statuses: [...new Set(allOrders?.map(o => o.payment_status))]
            })

            if (!ordersData || ordersData.length === 0) {
                setOrders([])
                return
            }

            // 2. Ambil data pendukung (Products & Items)
            const { data: prodData } = await supabase.from("products").select("name, latitude, longitude, location")
            if (prodData) setAllProducts(prodData)

            const orderIds = ordersData.map(o => o.id)
            console.log("🔗 Searching Items for IDs:", orderIds)

            const { data: itemsData, error: itemsError } = await supabase
                .from("order_items")
                .select("*")
                .in("order_id", orderIds)

            if (itemsError) {
                console.error("❌ Items Fetch Error:", itemsError.message)
                setError(`Gagal memuat rincian produk: ${itemsError.message}`)
            }

            console.log("💎 Raw Items Found:", itemsData?.length || 0)

            // 3. Gabungkan data
            const combinedData = ordersData.map(order => ({
                ...order,
                order_items: itemsData ? itemsData.filter(item => item.order_id === order.id).map(item => {
                    const p = prodData?.find(p => p.name === item.product_name)
                    return { ...item, product_details: p }
                }) : []
            }))

            setOrders(combinedData)
            setDebugInfo(prev => prev ? ({
                ...prev,
                itemsCount: itemsData?.length || 0
            }) : null)
            console.log("✅ Berhasil memuat pesanan paid:", combinedData.length)

        } catch (err: any) {
            console.error("Error fetching paid orders:", err)
            setError(err.message || "Gagal mengambil data pesanan")
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

            toast.success("Status pesanan berhasil diupdate menjadi Dikirim")
        } catch (err) {
            console.error("Error updating status:", err)
            toast.error("Gagal mengupdate status")
        } finally {
            setUpdatingId(null)
        }
    }

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
                        onClick={() => setShowDebug(!showDebug)}
                        className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-colors"
                        title="Toggle Debug"
                    >
                        <AlertCircle size={20} />
                    </button>
                    <button
                        onClick={fetchPaidOrders}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                        disabled={loading}
                    >
                        <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>

                {/* DEBUG PANEL */}
                {showDebug && debugInfo && (
                    <div className="mx-5 mb-4 p-3 bg-slate-900 text-slate-300 rounded-xl text-[10px] font-mono overflow-auto max-h-40 border border-slate-700">
                        <p className="text-emerald-400 font-bold mb-1 underline">DEBUG INFO</p>
                        <p>Total di DB: {debugInfo.totalWide}</p>
                        <p>Lolos Filter: {debugInfo.filtered}</p>
                        <p>Items Fetched: {debugInfo.itemsCount || 0}</p>
                        <p>Payment Statuses: {debugInfo.statuses?.join(', ')}</p>
                        <div className="mt-2 text-[8px] text-slate-500">
                            Check Browser Console for raw data!
                        </div>
                    </div>
                )}

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
                {error && (
                    <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-start gap-3 mb-4">
                        <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <p className="text-xs font-bold text-red-600">Terjadi Error</p>
                            <p className="text-[10px] text-red-500 mt-1">{error}</p>
                            <button
                                onClick={fetchPaidOrders}
                                className="mt-2 text-[10px] font-bold text-red-600 underline"
                            >
                                Coba Lagi
                            </button>
                        </div>
                    </div>
                )}

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
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-sm font-bold text-slate-900 truncate">{order.customer_name}</h3>
                                            <p className="text-[10px] text-slate-400 mt-0.5 tracking-wider uppercase font-medium">ID: {order.id.slice(0, 8)}</p>
                                            <div className="mt-2 flex items-start gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                <p className="text-[10px] text-slate-500 leading-relaxed uppercase font-medium line-clamp-2">
                                                    {order.address}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const query = order.latitude && order.longitude
                                                        ? `${order.latitude},${order.longitude}`
                                                        : encodeURIComponent(order.address);
                                                    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
                                                }}
                                                className="mt-2 flex items-center gap-1.5 text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md hover:bg-indigo-100 transition-colors w-fit"
                                            >
                                                <MapPin size={10} />
                                                Kirim Ke Lokasi Ini (Maps)
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const query = order.latitude && order.longitude
                                                        ? `${order.latitude},${order.longitude}`
                                                        : encodeURIComponent(order.address);
                                                    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
                                                }}
                                                className="mt-2 flex items-center gap-1.5 text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md hover:bg-indigo-100 transition-colors w-fit"
                                            >
                                                <MapPin size={10} />
                                                Lihat Alamat di Maps
                                            </button>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <p className="text-sm font-bold text-emerald-600">Rp {order.total_amount.toLocaleString('id-ID')}</p>
                                            <div className="flex items-center gap-1 mt-1">
                                                <Clock size={10} className="text-slate-400" />
                                                <span className="text-[10px] text-slate-400 font-medium">{formatDate(order.created_at)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status & Payment Method Badge */}
                                    <div className="flex flex-wrap gap-2 mb-4">
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${order.status === 'Dikirim'
                                            ? 'bg-blue-50 text-blue-600 border-blue-100'
                                            : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                                            }`}>
                                            {order.status}
                                        </span>
                                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${order.payment_method === 'cod'
                                            ? 'bg-amber-50 text-amber-600 border-amber-100'
                                            : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                            }`}>
                                            {order.payment_method === 'cod' ? 'COD' : 'ONLINE'}
                                        </span>
                                    </div>

                                    {/* Rincian Biaya */}
                                    <div className="border-t border-slate-50 pt-4 mb-4 space-y-1">
                                        <div className="flex justify-between text-[10px] font-medium text-slate-500">
                                            <span>Subtotal Produk</span>
                                            <span>Rp {(order.subtotal_amount || 0).toLocaleString('id-ID')}</span>
                                        </div>
                                        <div className="flex justify-between text-[10px] font-medium text-slate-500">
                                            <span>Ongkos Kirim ({order.distance_km || 0} km)</span>
                                            <span>Rp {(order.shipping_amount || 0).toLocaleString('id-ID')}</span>
                                        </div>
                                        <div className="flex justify-between text-xs font-bold text-slate-900 pt-1">
                                            <span>Total Bayar</span>
                                            <span>Rp {order.total_amount.toLocaleString('id-ID')}</span>
                                        </div>
                                    </div>

                                    <div className="space-y-3 mb-5 border-t border-slate-50 pt-4">
                                        {order.order_items?.length > 0 ? order.order_items.map((item: any, idx: number) => (
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
                                        )) : (
                                            <p className="text-[10px] text-slate-400 italic">Rincian produk tidak tersedia</p>
                                        )}
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
                                            onClick={() => window.open(`https://wa.me/${(order.whatsapp_number || "").replace(/\D/g, '')}?text=Halo ${order.customer_name}, pesanan Anda #${order.id.slice(0, 8)} sedang kami proses.`)}
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
