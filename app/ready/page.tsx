"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import * as Icons from "lucide-react"
import ProductCardSkeleton from "../components/ProductCardSkeleton"
import { calculateDistance, formatDistance } from "@/lib/geo"
import { useUserLocation } from "@/hooks/useUserLocation"

export default function ReadySnackPage() {
    const [products, setProducts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const { location: userLoc } = useUserLocation()

    const fetchReadyProducts = async (query = "") => {
        setLoading(true)
        try {
            let supabaseQuery = supabase
                .from("products")
                .select("*")
                .eq("is_ready", true)

            if (query) {
                supabaseQuery = supabaseQuery.ilike("name", `%${query}%`)
            }

            const { data, error } = await supabaseQuery.order("created_at", { ascending: false })

            if (error) throw error
            setProducts(data || [])
        } catch (error) {
            console.error("Error fetching ready products:", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchReadyProducts()
    }, [])

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        fetchReadyProducts(searchQuery)
    }

    const handleReset = () => {
        setSearchQuery("")
        fetchReadyProducts("")
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans max-w-md mx-auto pb-24">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
                <div className="flex items-center gap-3 px-5 pt-12 pb-4">
                    <Link href="/" className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                        <Icons.ArrowLeft size={20} />
                    </Link>
                    <h1 className="text-lg font-bold text-slate-900 tracking-tight">Jajanan Ready</h1>
                </div>
            </div>

            {/* BANNER */}
            <div className="mx-4 mt-4 relative group">
                <div className="relative aspect-[21/9] rounded-2xl overflow-hidden shadow-xl shadow-indigo-100 border border-white bg-indigo-600">
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-900/80 via-indigo-900/40 to-transparent flex flex-col justify-center px-6">
                        <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full w-fit mb-2">
                            READY STOCK!
                        </span>
                        <h2 className="text-white text-xl font-extrabold leading-tight mb-1 drop-shadow-md">
                            Jajanan Ready
                        </h2>
                        <p className="text-white/90 text-sm font-medium drop-shadow-sm">
                            Pesanan langsung dikirim tanpa nunggu lama.
                        </p>
                    </div>
                    {/* Decorative icons */}
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-20 rotate-12">
                        <Icons.ShoppingBag size={80} className="text-white" />
                    </div>
                </div>
            </div>

            {/* SEARCH BAR & BUTTON */}
            <div className="px-4 mt-6">
                <form onSubmit={handleSearch} className="relative flex gap-2">
                    <div className="relative flex-1">
                        <Icons.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Cari jajanan ready..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-11 rounded-xl border border-slate-200 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white"
                        />
                    </div>
                </form>
            </div>

            {/* PRODUCT GRID */}
            <div className="px-4 mt-8 grid grid-cols-2 gap-3 pb-10">
                {loading ? (
                    Array(6).fill(0).map((_, i) => (
                        <ProductCardSkeleton key={i} />
                    ))
                ) : products.length > 0 ? (
                    products.map((p) => {
                        const price = p.price || 0
                        const img = Array.isArray(p.image_url) ? p.image_url[0] : p.image_url

                        return (
                            <Link key={p.id} href={`/product/${p.id}`} className="group">
                                <div className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm transition-all hover:shadow-md active:scale-[0.98]">
                                    <div className="aspect-square relative overflow-hidden bg-slate-100">
                                        {img ? (
                                            <img src={img} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt={p.name} />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                <Icons.ImageOff size={24} />
                                            </div>
                                        )}
                                        <div className="absolute top-2 left-2">
                                            <span className="bg-emerald-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded shadow-sm">Ready</span>
                                        </div>
                                    </div>
                                    <div className="p-3">
                                        <h3 className="text-xs text-slate-800 font-medium line-clamp-2 mb-1 min-h-[2rem]">
                                            {p.name}
                                        </h3>
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-red-500 font-bold text-sm">Rp {price.toLocaleString('id-ID')}</span>
                                        </div>
                                        <div className="mt-2 flex items-center text-slate-400 gap-1 overflow-hidden">
                                            <Icons.MapPin size={10} className="text-orange-500 shrink-0" />
                                            <span className="text-[9px] truncate font-medium">
                                                {p.location || "Lokasi"}
                                                {userLoc && p.latitude && p.longitude && (
                                                    <span className="ml-1 text-indigo-600 font-bold">
                                                        • {formatDistance(calculateDistance(userLoc.latitude, userLoc.longitude, p.latitude, p.longitude))}
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        )
                    })
                ) : (
                    <div className="col-span-2 text-center py-20">
                        <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Icons.Search size={24} className="text-slate-300" />
                        </div>
                        <p className="text-slate-500 text-sm font-medium">Tidak ada jajanan ready ditemukan.</p>
                        <button
                            onClick={handleReset}
                            className="mt-4 text-indigo-600 font-bold text-xs hover:underline"
                        >
                            Lihat semua stok
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
