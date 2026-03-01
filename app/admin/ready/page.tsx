"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { ArrowLeft, Loader2, Search, Package } from "lucide-react"
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
            toast.success(newStatus ? "Berhasil ditandai Ready Stock" : "Status Ready dihapus")
        }
        setProcessingId(null)
    }

    const filteredProducts = products.filter(p =>
        (p.name || "").toLowerCase().includes((searchQuery || "").toLowerCase())
    )

    const readyCount = products.filter(p => p.is_ready).length

    return (
        <div className="min-h-screen bg-slate-50/80 font-sans max-w-md mx-auto pb-10">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
                <div className="flex items-center justify-between px-5 pt-12 pb-4">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                            <ArrowLeft size={20} strokeWidth={2.5} />
                        </button>
                        <div>
                            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Jajanan Ready Stok</h1>
                            <p className="text-[10px] font-medium text-slate-400">Atur status ready untuk jajanan</p>
                        </div>
                    </div>
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-full border border-emerald-100">
                        {readyCount} Ready
                    </span>
                </div>

                {/* SEARCH SECTION */}
                <div className="px-5 pb-4 mt-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Cari jajanan untuk ditandai ready..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-sm"
                        />
                    </div>
                </div>
            </div>

            <div className="p-5">
                {/* LIST PRODUK */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Loader2 className="animate-spin mb-3" size={28} />
                        <p className="text-xs font-medium">Memuat data produk...</p>
                    </div>
                ) : filteredProducts.length > 0 ? (
                    <div className="space-y-3">
                        {filteredProducts.map((p) => {
                            const img = Array.isArray(p.image_url) ? p.image_url[0] : p.image_url;
                            return (
                                <div
                                    key={p.id}
                                    className={`bg-white p-3 rounded-xl border shadow-sm flex items-center gap-4 transition-all duration-300 ${p.is_ready ? 'border-emerald-200 shadow-emerald-50/50' : 'border-slate-100'}`}
                                >
                                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-50 shrink-0 border border-slate-100 relative">
                                        {p.is_ready && (
                                            <div className="absolute top-1 left-1 z-10 bg-emerald-500 text-white rounded-sm px-1 py-0.5 text-[8px] font-bold shadow-sm">
                                                READY
                                            </div>
                                        )}
                                        <img src={img} className="w-full h-full object-cover" alt={p.name} />
                                    </div>

                                    <div className="flex-1 min-w-0 pr-2">
                                        <h3 className="text-sm font-semibold text-slate-800 truncate mb-0.5">{p.name}</h3>
                                        <p className="text-xs font-bold text-slate-900">Rp {p.price?.toLocaleString('id-ID')}</p>
                                        <p className="text-[10px] text-slate-400 mt-1 font-medium">Stok: {p.stock || 0}</p>
                                    </div>

                                    <div className="flex flex-col items-end gap-1 shrink-0">
                                        <button
                                            onClick={() => toggleReady(p.id, !!p.is_ready, p.name)}
                                            disabled={processingId === p.id}
                                            className={`relative w-12 h-6 rounded-full transition-all duration-300 flex items-center ${p.is_ready ? 'bg-emerald-500' : 'bg-slate-200'}`}
                                        >
                                            <div className={`absolute top-1 bg-white w-4 h-4 rounded-full shadow-sm transition-all duration-300 flex items-center justify-center ${p.is_ready ? 'left-7' : 'left-1'}`}>
                                                {processingId === p.id && <Loader2 size={10} className="animate-spin text-indigo-500" />}
                                            </div>
                                        </button>
                                        <span className={`text-[9px] font-bold ${p.is_ready ? 'text-emerald-500' : 'text-slate-400'}`}>
                                            {p.is_ready ? 'Ready' : 'Set Ready'}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <div className="text-center py-16 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl mt-4 bg-white">
                        <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                            <Package size={24} className="text-slate-300" />
                        </div>
                        <p className="text-sm font-semibold text-slate-700 mb-1">Tidak Ada Produk Ditemukan</p>
                        <p className="text-xs text-slate-400">Coba kata kunci pencarian yang lain.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
