"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { MapPin, Navigation, AlertCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import React from "react"

export default function DriverOrderOffer({ params }: { params: Promise<{ id: string }> }) {
  const { id: driverOrderId } = React.use(params)

  const router = useRouter()
  const [driverOrder, setDriverOrder] = useState<any>(null)
  const [order, setOrder] = useState<any>(null)
  const [timeLeft, setTimeLeft] = useState(20)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const handleReject = useCallback(async (isTimeout = false) => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (!isTimeout) setActionLoading(true)
    try {
      await fetch("/api/driver/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverOrderId, action: "reject" })
      })
      if (!isTimeout) toast.info("Order dilewati")
      else toast.error("Waktu habis! Order dilewati")
    } catch (e) {
      // ignore
    } finally {
      router.replace("/driver")
    }
  }, [driverOrderId, router])

  useEffect(() => {
    let mounted = true
    const fetchOffer = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.replace("/login")

      // Fetch driver_order row
      const { data: driverOrderData } = await supabase
        .from("driver_orders")
        .select("*, orders(*)")
        .eq("id", driverOrderId)
        .eq("driver_id", session.user.id)
        .maybeSingle() as { data: any }

      if (!mounted) return

      if (!driverOrderData || driverOrderData.status !== "offered") {
        toast.error("Tawaran sudah kadaluarsa atau tidak ditemukan")
        return router.replace("/driver")
      }

      setDriverOrder(driverOrderData)
      setOrder(driverOrderData.orders)

      const expiresAt = new Date(driverOrderData.offer_expires_at).getTime()
      const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000))

      if (diff === 0) {
        handleReject(true)
      } else {
        setTimeLeft(diff)
      }
      setLoading(false)
    }

    fetchOffer()
    return () => { mounted = false }
  }, [driverOrderId, router, handleReject])

  // Countdown — starts once when loading finishes
  useEffect(() => {
    if (loading) return
    if (timerRef.current) clearInterval(timerRef.current)

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          handleReject(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  // Realtime — listen for status change (e.g., taken by auto-accept)
  useEffect(() => {
    if (!driverOrderId) return
    const channel = supabase.channel(`driver_offer_${driverOrderId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "driver_orders", filter: `id=eq.${driverOrderId}` },
        (payload: any) => {
          if (payload.new.status !== "offered") {
            toast.error("Tawaran sudah tidak berlaku")
            router.replace("/driver")
          }
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [driverOrderId, router])

  const handleAccept = async () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setActionLoading(true)
    try {
      const res = await fetch("/api/driver/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverOrderId, action: "accept" })
      })
      const data = await res.json()
      if (data.success) {
        toast.success("Order Berhasil Diambil!")
        router.replace("/driver")
      } else {
        toast.error(data.error || "Gagal mengambil order")
        router.replace("/driver")
      }
    } catch (e) {
      toast.error("Terjadi error")
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="animate-spin text-white" size={32} />
      </div>
    )
  }

  const percentage = (timeLeft / 20) * 100

  return (
    <div className="min-h-screen bg-slate-900 font-sans max-w-md mx-auto relative overflow-hidden flex flex-col items-center justify-center p-6 pb-12">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl animate-pulse z-0 pointer-events-none"></div>

      <div className="w-full relative z-10 flex flex-col items-center">
        <div className="mb-6 flex flex-col items-center">
          <div className="text-indigo-400 font-bold tracking-widest uppercase text-xs mb-3 flex items-center gap-2">
            <AlertCircle size={14} /> ORDER BARU MASUK!
          </div>
          <div className="relative w-32 h-32 flex items-center justify-center mb-6">
            <svg className="w-full h-full transform -rotate-90 absolute top-0 left-0" viewBox="0 0 128 128">
              <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-800" />
              <circle cx="64" cy="64" r="60" stroke="currentColor" strokeWidth="6" fill="transparent"
                strokeDasharray={377} strokeDashoffset={377 - (377 * percentage) / 100}
                className={`transition-all duration-1000 linear ${timeLeft <= 5 ? 'text-red-500' : 'text-emerald-400'}`}
                strokeLinecap="round" />
            </svg>
            <div className="text-4xl font-extrabold text-white">{Math.ceil(timeLeft)}</div>
          </div>
        </div>

        <div className="w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-6 shadow-2xl mb-8">
          <div className="flex justify-between items-start mb-6 border-b border-white/10 pb-4">
            <div>
              <p className="text-xs text-slate-400 font-medium mb-1 tracking-wide">PELANGGAN</p>
              <h2 className="text-xl font-bold text-white">{order?.customer_name}</h2>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400 font-medium mb-1 tracking-wide">PENGHASILAN</p>
              <p className="text-xl font-extrabold text-emerald-400">
                Rp {(order?.shipping_amount || 10000).toLocaleString('id-ID')}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <MapPin size={18} className="text-indigo-400" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Titik Jemput</p>
                <p className="text-sm font-semibold text-white">Toko Utama</p>
              </div>
            </div>
            <div className="ml-5 border-l-2 border-dashed border-white/20 h-6"></div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <Navigation size={18} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Tujuan Antar</p>
                <p className="text-sm font-semibold text-slate-200 leading-snug">{order?.address}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full flex gap-4">
          <button disabled={actionLoading} onClick={() => handleReject(false)}
            className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold text-sm tracking-wide hover:bg-white/10 transition-colors disabled:opacity-50">
            LEWATI
          </button>
          <button disabled={actionLoading} onClick={handleAccept}
            className="flex-[2] py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-extrabold text-sm tracking-widest shadow-lg shadow-emerald-500/30 transition-all active:scale-[0.98] disabled:opacity-50">
            {actionLoading ? <Loader2 size={18} className="animate-spin mx-auto" /> : 'TERIMA ORDER'}
          </button>
        </div>
      </div>
    </div>
  )
}
