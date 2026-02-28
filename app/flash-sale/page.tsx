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

            // 1. Fetch Active Banner
            const { data: bannerData } = await supabase
                .from("flash_sale_banners")
                .select("*")
                .eq("is_active", true)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle()

            if (bannerData) setActiveBanner(bannerData)

            // 2. Fetch Flash Sale Products
            const { data: productData } = await supabase
                .from("products")
                .select("*")
                .eq("is_flash_sale", true)

            if (productData) setProducts(productData)

            setLoading(false)
        }

        fetchData()
    }, [])

    // Countdown Timer Logic
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

        return () => clearInterval(interval)
    }, [activeBanner])

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 font-sans max-w-md mx-auto pb-24">
                {/* HEADER SKELETON */}
                <div className="bg-white border-b border-slate-100">
                    <div className="flex items-center gap-3 px-5 pt-12 pb-4">
                        <Skeleton className="w-8 h-8 rounded-xl" />
                        <Skeleton className="h-6 w-32" />
                    </div>
                </div>

                {/* BANNER SKELETON */}
                <div className="mx-4 mt-4">
                    <Skeleton className="aspect-[21/9] w-full rounded-2xl" />
                </div>

                {/* PRODUCT GRID SKELETON */}
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
                    <h1 className="text-lg font-bold text-slate-900 tracking-tight">WardenFlash Sale</h1>
                </div>
            </div>

            {/* BANNER PROMO */}
            {activeBanner && (
                <div className="mx-4 mt-4 relative group">
                    <div className="relative aspect-[21/9] rounded-2xl overflow-hidden shadow-xl shadow-indigo-100 border border-white">
                        <img
                            src={activeBanner.image_url}
                            alt={activeBanner.title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/80 via-indigo-900/40 to-transparent flex flex-col justify-center px-6">
                            <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full w-fit mb-2 animate-bounce">
                                FLASH SALE!
                            </span>
                            <h2 className="text-white text-xl font-extrabold leading-tight mb-1 drop-shadow-md">
                                {activeBanner.title}
                            </h2>
                            <p className="text-white/90 text-sm font-medium drop-shadow-sm">
                                {activeBanner.discount_text}
                            </p>
                        </div>
                    </div>

                    {/* TIMER OVERLAY */}
                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-white rounded-xl shadow-lg px-4 py-2 border border-slate-100 flex items-center gap-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Berakhir:</span>
                        <div className="flex gap-1.5 items-center">
                            <TimeBlock value={timeLeft.hours} label="Jam" />
                            <span className="text-indigo-400 font-bold">:</span>
                            <TimeBlock value={timeLeft.minutes} label="Men" />
                            <span className="text-indigo-400 font-bold">:</span>
                            <TimeBlock value={timeLeft.seconds} label="Det" />
                        </div>
                    </div>
                </div>
            )}

            {/* PRODUCT GRID */}
            <div className="px-4 mt-12 grid grid-cols-2 gap-3 pb-10">
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

                                    {/* PROGRESS BAR (Simulated) */}
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
                                            ></div>
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

function TimeBlock({ value, label }: { value: number, label: string }) {
    return (
        <div className="flex flex-col items-center">
            <div className="bg-slate-900 text-white font-black text-xs min-w-[24px] py-0.5 rounded flex items-center justify-center">
                {value.toString().padStart(2, '0')}
            </div>
        </div>
    )
}
