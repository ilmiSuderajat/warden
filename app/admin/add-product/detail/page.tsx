"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import * as Icons from "lucide-react";
import imageCompression from 'browser-image-compression';

export default function AddProductPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [files, setFiles] = useState<(File | null)[]>([null, null, null]);
  const [previews, setPreviews] = useState<string[]>(["", "", ""]);
  
  const [formData, setFormData] = useState({ 
    name: "", 
    price: "", 
    original_price: "", 
    description: "",
    location: "", 
    stock: "" 
  });

  useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await supabase.from("categories").select("id, name");
      if (data) setCategories(data);
    };
    fetchCategories();
  }, []);

  // FUNGSI DETEKSI LOKASI OTOMATIS
 const detectLocation = () => {
    setDetecting(true);
    if (!navigator.geolocation) {
      alert("Browser kamu nggak dukung lokasi, Lur.");
      setDetecting(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          // Reverse Geocoding menggunakan OpenStreetMap
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await res.json();
          
          // AMBIL NAMA DESA / KELURAHAN
          // Kita cek satu-satu dari yang paling spesifik (desa/kelurahan)
          const address = data.address;
          const desa = address.village || address.suburb || address.hamlet || address.neighbourhood || address.town || "Desa Tidak Terdeteksi";
          
          setFormData(prev => ({ ...prev, location: desa }));
        } catch (err) {
          alert("Gagal menerjemahkan koordinat ke nama desa.");
        } finally {
          setDetecting(false);
        }
      },
      () => {
        alert("Izin lokasi ditolak, silakan ketik manual.");
        setDetecting(false);
      }
    );
  };
  const handleFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const newFiles = [...files];
      newFiles[index] = file;
      setFiles(newFiles);

      const reader = new FileReader();
      reader.onloadend = () => {
        const newPreviews = [...previews];
        newPreviews[index] = reader.result as string;
        setPreviews(newPreviews);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true };

    try {
      const uploadedUrls: string[] = [];
      for (const file of files) {
        if (file) {
          // Kompresi Gambar Otomatis
          const compressedFile = await imageCompression(file, options);
          const fileExt = file.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('product-images')
            .upload(fileName, compressedFile);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('product-images')
            .getPublicUrl(fileName);
          
          uploadedUrls.push(publicUrl);
        }
      }

      // Insert ke database
      const { data: newProduct, error: productError } = await supabase
        .from("products")
        .insert([{
          name: formData.name,
          price: parseFloat(formData.price),
          original_price: formData.original_price ? parseFloat(formData.original_price) : null,
          image_url: uploadedUrls,
          description: formData.description,
          location: formData.location,
          stock: parseInt(formData.stock)
        }])
        .select().single();

      if (productError) throw productError;

      if (selectedCategories.length > 0 && newProduct) {
        const junctionData = selectedCategories.map(catId => ({
          product_id: newProduct.id,
          category_id: catId
        }));
        await supabase.from("product_categories").insert(junctionData);
      }

      alert("Gaskeun! Produk sudah tayang!");
      window.location.reload();
    } catch (error: any) {
      alert("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen max-w-md mx-auto bg-gray-50 pb-20 font-sans">
      {/* HEADER */}
      <div className="bg-gray-50 px-6 py-8 mb-10 border-b shadow-sm border-gray-100">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 tracking-tight">Post Produk</h2>
            <p className="text-xs text-gray-800 font-medium mt-1">Isi detail jualanmu di sini, Lur.</p>
          </div>
          <div className="bg-gray-50 text-indigo-800 p-3 rounded-2xl">
            <Icons.Store size={24} />
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-md mx-auto px-4 -mt-6 space-y-4">
        {/* FOTO PRODUK */}
        <div className="bg-gray-50 p-4  shadow-xl shadow-gray-200/50 grid grid-cols-3 gap-3">
          {previews.map((src, index) => (
            <label key={index} className="relative aspect-square text-black bg-white rounded-2xl border-2 border-dashed border-gray-600 flex flex-col items-center justify-center cursor-pointer overflow-hidden hover:border-indigo-800 transition-all group">
              {src ? (
                <img src={src} className="w-full h-full object-cover" alt="preview" />
              ) : (
                <div className="text-center">
                  <Icons.ImagePlus size={20} className="text-gray-800 mx-auto group-hover:text-indigo-800" />
                  <span className="text-[8px] font-bold text-gray-800 mt-1 block uppercase">Foto {index + 1}</span>
                </div>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(index, e)} />
            </label>
          ))}
        </div>

        {/* INFO UTAMA */}
        <div className="bg-gray-50 p-6 shadow-xl shadow-gray-200/50 space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-800 uppercase ml-2 tracking-widest">Informasi Produk</label>
            <input type="text" placeholder="Nama Produk" className="w-full p-4 bg-white text-gray-800 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-600 border-none" 
              onChange={e => setFormData({...formData, name: e.target.value})} required />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <input type="number" placeholder="Harga Jual" className="p-4 bg-white text-gray-800 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 border-none" 
              onChange={e => setFormData({...formData, price: e.target.value})} required />
            <input type="number" placeholder="Harga Coret" className="p-4 bg-white text-gray-800 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 border-none" 
              onChange={e => setFormData({...formData, original_price: e.target.value})} />
          </div>

          {/* LOKASI & STOK */}
          <div className="grid grid-cols-2 gap-3 border-t border-gray-50 pt-4">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Lokasi" 
                value={formData.location}
                className="w-full p-4 pl-4 pr-12 bg-white text-gray-800 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 border-none" 
                onChange={e => setFormData({...formData, location: e.target.value})} required 
              />
              <button
                type="button"
                onClick={detectLocation}
                disabled={detecting}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-500 p-2 hover:bg-indigo-50 rounded-xl"
              >
                {detecting ? <Icons.Loader2 size={14} className="animate-spin" /> : <Icons.Navigation size={14} />}
              </button>
            </div>
            <div className="relative">
              <Icons.Box size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="number" placeholder="Stok" className="w-full p-4 pl-10 bg-white text-gray-800 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 border-none" 
                onChange={e => setFormData({...formData, stock: e.target.value})} required />
            </div>
          </div>

          <textarea placeholder="Deskripsi lengkap..." className="w-full p-4 bg-white text-gray-800 rounded-2xl h-24 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 border-none"
            onChange={e => setFormData({...formData, description: e.target.value})} />
        </div>

        {/* KATEGORI */}
        <div className="bg-white p-6 rounded-xl shadow-xl shadow-gray-200/50 space-y-3">
          <div className="flex items-center gap-2 px-1">
            <Icons.Tag size={14} className="text-indigo-600" />
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Kategori</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button key={cat.id} type="button" 
                onClick={() => selectedCategories.includes(cat.id) ? setSelectedCategories(selectedCategories.filter(id => id !== cat.id)) : setSelectedCategories([...selectedCategories, cat.id])}
                className={`px-4 py-2  text-[11px] font-bold transition-all border ${selectedCategories.includes(cat.id) ? "bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-100" : "bg-gray-50 border-gray-100 text-gray-400"}`}>
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <button disabled={loading} className="w-full bg-indigo-900 text-white py-5 rounded-xl font-black shadow-sm active:scale-95 transition-all text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3">
          {loading ? <Icons.Loader2 className="animate-spin" size={18} /> : "Simpan Produk Sekarang"}
        </button>
      </form>
    </div>
  );
}