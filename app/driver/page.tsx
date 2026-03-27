"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import {
  MapPin, Power, ShieldCheck, Clock, Loader2, Navigation,
  CheckCircle2, Package, Camera, X, Wallet
} from "lucide-react"
import { toast } from "sonner"

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
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md bg-white rounded-t-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button onClick={onCancel} className="p-1.5 text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <p className="text-xs text-slate-500 mb-5">{description}</p>

        {/* Photo */}
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
  const [withdrawModal, setWithdrawModal] = useState(false)
  const [withdrawForm, setWithdrawForm] = useState({ bank: '', account: '', name: '', amount: '' })
  const [withdrawLoading, setWithdrawLoading] = useState(false)

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

  // Refresh saldo after delivery
  const refreshUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const { data } = await supabase.from("users").select("saldo").eq("id", session.user.id).single()
    if (data) setUser((prev: any) => ({ ...prev, saldo: data.saldo }))
  }

  useEffect(() => {
    let mounted = true
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.replace("/login")
      const { data: userData } = await supabase.from("users").select("*").eq("id", session.user.id).single()
      if (mounted && userData) {
        setUser(userData)
        setIsOnline(userData.is_online || false)
        setIsAutoAccept(userData.is_auto_accept || false)
      }
      if (mounted) await pollActiveOrder()
      if (mounted) setLoading(false)
    }
    init()
    return () => { mounted = false }
  }, [router])

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
    const interval = setInterval(() => fetch("/api/dispatch/cron", { method: "POST" }).catch(() => {}), 10000)
    return () => clearInterval(interval)
  }, [isOnline])

  // Realtime
  useEffect(() => {
    if (!user?.id) return
    const channel = supabase.channel(`driver_${user.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "driver_orders", filter: `driver_id=eq.${user.id}` }, async (payload: any) => {
        if (payload.new.status === "offered") router.push(`/driver/order/${payload.new.id}`)
        else if (payload.new.status === "accepted") {
          const { data: fullOrder } = await supabase.from("driver_orders").select("*, orders(*)").eq("id", payload.new.id).single()
          if (fullOrder) { setActiveDriverOrder(fullOrder); toast.success("Order prioritas diterima!") }
        }
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

  const toggleAutoAccept = async () => {
    const val = !isAutoAccept; setIsAutoAccept(val)
    await fetch("/api/driver/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_auto_accept: val }) })
    if (val) toast.success("Auto-Accept Aktif"); else toast.info("Auto-Accept Nonaktif")
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
      } else { toast.error(data.error || "Gagal update status") }
    } catch { toast.error("Terjadi error") } finally { setStatusLoading(false) }
  }

  const handleArrivedAtCustomer = async () => {
    setStatusLoading(true)
    const orderId = activeDriverOrder?.order_id || activeDriverOrder?.orders?.id
    try {
      const res = await fetch("/api/driver/update-status", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: "arrived_at_customer" })
      })
      const data = await res.json()
      if (data.success) {
        setActiveDriverOrder((prev: any) => ({ ...prev, status: "arrived_at_customer" }))
        toast.success("Tiba di Lokasi Pelanggan!")
      } else { toast.error(data.error || "Gagal update status") }
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
      } else { toast.error(data.error || "Gagal update status") }
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
        const commissionFmt = data.commission ? `+Rp ${data.commission.toLocaleString('id-ID')} komisi` : ""
        toast.success(`Order Selesai! ${commissionFmt} 🎉`)
      } else { toast.error(data.error || "Gagal update status") }
    } catch { toast.error("Terjadi error") } finally { setStatusLoading(false) }
  }

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!withdrawForm.bank || !withdrawForm.account || !withdrawForm.name || !withdrawForm.amount) {
      return toast.error("Semua field harus diisi")
    }
    const amountNum = parseInt(withdrawForm.amount)
    if (isNaN(amountNum) || amountNum < 10000) {
      return toast.error("Minimal penarikan Rp 10.000")
    }
    if (amountNum > (user?.saldo || 0)) {
      return toast.error("Saldo tidak mencukupi")
    }

    setWithdrawLoading(true)
    try {
      const res = await fetch("/api/driver/withdraw", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bank_name: withdrawForm.bank,
          account_number: withdrawForm.account,
          account_name: withdrawForm.name,
          amount: amountNum
        })
      })
      const data = await res.json()
      if (data.success) {
        toast.success("Permintaan penarikan berhasil dikirim!")
        setWithdrawModal(false)
        setWithdrawForm({ bank: '', account: '', name: '', amount: '' })
        await refreshUser()
      } else {
        toast.error(data.error || "Gagal mengajukan penarikan")
      }
    } catch {
      toast.error("Terjadi error pada server")
    } finally {
      setWithdrawLoading(false)
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
      {/* BACKGROUND */}
      <div className={`absolute top-0 left-0 right-0 h-64 transition-colors duration-700 ${isOnline ? 'bg-emerald-600' : 'bg-slate-800'} rounded-b-[40px] z-0`}></div>

      {/* HEADER */}
      <div className="relative z-10 px-6 pt-12 pb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Halo, {user?.full_name?.split(' ')[0] || 'Driver'}</h1>
          <p className="text-white/80 text-sm mt-1 flex items-center gap-1.5">
            {location ? <MapPin size={12} /> : <Loader2 size={12} className="animate-spin" />}
            {location ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}` : 'Mencari lokasi...'}
          </p>
        </div>
        {/* Saldo Badge */}
        <div className="flex flex-col items-end gap-2">
          <div className="bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl px-4 py-2 text-right">
            <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">Saldo Komisi</p>
            <p className="text-base font-extrabold text-white">Rp {(user?.saldo || 0).toLocaleString('id-ID')}</p>
          </div>
          <button 
            onClick={() => setWithdrawModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-emerald-600 rounded-xl text-xs font-bold hover:bg-emerald-50 transition-colors shadow-sm"
          >
            <Wallet size={14} /> Tarik Komisi
          </button>
        </div>
      </div>

      {/* TOGGLES CARD */}
      <div className="relative z-10 px-5">
        <div className="bg-white rounded-3xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col gap-5">
          <div className="flex justify-between items-center">
            <div className="flex gap-4 items-center">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isOnline ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                <Power size={24} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-base">{isOnline ? 'Menerima Order' : 'Sedang Offline'}</h2>
                <p className="text-xs text-slate-500 font-medium">Status Pekerjaan</p>
              </div>
            </div>
            <button onClick={toggleOnline}
              className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`}>
              <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition ${isOnline ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
          <div className="h-px bg-slate-100" />
          <div className="flex justify-between items-center">
            <div className="flex gap-4 items-center">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isAutoAccept ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                <ShieldCheck size={24} strokeWidth={2.5} />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-base">Prioritas Auto-Terima</h2>
                <p className="text-xs text-slate-500 font-medium">Terima order tanpa tunggu</p>
              </div>
            </div>
            <button onClick={toggleAutoAccept}
              className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${isAutoAccept ? 'bg-indigo-600' : 'bg-slate-300'}`}>
              <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition ${isAutoAccept ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ACTIVE ORDER */}
      <div className="px-5 mt-6">
        <h3 className="text-sm font-bold text-slate-800 mb-4 px-1">Order Aktif</h3>

        {activeDriverOrder && activeOrder ? (
          <div className="bg-white rounded-3xl border border-indigo-100 shadow-sm overflow-hidden relative">
            <div className={`absolute top-0 left-0 w-2 h-full ${['picked_up', 'arrived_at_customer'].includes(activeDriverOrder.status) ? 'bg-blue-500' : 'bg-indigo-500'}`}></div>
            <div className="p-5 pl-7">
              <div className="flex justify-between items-start mb-1">
                <p className={`text-xs font-bold mb-1 ${['picked_up', 'arrived_at_customer'].includes(activeDriverOrder.status) ? 'text-blue-600' : 'text-indigo-600'}`}>
                  {activeDriverOrder.status === 'arrived_at_customer' ? '📍 Tiba di Pelanggan' :
                   activeDriverOrder.status === 'picked_up' ? '🚴 Sedang Dikirim' : 
                   activeDriverOrder.status === 'arrived_at_store' ? '🏪 Tiba di Toko' : '📦 Menuju Toko'}
                </p>
                <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-1 rounded-md">
                  #{activeOrder.id?.slice(0, 6).toUpperCase()}
                </span>
              </div>
              <h4 className="text-base font-bold text-slate-900 mb-3">{activeOrder.customer_name}</h4>

              {/* Data Order Items */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Daftar Pesanan</p>
                <div className="space-y-3">
                  {activeDriverOrder.order_items?.map((item: any, idx: number) => {
                    const shopName = item.product_name?.split(" | ")[1] || "Toko Tidak Diketahui"
                    const itemName = item.product_name?.split(" | ")[0]
                    return (
                      <div key={idx} className="flex gap-3 items-center text-xs pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-white border border-slate-100 shrink-0">
                          <img src={item.image_url || "/placeholder.png"} alt={itemName} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-700 truncate line-clamp-1 mb-0.5">{itemName}</p>
                          <p className="text-slate-400 text-[10px] truncate max-w-[100px]">{shopName}</p>
                        </div>
                        <div className="font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md">
                          {item.quantity}x
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Show store focus if not picked up yet */}
              {!['picked_up', 'arrived_at_customer'].includes(activeDriverOrder.status) && activeOrder.shop_address && (
                <div className="flex items-start gap-2 bg-orange-50 p-3 rounded-xl border border-orange-100 mb-4">
                  <Package size={14} className="text-orange-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold text-orange-600 mb-0.5">AMBIL DI (TOKO)</p>
                    <p className="text-xs text-orange-800 font-medium leading-snug">{activeOrder.shop_address}</p>
                  </div>
                </div>
              )}

              {/* Show delivery focus if picked up or arriving at customer */}
              {['picked_up', 'arrived_at_customer'].includes(activeDriverOrder.status) && (
                <div className="flex items-start gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100 mb-4">
                  <Navigation size={14} className="text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 mb-0.5">ANTAR KE (PELANGGAN)</p>
                    <p className="text-sm font-semibold text-slate-800 mb-1">{activeOrder.customer_name}</p>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">{activeOrder.address}</p>
                  </div>
                </div>
              )}

              <button
                onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${activeOrder.latitude},${activeOrder.longitude}`)}
                className="w-full bg-slate-900 text-white font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors mb-3"
              >
                <MapPin size={16} /> Buka Navigasi Maps
              </button>

              {activeDriverOrder.status === "accepted" && (
                <button onClick={handleArrivedAtStore} disabled={statusLoading}
                  className="w-full bg-slate-900 text-white font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors">
                  📍 Saya Sudah Tiba di Toko
                </button>
              )}
              {activeDriverOrder.status === "arrived_at_store" && (
                <button onClick={() => setPickupModal(true)} disabled={statusLoading}
                  className="w-full bg-blue-500 text-white font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-600 transition-colors">
                  <Camera size={16} /> Ambil dari Toko (Upload Bukti)
                </button>
              )}
              {activeDriverOrder.status === "picked_up" && (
                <button onClick={handleArrivedAtCustomer} disabled={statusLoading}
                  className="w-full bg-slate-900 text-white font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors">
                  📍 Saya Tiba di Lokasi Pelanggan
                </button>
              )}
              {activeDriverOrder.status === "arrived_at_customer" && (
                <button onClick={() => setDeliveryModal(true)} disabled={statusLoading}
                  className="w-full bg-emerald-500 text-white font-bold text-sm py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors">
                  <CheckCircle2 size={16} /> Selesai Antar (Upload Bukti + GPS)
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-slate-100/50 border-2 border-dashed border-slate-200 rounded-3xl p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-4">
              <Clock size={28} className="text-slate-400 animate-pulse" />
            </div>
            <h4 className="text-base font-bold text-slate-800 mb-1">{isOnline ? 'Menunggu Order...' : 'Anda Sedang Offline'}</h4>
            <p className="text-xs text-slate-500 font-medium max-w-[200px]">
              {isOnline ? 'Pastikan aplikasi tetap terbuka.' : 'Aktifkan status untuk mulai bekerja.'}
            </p>
          </div>
        )}
      </div>

      {/* PROOF MODALS */}
      {pickupModal && (
        <ProofModal
          title="Bukti Pengambilan Barang"
          description="Foto barang yang sudah Anda terima dari toko harus terlihat jelas."
          onConfirm={(url) => handlePickupConfirm(url)}
          onCancel={() => setPickupModal(false)}
          requireGps={false}
          loading={statusLoading}
        />
      )}
      {deliveryModal && (
        <ProofModal
          title="Bukti Serah Terima Pelanggan"
          description="Pastikan penerima dan barang terlihat jelas di foto. Lokasi GPS dikunci secara otomatis."
          onConfirm={(url, lat, lng) => handleDeliveryConfirm(url, lat, lng)}
          onCancel={() => setDeliveryModal(false)}
          requireGps={true}
          loading={statusLoading}
        />
      )}

      {/* WITHDRAW MODAL */}
      {withdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !withdrawLoading && setWithdrawModal(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-[32px] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-slate-900">Tarik Komisi</h2>
              <button onClick={() => !withdrawLoading && setWithdrawModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"><X size={18} /></button>
            </div>
            <p className="text-xs text-slate-500 mb-6">Uang akan dikirim ke rekening atau e-wallet yang Anda daftarkan di bawah ini.</p>
            
            <form onSubmit={handleWithdraw} className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Metode (Bank / E-Wallet)</label>
                <input type="text" placeholder="Contoh: BCA, GoPay, Dana" required
                  value={withdrawForm.bank} onChange={e => setWithdrawForm({ ...withdrawForm, bank: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-medium outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Nomor Rekening / HP</label>
                <input type="text" placeholder="Masukkan nomor akun" required
                  value={withdrawForm.account} onChange={e => setWithdrawForm({ ...withdrawForm, account: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-medium outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Nama Pemilik Akun</label>
                <input type="text" placeholder="Sesuai nama di rekening" required
                  value={withdrawForm.name} onChange={e => setWithdrawForm({ ...withdrawForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-medium outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1 block">Saldo yang ditarik</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold">Rp</span>
                  <input type="number" placeholder="Min. 10000" min="10000" max={user?.saldo || 0} required
                    value={withdrawForm.amount} onChange={e => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-medium outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all" />
                </div>
              </div>
              
              <button 
                type="submit" disabled={withdrawLoading}
                className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm py-3.5 rounded-xl shadow-lg shadow-indigo-600/20 active:scale-[0.98] transition-all flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {withdrawLoading ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
                Tarik Saldo Sekarang
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
