"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft, Edit3, Trash2, Plus, Loader2, Package, Image as ImageIcon, Search, ChevronRight, ShoppingBag, Zap, Hash
} from "lucide-react"
import { toast } from "sonner"

export default function ManageProductsPage() {
  const router = useRouter()
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  const fetchData = async () => {
    setLoading(true)
    const { data: prod } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })

    if (prod) setProducts(prod)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus produk "${name}" secara permanen?`)) return

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)

    if (!error) {
      setProducts(prev => prev.filter(p => p.id !== id))
      toast.success(`Produk "${name}" dihapus`)
    } else {
      toast.error("Gagal menghapus: " + error.message)
    }
  }

  const filteredProducts = products.filter(p => 
    (p.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-slate-50 font-sans max-w-md mx-auto relative pb-24 selection:bg-indigo-100">

      {/* HEADER PREMIUM */}
      <div className="bg-white sticky top-0 z-40 border-b border-slate-100/60 backdrop-blur-md bg-white/80">
        <div className="px-5 pt-12 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/admin')} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
              <ArrowLeft size={20} strokeWidth={2.5} />
            </button>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">Katalog Produk</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{products.length} Item Terdaftar</p>
            </div>
          </div>

          <Link
            href="/admin/add-product/detail"
            className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
          >
            <Plus size={14} strokeWidth={3} />
            <span>Baru</span>
          </Link>
        </div>

        {/* SEARCH PREMIUM */}
        <div className="px-5 pb-5">
           <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} strokeWidth={2.5} />
                <input
                    type="text"
                    placeholder="Cari produk di stok..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all shadow-sm"
                />
            </div>
        </div>
      </div>

      {/* CONTENT PREMIUM */}
      <div className="p-4 space-y-4">
        {loading ? (
          [1,2,3,4].map(i => <div key={i} className="h-28 bg-white rounded-[2rem] border border-slate-100 animate-pulse shadow-sm" />)
        ) : filteredProducts.length > 0 ? (
          <div className="space-y-3 pb-12">
            <div className="flex items-center gap-2 ml-1 mb-1">
                <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Daftar Inventori</h3>
            </div>
            {filteredProducts.map((p) => {
              const firstImage = Array.isArray(p.image_url) ? p.image_url[0] : p.image_url;

              return (
                <div
                  key={p.id}
                  className="bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4 hover:border-indigo-100 transition-all duration-300 group"
                >
                  <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-50 shrink-0 border border-slate-100 p-1 group-hover:rotate-2 transition-transform">
                    <div className="w-full h-full rounded-xl overflow-hidden relative">
                        {p.is_flash_sale && (
                             <div className="absolute top-0 right-0 z-10 bg-orange-500 text-white p-1 rounded-bl-lg shadow-sm">
                                <Zap size={10} className="fill-white" />
                             </div>
                        )}
                        {firstImage ? (
                            <img
                            src={firstImage}
                            className="w-full h-full object-cover"
                            alt={p.name}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-200">
                                <ShoppingBag size={24} />
                            </div>
                        )}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-black text-slate-800 truncate tracking-tight mb-1">{p.name}</h4>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-black text-indigo-600">
                            Rp {p.price?.toLocaleString('id-ID')}
                        </span>
                        {p.original_price && (
                            <span className="text-[10px] text-slate-300 line-through font-bold">
                                Rp {p.original_price?.toLocaleString('id-ID')}
                            </span>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                         <div className="flex items-center gap-1 px-2 py-0.5 bg-slate-50 text-[9px] font-black uppercase tracking-tighter rounded-lg text-slate-400 border border-slate-100">
                            <Hash size={10} /> Stok: {p.stock || 0}
                         </div>
                         {p.is_ready && (
                            <div className="px-2 py-0.5 bg-emerald-50 text-[9px] font-black uppercase tracking-tighter rounded-lg text-emerald-600 border border-emerald-100 italic">
                                Ready
                            </div>
                         )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={() => router.push(`/admin/add-product/${p.id}`)}
                      className="p-2.5 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all border border-transparent hover:border-indigo-100 shadow-sm"
                    >
                      <Edit3 size={18} strokeWidth={2.5} />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id, p.name)}
                      className="p-2.5 bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all border border-transparent hover:border-red-100 shadow-sm"
                    >
                      <Trash2 size={18} strokeWidth={2.5} />
                    </button>
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
            <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest">Gudang Kosong</h4>
            <p className="text-[10px] text-slate-400 font-medium px-14 leading-relaxed tracking-tight text-center mb-8">Anda belum memiliki produk terdaftar. Tambah sekarang untuk mulai berjualan.</p>
            <Link
              href="/admin/add-product/detail"
              className="bg-indigo-600 text-white px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center gap-2"
            >
              <Plus size={16} strokeWidth={3} />
              Tambah Produk
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}