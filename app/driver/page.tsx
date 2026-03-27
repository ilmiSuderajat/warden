"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { MapPin, Power, ShieldCheck, Clock, Loader2, Navigation, CheckCircle2, Package } from "lucide-react"
import { toast } from "sonner"

export default function DriverDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isOnline, setIsOnline] = useState(false)
  const [isAutoAccept, setIsAutoAccept] = useState(false)
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null)
  const [activeDriverOrder, setActiveDriverOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [statusLoading, setStatusLoading] = useState(false)

  const watchId = useRef<number | null>(null)

  useEffect(() => {
    let mounted = true
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.replace("/login")

      const { data: userData } = await supabase
        .from("users").select("*").eq("id", session.user.id).single()

      if (mounted && userData) {
        setUser(userData)
        setIsOnline(userData.is_online || false)
        setIsAutoAccept(userData.is_auto_accept || false)
      }

      // Check for any active driver_order (accepted + not delivered)
      const { data: activeOrder } = await supabase
        .from("driver_orders")
        .select("*, orders(*)")
        .eq("driver_id", session.user.id)
        .in("status", ["accepted", "picked_up"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle() as { data: any }

      if (mounted && activeOrder) setActiveDriverOrder(activeOrder)

      // Check for pending offer
      const now = new Date().toISOString()
      const { data: offer } = await supabase
        .from("driver_orders")
        .select("id")
        .eq("driver_id", session.user.id)
        .eq("status", "offered")
        .gte("offer_expires_at", now)
        .maybeSingle() as { data: any }

      if (mounted && offer) router.push(`/driver/order/${offer.id}`)

      if (mounted) setLoading(false)
    }
    init()
    return () => { mounted = false }
  }, [router])

  // GPS tracking
  useEffect(() => {
    if (!isOnline) {
      if (watchId.current) navigator.geolocation.clearWatch(watchId.current)
      return
    }
    if (!("geolocation" in navigator)) return

    watchId.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setLocation({ lat: coords.latitude, lng: coords.longitude })
        fetch("/api/driver/location", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: coords.latitude, lng: coords.longitude })
        })
      },
      (err) => {
        console.error(err)
        toast.error("Gagal mendapatkan GPS. Pastikan izin lokasi aktif.")
        setIsOnline(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
    return () => { if (watchId.current) navigator.geolocation.clearWatch(watchId.current) }
  }, [isOnline])

  // Cron ping
  useEffect(() => {
    if (!isOnline) return
    const interval = setInterval(() => {
      fetch("/api/dispatch/cron", { method: "POST" }).catch(() => {})
    }, 10000)
    return () => clearInterval(interval)
  }, [isOnline])

  // Realtime: listen for new offers on driver_orders
  useEffect(() => {
    if (!user?.id) return
    const channel = supabase.channel(`driver_${user.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "driver_orders",
        filter: `driver_id=eq.${user.id}`
      }, (payload: any) => {
        if (payload.new.status === "offered") {
          router.push(`/driver/order/${payload.new.id}`)
        }
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "driver_orders",
        filter: `driver_id=eq.${user.id}`
      }, (payload: any) => {
        if (payload.new.status === "accepted") {
          // auto-accept scenario
          setActiveDriverOrder({ ...payload.new })
          toast.success("Order baru otomatis diterima!")
        }
        if (payload.new.status === "delivered") {
          setActiveDriverOrder(null)
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id, router])

  const toggleOnline = async () => {
    const newState = !isOnline
    setIsOnline(newState)
    await fetch("/api/driver/settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_online: newState })
    })
    if (newState) toast.success("Anda sekarang Online")
    else toast.info("Anda Offline")
  }

  const toggleAutoAccept = async () => {
    const newState = !isAutoAccept
    setIsAutoAccept(newState)
    await fetch("/api/driver/settings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_auto_accept: newState })
    })
    if (newState) toast.success("Auto-Accept Aktif")
    else toast.info("Auto-Accept Nonaktif")
  }

  const handleUpdateStatus = async (status: "picked_up" | "delivered") => {
    if (!activeDriverOrder) return
    setStatusLoading(true)
    try {
      const res = await fetch("/api/driver/update-status", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: activeDriverOrder.order_id || activeDriverOrder.orders?.id, status })
      })
      const data = await res.json()
      if (data.success) {
        if (status === "picked_up") {
          setActiveDriverOrder((prev: any) => ({ ...prev, status: "picked_up" }))
          toast.success("Status diperbarui: Sedang Dikirim!")
        } else {
          setActiveDriverOrder(null)
          toast.success("Order Selesai! Terima kasih 🎉")
        }
      } else {
        toast.error(data.error || "Gagal update status")
      }
    } catch {
      toast.error("Terjadi error")
    } finally {
      setStatusLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600 mb-2" size={32} />
        <p className="text-sm font-medium text-slate-400">Memuat Dashboard...</p>
      </div>
    )
  }

  const activeOrder = activeDriverOrder?.orders

  return (
    <div className="min-h-screen bg-slate-50 font-sans max-w-md mx-auto pb-24 relative overflow-hidden">
      <div className={`absolute top-0 left-0 right-0 h-64 transition-colors duration-700 ${isOnline ? 'bg-emerald-600' : 'bg-slate-800'} rounded-b-[40px] z-0`}></div>

      {/* Header */}
      <div className="relative z-10 px-6 pt-12 pb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Halo, {user?.full_name?.split(' ')[0] || 'Driver'}</h1>
          <p className="text-white/80 text-sm mt-1 flex items-center gap-1.5">
            {location ? <MapPin size={12} /> : <Loader2 size={12} className="animate-spin" />}
            {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Mencari lokasi...'}
          </p>
        </div>
        <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full border border-white/30 flex items-center justify-center shrink-0 overflow-hidden">
          {user?.avatar_url
            ? <img src={user.avatar_url} className="w-full h-full object-cover" alt="avatar" />
            : <span className="text-white font-bold">{user?.full_name?.charAt(0) || 'D'}</span>}
        </div>
      </div>

      {/* Toggles Card */}
      <div className="relative z-10 px-5">
        <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col gap-6">
          {/* Online */}
          <div className="flex justify-between items-center">
            <div className="flex gap-4 items-center">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${isOnline ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                <Power size={24} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-base">{isOnline ? 'Menerima Order' : 'Sedang Offline'}</h2>
                <p className="text-xs text-slate-500 font-medium">Status Pekerjaan</p>
              </div>
            </div>
            <button onClick={toggleOnline}
              className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`}>
              <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${isOnline ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="h-px w-full bg-slate-100" />

          {/* Auto Accept */}
          <div className="flex justify-between items-center">
            <div className="flex gap-4 items-center">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${isAutoAccept ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                <ShieldCheck size={24} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-base">Prioritas Auto-Terima</h2>
                <p className="text-xs text-slate-500 font-medium">Terima order tanpa tunggu</p>
              </div>
            </div>
            <button onClick={toggleAutoAccept}
              className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${isAutoAccept ? 'bg-indigo-600' : 'bg-slate-300'}`}>
              <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${isAutoAccept ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Active Order */}
      <div className="px-5 mt-8">
        <h3 className="text-sm font-bold text-slate-800 mb-4 px-1">Order Aktif</h3>

        {activeDriverOrder && activeOrder ? (
          <div className="bg-white rounded-3xl border border-indigo-100 shadow-sm overflow-hidden relative">
            <div className={`absolute top-0 left-0 w-2 h-full ${activeDriverOrder.status === 'picked_up' ? 'bg-blue-500' : 'bg-indigo-500'}`}></div>
            <div className="p-5 pl-7">
              <div className="flex justify-between items-start mb-1">
                <p className={`text-xs font-bold mb-1 ${activeDriverOrder.status === 'picked_up' ? 'text-blue-600' : 'text-indigo-600'}`}>
                  {activeDriverOrder.status === 'picked_up' ? '🚴 Sedang Dikirim' : '📦 Menuju Toko'}
                </p>
                <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded-md">
                  #{activeOrder.id?.slice(0, 6).toUpperCase()}
                </span>
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-3">{activeOrder.customer_name}</h4>

              <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                <Navigation size={14} className="text-slate-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-600 font-medium leading-relaxed">{activeOrder.address}</p>
              </div>

              <button
                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${activeOrder.latitude},${activeOrder.longitude}`)}
                className="w-full bg-slate-900 text-white font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors mb-3"
              >
                <MapPin size={16} /> Buka Navigasi Maps
              </button>

              {activeDriverOrder.status === "accepted" && (
                <button
                  onClick={() => handleUpdateStatus("picked_up")}
                  disabled={statusLoading}
                  className="w-full bg-blue-500 text-white font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors"
                >
                  {statusLoading ? <Loader2 size={16} className="animate-spin" /> : <Package size={16} />}
                  Sudah Ambil dari Toko
                </button>
              )}

              {activeDriverOrder.status === "picked_up" && (
                <button
                  onClick={() => handleUpdateStatus("delivered")}
                  disabled={statusLoading}
                  className="w-full bg-emerald-500 text-white font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors"
                >
                  {statusLoading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Selesai Antar ke Pelanggan
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-slate-100/50 border-2 border-dashed border-slate-200 rounded-3xl p-8 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-4">
              <Clock size={28} className="text-slate-400 animate-pulse" />
            </div>
            <h4 className="text-base font-bold text-slate-800 mb-1">
              {isOnline ? 'Menunggu Order...' : 'Anda Sedang Offline'}
            </h4>
            <p className="text-xs text-slate-500 font-medium max-w-[200px]">
              {isOnline ? 'Pastikan aplikasi tetap terbuka agar GPS selalu terhubung.' : 'Aktifkan status untuk mulai bekerja.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
