"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { Heart, Star, MapPin, ShoppingBag } from "lucide-react"
import { motion } from "framer-motion"
import { calculateDistance, formatDistance } from "@/lib/geo"
import { useUserLocation } from "@/hooks/useUserLocation"

export default function ProductDiscovery() {
  const [products, setProducts] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { location: userLoc } = useUserLocation()

  useEffect(() => {
    const fetchRecommended = async () => {
      // Simulate "Recommendations" by getting featured + random products or recently active
      const { data } = await supabase
        .from("products")
        .select(`*, shops(*)`)
        .eq("is_ready", true)
        .order("rating", { ascending: false })
        .limit(8)
      if (data) setProducts(data)
      setIsLoading(false)
    }
    fetchRecommended()
  }, [])

  if (isLoading) return null // Hide if still loading categories above it

  return (
    <section className="mx-4 mb-10 overflow-hidden">
      <div className="flex items-center justify-between mb-4 px-1">
        <div>
          <h2 className="text-lg font-black text-slate-800 tracking-tight leading-none mb-1">Rekomendasi Untukmu</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Spesial pilihan hari ini</p>
        </div>
        <Link href="/category" className="text-indigo-600 text-xs font-black flex items-center gap-1 group">
           Lihat Semua 
           <motion.span animate={{ x: [0, 3, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
              <Heart size={14} className="fill-indigo-600" />
           </motion.span>
        </Link>
      </div>

      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 snap-x pr-4">
        {products.map((p, i) => {
          const img = Array.isArray(p.image_url) ? p.image_url[0] : p.image_url
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="shrink-0 w-32 snap-start"
            >
              <Link href={`/product/${p.id}`} className="group block">
                <div className="relative aspect-[3/4] rounded-2xl overflow-hidden shadow-lg shadow-slate-200/50 group-active:scale-95 transition-transform">
                  <img src={img || "/placeholder.png"} className="w-full h-full object-cover" alt={p.name} />
                  
                  {/* Overlay Gradient */}
                  <div className="absolute inset-0 bg-linear-to-t from-slate-900/80 via-transparent to-transparent" />
                  
                  {/* Content Overlay */}
                  <div className="absolute bottom-2 left-2 right-2 flex flex-col gap-0.5">
                    <span className="text-white text-[10px] font-black leading-tight line-clamp-1 drop-shadow-md">
                      {p.name}
                    </span>
                    <span className="text-lime-400 font-extrabold text-[11px] tabular-nums underline decoration-lime-400/30">
                      Rp{p.price.toLocaleString("id-ID")}
                    </span>
                  </div>

                  {/* Rating Badge */}
                  <div className="absolute top-2 left-2 bg-white/20 backdrop-blur-md px-1.5 py-0.5 rounded-lg border border-white/30 flex items-center gap-1">
                    <Star size={8} className="fill-yellow-300 text-yellow-300" />
                    <span className="text-white text-[8px] font-black">{(p.rating || 5.0).toFixed(1)}</span>
                  </div>
                </div>
              </Link>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}
