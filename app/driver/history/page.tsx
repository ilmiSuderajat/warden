"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, Loader2, Package, MapPin, ClipboardList } from "lucide-react"
import { useRouter } from "next/navigation"

export default function DriverHistoryPage() {
  const router = useRouter()
  const [history, setHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch("/api/driver/order-history")
        const data = await res.json()
        setHistory(data.history || [])
      } catch (err) {
        console.error("Gagal memuat riwayat", err)
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [])

  return (
    <div className="h-[100dvh] bg-slate-50 font-sans max-w-md mx-auto shadow-2xl pb-10 flex flex-col">
      {/* ─── HEADER ─── */}
      <div className="bg-white px-4 py-4 sticky top-0 z-10 flex items-center shadow-sm">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-500 active:scale-90 transition-transform">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold text-slate-800 ml-2">Riwayat Pesanan</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-white rounded-full shadow-sm flex items-center justify-center mb-4">
              <ClipboardList size={28} className="text-indigo-200" />
            </div>
            <p className="text-sm font-bold text-slate-700 mb-1">Belum Ada Riwayat</p>
            <p className="text-xs text-slate-400">Riwayat penyelesaian pesanan akan muncul di sini</p>
          </div>
        ) : (
          history.map((driverOrder) => {
            const order = driverOrder.orders
            const statusColor = driverOrder.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
            const statusLabel = driverOrder.status === 'delivered' ? 'Selesai' : driverOrder.status === 'rejected' ? 'Ditolak' : driverOrder.status === 'expired' ? 'Kadaluarsa' : 'Dibatalkan'
            const earning = Math.floor((order?.shipping_amount || 0) * 0.80)
            return (
              <div key={driverOrder.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center">
                      <Package size={14} className="text-slate-400" />
                    </div>
                    <div>
                      <h4 className="text-[13px] font-bold text-slate-900 truncate mb-0.5">{order?.customer_name || 'Pelanggan'}</h4>
                      <p className="text-[10px] text-slate-400 font-medium tracking-wide">#{order?.id?.slice(0, 8).toUpperCase()}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${statusColor}`}>
                    {statusLabel}
                  </span>
                </div>
                
                <p className="text-[11px] text-slate-500 line-clamp-1 mb-3 bg-slate-50 p-2 rounded-lg relative pl-7">
                  <MapPin size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                  {order?.address}
                </p>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400 font-medium">
                    {order?.created_at ? new Date(order.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                  </p>
                  {driverOrder.status === 'delivered' && (
                    <p className="text-sm font-black text-indigo-600">+Rp {earning.toLocaleString('id-ID')}</p>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
