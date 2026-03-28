"use client"
import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { LayoutGrid, List, ImageOff, Star, MapPin, Loader2 } from "lucide-react"
import Link from "next/link" // <-- Import Link
import ProductCardSkeleton from "./ProductCardSkeleton"
import { calculateDistance, formatDistance } from "@/lib/geo"
import { useUserLocation } from "@/hooks/useUserLocation"

function ProductImageSlider({ images, name }: { images?: string[] | string; name?: string }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const imageList =
    typeof images === "string"
      ? images ? [images] : []
      : Array.isArray(images)
        ? images.filter((url) => url)
        : []

  const isSlider = imageList.length > 1

  useEffect(() => {
    if (!isSlider) return

    // Kasih delay random antara 0 sampai 2000ms sebelum mulai interval
    const startDelay = Math.random() * 2000

    let interval: NodeJS.Timeout

    const timeout = setTimeout(() => {
      interval = setInterval(() => {
        if (!scrollRef.current) return

        // Gunakan fungsional update agar tidak perlu memasukkan activeIndex ke dependency
        setActiveIndex((current) => {
          const nextIndex = (current + 1) % imageList.length
          const width = scrollRef.current?.clientWidth || 0
          scrollRef.current?.scrollTo({
            left: width * nextIndex,
            behavior: "smooth"
          })
          return nextIndex
        })
      }, 3000)
    }, startDelay)

    return () => {
      clearTimeout(timeout)
      if (interval) clearInterval(interval)
    }
    // Dependency cukup length dan isSlider saja agar tidak re-run tiap slide pindah
  }, [isSlider, imageList.length])

  return (
    <div ref={scrollRef} className="flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar">
      {imageList.length === 0 && (
        <div className="w-full h-full flex items-center justify-center bg-gray-100">
          <ImageOff size={20} className="text-gray-300" />
        </div>
      )}
      {imageList.map((url, idx) => (
        // Di dalam ProductImageSlider mapping:
        <div key={idx} className="w-full h-full shrink-0 snap-center">
          <img
            src={url}
            alt={`${name ?? "product"}-${idx}`}
            className="w-full h-full object-cover" // Ini kuncinya Lur!
          />
        </div>
      ))}
    </div>
  )
}

