"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Trash2, Tag, Zap, Plus, ArrowLeft, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function ManageFlashSalePage() {
  const router = useRouter()
  const [flashProducts, setFlashProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)

  // 1. Ambil data produk flash sale
  const fetchFlashProducts = async () => {
    setLoading(true)
    const { data } = await supabase
      .from("products")
      .select("id, name, price, original_price, sold_count")
      .eq("is_flash_sale", true)
    
    if (data) setFlashProducts(data)
    setLoading(false)
  }

  useEffect(() => {
    fetchFlashProducts()
  }, [])

  // 2. Hapus dari Flash Sale
  const removeFromFlashSale = async (id: string, name: string) => {
    if (!confirm(`Hentikan promosi Flash Sale untuk "${name}"?`)) return
    
    setProcessingId(id)
    const { error } = await supabase
      .from("products")
      .update({ is_flash_sale: false })
      .eq("id", id)

    if (error) {
      alert("Gagal mengupdate: " + error.message)
    } else {
      // Optimistic Update: Hapus dari state lokal
      setFlashProducts(prev => prev.filter(p => p.id !== id))
    }
    setProcessingId(null)
  }

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
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Flash Sale Aktif</h1>
              <p className="text-[10px] font-medium text-slate-400">Kelola produk promosi</p>
            </div>
          </div>
          
          {/* Badge Jumlah Item */}
          <span className="px-3 py-1 bg-orange-50 text-orange-600 text-[10px] font-bold rounded-full border border-orange-100">
            {flashProducts.length} Item
          </span>
        </div>
      </div>

      <div className="p-5 space-y-4">
        
        {/* Tombol Tambah (Link ke halaman form sebelumnya) */}
        <Link 
          href="/admin/add-banner" 
          className="flex items-center justify-center gap-2 w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-xl font-bold text-sm transition-all active:scale-[0.98] shadow-sm shadow-orange-100"
        >
          <Plus size={18} />
          <span>Tambah Produk Promo</span>
        </Link>

        {/* LIST PRODUK */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="animate-spin mb-3" size={28} />
            <p className="text-xs font-medium">Memuat data promo...</p>
          </div>
        ) : flashProducts.length > 0 ? (
          <div className="space-y-3">
            {flashProducts.map((product) => (
              <div 
                key={product.id} 
                className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-orange-200 transition-colors"
              >
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-slate-800 truncate">{product.name}</h3>
                    <Zap size={12} className="text-orange-500 shrink-0 fill-orange-500" />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-orange-600">
                      Rp {product.price?.toLocaleString('id-ID')}
                    </p>
                    {product.original_price && (
                      <p className="text-[10px] text-slate-400 line-through">
                        Rp {product.original_price?.toLocaleString('id-ID')}
                      </p>
                    )}
                  </div>
                  
                  {product.sold_count && (
                     <p className="text-[10px] text-slate-400 mt-1">{product.sold_count} terjual</p>
                  )}
                </div>

                {/* Tombol Aksi */}
                <button 
                  onClick={() => removeFromFlashSale(product.id, product.name)}
                  disabled={processingId === product.id}
                  className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all shrink-0 disabled:opacity-50"
                  title="Hentikan Promosi"
                >
                  {processingId === product.id ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Trash2 size={18} />
                  )}
                </button>
              </div>
            ))}
          </div>
        ) : (
          /* EMPTY STATE */
          <div className="text-center py-16 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl mt-4 bg-white">
            <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <Tag size={24} className="text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">Belum Ada Promo</p>
            <p className="text-xs text-slate-400">Tekan tombol di atas untuk memulai.</p>
          </div>
        )}
      </div>
    </div>
  )
}