"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import Link from "next/link"

export default function CategorySplitPage() {
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // 1. Ambil semua kategori untuk sidebar kiri
  useEffect(() => {
    const fetchCats = async () => {
      const { data } = await supabase.from("categories").select("*").order("name")
      if (data && data.length > 0) {
        setCategories(data)
        setSelectedCat(data[0].id) // Default pilih kategori pertama
      }
    }
    fetchCats()
  }, [])

  // 2. Ambil produk setiap kali kategori di kiri diklik
  useEffect(() => {
    if (!selectedCat) return
    
    const fetchProducts = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from("product_categories")
        .select(`products (*)`)
        .eq("category_id", selectedCat)

      if (!error && data) {
        setProducts(data.map((item: any) => item.products).filter(p => p !== null))
      }
      setLoading(false)
    }
    fetchProducts()
  }, [selectedCat])

  return (
    <div className="flex h-screen bg-white max-w-md mx-auto overflow-hidden font-sans">
      
      {/* SIDEBAR KIRI (Daftar Kategori) */}
      <div className="w-24 bg-gray-50 border-r border-gray-100 overflow-y-auto no-scrollbar pb-24">
        {categories.map((cat) => {
          const Icon = (Icons as any)[cat.icon_name] || Icons.Package
          const isActive = selectedCat === cat.id

          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCat(cat.id)}
              className={`w-full py-4 px-1 flex flex-col items-center gap-1 transition-all relative ${
                isActive ? "bg-white" : "bg-transparent"
              }`}
            >
              {/* Indikator Garis Aktif */}
              {isActive && (
                <div className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-indigo-600 rounded-r-full" />
              )}
              
              <div className={`p-2 rounded-xl transition-all ${
                isActive ? "bg-indigo-50 text-indigo-600" : "text-gray-400"
              }`}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[9px] font-black text-center leading-tight uppercase tracking-tighter ${
                isActive ? "text-indigo-600" : "text-gray-400"
              }`}>
                {cat.name}
              </span>
            </button>
          )
        })}
      </div>

      {/* KONTEN KANAN (Daftar Produk) */}
      <div className="flex-1 overflow-y-auto pb-24 px-3 pt-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-black uppercase tracking-widest text-gray-800">
            {categories.find(c => c.id === selectedCat)?.name || "Kategori"}
          </h2>
          <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {products.length} Item
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 opacity-20">
            <Icons.Loader2 size={24} className="animate-spin text-indigo-600 mb-2" />
            <span className="text-[8px] font-black uppercase">Loading...</span>
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-1 gap-3">
            {products.map((p) => (
              <Link 
                href={`/product/${p.id}`} 
                key={p.id}
                className="flex gap-3 bg-white border border-gray-100 p-2 rounded-2xl active:scale-[0.98] transition-all"
              >
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-50 shrink-0">
                  <img 
                    src={Array.isArray(p.image_url) ? p.image_url[0] : p.image_url} 
                    className="w-full h-full object-cover" 
                    alt={p.name} 
                  />
                </div>
                <div className="flex flex-col justify-center min-w-0">
                  <h3 className="text-[11px] font-bold text-gray-800 truncate">{p.name}</h3>
                  <p className="text-indigo-600 font-black text-xs mt-0.5">
                    Rp {p.price?.toLocaleString('id-ID')}
                  </p>
                  <div className="flex items-center gap-1 mt-1 opacity-50">
                    <Icons.MapPin size={8} />
                    <span className="text-[8px] font-bold truncate">{p.location || "Lokal"}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="bg-gray-50 p-4 rounded-full mb-3">
              <Icons.BoxSelect size={32} className="text-gray-200" />
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase px-4">Belum ada produk di kategori ini, Lur.</p>
          </div>
        )}
      </div>
    </div>
  )
}