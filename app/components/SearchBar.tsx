"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Search, X, Clock, TrendingUp, Sparkles } from "lucide-react"
import { supabase } from "@/lib/supabase"

export default function SearchBar() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || "")
  const [showSuggest, setShowSuggest] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const wrapperRef = useRef<HTMLDivElement>(null)

  // AMBIL DATA SARAN DARI DATABASE
  useEffect(() => {
    const fetchSuggestions = async () => {
      const { data } = await supabase
        .from("products")
        .select("name")
        .limit(5) // Ambil 5 produk terbaru buat saran awal
      
      if (data) {
        // Ambil nama produknya saja dan masukkan ke state
        const productNames = data.map(p => p.name)
        setSuggestions(productNames)
      }
    }
    fetchSuggestions()
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

  return (
    <main ref={wrapperRef} className="max-w-md h-16 bg-white mx-auto fixed top-0 left-0 right-0 flex items-center px-4 z-100 border-b border-gray-100 ">
      <div className="relative w-full">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        
        <input
          type="text"
          placeholder="Cari Apa Lur?"
          value={query}
          onFocus={() => setShowSuggest(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setShowSuggest(true)
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch(query)}
          className="w-full h-10 rounded-full border text-gray-800 border-indigo-600 pl-10 pr-24 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {query && (
            <button onClick={() => setQuery("")} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          )}
          <button
            onClick={() => handleSearch(query)}
            className="bg-indigo-600 text-white text-xs px-4 py-1.5 rounded-full font-bold active:scale-95 transition-all"
          >
            Cari
          </button>
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
    </main>
  )
}