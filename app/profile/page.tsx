"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link" // Perbaikan: Import Link yang benar

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      setLoading(false)
    }
    getProfile()
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  const menuItems = [
    { href: "/orders", icon: "ShoppingBag", label: "Pesanan Saya", color: "text-blue-600", bg: "bg-blue-50" },
    { href: "/wishlist", icon: "Heart", label: "Wishlist", color: "text-red-500", bg: "bg-red-50" },
    { href: "/address", icon: "MapPin", label: "Alamat Saya", color: "text-orange-500", bg: "bg-orange-50" },
    { href: "/settings", icon: "Settings", label: "Pengaturan Akun", color: "text-slate-600", bg: "bg-slate-100" },
    { href: "/chat", icon: "ShieldCheck", label: "Pusat Bantuan", color: "text-green-600", bg: "bg-green-50" },
  ]

  return (
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto font-sans pb-10">

      {/* HEADER FIXED */}
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-center bg-white border-b border-slate-100">
        <div className="w-full max-w-md h-14 flex items-center justify-between px-4">
          <h1 className="text-lg font-bold text-slate-900">Akun Saya</h1>
          <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors">
            <Icons.Bell size={20} />
          </button>
        </div>
      </header>

      {/* CONTENT AREA */}
      <div className="pt-20 px-4">

        {/* PROFIL CARD */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col items-center mb-6">
          <div className="relative mb-4">
            <div className="w-24 h-24 rounded-full bg-slate-100 border-4 border-white shadow-md overflow-hidden flex items-center justify-center">
              {user?.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  className="w-full h-full object-cover"
                  alt="Profile"
                />
              ) : (
                <Icons.User size={40} className="text-slate-300" />
              )}
            </div>
            <button className="absolute bottom-0 right-0 bg-white p-1.5 rounded-full border border-slate-200 shadow-sm active:scale-95 transition-transform">
              <Icons.Camera size={14} className="text-slate-600" />
            </button>
          </div>

          <h2 className="text-lg font-bold text-slate-800">
            {user?.user_metadata?.full_name || "Sobat Warden"}
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-1">
            {user?.email || "Belum Login"}
          </p>
        </div>

        {/* STATS SECTION */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Poin", val: "1.2k" },
            { label: "Voucher", val: "5" },
            { label: "Saldo", val: "Rp 0" }
          ].map((stat, i) => (
            <div key={i} className="bg-white p-3 rounded-xl border border-slate-100 text-center shadow-sm">
              <p className="text-sm font-bold text-slate-800">{stat.val}</p>
              <p className="text-[10px] font-medium text-slate-400 uppercase mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* MENU LIST */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden divide-y divide-slate-50">
          {menuItems.map((item, idx) => {
            const Icon = (Icons as any)[item.icon] || Icons.Package
            return (
              <Link
                href={item.href}
                key={idx}
                className="w-full p-4 flex items-center justify-between active:bg-slate-50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${item.bg}`}>
                    <Icon size={18} className={item.color} />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">{item.label}</span>
                </div>
                <Icons.ChevronRight size={18} className="text-slate-300 group-hover:text-slate-400 transition-colors" />
              </Link>
            )
          })}
        </div>

        {/* LOGOUT BUTTON */}
        <button
          onClick={handleLogout}
          className="w-full mt-6 bg-white p-4 rounded-2xl flex items-center justify-center gap-2 text-red-500 active:bg-red-50 transition-all border border-slate-200 shadow-sm font-semibold"
        >
          <Icons.LogOut size={18} />
          <span className="text-sm">Keluar Akun</span>
        </button>

        {/* FOOTER INFO */}
        <div className="mt-8 text-center">
          <p className="text-[10px] text-slate-300 font-medium">Warden App v1.0.4</p>
        </div>
      </div>
    </div>
  )
}