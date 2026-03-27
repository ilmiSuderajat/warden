"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Skeleton from "@/app/components/Skeleton"

export default function ShopOrdersPage() {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState("baru")
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [shop, setShop] = useState<any>(null)

    const tabs = [
        { id: "baru", label: "Baru", icon: "Clock" },
        { id: "proses", label: "Diproses", icon: "ChefHat" },
        { id: "dikirim", label: "Dikirim", icon: "Truck" },
        { id: "selesai", label: "Selesai", icon: "CheckCircle2" },
    ]

    useEffect(() => {
        fetchShopAndOrders()
    }, [activeTab])

    const fetchShopAndOrders = async () => {
        setLoading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return router.push("/login")

        // Get shop
        const { data: shopData } = await supabase
            .from("shops")
            .select("*")
            .eq("owner_id", user.id)
            .maybeSingle()

        if (!shopData) return router.replace("/shop/create")
        setShop(shopData)

        try {
            // Fetch all orders with their items
            const { data: allOrders, error: orderError } = await supabase
                .from("orders")
                .select("*, order_items(*)")
            
            if (orderError) throw orderError

            // Step 2: Filter orders that contain items from this shop using the embedded | SHOP_ID
            let filteredOrders = allOrders?.filter(order => 
                order.order_items?.some((item: any) => 
                    item.product_name?.includes(`| ${shopData.id}`)
                )
            ) || []

            // Cleanup and Filter items for display (only those belonging to THIS shop)
            filteredOrders = filteredOrders.map(order => ({
                ...order,
                items: order.order_items
                    ?.filter((item: any) => item.product_name?.includes(`| ${shopData.id}`))
                    .map((item: any) => ({
                        ...item,
                        product_name: item.product_name?.split(" | ")[0]
                    })) || []
            }))
            if (activeTab === "baru") filteredOrders = filteredOrders.filter((o: any) => o.status === "Perlu Dikemas" || o.status === "Menunggu Konfirmasi")
            if (activeTab === "proses") filteredOrders = filteredOrders.filter((o: any) => o.status === "Diproses")
            if (activeTab === "dikirim") filteredOrders = filteredOrders.filter((o: any) => o.status === "Dikirim")
            if (activeTab === "selesai") filteredOrders = filteredOrders.filter((o: any) => o.status === "Selesai")

            setOrders(filteredOrders.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
        } catch (err) {
            console.error(err)
            toast.error("Gagal mengambil data pesanan")
        } finally {
            setLoading(false)
        }
    }

    const updateStatus = async (orderId: string, newStatus: string) => {
        const { error } = await supabase
            .from("orders")
            .update({ status: newStatus })
            .eq("id", orderId)

        if (error) {
            toast.error("Gagal mengupdate status")
        } else {
            toast.success(`Pesanan ${newStatus}`)
            fetchShopAndOrders()
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Perlu Dikemas': return 'bg-orange-50 text-orange-600 border-orange-100'
            case 'Diproses': return 'bg-blue-50 text-blue-600 border-blue-100'
            case 'Dikirim': return 'bg-indigo-50 text-indigo-600 border-indigo-100'
            case 'Selesai': return 'bg-emerald-50 text-emerald-600 border-emerald-100'
            default: return 'bg-slate-50 text-slate-600 border-slate-100'
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 max-w-md mx-auto font-sans pb-24">
            {/* HEADER */}
            <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
                <div className="flex items-center gap-3 px-4 h-14">
                    <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                        <Icons.ArrowLeft size={20} strokeWidth={2.5} />
                    </button>
                    <h1 className="text-lg font-bold text-slate-900 tracking-tight">Kelola Pesanan</h1>
                </div>

                {/* TABS */}
                <div className="flex px-4 pb-2 gap-2">
                    {tabs.map((tab) => {
                        const Icon = (Icons as any)[tab.icon]
                        const isActive = activeTab === tab.id
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex-1 flex flex-col items-center py-2.5 rounded-2xl transition-all border ${isActive 
                                    ? 'bg-[#ee4d2d] text-white border-[#ee4d2d] shadow-lg shadow-[#ee4d2d]/10' 
                                    : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-white hover:border-slate-200'
                                }`}
                            >
                                <Icon size={18} className="mb-1" />
                                <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
                            </button>
                        )
                    })}
                </div>
            </header>

            <div className="p-4 space-y-4">
                {loading ? (
                    Array(3).fill(0).map((_, i) => (
                        <div key={i} className="bg-white rounded-3xl p-5 border border-slate-100 animate-pulse space-y-4">
                            <div className="flex justify-between items-center pb-3 border-b border-slate-50">
                                <div className="h-4 bg-slate-100 rounded w-24"></div>
                                <div className="h-4 bg-slate-100 rounded w-16"></div>
                            </div>
                            <div className="flex gap-4">
                                <div className="w-16 h-16 bg-slate-100 rounded-2xl"></div>
                                <div className="flex-1 space-y-2">
                                    <div className="h-4 bg-slate-100 rounded w-3/4"></div>
                                    <div className="h-3 bg-slate-100 rounded w-1/4"></div>
                                </div>
                            </div>
                        </div>
                    ))
                ) : orders.length === 0 ? (
                    <div className="bg-white rounded-[40px] p-12 border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm">
                        <div className="w-20 h-20 bg-slate-50 flex items-center justify-center rounded-3xl mb-6">
                            <Icons.Inbox size={36} className="text-slate-200" />
                        </div>
                        <h3 className="text-base font-black text-slate-800 tracking-tight">Belum Ada Pesanan</h3>
                        <p className="text-xs text-slate-400 mt-2 max-w-[200px] leading-relaxed">Pesanan pelanggan di kategori ini akan muncul di sini secara otomatis.</p>
                    </div>
                ) : (
                    orders.map((order) => (
                        <div key={order.id} className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden transition-all">
                            {/* Card Header */}
                            <div className="px-5 py-4 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">ID PESANAN</p>
                                    <p className="text-xs font-black text-slate-800">#{order.id.slice(0, 8).toUpperCase()}</p>
                                </div>
                                <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${getStatusBadge(order.status)}`}>
                                    {order.status}
                                </span>
                            </div>

                            {/* Card Body */}
                            <div className="p-5 space-y-4">
                                {order.items.map((item: any) => (
                                    <div key={item.id} className="flex gap-4 items-center">
                                        <div className="w-14 h-14 bg-slate-50 rounded-2xl overflow-hidden shrink-0 border border-slate-100">
                                            <img src={item.image_url} className="w-full h-full object-cover" alt={item.product_name} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-bold text-slate-800 truncate">{item.product_name}</h4>
                                            <p className="text-xs text-slate-400 font-medium">x{item.quantity} • Rp {item.price?.toLocaleString('id-ID')}</p>
                                        </div>
                                    </div>
                                ))}

                                {/* Customer Info */}
                                <div className="bg-slate-50 rounded-2xl p-4 flex flex-col gap-2.5">
                                    <div className="flex items-start gap-3">
                                        <Icons.User size={14} className="text-slate-400 shrink-0 mt-0.5" />
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">Pemesan</p>
                                            <p className="text-xs font-bold text-slate-800">{order.customer_name}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <Icons.MapPin size={14} className="text-[#ee4d2d] shrink-0 mt-0.5" />
                                        <div className="min-w-0">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">Alamat Antar</p>
                                            <p className="text-xs font-medium text-slate-600 line-clamp-2">{order.address}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Card Footer Actions */}
                            <div className="px-5 pb-5 pt-0 flex gap-2">
                                {order.status === "Perlu Dikemas" && (
                                    <button 
                                        onClick={() => updateStatus(order.id, "Diproses")}
                                        className="flex-1 bg-[#ee4d2d] hover:bg-[#d73211] text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-[#ee4d2d]/20 active:scale-[0.98]"
                                    >
                                        Mulai Masak
                                    </button>
                                )}
                                {order.status === "Diproses" && (
                                    <button 
                                        onClick={() => updateStatus(order.id, "Dikirim")}
                                        className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]"
                                    >
                                        Siap Diantar
                                    </button>
                                )}
                                {order.status === "Dikirim" && (
                                    <button 
                                        onClick={() => updateStatus(order.id, "Selesai")}
                                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
                                    >
                                        Selesaikan
                                    </button>
                                )}
                                <button 
                                    onClick={() => window.open(`https://wa.me/${order.whatsapp_number}`, '_blank')}
                                    className="px-4 bg-white border border-slate-200 text-slate-600 rounded-2xl active:scale-95 transition-all flex items-center justify-center"
                                >
                                    <Icons.MessageCircle size={18} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
