"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { MapPin, Power, ShieldCheck, Clock, Loader2, Navigation } from "lucide-react"
import { toast } from "sonner"

export default function DriverDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isOnline, setIsOnline] = useState(false)
  const [isAutoAccept, setIsAutoAccept] = useState(false)
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null)
  const [activeOrder, setActiveOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const watchId = useRef<number | null>(null)

  useEffect(() => {
    let mounted = true
    
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.replace("/login")
      
      const { data: userData } = await supabase
        .from("users")
        .select("*")
        .eq("id", session.user.id)
        .single()
        
      if (mounted && userData) {
        setUser(userData)
        setIsOnline(userData.is_online || false)
        setIsAutoAccept(userData.is_auto_accept || false)
      }

      // Check if driver has an active assigned order
      const { data: currentOrder } = await supabase
        .from("orders")
        .select("*")
        .eq("driver_id", session.user.id)
        .in("status", ["Kurir Menuju Lokasi", "Dikirim"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        
      if (mounted && currentOrder) {
         setActiveOrder(currentOrder)
      }

      // Also check if there's an active offer
      const now = new Date().toISOString()
      const { data: offer } = await supabase
        .from("orders")
        .select("id")
        .eq("offered_to_driver_id", session.user.id)
        .is("driver_id", null)
        .gte("offer_expires_at", now)
        .maybeSingle()
        
      if (mounted && offer) {
        router.push(`/driver/order/${offer.id}`)
      }
      
      setLoading(false)
    }

    init()

    return () => { mounted = false }
  }, [router])

  // Track Location
  useEffect(() => {
    if (!isOnline) {
      if (watchId.current) navigator.geolocation.clearWatch(watchId.current)
      return
    }

    const updateLocationAPI = async (lat: number, lng: number) => {
      await fetch("/api/driver/location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng })
      })
    }

    if ("geolocation" in navigator) {
      watchId.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setLocation({ lat: latitude, lng: longitude })
          // Send to API
          updateLocationAPI(latitude, longitude)
        },
        (error) => {
          console.error("GPS Error:", error)
          toast.error("Gagal mendapatkan lokasi GPS. Pastikan izin lokasi aktif.")
          setIsOnline(false) // force offline if GPS fails
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    }

    return () => {
      if (watchId.current) navigator.geolocation.clearWatch(watchId.current)
    }
  }, [isOnline])

  // PING the cron to keep system moving (Hack for Serverless 20s cron)
  useEffect(() => {
      if (!isOnline) return;
      const interval = setInterval(() => {
          fetch("/api/dispatch/cron", { method: "POST" }).catch(() => {})
      }, 10000) // Ping every 10 seconds checking for expired orders
      return () => clearInterval(interval)
  }, [isOnline])

  // Realtime Subscription for Offers
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase.channel(`driver_offers_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `offered_to_driver_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.new.driver_id === null && payload.new.offer_expires_at) {
            router.push(`/driver/order/${payload.new.id}`)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `driver_id=eq.${user.id}`
        },
        (payload) => {
           // Assigned via auto-accept
           if (payload.new.status === "Kurir Menuju Lokasi") {
             setActiveOrder(payload.new)
             toast.success("Order baru otomatis diterima!")
           }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, router])

  const toggleOnline = async () => {
    const newState = !isOnline
    setIsOnline(newState)
    
    await fetch("/api/driver/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_online: newState })
    })
    
    if (newState) toast.success("Anda sekarang Online")
    else toast.info("Anda Offline")
  }

  const toggleAutoAccept = async () => {
    const newState = !isAutoAccept
    setIsAutoAccept(newState)
    
    await fetch("/api/driver/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_auto_accept: newState })
    })
    
    if (newState) toast.success("Auto-Accept Aktif")
    else toast.info("Auto-Accept Nonaktif")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600 mb-2" size={32} />
        <p className="text-sm font-medium text-slate-400">Memuat Dashboard...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans max-w-md mx-auto pb-24 relative overflow-hidden">
      {/* Background Decor */}
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
           {user?.avatar_url ? (
               <img src={user.avatar_url} className="w-full h-full object-cover" alt="avatar" />
           ) : (
               <span className="text-white font-bold">{user?.full_name?.charAt(0) || 'D'}</span>
           )}
        </div>
      </div>

      {/* Toggles Card */}
      <div className="relative z-10 px-5">
        <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col gap-6">
          
          {/* Online Toggle */}
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
             
             <button 
                onClick={toggleOnline}
                className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`}
             >
                <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${isOnline ? 'translate-x-6' : 'translate-x-0'}`} />
             </button>
          </div>

          <div className="h-px w-full bg-slate-100"></div>

          {/* Auto Accept Toggle */}
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
             
             <button 
                onClick={toggleAutoAccept}
                className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isAutoAccept ? 'bg-indigo-600' : 'bg-slate-300'}`}
             >
                <span className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${isAutoAccept ? 'translate-x-6' : 'translate-x-0'}`} />
             </button>
          </div>

        </div>
      </div>

      {/* Active Order Section */}
      <div className="px-5 mt-8">
        <h3 className="text-sm font-bold text-slate-800 mb-4 px-1">Order Aktif</h3>
        
        {activeOrder ? (
            <div className="bg-white rounded-3xl border border-indigo-100 shadow-sm overflow-hidden relative">
                <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500"></div>
                <div className="p-5 pl-7">
                    <div className="flex justify-between items-start mb-3">
                        <div>
                            <p className="text-xs font-bold text-indigo-600 mb-1">{activeOrder.status}</p>
                            <h4 className="text-base font-bold text-slate-900">{activeOrder.customer_name}</h4>
                        </div>
                        <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded-md">
                            #{activeOrder.id.slice(0,6).toUpperCase()}
                        </span>
                    </div>
                    
                    <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                        <Navigation size={14} className="text-slate-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-slate-600 font-medium leading-relaxed">{activeOrder.address}</p>
                    </div>

                    <button 
                        onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${activeOrder.latitude},${activeOrder.longitude}`)}
                        className="w-full bg-slate-900 text-white font-bold text-sm py-3.5 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
                    >
                        <MapPin size={16} /> Buka Navigasi Maps
                    </button>
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
                    {isOnline ? 'Pastikan aplikasi tetap terbuka agar GPS selalu terhubung.' : 'Aktifkan status penerimaan order untuk mulai bekerja.'}
                </p>
            </div>
        )}
      </div>

    </div>
  )
}
