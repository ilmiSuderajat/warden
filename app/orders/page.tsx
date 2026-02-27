"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import { useRouter } from "next/navigation"

export default function MyOrdersPage() {
  const [activeTab, setActiveTab] = useState("all")
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  // State untuk menyimpan ID order yang sedang di-expand
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const router = useRouter()

  const tabs = [
    { id: "all", label: "Semua", icon: "LayoutGrid" },
    { id: "pending", label: "Belum Bayar", icon: "CreditCard" },
    { id: "dikemas", label: "Dikemas", icon: "Package" },
    { id: "dikirim", label: "Dikirim", icon: "Truck" },
    { id: "selesai", label: "Selesai", icon: "CheckCircle2" },
  ]

  useEffect(() => {
    fetchOrders()
  }, [activeTab])

  const fetchOrders = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push("/login")

    let query = supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("user_id", user.id)

    if (activeTab === "pending") query = query.eq("payment_status", "pending")
    if (activeTab === "dikemas") query = query.eq("status", "Perlu Dikemas")
    if (activeTab === "dikirim") query = query.eq("status", "Dikirim")
    if (activeTab === "selesai") query = query.eq("status", "Selesai")

    const { data } = await query.order("created_at", { ascending: false })
    if (data) setOrders(data)
    setLoading(false)
  }

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Menunggu Pembayaran': return 'bg-amber-50 text-amber-600 border-amber-100'
      case 'Perlu Dikemas': return 'bg-indigo-50 text-indigo-600 border-indigo-100'
      case 'Dikirim': return 'bg-blue-50 text-blue-600 border-blue-100'
      case 'Selesai': return 'bg-emerald-50 text-emerald-600 border-emerald-100'
      case 'Dibatalkan': return 'bg-rose-50 text-rose-600 border-rose-100'
      default: return 'bg-slate-50 text-slate-600 border-slate-100'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', { 
      day: 'numeric', month: 'short', year: 'numeric' 
    });
  }

  const toggleExpand = (orderId: string) => {
    setExpandedOrderId(prev => prev === orderId ? null : orderId)
  }

  return (
    <div className="min-h-screen bg-slate-50/80 font-sans max-w-md mx-auto pb-24">
      {/* HEADER */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="flex items-center gap-3 px-5 pt-12 pb-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
            <Icons.ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Pesanan Saya</h1>
        </div>

        {/* TABS WITH INDIGO ACCENT */}
        <div className="flex gap-2 px-5 pb-4 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            const Icon = (Icons as any)[tab.icon]
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold transition-all whitespace-nowrap border ${
                  isActive 
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                  : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-200 hover:text-indigo-600'
                }`}
              >
                <Icon size={14} className={isActive ? "text-white" : "text-slate-400"} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* LIST CONTENT */}
      <div className="p-5 space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Icons.Loader2 className="animate-spin mb-3 text-indigo-600" size={24} />
            <p className="text-xs font-medium">Memuat pesanan...</p>
          </div>
        ) : orders.length > 0 ? (
          orders.map((order) => {
            const isExpanded = expandedOrderId === order.id
            
            return (
              <div 
                key={order.id} 
                className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all duration-300"
              >
                {/* Card Header */}
                <div className="flex justify-between items-center px-5 py-3 border-b border-slate-50 bg-slate-50/50">
                  <span className="text-[11px] font-medium text-slate-400">
                    {formatDate(order.created_at)}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${getStatusStyle(
                      order.payment_status === "pending" ? "Menunggu Pembayaran" : order.status
                    )}`}
                  >
                    {order.payment_status === "pending" ? "Menunggu Pembayaran" : order.status}
                  </span>
                </div>

                {/* Card Body */}
                <div className="p-5">
                  <div className="flex gap-4">
                    <div className="w-16 h-16 bg-slate-100 rounded-xl overflow-hidden shrink-0 border border-slate-50">
                      <img 
                        src={order.order_items?.[0]?.image_url || "/placeholder.png"} 
                        className="w-full h-full object-cover" 
                        alt="product" 
                      />
                    </div>
                    <div className="flex-1 min-w-0 py-0.5">
                      <h3 className="text-sm font-semibold text-slate-800 line-clamp-1">
                        {order.order_items?.[0]?.product_name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {order.order_items?.length > 1 ? `${order.order_items.length} Produk` : '1 Produk'}
                      </p>
                      <p className="text-sm font-bold text-slate-900 mt-2 tracking-tight">
                        Rp {order.total_amount?.toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="px-5 pb-5 pt-0">
                  <button 
                    onClick={() => toggleExpand(order.id)}
                    className={`w-full py-3 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 ${
                      isExpanded 
                        ? 'bg-slate-100 text-slate-600 border border-slate-200' 
                        : 'bg-white border border-indigo-600 text-indigo-600 hover:bg-indigo-50'
                    }`}
                  >
                    {isExpanded ? (
                      <>
                        <Icons.ChevronUp size={14} />
                        Tutup Detail
                      </>
                    ) : (
                      <>
                        <Icons.Eye size={14} />
                        Lihat Detail
                      </>
                    )}
                  </button>
                </div>

                {/* EXPANDABLE CONTENT (Accordion) - Muncul di bawah tombol */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-5 space-y-5 animate-in slide-in-from-top-2 duration-200">
                    
                    {/* Info Pengiriman */}
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg shrink-0 mt-0.5">
                          <Icons.MapPin size={16} className="text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Alamat Tujuan</p>
                          <p className="text-sm text-slate-700 leading-relaxed">{order.address}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-emerald-50 rounded-lg shrink-0 mt-0.5">
                          <Icons.Route size={16} className="text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Jarak Tempuh</p>
                          <p className="text-sm text-slate-700 font-medium">{order.distance_km?.toFixed(1)} KM</p>
                        </div>
                      </div>
                    </div>

                    {/* Daftar Item */}
                    <div className="border-t border-slate-100 pt-4">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Daftar Produk</p>
                      <div className="space-y-3">
                        {order.order_items?.map((item: any, idx: number) => (
                          <div key={idx} className="flex gap-3 items-center">
                            <div className="w-12 h-12 bg-slate-100 rounded-lg overflow-hidden">
                              <img src={item.image_url || "/placeholder.png"} className="w-full h-full object-cover" alt={item.product_name} />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-700 line-clamp-1">{item.product_name}</p>
                              <p className="text-xs text-slate-400">{item.quantity}x @ Rp {item.price?.toLocaleString('id-ID')}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Rincian Pembayaran */}
                    <div className="border-t border-slate-100 pt-4 space-y-2.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Subtotal</span>
                        <span className="text-slate-700 font-medium">Rp {order.subtotal_amount?.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Ongkos Kirim</span>
                        <span className="text-slate-700 font-medium">Rp {order.shipping_amount?.toLocaleString('id-ID')}</span>
                      </div>
                      <div className="border-t border-dashed border-slate-200 my-3"></div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-slate-800">Total Tagihan</span>
                        <span className="text-lg font-bold text-indigo-600">
                          Rp {order.total_amount?.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    {/* Tombol Aksi di dalam Expanded Area */}
                    <div className="pt-2 space-y-2">
                      <button 
                        onClick={() => window.open(`https://wa.me/628123456789?text=Halo Admin, saya mau konfirmasi pesanan #${order.id.slice(0,8)}`)}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors shadow-sm shadow-indigo-100 flex items-center justify-center gap-2"
                      >
                        <Icons.MessageCircle size={18} />
                        Hubungi Admin via WA
                      </button>
                      
                      {/* Tombol Close Tambahan di bawah sesuai permintaan */}
                      <button 
                        onClick={() => setExpandedOrderId(null)}
                        className="w-full py-2.5 bg-transparent text-slate-500 text-xs font-medium hover:text-slate-700 transition-colors flex items-center justify-center gap-1"
                      >
                        <Icons.ChevronUp size={14} />
                        Tutup Detail Pesanan
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <div className="text-center py-20 flex flex-col items-center">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
              <Icons.Inbox size={28} className="text-indigo-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Belum ada pesanan</p>
            <p className="text-xs text-slate-400 mt-1">Pesanan akan muncul di sini</p>
          </div>
        )}
      </div>
    </div>
  )
}