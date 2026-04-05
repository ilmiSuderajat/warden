"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Search, X, Clock, TrendingUp, Sparkles, MessageCircle, ShoppingCart, Share2, ArrowLeft } from "lucide-react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { toast } from "sonner"

export default function SearchBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const isProductPage = !!pathname.match(/^\/product\/[^\/]+$/)
  const productId = isProductPage ? pathname.split('/').pop() : null
  const [query, setQuery] = useState(searchParams.get('q') || "")
  const [showSuggest, setShowSuggest] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [cartCount, setCartCount] = useState(0)
  const [chatCount, setChatCount] = useState(0)
  const [productName, setProductName] = useState("")
  const wrapperRef = useRef<HTMLDivElement>(null)

  // AMBIL NAMA PRODUK UNTUK PLACEHOLDER
  useEffect(() => {
    if (!isProductPage || !productId) return
    const fetchProductName = async () => {
      const { data } = await supabase
        .from("products")
        .select("name")
        .eq("id", productId)
        .maybeSingle()
      if (data) setProductName(data.name)
    }
    fetchProductName()
  }, [isProductPage, productId])

  // AMBIL DATA SARAN DARI DATABASE
  useEffect(() => {
    const fetchSuggestions = async () => {
      const { data } = await supabase
        .from("products")
        .select("name")
        .eq("is_ready", true)
        .limit(5) // Ambil 5 produk terbaru buat saran awal

      if (data) {
        // Ambil nama produknya saja dan masukkan ke state
        const productNames = data.map(p => p.name)
        setSuggestions(productNames)
      }
    }

    const fetchCartCount = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { count } = await supabase
        .from("cart")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)

      setCartCount(count || 0)

      // Realtime subscription
      const channel = supabase
        .channel('cart_count_sync')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'cart',
          filter: `user_id=eq.${user.id}`
        }, () => {
          fetchCartCount()
        })
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }

    const fetchChatCount = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Sum of unread_buyer and unread_shop (if user has a shop)
      const { data: conversations } = await supabase
        .from("shop_conversations")
        .select("unread_buyer, unread_shop, shops!inner(owner_id)")
        .or(`buyer_id.eq.${user.id},shops.owner_id.eq.${user.id}`)

      let totalUnread = 0
      conversations?.forEach((c: any) => {
        const shop = Array.isArray(c.shops) ? c.shops[0] : c.shops
        if (shop?.owner_id === user.id) {
          totalUnread += (c.unread_shop || 0)
        } else {
          totalUnread += (c.unread_buyer || 0)
        }
      })

      setChatCount(totalUnread)

      // Realtime subscription for chat
      const chatChannel = supabase
        .channel('chat_count_sync')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'shop_conversations'
        }, () => {
          fetchChatCount()
        })
        .subscribe()

      return () => { supabase.removeChannel(chatChannel) }
    }

    fetchSuggestions()
    fetchCartCount()
    fetchChatCount()
  }, [])

  useEffect(() => {
    setQuery(searchParams.get('q') || "")
  }, [searchParams])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggest(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSearch = (value: string) => {
    setQuery(value)
    setShowSuggest(false)
    if (value.trim() === "") {
      router.push("/")
    } else {
      router.push(`/search?q=${encodeURIComponent(value)}`)
    }
  }

  const placeholder = isProductPage && productName
    ? productName
    : "Cari Apa Lur?"

  return (
    <main ref={wrapperRef} className="max-w-md h-16 bg-indigo-600 mx-auto fixed top-0 left-0 right-0 flex items-center px-4 z-[100] border-b border-indigo-700/50 ">
      <div className="flex items-center gap-3 w-full">
        {/* Back Arrow - hanya tampil di product page */}
        {isProductPage && (
          <button
            onClick={() => router.back()}
            className="text-white hover:bg-white/10 p-1.5 rounded-xl transition-all active:scale-90 shrink-0"
          >
            <ArrowLeft size={22} strokeWidth={2.5} />
          </button>
        )}

        {/* Search Input Container */}
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />

          <input
            type="text"
            placeholder={placeholder}
            value={query}
            onFocus={() => setShowSuggest(true)}
            onChange={(e) => {
              setQuery(e.target.value)
              setShowSuggest(true)
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
            className="w-full h-10 rounded-full text-gray-800 bg-white pl-10 pr-12 text-sm outline-none focus:ring-2 focus:ring-white/90 transition-all shadow-inner"
          />

          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
            {query && (
              <button onClick={() => setQuery("")} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={14} />
              </button>
            )}
          </div>

          {/* --- DROPDOWN SARAN DINAMIS --- */}
          {showSuggest && suggestions.length > 0 && (
            <div className="absolute top-12 left-0 right-0 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-3 border-b border-gray-50 flex items-center gap-2 bg-indigo-50/30">
                <Sparkles size={14} className="text-indigo-600" />
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Saran Produk</span>
              </div>

              {suggestions
                .filter(item => item.toLowerCase().includes(query.toLowerCase()))
                .map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSearch(item)}
                    className="w-full px-4 py-3 text-left text-[13px] text-gray-700 hover:bg-indigo-50 flex items-center gap-3 transition-colors border-b border-gray-50 last:border-none group"
                  >
                    <Search size={14} className="text-gray-300 group-hover:text-indigo-400" />
                    <span className="truncate">{item}</span>
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-2">
          {isProductPage ? (
            <button
              onClick={async () => {
                const url = window.location.href
                try {
                  if (navigator.share) {
                    await navigator.share({ title: document.title, url })
                  } else {
                    await navigator.clipboard.writeText(url)
                    toast.success("Link produk disalin!")
                  }
                } catch { }
              }}
              className="relative p-1 text-white hover:bg-white/10 rounded-xl transition-all active:scale-90"
            >
              <Share2 size={26} strokeWidth={2.5} />
            </button>
          ) : (
            <Link href="/chat/shop" className="relative text-white/90 active:scale-95 transition-transform">
              <MessageCircle size={24} />
              {chatCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-white text-indigo-700 text-[9px] font-black min-w-[16px] h-4 rounded-full flex items-center justify-center px-1 shadow">
                  {chatCount}
                </span>
              )}
            </Link>
          )}
          <Link href="/cart" className="relative text-white/90 active:scale-95 transition-transform">
            <ShoppingCart size={24} />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-white text-indigo-700 text-[9px] font-black min-w-[16px] h-4 rounded-full flex items-center justify-center px-1 shadow">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </div>
    </main>

  )
}