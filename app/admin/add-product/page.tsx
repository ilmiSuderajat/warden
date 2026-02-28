"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { useRouter } from "next/navigation"
import * as Icons from "lucide-react"
import {
  ArrowLeft, Edit3, Trash2, Plus, Loader2, Package, Image as ImageIcon, Edit2, Search, ChevronRight
} from "lucide-react"
import { toast } from "sonner"

export default function ManageProductsPage() {
  const router = useRouter()
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    const { data: prod } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })

    if (prod) setProducts(prod)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Hapus produk "${name}" secara permanen?`)) return

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)

    if (!error) {
      // Optimistic Update: Hapus dari state lokal agar langsung hilang dari layar
      setProducts(prev => prev.filter(p => p.id !== id))
    } else {
      toast.error("Gagal menghapus: " + error.message)
    }
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
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Inventori</h1>
              <p className="text-[10px] font-medium text-slate-400">{products.length} Produk Terdaftar</p>
            </div>
          </div>

          <Link
            href="/admin/add-product/detail" // Sesuaikan path tambah produk
            className="flex items-center gap-1.5 bg-indigo-600 slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm"
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
            <p className="text-xs font-medium">Memuat inventori...</p>
          </div>
        ) : products.length > 0 ? (
          products.map((p) => {
            const firstImage = Array.isArray(p.image_url) ? p.image_url[0] : p.image_url;

            return (
              <div
                key={p.id}
                className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center gap-4 hover:border-slate-200 transition-colors"
              >
                {/* Container Gambar */}
                <div className="w-16 h-16 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-50">
                  {firstImage ? (
                    <img
                      src={firstImage}
                      className="w-full h-full object-cover"
                      alt={p.name}
                      onError={(e) => {
                        (e.target as any).style.display = 'none'; // Sembunyikan jika error
                        (e.target as any).nextSibling.style.display = 'flex'; // Tampilkan placeholder
                      }}
                    />
                  ) : null}
                  {/* Placeholder jika tidak ada gambar atau error */}
                  <div className="w-full h-full items-center justify-center text-slate-300 hidden">
                    <ImageIcon size={24} />
                  </div>
                </div>

                {/* Info Produk */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-slate-800 truncate">{p.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm font-bold text-slate-900">
                      Rp {p.price?.toLocaleString('id-ID')}
                    </p>
                    {p.original_price && (
                      <p className="text-[10px] text-slate-400 line-through">
                        Rp {p.original_price?.toLocaleString('id-ID')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="px-2 py-0.5 bg-slate-100 text-[10px] font-bold rounded text-slate-500">
                      Stok: {p.stock || 0}
                    </span>
                  </div>
                </div>

                {/* Tombol Aksi */}
                <div className="flex flex-col gap-1 shrink-0">
                  <Link
                    href={`/admin/add-product/${p.id}`} // Asumsi link edit pakai query param
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex justify-center"
                  >
                    <Edit3 size={16} />
                  </Link>
                  <button
                    onClick={() => handleDelete(p.id, p.name)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex justify-center"
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
              <Package size={28} className="text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">Gudang Kosong</p>
            <p className="text-xs text-slate-400 mb-6">Mulai tambahkan produk pertamamu.</p>
            <Link
              href="/admin/add-product"
              className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors inline-flex items-center gap-2"
            >
              <Plus size={14} />
              Tambah Produk
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}