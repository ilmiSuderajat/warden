"use client"
import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { Zap, ChevronRight, Flame } from "lucide-react"
import { motion } from "framer-motion"

export default function FlashSale() {
  const [flashProducts, setFlashProducts] = useState<any[]>([])
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 })
  const [endDate, setEndDate] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: products } = await supabase
          .from("products")
          .select("*")
          .eq("is_flash_sale", true)
          .eq("is_ready", true)
          .limit(10)
        if (products) setFlashProducts(products)

        const { data: banner } = await supabase
          .from("flash_sale_banners")
          .select("end_date")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
        if (banner?.end_date) setEndDate(banner.end_date)
      } catch (err) {
        console.error("Flash sale error:", err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  useEffect(() => {
    if (!endDate) return
    const interval = setInterval(() => {
      const diff = new Date(endDate).getTime() - Date.now()
      if (diff <= 0) {
        clearInterval(interval)
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 })
      } else {
        setTimeLeft({
          hours: Math.floor((diff / (1000 * 60 * 60))),
          minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((diff % (1000 * 60)) / 1000),
        })
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [endDate])

  if (isLoading || flashProducts.length === 0) return null

  const pad = (n: number) => n.toString().padStart(2, "0")

  return (
    <section className="bg-white mb-4 overflow-hidden border-b border-gray-100">
      {/* ── HEADER ── */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Logo Brand Flash Sale */}
          <div className="flex items-center italic">
            <span className="text-[#EE4D2D] font-black text-xl tracking-tighter">FLASH</span>
            <Zap size={22} className="text-[#EE4D2D] fill-[#EE4D2D] mx-0.5" />
            <span className="text-[#EE4D2D] font-black text-xl tracking-tighter uppercase">Sale</span>
          </div>

          {/* Timer Section ala Shopee */}
          <div className="flex items-center gap-1 ml-2">
            <TimeChip value={pad(timeLeft.hours)} />
            <span className="text-black font-bold">:</span>
            <TimeChip value={pad(timeLeft.minutes)} />
            <span className="text-black font-bold">:</span>
            <TimeChip value={pad(timeLeft.seconds)} />
          </div>
        </div>

        <Link href="/flash-sale" className="text-[#EE4D2D] text-xs font-medium flex items-center gap-0.5">
          Lihat Semua <ChevronRight size={14} />
        </Link>
      </div>

      {/* ── PRODUCTS ── */}
      <div
        ref={scrollRef}
        className="flex gap-2 p-3 overflow-x-auto no-scrollbar snap-x"
      >
        {flashProducts.map((p, i) => {
          const img = Array.isArray(p.image_url) ? p.image_url[0] : p.image_url
          const discount = p.original_price > p.price
            ? Math.round(((p.original_price - p.price) / p.original_price) * 100)
            : 0

          // Progress Calculation
          const soldCount = p.sold_count || 0
          const isAlmostOut = soldCount > 80

          return (
            <motion.div
              key={p.id}
              className="shrink-0 w-32 snap-start flex flex-col items-center"
            >
              <Link href={`/product/${p.id}`} className="w-full">
                {/* Product Image */}
                <div className="relative aspect-square rounded-sm overflow-hidden bg-gray-100">
                  <img
                    src={img || "/placeholder.png"}
                    alt={p.name}
                    className="w-full h-full object-cover"
                  />

                  {/* Floating Discount Tag (Shopee Style) */}
                  {discount > 0 && (
                    <div className="absolute top-0 right-0 bg-[#FFD211] text-[#EE4D2D] text-[10px] font-bold px-1 py-0.5 flex flex-col items-center leading-tight">
                      <span>{discount}%</span>
                      <span className="text-[8px] font-black uppercase">OFF</span>
                    </div>
                  )}
                </div>

                {/* Price Information */}
                <div className="mt-2 text-center">
                  <p className="text-[#EE4D2D] font-bold text-sm leading-none">
                    <span className="text-[10px] mr-0.5">Rp</span>
                    {p.price.toLocaleString("id-ID")}
                  </p>

                  {/* Progress Bar Shopee Style */}
                  <div className="mt-1.5 relative h-4 w-full bg-[#ffbdad] rounded-full overflow-hidden border border-[#EE4D2D]/10">
                    <div
                      className="absolute inset-y-0 left-0 bg-[#EE4D2D] rounded-full z-0"
                      style={{ width: `${Math.max(soldCount, 15)}%` }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center z-10 px-1">
                      {isAlmostOut && <Flame size={10} className="text-yellow-300 fill-yellow-300 mr-1" />}
                      <span className="text-[8px] font-bold text-white uppercase tracking-tighter">
                        {soldCount > 0 ? `Terjual ${soldCount}` : "Segera Hadir"}
                      </span>
                    </div>
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

function TimeChip({ value }: { value: string }) {
  return (
    <div className="bg-black text-white rounded-[3px] w-5 h-5 flex items-center justify-center">
      <span className="font-bold text-[11px] tabular-nums leading-none">{value}</span>
    </div>
  )
}