export default function ProductList() {
  const [view, setView] = useState<"grid" | "list">("grid")
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const { location: userLoc } = useUserLocation()

  const loaderRef = useRef<HTMLDivElement>(null)
  const PAGE_SIZE = 8

  const fetchProducts = async (pageNum: number) => {
    if (pageNum === 0) setLoading(true)
    else setIsFetchingMore(true)

    const from = pageNum * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    try {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          shops (
            address,
            latitude,
            longitude
          )
        `)
        .eq("is_ready", true)
        .order("created_at", { ascending: false })
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
    } finally {
      setLoading(false)
      setIsFetchingMore(false)
    }
  }

  useEffect(() => {
    fetchProducts(0)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !isFetchingMore) {
          const nextPage = page + 1
          setPage(nextPage)
          fetchProducts(nextPage)
        }
      },
      { threshold: 1.0 }
    )

    if (loaderRef.current) {
      observer.observe(loaderRef.current)
    }

    return () => observer.disconnect()
  }, [hasMore, loading, isFetchingMore, page])

  return (
    <div className=" max-w-md mx-auto bg-gray-50/50">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-3 px-1">
        <div className="flex bg-gray-200/50 p-0.5 rounded-lg border border-gray-100">
          <button onClick={() => setView("grid")} className={`p-1 rounded-md transition-all ${view === "grid" ? "bg-white shadow-sm text-indigo-600" : "text-gray-400"}`}><LayoutGrid size={18} /></button>
          <button onClick={() => setView("list")} className={`p-1 rounded-md transition-all ${view === "list" ? "bg-white shadow-sm text-indigo-600" : "text-gray-400"}`}><List size={18} /></button>
        </div>
      </div>

      {/* PRODUCT LIST */}
      <div className={view === "grid" ? "grid grid-cols-2 gap-2" : "flex flex-col gap-2 "}>
        {loading && products.length === 0 ? (
          Array(6).fill(0).map((_, i) => (
            <ProductCardSkeleton key={i} view={view} />
          ))
        ) : (
          products.map((p) => {
            const price = p.price || 0
            const original = p.original_price || 0
            const discount = original > price ? Math.round(((original - price) / original) * 100) : 0

            return (
              <Link
                href={`/product/${p.id}`}
                key={p.id}
                className="block active:scale-[0.98] transition-transform duration-150"
              >
                <div className={`bg-white overflow-hidden border border-gray-100 mx-auto h-full w-[90%] ${view === "list" ? "flex flex-row" : "flex flex-col  "
                  }`}>
                  {/* IMAGE CONTAINER */}
                  <div className={`relative shrink-0 overflow-hidden ${view === "grid" ? "aspect-square w-full" : "w-28 h-28"
                    }`}>
                    <div className="absolute top-0 left-0 z-10 flex flex-col items-start gap-0.5 p-1">
                      <span className="bg-indigo-600 text-white text-[7px] font-bold px-1.5 py-0.5 rounded-sm shadow-sm">WarungKita Mall</span>
                      {p.is_flash_sale && <span className="bg-orange-500 text-white text-[7px] font-bold px-1.5 py-0.5 italic rounded-sm shadow-sm">FLASH</span>}
                      {p.is_ready && <span className="bg-emerald-500 text-white text-[7px] font-bold px-1.5 py-0.5 rounded-sm shadow-sm">READY</span>}
                    </div>

                    <ProductImageSlider images={p.image_url} name={p.name} />

                    {(p.stock === 0 || p.stock === null) && (
                      <div className="absolute inset-0 bg-black/50 z-20 flex items-center justify-center">
                        <span className="bg-red-600 text-white text-[10px] font-extrabold px-3 py-1 rounded-md shadow-lg uppercase tracking-wider">Stok Habis</span>
                      </div>
                    )}
                  </div>
                  {/* INFO */}
                  <div className="p-2 flex flex-col justify-between flex-1 min-w-0">
                    <div>
                      <p className="text-[11px] leading-[1.2] text-gray-800 line-clamp-2 mb-1 font-medium">{p.name}</p>
                      <div className="flex flex-col leading-tight">
                        <span className="text-red-500 font-bold text-[13px]">Rp {price.toLocaleString("id-ID")}</span>
                        {discount > 0 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[9px] text-gray-400 line-through truncate">Rp {original.toLocaleString("id-ID")}</span>
                            <span className="text-[9px] text-red-500 font-bold">-{discount}%</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* META */}
                    <div className="mt-1 space-y-0.5">
                      <div className="flex items-center gap-1">
                        <div className="flex items-center text-orange-400">
                          <Star size={8} fill="currentColor" />
                          <span className="text-[9px] font-bold ml-0.5 text-gray-700">{(p.rating || 5.0).toFixed(1)}</span>
                        </div>
                        <span className="text-gray-400 text-[9px] ml-1">{p.sold_count || 0} terjual</span>
                      </div>
                      <div className="flex items-center text-gray-400 gap-0.5 overflow-hidden">
                        <MapPin size={8} className="text-orange-500 shrink-0" />
                        <span className="text-[9px] truncate font-medium">
                          {p.shops?.address || p.location || "Lokasi tidak tersedia"}
                          {userLoc && (p.shops?.latitude || p.latitude) && (p.shops?.longitude || p.longitude) && (
                            <span className="ml-1 text-indigo-600 font-bold">
                              • {formatDistance(calculateDistance(userLoc.latitude, userLoc.longitude, p.shops?.latitude || p.latitude, p.shops?.longitude || p.longitude))}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </div>

      {/* INFINITE SCROLL LOADER */}
      <div ref={loaderRef} className="py-8 flex justify-center">
        {isFetchingMore && (
          <div className="flex items-center gap-2 text-indigo-600">
            <Loader2 size={24} className="animate-spin" />
            <span className="text-xs font-bold">Memuat lebih banyak...</span>
          </div>
        )}
        {!hasMore && products.length > 0 && (
          <p className="text-xs text-slate-400 font-medium italic">Semua produk telah dimuat</p>
        )}
      </div>
    </div>
  )
}