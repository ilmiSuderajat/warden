"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import * as Icons from "lucide-react";
import { useRouter } from "next/navigation";
import { Link } from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };
    getProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const menuItems = [
   { href: "/orders", icon: "ShoppingBag", label: "Pesanan Saya", color: "text-blue-500", bg: "bg-blue-50" },
    { icon: "Heart", label: "Wishlist", color: "text-red-500", bg: "bg-red-50" },
    { icon: "MapPin", label: "Alamat Saya", color: "text-orange-500", bg: "bg-orange-50" },
    { icon: "Settings", label: "Pengaturan Akun", color: "text-gray-500", bg: "bg-gray-50" },
    { icon: "ShieldCheck", label: "Pusat Bantuan", color: "text-green-500", bg: "bg-green-50" },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FD] pb-32 font-sans max-w-md mx-auto">
      {/* HEADER & AVATAR SECTION */}
      <div className="bg-white px-8 pt-16 pb-10 rounded-b-[3.5rem] shadow-sm relative overflow-hidden">
        {/* Dekorasi Background */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-50 rounded-full blur-3xl opacity-50"></div>
        
        <div className="relative flex flex-col items-center">
          <div className="w-24 h-24 rounded-[2.5rem] bg-indigo-600 p-1 shadow-2xl shadow-indigo-200 relative group">
            <div className="w-full h-full rounded-[2.2rem] bg-white overflow-hidden flex items-center justify-center border-4 border-white">
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} className="w-full h-full object-cover" alt="Profile" />
              ) : (
                <Icons.User size={40} className="text-indigo-200" />
              )}
            </div>
            <button className="absolute bottom-0 right-0 bg-white p-2 rounded-xl shadow-lg border border-gray-50 active:scale-90 transition-all">
              <Icons.Camera size={14} className="text-indigo-600" />
            </button>
          </div>

          <div className="mt-4 text-center">
            <h2 className="text-xl font-black text-gray-800 tracking-tight">
              {user?.user_metadata?.full_name || "Sobat Warden"}
            </h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
              {user?.email || "Belum Login, Lur"}
            </p>
          </div>
        </div>
      </div>

      {/* STATS SECTION */}
      <div className="grid grid-cols-3 gap-4 px-6 -mt-6 relative z-10">
        {[
          { label: "Poin", val: "1.2k" },
          { label: "Voucher", val: "5" },
          { label: "Saldo", val: "0" }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-3 rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-50 text-center">
            <p className="text-[12px] font-black text-gray-800">{stat.val}</p>
            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* MENU LIST */}
      <div className="mt-8 px-6 space-y-3">
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-2 mb-4">Aktivitas Saya</p>
        
        {menuItems.map((item, idx) => {
          const Icon = (Icons as any)[item.icon];
          return (
            <button key={idx} className="w-full bg-white p-4 rounded-2xl flex items-center justify-between group active:scale-[0.98] transition-all border border-transparent hover:border-indigo-100 shadow-sm">
              <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-xl ${item.bg} ${item.color}`}>
                  <Icon size={18} />
                </div>
                <span className="text-xs font-bold text-gray-700">{item.label}</span>
              </div>
              <Icons.ChevronRight size={16} className="text-gray-300 group-hover:text-indigo-400 transition-colors" />
            </button>
          );
        })}

        {/* LOGOUT */}
        <button 
          onClick={handleLogout}
          className="w-full mt-6 bg-red-50 p-4 rounded-2xl flex items-center justify-center gap-2 text-red-500 active:scale-[0.98] transition-all border border-red-100 shadow-sm shadow-red-100/50"
        >
          <Icons.LogOut size={16} />
          <span className="text-xs font-black uppercase tracking-widest">Keluar Akun</span>
        </button>
      </div>

      {/* FOOTER INFO */}
      <div className="mt-10 text-center pb-10">
        <p className="text-[8px] font-bold text-gray-300 uppercase tracking-[0.3em]">Warden v1.0.4 - 2026</p>
      </div>
    </div>
  );
}