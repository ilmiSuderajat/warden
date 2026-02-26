"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import * as Icons from "lucide-react";
import { useRouter } from "next/navigation";

export default function AddressListPage() {
  const router = useRouter();
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false });

    if (!error) setAddresses(data);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Yakin mau hapus alamat ini, Lur?")) {
      const { error } = await supabase.from("addresses").delete().eq("id", id);
      if (!error) fetchAddresses(); // Refresh data
    }
  };

  const handleSetDefault = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Reset semua jadi false dulu
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", user?.id);
    
    // Set yang dipilih jadi true
    const { error } = await supabase.from("addresses").update({ is_default: true }).eq("id", id);
    
    if (!error) fetchAddresses();
  };

  return (
    <div className="min-h-screen bg-[#F8F9FD] pb-32 font-sans max-w-md mx-auto">
      {/* HEADER */}
      <div className="bg-white px-8 pt-16 pb-8 rounded-b-[3.5rem] shadow-sm sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="p-2 bg-gray-50 rounded-xl active:scale-90 transition-all">
              <Icons.ChevronLeft size={20} />
            </button>
            <h1 className="text-xl font-black text-gray-900 tracking-tight italic">Alamat Saya</h1>
          </div>
          <div className="bg-indigo-50 p-2.5 rounded-2xl text-indigo-600">
            <Icons.MapPin size={20} />
          </div>
        </div>
      </div>

      {/* LIST ALAMAT */}
      <div className="p-6 space-y-4">
        {loading ? (
          <div className="text-center py-20 opacity-20 font-black uppercase text-[10px] tracking-widest">
            Menarik Data Lokasi...
          </div>
        ) : addresses.length > 0 ? (
          addresses.map((addr) => (
            <div 
              key={addr.id} 
              className={`bg-white p-6 rounded-[2.5rem] shadow-xl shadow-gray-200/50 border-2 transition-all ${
                addr.is_default ? "border-indigo-600" : "border-transparent"
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-black text-gray-800 uppercase tracking-tighter">{addr.name}</h3>
                  {addr.is_default && (
                    <span className="bg-indigo-600 text-white text-[7px] font-black px-2 py-0.5 rounded-full uppercase">Utama</span>
                  )}
                </div>
                <Icons.Map size={14} className={addr.is_default ? "text-indigo-600" : "text-gray-200"} />
              </div>
              
              <p className="text-[10px] font-bold text-gray-400 mb-2 italic">{addr.phone}</p>
              <p className="text-[11px] font-medium text-gray-600 leading-relaxed line-clamp-2">
                {addr.detail}, {addr.city}
              </p>

              <div className="mt-5 flex gap-2 border-t border-gray-50 pt-4">
                {!addr.is_default && (
                  <button 
                    onClick={() => handleSetDefault(addr.id)}
                    className="flex-1 py-3 bg-gray-50 text-gray-400 rounded-xl text-[8px] font-black uppercase tracking-widest active:scale-95 transition-all"
                  >
                    Set Utama
                  </button>
                )}
                <button 
                  onClick={() => handleDelete(addr.id)}
                  className="px-4 py-3 bg-red-50 text-red-500 rounded-xl active:scale-95 transition-all"
                >
                  <Icons.Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 opacity-30">
            <Icons.MapPinned size={48} className="mx-auto mb-4" />
            <p className="text-[10px] font-black uppercase tracking-[0.2em]">Belum Ada Alamat, Lur!</p>
          </div>
        )}
      </div>

      {/* TOMBOL TAMBAH (STICKY BOTTOM) */}
      <div className="fixed bottom-24 left-0 right-0 px-6 max-w-md mx-auto">
        <button 
          onClick={() => router.push("/address/add")}
          className="w-full bg-gray-900 text-white py-5 rounded-[2rem] shadow-2xl shadow-gray-400 flex items-center justify-center gap-3 active:scale-95 transition-all group"
        >
          <div className="bg-indigo-500 p-1.5 rounded-lg group-hover:rotate-90 transition-transform">
            <Icons.Plus size={14} className="text-white" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Tambah Alamat Baru</span>
        </button>
      </div>
    </div>
  );
}