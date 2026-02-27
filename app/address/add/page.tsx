"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import { useRouter } from "next/navigation"

export default function AddAddressPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [detecting, setDetecting] = useState(false)
  
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    city: "",
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
      alert("Browser tidak mendukung Geolocation")
      return
    }

    setDetecting(true)
    
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords
      
      // Simpan koordinat ke state
      setFormData(prev => ({
        ...prev,
        latitude: latitude,
        longitude: longitude
      }))
      
      try {
        // Reverse Geocoding dengan Nominatim
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
          { headers: { 'User-Agent': 'WardenApp/1.0' } }
        )
        const data = await res.json()
        
        if (data.address) {
          const addr = data.address
          // Ekstrak data alamat spesifik
          const city = addr.city || addr.town || addr.municipality || ""
          const kelurahan = addr.village || addr.suburb || addr.neighbourhood || ""
          
          setFormData(prev => ({
            ...prev,
            city: city,
            kelurahan: kelurahan,
            // RT/RW jarang ada di OSM, biasanya manual
            detail: data.display_name 
          }))
        }
      } catch (error) {
        console.error(error)
        alert("Gagal mengambil alamat. Coba isi manual.")
      } finally {
        setDetecting(false)
      }
    }, (error) => {
      console.error(error)
      alert("Akses lokasi ditolak. Aktifkan izin lokasi di pengaturan.")
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
        alert("Anda harus login terlebih dahulu")
        router.push("/login")
        return
      }

      const { error } = await supabase.from("addresses").insert([{
        user_id: user.id,
        name: formData.name,
        phone: formData.phone,
        city: formData.city,
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
      alert("Gagal menyimpan alamat")
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
            <Icons.ChevronLeft size={24} strokeWidth={2.5} />
          </button>
          <h1 className="ml-3 text-base font-bold text-slate-900">Tambah Alamat Baru</h1>
        </div>
      </header>

      {/* CONTENT AREA */}
      <div className="pt-20 px-5">
        
        {/* MAP PREVIEW (Muncul jika ada koordinat) */}
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
              <Icons.MapPin size={12} className="text-red-500" />
              <span className="text-[10px] font-bold text-slate-600">Lokasi Terdeteksi</span>
            </div>
          </div>
        )}

        {/* TOMBOL DETEKSI LOKASI */}
        <button 
          type="button"
          onClick={handleDetectLocation}
          disabled={detecting}
          className="w-full mb-6 p-4 bg-white border border-slate-200 rounded-xl flex items-center justify-center gap-3 active:bg-slate-100 transition-all group"
        >
          {detecting ? (
            <Icons.Loader2 size={18} className="animate-spin text-indigo-600" />
          ) : (
            <Icons.Crosshair size={18} className="text-indigo-600" />
          )}
          <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">
            {detecting ? "Mendeteksi..." : "Gunakan Lokasi Saat Ini"}
          </span>
        </button>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* INPUT NAMA & TELEPON (Side by side) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 ml-1">Nama</label>
              <input 
                required
                className="w-full bg-white border border-slate-200 p-3 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-all"
                placeholder="Nama Penerima"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 ml-1">No. WhatsApp</label>
              <input 
                required 
                type="tel"
                className="w-full bg-white border border-slate-200 p-3 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-all"
                placeholder="0812xxxx"
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
              />
            </div>
          </div>

          {/* KOTA & KELURAHAN */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 ml-1">Kota/Kecamatan</label>
              <input 
                required 
                value={formData.city}
                className="w-full bg-white border border-slate-200 p-3 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-all"
                placeholder="Kota"
                onChange={(e) => setFormData({...formData, city: e.target.value})}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 ml-1">Kelurahan</label>
              <input 
                required 
                value={formData.kelurahan}
                className="w-full bg-white border border-slate-200 p-3 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-all"
                placeholder="Kelurahan"
                onChange={(e) => setFormData({...formData, kelurahan: e.target.value})}
              />
            </div>
          </div>

          {/* RT & RW */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 ml-1">RT</label>
              <input 
                className="w-full bg-white border border-slate-200 p-3 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-all"
                placeholder="Contoh: 005"
                value={formData.rt}
                onChange={(e) => setFormData({...formData, rt: e.target.value})}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 ml-1">RW</label>
              <input 
                className="w-full bg-white border border-slate-200 p-3 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-all"
                placeholder="Contoh: 010"
                value={formData.rw}
                onChange={(e) => setFormData({...formData, rw: e.target.value})}
              />
            </div>
          </div>

          {/* INPUT ALAMAT DETAIL */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 ml-1">Alamat Lengkap (Nama Jalan, No. Rumah)</label>
            <textarea 
              required 
              value={formData.detail} 
              rows={3}
              className="w-full bg-white border border-slate-200 p-3 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 transition-all resize-none"
              placeholder="Detail alamat lainnya..."
              onChange={(e) => setFormData({...formData, detail: e.target.value})}
            />
          </div>

          {/* TOMBOL SIMPAN */}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full py-4 bg-indigo-600 text-white rounded-xl text-sm font-bold uppercase tracking-wider shadow-md shadow-indigo-200 active:scale-[0.98] transition-all mt-4 disabled:bg-indigo-400"
          >
            {loading ? "Menyimpan Data..." : "Simpan Alamat"}
          </button>
        </form>
      </div>
    </div>
  )
}