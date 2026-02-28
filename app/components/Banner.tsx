"use client"
import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { Zap, ChevronRight } from "lucide-react"
export default function Banner() {
  const [flashProducts, setFlashProducts] = useState<any[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchFlashSale = async () => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("is_flash_sale", true)
        .limit(10)

      if (data) setFlashProducts(data)
    }
    fetchFlashSale()
  }, [])

  // Efek Auto-Slide untuk Banner
  useEffect(() => {
    const interval = setInterval(() => {
      if (scrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;

        // Jika sudah mentok di kanan, balik lagi ke kiri
        if (scrollLeft + clientWidth >= scrollWidth - 10) {
          scrollRef.current.scrollTo({ left: 0, behavior: "smooth" });
        } else {
          // Geser ke kanan sejauh 150px (pas satu kartu + gap)
          scrollRef.current.scrollBy({ left: 150, behavior: "smooth" });
        }
      }
    }, 3000); // Jalan setiap 3 detik

    return () => clearInterval(interval);
  }, [flashProducts]);

  return (
    <div className="bg-gray-50 rounded-lg mx-4 mb-5 p-4">
      <div className="flex justify-between items-center mb-3 text-slate-900">
        <h2 className="font-bold flex items-center gap-1">
          <span className="text-indigo-600">Warden</span>
          <span className="text-orange-500">Flash</span>
          <Zap size={14} className="text-orange-500 fill-orange-500" />
        </h2>
        <Link href="/flash-sale" className="text-xs font-semibold text-slate-400 hover:text-indigo-600 flex items-center gap-0.5 transition-colors group">
          Lihat Semua
          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-2 no-scrollbar snap-x snap-mandatory"
      >
        {flashProducts.map((product) => {
          const displayImg = Array.isArray(product.image_url)
            ? product.image_url[0]
            : product.image_url;

          return (
            <Link
              href={`/product/${product.id}`}
              key={product.id}
              className="block active:scale-[0.98] transition-transform duration-150"
            >
              <div
                className="min-w-32 p-2 bg-gray-100 snap-start"
              >
                <div className="h-32 bg-gray-100 rounded-md mb-2 overflow-hidden">
                  {displayImg ? (
                    <img
                      src={displayImg}
                      alt={product.name}
                      className="w-30 h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-[10px]">
                      No Image
                    </div>
                  )}
                </div>

                <p className="text-red-500 font-bold text-sm">
                  Rp {product.price.toLocaleString('id-ID')}
                </p>

                {product.original_price && (
                  <p className="text-xs text-gray-400 line-through">
                    Rp {product.original_price.toLocaleString('id-ID')}
                  </p>
                )}

                <div className="mt-1 bg-red-100 text-red-500 text-[10px] px-2 py-0.5 rounded-full w-fit">
                  {product.sold_count || 0} terjual
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}