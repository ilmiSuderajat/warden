"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Image as ImageIcon, Search, Tag, Loader2, Check, Package, Zap, CheckCircle, X, Plus } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function AdminFlashSalePage() {
  const router = useRouter()
  const [products, setProducts] = useState<any[]>([])
  const [selectedProduct, setSelectedProduct] = useState<any>(null) // Simpan objek produk utuh
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  const [flashData, setFlashData] = useState({
    price: "",
    original_price: "",
    sold_count: "",
  })

  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase.from("products").select("id, name, price").order("name")
      if (data) setProducts(data)
    }
    fetchProducts()
  }, [])

  // Logika Filter Pencarian
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 10) // Batasi hasil 10 teratas agar tidak terlalu panjang

  const handleSelectProduct = (product: any) => {
    setSelectedProduct(product)
    setSearchQuery("") // Reset search
    // Isi otomatis harga asli
    setFlashData(prev => ({ ...prev, original_price: product.price?.toString() || "" }))
  }

  const handleRemoveSelection = () => {
    setSelectedProduct(null)
    setFlashData({ price: "", original_price: "", sold_count: "" })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProduct) return toast.error("Pilih produk terlebih dahulu!")

    setLoading(true)

    const { error } = await supabase
      .from("products")
      .update({
        is_flash_sale: true,
        price: parseFloat(flashData.price),
        original_price: parseFloat(flashData.original_price),
        sold_count: parseInt(flashData.sold_count)
      })
      .eq("id", selectedProduct.id)

    setLoading(false)

    if (error) {
      toast.error("Gagal menyimpan: " + error.message)
    } else {
      toast.success("Produk berhasil ditandai sebagai Flash Sale!");
      handleRemoveSelection()
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/80 font-sans max-w-md mx-auto pb-10">

      {/* HEADER */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="flex items-center gap-3 px-5 pt-12 pb-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Pengaturan Flash Sale</h1>
            <p className="text-[10px] font-medium text-slate-400">Promosikan produk unggulan</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-5">

        {/* CARD 1: PILIH PRODUK (DENGAN SEARCH) */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-lg text-orange-500">
              <Zap size={18} />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Pilih Produk</h3>
          </div>

          {/* Jika Produk Sudah Dipilih */}
          {selectedProduct ? (
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg text-slate-500 border border-slate-100">
                  <CheckCircle size={16} className="text-green-500" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-700">{selectedProduct.name}</p>
                  <p className="text-[10px] text-slate-400">ID: {selectedProduct.id.slice(0, 8)}...</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveSelection}
                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <>
              {/* Input Search */}
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ketik nama produk..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-slate-900 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Hasil Pencarian */}
              {searchQuery && (
                <div className="border border-slate-100 rounded-xl overflow-hidden divide-y divide-slate-50 bg-slate-50/50">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map(p => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => handleSelectProduct(p)}
                        className="w-full text-left px-3 py-2.5 text-xs font-medium text-slate-600 hover:bg-white hover:text-slate-900 transition-colors flex items-center justify-between group"
                      >
                        <span>{p.name}</span>
                        <Plus size={14} className="text-slate-300 group-hover:text-orange-500" />
                      </button>
                    ))
                  ) : (
                    <p className="p-4 text-center text-xs text-slate-400">Produk tidak ditemukan.</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* CARD 2: HARGA & DATA (Hanya muncul jika produk sudah dipilih) */}
        {selectedProduct && (
          <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 rounded-lg text-indigo-500">
                <Tag size={18} />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Detail Penawaran</h3>
            </div>

            <div className="space-y-3">
              {/* Harga Flash Sale */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                  Harga Flash Sale (Rp)
                </label>
                <input
                  type="number"
                  placeholder="Contoh: 75000"
                  className="w-full px-4 py-3 bg-white border border-orange-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-orange-500 transition-all placeholder:text-slate-300"
                  required
                  value={flashData.price}
                  onChange={e => setFlashData({ ...flashData, price: e.target.value })}
                />
              </div>

              {/* Harga Normal (Coret) */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                  Harga Asli / Coret (Rp)
                </label>
                <input
                  type="number"
                  placeholder="Contoh: 100000"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-slate-900 transition-all placeholder:text-slate-300"
                  required
                  value={flashData.original_price}
                  onChange={e => setFlashData({ ...flashData, original_price: e.target.value })}
                />
              </div>

              {/* Simulasi Terjual */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                  Simulasi Terjual (Opsional)
                </label>
                <input
                  type="number"
                  placeholder="Contoh: 50"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-slate-900 transition-all placeholder:text-slate-300"
                  value={flashData.sold_count}
                  onChange={e => setFlashData({ ...flashData, sold_count: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        {/* SUBMIT BUTTON */}
        <button
          type="submit"
          disabled={loading || !selectedProduct}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:bg-orange-200 disabled:cursor-not-allowed shadow-sm shadow-orange-100 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>Menyimpan...</span>
            </>
          ) : (
            <>
              <Zap size={18} />
              <span>Aktifkan Flash Sale</span>
            </>
          )}
        </button>
      </form>
    </div>
  )
}