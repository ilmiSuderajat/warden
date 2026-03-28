"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"

export default function PublicShopPage() {
    const router = useRouter()
    const params = useParams()
    const slug = params.slug as string
    
    const [shop, setShop] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [products, setProducts] = useState<any[]>([])

    useEffect(() => {
        const fetchShopAndProducts = async () => {
            if (!slug) return

            const { data: shopData, error: shopError } = await supabase
                .from("shops")
                .select("*")
                .eq("slug", slug)
                .single()

            if (shopError || !shopData) {
                setLoading(false)
                return
            }

            const isClosed = shopData.whatsapp?.startsWith("CLOSED|")
            const cleanPhone = shopData.whatsapp?.split("|").pop() || ""
            const shopWithStatus = { ...shopData, whatsapp: cleanPhone, is_closed: isClosed }
            setShop(shopWithStatus)

            // Fetch products for this shop
            if (!isClosed) {
                const { data: productData } = await supabase
                    .from("products")
                    .select("*")
                    .eq("shop_id", shopData.id)
                    .eq("is_ready", true)
                    .order("created_at", { ascending: false })

                if (productData) setProducts(productData)
            } else {
                setProducts([])
            }
            setLoading(false)
        }

        fetchShopAndProducts()
    }, [slug])

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Icons.Loader2 className="animate-spin text-[#ee4d2d]" size={32} />
            </div>
        )
    }

    if (!shop) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                <Icons.Store size={48} className="text-slate-300 mb-4 opacity-50" />
                <h1 className="text-xl font-bold text-slate-800 mb-2">Warung Tidak Ditemukan</h1>
                <p className="text-sm text-slate-500 mb-6">Mungkin link salah atau warung sudah tutup.</p>
                <button onClick={() => router.push("/")} className="bg-[#ee4d2d] text-white px-6 py-3 rounded-xl font-bold active:scale-95 transition-all">
                    Kembali ke Beranda
                </button>
            </div>
        )
    }

    const openWhatsApp = () => {
        if (!shop.whatsapp) return
        
        let phone = shop.whatsapp.replace(/\D/g, "")
        if (phone.startsWith("0")) {
            phone = "62" + phone.substring(1)
        }
        
        const text = encodeURIComponent(`Halo ${shop.name}, saya Ingin bertanya dari Warung Kita App.`)
        window.open(`https://wa.me/${phone}?text=${text}`, "_blank")
    }

    return (
        <div className="min-h-screen bg-slate-50 max-w-md mx-auto font-sans pb-24">
            {/* HEADER FIXED */}
            <header className="fixed top-0 left-0 right-0 z-50 flex justify-center bg-white/80 backdrop-blur-md border-b border-slate-100/50">
                <div className="w-full max-w-md h-14 flex items-center justify-between px-4">
                    <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors active:scale-95">
                        <Icons.ArrowLeft size={20} strokeWidth={2.5} />
                    </button>
                    <div className="flex gap-2">
                        <button className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors active:scale-95">
                            <Icons.Share2 size={18} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>
            </header>

            {/* COVER & PROFILE */}
            <div className="relative pt-14">
                {/* Cover */}
                <div className="h-32 bg-slate-200 w-full overflow-hidden relative">
                    {shop.image_url ? (
                        <>
                            <img src={shop.image_url} className="w-full h-full object-cover blur-sm opacity-60 scale-110" alt="Cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-50 to-transparent" />
                        </>
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-100 to-blue-50" />
                    )}
                </div>

                {/* Profile Detail */}
                <div className="px-5 relative -mt-12 mb-6">
                    <div className="w-24 h-24 rounded-full bg-white border-4 border-slate-50 shadow-md overflow-hidden flex items-center justify-center mb-3">
                        {shop.image_url ? (
                            <img src={shop.image_url} className="w-full h-full object-cover" alt={shop.name} />
                        ) : (
                            <Icons.Store size={36} className="text-slate-300" />
                        )}
                    </div>

                    <h1 className="text-2xl font-black text-slate-800 flex items-center gap-1.5 tracking-tight">
                        {shop.name}
                        <Icons.BadgeCheck size={20} className="text-blue-500 fill-blue-50" />
                    </h1>
                    
                    <div className={`flex items-center gap-1 text-[11px] font-bold ${shop.is_closed ? 'text-slate-400' : 'text-emerald-600'} uppercase tracking-widest mt-1 mb-4`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${shop.is_closed ? 'bg-slate-300' : 'bg-emerald-500 animate-pulse'}`} /> {shop.is_closed ? 'Tutup' : 'Buka'}
                    </div>

                    {shop.description && (
                        <p className="text-sm text-slate-600 leading-relaxed mb-4">
                            {shop.description}
                        </p>
                    )}

                    <div className="flex flex-col gap-2.5 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                        <div className="flex items-start gap-3">
                            <Icons.MapPin size={16} className="text-[#ee4d2d] shrink-0 mt-0.5" />
                            <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Lokasi</p>
                                <p className="text-xs font-semibold text-slate-700 leading-snug">{shop.address}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* PRODUCT TAB */}
            <div className="px-5">
                <div className="flex items-center justify-between border-b border-slate-200 mb-4">
                    <button className="flex-1 pb-3 text-sm font-bold text-[#ee4d2d] border-b-2 border-[#ee4d2d]">
                        Produk ({products.length})
                    </button>
                    <button className="flex-1 pb-3 text-sm font-bold text-slate-400">
                        Ulasan
                    </button>
                </div>

                {products.length === 0 ? (
                    <div className="bg-white rounded-2xl p-8 border border-slate-100 flex flex-col items-center justify-center text-center shadow-sm">
                        <div className="w-16 h-16 bg-slate-50 flex items-center justify-center rounded-full mb-3">
                            {shop.is_closed ? <Icons.Moon size={28} className="text-[#ee4d2d]" /> : <Icons.PackageOpen size={28} className="text-slate-300" />}
                        </div>
                        <p className="text-sm font-bold text-slate-700">{shop.is_closed ? "Warung Sedang Tutup" : "Belum Ada Produk"}</p>
                        <p className="text-xs text-slate-400 mt-1">
                            {shop.is_closed 
                                ? "Maaf, saat ini kami sedang tidak melayani pesanan. Silakan cek kembali nanti." 
                                : "Penjual ini belum menambahkan produk ke tokonya."}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3 pb-10">
                        {products.map((p) => (
                            <Link 
                                href={`/product/${p.id}`} 
                                key={p.id}
                                className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm active:scale-[0.98] transition-all flex flex-col"
                            >
                                <div className="aspect-square bg-slate-50 relative">
                                    <img 
                                        src={Array.isArray(p.image_url) ? p.image_url[0] : p.image_url || "/placeholder.png"} 
                                        className="w-full h-full object-cover" 
                                        alt={p.name} 
                                    />
                                    {p.original_price && (
                                        <div className="absolute top-2 right-2 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full">
                                            DISKON
                                        </div>
                                    )}
                                </div>
                                <div className="p-3 flex-1 flex flex-col justify-between">
                                    <div>
                                        <h3 className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight mb-1">{p.name}</h3>
                                        <p className="text-sm font-black text-[#ee4d2d]">Rp {p.price?.toLocaleString('id-ID')}</p>
                                    </div>
                                    <div className="flex items-center gap-1 mt-2">
                                        <Icons.Star size={10} className="text-amber-400 fill-amber-400" />
                                        <span className="text-[10px] font-bold text-slate-500">{(p.rating || 5.0).toFixed(1)}</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* WA FLOATING CTA */}
            {shop.whatsapp && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100 flex justify-center z-40">
                    <div className="w-full max-w-md">
                        <button 
                            onClick={openWhatsApp}
                            className="w-full bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white py-3.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
                        >
                            <Icons.MessageCircle size={18} />
                            Chat Penjual Sekarang
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
