"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { ArrowLeft, Loader2, Search, Package, Check, Zap, ShoppingBag, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export default function ManageReadyPage() {
    const router = useRouter()
    const [products, setProducts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [processingId, setProcessingId] = useState<string | null>(null)

    const fetchProducts = async () => {
        setLoading(true)
        const { data } = await supabase
            .from("products")
            .select("id, name, price, stock, image_url, is_ready")
            .order("created_at", { ascending: false })

        if (data) setProducts(data)
        setLoading(false)
    }

    useEffect(() => {
        fetchProducts()
    }, [])

    const toggleReady = async (id: string, currentStatus: boolean, name: string) => {
        const newStatus = !currentStatus;
        if (!newStatus && !confirm(`Hapus status Ready untuk "${name}"?`)) return;

        setProcessingId(id)

        const { error } = await supabase
            .from("products")
            .update({ is_ready: newStatus })
            .eq("id", id)

        if (error) {
            toast.error("Gagal mengupdate: " + error.message)
        } else {
            setProducts(prev => prev.map(p => p.id === id ? { ...p, is_ready: newStatus } : p))
            toast.success(newStatus ? `⚡ ${name} sekarang READY!` : "Status Ready dihapus")
        }
        setProcessingId(null)
    }

    const filteredProducts = products.filter(p =>
        (p.name || "").toLowerCase().includes((searchQuery || "").toLowerCase())
    )

    const readyCount = products.filter(p => p.is_ready).length

    return (
        <div className="min-h-screen bg-slate-50 font-sans max-w-md mx-auto pb-24 selection:bg-indigo-100">
            {/* HEADER PREMIUM */}
            <div className="bg-white sticky top-0 z-40 border-b border-slate-100/60 backdrop-blur-md bg-white/80">
                <div className="px-5 pt-12 pb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.push('/admin')} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                            <ArrowLeft size={20} strokeWidth={2.5} />
                        </button>
                        <div>
                            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">Jajanan Ready</h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inventory Management</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 shadow-sm shadow-emerald-50">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="text-[10px] font-black uppercase tracking-tighter">{readyCount} Aktif</span>
                    </div>
                </div>

                {/* SEARCH SECTION PREMIUM */}
                <div className="px-5 pb-5 mt-2">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} strokeWidth={2.5} />
                        <input
                            type="text"
                            placeholder="Cari jajanan untuk stok..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all shadow-sm"
                        />
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* LIST PRODUK PREMIUM */}
                {loading ? (
                    [1,2,3,4,5].map(i => <div key={i} className="h-24 bg-white rounded-3xl border border-slate-100 animate-pulse shadow-sm" />)
                ) : filteredProducts.length > 0 ? (
                    <div className="space-y-3 pb-10">
                        <div className="flex items-center gap-2 ml-1 mb-2">
                            <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Master Katalog</h3>
                        </div>
                        {filteredProducts.map((p) => {
                            const img = Array.isArray(p.image_url) ? p.image_url[0] : p.image_url;
                            const isReady = !!p.is_ready;

                            return (
                                <div
                                    key={p.id}
                                    onClick={() => toggleReady(p.id, isReady, p.name)}
                                    className={`bg-white p-4 rounded-[2rem] border shadow-sm flex items-center gap-4 transition-all duration-300 cursor-pointer group active:scale-95 ${isReady ? 'border-indigo-100 bg-indigo-50/10' : 'border-slate-50 hover:border-slate-200'}`}
                                >
                                    <div className={`w-20 h-20 rounded-2xl overflow-hidden shrink-0 border p-1 transition-all group-hover:rotate-1 ${isReady ? 'bg-indigo-50 border-indigo-100' : 'bg-slate-50 border-slate-100'}`}>
                                        <div className="w-full h-full rounded-xl overflow-hidden relative">
                                            {isReady && (
                                                <div className="absolute top-0 right-0 z-10 bg-indigo-600 text-white p-1 rounded-bl-xl shadow-lg border-b border-l border-indigo-400/30">
                                                    <Zap size={10} strokeWidth={3} className="fill-white" />
                                                </div>
                                            )}
                                            {img ? (
                                                <img src={img} className={`w-full h-full object-cover transition-transform duration-500 ${isReady ? 'scale-110' : 'group-hover:scale-105'}`} alt={p.name} />
                                            ) : (
                                                <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300"><ShoppingBag size={24} /></div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h3 className={`text-sm font-black truncate tracking-tight mb-1 transition-colors ${isReady ? 'text-indigo-900' : 'text-slate-800'}`}>{p.name}</h3>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[11px] font-black ${isReady ? 'text-indigo-600' : 'text-slate-400'}`}>Rp {p.price?.toLocaleString('id-ID')}</span>
                                            {p.stock > 0 && <span className="text-[9px] font-bold text-slate-300 bg-slate-50 px-2 rounded-full uppercase tracking-tighter">Stock: {p.stock}</span>}
                                        </div>
                                        
                                        <div className="mt-2 flex items-center gap-1.5 shadow-inner">
                                            {isReady ? (
                                                <div className="flex items-center gap-1 text-[9px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                                                    <Check size={10} strokeWidth={4} /> Tersedia
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-100">
                                                    Kosong
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="shrink-0">
                                        <div className={`w-12 h-6 rounded-full transition-all duration-500 flex items-center p-1 relative ${isReady ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                                            <div className={`bg-white w-4 h-4 rounded-full shadow-lg transition-all duration-500 flex items-center justify-center ${isReady ? 'translate-x-6' : 'translate-x-0'}`}>
                                                {processingId === p.id && <Loader2 size={10} className="animate-spin text-indigo-600" />}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="text-center py-24 bg-white rounded-[3rem] border border-dashed border-slate-100 flex flex-col items-center">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-5 text-slate-200">
                            <Package size={40} />
                        </div>
                        <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest">Katalog Kosong</h4>
                        <p className="text-[10px] text-slate-400 font-medium px-14 leading-relaxed tracking-tight text-center">Tidak ada produk yang ditemukan dalam pencarian Anda.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
