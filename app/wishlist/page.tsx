"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { ArrowLeft, Heart, Trash2, Loader2, ShoppingBag } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import ProductCardSkeleton from "../components/ProductCardSkeleton"

export default function WishlistPage() {
    const router = useRouter()
    const [items, setItems] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [removingId, setRemovingId] = useState<string | null>(null)

    useEffect(() => {
        const fetchWishlist = async () => {
            setLoading(true)
            const { data: { session } } = await supabase.auth.getSession()

            if (!session) {
                router.push("/login")
                return
            }

            const { data } = await supabase
                .from("wishlists")
                .select("id, product_id, products(id, name, price, original_price, image_url, stock, location)")
                .eq("user_id", session.user.id)
                .order("created_at", { ascending: false })

            if (data) setItems(data)
            setLoading(false)
        }
        fetchWishlist()
    }, [router])

    const handleRemove = async (wishlistId: string) => {
        setRemovingId(wishlistId)
        const { error } = await supabase
            .from("wishlists")
            .delete()
            .eq("id", wishlistId)

        if (error) {
            toast.error("Gagal menghapus dari wishlist")
        } else {
            setItems(prev => prev.filter(item => item.id !== wishlistId))
            toast.success("Dihapus dari wishlist")
        }
        setRemovingId(null)
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans max-w-md mx-auto pb-24">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
                <div className="flex items-center justify-between px-5 pt-12 pb-4">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                            <ArrowLeft size={20} strokeWidth={2.5} />
                        </button>
                        <div>
                            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Wishlist</h1>
                            <p className="text-[10px] font-medium text-slate-400">Produk yang kamu suka</p>
                        </div>
                    </div>
                    <span className="px-3 py-1 bg-red-50 text-red-500 text-[10px] font-bold rounded-full border border-red-100">
                        <Heart size={10} className="inline fill-red-500 mr-1" />{items.length} Item
                    </span>
                </div>
            </div>

            <div className="p-4">
                {loading ? (
                    <div className="grid grid-cols-2 gap-3">
                        {Array(4).fill(0).map((_, i) => (
                            <ProductCardSkeleton key={i} />
                        ))}
                    </div>
                ) : items.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                        {items.map((item) => {
                            const p = item.products
                            if (!p) return null
                            const img = Array.isArray(p.image_url) ? p.image_url[0] : p.image_url

                            return (
                                <div key={item.id} className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm relative group">
                                    {/* Tombol Hapus */}
                                    <button
                                        onClick={(e) => { e.preventDefault(); handleRemove(item.id) }}
                                        disabled={removingId === item.id}
                                        className="absolute top-2 right-2 z-10 p-1.5 bg-white/90 rounded-full shadow-sm text-red-400 hover:text-red-600 hover:bg-red-50 transition-all"
                                    >
                                        {removingId === item.id ? (
                                            <Loader2 size={14} className="animate-spin" />
                                        ) : (
                                            <Trash2 size={14} />
                                        )}
                                    </button>

                                    <Link href={`/product/${p.id}`}>
                                        {/* Gambar */}
                                        <div className="aspect-square relative overflow-hidden bg-slate-100">
                                            {img ? (
                                                <img src={img} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt={p.name} />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                    <ShoppingBag size={24} />
                                                </div>
                                            )}
                                            {/* Stok Habis */}
                                            {(p.stock === 0 || p.stock === null) && (
                                                <div className="absolute inset-0 bg-black/50 z-5 flex items-center justify-center">
                                                    <span className="bg-red-600 text-white text-[10px] font-extrabold px-3 py-1 rounded-md shadow-lg uppercase">Stok Habis</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Info */}
                                        <div className="p-3">
                                            <h3 className="text-xs text-slate-800 font-medium line-clamp-2 mb-1.5 min-h-[2rem]">{p.name}</h3>
                                            <span className="text-red-500 font-bold text-sm">Rp {p.price?.toLocaleString('id-ID')}</span>
                                            {p.original_price && p.original_price > p.price && (
                                                <p className="text-[10px] text-slate-400 line-through mt-0.5">Rp {p.original_price?.toLocaleString('id-ID')}</p>
                                            )}
                                        </div>
                                    </Link>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="text-center py-20 flex flex-col items-center justify-center">
                        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-5">
                            <Heart size={32} className="text-red-300" />
                        </div>
                        <p className="text-base font-bold text-slate-700 mb-1">Wishlist Masih Kosong</p>
                        <p className="text-sm text-slate-400 mb-6">Yuk jelajahi produk dan tambahkan ke wishlist!</p>
                        <Link
                            href="/"
                            className="bg-indigo-600 text-white px-6 py-3 rounded-xl text-sm font-bold active:scale-95 transition-all shadow-md shadow-indigo-100"
                        >
                            Jelajahi Produk
                        </Link>
                    </div>
                )}
            </div>
        </div>
    )
}
