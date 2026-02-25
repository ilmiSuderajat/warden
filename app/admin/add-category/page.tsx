"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import * as Icons from "lucide-react" // Import semua ikon sebagai object
import { 
  XCircle, Edit3, Plus, Undo2
} from "lucide-react"

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("manage-cat")
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    const { data: cat } = await supabase.from('categories').select('*').order('created_at', { ascending: false })
    if (cat) setCategories(cat)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleDelete = async (table: string, id: string) => {
    if (!confirm("Yakin mau hapus kategori ini, Lur? Semua produk di dalamnya mungkin terpengaruh.")) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (!error) fetchData()
    else alert("Gagal hapus: " + error.message)
  }

  return (
    <>
      {/* --- TAB KATEGORI --- */}
      {activeTab === "manage-cat" && (
        <div className="animate-in fade-in max-w-md mt-20 mx-auto space-y-3 px-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-black text-gray-800 italic">Kategori Desa</h2>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Pengaturan Tampilan Utama
              </span>
            </div>
            <Link 
              href="/admin/add-category/detail" 
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-lg shadow-indigo-100 text-[11px] font-black uppercase"
            >
              + Baru
            </Link>
          </div>

          {loading ? (
            <div className="text-center py-10 text-gray-400 text-xs font-bold animate-pulse">Menghubungkan ke pusat...</div>
          ) : (
            categories.map((c) => {
              // LOGIKA DYNAMIS ICON
              // Kita ambil komponen ikon berdasarkan nama yang tersimpan di kolom 'icon_name'
              const DynamicIcon = (Icons as any)[c.icon_name] || Icons.Package;

              return (
                <div key={c.id} className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex items-center justify-between transition-all active:scale-95">
                  <div className="flex items-center gap-4">
                    {/* Lingkaran Ikon dengan Warna dari Database */}
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-inner bg-linear-to-br ${c.color_theme || 'from-gray-400 to-gray-500'}`}>
                      <DynamicIcon size={22} strokeWidth={2.5} />
                    </div>
                    
                    <div>
                      <h4 className="text-[14px] font-black text-gray-800 tracking-tight">{c.name}</h4>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">{c.icon_name}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button className="p-2.5 text-blue-500 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors">
                      <Edit3 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete('categories', c.id)} 
                      className="p-2.5 text-red-500 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
                    >
                      <XCircle size={16} />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </>
  )
}