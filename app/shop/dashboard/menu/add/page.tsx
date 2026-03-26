"use client"

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft, ImagePlus, Loader2, Navigation,
  Check, Plus, Search, Map as MapIcon,
  ExternalLink, MapPin
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
      
      // Auto-fill location from shop if available
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
          shop_id: shop.id // LINK TO SHOP
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
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <Loader2 className="animate-spin text-[#ee4d2d]" size={32} />
        </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/80 font-sans max-w-md mx-auto pb-32">
      {/* HEADER */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="flex items-center gap-3 px-5 h-14">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
            <ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Tambah Menu</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-5">
        {/* SNAPSHOT INFO */}
        <div className="bg-[#ee4d2d]/5 border border-[#ee4d2d]/10 p-4 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-[#ee4d2d] rounded-xl flex items-center justify-center shadow-lg shadow-[#ee4d2d]/20">
                <Check className="text-white" size={20} />
             </div>
             <div>
                <h3 className="text-sm font-bold text-slate-800 tracking-tight">Status Tampilan</h3>
                <p className="text-[10px] text-slate-400 font-medium italic">Produk langsung tayang di warungmu</p>
             </div>
          </div>
          <button
            type="button"
            onClick={() => setIsReady(!isReady)}
            className={`w-12 h-6 rounded-full relative transition-all duration-300 ${isReady ? 'bg-emerald-400' : 'bg-slate-200'}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ${isReady ? 'right-0.5' : 'left-0.5'}`}></div>
          </button>
        </div>

        {/* UPLOAD FOTO */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Foto Produk</label>
          <div className="grid grid-cols-3 gap-3">
            {previews.map((src, index) => (
              <label
                key={index}
                className={`relative aspect-square bg-slate-50 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all hover:border-[#ee4d2d]/30 hover:bg-[#ee4d2d]/5 ${index === 0 ? 'border-[#ee4d2d]/30 bg-[#ee4d2d]/5' : 'border-slate-100'}`}
              >
                {src ? (
                  <img src={src} className="w-full h-full object-cover" alt="preview" />
                ) : (
                  <div className="text-center flex flex-col items-center justify-center">
                    <ImagePlus size={20} className={`${index === 0 ? 'text-[#ee4d2d]/30' : 'text-slate-300'} mb-1`} />
                    {index === 0 && <span className="text-[8px] font-bold text-[#ee4d2d]/60 uppercase tracking-tighter">Utama</span>}
                  </div>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(index, e)} />
              </label>
            ))}
          </div>
        </div>

        {/* INFO DASAR */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-5">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Nama Menu</label>
            <input
              type="text"
              placeholder="Contoh: Sate Maranggi Sapi"
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:bg-white focus:border-[#ee4d2d] focus:ring-4 focus:ring-[#ee4d2d]/5 transition-all placeholder:text-slate-300 text-slate-800 font-medium"
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Harga (Rp)</label>
              <input
                type="number"
                placeholder="25000"
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:bg-white focus:border-[#ee4d2d] focus:ring-4 focus:ring-[#ee4d2d]/5 transition-all text-slate-800 font-bold"
                onChange={e => setFormData({ ...formData, price: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Harga Coret</label>
              <input
                type="number"
                placeholder="30000"
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:bg-white focus:border-[#ee4d2d] focus:ring-4 focus:ring-[#ee4d2d]/5 transition-all text-slate-400 decoration-slate-300"
                onChange={e => setFormData({ ...formData, original_price: e.target.value })}
              />
            </div>
          </div>
          
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Stok Masakan</label>
            <input
              type="number"
              placeholder="99"
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:bg-white focus:border-[#ee4d2d] focus:ring-4 focus:ring-[#ee4d2d]/5 transition-all text-slate-800 font-medium"
              onChange={e => setFormData({ ...formData, stock: e.target.value })}
              required
            />
          </div>
        </div>

        {/* KATEGORI */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Kategori</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${selectedCategory === cat.id
                  ? "bg-[#ee4d2d] text-white border-[#ee4d2d] shadow-lg shadow-[#ee4d2d]/20"
                  : "bg-slate-50 text-slate-500 border-slate-100 hover:border-slate-200"
                  }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* DESKRIPSI */}
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Deskripsi Menu</label>
          <textarea
            placeholder="Jelaskan kelezatan menumu..."
            className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-xl h-28 text-sm outline-none focus:bg-white focus:border-[#ee4d2d] focus:ring-4 focus:ring-[#ee4d2d]/5 transition-all resize-none placeholder:text-slate-300 text-slate-600 font-medium"
            onChange={e => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        {/* SUBMIT BUTTON */}
        <div className="pt-2">
          <button
            disabled={loading}
            className="w-full bg-[#ee4d2d] hover:bg-[#d73211] text-white py-4 rounded-2xl font-black text-sm transition-all active:scale-[0.98] disabled:bg-slate-300 shadow-xl shadow-[#ee4d2d]/20 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <Plus size={18} strokeWidth={3} />
                <span>Simpan ke Menu</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
