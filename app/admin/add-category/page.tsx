"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as Icons from "lucide-react"
import { 
  ArrowLeft, Edit3, Trash2, Plus, Loader2, Tag, LayoutGrid 
} from "lucide-react"

export default function ManageCategoriesPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    const { data: cat } = await supabase
      .from('categories')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (cat) setCategories(cat)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus kategori "${name}"? Produk di dalamnya mungkin terpengaruh.`)) return
    
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id)

    if (!error) {
      setCategories(prev => prev.filter(c => c.id !== id))
    } else {
      alert("Gagal menghapus: " + error.message)
    }
  }

  // Function to generate consistent background colors if theme is missing
  const getIconBgColor = (index: number) => {
    const colors = [
      "bg-indigo-100 text-indigo-600",
      "bg-emerald-100 text-emerald-600",
      "bg-amber-100 text-amber-600",
      "bg-blue-100 text-blue-600",
      "bg-rose-100 text-rose-600",
    ]
    return colors[index % colors.length]
  }

  return (
    <div className="min-h-screen bg-slate-50/80 font-sans max-w-md mx-auto relative pb-24">
      
      {/* HEADER */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="flex items-center justify-between px-5 pt-12 pb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
              <ArrowLeft size={20} strokeWidth={2.5} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Kategori</h1>
              <p className="text-[10px] font-medium text-slate-400">Kelola kategori produk</p>
            </div>
          </div>
          
          <Link 
            href="/admin/add-category/detail" 
            className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Plus size={14} />
            <span>Baru</span>
          </Link>
        </div>
      </div>

      {/* CONTENT */}
      <div className="p-5 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="animate-spin mb-3" size={28} />
            <p className="text-xs font-medium">Memuat data...</p>
          </div>
        ) : categories.length > 0 ? (
          categories.map((c, index) => {
            // Dynamic Icon Logic
            const DynamicIcon = (Icons as any)[c.icon_name] || Tag
            
            // Logic for styling: Use DB theme or fallback to generated colors
            const iconStyle = c.color_theme 
              ? `bg-indigo-600 text-white` 
              : getIconBgColor(index)

            return (
              <div 
                key={c.id} 
                className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between hover:border-slate-200 transition-colors"
              >
                <div className="flex items-center gap-3.5">
                  {/* Icon Container */}
                  <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${iconStyle}`}>
                    <DynamicIcon size={20} strokeWidth={2} />
                  </div>
                  
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold text-slate-800 truncate">{c.name}</h4>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {c.icon_name || "Tanpa Ikon"}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-1 shrink-0 ml-2">
                  <Link 
                    href={`/admin/add-category/detail?id=${c.id}`} 
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    <Edit3 size={16} />
                  </Link>
                  <button 
                    onClick={() => handleDelete(c.id, c.name)} 
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )
          })
        ) : (
          /* EMPTY STATE */
          <div className="text-center py-20 flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-5">
              <LayoutGrid size={28} className="text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">Belum Ada Kategori</p>
            <p className="text-xs text-slate-400 mb-6">Buat kategori pertamamu sekarang.</p>
            <Link 
              href="/admin/add-category/detail" 
              className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors inline-flex items-center gap-2"
            >
              <Plus size={14} />
              Tambah Kategori
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}