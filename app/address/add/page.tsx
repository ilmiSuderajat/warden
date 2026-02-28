"use client"

import { useState } from "react"
import {
  ArrowLeft, MapPin, Navigation, Info,
  Loader2, CheckCircle2, ChevronLeft,
  Crosshair, Search, ExternalLink
} from "lucide-react";
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function AddAddressPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [detecting, setDetecting] = useState(false)

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    city: "",
    kecamatan: "",
    kelurahan: "",
    rt: "",
    rw: "",
    detail: "",
    is_default: false,
    latitude: null as number | null,
    longitude: null as number | null,
  })

  // FUNGSI DETEKSI LOKASI
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Browser tidak mendukung Geolocation")
      return
    }

    setDetecting(true)

    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords

      setFormData(prev => ({
        ...prev,
        latitude: latitude,
        longitude: longitude
      }))

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
          { headers: { 'User-Agent': 'WardenApp/1.0' } }
        )
        const data = await res.json()

        if (data.address) {
          const addr = data.address
          const city = addr.city || addr.town || addr.municipality || addr.city_district || ""
          const kecamatan = addr.suburb || addr.city_district || ""
          const kelurahan = addr.village || addr.neighbourhood || ""

          setFormData(prev => ({
            ...prev,
            city: city,
            kecamatan: kecamatan,
            kelurahan: kelurahan,
            detail: data.display_name
          }))
          toast.success("Lokasi berhasil dideteksi!")
        }
      } catch (error) {
        console.error(error)
        toast.error("Gagal mengambil alamat. Coba isi manual.")
      } finally {
        setDetecting(false)
      }
    }, (error) => {
      console.error(error)
      toast.error("Akses lokasi ditolak. Aktifkan izin lokasi di pengaturan.")
      setDetecting(false)
    }, {
      enableHighAccuracy: true,
      timeout: 10000
    })
  }

  // FUNGSI CARI LOKASI LEWAT TEKS
  const searchLocationByText = async () => {
    if (!formData.detail || formData.detail.length < 5) {
      return toast.error("Masukkan alamat lebih detail untuk mencari")
    }
    setDetecting(true)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(formData.detail)}&limit=1`, {
        headers: { 'User-Agent': 'WardenApp/1.0' }
      })
      const data = await res.json()
      if (data && data.length > 0) {
        const spot = data[0]
        setFormData(prev => ({
          ...prev,
          latitude: parseFloat(spot.lat),
          longitude: parseFloat(spot.lon),
          // Parsing detail jika nominatim memberikan data terstruktur
        }))
        toast.success("Titik lokasi ditemukan!")
      } else {
        toast.error("Alamat tidak ditemukan. Coba ketik lebih spesifik.")
      }
    } catch (err) {
      toast.error("Gagal melakukan pencarian.")
    } finally {
      setDetecting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.latitude || !formData.longitude) {
      toast.error("Titik koordinat (Maps) belum terdeteksi. Silakan klik 'Gunakan Lokasi' atau cari alamat.")
      setLoading(false)
      return
    }
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        toast.error("Anda harus login terlebih dahulu")
        router.push("/login")
        return
      }

      const { error } = await supabase.from("addresses").insert([{
        user_id: user.id,
        name: formData.name,
        phone: formData.phone,
        city: formData.city,
        kecamatan: formData.kecamatan,
        kelurahan: formData.kelurahan,
        rt: formData.rt,
        rw: formData.rw,
        detail: formData.detail,
        latitude: formData.latitude,
        longitude: formData.longitude,
        is_default: formData.is_default
      }])

      if (error) throw error

      router.push("/address")
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error("Gagal menyimpan alamat")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto font-sans pb-10">

      {/* HEADER FIXED */}
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-center bg-white border-b border-slate-100">
        <div className="w-full max-w-md h-14 flex items-center px-4">
          <button onClick={() => router.back()} className="p-1 -ml-1 text-slate-700 active:scale-95 transition-transform">
            <ChevronLeft size={24} strokeWidth={2.5} />
          </button>
          <h1 className="ml-3 text-base font-bold text-slate-900">Tambah Alamat Baru</h1>
        </div>
      </header>

      {/* CONTENT AREA */}
      <div className="pt-20 px-5">

        {/* MAP PREVIEW */}
        {formData.latitude && formData.longitude && (
          <div className="mb-4 rounded-xl overflow-hidden border border-slate-200 shadow-sm relative">
            <div className="aspect-video w-full bg-slate-100">
              <iframe
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${formData.longitude - 0.005}%2C${formData.latitude - 0.005}%2C${formData.longitude + 0.005}%2C${formData.latitude + 0.005}&layer=mapnik&marker=${formData.latitude}%2C${formData.longitude}`}
              />
            </div>
            <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1 shadow-xs">
              <MapPin size={12} className="text-red-500" />
              <span className="text-[10px] font-bold text-slate-600">Lokasi Terdeteksi</span>
            </div>
          </div>
        )}

        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm mb-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Crosshair size={16} className="text-indigo-600" />
            </div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Akurasi Pengiriman</h3>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={detecting}
              className="w-full p-3.5 bg-indigo-600 text-white rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:bg-slate-300 shadow-md shadow-indigo-100"
            >
              {detecting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Navigation size={16} fill="currentColor" />
              )}
              <span className="text-xs font-bold uppercase tracking-wider">
                {detecting ? "Mendeteksi..." : "Deteksi Lokasi Saya"}
              </span>
            </button>
            <p className="text-[10px] text-slate-400 text-center px-4 font-medium leading-relaxed">
              Klik tombol di atas agar kurir dapat menemukan rumah Anda dengan akurat lewat GPS.
            </p>
          </div>

          {/* Lokasi Detail & Koordinat Card */}
          {(formData.latitude && formData.longitude) ? (
            <div className="mt-4 bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-600" />
                  <span className="text-[10px] font-bold text-emerald-700 tracking-tight uppercase">Koordinat Terkunci</span>
                </div>
                <button
                  type="button"
                  onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${formData.latitude},${formData.longitude}`, '_blank')}
                  className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 hover:underline"
                >
                  <span>Verifikasi Maps</span>
                  <ExternalLink size={10} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white/80 px-2 py-1.5 rounded-lg border border-emerald-100/50 flex flex-col">
                  <span className="text-[8px] text-slate-400 uppercase font-bold tracking-tighter">Lat</span>
                  <span className="text-[10px] font-mono font-bold text-slate-700">{formData.latitude.toFixed(6)}</span>
                </div>
                <div className="bg-white/80 px-2 py-1.5 rounded-lg border border-emerald-100/50 flex flex-col">
                  <span className="text-[8px] text-slate-400 uppercase font-bold tracking-tighter">Lng</span>
                  <span className="text-[10px] font-mono font-bold text-slate-700">{formData.longitude.toFixed(6)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 bg-orange-50 border border-orange-100 p-3 rounded-xl flex items-start gap-2.5">
              <Info size={16} className="text-orange-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-orange-700 font-medium leading-relaxed">
                <span className="font-bold">PENTING:</span> Lokasi GPS wajib terdeteksi agar pesanan dapat diproses.
              </p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 pb-10">

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 ml-1 uppercase tracking-wider">Nama Penerima</label>
            <input
              required
              className="w-full bg-white border border-slate-200 p-3.5 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition-all shadow-sm"
              placeholder="Contoh: Budi Santoso"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 ml-1 uppercase tracking-wider">No. WhatsApp</label>
            <input
              required
              type="tel"
              className="w-full bg-white border border-slate-200 p-3.5 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition-all shadow-sm"
              placeholder="Contoh: 08123456789"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 ml-1 uppercase tracking-wider">Kota</label>
            <input
              required
              value={formData.city}
              className="w-full bg-white border border-slate-200 p-3.5 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition-all shadow-sm"
              placeholder="Contoh: Jakarta Selatan"
              onChange={(e) => setFormData({ ...formData, kecamatan: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 ml-1 uppercase tracking-wider">Kecamatan</label>
            <input
              required
              value={formData.kecamatan}
              className="w-full bg-white border border-slate-200 p-3.5 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition-all shadow-sm"
              placeholder="Contoh: Tebet"
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 ml-1 uppercase tracking-wider">Kelurahan</label>
            <input
              required
              value={formData.kelurahan}
              className="w-full bg-white border border-slate-200 p-3.5 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition-all shadow-sm"
              placeholder="Contoh: Manggarai Selatan"
              onChange={(e) => setFormData({ ...formData, kelurahan: e.target.value })}
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 ml-1 uppercase tracking-wider">RT</label>
              <input
                className="w-full bg-white border border-slate-200 p-3.5 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition-all shadow-sm"
                placeholder="001"
                value={formData.rt}
                onChange={(e) => setFormData({ ...formData, rt: e.target.value })}
              />
            </div>
            <div className="flex-1 space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 ml-1 uppercase tracking-wider">RW</label>
              <input
                className="w-full bg-white border border-slate-200 p-3.5 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition-all shadow-sm"
                placeholder="001"
                value={formData.rw}
                onChange={(e) => setFormData({ ...formData, rw: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 ml-1 uppercase tracking-wider">Alamat Detail (No. Rumah, Patokan)</label>
            <div className="relative">
              <textarea
                required
                value={formData.detail}
                rows={3}
                className="w-full bg-white border border-slate-200 p-3.5 pr-12 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition-all resize-none shadow-sm"
                placeholder="Contoh: Jln. Manggarai No. 12, Samping Indomaret"
                onChange={(e) => setFormData({ ...formData, detail: e.target.value })}
              />
              <button
                type="button"
                onClick={searchLocationByText}
                className="absolute right-3 bottom-4 p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                title="Cari koordinat dari alamat"
              >
                {detecting ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold uppercase tracking-widest shadow-lg shadow-indigo-100 active:scale-[0.98] transition-all mt-4 disabled:bg-indigo-300"
          >
            {loading ? "Sedang Menyimpan..." : "Simpan Alamat Sekarang"}
          </button>
        </form>
      </div>
    </div>
  )
}