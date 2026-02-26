"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import * as Icons from "lucide-react";
import { useRouter } from "next/navigation";

export default function AdminProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Keamanan tambahan: Kalau bukan admin, tendang ke profil biasa
      const { data: adminData } = await supabase
        .from("admins")
        .select("email")
        .eq("email", user?.email)
        .single();

      if (!adminData) {
        router.push("/profile");
        return;
      }

      setUser(user);
      setLoading(false);
    };
    getProfile();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  // Menu khusus Admin
  const adminMenus = [
    { icon: "LayoutDashboard", label: "Dashboard Utama", color: "text-orange-500", bg: "bg-orange-50", link: "/admin" },
    { icon: "PackagePlus", label: "Tambah Produk", color: "text-indigo-500", bg: "bg-indigo-50", link: "/admin/add-product" },
    { icon: "FolderPlus", label: "Kelola Kategori", color: "text-emerald-500", bg: "bg-emerald-50", link: "/admin/add-category" },
    { icon: "Zap", label: "Setting Flash Sale", color: "text-amber-500", bg: "bg-amber-50", link: "/admin/flash-sale" },
    { icon: "Users", label: "Daftar Pelanggan", color: "text-blue-500", bg: "bg-blue-50", link: "#" },
  ];

  if (loading) return <div className="p-20 text-center text-[10px] font-black uppercase opacity-20">Membuka Mako...</div>;

  return (
    <div className="min-h-screen bg-[#0F172A] pb-32 font-sans max-w-md mx-auto">
      {/* HEADER ADMIN (Dark Theme) */}
      <div className="bg-[#1E293B] px-8 pt-16 pb-12 rounded-b-[3.5rem] shadow-xl relative overflow-hidden border-b border-white/5">
        <div className="absolute top-0 right-0 p-4">
           <div className="bg-orange-500/10 text-orange-500 px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border border-orange-500/20">
             Otoritas Admin
           </div>
        </div>
        
        <div className="relative flex flex-col items-center">
          <div className="w-24 h-24 rounded-[2.5rem] bg-orange-500 p-1 shadow-2xl shadow-orange-500/20 relative group">
            <div className="w-full h-full rounded-[2.2rem] bg-gray-800 overflow-hidden flex items-center justify-center border-4 border-[#1E293B]">
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} className="w-full h-full object-cover" alt="Admin" />
              ) : (
                <Icons.ShieldCheck size={40} className="text-orange-500" />
              )}
            </div>
          </div>

          <div className="mt-4 text-center">
            <h2 className="text-xl font-black text-white tracking-tight italic uppercase">
              {user?.user_metadata?.full_name || "Admin Warden"}
            </h2>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">
              {user?.email}
            </p>
          </div>
        </div>
      </div>

      {/* MENU LIST ADMIN */}
      <div className="mt-8 px-6 space-y-3">
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-2 mb-4">Panel Kendali Toko</p>
        
        {adminMenus.map((item, idx) => {
          const Icon = (Icons as any)[item.icon];
          return (
            <button 
              key={idx} 
              onClick={() => router.push(item.link)}
              className="w-full bg-[#1E293B] p-4 rounded-2xl flex items-center justify-between group active:scale-[0.98] transition-all border border-white/5 shadow-lg"
            >
              <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-xl ${item.bg} ${item.color}`}>
                  <Icon size={18} />
                </div>
                <span className="text-xs font-bold text-gray-200">{item.label}</span>
              </div>
              <Icons.ChevronRight size={16} className="text-gray-600 group-hover:text-orange-400" />
            </button>
          );
        })}

        {/* LOGOUT KHUSUS ADMIN */}
        <button 
          onClick={handleLogout}
          className="w-full mt-10 bg-red-500/10 p-5 rounded-3xl flex items-center justify-center gap-3 text-red-500 border border-red-500/20 active:scale-95 transition-all"
        >
          <Icons.LogOut size={18} />
          <span className="text-[10px] font-black uppercase tracking-[0.2em]">Logout Sesi Admin</span>
        </button>
      </div>

      <div className="mt-10 text-center pb-10">
        <p className="text-[8px] font-bold text-gray-600 uppercase tracking-[0.3em]">Mako Control Center v1.0.4</p>
      </div>
    </div>
  );
}