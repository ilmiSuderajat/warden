"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import { useRouter } from "next/navigation"
import Skeleton from "@/app/components/Skeleton"

export default function MyReviewsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"belum" | "sudah">("belum")
  const [user, setUser] = useState<any>(null)
  
  // Stats
  const [totalReviews, setTotalReviews] = useState(0)
  const [unreviewedItems, setUnreviewedItems] = useState<any[]>([])
  const [reviewedItems, setReviewedItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      
      if (!currentUser) {
        router.push("/login")
        return
      }

      // get user metadata roughly
      setUser(currentUser)

      // Fetch "Penilaian Saya"
      const { data: myReviews } = await supabase
        .from("product_reviews")
        .select("*, products(name, image_url, price)")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
      
      setTotalReviews(myReviews?.length || 0)
      setReviewedItems(myReviews || [])

      // Fetch "Belum Dinilai"
      const { data: rawOrders } = await supabase
        .from("orders")
        .select("id, status, created_at, shop_name, order_items(*), product_reviews(product_id)")
        .eq("status", "Selesai")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })

      const unreviewed: any[] = []
      if (rawOrders) {
        rawOrders.forEach(order => {
          const reviewedPids = order.product_reviews?.map((r: any) => r.product_id) || []
          const pending = order.order_items.filter((item: any) => !reviewedPids.includes(item.product_id))
          pending.forEach((item: any) => {
            unreviewed.push({ ...item, order })
          })
        })
      }
      setUnreviewedItems(unreviewed)
      setLoading(false)
    }
    fetchData()
  }, [router])

  return (
    <div className="min-h-screen bg-[#f5f5f5] font-sans max-w-md mx-auto pb-28">
      {/* Header Profile Info */}
      <div className="bg-white px-4 pt-10 pb-4">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => router.back()} className="p-1 active:scale-90 transition-transform">
            <Icons.ArrowLeft size={24} className="text-slate-800" />
          </button>
          <h1 className="text-[18px] font-medium text-slate-900">Penilaian Saya</h1>
        </div>

        <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
          <div className="w-14 h-14 rounded-full bg-slate-200 overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <Icons.User size={24} className="text-slate-400" />
            )}
          </div>
          <div className="flex flex-1 justify-between items-center text-center">
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold text-slate-800">{totalReviews}</span>
              <span className="text-[11px] text-slate-500">Ulasan</span>
            </div>
            <div className="h-6 w-[1px] bg-slate-200" />
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold text-slate-800">0</span>
              <span className="text-[11px] text-slate-500">Koin Didapatkan</span>
            </div>
            <div className="h-6 w-[1px] bg-slate-200" />
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold text-slate-800">0</span>
              <span className="text-[11px] text-slate-500">Terbantu</span>
            </div>
            <div className="h-6 w-[1px] bg-slate-200" />
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold text-slate-800">0</span>
              <span className="text-[11px] text-slate-500">Dilihat</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 bg-white grid grid-cols-2 text-center text-[13px] font-medium border-b border-slate-200 z-10">
        <button
          onClick={() => setActiveTab("belum")}
          className={`py-3.5 relative transition-colors ${activeTab === "belum" ? "text-indigo-600" : "text-slate-500"}`}
        >
          Belum Dinilai
          {activeTab === "belum" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
        </button>
        <button
          onClick={() => setActiveTab("sudah")}
          className={`py-3.5 relative transition-colors ${activeTab === "sudah" ? "text-indigo-600" : "text-slate-500"}`}
        >
          Penilaian Saya
          {activeTab === "sudah" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600" />}
        </button>
      </div>

      {/* Content */}
      <div className="py-2 space-y-2 px-0 bg-[#f5f5f5]">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
             <div key={i} className="bg-white p-4 space-y-3">
               <div className="flex justify-between items-center"><Skeleton className="h-4 w-32" /><Skeleton className="h-4 w-12" /></div>
               <div className="flex gap-3"><Skeleton className="w-16 h-16" /><Skeleton className="h-4 w-full" /></div>
             </div>
          ))
        ) : activeTab === "belum" ? (
          unreviewedItems.length > 0 ? (
            unreviewedItems.map((item, idx) => (
              <div key={idx} className="bg-white p-3 shadow-sm rounded-lg mx-2 my-2">
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                  <Icons.Store size={14} className="text-slate-500" />
                  <span className="text-[12px] font-semibold text-slate-800">{item.order.shop_name || "Toko"}</span>
                </div>
                <div className="flex gap-3 mt-3">
                  <div className="relative w-16 h-16 rounded border border-slate-100 overflow-hidden shrink-0">
                     <img src={item.image_url || "/placeholder.png"} className="w-full h-full object-cover" alt="product" />
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                     <p className="text-[13px] text-slate-800 font-medium line-clamp-2 leading-snug">{item.product_name}</p>
                     <p className="text-[11px] text-slate-400">Pesanan diselesaikan: {new Date(item.order.created_at).toLocaleDateString('id-ID')}</p>
                  </div>
                </div>
                <div className="mt-3 bg-slate-50 border border-slate-100 rounded px-3 py-2.5 flex items-center justify-between">
                  <p className="text-[12px] text-slate-600">Nilai produk ini</p>
                  <div className="flex gap-1 items-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Icons.Star key={star} size={18} className="text-slate-200 fill-slate-200" />
                    ))}
                  </div>
                </div>
                <div className="mt-3 flex justify-end">
                   <button onClick={() => router.push(`/orders?tab=selesai&active=${item.order.id}`)} className="bg-indigo-600 text-white text-[12px] font-medium px-6 py-1.5 rounded active:scale-95 transition-transform flex items-center justify-center gap-1 shadow-sm">
                      Nilai <Icons.CircleDollarSign size={12} className="text-amber-300 ml-1" /> +140
                   </button>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center py-20 text-center px-4">
              <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4 text-slate-400"><Icons.MessageSquareOff size={32} /></div>
              <p className="text-sm font-medium text-slate-600">Pelanggan yang baik selalu meninggalkan jejak!</p>
              <p className="text-xs text-slate-400 mt-1">Belum ada pesanan yang perlu diulas.</p>
            </div>
          )
        ) : (
          reviewedItems.length > 0 ? (
            reviewedItems.map((rev, idx) => (
              <div key={idx} className="bg-white p-3 shadow-sm rounded-lg mx-2 my-2">
                <div className="flex items-start gap-2 mb-2 pb-2">
                   <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center overflow-hidden shrink-0">
                      {user?.user_metadata?.avatar_url ? (
                        <img src={user.user_metadata.avatar_url} className="w-full h-full object-cover" alt="user" />
                      ) : (
                        <span className="text-[10px] font-bold text-indigo-500">YOU</span>
                      )}
                   </div>
                   <div className="flex-1">
                      <p className="text-[12px] font-semibold text-slate-800">{user?.user_metadata?.full_name || user?.user_metadata?.name || "Member"}</p>
                      <div className="flex gap-0.5 mt-0.5">
                         {[1, 2, 3, 4, 5].map((star) => (
                           <Icons.Star key={star} size={10} className={star <= rev.rating ? "text-amber-400 fill-amber-400" : "text-slate-200 fill-slate-100"} />
                         ))}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                         {new Date(rev.created_at).toLocaleString('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                   </div>
                </div>
                
                {rev.comment && <p className="text-[12px] text-slate-700 leading-relaxed mb-3">{rev.comment}</p>}
                
                {rev.photo_url && (
                  <div className="flex gap-2 overflow-x-auto no-scrollbar snap-x mb-3">
                    {rev.photo_url.split(',').map((url: string, pIdx: number) => (
                       <img key={pIdx} src={url.trim()} className="w-16 h-16 shrink-0 snap-start object-cover rounded border border-slate-100" alt="review photo" />
                    ))}
                  </div>
                )}
                
                <div className="bg-slate-50 border border-slate-100 rounded p-2 flex gap-2 items-center mb-3">
                   <div className="w-10 h-10 shrink-0 bg-white border border-slate-200 rounded p-0.5">
                     <img src={rev.products?.image_url?.[0] || rev.products?.image_url || "/placeholder.png"} className="w-full h-full object-cover rounded-sm" alt="product" />
                   </div>
                   <p className="text-[11px] font-medium text-slate-600 line-clamp-2">{rev.products?.name}</p>
                </div>
                
                <div className="flex justify-end mt-2">
                   <button className="flex items-center gap-1.5 text-slate-500 hover:text-indigo-600 active:scale-95 transition-all outline-none">
                     <span className="text-[11px] font-medium">Membantu</span>
                     <Icons.ThumbsUp size={14} />
                   </button>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center py-20 text-center px-4">
              <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center mb-4 text-slate-400"><Icons.StarOff size={32} /></div>
              <p className="text-sm font-medium text-slate-600">Belum ada penilaian yang diberikan</p>
            </div>
          )
        )}
      </div>
    </div>
  )
}
