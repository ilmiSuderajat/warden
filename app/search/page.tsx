"use client"
import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Star, MapPin, ImageOff } from "lucide-react"
import Link from "next/link" // Import Link dari Next.js

export default function SearchResults() {
  const searchParams = useSearchParams()
  const q = searchParams.get('q') || ""
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true)
      const { data } = await supabase
        .from("products")
        .select("*")
        .ilike("name", `%${q}%`)
        .order('created_at', { ascending: false })

      if (data) setResults(data)
      setLoading(false)
    }

    if (q) fetchResults()
  }, [q])

  return (
    <div className="pt-24 px-2 pb-24 max-w-md mx-auto min-h-screen bg-[#f4f4f4]">
      {/* HEADER INFO */}
      <div className="bg-white mb-2 p-3 rounded-lg shadow-sm border border-gray-100">
        <p className="text-[12px] text-gray-500">
          Hasil pencarian: <span className="text-[#f57224] font-bold">"{q}"</span>
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-xs text-gray-400 font-bold uppercase tracking-widest">Mencari...</p>
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {results.map((p) => {
            const displayImg = Array.isArray(p.image_url) ? p.image_url[0] : p.image_url;
            const original = p.original_price || 0;
            const price = p.price || 0;
            const discount = original > price ? Math.round(((original - price) / original) * 100) : 0;

            return (
              <Link 
                href={`/product/${p.id}`} 
                key={p.id} 
                className="group bg-white rounded-md overflow-hidden shadow-sm flex flex-col active:scale-95 transition-transform"
              >
                {/* GAMBAR PRODUK */}
                <div className="aspect-square w-full bg-gray-50 relative">
                  {displayImg ? (
                    <img src={displayImg} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageOff size={24}/></div>
                  )}
                  {/* Badge Diskon di Gambar */}
                  {discount > 0 && (
                    <div className="absolute top-0 right-0 bg-[#fff1e0] text-[#f57224] text-[10px] font-bold px-1.5 py-0.5 rounded-bl-lg">
                      -{discount}%
                    </div>
                  )}
                </div>

                {/* INFO PRODUK */}
                <div className="p-2 flex flex-col justify-between flex-1">
                  <div>
                    {/* Badge & Title */}
                    <div className="mb-1 h-8 overflow-hidden">
                      <p className="text-[11px] leading-[1.3] text-[#212121] line-clamp-2">
                        <span className="inline-block bg-[#f57224] text-white text-[8px] font-bold px-1 rounded-sm mr-1">LazMall</span>
                        {p.name}
                      </p>
                    </div>

                    {/* Harga Utama */}
                    <p className="text-[#f57224] font-bold text-[15px]">
                      <span className="text-[10px] mr-0.5">Rp</span>{price.toLocaleString('id-ID')}
                    </p>

                    {/* Harga Coret */}
                    {discount > 0 && (
                      <p className="text-[10px] text-gray-400 line-through">
                        Rp {original.toLocaleString('id-ID')}
                      </p>
                    )}
                  </div>

                  {/* Rating & Lokasi */}
                  <div className="mt-2 pt-2 border-t border-gray-50">
                    <div className="flex items-center gap-1 mb-1">
                      <Star size={10} fill="#ffc107" className="text-[#ffc107]" />
                      <span className="text-[10px] font-bold text-[#212121]">{p.rating || "5.0"}</span>
                      <span className="text-[10px] text-gray-400">({p.sold_count || 0})</span>
                    </div>
                    <div className="flex items-center text-gray-400 gap-1">
                      <MapPin size={10} />
                      <span className="text-[10px] truncate">{p.location || "Indonesia"}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-2xl mx-2 shadow-sm border border-dashed border-gray-200">
          <div className="flex justify-center mb-4 text-gray-200"><ImageOff size={48} /></div>
          <p className="text-gray-400 text-sm italic px-10">Waduh, produknya nggak ketemu Lur. Coba kata kunci lain!</p>
        </div>
      )}
    </div>
  )
}