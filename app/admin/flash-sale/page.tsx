"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { 
  ArrowLeft, Loader2, Zap, Clock, ToggleLeft, ToggleRight, 
  CheckCircle, Search, Hash, ImagePlus, ChevronRight, Check, 
  Link as LinkIcon, Tag, Info
} from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import imageCompression from "browser-image-compression"

export default function ManageFlashSalePage() {
  const router = useRouter()

  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const [editingSoldCount, setEditingSoldCount] = useState<{ id: string; value: string } | null>(null)
  const [savingSoldCount, setSavingSoldCount] = useState(false)
  const [endDate, setEndDate] = useState("")
  const [activeBanner, setActiveBanner] = useState<any>(null)
 
  const [bannerTitle, setBannerTitle] = useState("")
  const [discountText, setDiscountText] = useState("")
  const [linkUrl, setLinkUrl] = useState("")
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState("")
  const [savingBanner, setSavingBanner] = useState(false)

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)

      const { data: pData } = await supabase
        .from("products")
        .select("id, name, price, original_price, image_url, is_flash_sale, sold_count")
        .order("name")
      if (pData) setProducts(pData)

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
        setBannerTitle(bData.title || "")
        setDiscountText(bData.discount_text || "")
        setLinkUrl(bData.link_url || "")
        setImagePreview(bData.image_url || "")
      }

      setLoading(false)
    }

    fetchAll()
  }, [])

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const activeCount = products.filter(p => p.is_flash_sale).length

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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setImageFile(file)
      const reader = new FileReader()
      reader.onloadend = () => setImagePreview(reader.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleSaveBanner = async () => {
    if (!endDate) return toast.error("Pilih waktu berakhir dulu!")
    setSavingBanner(true)

    try {
      let finalImageUrl = activeBanner?.image_url || ""

      if (imageFile) {
        const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1200, useWebWorker: true }
        const compressed = await imageCompression(imageFile, options)
        const ext = imageFile.name.split('.').pop()
        const fileName = `flash-sale-${Date.now()}.${ext}`

        const { error: uploadErr } = await supabase.storage
          .from("product-images")
          .upload(fileName, compressed)

        if (uploadErr) throw uploadErr

        const { data: { publicUrl } } = supabase.storage
          .from("product-images")
          .getPublicUrl(fileName)

        finalImageUrl = publicUrl
      }

      const isoDate = new Date(endDate).toISOString()
      const payload = {
        title: bannerTitle || "Flash Sale",
        image_url: finalImageUrl,
        discount_text: discountText,
        link_url: linkUrl,
        end_date: isoDate,
        is_active: true
      }

      let error
      if (activeBanner?.id) {
        ; ({ error } = await supabase
          .from("flash_sale_banners")
          .update(payload)
          .eq("id", activeBanner.id))
      } else {
        const { data, error: insertError } = await supabase
          .from("flash_sale_banners")
          .insert(payload)
          .select()
          .single()
        error = insertError
        if (data) setActiveBanner(data)
      }

      if (error) throw error
      toast.success("Banner Flash Sale berhasil diperbarui! ⚡")
    } catch (err: any) {
      toast.error("Gagal simpan: " + err.message)
    } finally {
      setSavingBanner(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans max-w-md mx-auto pb-24 selection:bg-orange-100">

      {/* HEADER */}
      <div className="bg-white sticky top-0 z-40 border-b border-slate-100/60 backdrop-blur-md bg-white/80">
        <div className="px-5 pt-12 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin')}
              className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
            >
              <ArrowLeft size={20} strokeWidth={2.5} />
            </button>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">Flash Sale</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Atur Countdown & Produk</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border transition-all ${activeCount > 0 ? 'bg-orange-50 border-orange-100 text-orange-600 animate-pulse' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
              <Zap size={11} className={activeCount > 0 ? "fill-orange-400" : ""} />
              <span className="text-[10px] font-black uppercase tracking-tight">{activeCount} Produk</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-5">

        {/* ── BANNER & COUNTDOWN PREMIUM ── */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden p-6 space-y-5">
            <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-orange-50 text-orange-500 rounded-2xl">
                    <Clock size={20} strokeWidth={2.5} />
                </div>
                <div>
                   <h3 className="text-base font-black text-slate-800 tracking-tight">Visi & Waktu</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Konfigurasi Banner Utama</p>
                </div>
            </div>

            <div className="space-y-4">
                {/* Upload Gambar Banner Premium Look */}
                <div className="group">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Hero Image Flash Sale</label>
                    <label className="block aspect-[21/9] bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 cursor-pointer overflow-hidden hover:border-orange-300 transition-all relative">
                        {imagePreview ? (
                            <img src={imagePreview} className="w-full h-full object-cover" alt="preview" />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-slate-300">
                                <ImagePlus size={32} strokeWidth={1.5} />
                                <span className="text-[9px] mt-2 font-black uppercase tracking-tighter">Pilih Visual Banner</span>
                            </div>
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                    </label>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                       <Hash size={10} className="text-orange-400" /> Judul Kampanye
                    </label>
                    <input
                        type="text"
                        placeholder="Flash Sale Lebaran / Akhir Pekan"
                        value={bannerTitle}
                        onChange={e => setBannerTitle(e.target.value)}
                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-orange-100 transition-all"
                    />
                </div>

                <div className="grid grid-cols-2 gap-3">
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                         <Tag size={10} className="text-orange-400" /> Label Diskon
                      </label>
                      <input
                          type="text"
                          placeholder="Diskon s/d 50%"
                          value={discountText}
                          onChange={e => setDiscountText(e.target.value)}
                          className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-orange-100 transition-all"
                      />
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                         <LinkIcon size={10} className="text-orange-400" /> URL Link
                      </label>
                      <input
                          type="text"
                          placeholder="/flash-sale"
                          value={linkUrl}
                          onChange={e => setLinkUrl(e.target.value)}
                          className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-orange-100 transition-all"
                      />
                   </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Waktu Berakhir (Countdown)</label>
                    <div className="relative">
                        <input
                            type="datetime-local"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-orange-100 transition-all appearance-none"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><Clock size={16} /></div>
                    </div>
                </div>

                {endDate && (
                    <div className="p-3 bg-orange-50/50 rounded-2xl border border-orange-100/50 flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 shrink-0"><Check size={14} strokeWidth={3} /></div>
                         <p className="text-[10px] font-bold text-orange-700 leading-tight">
                            Akan Berakhir pada:<br/>
                            <span className="uppercase">{new Date(endDate).toLocaleString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
                         </p>
                    </div>
                )}

                <button
                    onClick={handleSaveBanner}
                    disabled={savingBanner || !endDate}
                    className="group w-full bg-orange-600 p-4 rounded-2xl flex items-center justify-center gap-3 text-white shadow-xl shadow-orange-100 hover:bg-orange-700 active:scale-[0.98] transition-all disabled:bg-slate-200 disabled:shadow-none"
                >
                    {savingBanner ? <Loader2 size={20} className="animate-spin" /> : <Zap size={20} className="fill-white" />}
                    <span className="font-black text-sm uppercase tracking-widest">{savingBanner ? "Menyimpan..." : "Publish Flash Sale"}</span>
                </button>
            </div>
        </div>

        {/* ── PRODUCT SELECTION PREMIUM ── */}
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-50 text-indigo-500 rounded-2xl">
                        <Tag size={20} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-slate-800 tracking-tight">Kurasi Produk</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pilih Item Promo</p>
                    </div>
                </div>
                <div className="relative min-w-[140px]">
                   <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                   <input
                    type="text"
                    placeholder="Search keywords..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-100 rounded-full text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-100 transition-all font-sans"
                   />
                </div>
            </div>

            <div className="p-3 bg-indigo-50/50 rounded-2xl border border-indigo-100/50 flex items-start gap-3">
               <Info size={14} className="text-indigo-400 mt-0.5 shrink-0" />
               <p className="text-[9px] font-bold text-indigo-700 leading-tight">
                  Geser toggle pada produk yang ingin diikutkan dalam kampanye Flash Sale saat ini. Produk akan mendapatkan prioritas di halaman depan.
               </p>
            </div>

            {loading ? (
                [1,2,3].map(i => <div key={i} className="h-24 bg-slate-50 rounded-2xl animate-pulse" />)
            ) : filteredProducts.length === 0 ? (
                <div className="py-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200 text-center">
                    <p className="text-xs font-bold text-slate-300">Produk tidak ditemukan</p>
                </div>
            ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {filteredProducts.map(p => {
                        const img = Array.isArray(p.image_url) ? p.image_url[0] : p.image_url
                        const isOn = p.is_flash_sale
                        const isToggling = toggling === p.id

                        return (
                            <div
                                key={p.id}
                                className={`rounded-2xl border p-3 transition-all flex items-center gap-3 ${isOn ? 'border-orange-200 bg-orange-50/20' : 'border-slate-50 bg-slate-50/50 hover:bg-slate-50'}`}
                            >
                                <div className={`w-14 h-14 rounded-xl overflow-hidden border p-0.5 shrink-0 ${isOn ? 'border-orange-200 bg-orange-50' : 'border-slate-100 bg-white'}`}>
                                    {img ? <img src={img} className="w-full h-full object-cover rounded-lg" alt={p.name} /> : <Zap size={20} className="text-slate-200" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h4 className="text-xs font-black text-slate-800 truncate tracking-tight">{p.name}</h4>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className={`text-[10px] font-black ${isOn ? 'text-orange-600' : 'text-slate-400'}`}>Rp {(p.price || 0).toLocaleString("id-ID")}</span>
                                        {isOn && (
                                           <div className="flex items-center gap-1">
                                              {editingSoldCount?.id === p.id ? (
                                                  <div className="flex items-center gap-1">
                                                      <input 
                                                          autoFocus
                                                          type="number"
                                                          value={editingSoldCount.value}
                                                          onChange={e => setEditingSoldCount({...editingSoldCount, value: e.target.value})}
                                                          className="w-10 px-1 py-0.5 bg-white border border-orange-200 rounded text-[9px] font-black outline-none"
                                                      />
                                                      <button onClick={handleSaveSoldCount} className="text-[8px] font-black text-orange-600">YES</button>
                                                  </div>
                                              ) : (
                                                  <button 
                                                      onClick={() => setEditingSoldCount({ id: p.id, value: String(p.sold_count || 0) })}
                                                      className="text-[9px] font-bold text-orange-400 lowercase px-1.5 bg-white rounded border border-orange-100"
                                                  >
                                                     Sim: {p.sold_count || 0}
                                                  </button>
                                              )}
                                           </div>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleToggle(p)}
                                    disabled={isToggling}
                                    className={`shrink-0 transition-transform active:scale-90 ${isToggling ? 'opacity-50' : ''}`}
                                >
                                    {isToggling ? (
                                        <Loader2 size={24} className="animate-spin text-orange-500" />
                                    ) : isOn ? (
                                        <ToggleRight size={38} className="text-orange-600" strokeWidth={1} />
                                    ) : (
                                        <ToggleLeft size={38} className="text-slate-200" strokeWidth={1} />
                                    )}
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
      </div>
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  )
}

function X({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
  )
}