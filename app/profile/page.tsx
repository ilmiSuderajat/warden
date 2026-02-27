"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, Package } from "lucide-react"
import dynamic from 'next/dynamic'
import dynamicIconImports from 'lucide-react/dynamicIconImports'

// --- DYNAMIC ICON COMPONENT ---
// Menghilangkan import * as Icons agar memori HP irit
const DynamicIcon = ({ name, size = 18 }: { name: string; size?: number }) => {
  const Icon = dynamic<any>(
    (dynamicIconImports as any)[name] || (() => Promise.resolve(Package)),
    { ssr: false, loading: () => <div style={{ width: size, height: size }} className="bg-slate-100 animate-pulse rounded" /> }
  )
  return <Icon size={size} />
}

export default function CategorySplitPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

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
      } catch (error) {
        setProducts([])
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [selectedCat])

  return (
    <div className="bg-slate-50 max-w-md mx-auto font-sans text-slate-900">
      
      {/* HEADER FIXED */}
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-center bg-white">
        <div className="w-full max-w-md h-14 flex items-center px-4 border-b border-slate-100">
          <button 
            onClick={() => router.back()} 
            className="p-1 -ml-1 text-slate-700 active:scale-95 transition-transform"
          >
            <ArrowLeft size={24} strokeWidth={2.5} />
          </button>
          <h1 className="ml-3 text-lg font-bold tracking-tight">Kategori</h1>
        </div>
      </header>

      {/* SIDEBAR FIXED */}
      <aside className="fixed top-14 left-0 bottom-0 w-18 bg-white border-r border-slate-100 z-40 overflow-y-auto no-scrollbar">
        <div className="py-2">
          {categories.map((cat) => {
            const isActive = selectedCat === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCat(cat.id)}
                className={`w-full py-3 flex flex-col items-center gap-1 relative transition-colors ${
                  isActive ? "bg-indigo-50" : "bg-transparent"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 bg-indigo-600 rounded-r-full" />
                )}
                <div className={`p-1.5 rounded-lg transition-colors ${
                  isActive ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" : "bg-slate-100 text-slate-500"
                }`}>
                  {/* Panggil DynamicIcon di sini */}
                  <DynamicIcon name={cat.icon_name} size={18} />
                </div>
                <span className={`text-[10px] font-semibold leading-tight line-clamp-2 px-1 text-center ${
                  isActive ? "text-indigo-600" : "text-slate-500"
                }`}>
                  {cat.name}
                </span>
              </button>
            )
          })}
        </div>
      </aside>

      {/* KONTEN KANAN */}
      <main className="pl-18 pt-14 min-h-screen bg-slate-50/50 pb-10">
        <div className="p-4">
          <div className="mb-4 px-1">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {categories.find(c => c.id === selectedCat)?.name || "Produk"}
            </h2>
          </div>

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
                  className="bg-white rounded-xl border border-slate-100 overflow-hidden active:scale-[0.98] transition-all shadow-sm"
                >
                  <div className="aspect-square bg-slate-100 relative overflow-hidden">
                    <img
                      src={Array.isArray(p.image_url) ? p.image_url[0] : p.image_url}
                      className="w-full h-full object-cover"
                      alt={p.name}
                      loading="lazy"
                    />
                  </div>
                  <div className="p-2.5">
                    <h3 className="text-[13px] font-medium text-slate-800 line-clamp-2 leading-tight mb-1">
                      {p.name}
                    </h3>
                    <p className="text-sm font-bold text-indigo-600">
                      Rp {p.price?.toLocaleString('id-ID')}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400 text-sm">Produk Kosong</div>
          )}
        </div>
      </main>
    </div>
  )
}