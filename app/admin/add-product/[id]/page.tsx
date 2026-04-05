"use client"

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
    ArrowLeft, ImagePlus, Loader2, Navigation,
    Check, Search, ExternalLink, MapPin, X, Info, ChevronDown, Package, ShoppingBag, Globe, Zap, Edit3, Coins
} from "lucide-react";
import imageCompression from 'browser-image-compression';
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";

export default function EditProductPage() {
    const router = useRouter();
    const params = useParams();
    const productId = params.id as string;

    const [categories, setCategories] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [detecting, setDetecting] = useState(false);
    const [files, setFiles] = useState<(File | null)[]>([null, null, null]);
    const [previews, setPreviews] = useState<string[]>(["", "", ""]);
    const [isReady, setIsReady] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        price: "",
        original_price: "",
        description: "",
        location: "",
        stock: "",
        points_reward: "",
        latitude: null as number | null,
        longitude: null as number | null
    });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const { data: catData } = await supabase.from("categories").select("id, name");
                if (catData) setCategories(catData);

                const { data: p, error } = await supabase
                    .from("products")
                    .select("*")
                    .eq("id", productId)
                    .single();

                if (error) throw error;

                if (p) {
                    setFormData({
                        name: p.name || "",
                        price: p.price?.toString() || "",
                        original_price: p.original_price?.toString() || "",
                        description: p.description || "",
                        location: p.location || "",
                        stock: p.stock?.toString() || "",
                        points_reward: p.points_reward?.toString() || "0",
                        latitude: p.latitude,
                        longitude: p.longitude
                    });
                    setSelectedCategory(p.category_id);
                    setIsReady(!!p.is_ready);

                    if (p.image_url) {
                        const urls = Array.isArray(p.image_url) ? p.image_url : [p.image_url];
                        const newPreviews = ["", "", ""];
                        urls.forEach((url: string, i: number) => { if (i < 3) newPreviews[i] = url; });
                        setPreviews(newPreviews);
                    }
                }
            } catch (error: any) {
                toast.error("Gagal memuat produk: " + error.message);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [productId]);

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
            (error) => {
                toast.error("Gagal mendeteksi lokasi.");
                setDetecting(false);
            }
        );
    };

    const searchLocationByText = async () => {
        if (!formData.location || formData.location.length < 3) {
            return toast.error("Masukkan minimal 3 karakter untuk mencari");
        }
        setDetecting(true);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(formData.location)}&limit=1`);
            const data = await res.json();
            if (data && data.length > 0) {
                const spot = data[0];
                setFormData(prev => ({
                    ...prev,
                    latitude: parseFloat(spot.lat),
                    longitude: parseFloat(spot.lon),
                    location: spot.display_name.split(',')[0]
                }));
                toast.success("Lokasi ditemukan!");
            } else {
                toast.error("Lokasi tidak ditemukan. Coba kata kunci lain.");
            }
        } catch (err) {
            toast.error("Error saat mencari lokasi.");
        } finally {
            setDetecting(false);
        }
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
        setSaving(true);

        try {
            let uploadedUrls = [...previews].filter(url => url && url.startsWith('http'));
            const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true };

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
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

                    if (i < uploadedUrls.length) {
                        uploadedUrls[i] = publicUrl;
                    } else {
                        uploadedUrls.push(publicUrl);
                    }
                }
            }

            const { error: productError } = await supabase
                .from("products")
                .update({
                    name: formData.name,
                    price: parseFloat(formData.price),
                    original_price: formData.original_price ? parseFloat(formData.original_price) : null,
                    image_url: uploadedUrls,
                    description: formData.description,
                    location: formData.location,
                    stock: parseInt(formData.stock),
                    points_reward: parseInt(formData.points_reward || "0"),
                    category_id: selectedCategory,
                    latitude: formData.latitude,
                    longitude: formData.longitude,
                    is_ready: isReady
                })
                .eq("id", productId);

            if (productError) throw productError;

            toast.success("Produk berhasil diperbarui!");
            router.push("/admin/add-product");
        } catch (error: any) {
            toast.error("Error: " + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
                <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} strokeWidth={2.5} />
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Sinkronisasi Data...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans max-w-md mx-auto pb-32 selection:bg-indigo-100">

            {/* HEADER PREMIUM */}
            <div className="bg-white sticky top-0 z-40 border-b border-slate-100/60 backdrop-blur-md bg-white/80">
                <div className="px-5 pt-12 pb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.push('/admin/add-product')} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                            <ArrowLeft size={20} strokeWidth={2.5} />
                        </button>
                        <div>
                            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">Edit Produk</h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Modifikasi Katalog</p>
                        </div>
                    </div>
                    <Edit3 size={20} className="text-slate-300" />
                </div>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-5">

                {/* READY STATUS PREMIUM TOGGLE */}
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between overflow-hidden relative group">
                    <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-emerald-50/50 to-transparent -z-0 transition-opacity ${isReady ? 'opacity-100' : 'opacity-0'}`}></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isReady ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-300'}`}>
                            <Check size={20} strokeWidth={isReady ? 4 : 2} />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-slate-800 tracking-tight">Stok Ready?</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">{isReady ? 'Tayang di Jajanan Ready' : 'Tertutup di katalog'}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsReady(!isReady)}
                        className={`w-14 h-7 rounded-full relative transition-all duration-500 p-1 ${isReady ? 'bg-emerald-500 shadow-lg shadow-emerald-100' : 'bg-slate-200'}`}
                    >
                        <div className={`w-5 h-5 bg-white rounded-full shadow-md transition-all duration-500 ${isReady ? 'translate-x-7' : 'translate-x-0'}`}></div>
                    </button>
                </div>

                {/* IMAGE UPLOAD PREMIUM */}
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Galeri Produk</label>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        {previews.map((src, index) => (
                            <label
                                key={index}
                                className={`relative aspect-square rounded-[1.8rem] border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all duration-300 group ${src ? 'border-indigo-100' : 'border-slate-100 hover:border-indigo-300 hover:bg-slate-50'}`}
                            >
                                {src ? (
                                    <img src={src} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="preview" />
                                ) : (
                                    <div className="text-center flex flex-col items-center justify-center">
                                        <div className={`p-2 rounded-xl transition-colors ${index === 0 ? 'bg-indigo-50 text-indigo-400' : 'bg-slate-50 text-slate-300'}`}>
                                            <ImagePlus size={18} strokeWidth={2.5} />
                                        </div>
                                    </div>
                                )}
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(index, e)} />
                            </label>
                        ))}
                    </div>
                </div>

                {/* CORE DETAILS PREMIUM */}
                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-slate-50 text-slate-400 rounded-2xl"><Package size={20} strokeWidth={2.5} /></div>
                        <div>
                            <h3 className="text-base font-black text-slate-800 tracking-tight">Detail Utama</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Update info katalog</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Produk</label>
                            <input
                                type="text"
                                placeholder="..."
                                value={formData.name}
                                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all font-sans"
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Harga Jual</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">Rp</span>
                                    <input
                                        type="number"
                                        value={formData.price}
                                        className="w-full pl-10 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all"
                                        onChange={e => setFormData({ ...formData, price: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Stok Inventori</label>
                                <input
                                    type="number"
                                    value={formData.stock}
                                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all"
                                    onChange={e => setFormData({ ...formData, stock: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-1.5 col-span-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Poin Reward Pembelian</label>
                                <div className="relative">
                                    <Coins className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        type="number"
                                        placeholder="Contoh: 100"
                                        value={formData.points_reward}
                                        className="w-full pl-10 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all font-sans"
                                        onChange={e => setFormData({ ...formData, points_reward: e.target.value })}
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-indigo-500 uppercase tracking-widest">Poin</span>
                                </div>
                                <p className="text-[9px] text-slate-400 font-bold mt-1 px-1 italic">User akan mendapatkan poin ini setelah pesanan selesai.</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* LOGISTICS PREMIUM */}
                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-slate-50 text-slate-400 rounded-2xl"><Globe size={20} strokeWidth={2.5} /></div>
                        <div>
                            <h3 className="text-base font-black text-slate-800 tracking-tight">Logistik & Area</h3>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Area / Desa</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={formData.location}
                                    className="w-full pl-5 pr-24 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all"
                                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                                    required
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={searchLocationByText}
                                        className="p-2 bg-white text-slate-400 hover:text-indigo-600 rounded-xl border border-slate-100 hover:border-indigo-100 transition-all"
                                    >
                                        {detecting ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} strokeWidth={2.5} />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={detectLocation}
                                        className="p-2 bg-white text-slate-400 hover:text-emerald-600 rounded-xl border border-slate-100 hover:border-emerald-100 transition-all"
                                    >
                                        {detecting ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} strokeWidth={2.5} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                 {/* CLASSIFICATION PREMIUM */}
                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                    <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pilih Klasifikasi</label>
                </div>
                <div className="flex flex-wrap gap-2">
                    {categories.map((cat) => (
                    <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${selectedCategory === cat.id
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100"
                        : "bg-slate-50 text-slate-400 border-slate-100 hover:bg-white hover:border-slate-300"
                        }`}
                    >
                        {cat.name}
                    </button>
                    ))}
                </div>
                </div>

                {/* DESCRIPTION PREMIUM */}
                <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 ml-1">
                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                    Story & Spesifikasi
                </label>
                <textarea
                    placeholder="..."
                    value={formData.description}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-[1.8rem] h-32 text-sm font-bold outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 transition-all resize-none placeholder:text-slate-300 leading-relaxed"
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
                </div>

                {/* ACTION PREMIUM */}
                <div className="pt-2">
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full bg-indigo-600 p-5 rounded-3xl text-white font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98] disabled:bg-slate-200 disabled:shadow-none flex items-center justify-center gap-3"
                    >
                        {saving ? <Loader2 size={24} className="animate-spin" /> : <Zap size={24} className="fill-white" />}
                        {saving ? "Memperbarui..." : "Simpan Perubahan"}
                    </button>
                </div>
            </form>
        </div>
    );
}
