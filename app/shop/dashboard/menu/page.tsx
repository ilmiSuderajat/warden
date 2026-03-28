"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"

export default function ShopMenuPage() {
    const router = useRouter()
    const [products, setProducts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [shop, setShop] = useState<any>(null)

    useEffect(() => {
        const fetchShopAndProducts = async () => {
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

            const { data: productData, error } = await supabase
                .from("products")
                .select("*")
                .eq("shop_id", shopData.id)
                .order("created_at", { ascending: false })

            if (error) {
                console.error(error)
                toast.error("Gagal mengambil daftar menu")
            } else {
                setProducts(productData || [])
            }
            setLoading(false)
        }

        fetchShopAndProducts()
    }, [router])

    const toggleReady = async (productId: string, currentStatus: boolean) => {
        const newStatus = !currentStatus
        // Optimistic UI Update
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, is_ready: newStatus } : p))

        const { error } = await supabase
            .from("products")
            .update({ is_ready: newStatus })
            .eq("id", productId)

        if (error) {
            toast.error("Gagal mengupdate status menu")
            // Rollback
            setProducts(prev => prev.map(p => p.id === productId ? { ...p, is_ready: currentStatus } : p))
        } else {
            toast.success(`Menu ${newStatus ? 'diaktifkan' : 'disembunyikan'}`)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Icons.Loader2 className="animate-spin text-zinc-900" size={28} />
                    <span className="text-sm text-zinc-500 font-medium">Memuat Menu...</span>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-zinc-50 max-w-md mx-auto font-sans pb-32">

            {/* FLOATING HEADER */}
            <header className="sticky top-0 z-40 bg-zinc-50/80 backdrop-blur-lg border-b border-zinc-100/80">
                <div className="flex items-center justify-between px-4 h-14">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.back()} className="p-2 -ml-2 text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors">
                            <Icons.ArrowLeft size={20} strokeWidth={2.5} />
                        </button>
                        <div>
                            <h1 className="text-base font-bold text-zinc-900 tracking-tight">Daftar Menu</h1>
                            <p className="text-[10px] text-zinc-400 font-medium -mt-0.5">{products.length} Produk</p>
                        </div>
                    </div>
                    {/* Settings or Filter button could go here */}
                </div>
            </header>

            <div className="p-4 space-y-6">

                {/* ADD NEW PRODUCT CARD */}
                <Link
                    href="/shop/dashboard/menu/add"
                    className="relative w-full bg-zinc-900 text-white p-5 rounded-2xl flex items-center justify-between shadow-lg shadow-zinc-900/10 active:scale-[0.98] transition-all overflow-hidden group"
                >
                    {/* Decorative Element */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-8 translate-x-8 group-hover:scale-110 transition-transform" />

                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center border border-white/10">
                            <Icons.Plus size={24} className="text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">Tambah Menu Baru</p>
                            <p className="text-[11px] text-zinc-400 font-medium">Perluas variasi jualanmu</p>
                        </div>
                    </div>
                    <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center relative z-10">
                        <Icons.ChevronRight size={18} className="text-white/70" />
                    </div>
                </Link>

                {/* PRODUCT LIST SECTION */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Semua Produk</h2>
                    </div>

                    {products.length === 0 ? (
                        <div className="bg-white rounded-2xl p-10 border border-zinc-100 flex flex-col items-center justify-center text-center shadow-sm">
                            <div className="w-16 h-16 bg-zinc-50 flex items-center justify-center rounded-2xl mb-4 border border-zinc-100">
                                <Icons.UtensilsCrossed size={28} className="text-zinc-300" />
                            </div>
                            <p className="text-sm font-bold text-zinc-800">Belum ada menu</p>
                            <p className="text-xs text-zinc-400 mt-1 max-w-[200px] leading-relaxed">Mulai tambahkan menu jualanmu agar pembeli bisa memesan.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {products.map((p) => (
                                <div
                                    key={p.id}
                                    className={`bg-white rounded-2xl border transition-all duration-200 ${p.is_ready ? 'border-zinc-100 shadow-sm' : 'border-zinc-200 bg-zinc-50/50 opacity-80'}`}
                                >
                                    <div className="p-4 flex gap-4">
                                        {/* Product Image */}
                                        <div className="w-20 h-20 rounded-xl bg-zinc-100 overflow-hidden shrink-0 border border-zinc-50 relative">
                                            <img
                                                src={Array.isArray(p.image_url) ? p.image_url[0] : p.image_url || "/placeholder.png"}
                                                className="w-full h-full object-cover"
                                                alt={p.name}
                                            />
                                            {!p.is_ready && (
                                                <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-[1px] flex items-center justify-center">
                                                    <Icons.EyeOff size={16} className="text-white" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Product Info */}
                                        <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
                                            <div>
                                                <div className="flex items-start justify-between gap-2">
                                                    <h3 className="text-sm font-bold text-zinc-800 line-clamp-1 leading-tight">{p.name}</h3>
                                                </div>
                                                <p className="text-lg font-bold text-zinc-900 mt-1 tracking-tight">
                                                    Rp {p.price?.toLocaleString('id-ID')}
                                                </p>
                                            </div>

                                            <div className="flex items-center justify-between mt-2">
                                                <div className="flex items-center gap-1.5 text-zinc-500">
                                                    <span className={`w-1.5 h-1.5 rounded-full ${p.is_ready ? 'bg-emerald-500' : 'bg-zinc-300'}`} />
                                                    <span className="text-[10px] font-bold uppercase tracking-wide">
                                                        {p.is_ready ? 'Tersedia' : 'Disembunyikan'}
                                                    </span>
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => router.push(`/shop/dashboard/menu/edit/${p.id}`)}
                                                        className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    >
                                                        <Icons.Edit3 size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => toggleReady(p.id, p.is_ready)}
                                                        className={`w-10 h-6 rounded-full relative transition-all duration-300 ${p.is_ready ? 'bg-emerald-500' : 'bg-zinc-200'}`}
                                                    >
                                                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-300 ${p.is_ready ? 'right-0.5' : 'left-0.5'}`} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}