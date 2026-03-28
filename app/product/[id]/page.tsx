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
import ProductDetailSkeleton from "@/app/components/ProductDetailSkeleton"
import { calculateDistance, formatDistance } from "@/lib/geo"
import { useUserLocation } from "@/hooks/useUserLocation"

export default function ProductDetail() {
  const { id } = useParams()
  const router = useRouter()
  const [product, setProduct] = useState<any>(null)
  const [shop, setShop] = useState<any>(null)
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [wishlistLoading, setWishlistLoading] = useState(false)
  const { location: userLoc } = useUserLocation()

  useEffect(() => {
    const fetchDetail = async () => {
      const { data } = await supabase.from("products").select("*").eq("id", id).maybeSingle()
      if (data) {
        setProduct(data)
        // Fetch associated shop
        if (data.shop_id) {
          const { data: shopData } = await supabase.from("shops").select("id, name, slug, image_url, address, latitude, longitude").eq("id", data.shop_id).maybeSingle()
          if (shopData) setShop(shopData)
        }

        const { data: revData, error } = await supabase
          .from("product_reviews")
          .select("id, rating, comment, reviewer_name, photo_url, created_at")
          .eq("product_id", id)
          .order("created_at", { ascending: false })
        if (revData && !error) {
           setReviews(revData)
        }
      }
      setLoading(false)
    }
    fetchDetail()
  }, [id])

  // Cek apakah sudah di wishlist
  useEffect(() => {
    const checkWishlist = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || !id) return

      const { data } = await supabase
        .from("wishlists")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("product_id", id)
        .maybeSingle()

      setIsWishlisted(!!data)
    }
    checkWishlist()
  }, [id])

  const handleToggleWishlist = async () => {
    setWishlistLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push("/login")
      setWishlistLoading(false)
      return
    }

    try {
      if (isWishlisted) {
        await supabase
          .from("wishlists")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", id)
        setIsWishlisted(false)
        toast.success("Dihapus dari wishlist")
      } else {
        await supabase
          .from("wishlists")
          .insert([{ user_id: user.id, product_id: id }])
        setIsWishlisted(true)
        toast.success("Ditambahkan ke wishlist ❤️")
      }
    } catch (error) {
      toast.error("Gagal mengupdate wishlist")
    } finally {
      setWishlistLoading(false)
    }
  }

  const handleShare = async () => {
    const url = `${window.location.origin}/product/${id}`
    const shareData = {
      title: product?.name || "Produk Warung Kita Mall",
      text: `Cek ${product?.name} di Warung Kita Mall! Harga Rp ${product?.price?.toLocaleString('id-ID')}`,
      url
    }

    try {
      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(url)
        toast.success("Link produk disalin!")
      }
    } catch (error) {
      // User cancelled share
    }
  }

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

  if (loading) return <ProductDetailSkeleton />

  const imageList = product?.image_url
    ? (Array.isArray(product.image_url) ? product.image_url : [product.image_url])
    : []

  return (
    <div className="bg-white min-h-screen pb-28 max-w-md mx-auto relative font-sans text-slate-800">

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

      {/* NAVBAR ATAS */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-100 flex items-center h-14 px-4 max-w-md mx-auto">
        <button onClick={() => router.back()} className="p-2 -ml-2 hover:bg-slate-50 rounded-xl transition-colors">
          <ArrowLeft size={20} className="text-slate-700" />
        </button>
        <div className="flex-1"></div>
        <button onClick={handleShare} className="p-2 hover:bg-slate-50 rounded-xl transition-colors mr-1">
          <Share2 size={20} className="text-slate-500" />
        </button>
        <button onClick={() => router.push("/cart")} className="p-2 hover:bg-slate-50 rounded-xl transition-colors relative">
          <ShoppingCart size={20} className="text-slate-700" />
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
                  <span className="text-xs font-bold text-amber-600">
                     {product.rating ? product.rating.toFixed(1) : (reviews.length > 0 ? (reviews.reduce((acc: any, r: any) => acc + r.rating, 0) / reviews.length).toFixed(1) : "Baru")}
                  </span>
                </div>
                <span className="text-xs text-slate-400">• {product.sold_count || 0} Terjual</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push(`/chat/live?product=${id}`)}
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-100 rounded-xl text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all active:scale-90 shrink-0"
              >
                <MessageCircle size={16} />
                <span className="text-[11px] font-bold">Chat Penjual</span>
              </button>
              <button
                onClick={handleToggleWishlist}
                disabled={wishlistLoading}
                className={`p-2 border rounded-xl transition-all shrink-0 active:scale-90 ${isWishlisted
                  ? 'border-red-200 bg-red-50'
                  : 'border-slate-100 hover:bg-slate-50'
                  }`}
              >
                {wishlistLoading ? (
                  <Loader2 size={20} className="animate-spin text-slate-400" />
                ) : (
                  <Heart size={20} className={isWishlisted ? 'text-red-500 fill-red-500' : 'text-slate-400'} />
                )}
              </button>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-100/80 flex items-end justify-between gap-4">
            <div>
              <p className="text-2xl font-bold text-red-600 tracking-tight">
                Rp {product.price?.toLocaleString('id-ID')}
              </p>
              {product.original_price && (
                <p className="text-sm text-slate-400 line-through mt-1">
                  Rp {product.original_price?.toLocaleString('id-ID')}
                </p>
              )}
            </div>
            {shop && (
              <a href={`/shop/${shop.slug}`} className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 transition-colors active:scale-95 shrink-0">
                <div className="w-7 h-7 rounded-lg bg-white border border-slate-100 overflow-hidden flex items-center justify-center">
                  {shop.image_url ? (
                    <img src={shop.image_url} className="w-full h-full object-cover" alt={shop.name} />
                  ) : (
                    <Store size={14} className="text-slate-400" />
                  )}
                </div>
                <span className="text-xs font-bold text-slate-700 max-w-[100px] truncate">{shop.name}</span>
              </a>
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
              <p className="text-xs font-semibold text-slate-700 mt-0.5">
                Dari <span className="text-slate-900">{shop?.address || product.location || "Gudang Utama"}</span>
                {userLoc && (shop?.latitude || product.latitude) && (shop?.longitude || product.longitude) && (
                  <span className="ml-1 text-indigo-600 font-bold">
                    ({formatDistance(calculateDistance(userLoc.latitude, userLoc.longitude, shop?.latitude || product.latitude, shop?.longitude || product.longitude))} dari lokasi anda)
                  </span>
                )}
              </p>
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

        {/* ULASAN PEMBELI */}
        <div className="mt-2 bg-white p-5 border-t border-slate-100">
           <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-900">Ulasan Pembeli ({reviews.length})</h3>
           </div>
           
           {reviews.length > 0 ? (
              <div className="space-y-5">
                 {reviews.map((rev: any) => (
                    <div key={rev.id} className="border-b border-slate-50 pb-5 last:border-0 last:pb-0">
                       <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                             <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100 shrink-0">
                                <span className="text-xs font-bold text-indigo-500">
                                  {(rev.reviewer_name || "PB").slice(0, 2).toUpperCase()}
                                </span>
                             </div>
                             <div>
                                <p className="text-[11px] font-bold text-slate-700">
                                  {rev.reviewer_name || "Pembeli"}
                                </p>
                                <div className="flex gap-0.5 mt-0.5">
                                   {[1, 2, 3, 4, 5].map(star => (
                                      <Star key={star} size={10} className={star <= rev.rating ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-100"} />
                                   ))}
                                </div>
                             </div>
                          </div>
                          <span className="text-[9px] text-slate-400 bg-slate-50 px-2 py-1 rounded-md shrink-0">
                            {new Date(rev.created_at).toLocaleDateString('id-ID')}
                          </span>
                       </div>
                       {rev.comment && <p className="text-xs text-slate-600 mt-2 leading-relaxed pl-10">{rev.comment}</p>}
                       {rev.photo_url && (
                         <div className="pl-10 mt-2">
                           <img
                             src={rev.photo_url}
                             alt="Foto ulasan"
                             className="w-28 h-28 object-cover rounded-xl border border-slate-100 cursor-pointer hover:opacity-90 transition-opacity"
                             onClick={() => window.open(rev.photo_url, '_blank')}
                           />
                         </div>
                       )}
                    </div>
                 ))}
              </div>
           ) : (
              <div className="py-8 flex flex-col items-center justify-center text-center bg-slate-50 rounded-[1rem] border border-slate-100/50 outline-dashed outline-1 outline-slate-200">
                 <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm text-slate-300">
                    <MessageCircle size={20} />
                 </div>
                 <p className="text-sm font-bold text-slate-700">Belum ada ulasan</p>
                 <p className="text-xs text-slate-400 mt-1 max-w-[200px]">Jadilah yang pertama memberikan ulasan untuk produk ini!</p>
              </div>
           )}
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

      {/* BOTTOM ACTION BAR */}
      <div className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-100 max-w-md mx-auto p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="flex flex-col items-center justify-center text-slate-500 hover:text-slate-700 transition-colors w-12 shrink-0"
          >
            <Store size={22} />
            <span className="text-[9px] font-semibold mt-0.5">Toko</span>
          </button>

          <button
            onClick={() => handleAddToCart()}
            disabled={isProcessing}
            className="flex items-center justify-center bg-white border-2 border-indigo-800 text-indigo-800 w-14 h-12 rounded-xl active:scale-95 transition-all disabled:opacity-50 shrink-0"
          >
            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <ShoppingCart size={18} />}
          </button>

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