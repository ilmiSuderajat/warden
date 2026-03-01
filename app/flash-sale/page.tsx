"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import * as Icons from "lucide-react"
import ProductCardSkeleton from "../components/ProductCardSkeleton"
import Skeleton from "../components/Skeleton"
import { calculateDistance, formatDistance } from "@/lib/geo"
import { useUserLocation } from "@/hooks/useUserLocation"

export default function FlashSalePage() {
    const [products, setProducts] = useState<any[]>([])
    const [activeBanner, setActiveBanner] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 })
    const { location: userLoc } = useUserLocation()

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)

            const { data: bannerData, error: bannerError } = await supabase
                .from("flash_sale_banners")
                .select("*")
                .eq("is_active", true)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle()
            console.log("BANNER DATA:", bannerData)      // <-- tambah ini
            console.log("BANNER ERROR:", bannerError)
            if (bannerData) setActiveBanner(bannerData)

            const { data: productData } = await supabase
                .from("products")
                .select("*")
                .eq("is_flash_sale", true)

            if (productData) setProducts(productData)

            setLoading(false)
        }

        fetchData()
    }, [])

    useEffect(() => {
        if (!activeBanner?.end_date) return

        const interval = setInterval(() => {
            const now = new Date().getTime()
            const end = new Date(activeBanner.end_date).getTime()
            const diff = end - now

            if (diff <= 0) {
                clearInterval(interval)
                setTimeLeft({ hours: 0, minutes: 0, seconds: 0 })
            } else {
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
                const seconds = Math.floor((diff % (1000 * 60)) / 1000)
                setTimeLeft({ hours, minutes, seconds })
            }
        }, 1000)
        // Tepat sebelum return utama
        console.log("activeBanner:", activeBanner)
        console.log("end_date:", activeBanner?.end_date)
        return () => clearInterval(interval)
    }, [activeBanner])

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 font-sans max-w-md mx-auto pb-24">
                <div className="bg-white border-b border-slate-100">
                    <div className="flex items-center gap-3 px-5 pt-12 pb-4">
                        <Skeleton className="w-8 h-8 rounded-xl" />
                        <Skeleton className="h-6 w-32" />
                    </div>
                </div>
                <div className="mx-4 mt-4">
                    <Skeleton className="aspect-[21/9] w-full rounded-2xl" />
                </div>
                <div className="px-4 mt-12 grid grid-cols-2 gap-3">
                    {Array(6).fill(0).map((_, i) => (
                        <ProductCardSkeleton key={i} />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans max-w-md mx-auto pb-24">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
                <div className="flex items-center gap-3 px-5 pt-12 pb-4">
                    <Link href="/" className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                        <Icons.ArrowLeft size={20} />
                    </Link>
                    <h1 className="text-lg font-bold text-slate-900 tracking-tight">Warden Flash Sale</h1>
                </div>
            </div>



            {/* ── CENTERED COUNTDOWN SECTION ── */}
            {activeBanner?.end_date && (
                <div className="mx-4 mt-5">
                    <div className="relative rounded-2xl overflow-hidden">
                        {/* Background */}
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800" />
                        {/* Noise texture */}
                        <div
                            className="absolute inset-0 opacity-[0.12] mix-blend-overlay"
                            style={{
                                backgroundImage:
                                    "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E\")",
                            }}
                        />
                        {/* Glow orbs */}
                        <div className="absolute -top-6 -right-6 w-28 h-28 bg-violet-400/30 rounded-full blur-2xl" />
                        <div className="absolute -bottom-8 -left-4 w-24 h-24 bg-indigo-300/20 rounded-full blur-2xl" />

                        {/* Content */}
                        <div className="relative z-10 py-4 px-5 flex flex-col items-center gap-3">
                            {/* Label */}
                            <div className="flex items-center gap-2">
                                <Icons.Zap size={13} className="text-orange-400 fill-orange-400" />
                                <span className="text-[10px] font-semibold text-white/60 uppercase tracking-[0.18em]">
                                    Berakhir dalam
                                </span>
                                <Icons.Zap size={13} className="text-orange-400 fill-orange-400" />
                            </div>

                            {/* Timer blocks */}
                            <div className="flex items-center gap-2">
                                <BigTimeBlock value={timeLeft.hours} label="Jam" />
                                <Colon />
                                <BigTimeBlock value={timeLeft.minutes} label="Menit" />
                                <Colon />
                                <BigTimeBlock value={timeLeft.seconds} label="Detik" />
                            </div>
                        </div>

                        {/* Bottom shimmer */}
                        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                    </div>
                </div>
            )}

            {/* SECTION HEADER */}
            <div className="px-4 mt-5 mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-indigo-600 rounded-full" />
                    <span className="text-sm font-bold text-slate-800">Produk Flash Sale</span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">{products.length} produk</span>
            </div>

            {/* PRODUCT GRID */}
            <div className="px-4 grid grid-cols-2 gap-3 pb-10">
                {products.map((p) => {
                    const price = p.price || 0
                    const original = p.original_price || 0
                    const discount = original > price ? Math.round(((original - price) / original) * 100) : 0
                    const img = Array.isArray(p.image_url) ? p.image_url[0] : p.image_url

                    return (
                        <Link key={p.id} href={`/product/${p.id}`} className="group">
                            <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm transition-all hover:shadow-md active:scale-[0.98]">
                                <div className="aspect-square relative overflow-hidden">
                                    <img src={img} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt={p.name} />
                                    <div className="absolute top-2 left-2 flex gap-1">
                                        <span className="bg-indigo-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded">Mall</span>
                                        {discount > 0 && (
                                            <span className="bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded">-{discount}%</span>
                                        )}
                                    </div>
                                </div>
                                <div className="p-3">
                                    <h3 className="text-xs text-slate-800 font-medium line-clamp-2 mb-1 min-h-[2rem]">
                                        {p.name}
                                    </h3>
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-red-500 font-bold text-sm">Rp {price.toLocaleString('id-ID')}</span>
                                        {discount > 0 && (
                                            <span className="text-[9px] text-slate-400 line-through">Rp {original.toLocaleString('id-ID')}</span>
                                        )}
                                    </div>

                                    {/* PROGRESS BAR */}
                                    <div className="mt-2">
                                        <div className="flex justify-between text-[8px] font-bold text-slate-400 mb-1 px-0.5 uppercase tracking-tighter">
                                            <div className="flex items-center gap-1">
                                                <span>Stok Terbatas</span>
                                                {userLoc && p.latitude && p.longitude && (
                                                    <span className="text-indigo-600">
                                                        • {formatDistance(calculateDistance(userLoc.latitude, userLoc.longitude, p.latitude, p.longitude))}
                                                    </span>
                                                )}
                                            </div>
                                            <span>{p.sold_count || 0} terjual</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full"
                                                style={{ width: `${Math.min(((p.sold_count || 5) / 50) * 100, 95)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    )
                })}
            </div>

            {!loading && products.length === 0 && (
                <div className="text-center py-20">
                    <Icons.Zap size={48} className="mx-auto text-slate-200 mb-4" />
                    <p className="text-slate-500 text-sm">Belum ada promo kilat saat ini.</p>
                </div>
            )}
        </div>
    )
}

function BigTimeBlock({ value, label }: { value: number; label: string }) {
    return (
        <div className="flex flex-col items-center gap-1">
            <div className="relative min-w-[56px] h-[52px] bg-white/10 border border-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm overflow-hidden">
                {/* inner top gloss */}
                <div className="absolute inset-x-0 top-0 h-1/2 bg-white/5" />
                <span className="text-2xl font-bold text-white tabular-nums relative z-10">
                    {value.toString().padStart(2, "0")}
                </span>
            </div>
            <span className="text-[9px] text-white/50 font-semibold uppercase tracking-widest">{label}</span>
        </div>
    )
}

function Colon() {
    return (
        <div className="flex flex-col gap-1.5 pb-5">
            <div className="w-1 h-1 rounded-full bg-white/40" />
            <div className="w-1 h-1 rounded-full bg-white/40" />
        </div>
    )
}