"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { LayoutDashboard, Users, Settings, Package, Truck, CheckCircle2, Search, Clock, ChevronRight, ArrowRight, Tag, CreditCard, ImageIcon, TrendingUp, XCircle, Store, Zap, MessageCircle, MoreVertical, Star, MapPin, Loader2 } from "lucide-react"
import { toast } from "sonner"
import Skeleton from "@/app/components/Skeleton"

export default function MasterAdminPage() {
  const [timeFilter, setTimeFilter] = useState("all")
  const [loading, setLoading] = useState(true)

  // Data States
  const [stats, setStats] = useState({
    totalOmzet: 0,
    shopRevenue: 0,
    appCommission: 0,
    ordersPending: 0,
    ordersPaid: 0,
    ordersShipping: 0,
    ordersDone: 0,
    ordersCanceled: 0,
    totalUsers: 0,
    totalProducts: 0,
  })

  const [topProducts, setTopProducts] = useState<any[]>([])

  const fetchData = async () => {
    setLoading(true)

    // 1. Setup Time Filter for Orders
    let dateQuery = supabase.from('orders').select('id, status, payment_status, total_amount, shipping_amount, created_at')
    
    if (timeFilter !== 'all') {
      const now = new Date()
      let startDate = new Date()
      if (timeFilter === 'daily') startDate.setHours(0, 0, 0, 0)
      if (timeFilter === 'weekly') startDate.setDate(now.getDate() - 7)
      if (timeFilter === 'monthly') startDate.setMonth(now.getMonth() - 1)
      dateQuery = dateQuery.gte('created_at', startDate.toISOString())
    }

    const { data: orders } = await dateQuery
    const { count: usersCount } = await supabase.from('users').select('*', { count: 'exact', head: true })
    const { data: productsData } = await supabase.from('products').select(`
      id, name, price, original_price, image_url, sold_count, category_id,
      categories (name)
    `)

    // Calculate Stats
    let s = {
      totalOmzet: 0,
      shopRevenue: 0,
      appCommission: 0, // Placeholder mapping if app commission exists in future
      ordersPending: 0,
      ordersPaid: 0,
      ordersShipping: 0,
      ordersDone: 0,
      ordersCanceled: 0,
      totalUsers: usersCount || 0,
      totalProducts: productsData?.length || 0
    }

    if (orders) {
      orders.forEach(o => {
        // Status counts
        if (o.status === 'Dibatalkan') {
          s.ordersCanceled++
        } else {
          // If not canceled, compute financial metrics (omzet, owner amount)
          const total = o.total_amount || 0
          const shipping = o.shipping_amount || 0
          s.totalOmzet += total
          s.shopRevenue += Math.max(0, total - shipping) // Shop earnings
          
          if (o.status === 'Selesai') s.ordersDone++
          else if (o.status === 'Dikirim') s.ordersShipping++
          else if (o.payment_status === 'pending') s.ordersPending++
          else s.ordersPaid++
        }
      })
    }

    setStats(s)

    // Top Products Sorting
    if (productsData) {
      // Sort by sold_count descending
      const sorted = [...productsData].sort((a, b) => (b.sold_count || 0) - (a.sold_count || 0)).slice(0, 5)
      setTopProducts(sorted)
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [timeFilter])

  return (
    <div className="min-h-screen bg-slate-50 font-sans max-w-md mx-auto pb-24 selection:bg-indigo-100">

      {/* HEADER */}
      <div className="bg-white sticky top-0 z-40 border-b border-slate-100/60 backdrop-blur-md bg-white/80">
        <div className="px-5 pt-12 pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Master Admin</h1>
            <div className="flex items-center gap-1.5 mt-0.5 opacity-80">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">System Online</p>
            </div>
          </div>
          <div className="relative group">
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="appearance-none bg-slate-100 text-slate-700 text-[11px] font-bold px-3 pr-8 py-2 rounded-xl outline-none border border-slate-200 focus:ring-2 focus:ring-indigo-100 cursor-pointer shadow-sm transition-all"
            >
              <option value="all">Semua Waktu</option>
              <option value="daily">Harian</option>
              <option value="weekly">Mingguan</option>
              <option value="monthly">Bulanan</option>
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 group-hover:text-indigo-500 transition-colors">
              <ChevronRight size={14} className="rotate-90" />
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">

        {/* --- MAIN FINANCE DASHBOARD --- */}
        <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
          {/* Ornaments */}
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl"></div>

          <div className="relative z-10 space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                  <TrendingUp size={12} className="text-emerald-400" />
                  Total Omzet Utama
                </p>
                <h2 className="text-3xl font-extrabold tracking-tight">
                  Rp {stats.totalOmzet.toLocaleString('id-ID')}
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-5">
              <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1">Total Toko/Warung</p>
                <p className="text-[15px] font-bold text-emerald-300">Rp {stats.shopRevenue.toLocaleString('id-ID')}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                <p className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1">Komisi Aplikasi</p>
                <p className="text-[15px] font-bold text-indigo-300">Rp {stats.appCommission.toLocaleString('id-ID')}</p>
              </div>
            </div>
          </div>
        </section>


        {/* --- ORDER TRACKING WIDGETS --- */}
        <section>
          <div className="flex items-center gap-2 mb-3 ml-1">
            <div className="w-1 h-3.5 bg-indigo-500 rounded-full"></div>
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest">Pelacakan Pesanan</h3>
          </div>
          <div className="grid grid-cols-5 gap-2">
            <Link href="/admin/orders/unpaid" className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 hover:border-indigo-200 transition-all active:scale-95">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl"><Clock size={16} /></div>
              <p className="text-[9px] font-bold text-slate-500 uppercase text-center leading-tight">Belum<br/>Bayar</p>
              <span className="text-sm font-bold text-slate-800">{stats.ordersPending}</span>
            </Link>
            <Link href="/admin/orders/paid" className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 hover:border-indigo-200 transition-all active:scale-95">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><CreditCard size={16} /></div>
              <p className="text-[9px] font-bold text-slate-500 uppercase text-center leading-tight">Sudah<br/>Dibayar</p>
              <span className="text-sm font-bold text-slate-800">{stats.ordersPaid}</span>
            </Link>
            <Link href="/admin/orders/dikirim" className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 hover:border-indigo-200 transition-all active:scale-95">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Truck size={16} /></div>
              <p className="text-[9px] font-bold text-slate-500 uppercase text-center leading-tight">Sedang<br/>Dikirim</p>
              <span className="text-sm font-bold text-slate-800">{stats.ordersShipping}</span>
            </Link>
            <Link href="/admin/orders/selesai" className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-2 hover:border-indigo-200 transition-all active:scale-95">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl"><CheckCircle2 size={16} /></div>
              <p className="text-[9px] font-bold text-slate-500 uppercase text-center leading-tight">Telah<br/>Selesai</p>
              <span className="text-sm font-bold text-slate-800">{stats.ordersDone}</span>
            </Link>
            <Link href="/admin/orders" className="bg-slate-50 p-3 rounded-2xl border border-slate-200 shadow-inner flex flex-col items-center justify-center gap-2 hover:bg-slate-100 transition-all active:scale-95 opacity-80">
              <div className="p-2 bg-red-100 text-red-600 rounded-xl"><XCircle size={16} /></div>
              <p className="text-[9px] font-bold text-slate-500 uppercase text-center leading-tight">Pesanan<br/>Batal</p>
              <span className="text-sm font-bold text-slate-800">{stats.ordersCanceled}</span>
            </Link>
          </div>
        </section>


        {/* --- BEST SELLER PRODUCTS --- */}
        <section>
          <div className="flex items-center justify-between mb-3 mx-1">
            <div className="flex items-center gap-2">
              <div className="w-1 h-3.5 bg-orange-500 rounded-full"></div>
              <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest">Produk Paling Laris</h3>
            </div>
            <Link href="/admin/add-product" className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">Semua</Link>
          </div>
          
          <div className="bg-white border border-slate-100 shadow-sm rounded-3xl p-1 overflow-hidden">
            {loading ? (
              <div className="p-5 flex justify-center"><Loader2 size={24} className="animate-spin text-slate-300" /></div>
            ) : topProducts.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 font-medium">Belum ada produk laris</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {topProducts.map((p, idx) => {
                  const img = Array.isArray(p.image_url) ? p.image_url[0] : p.image_url
                  return (
                    <Link key={p.id} href={`/admin/add-product/${p.id}`} className="flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors group">
                      <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 shrink-0 relative">
                        {img ? (
                           <img src={img} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        ) : (
                           <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={20} /></div>
                        )}
                        <div className="absolute top-0 left-0 bg-slate-900/60 text-white text-[8px] font-extrabold w-5 h-5 flex items-center justify-center rounded-br-lg z-10 backdrop-blur-sm">
                          #{idx + 1}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-slate-800 truncate mb-1">{p.name}</h4>
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                            {p.categories?.name || 'Kategori Umum'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-auto">
                          <span className="text-xs font-extrabold text-slate-900">Rp {p.price.toLocaleString('id-ID')}</span>
                          <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded-md">{p.sold_count} terjual</span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </section>


        {/* --- MANAGEMENT MENU GRID --- */}
        <section>
          <div className="flex items-center gap-2 mb-3 ml-1 mt-6">
            <div className="w-1 h-3.5 bg-blue-500 rounded-full"></div>
            <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest">Master Management</h3>
          </div>

          <div className="grid grid-cols-2 gap-3 pb-8">
            {/* Promo & Marketing */}
            <MenuCard href="/admin/flash-sale" icon={Zap} title="Flash Sale" desc="Kelola antrean produk kilat" color="orange" />
            <MenuCard href="/admin/vouchers" icon={Tag} title="Voucher" desc="Kelola diskon voucher" color="rose" />
            <div className="col-span-2">
              <MenuCard href="/admin/banners" icon={ImageIcon} title="Banner Promo (Grid PromoBanner)" desc="Atur banner slide & visual promosi" color="indigo" layout="horizontal" />
            </div>

            {/* Inventory & Shops */}
            <div className="col-span-2">
              <MenuCard href="/admin/shop-management" icon={Store} title="Owner & Warung" desc="Kelola profil owner dan kios" color="emerald" layout="horizontal" />
            </div>
            <MenuCard href="/admin/add-product" icon={Package} title="Produk" desc="Database semua barang" color="blue" />
            <MenuCard href="/admin/ready" icon={Coffee} title="Jajanan Ready" desc="Produk siap saji cepat" color="amber" />
            
            {/* Logistics & Finance */}
            <MenuCard href="/admin/drivers" icon={Truck} title="Manajemen Driver" desc="Aktivitas & kurir aktif" color="teal" />
            <MenuCard href="/admin/withdrawals" icon={CreditCard} title="Penarikan Saldo" desc="Withdraw user, toko, driver" color="violet" />

            {/* Users & Support */}
            <div className="col-span-2">
              <MenuCard href="/admin/chat" icon={MessageCircle} title="Live Chat CS (Admin)" desc="Layanan support & chat pengguna ke pusat" color="sky" layout="horizontal" />
            </div>
            <div className="col-span-2">
              <MenuCard href="/admin/shop-chat" icon={Store} title="Chat Toko (Owner)" desc="Kelola chat pembeli ke toko Anda" color="amber" layout="horizontal" />
            </div>
            <div className="col-span-2">
              <MenuCard href="/admin/customers" icon={Users} title="User & Admin" desc="Database pengguna dan role akses" color="slate" layout="horizontal" />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

// ── CUSTOM COMPONENTS ──
import { Coffee } from "lucide-react"

function MenuCard({ href, icon: Icon, title, desc, color, layout = "vertical" }: any) {
  const isHoriz = layout === "horizontal"
  
  const colorMap: Record<string, string> = {
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-100",
    orange: "bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100",
    blue: "bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100",
    teal: "bg-teal-50 text-teal-600 border-teal-100 hover:bg-teal-100",
    violet: "bg-violet-50 text-violet-600 border-violet-100 hover:bg-violet-100",
    sky: "bg-sky-50 text-sky-600 border-sky-100 hover:bg-sky-100",
    slate: "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
  }
  
  const iconBgMap: Record<string, string> = {
    indigo: "bg-indigo-100/80", orange: "bg-orange-100/80", rose: "bg-rose-100/80", emerald: "bg-emerald-100/80",
    blue: "bg-blue-100/80", amber: "bg-amber-100/80", teal: "bg-teal-100/80", violet: "bg-violet-100/80",
    sky: "bg-sky-100/80", slate: "bg-slate-200/80"
  }

  return (
    <Link href={href} className={`flex ${isHoriz ? 'flex-row items-center justify-between' : 'flex-col items-start'} p-4 rounded-3xl border shadow-sm transition-all active:scale-[0.98] ${colorMap[color]}`}>
      <div className={`flex ${isHoriz ? 'items-center gap-4' : 'flex-col gap-3'}`}>
        <div className={`p-3 rounded-2xl ${iconBgMap[color]}`}>
          <Icon size={isHoriz ? 22 : 24} strokeWidth={2.5} />
        </div>
        <div>
          <h4 className="text-sm font-extrabold text-slate-800 leading-tight mb-0.5">{title}</h4>
          <p className="text-[10px] font-semibold opacity-70 leading-snug pr-2">{desc}</p>
        </div>
      </div>
      {isHoriz && <ChevronRight size={18} className="opacity-50 shrink-0 ml-2" />}
    </Link>
  )
}