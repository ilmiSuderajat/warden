"use client"

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft, ImagePlus, Loader2, Navigation,
  Check, Plus, MapPin, Package, Tag, Type, FileText, MapPinned
} from "lucide-react";
import imageCompression from 'browser-image-compression';
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function AddMenuPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [fetchingShop, setFetchingShop] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [files, setFiles] = useState<(File | null)[]>([null, null, null]);
  const [previews, setPreviews] = useState<string[]>(["", "", ""]);
  const [isReady, setIsReady] = useState(true);
  const [shop, setShop] = useState<any>(null);

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
    const initPage = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push("/login");

      const { data: shopData } = await supabase
        .from("shops")
        .select("*")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!shopData) {
        toast.error("Anda belum memiliki warung");
        return router.push("/shop/create");
      }
      setShop(shopData);

      setFormData(prev => ({
        ...prev,
        location: shopData.address || "",
        latitude: shopData.latitude || null,
        longitude: shopData.longitude || null
      }));

      const { data: catData } = await supabase.from("categories").select("id, name");
      if (catData) setCategories(catData);
      setFetchingShop(false);
    };
    initPage();
  }, [router]);

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
          const desa = address.village || address.suburb || address.hamlet || address.neighbourhood || address.town || address.city || "Lokasi tidak terdeteksi";
          setFormData(prev => ({ ...prev, location: desa, latitude, longitude }));
          toast.success(`Lokasi terdeteksi: ${desa}`);
        } catch (err) {
          toast.error("Gagal mendeteksi lokasi.");
        } finally {
          setDetecting(false);
        }
      },
      () => {
        toast.error("Izin lokasi ditolak.");
        setDetecting(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
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
    if (!shop) return toast.error("Data warung tidak ditemukan!");
    setLoading(true);

    const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true };

    try {
      const uploadedUrls: string[] = [];
      for (const file of files) {
        if (file) {
          const compressedFile = await imageCompression(file, options);
          const fileExt = file.name.split('.').pop();
          const fileName = `${shop.id}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

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
          longitude: formData.longitude,
          is_ready: isReady,
          shop_id: shop.id
        }]);

      if (productError) throw productError;

      toast.success("Menu berhasil ditambahkan!");
      router.push("/shop/dashboard/menu");
    } catch (error: any) {
      toast.error("Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetchingShop) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-zinc-900" size={28} />
          <span className="text-sm text-zinc-500 font-medium">Memuat Data...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans max-w-md mx-auto pb-32">

      {/* FLOATING HEADER */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-lg border-b border-zinc-100/80 h-14 flex items-center px-4 max-w-md mx-auto">
        <button onClick={() => router.back()} className="p-2 -ml-2 text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors">
          <ArrowLeft size={20} strokeWidth={2.5} />
        </button>
        <h1 className="text-base font-bold text-zinc-900 tracking-tight ml-2">Tambah Menu Baru</h1>
      </nav>

      <form onSubmit={handleSubmit} className="pt-20 px-4 space-y-4">

        {/* IMAGE UPLOADER */}
        <div className="bg-white rounded-2xl p-4 border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <ImagePlus size={16} className="text-zinc-400" />
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Foto Produk</label>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {previews.map((src, index) => (
              <label
                key={index}
                className={`relative aspect-square bg-zinc-50 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all group ${index === 0 ? 'border-zinc-300' : 'border-zinc-100 hover:border-zinc-200'}`}
              >
                {src ? (
                  <img src={src} className="w-full h-full object-cover" alt="preview" />
                ) : (
                  <div className="text-center flex flex-col items-center justify-center group-hover:scale-105 transition-transform">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${index === 0 ? 'bg-zinc-900 text-white' : 'bg-zinc-200 text-zinc-500'}`}>
                      {index === 0 ? <Check size={14} /> : <Plus size={14} />}
                    </div>
                    {index === 0 && <span className="text-[9px] font-bold text-zinc-500 uppercase">Sampul</span>}
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(index, e)} />
              </label>
            ))}
          </div>
          <p className="text-[10px] text-zinc-400 mt-3 text-center">Kotak pertama akan menjadi foto sampul utama</p>
        </div>

        {/* MAIN INFO */}
        <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Nama Menu</label>
            <div className="relative">
              <Type size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300" />
              <input
                type="text"
                placeholder="Contoh: Sate Maranggi Sapi"
                className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-transparent rounded-xl text-sm outline-none focus:bg-white focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100 transition-all text-zinc-800 font-medium"
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Harga (Rp)</label>
              <div className="relative">
                <Tag size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300" />
                <input
                  type="number"
                  placeholder="25000"
                  className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-transparent rounded-xl text-sm outline-none focus:bg-white focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100 transition-all text-zinc-800 font-bold"
                  onChange={e => setFormData({ ...formData, price: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Harga Coret</label>
              <input
                type="number"
                placeholder="30000"
                className="w-full px-4 py-3 bg-zinc-50 border border-transparent rounded-xl text-sm outline-none focus:bg-white focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100 transition-all text-zinc-400 font-medium"
                onChange={e => setFormData({ ...formData, original_price: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Stok Tersedia</label>
            <div className="relative">
              <Package size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300" />
              <input
                type="number"
                placeholder="99"
                className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-transparent rounded-xl text-sm outline-none focus:bg-white focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100 transition-all text-zinc-800 font-medium"
                onChange={e => setFormData({ ...formData, stock: e.target.value })}
                required
              />
            </div>
          </div>
        </div>

        {/* LOCATION */}
        <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm space-y-3">
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Lokasi Produk</label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300" />
              <input
                type="text"
                placeholder="Nama desa / alamat"
                className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-transparent rounded-xl text-sm outline-none focus:bg-white focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100 transition-all text-zinc-800 font-medium"
                value={formData.location}
                onChange={e => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
            <button
              type="button"
              onClick={detectLocation}
              disabled={detecting}
              className="p-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl transition-colors disabled:bg-zinc-300 shrink-0"
            >
              {detecting ? <Loader2 size={18} className="animate-spin" /> : <Navigation size={18} />}
            </button>
          </div>
        </div>

        {/* CATEGORY */}
        <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm">
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">Kategori</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${selectedCategory === cat.id
                    ? "bg-zinc-900 text-white border-zinc-900 shadow-sm"
                    : "bg-zinc-50 text-zinc-500 border-zinc-100 hover:border-zinc-200"
                  }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* DESCRIPTION */}
        <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={14} className="text-zinc-400" />
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Deskripsi</label>
          </div>
          <textarea
            placeholder="Jelaskan kelezatan menumu..."
            className="w-full px-4 py-3 bg-zinc-50 border border-transparent rounded-xl h-32 text-sm outline-none focus:bg-white focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100 transition-all resize-none placeholder:text-zinc-300 text-zinc-600 font-medium"
            onChange={e => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        {/* VISIBILITY TOGGLE */}
        <div className="bg-white rounded-2xl p-4 border border-zinc-100 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isReady ? 'bg-emerald-50' : 'bg-zinc-100'}`}>
              <Check className={`size-5 ${isReady ? 'text-emerald-500' : 'text-zinc-400'}`} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-800">Status Produk</h3>
              <p className="text-[10px] text-zinc-400 font-medium">{isReady ? "Produk aktif dan bisa dipesan" : "Disembunyikan sementara"}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsReady(!isReady)}
            className={`w-12 h-6 rounded-full relative transition-all duration-300 ${isReady ? 'bg-emerald-500' : 'bg-zinc-200'}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${isReady ? 'right-0.5' : 'left-0.5'}`}></div>
          </button>
        </div>
      </form>

      {/* STICKY BOTTOM BAR */}
      <div className="fixed bottom-0 inset-x-0 z-50 bg-white/80 backdrop-blur-xl border-t border-zinc-200/50 max-w-md mx-auto p-4">
        <button
          disabled={loading}
          className="w-full bg-zinc-900 hover:bg-zinc-800 text-white py-4 rounded-2xl font-bold text-sm transition-all active:scale-[0.98] disabled:bg-zinc-300 shadow-lg shadow-zinc-900/10 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>Menyimpan...</span>
            </>
          ) : (
            <>
              <Plus size={18} strokeWidth={3} />
              <span>Simpan Menu</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}