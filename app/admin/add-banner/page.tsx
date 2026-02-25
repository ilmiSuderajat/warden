"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase" // sesuaikan path config Anda
import * as Icons from "lucide-react"
export default function AdminFlashSale() {
  const [products, setProducts] = useState<any[]>([])
  const [selectedProductId, setSelectedProductId] = useState("")
  const [loading, setLoading] = useState(false)
  
  // State untuk data flash sale
  const [flashData, setFlashData] = useState({
    price: "",
    original_price: "",
    sold_count: "",
  })

  // 1. Ambil semua produk untuk dipilih
  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase.from("products").select("id, name")
      if (data) setProducts(data)
    }
    fetchProducts()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProductId) return alert("Pilih produk dulu!")
    
    setLoading(true)

    // 2. Update produk tersebut menjadi status Flash Sale
    const { error } = await supabase
      .from("products")
      .update({
        is_flash_sale: true,
        price: parseFloat(flashData.price),
        original_price: parseFloat(flashData.original_price),
        sold_count: parseInt(flashData.sold_count)
      })
      .eq("id", selectedProductId)

    setLoading(false)
    if (error) {
      alert("Gagal: " + error.message)
    } else {
      alert("Produk berhasil masuk ke Warden Flash Sale!");
      // Reset form
      setFlashData({ price: "", original_price: "", sold_count: "" })
      setSelectedProductId("")
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto bg-white shadow rounded-lg mt-10 border-t-4 border-orange-500">
        <button onClick={() => window.history.back()} className="flex items-center gap-1 text-indigo-600 text-sm mb-4">
          <Icons.ArrowUpRight size={14} />
          Kembali ke Daftar Produk
        </button>
      <h2 className="text-2xl mt-10 font-bold mb-2 text-gray-800">⚡ Warden Flash Sale Manager</h2>
      <p className="text-sm text-gray-500 mb-6">Pilih produk desa untuk dipromosikan di seksi Flash Sale.</p>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Pilih Produk */}
        <div>
          <label className="block text-sm font-medium mb-1">Pilih Produk</label>
          <select 
            className="w-full p-2 border rounded bg-white"
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
            required
          >
            <option value="">-- Pilih Produk Desa --</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Harga Flash Sale */}
          <div>
            <label className="block text-sm font-medium mb-1 text-red-600">Harga Flash Sale (Rp)</label>
            <input type="number" placeholder="20186" 
              className="w-full p-2 border border-red-200 rounded" required
              value={flashData.price}
              onChange={e => setFlashData({...flashData, price: e.target.value})} />
          </div>

          {/* Harga Normal (Coret) */}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-400">Harga Normal (Coret)</label>
            <input type="number" placeholder="66666" 
              className="w-full p-2 border rounded" required
              value={flashData.original_price}
              onChange={e => setFlashData({...flashData, original_price: e.target.value})} />
          </div>
        </div>

        {/* Jumlah Terjual */}
        <div>
          <label className="block text-sm font-medium mb-1">Simulasi Terjual</label>
          <input type="number" placeholder="Contoh: 87" 
            className="w-full p-2 border rounded"
            value={flashData.sold_count}
            onChange={e => setFlashData({...flashData, sold_count: e.target.value})} />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-orange-500 text-white py-3 rounded-lg font-bold hover:bg-orange-600 transition shadow-lg"
        >
          {loading ? "Memproses..." : "Pasang di Flash Sale"}
        </button>
      </form>
    </div>
  )
}