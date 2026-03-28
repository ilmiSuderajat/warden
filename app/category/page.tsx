"use client"

import { useEffect, useState, useRef, Suspense } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, Loader2, Package, MapPin } from "lucide-react"
import ProductCardSkeleton from "../components/ProductCardSkeleton"
import { calculateDistance, formatDistance } from "@/lib/geo"
import { useUserLocation } from "@/hooks/useUserLocation"

function CategoryContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialCatId = searchParams.get("id")

  const [categories, setCategories] = useState<any[]>([])
  const [selectedCat, setSelectedCat] = useState<string | null>(initialCatId || null)
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const { location: userLoc } = useUserLocation()
  
  const loaderRef = useRef<HTMLDivElement>(null)
  const PAGE_SIZE = 8

  // 1. Fetch Kategori
  useEffect(() => {
    const fetchCats = async () => {
      const { data } = await supabase.from("categories").select("*").order("name")
      if (data && data.length > 0) {
        setCategories(data)
        if (!initialCatId) {
          setSelectedCat(data[0].id)
        }
      }
    }
    fetchCats()
  }, [initialCatId])

  const fetchProducts = async (catId: string, pageNum: number) => {
    if (pageNum === 0) setLoading(true)
    else setIsFetchingMore(true)

    const from = pageNum * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("category_id", catId)
        .eq("is_ready", true)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) throw error

      if (data) {
        if (pageNum === 0) {
          setProducts(data)
        } else {
          setProducts(prev => [...prev, ...data])
        }
        setHasMore(data.length === PAGE_SIZE)
      }
    } catch (err) {
      console.error("Error fetching products:", err)
      if (pageNum === 0) setProducts([])
    } finally {
      setLoading(false)
      setIsFetchingMore(false)
    }
  }

  // 2. Fetch data saat kategori berubah
  useEffect(() => {
    if (!selectedCat) return
    setPage(0)
    setHasMore(true)
    fetchProducts(selectedCat, 0)
    
    // Sinkronkan URL agar bisa dibagikan (ubah ?id=xxx tanpa refresh)
    const newUrl = new URL(window.location.href)
    newUrl.searchParams.set("id", selectedCat)
    window.history.replaceState({}, '', newUrl.toString())
    
  }, [selectedCat])

  // 3. Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !isFetchingMore && selectedCat) {
          const nextPage = page + 1
          setPage(nextPage)
          fetchProducts(selectedCat, nextPage)
        }
      },
      { threshold: 1.0 }
    )

    if (loaderRef.current) {
      observer.observe(loaderRef.current)
    }

    return () => observer.disconnect()
  }, [hasMore, loading, isFetchingMore, page, selectedCat])

  const currentCategoryName = categories.find(c => c.id === selectedCat)?.name || "Produk"

  return (
    <div className="bg-zinc-50 max-w-md mx-auto font-sans text-zinc-900 h-screen overflow-hidden flex flex-col">
      {/* FLOATING HEADER */}
      <header className="flex-none bg-white/80 backdrop-blur-lg border-b border-zinc-100/80 z-50">
        <div className="w-full h-14 flex items-center px-4">
          <button
            onClick={() => router.push("/")}
            className="p-2 -ml-2 text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors shrink-0"
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <div className="ml-2 flex-1 min-w-0">
             <h1 className="text-base font-bold tracking-tight text-zinc-900 truncate">Kategori</h1>
             {categories.length > 0 && (
                <p className="text-[10px] text-zinc-400 font-medium -mt-0.5 uppercase tracking-wider">{categories.length} Kategori Tersedia</p>
             )}
          </div>
        </div>
      </header>

      {/* BODY CONTENT (Split) */}
      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR (Kiri) */}
        <aside className="w-[85px] bg-white border-r border-zinc-100/80 overflow-y-auto no-scrollbar py-3 z-40 shrink-0 shadow-[2px_0_8px_rgba(0,0,0,0.02)]">
          <div className="flex flex-col gap-1.5 px-2">
            {categories.map((cat) => {
              const Icon = (Icons as any)[cat.icon_name] || Package
              const isActive = selectedCat === cat.id

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCat(cat.id)}
                  className={`w-full py-3 px-1.5 flex flex-col items-center justify-center gap-1.5 rounded-2xl relative transition-all active:scale-95 ${isActive ? "bg-zinc-900 shadow-md shadow-zinc-900/10" : "bg-transparent hover:bg-zinc-50"
                    }`}
                >
                  <div className={`transition-colors ${isActive ? "text-white" : "text-zinc-400"
                    }`}>
                    <Icon size={20} className={isActive ? "drop-shadow-sm" : ""} strokeWidth={isActive ? 2.5 : 2} />
                  </div>
                  <span className={`text-[10px] font-bold leading-tight line-clamp-2 px-1 text-center truncate w-full ${isActive ? "text-white" : "text-zinc-500"
                    }`}>
                    {cat.name}
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        {/* KONTEN KANAN */}
        <main className="flex-1 overflow-y-auto bg-zinc-50/50 relative">
          {/* Header Konten Kanan */}
          <div className="sticky top-0 z-30 bg-zinc-50/90 backdrop-blur-md px-4 py-3 flex items-center gap-2 border-b border-zinc-100/50">
             <div className="w-1 h-3.5 bg-indigo-500 rounded-full" />
             <h2 className="text-xs font-bold text-zinc-800 uppercase tracking-widest truncate flex-1">
               {currentCategoryName}
             </h2>
          </div>

          <div className="p-3">
            {loading && products.length === 0 ? (
              <div className="grid grid-cols-2 gap-3">
                {Array(6).fill(0).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 pb-20">
                {products.map((p) => {
                  const img = Array.isArray(p.image_url) ? p.image_url[0] : p.image_url
                  const discount = p.original_price > p.price ? Math.round(((p.original_price - p.price) / p.original_price) * 100) : 0
                  
                  return (
                  <Link
                    href={`/product/${p.id}`}
                    key={p.id}
                    className="bg-white rounded-2xl overflow-hidden shadow-sm border border-zinc-100 active:scale-[0.98] transition-all group hover:shadow-md flex flex-col"
                  >
                    <div className="aspect-square bg-zinc-50 relative overflow-hidden">
                      <img
                        src={img || "/placeholder.png"}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                        alt={p.name}
                        loading="lazy"
                      />
                      {discount > 0 && (
                        <div className="absolute top-2 right-2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm">
                          -{discount}%
                        </div>
                      )}
                    </div>
                    <div className="p-2.5 flex flex-col justify-between flex-1 bg-white">
                      <div>
                        <h3 className="text-[11px] font-bold text-zinc-800 line-clamp-2 leading-tight mb-1">
                          {p.name}
                        </h3>
                        <p className="text-sm font-bold text-indigo-600 tracking-tight">
                          Rp {p.price?.toLocaleString('id-ID')}
                        </p>
                      </div>
                      
                      {/* Bintang & Terjual */}
                      <div className="flex items-center gap-1 mt-1">
                        <Icons.Star size={10} className="text-orange-400 fill-orange-400" />
                        <span className="text-[10px] font-bold text-zinc-600">{(p.rating || 5.0).toFixed(1)}</span>
                        <span className="text-[9px] text-zinc-400 ml-1 truncate">{p.sold_count || 0} terjual</span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 mt-2 mb-0.5 text-zinc-400">
                        <MapPin size={10} className="text-emerald-500 shrink-0" />
                        <span className="text-[9px] truncate font-medium">
                          {p.location || "Lokasi"}
                          {userLoc && p.latitude && p.longitude && (
                            <span className="ml-1 text-indigo-500 font-bold">
                              • {formatDistance(calculateDistance(userLoc.latitude, userLoc.longitude, p.latitude, p.longitude))}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </Link>
                  )
                })}
              </div>
            ) : !loading && (
              <div className="text-center py-20 bg-white rounded-2xl border border-zinc-100 flex flex-col items-center mt-4">
                <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mb-4 border border-zinc-100">
                  <Package size={28} className="text-zinc-300" />
                </div>
                <h3 className="text-sm font-bold text-zinc-800 mb-1">Produk Kosong</h3>
                <p className="text-[11px] text-zinc-400 font-medium px-8 leading-relaxed">Belum ada produk untuk kategori <span className="text-indigo-500">"{currentCategoryName}"</span> saat ini.</p>
              </div>
            )}

            {/* INFINITE SCROLL LOADER */}
            <div ref={loaderRef} className="pb-10 pt-4 flex justify-center">
              {isFetchingMore && (
                <div className="flex items-center gap-2 text-indigo-600">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-[10px] font-bold">Memuat...</span>
                </div>
              )}
              {!hasMore && products.length > 0 && (
                <p className="text-[10px] text-zinc-400 font-medium italic">Semua produk telah ditampilkan</p>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default function CategoryPage() {
  return (
    <Suspense fallback={
      <div className="bg-zinc-50 min-h-screen max-w-md mx-auto flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-zinc-400 mb-2" size={24} />
        <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">Memuat Kategori...</span>
      </div>
    }>
      <CategoryContent />
    </Suspense>
  )
}