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
    const [isOpen, setIsOpen] = useState(true)
    const [codEnabled, setCodEnabled] = useState(true)
    const [newOrderCount, setNewOrderCount] = useState(0)
    const [todayEarnings, setTodayEarnings] = useState(0)
    const [todayCompleted, setTodayCompleted] = useState(0)
    const [balance, setBalance] = useState(0)

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
            setIsOpen(!data.whatsapp?.startsWith("CLOSED|"))
            setCodEnabled(data.cod_enabled !== false)
            setBalance(data.balance || 0)
            await fetchOrderStats(data.id)
            setLoading(false)
        }

        const fetchOrderStats = async (shopId: string) => {
            try {
                const { data: allOrders } = await supabase
                    .from("orders")
                    .select("*, order_items(*)")

                if (!allOrders) return

                const shopOrders = allOrders.filter(order =>
                    order.order_items?.some((item: any) =>
                        item.product_name?.includes(`| ${shopId}`)
                    )
                )

                const newOrders = shopOrders.filter((o: any) =>
                    o.status === "Perlu Dikemas" || o.status === "Menunggu Konfirmasi"
                )
                setNewOrderCount(newOrders.length)

                const todayStart = new Date()
                todayStart.setHours(0, 0, 0, 0)

                const todayOrders = shopOrders.filter((o: any) =>
                    o.status === "Selesai" && new Date(o.created_at) >= todayStart
                )
                setTodayCompleted(todayOrders.length)

                const earnings = todayOrders.reduce((sum: number, o: any) => {
                    const shopItems = o.order_items?.filter((item: any) =>
                        item.product_name?.includes(`| ${shopId}`)
                    ) || []
                    return sum + shopItems.reduce((s: number, item: any) =>
                        s + (item.price * item.quantity), 0
                    )
                }, 0)
                setTodayEarnings(earnings)
            } catch (err) {
                console.error("Error fetching order stats:", err)
            }
        }

        fetchShop()
    }, [router])

    const handleToggle = async () => {
        const nextStatus = !isOpen
        setIsOpen(nextStatus)

        const cleanPhone = shop.whatsapp?.replace("CLOSED|", "") || ""
        const updatedWhatsapp = nextStatus ? cleanPhone : `CLOSED|${cleanPhone}`

        const { error: shopError } = await supabase
            .from("shops")
            .update({ whatsapp: updatedWhatsapp })
            .eq("id", shop.id)

        if (shopError) {
            console.error("Error updating shop status:", shopError)
            setIsOpen(!nextStatus)
            return
        }

        const { error: productError } = await supabase
            .from("products")
            .update({ is_ready: nextStatus })
            .eq("shop_id", shop.id)

        if (productError) {
            console.error("Error updating products:", productError)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Icons.Loader2 className="animate-spin text-zinc-900" size={28} />
                    <span className="text-sm text-zinc-500 font-medium">Memuat Dashboard...</span>
                </div>
            </div>
        )
    }

    if (!shop) return null

    const actionButtons = [
        { id: "orders", label: "Pesanan", sub: "Kelola transaksi", icon: "ClipboardList", color: "text-blue-600", bg: "bg-blue-50", href: "/shop/dashboard/orders", badge: newOrderCount },
        { id: "menu", label: "Menu", sub: "Produk & stok", icon: "UtensilsCrossed", color: "text-orange-600", bg: "bg-orange-50", href: "/shop/dashboard/menu" },
        { id: "wallet", label: "Keuangan", sub: balance >= 0 ? `Rp ${Math.abs(balance).toLocaleString('id-ID')}` : `Utang ${Math.abs(balance).toLocaleString('id-ID')}`, icon: "Wallet", color: balance < 0 ? "text-red-600" : "text-emerald-600", bg: balance < 0 ? "bg-red-50" : "bg-emerald-50", href: "/shop/dashboard/wallet" },
        { id: "performance", label: "Performa", sub: "Analisis toko", icon: "BarChart3", color: "text-indigo-600", bg: "bg-indigo-50", href: "#" },
        { id: "promo", label: "Promosi", sub: "Voucher & diskon", icon: "TicketPercent", color: "text-pink-600", bg: "bg-pink-50", href: "#" },
        { id: "settings", label: "Pengaturan", sub: "Profil & info", icon: "Settings2", color: "text-slate-600", bg: "bg-slate-100", href: "/shop/edit" },
    ]

    return (
        <div className="min-h-screen bg-zinc-50 max-w-md mx-auto font-sans pb-24 relative">

            {/* HEADER - Clean Dark Theme */}
            <div className="bg-zinc-900 text-white pt-12 pb-24 px-6 relative overflow-hidden">
                {/* Ambient Glow */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-48 bg-white/5 blur-3xl rounded-full" />
                <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl" />

                <div className="relative z-10 flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10 shadow-lg overflow-hidden">
                            {shop.image_url ? (
                                <img src={shop.image_url} className="w-full h-full object-cover" alt="Shop" />
                            ) : (
                                <Icons.Store size={24} className="text-white/70" />
                            )}
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white">{shop.name}</h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={`relative flex h-2.5 w-2.5`}>
                                    {isOpen && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                                    <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOpen ? 'bg-emerald-500' : 'bg-zinc-600'}`}></span>
                                </span>
                                <span className="text-xs font-medium text-zinc-300">{isOpen ? 'Buka' : 'Tutup'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Refined Toggle */}
                    <button
                        onClick={handleToggle}
                        className={`w-14 h-8 rounded-full relative transition-all duration-300 shadow-inner flex items-center px-1 ${isOpen ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                        aria-label="Toggle Shop Status"
                    >
                        <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 flex items-center justify-center ${isOpen ? 'translate-x-6' : 'translate-x-0'}`}>
                            <Icons.Power size={12} className={isOpen ? 'text-emerald-500' : 'text-zinc-400'} />
                        </div>
                    </button>
                </div>
            </div>

            {/* FLOATING STATS CARD */}
            <div className="px-5 -mt-16 relative z-20 mb-6">
                <div className="bg-white rounded-2xl p-5 shadow-lg shadow-zinc-200/50 border border-zinc-100 w-full">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Ringkasan Hari Ini</h2>
                        <Link href="/shop/dashboard/performance" className="text-[11px] font-bold text-indigo-600 flex items-center gap-1 hover:text-indigo-700 transition-colors">
                            Lihat Detail <Icons.ArrowRight size={12} />
                        </Link>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100 group hover:bg-zinc-100 transition-colors">
                            <div className="flex items-center gap-2 mb-2">
                                <Icons.Wallet size={14} className="text-emerald-600" strokeWidth={2.5} />
                                <p className="text-[10px] text-zinc-500 font-bold uppercase">Penghasilan</p>
                            </div>
                            <p className="text-xl font-bold text-zinc-900 tracking-tight">Rp {todayEarnings.toLocaleString('id-ID')}</p>
                        </div>

                        <div className="bg-zinc-50 rounded-xl p-4 border border-zinc-100 group hover:bg-zinc-100 transition-colors">
                            <div className="flex items-center gap-2 mb-2">
                                <Icons.PackageCheck size={14} className="text-blue-600" strokeWidth={2.5} />
                                <p className="text-[10px] text-zinc-500 font-bold uppercase">Pesanan</p>
                            </div>
                            <p className="text-xl font-bold text-zinc-900 tracking-tight">{todayCompleted} <span className="text-xs font-medium text-zinc-400 ml-0.5">order</span></p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-5 space-y-6">

                {/* ALERTS */}
                <div className="space-y-3">
                    {!codEnabled && (
                        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-start gap-4">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0 border border-red-100 shadow-sm">
                                <Icons.AlertCircle size={20} className="text-red-600" />
                            </div>
                            <div className="flex-1 pt-0.5">
                                <h3 className="text-sm font-bold text-red-900 mb-1">Fitur COD Dinonaktifkan</h3>
                                <p className="text-xs text-red-700/90 leading-relaxed mb-3">Saldo negatif lebih dari Rp 50.000. Silakan bayar tagihan untuk mengaktifkan kembali.</p>
                                <Link href="/shop/dashboard/wallet" className="inline-flex items-center justify-center w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-xl text-xs font-bold transition-colors shadow-sm">
                                    Bayar Tagihan
                                </Link>
                            </div>
                        </div>
                    )}

                    {!isOpen && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-start gap-4 shadow-lg">
                            <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center shrink-0 border border-zinc-700">
                                <Icons.Moon size={20} className="text-zinc-300" />
                            </div>
                            <div className="flex-1 pt-0.5">
                                <h3 className="text-sm font-bold text-white mb-1">Toko Sedang Libur</h3>
                                <p className="text-xs text-zinc-400 leading-relaxed mb-3">Pelanggan tidak dapat melakukan pemesanan saat ini.</p>
                                <a href={`/shop/${shop.slug}`} target="_blank" className="inline-flex items-center justify-center w-full bg-white/5 hover:bg-white/10 text-white py-2 rounded-xl text-xs font-bold border border-white/10 transition-colors">
                                    <Icons.Eye size={14} className="mr-2 opacity-70" /> Pratinjau Toko
                                </a>
                            </div>
                        </div>
                    )}
                </div>

                {/* MENU GRID */}
                <div>
                    <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3 px-1">Menu Utama</h3>
                    <div className="grid grid-cols-2 gap-3">
                        {actionButtons.map((btn) => {
                            const Icon = (Icons as any)[btn.icon]
                            return (
                                <Link
                                    key={btn.id}
                                    href={btn.href}
                                    className="bg-white p-4 rounded-2xl shadow-sm hover:shadow-md border border-zinc-100 active:scale-[0.98] transition-all group relative overflow-hidden flex flex-col justify-between min-h-[140px]"
                                >
                                    {(btn as any).badge > 0 && (
                                        <span className="absolute top-3 right-3 min-w-[22px] h-[22px] bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5 shadow-md z-10">
                                            {(btn as any).badge}
                                        </span>
                                    )}

                                    <div className={`w-10 h-10 ${btn.bg} ${btn.color} rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-105`}>
                                        <Icon size={20} strokeWidth={2} />
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-bold text-zinc-800 mb-0.5">{btn.label}</h3>
                                        <p className="text-[11px] text-zinc-500 font-medium truncate">{btn.sub}</p>
                                    </div>
                                </Link>
                            )
                        })}
                    </div>
                </div>

                {/* UPGRADE BANNER */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 p-5 shadow-lg border border-zinc-700/50">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl translate-x-8 -translate-y-8" />
                    <div className="relative z-10 flex items-start gap-4">
                        <div className="w-10 h-10 bg-yellow-400/10 rounded-xl flex items-center justify-center shrink-0 border border-yellow-400/20">
                            <Icons.Sparkles size={20} className="text-yellow-400" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-base font-bold text-white mb-1">Upgrade ke Premium</h3>
                            <p className="text-xs text-zinc-400 leading-relaxed mb-4">Dapatkan akses ke fitur analisis mendalam dan prioritas pencarian.</p>
                            <button className="bg-white text-zinc-900 hover:bg-zinc-100 px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm">
                                Lihat Keuntungan
                            </button>
                        </div>
                    </div>
                </div>

                {/* FOOTER */}
                <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-400 font-medium py-4 text-center border-t border-zinc-100 mt-8">
                    <Icons.ShieldCheck size={14} className="opacity-60" />
                    <span>Butuh bantuan? <button className="text-zinc-600 font-semibold hover:text-indigo-600 transition-colors">Hubungi Support</button></span>
                </div>
            </div>
        </div>
    )
}