"use client"
import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { LayoutGrid, List, ImageOff, Star, MapPin } from "lucide-react"
import Link from "next/link" // <-- Import Link

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

  useEffect(() => {
    const fetchProducts = async () => {
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false })
      if (!error && data) setProducts(data)
    }
    fetchProducts()
  }, [])

  return (
    <div className="px-2 pb-24 max-w-md mx-auto mt-2 bg-gray-50/50">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-3 px-1">
        <h2 className="font-semibold text-gray-800 text-sm">Hanya Untukmu</h2>
        <div className="flex bg-gray-200/50 p-0.5 rounded-lg border border-gray-100">
          <button onClick={() => setView("grid")} className={`p-1 rounded-md transition-all ${view === "grid" ? "bg-white shadow-sm text-indigo-600" : "text-gray-400"}`}><LayoutGrid size={14} /></button>
          <button onClick={() => setView("list")} className={`p-1 rounded-md transition-all ${view === "list" ? "bg-white shadow-sm text-indigo-600" : "text-gray-400"}`}><List size={14} /></button>
        </div>
      </div>

      {/* PRODUCT LIST */}
      <div className={view === "grid" ? "grid grid-cols-2 gap-2" : "flex flex-col gap-2"}>
        {products.map((p) => {
          const price = p.price || 0
          const original = p.original_price || 0
          const discount = original > price ? Math.round(((original - price) / original) * 100) : 0

          return (
            // BUNGKUS DENGAN LINK DI SINI
            <Link 
              href={`/product/${p.id}`} 
              key={p.id} 
              className="block active:scale-[0.98] transition-transform duration-150"
            >
              <div className={`bg-white overflow-hidden border border-gray-100 h-full ${
                view === "list" ? "flex flex-row rounded-lg" : "flex flex-col rounded-xl shadow-sm"
              }`}>
                                {/* IMAGE CONTAINER */}
                <div className={`relative shrink-0 overflow-hidden ${
                  view === "grid" ? "aspect-square w-full" : "w-28 h-28"
                }`}>
                  {/* Badge Lapisan Atas */}
                  <div className="absolute top-0 left-0 z-10 flex flex-col items-start">
                    <span className="bg-indigo-600 text-white text-[7px] font-bold px-1 py-0.5 rounded-br-md">WardenMall</span>
                    {p.is_flash_sale && <span className="bg-orange-500 text-white text-[7px] font-bold px-1 py-0.5 rounded-br-md italic">FLASH</span>}
                  </div>

                  {/* Slider Gambar */}
                  <ProductImageSlider images={p.image_url} name={p.name} />
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
                        <span className="text-[9px] font-bold ml-0.5 text-gray-700">{p.rating || "5.0"}</span>
                      </div>
                      <span className="text-gray-400 text-[9px] ml-1">{p.sold_count || "0"} terjual</span>
                    </div>
                    <div className="flex items-center text-gray-400 gap-0.5 overflow-hidden">
  <MapPin size={8} className="text-orange-500 shrink-0" />
  <span className="text-[9px] truncate font-medium">
    {p.location || "Lokasi tidak tersedia"}
  </span>
</div>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}