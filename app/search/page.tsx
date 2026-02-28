"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Star, MapPin, ImageOff, ArrowLeft, Loader2 } from "lucide-react"
import ProductCardSkeleton from "../components/ProductCardSkeleton"
import Link from "next/link"
import { calculateDistance, formatDistance } from "@/lib/geo"
import { useUserLocation } from "@/hooks/useUserLocation"

// Komponen Utama Konten
function SearchContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const q = searchParams.get('q') || ""

  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { location: userLoc } = useUserLocation()

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true)
      try {
        const { data } = await supabase
          .from("products")
          .select("*")
          .ilike("name", `%${q}%`)
          .order('created_at', { ascending: false })

        setResults(data || [])
      } catch (error) {
        console.error("Error fetching search results", error)
      } finally {
        setLoading(false)
      }
    }

    if (q) {
      fetchResults()
    } else {
      setLoading(false)
    }
  }, [q])

  return (
    <div className="bg-slate-50 max-w-md mx-auto min-h-screen font-sans text-slate-900">

      {/* --- HEADER FIXED --- */}
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-center bg-white">
        <div className="w-full max-w-md h-14 flex items-center px-4 border-b border-slate-100">
          <button
            onClick={() => router.back()}
            className="p-1 -ml-1 text-slate-700 active:scale-95 transition-transform touch-manipulation"
          >
            <ArrowLeft size={24} strokeWidth={2.5} />
          </button>
          <div className="ml-3 flex flex-col overflow-hidden">
            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Hasil Pencarian</span>
            <h1 className="text-sm font-bold text-slate-800 truncate">“{q}”</h1>
          </div>
        </div>
      </header>

      {/* --- KONTEN UTAMA --- */}
      {/* Padding top mengikuti tinggi header (h-14 = 56px / 3.5rem) */}
      <main className="pt-16 pb-8 px-4">

        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array(6).fill(0).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : results.length > 0 ? (
          // Results Grid
          <div className="grid grid-cols-2 gap-3">
            {results.map((p) => {
              const displayImg = Array.isArray(p.image_url) ? p.image_url[0] : p.image_url;
              const original = p.original_price || 0;
              const price = p.price || 0;
              const discount = original > price ? Math.round(((original - price) / original) * 100) : 0;

              return (
                <Link
                  href={`/product/${p.id}`}
                  key={p.id}
                  className="group bg-white rounded-xl border border-slate-100 overflow-hidden flex flex-col active:scale-[0.98] transition-transform"
                >
                  {/* Gambar */}
                  <div className="aspect-square w-full bg-slate-100 relative overflow-hidden">
                    {displayImg ? (
                      <img
                        src={displayImg}
                        alt={p.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <ImageOff size={32} strokeWidth={1.5} />
                      </div>
                    )}

                    {/* Badge Diskon */}
                    {discount > 0 && (
                      <div className="absolute top-2 right-2 bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                        -{discount}%
                      </div>
                    )}
                  </div>

                  {/* Detail Produk */}
                  <div className="p-3 flex flex-col flex-1">
                    {/* Nama & Badge */}
                    <div className="mb-2">
                      <p className="text-xs text-slate-700 line-clamp-2 leading-tight">
                        {/* Contoh Badge, bisa dihapus jika tidak perlu */}
                        <span className="inline-block bg-orange-500 text-white text-[8px] font-bold px-1 rounded mr-1 align-middle">Mall</span>
                        <span className="align-middle">{p.name}</span>
                      </p>
                    </div>

                    {/* Spacer untuk mendorong harga ke bawah jika perlu */}
                    <div className="flex-1" />

                    {/* Harga */}
                    <div className="mt-auto">
                      <p className="text-orange-500 font-bold text-base leading-tight">
                        <span className="text-[10px] font-normal mr-0.5">Rp</span>
                        {price.toLocaleString('id-ID')}
                      </p>
                      {discount > 0 && (
                        <p className="text-[10px] text-slate-400 line-through mt-0.5">
                          Rp {original.toLocaleString('id-ID')}
                        </p>
                      )}
                    </div>

                    {/* Footer Info (Rating & Lokasi) */}
                    <div className="mt-2 pt-2 border-t border-slate-50 flex items-center justify-between text-slate-400">
                      <div className="flex items-center gap-0.5">
                        <Star size={10} className="text-orange-400 fill-orange-400" />
                        <span className="text-[10px] font-medium text-slate-600">{p.rating || "5.0"}</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <MapPin size={10} />
                        <span className="text-[10px] truncate max-w-20">
                          {p.location || "Jakarta"}
                          {userLoc && p.latitude && p.longitude && (
                            <span className="ml-1 text-indigo-600 font-bold">
                              • {formatDistance(calculateDistance(userLoc.latitude, userLoc.longitude, p.latitude, p.longitude))}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          // Empty State
          <div className="flex flex-col items-center justify-center h-[60vh] text-center px-8">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <ImageOff size={36} className="text-slate-300" />
            </div>
            <h2 className="text-slate-800 font-bold text-base mb-1">Produk Tidak Ditemukan</h2>
            <p className="text-slate-400 text-xs leading-relaxed">
              Tidak ada hasil untuk “{q}”. Coba gunakan kata kunci lain.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

// Wrapper Suspense
export default function SearchResults() {
  return (
    <Suspense fallback={
      <div className="pt-20 px-4 bg-slate-50 min-h-screen max-w-md mx-auto">
        <div className="grid grid-cols-2 gap-3">
          {Array(6).fill(0).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    }>
      <SearchContent />
    </Suspense>
  )
}