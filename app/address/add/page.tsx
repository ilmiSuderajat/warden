"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import * as Icons from "lucide-react";
import { useRouter } from "next/navigation";

export default function AddAddressPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    city: "",
    detail: "",
    is_default: false
  });

  // FUNGSI DETEKSI LOKASI
  const handleDetectLocation = () => {
    
    setDetecting(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          // Kita pakai OpenStreetMap (Free) atau Google Maps API kalau kamu punya API Key
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          
          if (data.address) {
            const fullAddress = data.display_name;
            const city = data.address.city || data.address.town || data.address.village || "";
            
            setFormData({
              ...formData,
              city: city,
              detail: fullAddress
            });
          }
        } catch (error) {
          alert("Gagal ambil detail alamat, Lur. Isi manual dulu ya!");
        } finally {
          setDetecting(false);
        }
      }, () => {
        alert("Akses lokasi ditolak, Lur!");
        setDetecting(false);
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from("addresses").insert([{
      ...formData,
      user_id: user?.id
    }]);

    if (!error) router.push("/address");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-white pb-20 font-sans max-w-md mx-auto">
      <div className="p-8">
        <div className="flex items-center gap-4 mb-10">
          <button onClick={() => router.back()} className="p-2 bg-gray-50 rounded-xl"><Icons.ChevronLeft size={20}/></button>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Tambah Alamat</h1>
        </div>

        {/* TOMBOL DETEKSI OTOMATIS */}
        <button 
          onClick={handleDetectLocation}
          disabled={detecting}
          className="w-full mb-8 p-5 bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-[2rem] flex items-center justify-center gap-3 active:scale-95 transition-all group"
        >
          {detecting ? (
            <Icons.Loader2 size={18} className="animate-spin text-indigo-600" />
          ) : (
            <Icons.MapPin size={18} className="text-indigo-600 group-hover:animate-bounce" />
          )}
          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
            {detecting ? "Mencari Koordinat..." : "Deteksi Lokasi Saya"}
          </span>
        </button>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-4">Nama Penerima</label>
            <input 
              required
              className="w-full bg-gray-50 p-5 rounded-[1.5rem] text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              placeholder="Contoh: Pak RT Warden"
              onChange={(e) => setFormData({...formData, name: e.target.value})}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-4">No. WhatsApp</label>
            <input 
              required type="tel"
              className="w-full bg-gray-50 p-5 rounded-[1.5rem] text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              placeholder="0812xxxx"
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-4">Kota / Kecamatan</label>
            <input 
              required value={formData.city}
              className="w-full bg-gray-50 p-5 rounded-[1.5rem] text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              placeholder="Masukkan Kota"
              onChange={(e) => setFormData({...formData, city: e.target.value})}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-4">Alamat Lengkap</label>
            <textarea 
              required value={formData.detail} rows={3}
              className="w-full bg-gray-50 p-5 rounded-[1.5rem] text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none"
              placeholder="Nama jalan, nomor rumah, atau patokan..."
              onChange={(e) => setFormData({...formData, detail: e.target.value})}
            />
          </div>

          <button 
            type="submit" disabled={loading}
            className="w-full py-5 bg-gray-900 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-gray-200 active:scale-95 transition-all"
          >
            {loading ? "Menyimpan..." : "Simpan Alamat"}
          </button>
        </form>
      </div>
    </div>
  );
}