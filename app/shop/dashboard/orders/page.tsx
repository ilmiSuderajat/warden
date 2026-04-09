"use client"

import { useState, useEffect, Suspense } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"

function OrdersContent() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const tabFromUrl = searchParams.get("tab") || "perlu_dikirim"
    const subTabFromUrl = searchParams.get("subTab") || "semua"
    
    const [activeTab, setActiveTab] = useState(tabFromUrl)
    const [activeSubTab, setActiveSubTab] = useState(subTabFromUrl)
    
    const [orders, setOrders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [shop, setShop] = useState<any>(null)

    const tabs = [
        { id: "belum_bayar", label: "Belum Bayar" },
        { id: "perlu_dikirim", label: "Perlu Dikirim" },
        { id: "dikirim", label: "Dikirim" },
        { id: "selesai", label: "Selesai" },
        { id: "pembatalan", label: "Pembatalan" },
        { id: "pengembalian", label: "Pengembalian" }
    ]

    const subTabsPerluDikirim = [
        { id: "semua", label: "Semua" },
        { id: "perlu_diproses", label: "Perlu diproses" },
        { id: "telah_diproses", label: "Telah diproses" },
        { id: "tertunda", label: "Tertunda" }
    ]

    useEffect(() => {
        const t = searchParams.get("tab") || "perlu_dikirim"
        if (t !== activeTab) setActiveTab(t)
        const st = searchParams.get("subTab") || "semua"
        if (st !== activeSubTab) setActiveSubTab(st)
    }, [searchParams])

    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId)
        if (tabId !== "perlu_dikirim") {
            setActiveSubTab("semua") // reset subtab
        }
        const params = new URLSearchParams(searchParams.toString())
        params.set("tab", tabId)
        if (tabId !== "perlu_dikirim") params.delete("subTab")
        router.replace(`/shop/dashboard/orders?${params.toString()}`, { scroll: false })
    }

    const handleSubTabChange = (subTabId: string) => {
        setActiveSubTab(subTabId)
        const params = new URLSearchParams(searchParams.toString())
        params.set("subTab", subTabId)
        router.replace(`/shop/dashboard/orders?${params.toString()}`, { scroll: false })
    }

    useEffect(() => {
        fetchShopAndOrders()
    }, [activeTab, activeSubTab])

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
            // Fetch the shop's products
            const { data: shopProducts } = await supabase
                .from("products")
                .select("id")
                .eq("shop_id", shopData.id)

            const shopProductIds = new Set(shopProducts?.map(p => p.id) || [])

            const { data: allOrders, error: orderError } = await supabase
                .from("orders")
                .select("*, order_items(*)")

            if (orderError) throw orderError

            let filteredOrders = allOrders?.filter(order =>
                order.order_items?.some((item: any) =>
                    shopProductIds.has(item.product_id)
                )
            ) || []

            // Extract only the items that belong to this shop
            filteredOrders = filteredOrders.map(order => ({
                ...order,
                items: order.order_items?.filter((item: any) => shopProductIds.has(item.product_id)) || []
            }))

            // Filtering based on tab logic
            if (activeTab === "belum_bayar") {
                filteredOrders = filteredOrders.filter((o: any) => o.payment_status !== "paid")
            } else if (activeTab === "perlu_dikirim") {
                // Must be paid & not cancelled/completed
                filteredOrders = filteredOrders.filter((o: any) => 
                    o.payment_status === "paid" && ["Perlu Dikemas", "Menunggu Konfirmasi", "Diproses", "Mencari Kurir", "Kurir Menuju Lokasi", "Kurir di Toko", "Kurir Tidak Tersedia"].includes(o.status)
                )
                
                if (activeSubTab === "perlu_diproses") {
                    filteredOrders = filteredOrders.filter((o: any) => ["Perlu Dikemas", "Menunggu Konfirmasi"].includes(o.status))
                } else if (activeSubTab === "telah_diproses") {
                    filteredOrders = filteredOrders.filter((o: any) => ["Diproses", "Mencari Kurir", "Kurir Menuju Lokasi", "Kurir di Toko"].includes(o.status))
                } else if (activeSubTab === "tertunda") {
                    filteredOrders = filteredOrders.filter((o: any) => ["Kurir Tidak Tersedia"].includes(o.status))
                }
                
            } else if (activeTab === "dikirim") {
                filteredOrders = filteredOrders.filter((o: any) => ["Dikirim", "Kurir di Lokasi"].includes(o.status))
            } else if (activeTab === "selesai") {
                filteredOrders = filteredOrders.filter((o: any) => o.status === "Selesai")
            } else if (activeTab === "pembatalan") {
                filteredOrders = filteredOrders.filter((o: any) => o.status === "Dibatalkan")
            } else if (activeTab === "pengembalian") {
                filteredOrders = filteredOrders.filter((o: any) => o.status === "Dikembalikan")
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

    const EmptyState = () => (
        <div className="flex flex-col items-center justify-center pt-24 pb-12 px-6">
            <div className="relative w-40 h-40 mb-4 opacity-50 flex items-center justify-center">
                {/* Simulated Shopee 'S' Box Empty State but neutral/indigo */}
                <div className="w-16 h-16 bg-white border-2 border-slate-300 rounded-lg flex items-center justify-center shadow-sm relative z-10">
                    <span className="text-3xl font-bold text-slate-300">W</span>
                </div>
                <div className="absolute top-10 left-8 w-4 h-1 border-t-2 border-slate-300 -rotate-45"></div>
                <div className="absolute top-14 right-8 w-2 h-2 rounded-full border-2 border-slate-300"></div>
                <div className="absolute bottom-8 right-12 w-3 h-3 border-2 border-slate-300 rotate-12"></div>
                <div className="absolute bottom-12 left-10 w-2 h-2 rounded-full border-2 border-slate-300"></div>
            </div>
            <p className="text-sm text-slate-500">Belum ada pesanan</p>
        </div>
    )

    return (
        <div className="min-h-screen bg-slate-50 max-w-md mx-auto font-sans pb-24">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
                <div className="flex items-center justify-between px-4 h-14">
                    <div className="flex items-center gap-3">
                        <Link href="/shop/dashboard" className="p-1 -ml-1 text-slate-600">
                            <Icons.ArrowLeft size={24} />
                        </Link>
                        <h1 className="text-lg font-medium text-slate-800">Penjualan Saya</h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <button className="text-slate-600"><Icons.Search size={22} /></button>
                        <div className="relative">
                            <button className="text-slate-600"><Icons.MessageCircle size={22} /></button>
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                                3
                            </span>
                        </div>
                    </div>
                </div>

                {/* MAIN TABS */}
                <div className="flex overflow-x-auto scrollbar-hide border-b border-slate-100">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => handleTabChange(tab.id)}
                            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                                activeTab === tab.id 
                                    ? 'border-indigo-500 text-indigo-600' 
                                    : 'border-transparent text-slate-500'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* SUB TABS (Only for Perlu Dikirim) */}
                {activeTab === "perlu_dikirim" && (
                    <div className="flex border-b border-slate-100 bg-slate-50/50">
                        {subTabsPerluDikirim.map(subTab => (
                            <button
                                key={subTab.id}
                                onClick={() => handleSubTabChange(subTab.id)}
                                className={`flex-1 py-3 text-[13px] text-center capitalize transition-colors ${
                                    activeSubTab === subTab.id 
                                        ? 'text-indigo-600 font-medium' 
                                        : 'text-slate-500'
                                }`}
                            >
                                {subTab.label}
                            </button>
                        ))}
                    </div>
                )}
                
                {/* FILTER DROPDOWNS */}
                <div className="flex p-2 gap-2 bg-slate-50/50">
                    <button className="flex-1 flex justify-between items-center bg-white border border-indigo-200/60 rounded px-2 py-1.5 shadow-sm">
                        <div className="flex flex-col items-start px-1">
                            <span className="text-[10px] text-indigo-400 font-medium">Urutkan</span>
                            <span className="text-xs text-indigo-500">Tanggal Pesanan Siap Di...</span>
                        </div>
                        <Icons.ChevronDown size={14} className="text-indigo-500 mr-1" />
                    </button>
                    <button className="flex-1 flex justify-between items-center bg-white border border-indigo-200/60 rounded px-2 py-1.5 shadow-sm">
                        <div className="flex flex-col items-start px-1">
                            <span className="text-[10px] text-indigo-400 font-medium">Jasa Kirim</span>
                            <span className="text-xs text-indigo-500">Semua</span>
                        </div>
                        <Icons.ChevronDown size={14} className="text-indigo-500 mr-1" />
                    </button>
                </div>
            </div>

            <div className="pt-2">
                {loading ? (
                    <div className="flex justify-center pt-12"><Icons.Loader2 className="animate-spin text-slate-300" size={28} /></div>
                ) : orders.length === 0 ? (
                    <EmptyState />
                ) : (
                    <div className="space-y-2">
                        {orders.map((order) => (
                            <div key={order.id} className="bg-white border-y border-slate-100">
                                {/* Order Header */}
                                <div className="px-3 py-2.5 flex justify-between items-center border-b border-slate-50">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center">
                                            <Icons.User size={12} className="text-slate-500" />
                                        </div>
                                        <span className="text-xs font-semibold text-slate-800">{order.customer_name}</span>
                                    </div>
                                    <span className="text-xs text-indigo-600 font-medium">
                                        {order.status}
                                    </span>
                                </div>

                                {/* Order Items */}
                                <div className="p-3 bg-slate-50/50 space-y-3">
                                    {order.items.map((item: any) => (
                                        <div key={item.id} className="flex gap-3">
                                            <div className="w-16 h-16 border border-slate-100 bg-white rounded flex-shrink-0 overflow-hidden">
                                                <img src={item.image_url} alt="" className="w-full h-full object-cover" />
                                            </div>
                                            <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                                                <div>
                                                    <p className="text-[13px] text-slate-800 line-clamp-2 leading-snug">{item.product_name}</p>
                                                    <p className="text-[11px] text-slate-500 mt-1">Variasi: -</p>
                                                </div>
                                                <div className="flex justify-between items-end">
                                                    <p className="text-xs text-slate-800 font-medium">Rp{item.price?.toLocaleString('id-ID')}</p>
                                                    <p className="text-[11px] text-slate-500">x{item.quantity}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                {/* Order Footer & Actions */}
                                <div className="px-3 py-3 border-t border-slate-50">
                                    <div className="flex justify-between flex-wrap items-center mb-3">
                                        <div className="text-[11px] text-slate-500">
                                            {order.items.length} produk
                                        </div>
                                        <div>
                                            <span className="text-xs text-slate-600 mr-1">Total Pesanan:</span>
                                            <span className="text-sm font-semibold text-slate-800">Rp{(order.items.reduce((s:number, i:any) => s + (i.price * i.quantity), 0)).toLocaleString('id-ID')}</span>
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-2 justify-end">
                                        {activeTab === "perlu_dikirim" && (
                                            <>
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
                                                        className="px-6 py-2 bg-indigo-500 text-white rounded text-xs font-semibold focus:outline-none"
                                                    >
                                                        Atur Pengiriman
                                                    </button>
                                                )}
                                                {["Mencari Kurir", "Kurir Menuju Lokasi", "Kurir di Toko", "Diproses"].includes(order.status) && (
                                                    <button className="px-6 py-2 bg-slate-100 text-slate-400 rounded text-xs font-semibold focus:outline-none cursor-not-allowed" disabled>
                                                        Menunggu Penjemputan
                                                    </button>
                                                )}
                                                {order.status === "Kurir Tidak Tersedia" && (
                                                    <button
                                                        onClick={async () => {
                                                            const { error } = await supabase.from("orders").update({ status: "Mencari Kurir" }).eq("id", order.id)
                                                            if (!error) {
                                                                await fetch("/api/dispatch", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: order.id }) })
                                                                fetchShopAndOrders()
                                                            }
                                                        }}
                                                        className="px-6 py-2 bg-indigo-500 text-white rounded text-xs font-semibold focus:outline-none"
                                                    >
                                                        Coba Lagi
                                                    </button>
                                                )}
                                            </>
                                        )}
                                        {/* Contact customer generic fallback */}
                                        <button
                                            onClick={() => window.open(`https://wa.me/${order.whatsapp_number}`, '_blank')}
                                            className="px-4 py-2 border border-slate-300 text-slate-600 rounded text-xs font-semibold focus:outline-none flex items-center gap-1 hover:bg-slate-50"
                                        >
                                            <Icons.MessageCircle size={14} /> Hubungi Pembeli
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default function ShopOrdersPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-slate-50 max-w-md mx-auto flex items-center justify-center">
                <Icons.Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
            </div>
        }>
            <OrdersContent />
        </Suspense>
    )
}