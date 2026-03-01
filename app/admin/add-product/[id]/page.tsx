"use client"

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
    ArrowLeft, ImagePlus, Loader2, Navigation,
    Check, Search, ExternalLink, MapPin
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
        latitude: null as number | null,
        longitude: null as number | null
    });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch Categories
                const { data: catData } = await supabase.from("categories").select("id, name");
                if (catData) setCategories(catData);

                // Fetch Product Data
                const { data: p, error } = await supabase
                    .from("products")
                    .select("*")
                    .eq("id", productId)
                    .single();

                if (error) throw error;

                if (p) {
                    const nameHasReady = p.name.includes("[READY]");
                    const cleanName = p.name.replace("[READY] ", "").replace("[READY]", "").trim();

                    setFormData({
                        name: cleanName,
                        price: p.price?.toString() || "",
                        original_price: p.original_price?.toString() || "",
                        description: p.description || "",
                        location: p.location || "",
                        stock: p.stock?.toString() || "",
                        latitude: p.latitude,
                        longitude: p.longitude
                    });
                    setSelectedCategory(p.category_id);
                    // Use the database field if available, otherwise fallback to the name check for backwards compatibility during transition
                    setIsReady(p.is_ready === true || nameHasReady);

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
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50/80 font-sans max-w-md mx-auto pb-32">
            <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
                <div className="flex items-center justify-between px-5 pt-12 pb-4">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                            <ArrowLeft size={20} strokeWidth={2.5} />
                        </button>
                        <div>
                            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Edit Produk</h1>
                            <p className="text-[10px] font-medium text-slate-400">Update detail produk kamu</p>
                        </div>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-5">
                {/* Toggle Ready */}
                <div className="bg-indigo-600 p-4 rounded-xl text-white shadow-lg shadow-indigo-100 flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold">Stok Ready?</h3>
                        <p className="text-[10px] text-white/70">Produk akan muncul di halaman Jajanan Ready</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsReady(!isReady)}
                        className={`w-12 h-6 rounded-full relative transition-colors ${isReady ? 'bg-emerald-400' : 'bg-white/20'}`}
                    >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isReady ? 'right-1' : 'left-1'}`}></div>
                    </button>
                </div>

                {/* UPLOAD FOTO */}
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Foto Produk</label>
                    <div className="grid grid-cols-3 gap-3">
                        {previews.map((src, index) => (
                            <label
                                key={index}
                                className={`relative aspect-square bg-slate-50 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all hover:border-slate-300 ${src ? 'border-indigo-100' : 'border-slate-200'}`}
                            >
                                {src ? (
                                    <img src={src} className="w-full h-full object-cover" alt="preview" />
                                ) : (
                                    <ImagePlus size={20} className="text-slate-300" />
                                )}
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(index, e)} />
                            </label>
                        ))}
                    </div>
                </div>

                {/* INFO UTAMA */}
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Nama Produk</label>
                        <input
                            type="text"
                            value={formData.name}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-slate-900 transition-all"
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Harga (Rp)</label>
                            <input
                                type="number"
                                value={formData.price}
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-slate-900 transition-all"
                                onChange={e => setFormData({ ...formData, price: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Stok</label>
                            <input
                                type="number"
                                value={formData.stock}
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-slate-900 transition-all"
                                onChange={e => setFormData({ ...formData, stock: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Lokasi</label>
                        <div className="relative group">
                            <input
                                type="text"
                                value={formData.location}
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-slate-900 transition-all pr-12"
                                onChange={e => setFormData({ ...formData, location: e.target.value })}
                                required
                            />
                            <button
                                type="button"
                                onClick={detectLocation}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                            >
                                {detecting ? <Loader2 size={16} className="animate-spin" /> : <Navigation size={16} />}
                            </button>
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
                        value={formData.description}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl h-28 text-sm outline-none focus:ring-1 focus:ring-slate-900 transition-all resize-none"
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                    />
                </div>

                <div className="mt-8">
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full bg-indigo-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:bg-slate-400 flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                    >
                        {saving ? (
                            <><Loader2 size={18} className="animate-spin" /> <span>Menyimpan...</span></>
                        ) : (
                            <><Check size={18} /> <span>Simpan Perubahan</span></>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
