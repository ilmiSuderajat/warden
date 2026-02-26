"use client"

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import * as Icons from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/login");
        return;
      }

      // Keamanan: Cek apakah user adalah admin
      const { data: adminData } = await supabase
        .from("admins")
        .select("email")
        .eq("email", user.email)
        .single();

      if (!adminData) {
        router.push("/profile"); // Redirect ke profil user biasa jika bukan admin
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

  // Menu Admin dengan ikon dan warna spesifik
  const adminMenus = [
    { icon: "LayoutDashboard", label: "Dashboard Utama", color: "text-slate-600", bg: "bg-slate-100", link: "/admin" },
    { icon: "PackagePlus", label: "Tambah Produk Baru", color: "text-indigo-600", bg: "bg-indigo-50", link: "/admin/add-product/detail" },
    { icon: "FolderPlus", label: "Kelola Kategori", color: "text-emerald-600", bg: "bg-emerald-50", link: "/admin/add-category/detail" },
    { icon: "Zap", label: "Pengaturan Flash Sale", color: "text-amber-600", bg: "bg-amber-50", link: "/admin/flash-sale" },
    { icon: "Users", label: "Daftar Pelanggan", color: "text-blue-600", bg: "bg-blue-50", link: "#" },
  ];

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
      <Icons.Loader2 className="animate-spin text-slate-400" size={28} />
      <p className="text-xs font-medium text-slate-400">Memverifikasi akses admin...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/80 font-sans max-w-md mx-auto pb-24">
      
      {/* HEADER */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="flex items-center justify-between px-5 pt-12 pb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
              <Icons.ArrowLeft size={20} strokeWidth={2.5} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Profil Admin</h1>
              <p className="text-[10px] font-medium text-slate-400">Panel Kontrol</p>
            </div>
          </div>
        </div>
      </div>

      {/* PROFIL CARD */}
      <div className="p-5">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm text-center relative overflow-hidden">
          {/* Decorative Background Pattern (Optional) */}
          <div className="absolute inset-x-0 top-0 h-20 bg-indigo-600 rounded-t-2xl"></div>
          
          <div className="relative pt-2">
            <div className="w-24 h-24 rounded-full bg-slate-200 border-4 border-white mx-auto shadow-lg overflow-hidden flex items-center justify-center">
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} className="w-full h-full object-cover" alt="Admin" />
              ) : (
                <Icons.User size={40} className="text-slate-400" />
              )}
            </div>
            
            <div className="mt-4">
              <h2 className="text-lg font-bold text-slate-900">
                {user?.user_metadata?.full_name || "Admin Warden"}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {user?.email}
              </p>
            </div>

            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wide">
              <Icons.ShieldCheck size={12} />
              <span>Administrator</span>
            </div>
          </div>
        </div>
      </div>

      {/* MENU LIST ADMIN */}
      <div className="px-5 space-y-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide ml-1 mb-2">Akses Cepat</p>
        
        {adminMenus.map((item, idx) => {
          const Icon = (Icons as any)[item.icon];
          return (
            <Link
              key={idx} 
              href={item.link}
              className="w-full bg-white p-4 rounded-xl flex items-center justify-between group hover:bg-slate-50 transition-colors border border-slate-100 shadow-sm"
            >
              <div className="flex items-center gap-3.5">
                <div className={`p-2 rounded-lg ${item.bg} ${item.color}`}>
                  <Icon size={18} strokeWidth={2.5} />
                </div>
                <span className="text-sm font-semibold text-slate-700">{item.label}</span>
              </div>
              <Icons.ChevronRight size={18} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
            </Link>
          );
        })}
      </div>

      {/* LOGOUT BUTTON */}
      <div className="px-5 mt-8">
        <button 
          onClick={handleLogout}
          className="w-full bg-white border border-red-100 text-red-600 p-4 rounded-xl flex items-center justify-center gap-2 hover:bg-red-50 active:scale-[0.98] transition-all font-semibold text-sm"
        >
          <Icons.LogOut size={18} />
          <span>Keluar dari Akun Admin</span>
        </button>
      </div>

      {/* FOOTER VERSION */}
      <div className="mt-12 text-center">
        <p className="text-[10px] font-medium text-slate-300 uppercase tracking-widest">
          Admin Panel v1.0.4
        </p>
      </div>
    </div>
  );
}