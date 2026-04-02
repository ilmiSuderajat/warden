"use client"
import { useEffect, useState, useRef, Suspense } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft, Loader2, Package, MapPin, Star,
  SlidersHorizontal, ChevronDown, Search, X, ShoppingBag, Flame, TrendingUp, Zap
} from "lucide-react"
import ProductCardSkeleton from "../components/ProductCardSkeleton"
import { calculateDistance, formatDistance } from "@/lib/geo"
import { useUserLocation } from "@/hooks/useUserLocation"
import ErrorBoundary from "../components/ErrorBoundary"

const SORT_OPTIONS = [
  { label: "Terbaru", value: "newest" },
  { label: "Terlaris", value: "best_selling" },
  { label: "Harga ↑", value: "price_asc" },
  { label: "Harga ↓", value: "price_desc" },
]

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
  const [sortBy, setSortBy] = useState("newest")
  const [showSort, setShowSort] = useState(false)
  const { location: userLoc } = useUserLocation()

  const loaderRef = useRef<HTMLDivElement>(null)
  const PAGE_SIZE = 8

  useEffect(() => {
    const fetchCats = async () => {
      const { data } = await supabase.from("categories").select("*").order("name")
      if (data && data.length > 0) {
        setCategories(data)
        if (!initialCatId) setSelectedCat(data[0].id)
      }
    }
    fetchCats()
  }, [initialCatId])

  const fetchProducts = async (catId: string, pageNum: number, sort = sortBy) => {
    if (pageNum === 0) setLoading(true)
    else setIsFetchingMore(true)
    const from = pageNum * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    try {
      let query = supabase
        .from("products")
        .select(`*, shops(address, latitude, longitude)`)
        .eq("category_id", catId)
        .eq("is_ready", true)

      if (sort === "newest") query = query.order("created_at", { ascending: false })
      else if (sort === "price_asc") query = query.order("price", { ascending: true })
      else if (sort === "price_desc") query = query.order("price", { ascending: false })
      else if (sort === "best_selling") query = query.order("sold_count", { ascending: false })

      const { data, error } = await query.range(from, to)
      if (error) throw error
      if (data) {
        if (pageNum === 0) setProducts(data)
        else setProducts(prev => [...prev, ...data])
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

  useEffect(() => {
    if (!selectedCat) return
    setPage(0)
    setHasMore(true)
    fetchProducts(selectedCat, 0, sortBy)
    try {
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.set("id", selectedCat)
      window.history.replaceState({}, '', newUrl.toString())
    } catch (e) { }
  }, [selectedCat, sortBy])

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
    if (loaderRef.current) observer.observe(loaderRef.current)
    return () => observer.disconnect()
  }, [hasMore, loading, isFetchingMore, page, selectedCat])

  const currentCategory = categories.find(c => c.id === selectedCat)
  const currentCategoryName = currentCategory?.name || "Produk"

  const getCategoryIcon = (iconName: string) => {
    try {
      const IconComp = (Icons as any)[iconName]
      return typeof IconComp === "function" ? IconComp : Package
    } catch { return Package }
  }

  return (
    <div className="bg-[#F5F5F5] max-w-md mx-auto font-sans text-gray-900 h-[100dvh] overflow-hidden flex flex-col">
      {/* ── TOP HEADER ── */}
      <header className="flex-none bg-[#EE4D2D] z-50 shadow-sm">
        {/* Search Bar Row */}
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button
            onClick={() => router.push("/")}
            className="text-white p-1 rounded-full hover:bg-white/10 transition-colors shrink-0"
          >
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <div className="flex-1 flex items-center bg-white rounded-md px-3 py-2 gap-2 shadow-inner">
            <Search size={14} className="text-gray-400 shrink-0" />
            <span className="text-[12px] text-gray-400 truncate">Cari di {currentCategoryName}</span>
          </div>
          <button className="relative text-white p-1 shrink-0">
            <ShoppingBag size={20} />
            <span className="absolute -top-0.5 -right-0.5 bg-yellow-400 text-[#EE4D2D] text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center">2</span>
          </button>
        </div>
        {/* Category scrollable tabs */}
        <div className="overflow-x-auto no-scrollbar px-3 pb-2.5 pt-0.5">
          <div className="flex gap-1.5">
            {categories.map((cat) => {
              const isActive = selectedCat === cat.id
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCat(cat.id)}
                  className={`flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-bold transition-all whitespace-nowrap active:scale-95 ${isActive
                    ? "bg-white text-[#EE4D2D] shadow-sm"
                    : "bg-white/20 text-white"
                    }`}
                >
                  {cat.name}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      {/* ── BODY ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* SIDEBAR */}
        <aside className="w-[72px] bg-white border-r border-gray-100 overflow-y-auto no-scrollbar py-2 shrink-0">
          {categories.map((cat) => {
            const Icon = getCategoryIcon(cat.icon_name)
            const isActive = selectedCat === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCat(cat.id)}
                className={`w-full py-2.5 px-1 flex flex-col items-center gap-1 relative transition-all active:scale-95 ${isActive ? "bg-orange-50" : "hover:bg-gray-50"
                  }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-[#EE4D2D] rounded-r-full" />
                )}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${isActive
                  ? "bg-[#EE4D2D] shadow-md shadow-[#EE4D2D]/30"
                  : "bg-gray-100"
                  }`}>
                  <Icon
                    size={17}
                    className={isActive ? "text-white" : "text-gray-500"}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </div>
                <span className={`text-[9.5px] font-bold leading-tight line-clamp-2 text-center w-full px-0.5 ${isActive ? "text-[#EE4D2D]" : "text-gray-500"
                  }`}>
                  {cat.name}
                </span>
              </button>
            )
          })}
        </aside>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-y-auto bg-[#F5F5F5]">
          {/* Filter/Sort Bar */}
          <div className="top-0 z-30 bg-white border-b border-gray-100 shadow-sm">
            <div className="flex items-center px-2 py-1.5 gap-1 overflow-x-auto no-scrollbar">
              {/* Sort dropdown */}
              <div className="relative shrink-0">
                <button
                  onClick={() => setShowSort(!showSort)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-gray-200 text-[10px] font-bold text-gray-700 bg-white whitespace-nowrap hover:border-[#EE4D2D] transition-colors"
                >
                  <SlidersHorizontal size={10} />
                  {SORT_OPTIONS.find(s => s.value === sortBy)?.label}
                  <ChevronDown size={9} className={`transition-transform ${showSort ? "rotate-180" : ""}`} />
                </button>
                {showSort && (
                  <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden min-w-[120px]">
                    {SORT_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => { setSortBy(opt.value); setShowSort(false) }}
                        className={`w-full text-left px-3.5 py-2.5 text-[11px] font-semibold transition-colors ${sortBy === opt.value
                          ? "bg-orange-50 text-[#EE4D2D]"
                          : "text-gray-600 hover:bg-gray-50"
                          }`}
                      >
                        {sortBy === opt.value && <span className="mr-1.5">✓</span>}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick filter badges */}
              {[
                { label: "Flash Sale", icon: Zap, color: "text-yellow-600 border-yellow-300 bg-yellow-50" },
                { label: "Terlaris", icon: Flame, color: "text-red-600 border-red-200 bg-red-50" },
                { label: "Trending", icon: TrendingUp, color: "text-green-600 border-green-200 bg-green-50" },
              ].map(({ label, icon: Icon, color }) => (
                <button
                  key={label}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full border text-[10px] font-bold whitespace-nowrap shrink-0 ${color}`}
                >
                  <Icon size={9} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          <div className="p-1.5 pt-2">
            {loading && products.length === 0 ? (
              <div className="grid grid-cols-2 gap-1.5">
                {Array(6).fill(0).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-2 gap-1.5 pb-20">
                {products.map((p) => {
                  const img = Array.isArray(p.image_url) ? p.image_url[0] : p.image_url
                  const discount = p.original_price > p.price
                    ? Math.round(((p.original_price - p.price) / p.original_price) * 100)
                    : 0

                  return (
                    <Link
                      href={`/product/${p.id}`}
                      key={p.id}
                      className="bg-white rounded-lg overflow-hidden shadow-sm active:scale-[0.98] transition-transform flex flex-col"
                    >
                      {/* Product Image */}
                      <div className="aspect-square bg-gray-100 relative overflow-hidden">
                        <img
                          src={img || "/placeholder.png"}
                          className="w-full h-full object-cover"
                          alt={p.name}
                          loading="lazy"
                        />
                        {discount > 0 && (
                          <div className="absolute top-0 left-0 bg-[#EE4D2D] text-white text-[9px] font-black px-1.5 py-0.5 rounded-br-md">
                            -{discount}%
                          </div>
                        )}
                        {p.is_featured && (
                          <div className="absolute bottom-1.5 left-1.5 bg-yellow-400 text-[8px] font-black text-yellow-900 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <Star size={7} className="fill-yellow-900" />
                            PILIHAN
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <div className="p-2 flex flex-col gap-0.5 flex-1">
                        <h3 className="text-[11px] text-gray-800 line-clamp-2 leading-snug font-medium">
                          {p.name}
                        </h3>

                        {/* Price */}
                        <div className="mt-0.5">
                          <p className="text-[13px] font-black text-[#EE4D2D] leading-none">
                            Rp{p.price?.toLocaleString("id-ID")}
                          </p>
                          {discount > 0 && (
                            <p className="text-[9px] text-gray-400 line-through mt-0.5">
                              Rp{p.original_price?.toLocaleString("id-ID")}
                            </p>
                          )}
                        </div>

                        {/* Rating + sold */}
                        <div className="flex items-center gap-1 mt-1">
                          <div className="flex items-center gap-0.5">
                            <Star size={9} className="text-yellow-400 fill-yellow-400" />
                            <span className="text-[9px] font-bold text-gray-600">
                              {(p.rating || 5.0).toFixed(1)}
                            </span>
                          </div>
                          <span className="text-[8px] text-gray-300">|</span>
                          <span className="text-[9px] text-gray-500">
                            {p.sold_count > 999
                              ? `${(p.sold_count / 1000).toFixed(1)}rb`
                              : p.sold_count || 0} terjual
                          </span>
                        </div>

                        {/* Location */}
                        <div className="flex items-center gap-1 mt-0.5">
                          <MapPin size={9} className="text-gray-400 shrink-0" />
                          <span className="text-[9px] text-gray-400 truncate">
                            {p.shops?.address || p.location || "Lokasi"}
                          </span>
                        </div>
                        {userLoc && (p.shops?.latitude || p.latitude) && (p.shops?.longitude || p.longitude) && (
                          <span className="text-[9px] text-[#EE4D2D] font-bold">
                            📍 {formatDistance(calculateDistance(
                              userLoc.latitude, userLoc.longitude,
                              p.shops?.latitude || p.latitude,
                              p.shops?.longitude || p.longitude
                            ))} dari kamu
                          </span>
                        )}

                        {/* Free shipping badge */}
                        {p.free_shipping && (
                          <div className="mt-1 bg-green-50 border border-green-200 rounded px-1.5 py-0.5 w-fit">
                            <span className="text-[8.5px] font-bold text-green-600">Gratis Ongkir</span>
                          </div>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            ) : !loading && (
              <div className="flex flex-col items-center py-20 px-8 mt-4 bg-white rounded-xl mx-1">
                <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mb-4">
                  <Package size={34} className="text-[#EE4D2D]/40" />
                </div>
                <h3 className="text-sm font-bold text-gray-800 mb-1">Produk Tidak Ditemukan</h3>
                <p className="text-[11px] text-gray-400 text-center leading-relaxed">
                  Belum ada produk untuk kategori <span className="text-[#EE4D2D] font-bold">"{currentCategoryName}"</span>
                </p>
                <button
                  onClick={() => router.push("/")}
                  className="mt-5 px-5 py-2 bg-[#EE4D2D] text-white text-[11px] font-bold rounded-full shadow-md shadow-[#EE4D2D]/30 active:scale-95 transition-transform"
                >
                  Jelajahi Kategori Lain
                </button>
              </div>
            )}

            {/* Infinite scroll loader */}
            <div ref={loaderRef} className="pb-10 pt-4 flex justify-center">
              {isFetchingMore && (
                <div className="flex items-center gap-2 text-[#EE4D2D]">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-[10px] font-bold">Memuat produk...</span>
                </div>
              )}
              {!hasMore && products.length > 0 && (
                <div className="flex flex-col items-center gap-1">
                  <div className="w-10 h-px bg-gray-200" />
                  <p className="text-[10px] text-gray-400 font-medium">Semua produk telah ditampilkan</p>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Overlay dismiss for sort dropdown */}
      {showSort && (
        <div className="fixed inset-0 z-20" onClick={() => setShowSort(false)} />
      )}
    </div>
  )
}

export default function CategoryPage() {
  return (
    <ErrorBoundary>
      <Suspense fallback={
        <div className="bg-[#F5F5F5] min-h-screen max-w-md mx-auto flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 bg-[#EE4D2D] rounded-2xl flex items-center justify-center shadow-lg shadow-[#EE4D2D]/30">
            <ShoppingBag size={26} className="text-white" />
          </div>
          <Loader2 className="animate-spin text-[#EE4D2D]" size={20} />
          <span className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Memuat Kategori...</span>
        </div>
      }>
        <CategoryContent />
      </Suspense>
    </ErrorBoundary>
  )
}