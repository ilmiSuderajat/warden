"use client"

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, ImagePlus, Loader2, Navigation, Check, Plus } from "lucide-react";
import imageCompression from 'browser-image-compression';
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function AddProductPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
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
    stock: "",
    latitude: null as number | null,
    longitude: null as number | null
  });

  useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await supabase.from("categories").select("id, name");
      if (data) setCategories(data);
    };
    fetchCategories();
  }, []);

  const detectLocation = () => {
    setDetecting(true);
    if (!navigator.geolocation) {
      toast.error("Browser tidak mendukung lokasi.");
      setDetecting(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await res.json();
          const address = data.address;
          const desa = address.village || address.suburb || address.hamlet || address.neighbourhood || address.town || "Lokasi tidak terdeteksi";
          setFormData(prev => ({ ...prev, location: desa, latitude, longitude }));
        } catch (err) {
          toast.error("Gagal mendeteksi lokasi.");
        } finally {
          setDetecting(false);
        }
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error("Izin lokasi ditolak.");
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error("Informasi lokasi tidak tersedia.");
            break;
          case error.TIMEOUT:
            toast.error("Waktu deteksi lokasi habis.");
            break;
          default:
            toast.error("Terjadi kesalahan yang tidak diketahui saat mendeteksi lokasi.");
            break;
        }
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
    if (!selectedCategory) return toast.error("Pilih kategori dulu!");
    setLoading(true);

    const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true };

    try {
      const uploadedUrls: string[] = [];
      for (const file of files) {
        if (file) {
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

      const { error: productError } = await supabase
        .from("products")
        .insert([{
          name: formData.name,
          price: parseFloat(formData.price),
          original_price: formData.original_price ? parseFloat(formData.original_price) : null,
          image_url: uploadedUrls,
          description: formData.description,
          location: formData.location,
          stock: parseInt(formData.stock),
          category_id: selectedCategory,
          latitude: formData.latitude,
          longitude: formData.longitude
        }]);

      if (productError) throw productError;

      toast.success("Produk berhasil ditambahkan!");
      router.push("/admin"); // Kembali ke dashboard admin
    } catch (error: any) {
      toast.error("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/80 font-sans max-w-md mx-auto pb-32">

      {/* HEADER */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="flex items-center justify-between px-5 pt-12 pb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
              <ArrowLeft size={20} strokeWidth={2.5} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Tambah Produk</h1>
              <p className="text-[10px] font-medium text-slate-400">Masukkan detail produk baru</p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-5">

        {/* UPLOAD FOTO */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Foto Produk</label>
          <div className="grid grid-cols-3 gap-3">
            {previews.map((src, index) => (
              <label
                key={index}
                className={`relative aspect-square bg-slate-50 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all hover:border-slate-300 hover:bg-slate-100 ${index === 0 ? 'border-indigo-200 bg-indigo-50/50' : 'border-slate-200'}`}
              >
                {src ? (
                  <img src={src} className="w-full h-full object-cover" alt="preview" />
                ) : (
                  <div className="text-center flex flex-col items-center justify-center">
                    <ImagePlus size={20} className={`${index === 0 ? 'text-indigo-300' : 'text-slate-300'} mb-1`} />
                    {index === 0 && <span className="text-[8px] font-bold text-indigo-400 uppercase">Utama</span>}
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(index, e)} />
              </label>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-3 text-center">Kotak pertama adalah foto utama</p>
        </div>

        {/* INFO UTAMA */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Nama Produk</label>
            <input
              type="text"
              placeholder="Contoh: Donsu Warden"
              className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900 transition-all placeholder:text-slate-300"
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Harga Jual (Rp)</label>
              <input
                type="number"
                placeholder="100.000"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-slate-900 transition-all placeholder:text-slate-300"
                onChange={e => setFormData({ ...formData, price: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Harga Coret (Rp)</label>
              <input
                type="number"
                placeholder="150.000"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-slate-900 transition-all placeholder:text-slate-300"
                onChange={e => setFormData({ ...formData, original_price: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Lokasi</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Deteksi otomatis"
                  value={formData.location}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-slate-900 transition-all placeholder:text-slate-300 pr-10"
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  required
                />
                <button
                  type="button"
                  onClick={detectLocation}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {detecting ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Stok</label>
              <input
                type="number"
                placeholder="Jumlah stok"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-slate-900 transition-all placeholder:text-slate-300"
                onChange={e => setFormData({ ...formData, stock: e.target.value })}
                required
              />
            </div>
          </div>
        </div>

        {/* KATEGORI */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Kategori</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${selectedCategory === cat.id
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                  }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* DESKRIPSI */}
        <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Deskripsi</label>
          <textarea
            placeholder="Tulis deskripsi produk di sini..."
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl h-28 text-sm outline-none focus:ring-1 focus:ring-slate-900 transition-all resize-none placeholder:text-slate-300"
            onChange={e => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        {/* SUBMIT BUTTON FLOATING */}
        <div className="mb-10 bg-white/80 backdrop-blur-lg border-t border-slate-100 p-5 max-w-md mx-auto z-50">
          <button
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:bg-slate-400 shadow-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>Simpan Produk</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}