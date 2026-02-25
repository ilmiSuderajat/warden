"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { 
  Edit3, XCircle, Package, Image as ImageIcon 
} from "lucide-react"

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("inventory")
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    const { data: prod } = await supabase.from('products').select('*').order('created_at', { ascending: false })
    if (prod) setProducts(prod)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleDelete = async (table: string, id: string) => {
    if (!confirm("Yakin mau hapus data ini, Lur?")) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (!error) fetchData()
    else alert("Gagal hapus: " + error.message)
  }

  return (
    <>
      {/* --- TAB STOK PRODUK --- */}
      {activeTab === "inventory" && (
        <div className="animate-in fade-in max-w-md mt-20 mx-auto space-y-3 px-4">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-black text-gray-800 italic">Gudang Desa</h2>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                Total: {products.length} Produk
              </span>
            </div>
            <Link 
              href="/admin/add-product/detail" 
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-lg shadow-indigo-100 text-xs font-bold"
            >
              + Tambah
            </Link>
          </div>

          {loading ? (
             <div className="text-center py-10 text-gray-400 text-xs font-bold animate-pulse">Memuat data...</div>
          ) : (
            products.map((p) => {
              // AMBIL GAMBAR PERTAMA DARI ARRAY
              const firstImage = Array.isArray(p.image_url) ? p.image_url[0] : p.image_url;

              return (
                <div key={p.id} className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 transition-all active:scale-95">
                  {/* Container Gambar */}
                  <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gray-50 shrink-0 border border-gray-50">
                    {firstImage ? (
                      <img 
                        src={firstImage} 
                        className="w-full h-full object-cover" 
                        alt={p.name} 
                        onError={(e) => {
                          (e.target as any).src = "https://placehold.co/400x400?text=No+Image"
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        <ImageIcon size={20} />
                      </div>
                    )}
                  </div>

                  {/* Info Produk */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] font-bold text-gray-800 truncate">{p.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                       <p className="text-[12px] text-indigo-600 font-black">
                         Rp {p.price?.toLocaleString()}
                       </p>
                       {p.original_price && (
                         <p className="text-[10px] text-gray-400 line-through">
                           Rp {p.original_price?.toLocaleString()}
                         </p>
                       )}
                    </div>
                  </div>

                  {/* Tombol Aksi */}
                  <div className="flex gap-1">
                    <button className="p-2.5 text-blue-500 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors">
                      <Edit3 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete('products', p.id)} 
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