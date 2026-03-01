"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { ArrowLeft, Plus, Search, Filter, MoreVertical, LayoutDashboard, ShoppingBag, Users, Settings, Package, Truck, CheckCircle2, AlertCircle, Clock, ChevronRight, LogOut, ArrowRight, Tag, Camera, MapPin, Loader2, CreditCard, Image as ImageIcon, TrendingUp, Trash2 } from "lucide-react"
import { toast } from "sonner"
import Skeleton from "@/app/components/Skeleton"

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard")
  const [timeFilter, setTimeFilter] = useState("all")
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [banners, setBanners] = useState<any[]>([])
  const [categorySales, setCategorySales] = useState<any[]>([])
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalSales: 0,
    pending: 0,
    process: 0,
    shipping: 0,
    done: 0
  })
  const [loading, setLoading] = useState(false)

  // Navigation Items
  const navItems = [
    { id: "dashboard", label: "Beranda", icon: LayoutDashboard },
    { id: "inventory", label: "Produk", icon: Package },
    { id: "banners", label: "Banner", icon: ImageIcon },
    { id: "orders", label: "Pesanan", icon: Truck },
    { id: "settings", label: "Pengaturan", icon: Settings },
  ]

  const fetchData = async () => {
    setLoading(true)

    // 1. Setup Filter Tanggal
    let dateQuery = supabase.from('orders').select('status, total_amount, created_at, id, payment_status')

    if (timeFilter !== 'all') {
      const now = new Date()
      let startDate = new Date()
      if (timeFilter === 'daily') startDate.setHours(0, 0, 0, 0)
      if (timeFilter === 'weekly') startDate.setDate(now.getDate() - 7)
      if (timeFilter === 'monthly') startDate.setMonth(now.getMonth() - 1)
      dateQuery = dateQuery.gte('created_at', startDate.toISOString())
    }

    const { data: orders } = await dateQuery
    const { data: prod } = await supabase.from('products').select('*')
    const { data: cat } = await supabase.from('categories').select('*')
    const { data: ban } = await supabase.from('flash_sale_banners').select('*').order('created_at', { ascending: false })
    const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true })

    // 2. Ambil Item Terjual (Mapping via Nama Produk)
    const orderIds = orders?.map(o => o.id) || []
    let items: any[] = []

    if (orderIds.length > 0) {
      try {
        const { data: itemsData, error: itemsError } = await supabase
          .from('order_items')
          .select('quantity, product_name')
          .in('order_id', orderIds)

        if (itemsError) {
          console.warn("[Admin] Failed to fetch order items for stats:", itemsError.message)
        } else if (itemsData && prod) {
          // Mapping manual di sisi klien menggunakan 'product_name'
          items = itemsData.map(item => {
            const product = prod.find(p => p.name === item.product_name)
            return {
              ...item,
              products: product ? { category_id: product.category_id } : null
            }
          })
        }
      } catch (err) {
        console.error("[Admin] Unexpected error fetching items:", err)
      }
    }

    if (prod) setProducts(prod)
    if (cat) setCategories(cat)
    if (ban) setBanners(ban)

    // 3. Hitung Statistik
    if (orders) {
      const summary = orders.reduce((acc, curr) => {
        acc.totalSales += curr.total_amount || 0;
        // Penjualan yang belum dibayar
        if (curr.payment_status === 'pending') acc.pending++;
        // Penjualan yang sudah dibayar atau sedang diproses (COD)
        if ((curr.payment_status === 'paid' || curr.payment_status === 'processing') && curr.status !== 'Selesai' && curr.status !== 'Dikirim') acc.process++;

        if (curr.status === 'Dikirim') acc.shipping++;
        if (curr.status === 'Selesai') acc.done++;
        return acc;
      }, { totalSales: 0, pending: 0, process: 0, shipping: 0, done: 0 })

      setStats({ ...summary, totalUsers: userCount || 0 })
    }

    // 4. Hitung Penjualan per Kategori
    if (items && cat) {
      const catMap: any = {}
      cat.forEach(c => catMap[c.id] = { name: c.name, total: 0 })

      items.forEach((item: any) => {
        const catId = item.products?.category_id
        if (catId && catMap[catId]) {
          catMap[catId].total += item.quantity
        }
      })
      setCategorySales(Object.values(catMap).sort((a: any, b: any) => b.total - a.total))
    }

    setLoading(false)
  }

  useEffect(() => { fetchData() }, [timeFilter])

  return (
    <div className="min-h-screen bg-slate-50/80 font-sans max-w-md mx-auto relative pb-24">

      {/* HEADER */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="flex items-center justify-between px-5 pt-12 pb-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Master Admin</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
              <p className="text-[10px] font-medium text-slate-400 uppercase">Toko Aktif</p>
            </div>
          </div>

          {/* Time Filter Dropdown */}
          <div className="relative">
            <select
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value)}
              className="appearance-none bg-slate-100 text-slate-600 text-xs font-semibold pl-3 pr-8 py-2 rounded-lg outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
            >
              <option value="all">Semua Waktu</option>
              <option value="daily">Hari Ini</option>
              <option value="weekly">7 Hari Terakhir</option>
              <option value="monthly">30 Hari Terakhir</option>
            </select>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">

        {/* --- TAB DASHBOARD --- */}
        {activeTab === "dashboard" && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">

            {/* Main Stats Card (Dark Mode) */}
            <div className="bg-slate-900 p-6 rounded-2xl text-white shadow-lg relative overflow-hidden">
              <div className="relative z-10">
                {loading ? (
                  <div className="space-y-6">
                    <div className="flex justify-between items-start mb-6">
                      <div className="space-y-2">
                        <Skeleton className="h-3 w-20 bg-slate-700" />
                        <Skeleton className="h-8 w-40 bg-slate-700" />
                      </div>
                      <Skeleton className="w-10 h-10 rounded-lg bg-slate-700" />
                    </div>
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="space-y-2">
                          <Skeleton className="h-2 w-10 bg-slate-700" />
                          <Skeleton className="h-5 w-12 bg-slate-700" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <p className="text-slate-400 text-xs font-medium mb-1">Total Omzet</p>
                        <h2 className="text-2xl font-bold tracking-tight">Rp {stats.totalSales.toLocaleString('id-ID')}</h2>
                      </div>
                      <div className="p-2 bg-white/10 rounded-lg">
                        <TrendingUp size={20} className="text-emerald-400" />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
                      <div>
                        <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wide mb-1">Users</p>
                        <p className="text-lg font-bold">{stats.totalUsers}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wide mb-1">Produk</p>
                        <p className="text-lg font-bold">{products.length}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wide mb-1">Kategori</p>
                        <p className="text-lg font-bold">{categories.length}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
              {/* Decorative Element */}
              <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl"></div>
            </div>

            {/* KATEGORI TERLARIS */}
            <div>
              <div className="flex justify-between items-center mb-3 px-1">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Kategori Terlaris</h3>
              </div>
              <div className="bg-white rounded-xl border border-slate-100 p-5 space-y-4">
                {loading ? (
                  Array(3).fill(0).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-10" />
                      </div>
                      <Skeleton className="h-1.5 w-full rounded-full" />
                    </div>
                  ))
                ) : categorySales.length > 0 ? categorySales.map((c, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-slate-600">{c.name}</span>
                      <span className="text-slate-900">{c.total} <span className="text-slate-400 font-normal">pcs</span></span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
                        style={{ width: `${Math.min((c.total / (categorySales[0]?.total || 1)) * 100, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                )) : (
                  <p className="text-xs text-slate-400 text-center py-4">Belum ada penjualan.</p>
                )}
              </div>
            </div>

            {/* STATUS GRID */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 px-1">Status Pesanan</h3>
              <div className="grid grid-cols-2 gap-3">
                {loading ? (
                  Array(4).fill(0).map((_, i) => (
                    <div key={i} className="p-5 rounded-xl border border-slate-100 bg-white space-y-3">
                      <div className="flex justify-between">
                        <Skeleton className="w-8 h-8 rounded-lg" />
                        <Skeleton className="w-6 h-6" />
                      </div>
                      <Skeleton className="h-3 w-20" />
                    </div>
                  ))
                ) : (
                  <>
                    <Link href="/admin/orders/unpaid">
                      <StatCard label="Belum Bayar" value={stats.pending} icon={CreditCard} color="bg-amber-50 text-amber-600 border-amber-100" />
                    </Link>
                    <Link href="/admin/orders/paid">
                      <StatCard label="Sudah Dibayar" value={stats.process} icon={Clock} color="bg-indigo-50 text-indigo-600 border-indigo-100" />
                    </Link>
                    <Link href="/admin/orders/dikirim">
                      <StatCard label="Dikirim" value={stats.shipping} icon={Truck} color="bg-blue-50 text-blue-600 border-blue-100" />
                    </Link>
                    <Link href="/admin/orders/selesai">
                      <StatCard label="Selesai" value={stats.done} icon={CheckCircle2} color="bg-emerald-50 text-emerald-600 border-emerald-100" />
                    </Link>
                    <Link href="/admin/ready">
                      <div className="col-span-2 p-5 rounded-xl border border-indigo-100 bg-indigo-50/50 flex items-center justify-between transition-all hover:bg-indigo-50 active:scale-[0.98]">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-white rounded-lg shadow-sm text-indigo-600">
                            <Package size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 leading-tight">Kelola Jajanan Ready</p>
                            <p className="text-[10px] text-slate-500 font-medium">Atur stok yang siap kirim</p>
                          </div>
                        </div>
                        <ArrowRight size={16} className="text-indigo-400" />
                      </div>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- TAB BANNERS --- */}
        {activeTab === "banners" && (
          <div className="space-y-4 animate-in fade-in duration-300 pt-2">
            {/* Link ke Kelola Banner Promo */}
            <Link
              href="/admin/banners"
              className="flex items-center justify-between w-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-4 rounded-xl shadow-sm shadow-indigo-100 active:scale-[0.98] transition-all"
            >
              <div>
                <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">Halaman Home</span>
                <h3 className="text-sm font-bold">Kelola Banner Promo Slider</h3>
              </div>
              <ChevronRight size={20} />
            </Link>

            <div className="flex justify-between items-center mb-2 px-1">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">Kelola Banner Flash Sale</h3>
              <button
                onClick={() => toast.info("Fitur Tambah Banner: Masukkan data ke table flash_sale_banners di Supabase untuk saat ini.")}
                className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                title="Sistem manajemen banner lengkap sedang dikembangkan"
              >
                <Plus size={16} />
              </button>
            </div>

            {banners.length > 0 ? banners.map((b) => (
              <div key={b.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4">
                <div className="w-20 h-14 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-50 relative">
                  <img src={b.image_url} className="w-full h-full object-cover" alt={b.title} />
                  {!b.is_active && (
                    <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center">
                      <span className="text-[8px] font-bold text-white uppercase tracking-tighter">Nonaktif</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-slate-800 line-clamp-1">{b.title}</h4>
                  <p className="text-[10px] font-medium text-red-500 mt-0.5">{b.discount_text}</p>
                  <p className="text-[9px] text-slate-400 mt-0.5 truncate">Exp: {new Date(b.end_date).toLocaleDateString('id-ID')}</p>
                </div>
                <button
                  onClick={async () => {
                    if (confirm("Hapus banner ini?")) {
                      const { error } = await supabase.from('flash_sale_banners').delete().eq('id', b.id);
                      if (!error) fetchData();
                    }
                  }}
                  className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )) : (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200">
                <p className="text-xs text-slate-400">Belum ada banner.</p>
              </div>
            )}

            <p className="text-[9px] text-slate-400 text-center px-4 italic">
              Banner ini akan muncul di halaman /flash-sale sebagai header promo.
            </p>
          </div>
        )}

        {/* --- TAB ORDERS & SETTINGS (Placeholder) --- */}
        {activeTab === "orders" && (
          <div className="text-center py-24 animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Truck size={24} className="text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Manajemen Pesanan</p>
            <p className="text-xs text-slate-400 mt-1">Pantau status pesanan di sini.</p>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="text-center py-24 animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Settings size={24} className="text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Pengaturan</p>
            <p className="text-xs text-slate-400 mt-1">Konfigurasi toko Anda.</p>
          </div>
        )}

      </div>

      {/* BOTTOM NAVIGATION */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 max-w-md mx-auto z-50">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${isActive ? 'text-slate-900' : 'text-slate-400'
                  }`}
              >
                <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span className={`text-[10px] font-semibold`}>{item.label}</span>
                {isActive && (
                  <div className="absolute bottom-0 h-0.5 w-8 bg-slate-900 rounded-full"></div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Sub-component untuk Card Statistik (Clean Style)
function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <div className={`p-5 rounded-xl border ${color} transition-all hover:shadow-sm`}>
      <div className="flex justify-between items-start mb-3">
        <div className="p-1.5 bg-white rounded-lg shadow-xs"><Icon size={16} /></div>
        <span className="text-xl font-bold">{value}</span>
      </div>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-80 line-clamp-1">{label}</p>
    </div>
  )
}