"use client"
import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { Zap, ChevronRight, Flame } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

export default function FlashSale() {
  const [flashProducts, setFlashProducts] = useState<any[]>([])
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 })
  const [endDate, setEndDate] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showTimer, setShowTimer] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setInterval(() => setShowTimer(v => !v), 3500)
    return () => clearInterval(t)
  }, [])

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
          hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
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
    <section className="bg-white/95  rounded-xl  overflow-hidden">
      {/* ── HEADER ── */}
      <div className="px-3 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-gray-800 font-extrabold text-[15px] tracking-tight">WarFl</span>
          <Zap size={14} className="text-[#FF2C49] fill-[#FF2C49] -mx-[0.5px]" />
          <span className="text-gray-800 font-extrabold text-[15px] tracking-tight">sh</span>
        </div>

        <div className="relative h-5 w-[110px] overflow-hidden flex items-center justify-end">
          <AnimatePresence>
            {showTimer ? (
              <motion.div
                key="timer"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="absolute right-0 flex items-center gap-[3px]"
              >
                <TimeChip value={pad(timeLeft.hours)} />
                <span className="text-[#FF2C49] font-extrabold text-[11px] leading-none mb-[2px]">:</span>
                <TimeChip value={pad(timeLeft.minutes)} />
                <span className="text-[#FF2C49] font-extrabold text-[11px] leading-none mb-[2px]">:</span>
                <TimeChip value={pad(timeLeft.seconds)} />
              </motion.div>
            ) : (
              <motion.div
                key="link"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="absolute right-0 flex items-center"
              >
                <Link href="/flash-sale" className="text-gray-500 text-[11px] font-medium flex items-center gap-0.5 whitespace-nowrap">
                  Lihat Semua <ChevronRight size={14} className="text-gray-400" />
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── PRODUCTS ── */}
      <div
        ref={scrollRef}
        className="flex gap-2.5 px-3 pb-3 overflow-x-auto no-scrollbar snap-x"
      >
        {flashProducts.map((p, i) => {
          const img = Array.isArray(p.image_url) ? p.image_url[0] : p.image_url
          const discount = p.original_price > p.price
            ? Math.round(((p.original_price - p.price) / p.original_price) * 100)
            : 0

          const soldCount = p.sold_count || 0

          return (
            <motion.div
              key={p.id}
              className="shrink-0 w-[105px] snap-start"
            >
              <Link href={`/product/${p.id}`} className="w-full flex flex-col h-full">
                {/* Product Image */}
                <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 mb-1.5">
                  <img
                    src={img || "/placeholder.png"}
                    alt={p.name}
                    className="w-full h-full object-cover"
                  />

                  {/* Top Left Ribbon Badge */}
                  {discount > 0 && (
                    <div className="absolute top-0 left-0 bg-[#FF2C49] text-white px-1.5 py-[2px] rounded-br-[10px] flex flex-col items-center leading-none z-10">
                      <span className="text-[7px] font-medium leading-none mb-[1px]">SAVE</span>
                      <span className="text-[11px] font-extrabold leading-none">{discount}%</span>
                    </div>
                  )}
                </div>

                {/* Price Information */}
                <div className="flex flex-col flex-1 justify-between">
                  <div>
                    {/* Price */}
                    <div className="text-[#FF2C49] font-bold text-[14px] leading-tight flex items-start">
                      <span className="text-[9px] font-bold mr-0.5 mt-[2px]">Rp</span>
                      <span>{p.price.toLocaleString("id-ID")}</span>
                    </div>

                    {/* Original Price */}
                    {p.original_price > p.price ? (
                      <div className="text-gray-400 line-through text-[10px] font-medium mt-0.5 mb-1.5">
                        Rp{p.original_price.toLocaleString("id-ID")}
                      </div>
                    ) : (
                      <div className="h-[18px]"></div> // Spacer
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="relative h-[14px] w-full bg-red-200 rounded-full flex items-center mt-auto">
                    <div
                      className="absolute inset-y-0 left-0 bg-[#FF2C49] rounded-full z-0"
                      style={{ width: `${Math.min(Math.max((soldCount / Math.max(100, soldCount)) * 100, 15), 100)}%` }}
                    />
                    {/* Flame icon */}
                    <div className="absolute -left-1 z-20 top-1/2 -translate-y-1/2">
                      <span className="text-[17px] drop-shadow-sm">🔥</span>
                    </div>
                    {/* Sold count text */}
                    <div className="absolute inset-0 flex items-center justify-center z-10 pl-2">
                      <span className="text-[9px] font-medium text-white shadow-black/50">
                        {soldCount} terjual
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
    <div className="bg-[#FF2C49] text-white rounded-[3px] w-[18px] h-[18px] flex items-center justify-center shadow-sm">
      <span className="font-bold text-[10px] tabular-nums leading-none">{value}</span>
    </div>
  )
}