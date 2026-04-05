"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

export default function ShopOrdersPage() {
    const router = useRouter()
    const searchParams = useSearchParams()

    // Inisialisasi tab dari URL param ?tab=, fallback ke "baru"
    const tabFromUrl = searchParams.get("tab") || "baru"
    const [activeTab, setActiveTab] = useState(tabFromUrl)
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [shop, setShop] = useState<any>(null)

    const tabs = [
        { id: "baru", label: "Baru", icon: "Clock" },
        { id: "proses", label: "Diproses", icon: "ChefHat" },
        { id: "dikirim", label: "Dikirim", icon: "Truck" },
        { id: "selesai", label: "Selesai", icon: "CheckCircle2" },
    ]

    // Sync URL ke tab aktif saat URL berubah dari luar
    useEffect(() => {
        const t = searchParams.get("tab") || "baru"
        if (t !== activeTab) setActiveTab(t)
    }, [searchParams])

    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId)
        const params = new URLSearchParams(searchParams.toString())
        params.set("tab", tabId)
        router.replace(`/shop/dashboard/orders?${params.toString()}`, { scroll: false })
    }

    useEffect(() => {
        fetchShopAndOrders()
    }, [activeTab])

    const fetchShopAndOrders = async () => {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return router.push("/login")

        const { data: shopData } = await supabase
            .from("shops")
            .select("*")
            .eq("owner_id", user.id)
            .maybeSingle()

        if (!shopData) return router.replace("/shop/create")
        setShop(shopData)

        try {
            const { data: allOrders, error: orderError } = await supabase
                .from("orders")
                .select("*, order_items(*)")

            if (orderError) throw orderError

            // Filter orders yang milik toko ini berdasarkan product_name
            let filteredOrders = allOrders?.filter(order =>
                order.order_items?.some((item: any) =>
                    item.product_name?.includes(`| ${shopData.id}`)
                )
            ) || []

            // Map ulang items agar hanya menampilkan produk milik toko ini
            filteredOrders = filteredOrders.map(order => ({
                ...order,
                items: order.order_items
                    ?.filter((item: any) => item.product_name?.includes(`| ${shopData.id}`))
                    .map((item: any) => ({
                        ...item,
                        product_name: item.product_name?.split(" | ")[0]
                    })) || []
            }))

            // Filter berdasarkan tab aktif
            // Tab "Baru": pesanan baru masuk, belum diproses
            if (activeTab === "baru") {
                filteredOrders = filteredOrders.filter((o: any) =>
                    ["Perlu Dikemas", "Menunggu Konfirmasi"].includes(o.status) &&
                    o.payment_status === "paid"
                )
            }
            // Tab "Diproses": sedang dikemas atau menunggu kurir
            if (activeTab === "proses") {
                filteredOrders = filteredOrders.filter((o: any) =>
                    ["Diproses", "Mencari Kurir", "Kurir Menuju Lokasi", "Kurir di Toko"].includes(o.status)
                )
            }
            // Tab "Dikirim": kurir sudah mengambil paket
            if (activeTab === "dikirim") {
                filteredOrders = filteredOrders.filter((o: any) =>
                    ["Dikirim", "Kurir di Lokasi", "Kurir Tidak Tersedia"].includes(o.status)
                )
            }
            // Tab "Selesai": termasuk dibatalkan
            if (activeTab === "selesai") {
                filteredOrders = filteredOrders.filter((o: any) =>
                    ["Selesai", "Dibatalkan"].includes(o.status)
                )
            }

            setOrders(filteredOrders.sort((a: any, b: any) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            ))
        } catch (err) {
            console.error(err)
            toast.error("Gagal mengambil data pesanan")
        } finally {
            setLoading(false)
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Perlu Dikemas': return 'bg-amber-50 text-amber-700 border-amber-100'
            case 'Diproses': return 'bg-blue-50 text-blue-700 border-blue-100'
            case 'Mencari Kurir': return 'bg-yellow-50 text-yellow-700 border-yellow-100 animate-pulse'
            case 'Kurir Menuju Lokasi':
            case 'Kurir di Toko':
            case 'Dikirim':
            case 'Kurir di Lokasi': return 'bg-indigo-50 text-indigo-700 border-indigo-100'
            case 'Kurir Tidak Tersedia': return 'bg-rose-50 text-rose-700 border-rose-100'
            case 'Selesai': return 'bg-emerald-50 text-emerald-700 border-emerald-100'
            case 'Dibatalkan': return 'bg-zinc-50 text-zinc-500 border-zinc-100'
            default: return 'bg-zinc-50 text-zinc-600 border-zinc-100'
        }
    }

    return (
        <div className="min-h-screen bg-zinc-50 max-w-md mx-auto font-sans pb-24">

            {/* FLOATING HEADER & TABS */}
            <header className="sticky top-0 z-40 bg-zinc-50/80 backdrop-blur-lg border-b border-zinc-100/80">
                <div className="flex items-center gap-3 px-4 h-14">
                    <button onClick={() => router.back()} className="p-2 -ml-2 text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors">
                        <Icons.ArrowLeft size={20} strokeWidth={2.5} />
                    </button>
                    <h1 className="text-lg font-bold text-zinc-900 tracking-tight">Pesanan</h1>
                </div>

                {/* MODERN PILL TABS */}
                <div className="px-4 pb-3 pt-1 flex gap-2 overflow-x-auto scrollbar-hide">
                    {tabs.map((tab) => {
                        const Icon = (Icons as any)[tab.icon]
                        const isActive = activeTab === tab.id
                        return (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap ${isActive
                                        ? 'bg-zinc-900 text-white shadow-sm'
                                        : 'bg-white text-zinc-500 border border-zinc-200 hover:border-zinc-300 hover:text-zinc-700'
                                    }`}
                            >
                                <Icon size={14} strokeWidth={isActive ? 2.5 : 2} />
                                <span>{tab.label}</span>
                            </button>
                        )
                    })}
                </div>
            </header>

            <div className="p-4 space-y-4">
                {loading ? (
                    // SKELETON LOADING
                    Array(2).fill(0).map((_, i) => (
                        <div key={i} className="bg-white rounded-2xl p-5 border border-zinc-100 animate-pulse space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="h-3 bg-zinc-100 rounded w-20"></div>
                                <div className="h-3 bg-zinc-100 rounded w-16"></div>
                            </div>
                            <div className="flex gap-3 items-center">
                                <div className="w-14 h-14 bg-zinc-100 rounded-xl"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-3 bg-zinc-100 rounded w-3/4"></div>
                                    <div className="h-3 bg-zinc-100 rounded w-1/2"></div>
                                </div>
                            </div>
                            <div className="h-10 bg-zinc-50 rounded-xl"></div>
                        </div>
                    ))
                ) : orders.length === 0 ? (
                    // EMPTY STATE
                    <div className="bg-white rounded-3xl p-12 border border-zinc-100 flex flex-col items-center justify-center text-center shadow-sm mt-8">
                        <div className="w-16 h-16 bg-zinc-50 flex items-center justify-center rounded-2xl mb-4 border border-zinc-100">
                            <Icons.Inbox size={28} className="text-zinc-300" />
                        </div>
                        <h3 className="text-sm font-bold text-zinc-800">Tidak Ada Pesanan</h3>
                        <p className="text-xs text-zinc-400 mt-1 max-w-[200px] leading-relaxed">
                            Pesanan untuk kategori {tabs.find(t => t.id === activeTab)?.label} akan muncul di sini.
                        </p>
                    </div>
                ) : (
                    // ORDER LIST
                    orders.map((order) => (
                        <div key={order.id} className="bg-white rounded-2xl border border-zinc-100 shadow-sm overflow-hidden transition-all">

                            {/* Card Header */}
                            <div className="px-4 py-3 border-b border-zinc-50 bg-zinc-50/40 flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-zinc-100">
                                        <Icons.Hash size={14} className="text-zinc-400" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">ID Pesanan</p>
                                        <p className="text-xs font-bold text-zinc-800">{order.id.slice(0, 8).toUpperCase()}</p>
                                    </div>
                                </div>
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${getStatusBadge(order.status)}`}>
                                    {order.status}
                                </span>
                            </div>

                            {/* Card Body */}
                            <div className="p-4 space-y-3">
                                {/* Items List */}
                                <div className="space-y-2">
                                    {order.items.map((item: any) => (
                                        <div key={item.id} className="flex gap-3 items-center">
                                            <div className="w-14 h-14 bg-zinc-50 rounded-xl overflow-hidden shrink-0 border border-zinc-50">
                                                <img src={item.image_url} className="w-full h-full object-cover" alt={item.product_name} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-semibold text-zinc-800 truncate">{item.product_name}</h4>
                                                <p className="text-xs text-zinc-400 font-medium flex items-center gap-1">
                                                    {item.quantity}x
                                                    <span className="text-zinc-300">•</span>
                                                    Rp {item.price?.toLocaleString('id-ID')}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Customer Info */}
                                <div className="bg-zinc-50 rounded-xl p-3 flex flex-col gap-2.5 border border-zinc-50">
                                    <div className="flex items-start gap-2.5">
                                        <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shrink-0 border border-zinc-100">
                                            <Icons.User size={12} className="text-zinc-400" />
                                        </div>
                                        <div className="min-w-0 pt-0.5">
                                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Pemesan</p>
                                            <p className="text-xs font-semibold text-zinc-800">{order.customer_name}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-2.5">
                                        <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center shrink-0 border border-zinc-100">
                                            <Icons.MapPin size={12} className="text-indigo-500" />
                                        </div>
                                        <div className="min-w-0 pt-0.5">
                                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wide">Alamat</p>
                                            <p className="text-xs font-medium text-zinc-600 line-clamp-2">{order.address}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Actions Footer */}
                            <div className="px-4 pb-4 flex gap-2">
                                {order.status === "Perlu Dikemas" && (
                                    <button
                                        onClick={async () => {
                                            const { error } = await supabase.from("orders").update({ status: "Mencari Kurir" }).eq("id", order.id)
                                            if (!error) {
                                                toast.success("Mencari Kurir...")
                                                await fetch("/api/dispatch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id }) })
                                                fetchShopAndOrders()
                                            }
                                        }}
                                        className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white py-3 rounded-xl font-bold text-xs transition-all active:scale-[0.98]"
                                    >
                                        Proses &amp; Cari Kurir
                                    </button>
                                )}
                                {order.status === "Diproses" && (
                                    <button
                                        onClick={async () => {
                                            const { error } = await supabase.from("orders").update({ status: "Mencari Kurir" }).eq("id", order.id)
                                            if (!error) {
                                                toast.success("Mencari Kurir...")
                                                await fetch("/api/dispatch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id }) })
                                                fetchShopAndOrders()
                                            }
                                        }}
                                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold text-xs transition-all active:scale-[0.98]"
                                    >
                                        Cari Kurir Sekarang
                                    </button>
                                )}
                                {["Mencari Kurir", "Kurir Tidak Tersedia"].includes(order.status) && (
                                    <button
                                        onClick={async () => {
                                            toast.success("Mencoba mencari kurir ulang...")
                                            await fetch("/api/dispatch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id }) })
                                            fetchShopAndOrders()
                                        }}
                                        className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold text-xs transition-all active:scale-[0.98]"
                                    >
                                        Cari Ulang Kurir
                                    </button>
                                )}
                                <button
                                    onClick={() => window.open(`https://wa.me/${order.whatsapp_number}`, '_blank')}
                                    className="px-4 bg-white border border-zinc-200 text-zinc-600 rounded-xl active:scale-95 transition-all flex items-center justify-center hover:bg-zinc-50"
                                >
                                    <Icons.MessageCircle size={18} className="text-emerald-600" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}