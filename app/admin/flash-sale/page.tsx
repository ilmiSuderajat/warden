"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { ArrowLeft, Loader2, Zap, Clock, ToggleLeft, ToggleRight, CheckCircle, Search, Hash } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export default function ManageFlashSalePage() {
  const router = useRouter()

  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const [editingSoldCount, setEditingSoldCount] = useState<{ id: string; value: string } | null>(null)
  const [savingSoldCount, setSavingSoldCount] = useState(false)
  const [endDate, setEndDate] = useState("")
  const [savingDate, setSavingDate] = useState(false)
  const [activeBanner, setActiveBanner] = useState<any>(null)

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)

      // Semua produk + status flash sale
      const { data: pData } = await supabase
        .from("products")
        .select("id, name, price, original_price, image_url, is_flash_sale, sold_count")
        .order("name")
      if (pData) setProducts(pData)

      // Banner aktif untuk end_date
      const { data: bData } = await supabase
        .from("flash_sale_banners")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (bData) {
        setActiveBanner(bData)
        setEndDate(bData.end_date ? new Date(bData.end_date).toISOString().slice(0, 16) : "")
      }

      setLoading(false)
    }

    fetchAll()
  }, [])

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const activeCount = products.filter(p => p.is_flash_sale).length

  // Toggle flash sale produk
  const handleToggle = async (product: any) => {
    setToggling(product.id)
    const newVal = !product.is_flash_sale

    const { error } = await supabase
      .from("products")
      .update({ is_flash_sale: newVal })
      .eq("id", product.id)

    if (error) {
      toast.error("Gagal mengubah status")
    } else {
      setProducts(prev =>
        prev.map(p => p.id === product.id ? { ...p, is_flash_sale: newVal } : p)
      )
      toast.success(newVal
        ? `⚡ ${product.name} masuk Flash Sale`
        : `${product.name} dikeluarkan dari Flash Sale`
      )
    }
    setToggling(null)
  }

  // Simpan sold_count
  const handleSaveSoldCount = async () => {
    if (!editingSoldCount) return
    setSavingSoldCount(true)

    const { error } = await supabase
      .from("products")
      .update({ sold_count: parseInt(editingSoldCount.value) || 0 })
      .eq("id", editingSoldCount.id)

    setSavingSoldCount(false)
    if (error) {
      toast.error("Gagal menyimpan")
    } else {
      setProducts(prev =>
        prev.map(p => p.id === editingSoldCount.id
          ? { ...p, sold_count: parseInt(editingSoldCount.value) || 0 }
          : p
        )
      )
      toast.success("Simulasi terjual diperbarui!")
      setEditingSoldCount(null)
    }
  }

  // Simpan countdown ke flash_sale_banners
  const handleSaveCountdown = async () => {
    if (!endDate) return toast.error("Pilih waktu berakhir dulu!")
    setSavingDate(true)

    const isoDate = new Date(endDate).toISOString()
    let error

    if (activeBanner?.id) {
      ; ({ error } = await supabase
        .from("flash_sale_banners")
        .update({ end_date: isoDate })
        .eq("id", activeBanner.id))
    } else {
      const { data, error: insertError } = await supabase
        .from("flash_sale_banners")
        .insert({ title: "Flash Sale", image_url: "", end_date: isoDate, is_active: true })
        .select()
        .single()
      error = insertError
      if (data) setActiveBanner(data)
    }

    setSavingDate(false)
    if (error) toast.error("Gagal simpan: " + error.message)
    else toast.success("Countdown berhasil disimpan! ⚡")
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans max-w-md mx-auto pb-10">

      {/* HEADER */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="flex items-center justify-between px-5 pt-12 pb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
            >
              <ArrowLeft size={20} strokeWidth={2.5} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Flash Sale</h1>
              <p className="text-[10px] font-medium text-slate-400">Kelola produk & countdown</p>
            </div>
          </div>
          {activeCount > 0 && (
            <div className="flex items-center gap-1 bg-orange-50 px-2.5 py-1 rounded-full border border-orange-100">
              <Zap size={11} className="text-orange-500 fill-orange-500" />
              <span className="text-[10px] font-bold text-orange-500">{activeCount} Aktif</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* ── COUNTDOWN ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-slate-50 flex items-center gap-3">
            <div className="p-2 bg-indigo-50 rounded-xl">
              <Clock size={16} className="text-indigo-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Countdown Timer</h3>
              <p className="text-[10px] text-slate-400">
                {activeBanner?.end_date
                  ? `Aktif · berakhir ${new Date(activeBanner.end_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                  : "Belum diset"
                }
              </p>
            </div>
          </div>

          <div className="p-4 space-y-3">
            <input
              type="datetime-local"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 outline-none focus:ring-1 focus:ring-indigo-400 transition-all"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />

            {endDate && (
              <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-xl">
                <CheckCircle size={12} className="text-indigo-400 flex-shrink-0" />
                <span className="text-[11px] text-indigo-600 font-medium">
                  {new Date(endDate).toLocaleString("id-ID", {
                    weekday: "long", day: "numeric", month: "long",
                    hour: "2-digit", minute: "2-digit"
                  })}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSaveCountdown}
              disabled={savingDate || !endDate}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-200 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {savingDate
                ? <><Loader2 size={14} className="animate-spin" />Menyimpan...</>
                : <><Clock size={14} />Simpan Countdown</>
              }
            </button>
          </div>
        </div>

        {/* ── PRODUCT LIST ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-slate-50 flex items-center gap-3">
            <div className="p-2 bg-orange-50 rounded-xl">
              <Zap size={16} className="text-orange-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Produk Flash Sale</h3>
              <p className="text-[10px] text-slate-400">Toggle untuk aktif/nonaktif</p>
            </div>
          </div>

          {/* Search */}
          <div className="px-4 py-3 border-b border-slate-50">
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari produk..."
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:ring-1 focus:ring-slate-200 transition-all placeholder:text-slate-300"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 size={20} className="animate-spin text-slate-300" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-10">Produk tidak ditemukan</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {filteredProducts.map(p => {
                const img = Array.isArray(p.image_url) ? p.image_url[0] : p.image_url
                const isOn = p.is_flash_sale
                const isToggling = toggling === p.id

                return (
                  <div
                    key={p.id}
                    className={`transition-colors ${isOn ? "bg-orange-50/50" : "bg-white"}`}
                  >
                    {/* Row utama */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      {/* Thumbnail */}
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                        {img
                          ? <img src={img} alt={p.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><Zap size={14} className="text-slate-300" /></div>
                        }
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold truncate ${isOn ? "text-slate-900" : "text-slate-700"}`}>
                          {p.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-[10px] font-bold ${isOn ? "text-orange-500" : "text-slate-400"}`}>
                            Rp {(p.price || 0).toLocaleString("id-ID")}
                          </span>
                          {p.original_price && isOn && (
                            <span className="text-[9px] text-slate-300 line-through">
                              Rp {p.original_price.toLocaleString("id-ID")}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Toggle */}
                      <button
                        type="button"
                        onClick={() => handleToggle(p)}
                        disabled={isToggling}
                        className="flex-shrink-0 transition-transform active:scale-95"
                      >
                        {isToggling
                          ? <Loader2 size={24} className="animate-spin text-slate-300" />
                          : isOn
                            ? <ToggleRight size={32} className="text-orange-500" />
                            : <ToggleLeft size={32} className="text-slate-300" />
                        }
                      </button>
                    </div>

                    {/* Simulasi terjual — hanya muncul kalau flash sale aktif */}
                    {isOn && (
                      <div className="px-4 pb-3">
                        {editingSoldCount?.id === p.id ? (
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <Hash size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                              <input
                                type="number"
                                min="0"
                                autoFocus
                                placeholder="Jumlah terjual"
                                className="w-full pl-8 pr-3 py-2 bg-white border border-orange-200 rounded-xl text-xs text-slate-700 outline-none focus:ring-1 focus:ring-orange-400 transition-all"
                                value={editingSoldCount.value}
                                onChange={e => setEditingSoldCount({ id: p.id, value: e.target.value })}
                                onKeyDown={e => {
                                  if (e.key === "Enter") handleSaveSoldCount()
                                  if (e.key === "Escape") setEditingSoldCount(null)
                                }}
                              />
                            </div>
                            <button
                              type="button"
                              onClick={handleSaveSoldCount}
                              disabled={savingSoldCount}
                              className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-all active:scale-95 flex items-center gap-1"
                            >
                              {savingSoldCount ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                              Simpan
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingSoldCount(null)}
                              className="px-2 py-2 text-slate-400 hover:text-slate-600 text-xs rounded-xl transition-all"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingSoldCount({ id: p.id, value: String(p.sold_count || 0) })}
                            className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-orange-500 transition-colors group/sold"
                          >
                            <Hash size={10} className="group-hover/sold:text-orange-500" />
                            <span>Simulasi terjual: <span className="font-bold text-slate-600">{p.sold_count || 0}</span></span>
                            <span className="text-indigo-400 font-semibold">· Edit</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}