"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Skeleton from "@/app/components/Skeleton"

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [hasShop, setHasShop] = useState(false)
  const [isDriver, setIsDriver] = useState(false)
  const [balance, setBalance] = useState(0)
  const [cartCount, setCartCount] = useState(0)
  const [chatCount, setChatCount] = useState(0)
  const [points, setPoints] = useState(0)

  useEffect(() => {
    const getProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        const { data: shop } = await supabase
          .from("shops")
          .select("id")
          .eq("owner_id", user.id)
          .maybeSingle()
        if (shop) setHasShop(true)

        const { data: userRecord } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .maybeSingle()
        if (userRecord?.role === "driver" || userRecord?.role === "admin") setIsDriver(true)

        const { data: wallet } = await supabase
          .from("wallets")
          .select("balance, points_balance")
          .eq("user_id", user.id)
          .maybeSingle()
        if (wallet) {
          setBalance(wallet.balance || 0)
          setPoints(wallet.points_balance || 0)
        }
      }

      setLoading(false)
    }
    const fetchCartCount = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return

      const { count } = await supabase
        .from("cart")
        .select("*", { count: "exact", head: true })
        .eq("user_id", authUser.id)

      setCartCount(count || 0)

      const channel = supabase
        .channel('profile_cart_sync')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'cart',
          filter: `user_id=eq.${authUser.id}`
        }, () => {
          fetchCartCount()
        })
        .subscribe()

      return channel
    }

    const fetchChatCount = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) return

      const { data: conversations } = await supabase
        .from("shop_conversations")
        .select("unread_buyer, unread_shop, shops!inner(owner_id)")
        .or(`buyer_id.eq.${authUser.id},shops.owner_id.eq.${authUser.id}`)

      let totalUnread = 0
      conversations?.forEach((c: any) => {
        const shop = Array.isArray(c.shops) ? c.shops[0] : c.shops
        if (shop?.owner_id === authUser.id) {
          totalUnread += (c.unread_shop || 0)
        } else {
          totalUnread += (c.unread_buyer || 0)
        }
      })

      setChatCount(totalUnread)

      const chatChannel = supabase
        .channel('profile_chat_sync')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'shop_conversations'
        }, () => {
          fetchChatCount()
        })
        .subscribe()

      return chatChannel
    }

    getProfile()
    let cartChannel: any
    let chatChannel: any

    fetchCartCount().then(ch => cartChannel = ch)
    fetchChatCount().then(ch => chatChannel = ch)

    return () => {
      if (cartChannel) supabase.removeChannel(cartChannel)
      if (chatChannel) supabase.removeChannel(chatChannel)
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  const orderStatuses = [
    { icon: "Wallet", label: "Belum Bayar", href: "/orders?status=unpaid&tab=pending", badge: null },
    { icon: "Package", label: "Dikemas", href: "/orders?status=packing&tab=dikemas", badge: null },
    { icon: "Truck", label: "Dikirim", href: "/orders?status=shipping&tab=dikirim", badge: null },
    { icon: "Star", label: "Beri Penilaian", href: "/reviews", badge: null },
  ]

  const walletItems = [
    { icon: "Wallet", label: "Saldo Saya", sub: `Rp ${balance.toLocaleString("id-ID")}`, href: "/wallet" },
    { icon: "Coins", label: "Koin Saya", sub: `${points.toLocaleString()} Poin`, href: "/wallet" },
    { icon: "Ticket", label: "Voucher", sub: "5+ Voucher", href: "/voucher" },
  ]

  const activityMenu = [
    { href: hasShop ? "/shop/dashboard" : "/shop/create", icon: "Store", label: hasShop ? "Warung Saya" : "Buka Warung", badge: !hasShop ? "BARU" : null },
    { href: "/wishlist", icon: "Heart", label: "Favorit Saya", badge: null },
    { href: "/orders", icon: "RotateCcw", label: "Beli Lagi", badge: null },
    { href: "/address", icon: "MapPin", label: "Alamat Saya", badge: null },
    { href: "/chat", icon: "ShieldCheck", label: "Pusat Bantuan", badge: null },
    { href: "/settings", icon: "Settings", label: "Pengaturan", badge: null },
  ]

  return (
    <div className="min-h-screen bg-slate-100 max-w-md mx-auto font-sans pb-24" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>

      {/* === HERO BANNER === */}
      <div className="relative" style={{ background: "linear-gradient(135deg, #4f46e5 0%, #6d28d9 60%, #7c3aed 100%)" }}>
        {/* Decorative pattern */}
        <div className="absolute inset-0 overflow-hidden opacity-10">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full border-2 border-white"
              style={{
                width: `${60 + i * 20}px`,
                height: `${60 + i * 20}px`,
                top: `${(i % 4) * 20 - 30}px`,
                left: `${(i % 5) * 18}%`,
                opacity: 0.4,
              }}
            />
          ))}
        </div>

        {/* Top action row */}
        <div className="relative flex items-center justify-between px-4 pt-12 pb-3">
          <button className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 rounded-full border border-white/30 active:scale-95 transition-transform">
            <Icons.Store size={13} />
            Mulai Jual
            <Icons.ChevronRight size={13} />
          </button>
          <div className="flex items-center gap-3">
            <Link href="/settings" className="relative text-white/90 active:scale-95 transition-transform">
              <Icons.Settings size={22} />
            </Link>
            <Link href="/cart" className="relative text-white/90 active:scale-95 transition-transform">
              <Icons.ShoppingCart size={22} />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-white text-indigo-700 text-[9px] font-black min-w-[16px] h-4 rounded-full flex items-center justify-center px-1 shadow">
                  {cartCount}
                </span>
              )}
            </Link>
            <Link href="/chat/shop" className="relative text-white/90 active:scale-95 transition-transform">
              <Icons.MessageCircle size={22} />
              {chatCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-white text-indigo-700 text-[9px] font-black min-w-[16px] h-4 rounded-full flex items-center justify-center px-1 shadow">
                  {chatCount}
                </span>
              )}
            </Link>
          </div>
        </div>

        {/* Profile Info */}
        <div className="relative flex items-center gap-3 px-4 pb-6">
          {loading ? (
            <div className="w-16 h-16 rounded-full bg-white/30 animate-pulse" />
          ) : (
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-2 border-white/80 shadow-lg overflow-hidden bg-indigo-200 flex items-center justify-center">
                {user?.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} className="w-full h-full object-cover" alt="Profile" />
                ) : (
                  <Icons.User size={28} className="text-indigo-600" />
                )}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-white rounded-full flex items-center justify-center shadow">
                <Icons.Camera size={10} className="text-indigo-600" />
              </div>
            </div>
          )}

          <div className="flex-1">
            {loading ? (
              <>
                <div className="h-5 w-28 bg-white/30 rounded-full animate-pulse mb-2" />
                <div className="h-3 w-20 bg-white/20 rounded-full animate-pulse" />
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h1 className="text-white font-bold text-base leading-tight">
                    {user?.user_metadata?.full_name || "Sobat Warung Kita"}
                  </h1>
                  <span className="bg-yellow-400 text-yellow-900 text-[9px] font-black px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm">
                    <Icons.Crown size={8} />
                    Gold
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-white/80 text-[11px] font-medium">
                    <span className="text-white font-bold">12</span> Pengikut
                  </span>
                  <span className="text-white/40">·</span>
                  <span className="text-white/80 text-[11px] font-medium">
                    <span className="text-white font-bold">8</span> Mengikuti
                  </span>
                </div>
              </>
            )}
          </div>

          <Link href="/settings" className="border border-white/50 text-white text-[11px] font-semibold px-3 py-1.5 rounded-full active:scale-95 transition-transform backdrop-blur-sm bg-white/10">
            Edit
          </Link>
        </div>

        {/* Bottom wave */}
        <div className="h-4 bg-slate-100 rounded-t-3xl" />
      </div>

      {/* === PESANAN SAYA === */}
      <div className="mx-3 -mt-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-3">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
          <span className="text-sm font-bold text-slate-800">Pesanan Saya</span>
          <Link href="/orders" className="flex items-center gap-1 text-xs text-indigo-600 font-semibold">
            Lihat Riwayat
            <Icons.ChevronRight size={13} />
          </Link>
        </div>
        <div className="grid grid-cols-4 py-4">
          {orderStatuses.map((s, i) => {
            const Icon = (Icons as any)[s.icon] || Icons.Package
            return (
              <Link key={i} href={s.href} className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
                <div className="relative">
                  <div className="w-11 h-11 rounded-full bg-indigo-50 flex items-center justify-center">
                    <Icon size={20} className="text-indigo-600" />
                  </div>
                  {s.badge && (
                    <span className="absolute -top-1 -right-1 bg-indigo-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                      {s.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 font-medium text-center leading-tight px-1">{s.label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* === LAYANAN KHUSUS === */}
      <div className="mx-3 mb-3">
        <Link href="/wallet" className="bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between px-4 py-3 active:bg-indigo-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
              <Icons.Zap size={16} className="text-indigo-600" />
            </div>
            <span className="text-sm font-semibold text-slate-700">Pulsa, Tagihan & Tiket</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-indigo-600">Diskon 50RB</span>
            <Icons.ChevronRight size={14} className="text-indigo-400" />
          </div>
        </Link>
      </div>

      {/* === DOMPET SAYA === */}
      <div className="mx-3 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-3">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
          <span className="text-sm font-bold text-slate-800">Dompet Saya</span>
        </div>
        <div className="grid grid-cols-3 py-4 px-2">
          {walletItems.map((item, i) => {
            const Icon = (Icons as any)[item.icon] || Icons.Package
            return (
              <Link key={i} href={item.href} className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center">
                    <Icon size={22} className="text-indigo-600" />
                  </div>
                  {i === 0 && (
                    <span className="absolute -top-1 -right-1 bg-indigo-500 text-white text-[8px] font-black px-1 py-0.5 rounded-full shadow">
                      •
                    </span>
                  )}
                </div>
                <p className="text-xs font-bold text-slate-700 text-center">{item.sub}</p>
                <p className="text-[10px] text-slate-400 text-center">{item.label}</p>
              </Link>
            )
          })}
        </div>
      </div>

      {/* === KEUANGAN === */}
      <div className="mx-3 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-3">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
          <span className="text-sm font-bold text-slate-800">Keuangan</span>
          <Link href="/wallet" className="flex items-center gap-1 text-xs text-indigo-600 font-semibold">
            Lihat Semua
            <Icons.ChevronRight size={13} />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 p-3">
          {[
            { icon: "CreditCard", label: "PayLater", sub: "Cicilan ringan", href: "#" },
            { icon: "PiggyBank", label: "Pinjaman", sub: "Bunga rendah", href: "#" },
            { icon: "Landmark", label: "SeaBank", sub: "Transfer gratis", href: "#", badge: "Gratis Transfer" },
            { icon: "Shield", label: "Asuransi", sub: "Proteksi aman", href: "#" },
          ].map((item, i) => {
            const Icon = (Icons as any)[item.icon] || Icons.Package
            return (
              <Link key={i} href={item.href} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100 active:bg-indigo-50 active:border-indigo-100 transition-colors group">
                <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Icon size={17} className="text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-700 group-hover:text-indigo-700 truncate">{item.label}</p>
                  {item.badge ? (
                    <p className="text-[10px] text-indigo-500 font-semibold truncate">{item.badge}</p>
                  ) : (
                    <p className="text-[10px] text-slate-400 truncate">{item.sub}</p>
                  )}
                </div>
                <Icons.ChevronRight size={13} className="text-slate-300 ml-auto flex-shrink-0" />
              </Link>
            )
          })}
        </div>
      </div>

      {/* === AKTIVITAS SAYA === */}
      <div className="mx-3 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-3">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50">
          <span className="text-sm font-bold text-slate-800">Aktivitas Saya</span>
        </div>
        <div className="grid grid-cols-2 gap-3 p-3">
          {activityMenu.map((item, i) => {
            const Icon = (Icons as any)[item.icon] || Icons.Package
            return (
              <Link key={i} href={item.href} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100 active:bg-indigo-50 active:border-indigo-100 transition-colors group">
                <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Icon size={17} className="text-indigo-600" />
                </div>
                <span className="text-xs font-semibold text-slate-700 group-hover:text-indigo-700 flex-1 truncate">
                  {item.label}
                </span>
                {item.badge && (
                  <span className="bg-indigo-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded shadow-sm">
                    {item.badge}
                  </span>
                )}
                <Icons.ChevronRight size={13} className="text-slate-300 flex-shrink-0" />
              </Link>
            )
          })}
        </div>
      </div>

      {/* === DRIVER MODE === */}
      {isDriver && (
        <div className="mx-3 mb-3">
          <Link
            href="/driver"
            className="w-full bg-emerald-500 p-4 rounded-2xl flex items-center justify-center gap-2 text-white active:bg-emerald-600 transition-all shadow-lg shadow-emerald-200 font-bold"
          >
            <Icons.Bike size={18} />
            <span className="text-sm">Beralih ke Mode Driver</span>
          </Link>
        </div>
      )}

      {/* === LOGOUT === */}
      <div className="mx-3 mb-3">
        <button
          onClick={handleLogout}
          className="w-full bg-white p-4 rounded-2xl flex items-center justify-center gap-2 text-indigo-600 active:bg-indigo-50 transition-all border border-indigo-100 shadow-sm font-semibold"
        >
          <Icons.LogOut size={18} />
          <span className="text-sm">Keluar Akun</span>
        </button>
      </div>

      {/* === FOOTER === */}
      <div className="text-center py-4">
        <p className="text-[10px] text-slate-300 font-medium">Warung Kita App v1.0.4</p>
      </div>
    </div>
  )
}