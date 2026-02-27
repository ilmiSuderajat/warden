"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import { useRouter } from "next/navigation"

export default function AddressListPage() {
  const router = useRouter()
  const [addresses, setAddresses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAddresses()
  }, [])

  const fetchAddresses = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push("/login")
        return
      }

      const { data, error } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })

      if (!error && data) setAddresses(data)
    } catch (error) {
      console.error("Error fetching addresses:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("Yakin mau hapus alamat ini?")) {
      try {
        const { error } = await supabase.from("addresses").delete().eq("id", id)
        if (!error) {
          // Refresh data lokal dan global (untuk cache Next.js)
          fetchAddresses()
          router.refresh()
        }
      } catch (error) {
        console.error("Error deleting:", error)
      }
    }
  }

  const handleSetDefault = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      // 1. Reset semua jadi false
      await supabase
        .from("addresses")
        .update({ is_default: false })
        .eq("user_id", user.id)
      
      // 2. Set yang dipilih jadi true
      const { error } = await supabase
        .from("addresses")
        .update({ is_default: true })
        .eq("id", id)
      
      if (!error) {
        fetchAddresses()
        router.refresh()
      }
    } catch (error) {
      console.error("Error setting default:", error)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto font-sans pb-28">
      
      {/* --- HEADER FIXED --- */}
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-center bg-white border-b border-slate-100">
        <div className="w-full max-w-md h-14 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-1 text-slate-700 active:scale-95 transition-transform">
              <Icons.ChevronLeft size={24} strokeWidth={2.5} />
            </button>
            <h1 className="text-lg font-bold text-slate-900">Daftar Alamat</h1>
          </div>
          <Icons.MapPin size={20} className="text-slate-400" />
        </div>
      </header>

      {/* --- CONTENT AREA --- */}
      <main className="pt-16 px-4">
        
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Icons.Loader2 className="animate-spin mb-2" size={24} />
            <p className="text-xs font-medium">Memuat alamat...</p>
          </div>
        ) : addresses.length > 0 ? (
          <div className="space-y-3 mt-4">
            {addresses.map((addr) => (
              <div 
                key={addr.id} 
                className={`bg-white p-4 rounded-xl border transition-all ${
                  addr.is_default 
                    ? "border-indigo-500 shadow-sm bg-indigo-50/30" 
                    : "border-slate-200"
                }`}
              >
                {/* Header Kartu */}
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-800">{addr.name}</h3>
                    {addr.is_default && (
                      <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Utama
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Info Detail */}
                <p className="text-xs text-slate-500 font-medium mb-1">{addr.phone}</p>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {addr.detail}, {addr.city}
                </p>

                {/* Aksi */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex gap-2">
                  {!addr.is_default && (
                    <button 
                      onClick={() => handleSetDefault(addr.id)}
                      className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-200 active:scale-95 transition-all"
                    >
                      Jadikan Utama
                    </button>
                  )}
                  <button 
                    onClick={() => handleDelete(addr.id)}
                    className="p-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 active:scale-95 transition-all"
                  >
                    <Icons.Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Empty State
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Icons.MapPinned size={32} className="text-slate-300" />
            </div>
            <h2 className="text-base font-bold text-slate-700 mb-1">Belum Ada Alamat</h2>
            <p className="text-xs text-slate-400 mb-6">Yuk tambahkan alamat pengirimanmu sekarang.</p>
          </div>
        )}
      </main>

      {/* --- FLOATING BUTTON --- */}
      <div className="fixed bottom-6 left-0 right-0 px-4 max-w-md mx-auto z-40">
        <button 
          onClick={() => router.push("/address/add")}
          className="w-full bg-indigo-600 text-white py-3.5 rounded-xl shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 active:scale-[0.98] transition-all font-semibold"
        >
          <Icons.Plus size={18} strokeWidth={2.5} />
          <span className="text-sm">Tambah Alamat Baru</span>
        </button>
      </div>
    </div>
  )
}