"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Trash2, Tag, Link } from "lucide-react"

export default function ManageFlashSale() {
  const [flashProducts, setFlashProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  // 1. Fungsi untuk mengambil produk yang sedang Flash Sale
  const fetchFlashProducts = async () => {
    const { data } = await supabase
      .from("products")
      .select("id, name, price, original_price, sold_count")
      .eq("is_flash_sale", true)
    
    if (data) setFlashProducts(data)
  }

  useEffect(() => {
    fetchFlashProducts()
  }, [])

  // 2. Fungsi untuk menghapus produk dari Flash Sale (Kembali ke Reguler)
  const removeFromFlashSale = async (id: string) => {
    if (!confirm("Yakin ingin menurunkan produk ini dari Flash Sale?")) return
    
    setLoading(true)
    const { error } = await supabase
      .from("products")
      .update({ is_flash_sale: false })
      .eq("id", id)

    if (error) {
      alert("Gagal: " + error.message)
    } else {
      alert("Produk dikembalikan ke kategori reguler")
      fetchFlashProducts() // Refresh list
    }
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-md mx-auto mt-10">
      <div className="flex flex-col items-center gap-2 mb-6">
        <Tag className="text-orange-500" />
        
      <button onClick={() => window.location.href = "/admin/add-banner"} className="w-full bg-orange-500 text-white py-3 mt-4 rounded-lg font-bold hover:bg-orange-600">Tambah Produk ke Flash Sale</button>
      </div>
        <h2 className="text-2xl font-bold mb-5 text-gray-800">Flash Sale yang Sedang Aktif</h2>
        

      <div className="bg-white shadow rounded-lg overflow-hidden border">
        {flashProducts.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            Belum ada produk di Warden Flash Sale.
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-gray-600 text-sm">
              <tr>
                <th className="p-4 font-semibold">Produk</th>
                <th className="p-4 font-semibold">Harga Promo</th>
                <th className="p-4 font-semibold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {flashProducts.map((product) => (
                <tr key={product.id} className="border-t hover:bg-gray-50 transition">
                  <td className="p-4">
                    <p className="font-medium text-gray-800">{product.name}</p>
                    <p className="text-xs text-gray-400 line-through">Rp {product.original_price?.toLocaleString()}</p>
                  </td>
                  <td className="p-4 text-red-500 font-bold">
                    Rp {product.price?.toLocaleString()}
                  </td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => removeFromFlashSale(product.id)}
                      disabled={loading}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-full transition"
                      title="Hapus dari Flash Sale"
                    >
                      <Trash2 size={20} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
       
  )
}