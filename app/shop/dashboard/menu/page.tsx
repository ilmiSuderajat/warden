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

            // Get shop
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

            // Get products for this shop
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
        // Optimistic UI
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
            toast.success(`Menu ${newStatus ? 'diaktifkan' : 'dinonaktifkan'}`)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Icons.Loader2 className="animate-spin text-[#ee4d2d]" size={32} />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 max-w-md mx-auto font-sans pb-24">
            {/* HEADER */}
            <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
                <div className="flex items-center gap-3 px-4 h-14">
                    <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                        <Icons.ArrowLeft size={20} strokeWidth={2.5} />
                    </button>
                    <h1 className="text-lg font-bold text-slate-900 tracking-tight">Daftar Menu</h1>
                </div>
            </header>

            <div className="p-4 space-y-4">
                {/* ADD PRODUCT BUTTON */}
                <Link
                    href="/shop/dashboard/menu/add"
                    className="w-full bg-[#ee4d2d] text-white p-4 rounded-2xl flex items-center justify-between shadow-lg shadow-[#ee4d2d]/20 active:scale-[0.98] transition-all"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <Icons.Plus size={20} />
                        </div>
                        <div>
                            <p className="text-sm font-bold uppercase tracking-tight">Tambah Menu Baru</p>
                            <p className="text-[10px] text-white/70 font-medium">Tambah jagoan kulinermu</p>
                        </div>
                    </div>
                    <Icons.ChevronRight size={18} />
                </Link>

                {/* PRODUCT LIST */}
                <div className="space-y-3">
                    <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">Semua Produk ({products.length})</h2>
                    
                    {products.length === 0 ? (
                        <div className="bg-white rounded-3xl p-10 border border-slate-100 flex flex-col items-center justify-center text-center">
                            <div className="w-16 h-16 bg-slate-50 flex items-center justify-center rounded-full mb-4">
                                <Icons.Utensils size={28} className="text-slate-300" />
                            </div>
                            <p className="text-sm font-bold text-slate-700">Belum ada menu</p>
                            <p className="text-xs text-slate-400 mt-1 max-w-[200px]">Mulai tambahkan menu jualanmu agar pembeli bisa memesan.</p>
                        </div>
                    ) : (
                        products.map((p) => (
                            <div key={p.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex gap-4 transition-all">
                                <div className="w-20 h-20 rounded-xl bg-slate-50 overflow-hidden shrink-0 border border-slate-50">
                                    <img 
                                        src={Array.isArray(p.image_url) ? p.image_url[0] : p.image_url || "/placeholder.png"} 
                                        className="w-full h-full object-cover" 
                                        alt={p.name} 
                                    />
                                </div>
                                <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
                                    <div>
                                        <h3 className="text-sm font-bold text-slate-800 line-clamp-1 leading-tight">{p.name}</h3>
                                        <p className="text-sm font-black text-[#ee4d2d] mt-1">Rp {p.price?.toLocaleString('id-ID')}</p>
                                    </div>
                                    
                                    <div className="flex items-center justify-between mt-2">
                                        <div className="flex items-center gap-1">
                                            <span className={`w-1.5 h-1.5 rounded-full ${p.is_ready ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{p.is_ready ? 'Tampilkan' : 'Sembunyikan'}</span>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => toggleReady(p.id, p.is_ready)}
                                                className={`w-10 h-6 rounded-full relative transition-all duration-300 ${p.is_ready ? 'bg-emerald-400' : 'bg-slate-200'}`}
                                            >
                                                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-300 ${p.is_ready ? 'right-0.5' : 'left-0.5'}`} />
                                            </button>
                                            <button 
                                                onClick={() => router.push(`/shop/dashboard/menu/edit/${p.id}`)}
                                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors"
                                            >
                                                <Icons.Edit3 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
