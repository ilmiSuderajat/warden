"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import {
  ArrowLeft, Share2, Star, MapPin, X,
  Store, ShoppingCart, Heart, MessageCircle, Maximize2, Loader2
} from "lucide-react"
import ProductImageSlider from "@/app/components/ProductImageSlider"
import ProductList from "@/app/components/ProductList"

export default function ProductDetail() {
  const { id } = useParams()
  const router = useRouter()
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  useEffect(() => {
    const fetchDetail = async () => {
      const { data } = await supabase.from("products").select("*").eq("id", id).maybeSingle()
      if (data) setProduct(data)
      setLoading(false)
    }
    fetchDetail()
  }, [id])

  const handleAddToCart = async (silent = false) => {
    setIsProcessing(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push("/login")
      setIsProcessing(false)
      return
    }

    try {
      const { data: existingItem } = await supabase
        .from("cart")
        .select("*")
        .eq("user_id", user.id)
        .eq("product_id", product.id)
        .maybeSingle()

      if (existingItem) {
        await supabase
          .from("cart")
          .update({ quantity: existingItem.quantity + 1 })
          .eq("id", existingItem.id)
      } else {
        await supabase
          .from("cart")
          .insert([{ user_id: user.id, product_id: product.id, quantity: 1 }])
      }

      if (!silent) toast.success("Ditambahkan ke keranjang!")
    } catch (error) {
      console.error(error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleBuyNow = async () => {
    await handleAddToCart(true)
    router.push("/checkout")
  }

  if (loading) return (
    <div className="h-screen max-w-md mx-auto text-center flex flex-col items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-slate-400 mb-3" size={28} />
      <p className="text-xs font-medium text-slate-400">Memuat produk...</p>
    </div>
  )

  const imageList = product?.image_url
    ? (Array.isArray(product.image_url) ? product.image_url : [product.image_url])
    : []

  return (
    <div className="bg-slate-50/80 min-h-screen pb-28 max-w-md mx-auto relative font-sans text-slate-800">

      {/* IMAGE PREVIEW FULLSCREEN */}
      {isPreviewOpen && (
        <div className="fixed max-w-md mx-auto inset-0 z-100 bg-black flex flex-col justify-center items-center animate-in fade-in">
          <button onClick={() => setIsPreviewOpen(false)} className="absolute top-6 right-6 text-white/80 hover:text-white p-2 bg-white/10 rounded-full z-10">
            <X size={24} />
          </button>
          <div className="w-full h-full flex items-center">
            <ProductImageSlider images={imageList} name={product.name} />
          </div>
        </div>
      )}

      {/* NAVBAR ATAS (Clean Style) */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100 flex items-center h-14 px-4 max-w-md mx-auto">
        <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-slate-50 rounded-xl transition-colors">
          <ArrowLeft size={20} className="text-slate-700" />
        </button>
        <div className="flex-1"></div>
        <button className="p-2 hover:bg-slate-50 rounded-xl transition-colors mr-1">
          <Share2 size={20} className="text-slate-500" />
        </button>
        <button onClick={() => router.push("/cart")} className="p-2 hover:bg-slate-50 rounded-xl transition-colors relative">
          <ShoppingCart size={20} className="text-slate-700" />
          {/* Indicator merah bisa diganti logic count keranjang nanti */}
          <span className="absolute top-1.5 right-1.5 bg-red-500 w-2 h-2 rounded-full border-2 border-white"></span>
        </button>
      </nav>

      <div className="pt-14">
        {/* SLIDER GAMBAR */}
        <div className="bg-white relative aspect-square cursor-zoom-in group" onClick={() => setIsPreviewOpen(true)}>
          <ProductImageSlider images={imageList} name={product.name} />
          <div className="absolute bottom-4 right-4 bg-black/40 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
            <Maximize2 size={16} />
          </div>
        </div>

        {/* INFO PRODUK */}
        <div className="bg-white p-5 border-b border-slate-100">
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1">
              <h1 className="text-lg font-bold text-slate-900 leading-tight mb-2">{product.name}</h1>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full">
                  <Star size={12} className="text-amber-400 fill-amber-400" />
                  <span className="text-xs font-bold text-amber-600">{product.rating || "5.0"}</span>
                </div>
                <span className="text-xs text-slate-400">• {product.sold_count || "0"} Terjual</span>
              </div>
            </div>
            <button className="p-2 border border-slate-100 rounded-xl hover:bg-slate-50 transition-colors shrink-0">
              <Heart size={20} className="text-slate-400 hover:text-red-500" />
            </button>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100/80">
            <p className="text-2xl font-bold text-red-600 tracking-tight">
              Rp {product.price?.toLocaleString('id-ID')}
            </p>
            {product.original_price && (
              <p className="text-sm text-slate-400 line-through mt-1">
                Rp {product.original_price?.toLocaleString('id-ID')}
              </p>
            )}
          </div>
        </div>

        {/* LOKASI PENGIRIMAN */}
        <div className="mt-2 bg-white px-5 py-4 flex justify-between items-center border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="bg-slate-50 p-2 rounded-xl text-slate-400">
              <MapPin size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Pengiriman</p>
              <p className="text-xs font-semibold text-slate-700 mt-0.5">Dari <span className="text-slate-900">{product.location || "Gudang Utama"}</span></p>
            </div>
          </div>
        </div>

        {/* DESKRIPSI */}
        <div className="mt-2 bg-white p-5">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Deskripsi</h3>
          <div className="text-sm leading-relaxed text-slate-600 whitespace-pre-line">
            {product.description || "Tidak ada deskripsi."}
          </div>
        </div>

        {/* PRODUK TERKAIT */}
        <div className="mt-2 bg-white p-5 border-t border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-slate-900">Rekomendasi Untukmu</h3>
            <button className="text-xs font-semibold text-slate-400 hover:text-slate-600">Lihat Semua</button>
          </div>
          <ProductList />
        </div>
      </div>

      {/* BOTTOM ACTION BAR - Clean & Solid */}
      <div className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-100 max-w-md mx-auto p-4">
        <div className="flex items-center gap-3">
          {/* Tombol Chat/Toko */}
          <button
            onClick={() => router.push("/")}
            className="flex flex-col items-center justify-center text-slate-500 hover:text-slate-700 transition-colors w-12 shrink-0"
          >
            <Store size={22} />
            <span className="text-[9px] font-semibold mt-0.5">Toko</span>
          </button>

          {/* Tombol Keranjang */}
          <button
            onClick={() => handleAddToCart()}
            disabled={isProcessing}
            className="flex items-center justify-center bg-white border-2 border-indigo-800 text-indigo-800 w-14 h-12 rounded-xl active:scale-95 transition-all disabled:opacity-50 shrink-0"
          >
            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <ShoppingCart size={18} />}
          </button>

          {/* Tombol Beli Sekarang */}
          <button
            onClick={handleBuyNow}
            disabled={isProcessing}
            className="flex-1 bg-indigo-800 hover:bg-slate-800 text-white h-12 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:bg-slate-400 shadow-sm flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <span>Beli Sekarang</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}