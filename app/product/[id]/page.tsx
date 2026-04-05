"use client"

import { useEffect, useState, useRef } from "react"
import { createPortal } from "react-dom"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import {
  ArrowLeft, Share2, Star, MapPin, X,
  Store, ShoppingCart, Heart, MessageCircle, Maximize2, Loader2,
  Plus, Link as LinkIcon, Facebook, Twitter
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
  const [cartCount, setCartCount] = useState(0)
  const [isScrolled, setIsScrolled] = useState(false)
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(0)
  const previewScrollRef = useRef<HTMLDivElement>(null)
  const { location: userLoc } = useUserLocation()

  // <-- TAMBAHAN: Pastikan hanya jalan di client
  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 80)
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    const fetchCart = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data: cartData } = await supabase
          .from("cart")
          .select("quantity")
          .eq("user_id", session.user.id)
        if (cartData) {
          const total = cartData.reduce((acc: number, item: { quantity: number }) => acc + item.quantity, 0)
          setCartCount(total)
        }
      }
    }
    fetchCart()
  }, [])

  useEffect(() => {
    const fetchDetail = async () => {
      const { data } = await supabase.from("products").select("*").eq("id", id).maybeSingle()
      if (data) {
        setProduct(data)
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

  const handleChatToko = async () => {
    if (!product) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
      return;
    }
    
    // Check if conversation already exists
    let convId = null;
    try {
       const shopId = shop?.id || product.shop_id;
       const { data: existing } = await supabase.from("shop_conversations")
         .select("id")
         .eq("buyer_id", session.user.id)
         .eq("shop_id", shopId)
         .maybeSingle();
         
       if (existing) {
         convId = existing.id;
       } else {
         // Create new conversation
         const { data: newConv, error } = await supabase.from("shop_conversations").insert([{
           buyer_id: session.user.id,
           shop_id: shopId
         }]).select('id').single();
         if (error) throw error;
         convId = newConv.id;
       }
       
       router.push(`/chat/shop/${convId}?product_id=${product.id}`);
    } catch {
       toast.error("Gagal memulai percakapan");
    }
  };

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
    } catch {
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

      setCartCount(prev => prev + 1)
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

  // Lock scroll when preview open
  useEffect(() => {
    if (isPreviewOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isPreviewOpen])

  if (loading) return <ProductDetailSkeleton />

  const imageList = product?.image_url
    ? (Array.isArray(product.image_url) ? product.image_url : [product.image_url])
    : []

  return (
    <div className="bg-white min-h-screen max-w-md mx-auto relative font-sans text-slate-800"
      style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
    >

      {/* IMAGE PREVIEW FULLSCREEN — PORTAL KE BODY */}
      {isPreviewOpen && isMounted && createPortal(
        <div className="fixed inset-0 z-[999] bg-black flex flex-col w-full h-full animate-fadeIn max-w-md mx-auto">
          {/* Header Area */}
          <div className="flex items-center justify-between px-4 h-16 shrink-0 z-50">
            <button
              onClick={() => setIsPreviewOpen(false)}
              className="text-white/80 hover:text-white p-2 bg-white/10 rounded-xl active:scale-95 transition-all"
            >
              <X size={24} />
            </button>
            {imageList.length > 1 && (
              <div className="text-white/90 text-xs font-black bg-white/10 px-4 py-2 rounded-full tracking-widest uppercase">
                {previewIndex + 1} / {imageList.length}
              </div>
            )}
            <div className="w-12" />
          </div>

          {/* Image Viewport */}
          <div className="flex-1 relative w-full overflow-hidden flex items-center justify-center">
            <div
              ref={previewScrollRef}
              className="absolute inset-0 flex overflow-x-auto snap-x snap-mandatory no-scrollbar"
              onScroll={(e) => {
                const el = e.currentTarget
                const idx = Math.round(el.scrollLeft / el.clientWidth)
                if (idx !== previewIndex) setPreviewIndex(idx)
              }}
            >
              {imageList.map((url: string, idx: number) => (
                <div key={idx} className="w-full h-full shrink-0 snap-center flex items-center justify-center p-4">
                  <div className="relative w-full h-full flex items-center justify-center">
                    <img
                      src={url}
                      alt="Preview"
                      className="max-w-full max-h-full object-contain pointer-events-none shadow-2xl"
                      draggable={false}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Controls (Dots) */}
          {imageList.length > 1 && (
            <div className="h-20 flex items-center justify-center shrink-0 z-50">
              <div className="flex gap-2.5">
                {imageList.map((_: string, idx: number) => (
                  <button
                    key={idx}
                    onClick={() => {
                      previewScrollRef.current?.scrollTo({
                        left: idx * (previewScrollRef.current?.clientWidth || 0),
                        behavior: 'smooth'
                      })
                    }}
                    className={`h-1.5 rounded-full transition-all duration-300 ${idx === previewIndex ? 'bg-white w-8' : 'bg-white/20 w-1.5'}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* NAVBAR ATAS */}
      <nav className={`fixed top-0 inset-x-0 z-50  transition-all duration-300 ${isScrolled ? 'opacity-0 pointer-events-none -translate-y-full' : 'opacity-100 translate-y-0'} flex items-center h-14 px-4 max-w-md mx-auto`}>
        <button onClick={() => router.back()} className="p-2 -ml-2 bg-black/20 rounded-full transition-colors shrink-0">
          <ArrowLeft size={20} className="text-white drop-shadow-md" />
        </button>

        <div className="flex-1"></div>

        <button onClick={() => setIsShareModalOpen(true)} className="p-2 bg-black/20 rounded-full transition-colors mr-2 shrink-0">
          <Share2 size={20} className="text-white drop-shadow-md" />
        </button>
        <button onClick={() => router.push("/cart")} className="p-2 bg-black/20 rounded-full transition-colors relative shrink-0">
          <ShoppingCart size={20} className="text-white drop-shadow-md" />
          {cartCount > 0 ? (
            <span className="absolute -top-1 -right-0.5 bg-red-500 text-white min-w-[16px] h-4 rounded-full text-[10px] flex items-center justify-center px-1 font-bold">
              {cartCount > 99 ? '99+' : cartCount}
            </span>
          ) : (
            <span className="absolute top-1 right-1 bg-red-500 w-2 h-2 rounded-full border-2 border-white"></span>
          )}
        </button>
      </nav>

      <div className="">
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
                    {product.rating ? product.rating.toFixed(1) : (reviews.length > 0 ? (reviews.reduce((acc: number, r: { rating: number }) => acc + r.rating, 0) / reviews.length).toFixed(1) : "Baru")}
                  </span>
                </div>
                <span className="text-xs text-slate-400">• {product.sold_count || 0} Terjual</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(() => {
                const shopLat = shop?.latitude || product.latitude
                const shopLon = shop?.longitude || product.longitude
                if (userLoc && shopLat && shopLon) {
                  const dist = calculateDistance(userLoc.latitude, userLoc.longitude, shopLat, shopLon)
                  const estMinutes = Math.round(dist * 2) // ~30km/h avg
                  return (
                    <div className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl shrink-0">
                      <MapPin size={14} className="text-indigo-500" />
                      <span className="text-[11px] font-bold text-indigo-600">
                        {formatDistance(dist)} | {estMinutes < 60 ? `${estMinutes} mnt` : `${Math.floor(estMinutes / 60)} jam ${estMinutes % 60} mnt`}
                      </span>
                    </div>
                  )
                }
                return null
              })()}
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
              {reviews.map((rev: { id: string; rating: number; reviewer_name?: string; comment?: string; photo_url?: string; created_at: string }) => (
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
        <div className="mt-2 bg-white border-t border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm p-2 font-bold text-slate-900">Rekomendasi Untukmu</h3>
            <button className="text-xs p-2 font-semibold text-slate-400 hover:text-slate-600">Lihat Semua</button>
          </div>
          <ProductList />
        </div>
      </div>

      {/* ========== BOTTOM ACTION BAR — PORTAL KE BODY ========== */}
      {isMounted && !isPreviewOpen && createPortal(
        <div
          className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md-w-md max-w-md mx-auto border-t border-slate-200 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <div className="flex items-center gap-2.5 px-4 py-3 max-w-md mx-auto">
            <button
              onClick={() => handleChatToko()}
              className="flex flex-col items-center justify-center text-slate-400 hover:text-indigo-600 transition-colors w-[3.2rem] shrink-0"
            >
              <MessageCircle size={22} strokeWidth={1.8} />
              <span className="text-[9px] font-bold mt-0.5">Chat Toko</span>
            </button>

            {/* KERANJANG */}
            <button
              onClick={() => handleAddToCart()}
              disabled={isProcessing}
              className="flex items-center justify-center bg-white border-2 border-indigo-800 text-indigo-800 w-[3.2rem] h-12 rounded-xl active:scale-95 transition-all disabled:opacity-50 shrink-0 gap-0.5 hover:bg-indigo-50"
            >
              {isProcessing ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  <Plus size={13} strokeWidth={3} className="-mr-1" />
                  <ShoppingCart size={17} strokeWidth={1.8} />
                </>
              )}
            </button>

            {/* BELI SEKARANG */}
            <button
              onClick={handleBuyNow}
              disabled={isProcessing}
              className="flex-1 bg-indigo-800 hover:bg-indigo-900 active:bg-indigo-950 text-white h-12 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:bg-slate-400 shadow-lg shadow-indigo-800/25 flex items-center justify-center"
            >
              {isProcessing ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                "Beli Sekarang"
              )}
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* SHARE MODAL — JUGA PORTAL */}
      {isShareModalOpen && isMounted && createPortal(
        <>
          <div className="fixed inset-0 bg-black/40 z-[90] animate-in fade-in" onClick={() => setIsShareModalOpen(false)}></div>
          <div
            className="fixed bottom-0 left-0 right-0 z-[100] bg-white rounded-t-3xl pt-4 px-6 animate-in slide-in-from-bottom flex flex-col shadow-2xl"
            style={{ paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg text-slate-800">Bagikan Produk</h3>
              <button onClick={() => setIsShareModalOpen(false)} className="bg-slate-50 p-2 rounded-full text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <button onClick={() => {
                const text = `Cek ${product?.name} di Warung Kita Mall! Harga Rp ${product?.price?.toLocaleString('id-ID')}\n${window.location.origin}/product/${id}`
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank")
                setIsShareModalOpen(false)
              }} className="flex flex-col items-center gap-2 group">
                <div className="w-14 h-14 rounded-full bg-green-500 text-white flex items-center justify-center group-hover:scale-105 transition-transform">
                  <MessageCircle size={24} />
                </div>
                <span className="text-[10px] font-bold text-slate-600">WhatsApp</span>
              </button>

              <button onClick={() => {
                const url = `${window.location.origin}/product/${id}`
                window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank")
                setIsShareModalOpen(false)
              }} className="flex flex-col items-center gap-2 group">
                <div className="w-14 h-14 rounded-full bg-blue-600 text-white flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Facebook size={24} />
                </div>
                <span className="text-[10px] font-bold text-slate-600">Facebook</span>
              </button>

              <button onClick={() => {
                const text = `Cek ${product?.name} di Warung Kita Mall! Harga Rp ${product?.price?.toLocaleString('id-ID')}`
                const url = `${window.location.origin}/product/${id}`
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank")
                setIsShareModalOpen(false)
              }} className="flex flex-col items-center gap-2 group">
                <div className="w-14 h-14 rounded-full bg-sky-500 text-white flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Twitter size={24} />
                </div>
                <span className="text-[10px] font-bold text-slate-600">Twitter</span>
              </button>

              <button onClick={() => {
                const url = `${window.location.origin}/product/${id}`
                navigator.clipboard.writeText(url)
                toast.success("Link produk disalin!")
                setIsShareModalOpen(false)
              }} className="flex flex-col items-center gap-2 group">
                <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <LinkIcon size={24} />
                </div>
                <span className="text-[10px] font-bold text-slate-600">Salin</span>
              </button>
            </div>

            {typeof navigator !== 'undefined' && navigator.share && (
              <div className="mt-8">
                <button onClick={() => {
                  navigator.share({
                    title: product?.name,
                    text: `Cek ${product?.name} di Warung Kita Mall! Harga Rp ${product?.price?.toLocaleString('id-ID')}`,
                    url: `${window.location.origin}/product/${id}`
                  }).catch(() => { })
                }} className="w-full py-3 bg-slate-50 hover:bg-slate-100 rounded-xl font-bold text-sm text-slate-600 transition-colors">
                  Opsi Lainnya
                </button>
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </div>
  )
}