"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { 
  LayoutDashboard, Truck, PackageSearch, 
  TrendingUp, ArrowUpRight, Package, List, 
  XCircle, Edit3, Plus, Save, Undo2
} from "lucide-react"



export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("dashboard")
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // State untuk Edit (Form Sederhana)
  const [editMode, setEditMode] = useState<{type: 'product' | 'category' | null, data: any}>({ type: null, data: null })

  // 1. Ambil Data dari Database
  const fetchData = async () => {
    setLoading(true)
    const { data: prod } = await supabase.from('products').select('*').order('created_at', { ascending: false })
    const { data: cat } = await supabase.from('categories').select('*').order('created_at', { ascending: false })
    if (prod) setProducts(prod)
    if (cat) setCategories(cat)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  // 2. Fungsi Hapus
  const handleDelete = async (table: string, id: string) => {
    if (!confirm("Yakin mau hapus data ini, Lur?")) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (!error) fetchData()
    else alert("Gagal hapus: " + error.message)
  }

  return (
    <div className="min-h-screen max-w-md mx-auto bg-gray-50 pb-24 border-x border-gray-200 shadow-xl font-sans">
      {/* Header Statis */}
      <div className="bg-white p-6 border-b sticky top-0 z-20">
        <div className="flex justify-between items-center mb-4">
          <h1 className="font-extrabold text-xl text-gray-800">Admin Desa</h1>
          <button onClick={() => fetchData()} className="text-indigo-600"><Undo2 size={18}/></button>
        </div>

        {/* Menu Tab */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[
            { id: "dashboard", name: "Statistik", icon: LayoutDashboard },
            { id: "inventory", name: "Stok Produk", icon: PackageSearch },
            { id: "manage-cat", name: "Kategori", icon: List },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setEditMode({type: null, data: null}) }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === item.id ? "bg-indigo-600 text-white shadow-md" : "bg-gray-100 text-gray-400"
              }`}
            >
              <item.icon size={14} />
              {item.name}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {/* --- TAB STOK PRODUK --- */}
        {activeTab === "inventory" && (
          <div className="animate-in fade-in space-y-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Daftar Produk ({products.length})</span>
              <button className="bg-indigo-600 text-white p-2 rounded-lg shadow-sm"><Plus size={16}/></button>
            </div>

            {products.map((p) => (
              <div key={p.id} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3">
                <img src={p.image_url} className="w-12 h-12 rounded-xl object-cover bg-gray-50" />
                <div className="flex-1">
                  <h4 className="text-[13px] font-bold text-gray-800 line-clamp-1">{p.name}</h4>
                  <p className="text-[11px] text-indigo-600 font-black">Rp {p.price.toLocaleString()}</p>
                </div>
                <div className="flex gap-1">
                  <button className="p-2 text-blue-500 bg-blue-50 rounded-lg"><Edit3 size={14} /></button>
                  <button onClick={() => handleDelete('products', p.id)} className="p-2 text-red-500 bg-red-50 rounded-lg"><XCircle size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --- TAB KATEGORI --- */}
        {activeTab === "manage-cat" && (
          <div className="animate-in fade-in space-y-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Kategori ({categories.length})</span>
              <button className="bg-indigo-600 text-white p-2 rounded-lg shadow-sm"><Plus size={16}/></button>
            </div>

            {categories.map((c) => (
              <div key={c.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg text-white bg-linear-to-br ${c.color_theme || 'from-gray-400 to-gray-600'}`}>
                    <List size={16} />
                  </div>
                  <h4 className="text-sm font-bold text-gray-800">{c.name}</h4>
                </div>
                <div className="flex gap-1">
                  <button className="p-2 text-blue-500 bg-blue-50 rounded-lg"><Edit3 size={14} /></button>
                  <button onClick={() => handleDelete('categories', c.id)} className="p-2 text-red-500 bg-red-50 rounded-lg"><XCircle size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --- TAB DASHBOARD (STATISTIK) --- */}
        {activeTab === "dashboard" && (
          <div className="animate-in fade-in space-y-4 text-center py-10">
            <div className="bg-indigo-600 p-8 rounded-4xl shadow-xl relative overflow-hidden text-white">
               <p className="text-indigo-200 text-xs font-bold uppercase mb-2">Total Produk Aktif</p>
               <h2 className="text-5xl font-black">{products.length}</h2>
               <div className="mt-6 pt-6 border-t border-indigo-500/50 flex justify-around">
                  <div>
                    <p className="text-[10px] opacity-70">Kategori</p>
                    <p className="font-bold">{categories.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] opacity-70">Penjualan</p>
                    <p className="font-bold">128</p>
                  </div>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}