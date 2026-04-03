"use client"

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Loader2, ArrowLeft, User, ShieldCheck, LogOut, ChevronRight, 
  LayoutDashboard, PackagePlus, FolderPlus, Zap, Users, ImageIcon, Tag,
  Settings, Bell, Shield, Info
} from "lucide-react";
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

      const { data: adminRecord } = await supabase
        .from("admins")
        .select("id")
        .or(`user_id.eq.${user.id},email.eq.${user.email}`)
        .maybeSingle();

      const { data: userRecord } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      const isAdmin = adminRecord || userRecord?.role === "admin";

      if (!isAdmin) {
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

  const adminMenus = [
    { icon: LayoutDashboard, label: "Dashboard", color: "indigo", link: "/admin" },
    { icon: PackagePlus, label: "Produk Baru", color: "orange", link: "/admin/add-product/detail" },
    { icon: FolderPlus, label: "Kategori", color: "emerald", link: "/admin/add-category/detail" },
    { icon: Zap, label: "Flash Sale", color: "rose", link: "/admin/flash-sale" },
    { icon: Users, label: "Database User", color: "blue", link: "/admin/customers" },
    { icon: ImageIcon, label: "Banner Ads", color: "violet", link: "/admin/banners" },
    { icon: Tag, label: "Voucher", color: "sky", link: "/admin/vouchers" },
    { icon: Settings, label: "Settings", color: "slate", link: "/admin" },
  ];

  if (loading) return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
      <Loader2 className="animate-spin text-indigo-600" size={40} strokeWidth={2.5} />
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Authenticating Master...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans max-w-md mx-auto pb-24 selection:bg-indigo-100">

      {/* HEADER PREMIUM */}
      <div className="bg-white sticky top-0 z-40 border-b border-slate-100/60 backdrop-blur-md bg-white/80">
        <div className="px-5 pt-12 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/admin')} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
              <ArrowLeft size={20} strokeWidth={2.5} />
            </button>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">Identity Admin</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic flex items-center gap-1.5">
                 <Shield size={10} className="text-indigo-500" /> Authorized
              </p>
            </div>
          </div>
          <div className="p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer">
             <Bell size={20} strokeWidth={2.5} />
          </div>
        </div>
      </div>

      {/* PROFIL CARD OVERHAUL */}
      <div className="p-4">
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm text-center relative overflow-hidden group">
          {/* Ornaments */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-indigo-100 transition-colors"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-50 rounded-full blur-2xl -ml-12 -mb-12 group-hover:bg-emerald-100 transition-colors"></div>

          <div className="relative z-10 flex flex-col items-center">
            <div className="w-28 h-28 rounded-[2.2rem] bg-slate-50 border-4 border-white shadow-xl shadow-slate-100 overflow-hidden relative group-hover:rotate-2 transition-transform duration-500">
               <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-transparent"></div>
              {user?.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} className="w-full h-full object-cover" alt="Admin" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-200 bg-slate-50">
                    <User size={50} strokeWidth={1.5} />
                </div>
              )}
            </div>

            <div className="mt-6">
              <h2 className="text-xl font-black text-slate-900 tracking-tight leading-tight">
                {user?.user_metadata?.full_name || "Official Admin"}
              </h2>
              <p className="text-xs font-bold text-slate-400 mt-1 lowercase">
                {user?.email}
              </p>
            </div>

            <div className="mt-5 inline-flex items-center gap-2 px-5 py-2 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-100">
              <ShieldCheck size={16} strokeWidth={3} />
              <span className="text-[11px] font-black uppercase tracking-widest">Master Admin</span>
            </div>
          </div>
        </div>
      </div>

      {/* QUICK ACCESS GRID */}
      <div className="px-4 mt-4 space-y-4">
        <div className="flex items-center gap-2 ml-2">
            <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Akses Kontrol</h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
            {adminMenus.map((item, idx) => {
                const Icon = item.icon;
                const colors: Record<string, string> = {
                    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100/50 hover:bg-indigo-100/50",
                    orange: "bg-orange-50 text-orange-600 border-orange-100/50 hover:bg-orange-100/50",
                    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100/50 hover:bg-emerald-100/50",
                    rose: "bg-rose-50 text-rose-600 border-rose-100/50 hover:bg-rose-100/50",
                    blue: "bg-blue-50 text-blue-600 border-blue-100/50 hover:bg-blue-100/50",
                    violet: "bg-violet-50 text-violet-600 border-violet-100/50 hover:bg-violet-100/50",
                    sky: "bg-sky-50 text-sky-600 border-sky-100/50 hover:bg-sky-100/50",
                    slate: "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                }

                return (
                    <Link
                        key={idx}
                        href={item.link}
                        className={`p-4 rounded-3xl border flex flex-col gap-3 transition-all active:scale-[0.98] ${colors[item.color]} group shadow-sm`}
                    >
                        <div className="flex items-center justify-between">
                            <div className="p-2.5 rounded-2xl bg-white/50 backdrop-blur-sm shadow-sm group-hover:scale-110 transition-transform">
                                <Icon size={20} strokeWidth={2.5} />
                            </div>
                            <ChevronRight size={14} className="opacity-30 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-tight">{item.label}</span>
                    </Link>
                );
            })}
        </div>
      </div>

      {/* LOGOUT PREMIUM */}
      <div className="px-4 mt-8 pb-12">
        <button
          onClick={handleLogout}
          className="w-full bg-white border border-red-50 text-red-600 p-5 rounded-[2rem] flex items-center justify-center gap-3 hover:bg-red-50 active:scale-[0.98] transition-all group shadow-sm"
        >
          <div className="p-2 bg-red-100/50 rounded-xl group-hover:rotate-12 transition-transform">
            <LogOut size={20} strokeWidth={2.5} />
          </div>
          <span className="font-black text-xs uppercase tracking-widest">Sign Out Securely</span>
        </button>

        <div className="mt-12 text-center flex flex-col items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full">
                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">System Version 4.0.2 Platinum</span>
            </div>
            <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest max-w-[180px] leading-relaxed">
                Managed Security Integration & Global Warden Network
            </p>
        </div>
      </div>
    </div>
  );
}