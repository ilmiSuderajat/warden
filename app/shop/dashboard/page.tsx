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
    const [isOpen, setIsOpen] = useState(true) // Simulating shop status

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
            setLoading(false)
        }

        fetchShop()
    }, [router])

    const handleToggle = async () => {
        const nextStatus = !isOpen
        setIsOpen(nextStatus)

        // Get clean phone number (remove prefix if exists)
        const cleanPhone = shop.whatsapp?.replace("CLOSED|", "") || ""
        const updatedWhatsapp = nextStatus ? cleanPhone : `CLOSED|${cleanPhone}`

        // 1. Update shop status marker
        const { error: shopError } = await supabase
            .from("shops")
            .update({ whatsapp: updatedWhatsapp })
            .eq("id", shop.id)

        if (shopError) {
            console.error("Error updating shop status:", shopError)
            setIsOpen(!nextStatus) // Rollback
            return
        }

        // 2. Batch update all products' is_ready based on shop status
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
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Icons.Loader2 className="animate-spin text-[#ee4d2d]" size={32} />
            </div>
        )
    }

    if (!shop) return null

    const actionButtons = [
        { id: "orders", label: "Pesanan", sub: "Kelola orderan", icon: "ClipboardList", color: "text-blue-500", bg: "bg-blue-50", href: "/shop/dashboard/orders" },
        { id: "menu", label: "Menu", sub: "Kelola produk", icon: "UtensilsCrossed", color: "text-orange-500", bg: "bg-orange-50", href: "/shop/dashboard/menu" },
        { id: "promo", label: "Promo", sub: "Diskon & diskon", icon: "TicketPercent", color: "text-red-500", bg: "bg-red-50", href: "#" },
        { id: "wallet", label: "Dompet", sub: "Penghasilan", icon: "Wallet", color: "text-emerald-500", bg: "bg-emerald-50", href: "#" },
        { id: "performance", label: "Performa", sub: "Statistik toko", icon: "BarChart3", color: "text-indigo-500", bg: "bg-indigo-50", href: "#" },
        { id: "settings", label: "Pengaturan", sub: "Profil warung", icon: "Settings2", color: "text-slate-500", bg: "bg-slate-50", href: "/shop/edit" },
    ]

    return (
        <div className="min-h-screen bg-slate-50 max-w-md mx-auto font-sans pb-32 overflow-hidden">
            {/* SHOPEEFOOD ORANGE HEADER */}
            <div className="bg-[#ee4d2d] text-white pt-12 pb-24 px-5 rounded-b-[40px] shadow-lg shadow-[#ee4d2d]/20 relative">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 overflow-hidden">
                            {shop.image_url ? (
                                <img src={shop.image_url} className="w-full h-full object-cover" alt="Shop" />
                            ) : (
                                <Icons.Store size={24} className="text-white" />
                            )}
                        </div>
                        <div>
                            <h1 className="text-lg font-black tracking-tight leading-tight">{shop.name}</h1>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-emerald-400' : 'bg-slate-300'} border border-white/20`} />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-white/80">{isOpen ? 'Operasional' : 'Tutup'}</span>
                            </div>
                        </div>
                    </div>
                    <button 
                        onClick={handleToggle}
                        className={`w-14 h-7 rounded-full relative transition-all duration-300 shadow-inner ${isOpen ? 'bg-emerald-500' : 'bg-white/20 border border-white/30'}`}
                    >
                        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 flex items-center justify-center ${isOpen ? 'right-1' : 'left-1'}`}>
                            {isOpen ? <Icons.Check size={12} className="text-emerald-500" /> : <Icons.Power size={12} className="text-slate-400" />}
                        </div>
                    </button>
                </div>

                {/* EARNINGS SUMMARY */}
                <div className="bg-white rounded-3xl p-5 shadow-xl shadow-black/5 absolute -bottom-12 left-5 right-5 text-slate-900 border border-slate-100">
                    <div className="flex justify-between items-center mb-4">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ringkasan Hari Ini</span>
                        <Icons.ChevronRight size={16} className="text-slate-300" />
                    </div>
                    <div className="grid grid-cols-2 divide-x divide-slate-100">
                        <div className="pr-4">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mb-1">Penghasilan</p>
                            <p className="text-lg font-black text-slate-800">Rp 0</p>
                        </div>
                        <div className="pl-4">
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mb-1">Pesanan Selesai</p>
                            <p className="text-lg font-black text-slate-800">0</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-5 pt-20 space-y-6">
                {/* CLOSED SHOP WARNING */}
                {!isOpen && (
                    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                            <Icons.AlertTriangle size={20} className="text-red-500" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-bold text-red-800 mb-1">Warung Sedang Tutup</h3>
                            <p className="text-xs text-red-600/70 leading-relaxed mb-2">Semua produkmu disembunyikan dari halaman publik. Pelanggan yang mengunjungi warungmu akan melihat keterangan "Warung Sedang Tutup".</p>
                            <a href={`/shop/${shop.slug}`} target="_blank" className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 hover:text-red-700 underline underline-offset-2">
                                <Icons.ExternalLink size={12} />
                                Lihat halaman warung
                            </a>
                        </div>
                    </div>
                )}

                {/* ACTION GRID */}
                <div className="grid grid-cols-2 gap-3">
                    {actionButtons.map((btn) => {
                        const Icon = (Icons as any)[btn.icon]
                        return (
                            <Link
                                key={btn.id}
                                href={btn.href}
                                className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all active:scale-[0.98] group"
                            >
                                <div className={`w-10 h-10 ${btn.bg} ${btn.color} rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                                    <Icon size={20} />
                                </div>
                                <h3 className="text-sm font-bold text-slate-800">{btn.label}</h3>
                                <p className="text-[10px] text-slate-400 font-medium mt-0.5">{btn.sub}</p>
                            </Link>
                        )
                    })}
                </div>

                {/* PROMOTION CARD */}
                <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 rounded-3xl p-5 text-white shadow-lg shadow-indigo-100 relative overflow-hidden">
                    <div className="relative z-10">
                        <h3 className="text-sm font-bold mb-1">Tingkatkan Penjualan</h3>
                        <p className="text-[11px] text-indigo-100 opacity-80 leading-relaxed mb-4 max-w-[180px]">Daftarkan warungmu di program Flash Sale Warden untuk menjangkau lebih banyak pelanggan.</p>
                        <button className="bg-white text-indigo-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm active:scale-95 transition-all">Daftar Sekarang</button>
                    </div>
                    <Icons.TrendingUp size={80} className="absolute -right-4 -bottom-4 text-white/10" />
                </div>

                {/* HELP CENTER */}
                <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 font-medium py-4">
                    <Icons.HelpCircle size={14} />
                    <span>Butuh bantuan mengelola warung?</span>
                    <button className="text-[#ee4d2d] font-bold underline">Hubungi CS</button>
                </div>
            </div>
        </div>
    )
}
