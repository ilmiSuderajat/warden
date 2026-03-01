"use client"
import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { Zap, ChevronRight, ShoppingCart } from "lucide-react"

export default function Banner() {
  const [flashProducts, setFlashProducts] = useState<any[]>([])
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0 })
  const [endDate, setEndDate] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchData = async () => {
      const { data: products } = await supabase
        .from("products")
        .select("*")
        .eq("is_flash_sale", true)
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

  // Auto-scroll logic
  useEffect(() => {
    if (flashProducts.length === 0) return
    const interval = setInterval(() => {
      if (!scrollRef.current) return
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current

      // Jika sudah di ujung, kembali ke awal
      if (scrollLeft + clientWidth >= scrollWidth - 10) {
        scrollRef.current.scrollTo({ left: 0, behavior: "smooth" })
      } else {
        // Scroll sejauh 1 kartu (approx 160px)
        scrollRef.current.scrollBy({ left: 160, behavior: "smooth" })
      }
    }, 4000) // Sedikit diperlambat agar tidak pusing
    return () => clearInterval(interval)
  }, [flashProducts])

  if (flashProducts.length === 0) return null

  const pad = (n: number) => n.toString().padStart(2, "0")

  return (
    <div className="mx-4 mb-6 max-w-md rounded-xl  overflow-hidden border border-gray-100 bg-white">

      {/* ── HEADER SECTION ── */}
      <div className="relative bg-gradient-to-r from-orange-500 via-red-500 to-rose-600 p-4">
        {/* Decorative Circles */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-orange-300/10 rounded-full blur-xl translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10 flex items-center justify-between">
          {/* Left: Title & Icon */}
          <div className="flex items-center gap-2">
            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm border border-white/10">
              <Zap size={18} className="text-yellow-300 fill-yellow-300" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg tracking-tight">Flash Sale</h3>
              <p className="text-white/70 text-[10px] font-medium uppercase tracking-widest">Segera Berakhir</p>
            </div>
          </div>

          {/* Right: Countdown & CTA */}
          <div className="flex items-center gap-4">
            {endDate && (
              <div className="flex items-center gap-1 font-mono">
                <TimeChip value={pad(timeLeft.hours)} />
                <span className="text-white/50 font-bold">:</span>
                <TimeChip value={pad(timeLeft.minutes)} />
                <span className="text-white/50 font-bold">:</span>
                <TimeChip value={pad(timeLeft.seconds)} />
              </div>
            )}

            <Link
              href="/flash-sale"
              className="hidden sm:flex items-center gap-1 text-xs font-bold bg-white text-red-600 px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors shadow-sm"
            >
              Lihat Semua
              <ChevronRight size={14} strokeWidth={3} />
            </Link>
          </div>
        </div>
      </div>

      {/* ── PRODUCT SCROLL ── */}
      <div
        ref={scrollRef}
        className="flex gap-3 p-4 overflow-x-auto no-scrollbar scroll-smooth"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {flashProducts.map((product, i) => {
          const img = Array.isArray(product.image_url) ? product.image_url[0] : product.image_url
          const discount = product.original_price && product.original_price > product.price
            ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
            : 0

          // Random stock percentage for UI "urgency" simulation
          const stockPercent = Math.min(((product.sold_count || Math.random() * 50) / 50) * 100, 95)

          return (
            <Link
              href={`/product/${product.id}`}
              key={product.id}
              className="flex-shrink-0 w-[140px] group"
            >
              {/* Card Container */}
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden transition-all duration-200 group-hover:border-gray-200 group-hover:shadow-md">

                {/* Image Wrapper */}
                <div className="relative w-full aspect-square bg-gray-50 overflow-hidden">
                  {img ? (
                    <img
                      src={img}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <ShoppingCart size={24} />
                    </div>
                  )}

                  {/* Discount Badge */}
                  {discount > 0 && (
                    <div className="absolute top-0 left-0 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-br-lg shadow-sm flex items-center">
                      <span className="mr-0.5">-{discount}%</span>
                    </div>
                  )}
                </div>

                {/* Info Section */}
                <div className="p-2.5">
                  {/* Price */}
                  <div className="mb-1">
                    <p className="text-red-600 font-extrabold text-sm leading-tight">
                      Rp {product.price.toLocaleString("id-ID")}
                    </p>
                    {product.original_price && (
                      <p className="text-gray-400 text-[10px] line-through font-medium">
                        Rp {product.original_price.toLocaleString("id-ID")}
                      </p>
                    )}
                  </div>

                  {/* Sold Progress Bar */}
                  <div className="mt-2">
                    <div className="h-1.5 w-full bg-red-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-400 to-red-500 rounded-full"
                        style={{ width: `${stockPercent}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-gray-500 mt-1 font-medium">
                      {product.sold_count || Math.floor(stockPercent)}+ Terjual
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Mobile CTA Footer */}
      <div className="sm:hidden border-t border-gray-100 p-3 bg-gray-50/50">
        <Link
          href="/flash-sale"
          className="flex items-center justify-center gap-1 text-xs font-bold text-red-600 w-full py-1"
        >
          Lihat Semua Promo
          <ChevronRight size={14} strokeWidth={3} />
        </Link>
      </div>
    </div>
  )
}

// Component TimeChip yang lebih modern
function TimeChip({ value }: { value: string }) {
  return (
    <div className="bg-white rounded-md px-1.5 py-1 min-w-[28px] text-center shadow-sm border border-white/20">
      <span className="text-red-600 font-bold text-xs tabular-nums leading-none">{value}</span>
    </div>
  )
}