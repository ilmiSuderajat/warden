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
  // Ganti h-screen jadi min-h-screen dan hilangkan overflow-hidden di luar
  <div className="flex flex-col min-h-screen bg-white max-w-md mx-auto font-sans relative">
    
    {/* HEADER - Tetap Sticky */}
    <div className="bg-white border-b border-slate-100 sticky top-0 z-30">
      <div className="flex items-center gap-3 px-5 pt-12 pb-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600">
              <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Kategori</h1>
      </div>
    </div>

    {/* CONTENT AREA - Gunakan fixed height atau flex-grow tanpa overflow luar */}
    <div className="flex flex-1 relative">
      
      {/* SIDEBAR KIRI - Kasih tinggi tetap (calc) agar bisa scroll sendiri */}
      <div className="w-20 bg-slate-50 border-r border-slate-100 sticky top-32 h-[calc(100vh-92px)] overflow-y-auto no-scrollbar">
        {categories.map((cat) => {
          const Icon = (Icons as any)[cat.icon_name] || Icons.Package
          const isActive = selectedCat === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCat(cat.id)}
              className={`w-full py-4 px-2 flex flex-col items-center gap-1.5 transition-all relative ${isActive ? "bg-white" : "bg-transparent"}`}
            >
              {isActive && <div className="absolute left-0 top-3 bottom-3 w-1 bg-indigo-600 rounded-r-full" />}
              <div className={`p-2 rounded-xl ${isActive ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                <Icon size={18} />
              </div>
              <span className={`text-[9px] font-bold uppercase ${isActive ? "text-indigo-600" : "text-slate-400"}`}>
                {cat.name}
              </span>
            </button>
          )
        })}
      </div>

      {/* KONTEN KANAN - Biarkan mengalir atau scroll sendiri */}
      <div className="flex-1 bg-slate-50/50 min-h-[calc(100vh-92px)] pb-24">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4 px-1">
              <h2 className="text-xs font-bold text-slate-500 uppercase">
                  {categories.find(c => c.id === selectedCat)?.name || "Produk"}
              </h2>
          </div>

          {loading ? (
             <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {products.map((p) => (
                <Link href={`/product/${p.id}`} key={p.id} className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
                  <div className="aspect-square bg-slate-100">
                    <img src={Array.isArray(p.image_url) ? p.image_url[0] : p.image_url} className="w-full h-full object-cover" alt={p.name} />
                  </div>
                  <div className="p-3">
                    <h3 className="text-xs font-semibold text-slate-800 line-clamp-2">{p.name}</h3>
                    <p className="text-sm font-bold text-slate-900 mt-1">Rp {p.price?.toLocaleString('id-ID')}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 text-slate-400 text-xs">Produk Kosong</div>
          )}
        </div>
      </div>
    </div>
  </div>
)}