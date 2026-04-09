"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function ShopDashboardPage() {
    const router = useRouter()
    const [shop, setShop] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    
    // Stats states
    const [perluDikirimCount, setPerluDikirimCount] = useState(0)
    const [pembatalanCount, setPembatalanCount] = useState(0)
    const [pengembalianCount, setPengembalianCount] = useState(0)
    const [penilaianCount, setPenilaianCount] = useState(0) // Mock for now

    const [codEnabled, setCodEnabled] = useState(true)

    useEffect(() => {
        const fetchShop = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push("/login")
                return
            }

            const { data, error } = await supabase
                .from("shops")
                .select("*")
                .eq("owner_id", user.id)
                .maybeSingle()

            if (error) {
                console.error(error)
            }

            if (!data) {
                router.replace("/shop/create")
                return
            }

            setShop(data)
            setCodEnabled(data.cod_enabled !== false)
            await fetchOrderStats(data.id)
            setLoading(false)
        }

        const fetchOrderStats = async (shopId: string) => {
            try {
                // First get all product IDs that belong to this shop
                const { data: shopProducts } = await supabase
                    .from("products")
                    .select("id")
                    .eq("shop_id", shopId)

                if (!shopProducts) return

                const shopProductIds = new Set(shopProducts.map(p => p.id))

                const { data: allOrders } = await supabase
                    .from("orders")
                    .select("*, order_items(*)")

                if (!allOrders) return

                const shopOrders = allOrders.filter(order =>
                    order.order_items?.some((item: any) =>
                        shopProductIds.has(item.product_id)
                    )
                )

                // Perlu Dikirim: Perlu Dikemas + Menunggu Konfirmasi + Diproses
                const perluDikirim = shopOrders.filter((o: any) =>
                    ["Perlu Dikemas", "Menunggu Konfirmasi", "Diproses"].includes(o.status)
                )
                setPerluDikirimCount(perluDikirim.length)

                // Pembatalan: Dibatalkan
                const pembatalan = shopOrders.filter((o: any) => o.status === "Dibatalkan")
                setPembatalanCount(pembatalan.length)
                
                // Pengembalian: Dikembalikan (Mock to 0 if not exist)
                const pengembalian = shopOrders.filter((o: any) => o.status === "Dikembalikan")
                setPengembalianCount(pengembalian.length)

            } catch (err) {
                console.error("Error fetching order stats:", err)
            }
        }

        fetchShop()
    }, [router])

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
                <Icons.Loader2 className="animate-spin text-zinc-300" size={28} />
            </div>
        )
    }

    if (!shop) return null

    const actionButtons = [
        { id: "produk", label: "Produk", icon: "Box", color: "text-orange-500", href: "/shop/dashboard/menu" },
        { id: "pesanan", label: "Pesanan", icon: "ReceiptText", color: "text-blue-500", href: "/shop/dashboard/orders", badge: perluDikirimCount },
        { id: "keuangan", label: "Keuangan", icon: "Wallet", color: "text-indigo-500", href: "/shop/dashboard/wallet" },
        { id: "performa", label: "Performa Toko", icon: "BarChart3", color: "text-red-500", href: "/shop/dashboard/performance" },
        { id: "iklan", label: "Iklan Shop", icon: "Megaphone", color: "text-amber-500", href: "#" },
    ]

    return (
        <div className="min-h-screen bg-[#F5F5F5] max-w-md mx-auto font-sans pb-24">

            {/* HEADER - Indigo Shopee Style */}
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 text-white pt-10 pb-8 relative overflow-hidden">
                {/* Simulated Batik/Pattern Overlays */}
                <div className="absolute top-0 inset-x-0 h-full opacity-10 pointer-events-none" style={{
                    backgroundImage: 'radial-gradient(circle at 2px 2px, white 2px, transparent 0)',
                    backgroundSize: '24px 24px'
                }}></div>

                <div className="px-4 relative z-10">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <Link href="/">
                                <Icons.ArrowLeft size={24} className="text-white" />
                            </Link>
                            <h1 className="text-xl font-medium tracking-wide">Toko Saya</h1>
                        </div>
                        <div className="flex items-center gap-4">
                            <Link href="/shop/edit">
                                <Icons.Settings size={22} className="text-white" />
                            </Link>
                            <Icons.Bell size={22} className="text-white" />
                            <div className="relative">
                                <Icons.MessageCircle size={22} className="text-white" />
                                {perluDikirimCount > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                                        {perluDikirimCount}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* SHOP PROFILE CARD */}
            <div className="px-3 -mt-6 relative z-20">
                <div className="bg-white rounded-xl shadow-sm border border-black/5 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full border-2 border-white shadow-sm overflow-hidden bg-slate-100 flex-shrink-0">
                            {shop.image_url ? (
                                <img src={shop.image_url} alt={shop.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Icons.Store size={20} className="text-slate-400" />
                                </div>
                            )}
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base font-bold text-slate-800 truncate pr-2">{shop.name}</h2>
                            <p className="text-xs text-slate-500 font-medium truncate flex items-center gap-1 mt-0.5">
                                warden.co.id/{shop.slug} <Icons.Copy size={10} className="text-slate-400" />
                            </p>
                        </div>
                    </div>
                    <Link href={`/shop/${shop.slug}`} className="px-3 py-1.5 border border-indigo-500 text-indigo-600 text-xs font-semibold rounded-full whitespace-nowrap">
                        Kunjungi Toko
                    </Link>
                </div>
            </div>

            {/* NOTIFICATION BANNER (e.g. COD disabled) */}
            {!codEnabled && (
                <div className="mx-3 mt-3 bg-red-50 rounded-xl px-3 py-2.5 flex items-center justify-between border border-red-100 cursor-pointer text-xs">
                    <div className="flex items-center gap-2">
                        <div className="bg-red-500 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">
                            <Icons.AlertTriangle size={12} className="text-white" />
                        </div>
                        <span className="text-red-700 font-medium truncate pr-4">Fitur COD Toko Dinonaktifkan Hubungi Admin</span>
                    </div>
                    <div className="flex items-center text-slate-400 flex-shrink-0 gap-1">
                        <span className="text-[10px]">Semua (1)</span>
                        <Icons.ChevronRight size={14} />
                    </div>
                </div>
            )}

            {/* QUICK STATS */}
            <div className="bg-white mt-3 mx-3 rounded-xl border border-black/5 p-4 flex justify-between shadow-sm">
                <Link href="/shop/dashboard/orders?tab=proses" className="flex flex-col items-center justify-center flex-1">
                    <span className="text-xl font-medium text-slate-800 mb-1">{perluDikirimCount}</span>
                    <span className="text-[11px] text-slate-500 text-center">Perlu<br/>Dikirim</span>
                </Link>
                <Link href="/shop/dashboard/orders?tab=selesai" className="flex flex-col items-center justify-center flex-1">
                    <span className="text-xl font-medium text-slate-800 mb-1">{pembatalanCount}</span>
                    <span className="text-[11px] text-slate-500 text-center">Pembatalan</span>
                </Link>
                <Link href="#" className="flex flex-col items-center justify-center flex-1">
                    <span className="text-xl font-medium text-slate-800 mb-1">{pengembalianCount}</span>
                    <span className="text-[11px] text-slate-500 text-center">Pengembalian</span>
                </Link>
                <Link href="#" className="flex flex-col items-center justify-center flex-1">
                    <span className="text-xl font-medium text-slate-800 mb-1">{penilaianCount}</span>
                    <span className="text-[11px] text-slate-500 text-center">Penilaian Perlu<br/>Dibalas</span>
                </Link>
            </div>

            {/* MAIN MENU ICONS */}
            <div className="px-3 py-4 mt-3 flex justify-between bg-white rounded-xl mx-3 items-center border border-black/5 shadow-sm">
                {actionButtons.map((btn) => {
                    const Icon = (Icons as any)[btn.icon]
                    return (
                        <Link key={btn.id} href={btn.href} className="flex flex-col items-center flex-1 relative gap-1.5">
                            {(btn as any).badge > 0 && (
                                <span className="absolute -top-1 right-2 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center border border-white">
                                    {(btn as any).badge}
                                </span>
                            )}
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${btn.color}`}>
                                <Icon size={24} strokeWidth={2} />
                            </div>
                            <span className="text-[10px] sm:text-[11px] text-slate-600 text-center leading-tight whitespace-nowrap">
                                {btn.label}
                            </span>
                        </Link>
                    )
                })}
            </div>

            {/* REKOMENDASI BISNIS */}
            <div className="px-3 mt-4">
                <h3 className="text-sm font-semibold text-slate-800 mb-2.5 px-1">Rekomendasi Bisnis</h3>
                
                <div className="bg-white rounded-xl p-4 border border-red-100 shadow-sm relative mb-3">
                    <button className="absolute top-3 right-3 text-slate-400">
                        <Icons.X size={16} />
                    </button>
                    <div className="flex items-start gap-2 mb-2 pr-6">
                        <Icons.AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
                        <h4 className="text-[13px] font-semibold text-slate-800 leading-tight">Saldo COD Minus. Isi Saldo Otomatis agar Toko Bebas Blokir</h4>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-4 pl-6">
                        Toko telah diblokir untuk COD. Aktifkan Isi Saldo Otomatis agar COD tidak tertutup.
                    </p>
                    <div className="flex gap-2 pl-6">
                        <Link href="/shop/dashboard/wallet" className="px-3 py-1.5 border border-indigo-500 text-indigo-600 rounded text-xs font-semibold">
                            Isi Saldo
                        </Link>
                        <button className="px-3 py-1.5 bg-indigo-500 text-white rounded text-xs font-semibold">
                            Aktifkan Isi Saldo Otomatis
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-xl p-4 border border-black/5 shadow-sm relative">
                    <button className="absolute top-3 right-3 text-slate-400">
                        <Icons.X size={16} />
                    </button>
                    <div className="flex items-center gap-2 mb-3">
                        <Icons.Video size={16} className="text-amber-500" />
                        <h4 className="text-[13px] font-semibold text-slate-800">Mulai Live pertamamu ({'>'}30 menit)</h4>
                    </div>
                    
                    <div className="bg-[#FFF5F5] border border-red-50 rounded-lg p-3 flex justify-between items-center mb-3">
                        <span className="text-xs font-medium text-red-600">Dapatkan <span className="font-bold">3.000,00</span> Koin Penjual</span>
                        <Icons.Trophy size={18} className="text-amber-500" />
                    </div>

                    <div className="flex justify-between items-center">
                        <button className="text-[11px] text-slate-500 flex items-center gap-1">
                            Ketentuan <Icons.HelpCircle size={10} />
                        </button>
                        <button className="px-5 py-1.5 bg-indigo-500 text-white rounded text-xs font-semibold">
                            Mulai
                        </button>
                    </div>
                </div>

            </div>
            
            {/* Download App Banner Footer */}
            <div className="mt-8 pb-8 flex items-center justify-center px-4 gap-3">
               <div className="w-8 h-8 bg-indigo-500 rounded text-white flex items-center justify-center font-bold">W</div>
               <div className="flex-1">
                   <p className="text-[11px] text-slate-500">Download Aplikasi Warden Seller Centre & dapatkan pengalaman yang lebih baik</p>
               </div>
               <button className="px-3 py-1.5 bg-indigo-500 text-white text-xs font-semibold rounded">
                   Download
               </button>
            </div>

        </div>
    )
}