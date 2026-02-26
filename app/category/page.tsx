"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2 } from "lucide-react"

export default function CategorySplitPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // 1. Ambil semua kategori
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
// 2. Ambil produk berdasarkan kategori
useEffect(() => {
  // Jika category belum dipilih, kita kosongkan produk atau bisa juga ambil semua
  if (!selectedCat) {
    setProducts([]);
    return;
  }
  
  const fetchProducts = async () => {
    setLoading(true);
    
    try {
      // Menggunakan query direct relation karena sudah nempel di tabel products
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("category_id", selectedCat)
        .order('created_at', { ascending: false }); // Biar produk terbaru di atas

      if (error) throw error;
      
      setProducts(data || []);
    } catch (error: any) {
      console.error("Waduh, gagal narik produk:", error.message);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  fetchProducts();
}, [selectedCat]);
  return (
    <div className="flex flex-col h-screen bg-white max-w-md mx-auto overflow-hidden font-sans">
      
      {/* HEADER */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-20 shrink-0">
        <div className="flex items-center gap-3 px-5 pt-12 pb-3">
            <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                <ArrowLeft size={20} strokeWidth={2.5} />
            </button>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Kategori</h1>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="flex flex-1 overflow-hidden">
        
        {/* SIDEBAR KIRI */}
        <div className="w-[85px] bg-slate-50 border-r border-slate-100 overflow-y-auto no-scrollbar shrink-0">
          {categories.map((cat) => {
            const Icon = (Icons as any)[cat.icon_name] || Icons.Package
            const isActive = selectedCat === cat.id

            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCat(cat.id)}
                className={`w-full py-4 px-2 flex flex-col items-center gap-1.5 transition-all relative group
                  ${isActive ? "bg-white" : "bg-transparent hover:bg-slate-100"}
                `}
              >
                {/* Indikator Aktif (Pill vertikal di kiri) */}
                {isActive && (
                  <div className="absolute left-0 top-3 bottom-3 w-1 bg-slate-900 rounded-r-full" />
                )}
                
                <div className={`p-2 rounded-xl transition-all duration-200
                  ${isActive ? "bg-slate-900 text-white shadow-sm" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"}
                `}>
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={`text-[9px] font-bold text-center leading-tight uppercase tracking-tight line-clamp-2
                  ${isActive ? "text-slate-900" : "text-slate-400"}
                `}>
                  {cat.name}
                </span>
              </button>
            )
          })}
        </div>

        {/* KONTEN KANAN (Daftar Produk) */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 pb-20">
          <div className="p-4">
            {/* Header Kategori Terpilih */}
            <div className="flex items-center justify-between mb-4 px-1">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                    {categories.find(c => c.id === selectedCat)?.name || "Produk"}
                </h2>
                <span className="text-[10px] font-semibold text-slate-400">
                    {products.length} Item
                </span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Loader2 size={28} className="animate-spin mb-3" />
                <p className="text-xs font-medium">Memuat produk...</p>
              </div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {products.map((p) => (
                  <Link 
                    href={`/product/${p.id}`} 
                    key={p.id}
                    className="bg-white rounded-xl border border-slate-100 overflow-hidden group hover:shadow-sm transition-all"
                  >
                    <div className="aspect-square relative bg-slate-100 overflow-hidden">
                      <img 
                        src={Array.isArray(p.image_url) ? p.image_url[0] : p.image_url} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                        alt={p.name} 
                      />
                    </div>
                    <div className="p-3">
                      <h3 className="text-xs font-semibold text-slate-800 line-clamp-2 leading-tight min-h-[32px]">{p.name}</h3>
                      <p className="text-sm font-bold text-slate-900 mt-1">
                        Rp {p.price?.toLocaleString('id-ID')}
                      </p>
                      <div className="flex items-center gap-1 mt-1.5 text-slate-400">
                        <Icons.MapPin size={10} />
                        <span className="text-[9px] font-medium truncate">{p.location || "Lokal"}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <Icons.BoxSelect size={28} className="text-slate-300" />
                </div>
                <p className="text-sm font-semibold text-slate-700">Kategori Kosong</p>
                <p className="text-xs text-slate-400 mt-1">Belum ada produk di sini.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}