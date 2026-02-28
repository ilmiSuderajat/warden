"use client"

import { useState } from "react"
import { ArrowLeft, MapPin, Navigation, Info, Loader2, CheckCircle2, ChevronLeft, Crosshair } from "lucide-react";
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
      enableHighAccuracy: true
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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

        <button
          type="button"
          onClick={handleDetectLocation}
          disabled={detecting}
          className="w-full mb-6 p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-center gap-3 active:bg-slate-100 transition-all group"
        >
          {detecting ? (
            <Loader2 size={18} className="animate-spin text-indigo-600" />
          ) : (
            <Crosshair size={18} className="text-indigo-600" />
          )}
          <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
            {detecting ? "Mendeteksi..." : "Gunakan Lokasi Saat Ini"}
          </span>
        </button>

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
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 ml-1 uppercase tracking-wider">Kecamatan</label>
            <input
              required
              value={formData.kecamatan}
              className="w-full bg-white border border-slate-200 p-3.5 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition-all shadow-sm"
              placeholder="Contoh: Tebet"
              onChange={(e) => setFormData({ ...formData, kecamatan: e.target.value })}
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
            <textarea
              required
              value={formData.detail}
              rows={3}
              className="w-full bg-white border border-slate-200 p-3.5 rounded-xl text-sm text-slate-800 focus:outline-none focus:border-indigo-500 transition-all resize-none shadow-sm"
              placeholder="Contoh: Jln. Manggarai No. 12, Samping Indomaret"
              onChange={(e) => setFormData({ ...formData, detail: e.target.value })}
            />
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