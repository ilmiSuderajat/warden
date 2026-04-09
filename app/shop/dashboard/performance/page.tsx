"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function ShopPerformancePage() {
    const router = useRouter()
    const [shop, setShop] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    
    // UI states
    const [activeTab, setActiveTab] = useState<"penjualan" | "produk">("penjualan")
    const [periode, setPeriode] = useState("Real-time")

    // Data states
    const [salesAmount, setSalesAmount] = useState(0)
    const [orderCount, setOrderCount] = useState(0)
    const [uniqueBuyers, setUniqueBuyers] = useState(0)

    useEffect(() => {
        const fetchShopAndStats = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push("/login")
                return
            }

            const { data: shopData } = await supabase
                .from("shops")
                .select("*")
                .eq("owner_id", user.id)
                .maybeSingle()

            if (!shopData) {
                router.replace("/shop/create")
                return
            }
            setShop(shopData)

            try {
                const { data: allOrders } = await supabase
                    .from("orders")
                    .select("*, order_items(*)")

                if (!allOrders) return

                const shopOrders = allOrders.filter(order =>
                    order.order_items?.some((item: any) =>
                        item.product_name?.includes(`| ${shopData.id}`)
                    )
                )

                // Mock logic for "Real-time" (let's say all successful/paid orders for today ideally, but here just all successful as a generic metric for demo if empty, else real)
                const validOrders = shopOrders.filter((o: any) => o.payment_status === "paid" && o.status !== "Dibatalkan" && o.status !== "Dikembalikan")
                
                let totalSales = 0
                let totalOrders = validOrders.length
                const buyers = new Set()

                validOrders.forEach((o: any) => {
                    const shopItems = o.order_items?.filter((item: any) =>
                        item.product_name?.includes(`| ${shopData.id}`)
                    ) || []
                    
                    totalSales += shopItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)
                    buyers.add(o.customer_name)
                })

                setSalesAmount(totalSales)
                setOrderCount(totalOrders)
                setUniqueBuyers(buyers.size)

            } catch (err) {
                console.error("Error fetching performance stats:", err)
            } finally {
                setLoading(false)
            }
        }

        fetchShopAndStats()
    }, [router])

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Icons.Loader2 className="animate-spin text-slate-300" size={28} />
            </div>
        )
    }

    if (!shop) return null

    // Mock metrics that we can derived from the real order stats
    const salesPerOrder = orderCount > 0 ? (salesAmount / orderCount) : 0
    const salesPerBuyer = uniqueBuyers > 0 ? (salesAmount / uniqueBuyers) : 0
    const conversionRate = orderCount > 0 ? "2.5%" : "0%" // strictly simulated
    
    // Mock Product stats
    const visitors = orderCount * 15 || 0 // mock logic
    const addToCart = orderCount * 3 || 0
    const cartRate = visitors > 0 ? ((addToCart/visitors)*100).toFixed(1) + "%" : "0%"

    return (
        <div className="min-h-screen bg-slate-50 max-w-md mx-auto font-sans pb-24">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
                <div className="flex items-center justify-between px-4 h-14">
                    <div className="flex items-center gap-3">
                        <Link href="/shop/dashboard" className="p-1 -ml-1 text-slate-600">
                            <Icons.ArrowLeft size={24} />
                        </Link>
                        <h1 className="text-lg font-medium text-slate-800">Performa Toko</h1>
                    </div>
                </div>

                {/* TABS */}
                <div className="flex border-b border-slate-100">
                    <button
                        onClick={() => setActiveTab("penjualan")}
                        className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
                            activeTab === "penjualan" 
                                ? "border-indigo-500 text-indigo-600" 
                                : "border-transparent text-slate-500"
                        }`}
                    >
                        Penjualan
                    </button>
                    <button
                        onClick={() => setActiveTab("produk")}
                        className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
                            activeTab === "produk" 
                                ? "border-indigo-500 text-indigo-600" 
                                : "border-transparent text-slate-500"
                        }`}
                    >
                        Produk
                    </button>
                </div>
            </div>

            {/* FILTERS */}
            <div className="bg-white py-3 px-4 border-b border-slate-100 mb-3 shadow-sm">
                <div className="flex justify-between items-center mb-3 text-xs">
                    <div className="flex items-center gap-1 text-slate-600">
                        <span className="font-semibold">Periode</span>
                        <span className="text-slate-400 font-normal">13:05 (GMT+7)</span>
                    </div>
                    <button className="flex items-center gap-1 text-slate-500">
                        Pesanan Siap Dikirim <Icons.ChevronDown size={14} />
                    </button>
                </div>
                
                <div className="flex gap-2 overflow-x-auto scrollbar-hide">
                    {["Real-time", "Kemarin", "7 hari sebelumnya.", "30 hari sebelumnya"].map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriode(p)}
                            className={`px-3 py-1.5 rounded text-xs border whitespace-nowrap transition-colors ${
                                periode === p 
                                    ? "border-indigo-500 text-indigo-600 bg-white" 
                                    : "border-slate-100 text-slate-600 bg-slate-50"
                            }`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="px-3">
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4">
                    <h2 className="text-sm font-semibold text-slate-800 mb-4 px-1">Kriteria Utama</h2>
                    
                    {activeTab === "penjualan" ? (
                        <>
                            {/* Grid Penjualan */}
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                                <div className="border border-indigo-500 rounded-lg p-3 bg-white relative">
                                    <p className="text-xs text-slate-500 mb-2">Penjualan</p>
                                    <p className="text-lg font-semibold text-slate-800">Rp{salesAmount.toLocaleString('id-ID')}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">-</p>
                                    <Icons.HelpCircle size={12} className="absolute bottom-3 right-3 text-slate-400" />
                                </div>
                                <div className="bg-slate-50 rounded-lg p-3 relative">
                                    <p className="text-xs text-slate-500 mb-2">Pesanan</p>
                                    <p className="text-lg font-semibold text-slate-800">{orderCount}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">-</p>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-3 relative">
                                    <p className="text-xs text-slate-500 mb-2 leading-tight">Penjualan per Pesanan</p>
                                    <p className="text-lg font-semibold text-slate-800 mt-1">Rp{salesPerOrder.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">-</p>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-3 relative">
                                    <p className="text-xs text-slate-500 mb-2">Pembeli</p>
                                    <p className="text-lg font-semibold text-slate-800">{uniqueBuyers}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">-</p>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-3 relative">
                                    <p className="text-xs text-slate-500 mb-2 leading-tight">Penjualan per Pembeli</p>
                                    <p className="text-lg font-semibold text-slate-800 mt-1">Rp{salesPerBuyer.toLocaleString('id-ID', { maximumFractionDigits: 0 })}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">-</p>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-3 relative">
                                    <p className="text-xs text-slate-500 mb-2 leading-tight">Tingkat Konversi Pesanan</p>
                                    <p className="text-lg font-semibold text-slate-800 mt-1">{conversionRate}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">-</p>
                                </div>
                            </div>
                            
                            {/* Graphic Mock */}
                            <div className="h-48 relative border-b border-slate-100 flex items-end mb-4 px-2">
                                {/* Lines */}
                                {[5,4,3,2,1].map(n => (
                                    <div key={n} className="absolute left-0 right-0 border-b border-dashed border-slate-100" style={{bottom: `${n*20}%`}}>
                                        <span className="absolute -left-2 -top-2 text-[10px] text-slate-400">{n}</span>
                                    </div>
                                ))}
                                <div className="absolute left-0 right-0 bottom-0 border-b border-slate-200"><span className="absolute -left-2 -top-2 text-[10px] text-slate-400">0</span></div>
                                
                                {/* Fake Line Chart / Curve */}
                                <div className="absolute bottom-0 left-6 right-2 h-0.5 bg-indigo-500 pointer-events-none" style={{
                                    height: orderCount > 0 ? '10%' : '1px' // Mock tiny flatline or slight lift
                                }}></div>
                                <div className="absolute bottom-0 left-[60%] w-2 h-2 rounded-full bg-indigo-500 border-2 border-white shadow-sm transform -translate-y-1/2"></div>
                                
                                <div className="w-full flex justify-between absolute -bottom-6 left-6 right-2 text-[10px] text-slate-500">
                                    <span>00:00</span>
                                    <span>04:00</span>
                                    <span>08:00</span>
                                    <span>12:00</span>
                                    <span>16:00</span>
                                    <span>20:00</span>
                                    <span>23:59</span>
                                </div>
                            </div>
                            
                            {/* Sumber Kunjungan Mock */}
                            <div className="mt-12">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-[13px] font-semibold text-slate-800">Sumber Kunjungan</h3>
                                    <button className="text-[11px] text-slate-500 flex items-center gap-1">
                                        Urutkan <span className="font-medium text-slate-600">Penjualan</span> <Icons.ChevronDown size={12} />
                                    </button>
                                </div>
                                
                                <div className="flex gap-4 border-b border-slate-100 mb-4 px-1 text-[13px]">
                                    <button className="pb-2 border-b-2 border-indigo-500 text-indigo-600 font-medium">Halaman Produk</button>
                                    <button className="pb-2 border-b-2 border-transparent text-slate-500">Live Penjual</button>
                                    <button className="pb-2 border-b-2 border-transparent text-slate-500">Video Penjual</button>
                                </div>
                                
                                <div className="flex justify-between items-center py-2 px-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs text-slate-700">Halaman Produk Penjualan</span>
                                        <Icons.HelpCircle size={12} className="text-slate-400" />
                                    </div>
                                    <span className="text-xs font-semibold text-slate-800">Rp{salesAmount.toLocaleString('id-ID')}</span>
                                </div>
                                <div className="bg-slate-50 rounded text-[11px] text-slate-500 p-3 mt-2">
                                    Asal Penjualan...
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            {/* Grid Produk */}
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                                <div className="border border-indigo-500 rounded-lg p-3 bg-white relative">
                                    <p className="text-xs text-slate-500 mb-2">Pengunjung</p>
                                    <p className="text-lg font-semibold text-slate-800">{visitors}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">-</p>
                                    <Icons.HelpCircle size={12} className="absolute bottom-3 right-3 text-slate-400" />
                                </div>
                                <div className="bg-slate-50 rounded-lg p-3 relative">
                                    <p className="text-xs text-slate-500 mb-2 leading-tight">Pengunjung Menambahkan Produk</p>
                                    <p className="text-lg font-semibold text-slate-800 mt-1">{addToCart}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">-</p>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-3 relative">
                                    <p className="text-xs text-slate-500 mb-2 leading-tight">Tingkat Produk di Keranjang</p>
                                    <p className="text-lg font-semibold text-slate-800 mt-1">{cartRate}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">-</p>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-3 relative">
                                    <p className="text-xs text-slate-500 mb-2 leading-tight">Pembeli Konfirmasi Pesanan</p>
                                    <p className="text-lg font-semibold text-slate-800 mt-1">{uniqueBuyers}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">-</p>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-3 relative">
                                    <p className="text-xs text-slate-500 mb-2 leading-tight">Produk dalam Pesanan Siap Dikirim</p>
                                    <p className="text-lg font-semibold text-slate-800 mt-1">{orderCount}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">-</p>
                                </div>
                                <div className="bg-slate-50 rounded-lg p-3 relative">
                                    <p className="text-xs text-slate-500 mb-2 leading-tight">Konversi Pesanan Siap Dikirim</p>
                                    <p className="text-lg font-semibold text-slate-800 mt-1">{conversionRate}</p>
                                    <p className="text-[10px] text-slate-400 mt-1">-</p>
                                </div>
                            </div>
                            
                            {/* Graphic Mock */}
                            <div className="h-48 relative border-b border-slate-100 flex items-end mb-4 px-2">
                                {[5,4,3,2,1].map(n => (
                                    <div key={n} className="absolute left-0 right-0 border-b border-dashed border-slate-100" style={{bottom: `${n*20}%`}}>
                                        <span className="absolute -left-2 -top-2 text-[10px] text-slate-400">{n}</span>
                                    </div>
                                ))}
                                <div className="absolute left-0 right-0 bottom-0 border-b border-slate-200"><span className="absolute -left-2 -top-2 text-[10px] text-slate-400">0</span></div>
                                <div className="absolute bottom-0 left-[60%] w-2 h-2 rounded-full bg-indigo-500 border-2 border-white shadow-sm transform -translate-y-1/2"></div>
                                <div className="w-full flex justify-between absolute -bottom-6 left-6 right-2 text-[10px] text-slate-500">
                                    <span>00:00</span>
                                    <span>04:00</span>
                                    <span>08:00</span>
                                    <span>12:00</span>
                                    <span>16:00</span>
                                    <span>20:00</span>
                                    <span>23:59</span>
                                </div>
                            </div>
                            
                            <div className="mt-12">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-[13px] font-semibold text-slate-800">Produk</h3>
                                    <button className="text-[11px] text-slate-500 flex items-center gap-1">
                                        <Icons.Filter size={12} /> Kategori
                                    </button>
                                </div>
                                <div className="flex gap-4 border-b border-slate-100 text-[13px]">
                                    <button className="pb-2 border-b-2 border-indigo-500 text-indigo-600 font-medium whitespace-nowrap">Performa Terbaik</button>
                                    <button className="pb-2 border-b-2 border-transparent text-slate-500 whitespace-nowrap">Baru Ditambahkan</button>
                                    <button className="pb-2 border-b-2 border-transparent text-slate-500 whitespace-nowrap">Strategi Iklan</button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

        </div>
    )
}
