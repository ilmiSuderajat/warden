"use client"
import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { 
  ChevronLeft, Share2, Star, MapPin, X, 
  Store, ShoppingCart, Heart, MoreVertical, ChevronRight, Maximize2
} from "lucide-react"
import ProductImageSlider from "@/app/components/ProductImageSlider"
import ProductList from "@/app/components/ProductList"

export default function ProductDetail() {
  const { id } = useParams()
  const router = useRouter()
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [customerData, setCustomerData] = useState({ name: "", whatsapp: "", address: "" })
  
  // State untuk Full Screen Image
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  useEffect(() => {
    const fetchDetail = async () => {
      const { data } = await supabase.from("products").select("*").eq("id", id).single()
      if (data) setProduct(data)
      setLoading(false)
    }
    fetchDetail()
  }, [id])

  const imageList = product?.image_url 
    ? (Array.isArray(product.image_url) ? product.image_url : [product.image_url]) 
    : []

  const submitOrder = async () => {
    if (!customerData.name || !customerData.whatsapp || !customerData.address) {
      alert("Isi data yang lengkap dulu, Lur!")
      return
    }

    const { error } = await supabase.from("orders").insert([
      { 
        customer_name: customerData.name,
        whatsapp_number: customerData.whatsapp,
        address: customerData.address,
        product_id: product.id,
        total_amount: product.price,
        status: "Perlu Dikemas"
      }
    ])

    if (!error) {
      alert("Pesanan berhasil dikirim ke Admin!")
      setIsModalOpen(false)
      setCustomerData({ name: "", whatsapp: "", address: "" })
    } else {
      alert("Gagal kirim pesanan, coba lagi Lur.")
    }
  }

  if (loading) return <div className="h-screen flex items-center justify-center bg-white text-sm">Memuat halaman...</div>

  return (
    <div className="bg-[#f4f4f4] min-h-screen pb-20 max-w-md mx-auto relative font-sans antialiased text-[#212121]">
      
      {/* FULL SCREEN IMAGE PREVIEW */}
      {isPreviewOpen && (
        <div className="fixed max-w-md mx-auto inset-0 z-100 bg-black flex flex-col justify-center items-center">
          <button 
            onClick={() => setIsPreviewOpen(false)}
            className="absolute top-6 right-6 text-white p-2 bg-white/10 rounded-full backdrop-blur-md"
          >
            <X className="mt-10" size={24} />
          </button>
          
          <div className="w-full max-h-[80vh]">
            <ProductImageSlider images={imageList} name={product.name} />
          </div>
          
          <div className="absolute bottom-10 text-white/60 text-xs tracking-widest font-bold uppercase">
            Geser untuk melihat detail
          </div>
        </div>
      )}

      {/* TOP NAVIGATION */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white border-b border-gray-100 flex items-center h-12 px-2 max-w-md mx-auto">
        <button onClick={() => router.back()} className="p-2"><ChevronLeft size={22} /></button>
        <div className="flex-1 flex justify-around px-2">
          {["Ringkasan", "Penilaian", "Detail", "Rekomendasi"].map((tab, i) => (
            <button key={tab} className={`text-[13px] ${i === 0 ? "text-orange-500 font-bold border-b-2 border-orange-500 h-12 flex items-center" : "text-gray-500"}`}>
              {tab}
            </button>
          ))}
        </div>
        <button className="p-2"><ShoppingCart size={20} /></button>
        <button className="p-2"><MoreVertical size={20} /></button>
      </nav>

      <div className="pt-12">
        {/* IMAGE SECTION - KLIK UNTUK FULL SCREEN */}
        <div className="bg-white relative aspect-square cursor-zoom-in group" onClick={() => setIsPreviewOpen(true)}>
          <ProductImageSlider images={imageList} name={product.name} />
          <div className="absolute bottom-4 right-4 bg-black/40 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
            <Maximize2 size={16} />
          </div>
        </div>

        {/* INFO PRODUK */}
        <div className="bg-white p-4 shadow-sm">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-[#f57224] text-2xl font-bold">
              <span className="text-sm">Rp</span>{product.price?.toLocaleString('id-ID')}
            </span>
          </div>

          <div className="flex gap-2 items-start mb-3">
            <span className="bg-[#f57224] text-white text-[9px] font-bold px-1 py-0.5 rounded-sm">WardenMall</span>
            <h1 className="text-[14px] leading-[1.4] font-medium text-[#212121]">
              {product.name}
            </h1>
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1">
              <Star size={12} fill="#ffc107" className="text-[#ffc107]" />
              <span className="text-xs font-bold">{product.rating || "4.9"}</span>
              <span className="text-[11px] text-gray-400 ml-1">({product.sold_count || "0"} terjual)</span>
            </div>
            <div className="flex gap-3 text-gray-500">
              <Heart size={20} />
              <Share2 size={20} />
            </div>
          </div>
        </div>

        {/* SHIPMENT & SPECIFICATION SEPARATOR */}
        <div className="mt-2 bg-white px-4 py-3 flex justify-between items-center text-xs">
          <div className="flex items-center gap-3">
            <MapPin size={16} className="text-gray-400" />
            <p className="text-gray-500">Kirim ke <span className="font-bold text-[#212121]">Indonesia</span></p>
          </div>
          <ChevronRight size={16} className="text-gray-300" />
        </div>

        {/* 2. DESCRIPTION FROM DATABASE */}
        <div className="mt-2 bg-white p-4 shadow-sm">
          <h3 className="text-[13px] font-bold mb-3 text-[#212121]">Deskripsi Produk</h3>
          <div className="text-[12px] leading-relaxed text-gray-600 whitespace-pre-line border-t border-gray-50 pt-3">
            {product.description || "Tidak ada deskripsi produk."}
          </div>
        </div>

        {/* 3. RELATED PRODUCTS SECTION */}
        <div className="mt-2 bg-white p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-[13px] font-bold text-[#212121]">Produk Terkait</h3>
            <span className="text-[11px] text-orange-500 font-bold">Lihat Semua</span>
          </div>
          {/* Related products */}
          <ProductList />
        </div>
      </div>

      {/* BOTTOM ACTION BAR */}
      <div className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-100 flex items-center h-13.75 max-w-md mx-auto px-2 gap-2 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col items-center justify-center min-w-11.25 text-gray-500">
          <Store size={18} />
          <span className="text-[9px] mt-0.5">Toko</span>
        </div>
        
        <button className="bg-[#ff9500] text-white p-2.5 rounded-sm flex items-center justify-center">
          <ShoppingCart size={20} />
        </button>

        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex-1 bg-[#f57224] text-white h-10 rounded-sm font-bold text-[13px] flex flex-col items-center justify-center"
        >
          <span className="text-[9px] font-normal opacity-90 leading-none">Beli sekarang</span>
          <span>Rp {product.price.toLocaleString('id-ID')}</span>
        </button>
      </div>

      {/* MODAL CHECKOUT */}
      {isModalOpen && (
        <div className="fixed inset-0 z-100 bg-black/60 flex items-end justify-center">
          <div className="bg-white w-full max-w-md rounded-t-2xl p-6 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-start mb-6 pb-4 border-b">
               <div className="flex gap-4">
                 <div className="w-16 h-16 bg-gray-100 rounded border">
                    <img src={Array.isArray(product.image_url) ? product.image_url[0] : product.image_url} className="w-full h-full object-cover" alt="thumb" />
                 </div>
                 <div>
                   <p className="text-[#f57224] font-bold text-lg leading-none mb-1">Rp {product.price.toLocaleString('id-ID')}</p>
                   <p className="text-[11px] text-gray-400 italic">Pesanan akan diteruskan ke admin</p>
                 </div>
               </div>
               <button onClick={() => setIsModalOpen(false)}><X size={20} className="text-gray-400" /></button>
            </div>

            <div className="space-y-3 mb-6">
               <input 
                 onChange={(e) => setCustomerData({...customerData, name: e.target.value})}
                 type="text" placeholder="Nama Lengkap" className="w-full bg-[#f4f4f4] border-none p-3 text-sm rounded-sm outline-none" 
               />
               <input 
                 onChange={(e) => setCustomerData({...customerData, whatsapp: e.target.value})}
                 type="number" placeholder="Nomor WhatsApp" className="w-full bg-[#f4f4f4] border-none p-3 text-sm rounded-sm outline-none" 
               />
               <textarea 
                 onChange={(e) => setCustomerData({...customerData, address: e.target.value})}
                 placeholder="Alamat Lengkap" className="w-full bg-[#f4f4f4] border-none p-3 text-sm h-24 rounded-sm outline-none resize-none"
               ></textarea>
            </div>

            <button onClick={submitOrder} className="w-full bg-[#f57224] text-white font-bold py-3.5 rounded-sm text-sm uppercase tracking-wide">
              Konfirmasi Pesanan
            </button>
          </div>
        </div>
      )}
    </div>
  )
}