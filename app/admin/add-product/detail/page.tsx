"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import imageCompression from 'browser-image-compression'; // Import library

export default function AddProductPage() {
  const [categories, setCategories] = useState<any[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [files, setFiles] = useState<(File | null)[]>([null, null, null])
  const [previews, setPreviews] = useState<string[]>(["", "", ""])
  const [formData, setFormData] = useState({ name: "", price: "", original_price: "", description: "" })

  useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await supabase.from("categories").select("id, name")
      if (data) setCategories(data)
    }
    fetchCategories()
  }, [])

  const handleFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const newFiles = [...files]
      newFiles[index] = file
      setFiles(newFiles)

      const reader = new FileReader()
      reader.onloadend = () => {
        const newPreviews = [...previews]
        newPreviews[index] = reader.result as string
        setPreviews(newPreviews)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // Opsi Kompresi
    const options = {
      maxSizeMB: 0.5,          // Maksimal file jadi 500KB
      maxWidthOrHeight: 1024, // Resolusi maksimal 1024px
      useWebWorker: true,
    }

    try {
      const uploadedUrls: string[] = []

      for (const file of files) {
        if (file) {
          // --- PROSES KOMPRESI DISINI ---
          console.log(`Ukuran asli: ${file.size / 1024 / 1024} MB`);
          const compressedFile = await imageCompression(file, options);
          console.log(`Ukuran setelah kompres: ${compressedFile.size / 1024 / 1024} MB`);
          // ------------------------------

          const fileExt = file.name.split('.').pop()
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
          
          // Upload file yang sudah dikompres
          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(fileName, compressedFile)

          if (uploadError) throw uploadError

          const { data: { publicUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(fileName)
          
          uploadedUrls.push(publicUrl)
        }
      }

      // Simpan ke DB
      const { data: newProduct, error: productError } = await supabase
        .from("products")
        .insert([{
          name: formData.name,
          price: parseFloat(formData.price),
          original_price: formData.original_price ? parseFloat(formData.original_price) : null,
          image_url: uploadedUrls,
          description: formData.description
        }])
        .select().single()

      if (productError) throw productError

      // Simpan Relasi Kategori
      if (selectedCategories.length > 0 && newProduct) {
        const junctionData = selectedCategories.map(catId => ({
          product_id: newProduct.id,
          category_id: catId
        }))
        await supabase.from("product_categories").insert(junctionData)
      }

      alert("Berhasil! Gambar sudah dikompres otomatis.")
      window.location.reload()
    } catch (error: any) {
      alert("Error: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto bg-white shadow-2xl rounded-[2.5rem] mt-10 mb-24 border border-gray-100 font-sans">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-gray-800 tracking-tight">Post Produk</h2>
        <div className="bg-green-100 text-green-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
           Auto-Compress On
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          {previews.map((src, index) => (
            <label key={index} className="relative aspect-square bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center cursor-pointer overflow-hidden hover:border-indigo-400 transition-all">
              {src ? (
                <img src={src} className="w-full h-full object-cover" alt="preview" />
              ) : (
                <Icons.Plus size={24} className="text-gray-300" />
              )}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(index, e)} />
            </label>
          ))}
        </div>

        <div className="space-y-4">
            <input type="text" placeholder="Nama Produk" className="w-full p-4 bg-gray-50 rounded-2xl text-sm font-bold outline-none border-none focus:ring-2 focus:ring-indigo-500" 
              onChange={e => setFormData({...formData, name: e.target.value})} required />
            
            <div className="grid grid-cols-2 gap-3">
              <input type="number" placeholder="Harga" className="p-4 bg-gray-50 rounded-2xl text-sm font-bold outline-none border-none focus:ring-2 focus:ring-indigo-500" 
                onChange={e => setFormData({...formData, price: e.target.value})} required />
              <input type="number" placeholder="Coret" className="p-4 bg-gray-50 rounded-2xl text-sm font-bold outline-none border-none focus:ring-2 focus:ring-indigo-500" 
                onChange={e => setFormData({...formData, original_price: e.target.value})} />
            </div>

            <textarea placeholder="Deskripsi detail..." className="w-full p-4 bg-gray-50 rounded-2xl h-28 text-sm font-medium outline-none border-none focus:ring-2 focus:ring-indigo-500"
              onChange={e => setFormData({...formData, description: e.target.value})} />
        </div>

        <button disabled={loading} className="w-full bg-indigo-600 text-white py-4 rounded-3xl font-black shadow-xl shadow-indigo-100 active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2">
          {loading ? (
            <>
              <Icons.Loader2 className="animate-spin" size={16} />
              Ngepres & Upload...
            </>
          ) : "Simpan Produk"}
        </button>
      </form>
    </div>
  )
}