"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, Package } from "lucide-react"

export default function CategorySplitPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // 1. Ambil kategori (sekali saja)
  useEffect(() => {
    const fetchCats = async () => {
      const { data } = await supabase.from("categories").select("*").order("name")
      if (data && data.length > 0) {
        setCategories(data)
        setSelectedCat(data[0].id)
      }
    }
    fetchCats()
  }, [])

  // 2. Ambil produk saat kategori berubah
  useEffect(() => {
    if (!selectedCat) return

    const fetchProducts = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("category_id", selectedCat)
          .order('created_at', { ascending: false })

        if (error) throw error
        setProducts(data || [])
      } catch (error: any) {
        console.error("Gagal memuat produk:", error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [selectedCat])

  return (
    // Menggunakan h-[100dvh] untuk tinggi layar penuh yang akurat di mobile webview
    <div className="flex flex-col h-dvh bg-white max-w-md mx-auto font-sans text-slate-900">
      
      {/* HEADER - Statis di atas, tidak perlu fixed */}
      <header className="shrink-0 flex items-center h-14 px-4 border-b border-slate-100 bg-white z-10">
        <button onClick={() => router.back()} className="p-1 -ml-1 text-slate-700 active:scale-95 transition-transform">
          <ArrowLeft size={24} strokeWidth={2.5} />
        </button>
        <h1 className="ml-3 text-lg font-bold tracking-tight">Kategori</h1>
      </header>

      {/* BODY AREA - Flex 1 mengisi sisa layar */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* SIDEBAR KIRI - Scroll independen */}
        <aside className="shrink-0 w-18 bg-slate-50 border-r border-slate-100 overflow-y-auto no-scrollbar">
          {categories.map((cat) => {
            // Dynamic icon handling
            const IconComponent = (Icons as any)[cat.icon_name] || Package
            const isActive = selectedCat === cat.id
            
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCat(cat.id)}
                className={`w-full py-3.5 flex flex-col items-center gap-1 transition-colors relative touch-manipulation ${
                  isActive ? "bg-white" : "bg-transparent"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 bg-indigo-600 rounded-r-full" />
                )}
                <div className={`p-1.5 rounded-lg transition-colors ${
                  isActive ? "bg-indigo-600 text-white" : "bg-slate-200/60 text-slate-500"
                }`}>
                  <IconComponent size={18} />
                </div>
                <span className={`text-[10px] font-semibold leading-tight line-clamp-2 px-1 text-center transition-colors ${
                  isActive ? "text-indigo-600" : "text-slate-500"
                }`}>
                  {cat.name}
                </span>
              </button>
            )
          })}
        </aside>

        {/* KONTEN KANAN - Scroll independen */}
        <main className="flex-1 overflow-y-auto bg-slate-50/50 pb-6">
          <div className="p-4">
            {/* Judul Kategori */}
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 px-1">
              {categories.find(c => c.id === selectedCat)?.name || "Produk"}
            </h2>

            {loading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
              </div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {products.map((p) => (
                  <Link 
                    href={`/product/${p.id}`} 
                    key={p.id} 
                    className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm active:scale-[0.98] transition-transform"
                  >
                    <div className="aspect-square bg-slate-100 relative">
                      <img 
                        src={Array.isArray(p.image_url) ? p.image_url[0] : p.image_url} 
                        className="w-full h-full object-cover" 
                        alt={p.name}
                        loading="lazy" // Optimasi: Lazy load gambar
                      />
                    </div>
                    <div className="p-2.5">
                      <h3 className="text-[13px] font-medium text-slate-800 line-clamp-2 leading-tight mb-1">
                        {p.name}
                      </h3>
                      <p className="text-sm font-bold text-slate-900">
                        Rp {p.price?.toLocaleString('id-ID')}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-slate-400 text-sm">
                Tidak ada produk
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}