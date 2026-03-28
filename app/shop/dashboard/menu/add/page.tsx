"use client"

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft, ImagePlus, Loader2,
  Check, Plus, Package, Tag, Type, FileText, Trash2, ListPlus
} from "lucide-react";
import imageCompression from 'browser-image-compression';
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface VariantOption {
  label: string;
  price: number;
}

interface VariantGroup {
  name: string;
  options: VariantOption[];
}

interface ProductFormData {
  name: string;
  price: string;
  original_price: string;
  description: string;
  stock: string;
}

const DRAFT_KEY = "menuDraft_v1";

export default function AddMenuPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [fetchingShop, setFetchingShop] = useState(true);
  
  const [files, setFiles] = useState<(File | null)[]>([null, null, null]);
  const [previews, setPreviews] = useState<string[]>(["", "", ""]);
  const [uploadingImageIndices, setUploadingImageIndices] = useState<boolean[]>([false, false, false]);
  
  const [isReady, setIsReady] = useState(true);
  const [shop, setShop] = useState<any>(null);

  const [formData, setFormData] = useState<ProductFormData>({
    name: "",
    price: "",
    original_price: "",
    description: "",
    stock: "",
  });

  const [variants, setVariants] = useState<VariantGroup[]>([]);

  // Format Helper Realtime
  const formatRupiah = (value: string | number) => {
    if (!value) return "";
    const numericStr = value.toString().replace(/[^0-9]/g, '');
    if (!numericStr) return "";
    return new Intl.NumberFormat("id-ID").format(parseInt(numericStr));
  };

  // Load Initial Data & Draft
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

      const { data: catData } = await supabase.from("categories").select("id, name");
      if (catData) setCategories(catData);
      
      // Load Draft
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.formData) setFormData(parsed.formData);
          if (parsed.variants) setVariants(parsed.variants);
          if (parsed.selectedCategory) setSelectedCategory(parsed.selectedCategory);
          if (typeof parsed.isReady === 'boolean') setIsReady(parsed.isReady);
        } catch (e) {
          console.error("Gagal memuat auto save draft", e);
        }
      }
      
      setFetchingShop(false);
    };
    initPage();
  }, [router]);

  // Auto Save Draft
  useEffect(() => {
    if (!fetchingShop && shop) {
      const draft = { formData, variants, selectedCategory, isReady };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }
  }, [formData, variants, selectedCategory, isReady, fetchingShop, shop]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("imageIndex", index.toString());
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    const sourceIndex = parseInt(e.dataTransfer.getData("imageIndex"));
    if (sourceIndex === targetIndex || isNaN(sourceIndex)) return;

    const newFiles = [...files];
    const newPreviews = [...previews];
    
    // Swap files
    const tempFile = newFiles[sourceIndex];
    newFiles[sourceIndex] = newFiles[targetIndex];
    newFiles[targetIndex] = tempFile;

    // Swap previews
    const tempPreview = newPreviews[sourceIndex];
    newPreviews[sourceIndex] = newPreviews[targetIndex];
    newPreviews[targetIndex] = tempPreview;

    setFiles(newFiles);
    setPreviews(newPreviews);
  };

  const handleFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Ukuran file maksimal 5MB");
        return;
      }
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

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s-]+/g, '-');
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      toast.error("Nama menu wajib diisi");
      return false;
    }
    const rawPrice = parseInt(formData.price.replace(/[^0-9]/g, '') || "0");
    if (rawPrice <= 0) {
      toast.error("Harga harus lebih dari 0");
      return false;
    }
    const rawStock = parseInt(formData.stock.replace(/[^0-9]/g, '') || "0");
    if (rawStock < 0 || isNaN(rawStock)) {
      toast.error("Stok harus lebih atau sama dengan 0");
      return false;
    }
    if (!files[0]) {
      toast.error("Wajib mengunggah foto sampul di kotak pertama (index 0)");
      return false;
    }
    if (!selectedCategory) {
      toast.error("Kategori wajib dipilih");
      return false;
    }

    for (const group of variants) {
      if (!group.name.trim()) {
        toast.error("Nama grup varian tidak boleh kosong");
        return false;
      }
      if (group.options.length === 0) {
        toast.error(`Grup varian "${group.name}" harus memiliki minimal 1 opsi`);
        return false;
      }
      for (const opt of group.options) {
        if (!opt.label.trim()) {
          toast.error(`Nama opsi pada varian "${group.name}" tidak boleh kosong`);
          return false;
        }
        if (opt.price < 0) {
          toast.error(`Harga tambahan opsi "${opt.label}" pada varian "${group.name}" tidak valid`);
          return false;
        }
      }
    }
    return true;
  };

  const handleUploadImages = async () => {
    const uploadedUrls: string[] = [];
    const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file) {
        // Set loading state for this specific image index
        setUploadingImageIndices(prev => {
          const newArr = [...prev];
          newArr[i] = true;
          return newArr;
        });

        try {
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
        } catch (err: any) {
          throw new Error(`Gagal mengunggah gambar ${i + 1}: ${err.message}`);
        } finally {
          setUploadingImageIndices(prev => {
            const newArr = [...prev];
            newArr[i] = false;
            return newArr;
          });
        }
      }
    }
    return uploadedUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (!shop) return toast.error("Data warung tidak ditemukan!");
    
    setLoading(true);

    try {
      // 1. Upload Images
      const uploadedUrls = await handleUploadImages();
      
      if (uploadedUrls.length === 0) {
         throw new Error("Gagal mengunggah foto. Pastikan ada foto sampul.");
      }

      // 2. Insert to Database
      const slug = generateSlug(formData.name);
      const { error: productError } = await supabase
        .from("products")
        .insert([{
          name: formData.name,
          slug: slug,
          price: parseInt(formData.price.replace(/[^0-9]/g, '')),
          original_price: formData.original_price ? parseInt(formData.original_price.replace(/[^0-9]/g, '')) : null,
          image_url: uploadedUrls,
          description: formData.description,
          stock: parseInt(formData.stock.replace(/[^0-9]/g, '')),
          category_id: selectedCategory,
          is_ready: isReady,
          shop_id: shop.id,
          variants: variants.length > 0 ? variants : null // Simpan sebagai JSONB
        }]);

      if (productError) throw new Error("Gagal menyimpan ke database: " + productError.message);

      // Clean up draft & Redirect
      localStorage.removeItem(DRAFT_KEY);
      toast.success("Menu berhasil ditambahkan!");
      router.push("/shop/dashboard/menu");
      
    } catch (error: any) {
      toast.error(error.message || "Terjadi kesalahan sistem, silakan coba lagi.");
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
            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Foto Produk (Maks 3)</label>
          </div>
          <p className="text-[10px] text-zinc-400 mb-3">Tahan & geser (drag & drop) gambar untuk mengubah urutan.</p>
          <div className="grid grid-cols-3 gap-3">
            {previews.map((src, index) => (
              <label
                key={index}
                draggable={src !== ""}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, index)}
                className={`relative aspect-square bg-zinc-50 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all group 
                ${index === 0 ? 'border-zinc-300' : 'border-zinc-100 hover:border-zinc-200'}
                ${src ? 'cursor-grab active:cursor-grabbing' : ''}`}
              >
                {uploadingImageIndices[index] ? (
                  <div className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center z-10">
                    <Loader2 className="animate-spin text-zinc-900 mb-1" size={18} />
                    <span className="text-[9px] font-bold text-zinc-600">Mengunggah...</span>
                  </div>
                ) : null}

                {src ? (
                  <>
                    <img src={src} className="w-full h-full object-cover" alt="preview" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <span className="text-white text-[10px] font-bold uppercase tracking-wider">Ganti</span>
                    </div>
                  </>
                ) : (
                  <div className="text-center flex flex-col items-center justify-center group-hover:scale-105 transition-transform">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${index === 0 ? 'bg-zinc-900 text-white' : 'bg-zinc-200 text-zinc-500'}`}>
                      {index === 0 ? <Check size={14} /> : <Plus size={14} />}
                    </div>
                    {index === 0 && <span className="text-[9px] font-bold text-zinc-500 uppercase">Sampul</span>}
                  </div>
                )}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleFileChange(index, e)} />
              </label>
            ))}
          </div>
        </div>

        {/* MAIN INFO */}
        <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Nama Menu *</label>
            <div className="relative">
              <Type size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300" />
              <input
                type="text"
                placeholder="Contoh: Sate Maranggi Sapi"
                className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-transparent rounded-xl text-sm outline-none focus:bg-zinc-50 focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100 transition-all text-zinc-800 font-medium"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            {formData.name && <p className="text-[10px] text-zinc-400 mt-2 ml-1">Slug: {generateSlug(formData.name)}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Harga (Rp) *</label>
              <div className="relative">
                <Tag size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300" />
                <input
                  type="text"
                  placeholder="25.000"
                  className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-transparent rounded-xl text-sm outline-none focus:bg-zinc-50 focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100 transition-all text-zinc-800 font-bold"
                  value={formData.price}
                  onChange={e => setFormData({ ...formData, price: formatRupiah(e.target.value) })}
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Harga Coret</label>
              <input
                type="text"
                placeholder="30.000"
                className="w-full px-4 py-3 bg-zinc-50 border border-transparent rounded-xl text-sm outline-none focus:bg-zinc-50 focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100 transition-all text-zinc-400 font-medium"
                value={formData.original_price}
                onChange={e => setFormData({ ...formData, original_price: formatRupiah(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">Stok Tersedia *</label>
            <div className="relative">
              <Package size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-300" />
              <input
                type="text"
                inputMode="numeric"
                placeholder="99"
                className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-transparent rounded-xl text-sm outline-none focus:bg-zinc-50 focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100 transition-all text-zinc-800 font-medium"
                value={formData.stock}
                onChange={e => setFormData({ ...formData, stock: formatRupiah(e.target.value) })}
                required
              />
            </div>
          </div>
        </div>

        {/* MULTI VARIANT SYSTEM */}
        <div className="bg-white rounded-2xl p-4 border border-zinc-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
               <ListPlus size={16} className="text-zinc-400" />
               <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Varian & Tambahan Opsional</label>
            </div>
            <button
              type="button"
              onClick={() => setVariants([...variants, { name: "", options: [{ label: "", price: 0 }] }])}
              className="text-[10px] font-bold text-zinc-900 bg-zinc-100 hover:bg-zinc-200 px-3 py-1.5 rounded-[10px] transition-colors"
            >
              + Buat Grup Varian
            </button>
          </div>

          {variants.length === 0 ? (
             <div className="text-center py-6 px-4 bg-zinc-50 rounded-xl border border-dashed border-zinc-200">
                <p className="text-xs text-zinc-400">Belum ada varian produk. Klik tombol di atas untuk menambah varian seperti Ukuran, Level Pedas, atau Topping.</p>
             </div>
          ) : (
            <div className="space-y-4">
              {variants.map((group, gIndex) => (
                <div key={gIndex} className="p-4 border border-zinc-200 bg-zinc-50 rounded-xl relative">
                  <button 
                    type="button" 
                    onClick={() => setVariants(variants.filter((_, i) => i !== gIndex))}
                    className="absolute top-4 right-4 text-red-400 hover:text-red-600 transition-colors p-1"
                    title="Hapus Grup Varian"
                  >
                    <Trash2 size={16} />
                  </button>

                  <div className="pr-8 mb-4">
                    <label className="block text-xs font-bold text-zinc-700 mb-1">Nama Grup Varian</label>
                    <input 
                      type="text" 
                      placeholder="Contoh: Ukuran, Level Pedas, Topping"
                      value={group.name}
                      onChange={(e) => {
                        const newVariants = [...variants];
                        newVariants[gIndex].name = e.target.value;
                        setVariants(newVariants);
                      }}
                      className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm outline-none focus:border-zinc-400"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-zinc-700 mb-2">Pilihan Opsi</label>
                    {group.options.map((opt, oIndex) => (
                        <div key={oIndex} className="flex gap-2 items-center mb-2">
                          <input 
                            type="text"
                            placeholder="Nama opsi (Misal: Besar)"
                            value={opt.label}
                            onChange={(e) => {
                              const newVariants = [...variants];
                              newVariants[gIndex].options[oIndex].label = e.target.value;
                              setVariants(newVariants);
                            }}
                            className="flex-1 px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm outline-none focus:border-zinc-400"
                          />
                          <div className="relative w-[130px] shrink-0">
                             <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm font-medium">+</span>
                             <input 
                              type="text"
                              placeholder="Harga (Opsional)"
                              value={opt.price ? formatRupiah(opt.price) : ""}
                              onChange={(e) => {
                                const numericValue = e.target.value.replace(/[^0-9]/g, '');
                                const newVariants = [...variants];
                                newVariants[gIndex].options[oIndex].price = numericValue ? parseInt(numericValue) : 0;
                                setVariants(newVariants);
                              }}
                              className="w-full pl-7 pr-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm outline-none focus:border-zinc-400"
                             />
                          </div>
                          
                          <button 
                            type="button" 
                            disabled={group.options.length <= 1}
                            onClick={() => {
                              if (group.options.length > 1) {
                                const newVariants = [...variants];
                                newVariants[gIndex].options = newVariants[gIndex].options.filter((_, i) => i !== oIndex);
                                setVariants(newVariants);
                              }
                            }} 
                            className={`p-2 rounded-lg transition-colors ${group.options.length <= 1 ? 'text-zinc-300' : 'text-red-400 hover:text-red-600 hover:bg-red-50'}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                    ))}
                    <button 
                        type="button"
                        onClick={() => {
                          const newVariants = [...variants];
                          newVariants[gIndex].options.push({ label: "", price: 0 });
                          setVariants(newVariants);
                        }}
                        className="text-xs font-semibold text-zinc-600 border border-dashed border-zinc-300 w-full py-2 rounded-lg hover:bg-zinc-100 transition-colors mt-2"
                    >
                        + Tambah Opsi
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CATEGORY */}
        <div className="bg-white rounded-2xl p-5 border border-zinc-100 shadow-sm">
          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">Kategori *</label>
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
            className="w-full px-4 py-3 bg-zinc-50 border border-transparent rounded-xl h-32 text-sm outline-none focus:bg-zinc-50 focus:border-zinc-300 focus:ring-2 focus:ring-zinc-100 transition-all resize-none placeholder:text-zinc-300 text-zinc-600 font-medium"
            value={formData.description}
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
          onClick={handleSubmit}
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