"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import {
  MapPin, Power, ShieldCheck, Clock, Loader2, Navigation,
  CheckCircle2, Package, Camera, X, Wallet, ChevronLeft,
  Menu, Bell, Settings, Award, History, HelpCircle, Users,
  BookOpen, Gift, ListTodo, Star, BarChart3, ChevronRight,
  TrendingUp, Search, Store
} from "lucide-react"
import { toast } from "sonner"
import { motion, AnimatePresence } from "framer-motion"

// Dynamic import for Map to avoid SSR issues with Leaflet
const DriverMap = dynamic(() => import("./components/DriverMap"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-slate-100 animate-pulse" />
})

// ─── Proof Upload Modal ────────────────────────────────────────
function ProofModal({
  title, description, onConfirm, onCancel, requireGps = false, loading
}: {
  title: string, description: string,
  onConfirm: (url: string, lat?: number, lng?: number) => void,
  onCancel: () => void, requireGps?: boolean, loading: boolean
}) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [gps, setGps] = useState<{ lat: number, lng: number } | null>(null)
  const [gpsLoading, setGpsLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const captureGps = () => {
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGpsLoading(false)
        toast.success("Lokasi berhasil dikunci")
      },
      () => { setGpsLoading(false); toast.error("Gagal mendapatkan GPS") },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const handleSubmit = async () => {
    if (!file) return toast.error("Pilih foto terlebih dahulu")
    if (requireGps && !gps) return toast.error("Kunci lokasi GPS terlebih dahulu")
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", requireGps ? "delivery" : "pickup")
      const res = await fetch("/api/driver/upload-proof", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      onConfirm(data.url, gps?.lat, gps?.lng)
    } catch (e: any) {
      toast.error(e.message || "Gagal upload foto")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button onClick={onCancel} className="p-1.5 text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-slate-500 mb-5">{description}</p>

        <div
          onClick={() => inputRef.current?.click()}
          className="w-full h-44 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 overflow-hidden flex items-center justify-center mb-4 cursor-pointer hover:bg-slate-50 transition-colors"
        >
          {preview
            ? <img src={preview} className="w-full h-full object-cover" alt="proof" />
            : <div className="flex flex-col items-center gap-2 text-slate-400">
              <Camera size={32} />
              <p className="text-xs font-medium">Ketuk untuk Ambil Foto</p>
            </div>
          }
        </div>
        <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pickFile} />

        {requireGps && (
          <button
            onClick={captureGps}
            disabled={gpsLoading}
            className={`w-full mb-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors ${gps
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-slate-100 text-slate-700 border border-slate-200'}`}
          >
            {gpsLoading
              ? <Loader2 size={14} className="animate-spin" />
              : <MapPin size={14} />}
            {gps ? `✅ GPS terkunci: ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}` : "Kunci Lokasi GPS Sekarang"}
          </button>
        )}

        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-sm">Batal</button>
          <button
            onClick={handleSubmit}
            disabled={!file || (requireGps && !gps) || uploading || loading}
            className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {(uploading || loading) ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            Konfirmasi
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sidebar Item ──────────────────────────────────────────────
function SidebarItem({ icon: Icon, label, href, badge, onClick, dot }: any) {
  const content = (
    <div className="flex items-center justify-between py-4 active:bg-slate-50 transition-colors cursor-pointer group" onClick={onClick}>
      <div className="flex items-center gap-4">
        <div className="text-slate-700 group-hover:text-indigo-600 transition-colors">
          <Icon size={22} strokeWidth={2} />
        </div>
        <span className="text-sm font-medium text-slate-800">{label}</span>
        {badge && <span className="bg-orange-600 text-[10px] text-white font-bold px-1.5 py-0.5 rounded-md uppercase ml-1">{badge}</span>}
        {dot && <div className="w-2 h-2 rounded-full bg-indigo-500 ml-1" />}
      </div>
      <ChevronRight size={18} className="text-slate-300" />
    </div>
  )

  if (href) return <Link href={href}>{content}</Link>
  return content
}

// ─── Main Dashboard ────────────────────────────────────────────
export default function DriverDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isOnline, setIsOnline] = useState(false)
  const [isAutoAccept, setIsAutoAccept] = useState(false)
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null)
  const [activeDriverOrder, setActiveDriverOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [statusLoading, setStatusLoading] = useState(false)
  const [pickupModal, setPickupModal] = useState(false)
  const [deliveryModal, setDeliveryModal] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"heatmap" | "orders">("heatmap")
  const [orderHistory, setOrderHistory] = useState<any[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [activeOrders, setActiveOrders] = useState<any[]>([])
  const [activeOrdersLoading, setActiveOrdersLoading] = useState(false)

  const watchId = useRef<number | null>(null)

  const pollActiveOrder = async () => {
    try {
      const res = await fetch("/api/driver/my-order")
      const data = await res.json()
      if (data.type === "active") setActiveDriverOrder(data.driverOrder)
      else if (data.type === "offer") router.push(`/driver/order/${data.driverOrder.id}`)
      else setActiveDriverOrder(null)
    } catch { /* ignore */ }
  }

  const refreshUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data: walletData } = await supabase.from("wallets").select("balance").eq("user_id", session.user.id).maybeSingle()
    if (walletData) setUser((prev: any) => ({ ...prev, saldo: walletData.balance }))
  }

  const fetchOrderHistory = async () => {
    if (!user?.id) return
    setOrdersLoading(true)
    try {
      const res = await fetch("/api/driver/order-history")
      const data = await res.json()
      setOrderHistory(data.history || [])
    } catch { /* ignore */ } finally {
      setOrdersLoading(false)
    }
  }

  const fetchActiveOrders = async () => {
    setActiveOrdersLoading(true)
    try {
      const res = await fetch("/api/driver/active-orders")
      const data = await res.json()
      setActiveOrders(data.orders || [])
    } catch { /* ignore */ } finally {
      setActiveOrdersLoading(false)
    }
  }

  useEffect(() => {
    try { localStorage.setItem("warden_mode", "driver") } catch (e) { console.error("localStorage rejected", e) }
    let mounted = true
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.replace("/login")
      const { data: userData } = await supabase.from("users").select("*").eq("id", session.user.id).single()
      if (mounted && userData) {
        const { data: walletData } = await supabase.from("wallets").select("balance").eq("user_id", userData.id).maybeSingle()
        setUser({ ...userData, saldo: walletData?.balance || 0 })
        setIsOnline(userData.is_online || false)
        setIsAutoAccept(userData.is_auto_accept || false)
      }
      if (mounted) await pollActiveOrder()
      if (mounted) setLoading(false)
    }
    init()
    return () => { mounted = false }
  }, [router])

  const exitDriverMode = () => {
    try { localStorage.removeItem("warden_mode") } catch (e) { }
    router.push("/")
  }

  useEffect(() => {
    if (loading || !user?.id) return
    const interval = setInterval(pollActiveOrder, 8000)
    return () => clearInterval(interval)
  }, [loading, user?.id])

  useEffect(() => {
    if (!isOnline) { if (watchId.current) navigator.geolocation.clearWatch(watchId.current); return }
    if (!("geolocation" in navigator)) return
    watchId.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        setLocation({ lat: coords.latitude, lng: coords.longitude })
        fetch("/api/driver/location", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lat: coords.latitude, lng: coords.longitude }) })
      },
      () => { toast.error("Gagal mendapatkan GPS. Pastikan izin lokasi aktif."); setIsOnline(false) },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
    return () => { if (watchId.current) navigator.geolocation.clearWatch(watchId.current) }
  }, [isOnline])

  useEffect(() => {
    if (!isOnline) return
    const interval = setInterval(() => fetch("/api/dispatch/cron", { method: "POST" }).catch(() => { }), 10000)
    return () => clearInterval(interval)
  }, [isOnline])

  // Realtime
  useEffect(() => {
    if (!user?.id) return
    const channel = supabase.channel(`driver_${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "driver_orders", filter: `driver_id=eq.${user.id}` }, async (payload: any) => {
        if (payload.new.status === "offered") router.push(`/driver/order/${payload.new.id}`)
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "driver_orders", filter: `driver_id=eq.${user.id}` }, async (payload: any) => {
        if (payload.new.status === "accepted") {
          const { data: fullOrder } = await supabase.from("driver_orders").select("*, orders(*)").eq("id", payload.new.id).single()
          if (fullOrder) { setActiveDriverOrder(fullOrder); toast.success("Order diterima!") }
        }
        if (["delivered", "rejected", "expired"].includes(payload.new.status)) setActiveDriverOrder(null)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id, router])

  const toggleOnline = async () => {
    const val = !isOnline; setIsOnline(val)
    await fetch("/api/driver/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_online: val }) })
    if (val) toast.success("Anda sekarang Online"); else toast.info("Anda Offline")
  }

  const handleArrivedAtStore = async () => {
    setStatusLoading(true)
    const orderId = activeDriverOrder?.order_id || activeDriverOrder?.orders?.id
    try {
      const res = await fetch("/api/driver/update-status", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: "arrived_at_store" })
      })
      const data = await res.json()
      if (data.success) {
        setActiveDriverOrder((prev: any) => ({ ...prev, status: "arrived_at_store" }))
        toast.success("Tiba di Toko!")
      }
    } catch { toast.error("Terjadi error") } finally { setStatusLoading(false) }
  }

  const handlePickupConfirm = async (pickupPhotoUrl: string) => {
    setStatusLoading(true)
    const orderId = activeDriverOrder?.order_id || activeDriverOrder?.orders?.id
    try {
      const res = await fetch("/api/driver/update-status", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: "picked_up", pickupPhotoUrl })
      })
      const data = await res.json()
      if (data.success) {
        setPickupModal(false)
        setActiveDriverOrder((prev: any) => ({ ...prev, status: "picked_up" }))
        toast.success("Status: Sedang Dikirim!")
      }
    } catch { toast.error("Terjadi error") } finally { setStatusLoading(false) }
  }

  const handleDeliveryConfirm = async (deliveryPhotoUrl: string, lat?: number, lng?: number) => {
    setStatusLoading(true)
    const orderId = activeDriverOrder?.order_id || activeDriverOrder?.orders?.id
    try {
      const res = await fetch("/api/driver/update-status", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: "delivered", deliveryPhotoUrl, deliveryLat: lat, deliveryLng: lng })
      })
      const data = await res.json()
      if (data.success) {
        setDeliveryModal(false)
        setActiveDriverOrder(null)
        await refreshUser()
        toast.success(`Order Selesai! 🎉`)
      }
    } catch { toast.error("Terjadi error") } finally { setStatusLoading(false) }
  }

  if (loading) return <div className=" flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" /></div>

  const activeOrder = activeDriverOrder?.orders

  return (
    <div className=" bg-white font-sans max-w-md mx-auto relative overflow-hidden flex flex-col" style={{ height: '100dvh' }}>

      {/* ─── MAP LAYER ─── */}
      <DriverMap
        center={location ? [location.lat, location.lng] : [-6.2, 106.8]}
        isOnline={isOnline}
      />

      {/* ─── TOP HUD HEADER ─── */}
      <div className="relative z-20 pointer-events-none">
        <div className="bg-gray-50 p-5 pt-10 pointer-events-auto border-b border-indigo-500/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="relative" onClick={() => setSidebarOpen(true)}>
                <img
                  src={user?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"}
                  className="w-12 h-12 rounded-full border-2 border-white shadow-sm cursor-pointer active:scale-90 transition-transform"
                  alt="driver"
                />
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 leading-tight uppercase tracking-tight">{user?.full_name?.split(' ')[0] || 'ILMI'}</h2>
                <p className="text-xs font-medium text-slate-500 flex items-center gap-1">
                  {isOnline ? (
                    <><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Sedang Aktif</>
                  ) : (
                    <><span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Offline</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex bg-white rounded-2xl p-2 gap-3  border border-slate-100">
              <div className="flex items-center gap-1.5">
                <Star size={16} fill="#FACC15" className="text-yellow-400" />
                <span className="text-sm font-bold text-slate-800">4.75</span>
              </div>
              <div className="w-px h-4 bg-slate-200 self-center" />
              <div className="flex items-center gap-1.5">
                <BarChart3 size={16} className="text-indigo-500" />
                <span className="text-sm font-bold text-slate-800">0.0%</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex mt-2 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/60">
            <button
              onClick={() => setActiveTab("heatmap")}
              className={`flex-1 py-2.5 text-sm font-bold transition-all rounded-xl relative ${activeTab === 'heatmap' ? 'text-indigo-600 bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Peta Lokasi
            </button>
            <button
              onClick={() => { setActiveTab("orders"); fetchActiveOrders() }}
              className={`flex-1 py-2.5 text-sm font-bold transition-all rounded-xl relative ${activeTab === 'orders' ? 'text-indigo-600 bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Pesanan Aktif
            </button>
          </div>
        </div>
      </div>

      {/* ─── ORDERS TAB PANEL (Active Orders) ─── */}
      {activeTab === 'orders' && (
        <div className="relative z-20 flex-1 overflow-y-auto bg-white/95 backdrop-blur-sm px-4 pt-4 pb-32">
          {activeOrdersLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={24} className="animate-spin text-indigo-500" />
            </div>
          ) : activeOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                <Package size={28} className="text-indigo-300" />
              </div>
              <p className="text-sm font-bold text-slate-700 mb-1">Tidak Ada Pesanan Aktif</p>
              <p className="text-xs text-slate-400">Nyalakan status online untuk mulai menerima pesanan</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">{activeOrders.length} Pesanan Aktif</p>
              {activeOrders.map((driverOrder) => {
                const order = driverOrder.orders
                const statusMap: Record<string, { label: string, color: string, dot: string }> = {
                  offered: { label: 'Penawaran Masuk', color: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-400' },
                  accepted: { label: 'Menuju Toko', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
                  arrived_at_store: { label: 'Tiba di Toko', color: 'bg-indigo-100 text-indigo-700', dot: 'bg-indigo-500' },
                  picked_up: { label: 'Sedang Dikirim', color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
                  arrived_at_customer: { label: 'Tiba di Tujuan', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
                }
                const st = statusMap[driverOrder.status] || { label: driverOrder.status, color: 'bg-slate-100 text-slate-500', dot: 'bg-slate-400' }
                const earning = Math.floor((order?.shipping_amount || 0) * 0.80)
                return (
                  <div key={driverOrder.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full animate-pulse ${st.dot}`} />
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">#{order?.id?.slice(0, 8)?.toUpperCase()}</span>
                    </div>
                    <h4 className="text-[13px] font-bold text-slate-900 truncate mb-0.5">{order?.customer_name || 'Pelanggan'}</h4>
                    <p className="text-[11px] text-slate-400 line-clamp-1 mb-3">{order?.address}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                      <div className="flex items-center gap-1 text-slate-400">
                        <MapPin size={11} />
                        <span className="text-[10px] font-medium">{order?.distance_km != null ? `${Number(order.distance_km).toFixed(1)} km` : '-'}</span>
                      </div>
                      <p className="text-sm font-extrabold text-indigo-600">+Rp {earning.toLocaleString('id-ID')}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── SIDEBAR DRAWER ─── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-[50]"
            />
            <motion.div
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute inset-y-0 left-0 w-[85%] max-w-[320px] bg-white z-[60] shadow-2xl flex flex-col"
            >
              <div className="bg-gray-50 p-6 pt-12 flex flex-col items-center">
                <div className="relative mb-3">
                  <img src={user?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"} className="w-20 h-20 rounded-full border-4 border-white/30 shadow-md" alt="p" />
                  <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white ${isOnline ? 'bg-emerald-400' : 'bg-white/40'}`} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 uppercase tracking-tight">{user?.full_name || 'ILMI'}</h3>
                <p className="text-xs text-slate-500 font-medium mt-1">{isOnline ? 'Sedang Online' : 'Offline'}</p>
              </div>

              <div className="flex-1 overflow-y-auto px-6 pb-10 scrollbar-hide">
                <div className="flex items-center justify-between py-4">
                  <span className="text-sm font-bold text-slate-800">Status Kerja</span>
                  <button onClick={toggleOnline}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${isOnline ? 'bg-indigo-500' : 'bg-slate-200'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${isOnline ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
                <SidebarItem icon={ListTodo} label="Pesanan Searah" badge="Baru" />
                <SidebarItem icon={Navigation} label="Hub" />
                <SidebarItem icon={Bell} label="Notifikasi" dot />
                <SidebarItem icon={Wallet} label="Saldo Saya" href="/driver/wallet" />
                <SidebarItem icon={Award} label="Insentif" />
                <SidebarItem icon={TrendingUp} label="Poin Penalti" badge="Baru" />
                <SidebarItem icon={History} label="Riwayat Pesanan" href="/driver/history" />
                <SidebarItem icon={Search} label="PuJOSera" />
                <SidebarItem icon={Gift} label="Ajak Teman Baru" badge="Hadiah" />
                <SidebarItem icon={BookOpen} label="Akademi Mitra Pengemudi" />
                <SidebarItem icon={HelpCircle} label="Bantuan" />

                {/* Pembatas untuk opsi khusus sistem */}
                <div className="h-px bg-slate-100 my-2 mx-4" />
                <SidebarItem icon={Store} label="Kembali ke Warung Kita" href="/" />
                <SidebarItem icon={Settings} label="Pengaturan" onClick={exitDriverMode} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── DASHBOARD CONTENT (Conditional) ─── */}
      {activeTab === 'heatmap' && (
        <div className="mt-auto relative z-10 px-4 pb-6 pointer-events-none">

          {/* Floating Action Buttons */}
          <div className="flex justify-end mb-4 pointer-events-auto">
            <button className="w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-slate-700 active:scale-90 transition-transform">
              <Navigation size={22} className="rotate-45" />
            </button>
          </div>

          {/* ACTIVE ORDER OR START BUTTON */}
          <AnimatePresence mode="wait">
            {activeDriverOrder && activeOrder ? (
              <motion.div
                key="active-order"
                initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
                className="bg-white rounded-3xl shadow-2xl p-5 border border-slate-100 pointer-events-auto"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                    <span className="text-[10px] font-extrabold text-indigo-600 uppercase tracking-widest">
                      {activeDriverOrder.status === 'arrived_at_customer' ? 'Tiba di Pelanggan' :
                        activeDriverOrder.status === 'picked_up' ? 'Sedang Dikirim' :
                          activeDriverOrder.status === 'arrived_at_store' ? 'Tiba di Toko' : 'Menjemput Pesanan'}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">#{activeOrder?.id?.slice(0, 8)?.toUpperCase()}</span>
                </div>

                <h4 className="text-base font-bold text-slate-900 mb-1">{activeOrder.customer_name}</h4>
                <p className="text-xs text-slate-500 line-clamp-1 mb-4">{activeOrder.address}</p>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => {
                      const destLat = ['picked_up', 'arrived_at_customer'].includes(activeDriverOrder.status) ? activeOrder.latitude : activeOrder.shop_latitude;
                      const destLng = ['picked_up', 'arrived_at_customer'].includes(activeDriverOrder.status) ? activeOrder.longitude : activeOrder.shop_longitude;
                      if (destLat && destLng) window.open(`https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`)
                      else toast.error("Koordinat tidak tersedia")
                    }}
                    className="py-3.5 bg-slate-900 text-white rounded-2xl text-[13px] font-bold flex items-center justify-center gap-2"
                  >
                    <MapPin size={16} /> Navigasi
                  </button>

                  {activeDriverOrder.status === "accepted" && (
                    <button onClick={handleArrivedAtStore} disabled={statusLoading}
                      className="py-3.5 bg-indigo-600 text-white rounded-2xl text-[13px] font-bold">
                      Tiba di Toko
                    </button>
                  )}
                  {activeDriverOrder.status === "arrived_at_store" && (
                    <button onClick={() => setPickupModal(true)} disabled={statusLoading}
                      className="py-3.5 bg-blue-500 text-white rounded-2xl text-[13px] font-bold flex items-center justify-center gap-2">
                      <Camera size={16} /> Ambil
                    </button>
                  )}
                  {activeDriverOrder.status === "picked_up" && (
                    <button onClick={() => { }}
                      className="py-3.5 bg-slate-900 text-white rounded-2xl text-[13px] font-bold">
                      Update Lokasi
                    </button>
                  )}
                  {activeDriverOrder.status === "arrived_at_customer" && (
                    <button onClick={() => setDeliveryModal(true)} disabled={statusLoading}
                      className="py-3.5 bg-emerald-500 text-white rounded-2xl text-[13px] font-bold flex items-center justify-center gap-2">
                      <CheckCircle2 size={16} /> Selesai
                    </button>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="start-work"
                initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
                className="relative pointer-events-auto"
              >
                <button
                  onClick={toggleOnline}
                  className="w-full h-16 rounded-2xl flex items-center border-4 border-indigo-600 bg-indigo-600 transition-all overflow-hidden group shadow-xl"
                >
                  <div className="bg-white w-14 h-14 rounded-xl flex items-center justify-center ml-1 group-active:translate-x-full transition-transform duration-300">
                    <ChevronRight className="text-indigo-600" size={28} />
                  </div>
                  <span className="flex-1 text-white font-bold text-xl text-center pr-10">
                    {isOnline ? 'Berhenti Bekerja' : 'Mulai Bekerja'}
                  </span>
                </button>
                {!isOnline && (
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur rounded-full px-4 py-1.5 shadow-md border border-slate-100 flex items-center gap-2">
                    <Clock size={14} className="text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Istirahat</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* PROOF MODALS */}
      {pickupModal && (
        <ProofModal
          title="Bukti Pengambilan Barang"
          description="Foto barang yang sudah Anda terima dari toko."
          onConfirm={(url) => handlePickupConfirm(url)}
          onCancel={() => setPickupModal(false)}
          loading={statusLoading}
        />
      )}
      {deliveryModal && (
        <ProofModal
          title="Bukti Antar Barang"
          description="Pastikan foto serah terima terlihat jelas."
          onConfirm={(url, lat, lng) => handleDeliveryConfirm(url, lat, lng)}
          onCancel={() => setDeliveryModal(false)}
          requireGps={true}
          loading={statusLoading}
        />
      )}
    </div>
  )
}
