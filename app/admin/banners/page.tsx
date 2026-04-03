"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { ArrowLeft, Plus, Trash2, Loader2, ImagePlus, Eye, EyeOff, Pencil, X, Check, ImageIcon, LayoutDashboard, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import imageCompression from "browser-image-compression"

export default function AdminBannersPage() {
    const router = useRouter()
    const [banners, setBanners] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [processingId, setProcessingId] = useState<string | null>(null)
    const [showForm, setShowForm] = useState(false)
    const [editingBanner, setEditingBanner] = useState<any>(null)
    const [saving, setSaving] = useState(false)

    // Form state
    const [title, setTitle] = useState("")
    const [subtitle, setSubtitle] = useState("")
    const [selectedCategoryId, setSelectedCategoryId] = useState("")
    const [imageFile, setImageFile] = useState<File | null>(null)
    const [imagePreview, setImagePreview] = useState("")

    const fetchBanners = async () => {
        setLoading(true)
        const { data } = await supabase
            .from("banners")
            .select("*")
            .order("order", { ascending: true })

        if (data) setBanners(data)
        setLoading(false)
    }

    const fetchCategories = async () => {
        const { data } = await supabase.from("categories").select("*").order("name")
        if (data) setCategories(data)
    }

    useEffect(() => {
        fetchBanners()
        fetchCategories()
    }, [])

    const resetForm = () => {
        setTitle("")
        setSubtitle("")
        setSelectedCategoryId("")
        setImageFile(null)
        setImagePreview("")
        setEditingBanner(null)
        setShowForm(false)
    }

    const openEditForm = (banner: any) => {
        setTitle(banner.title || "")
        setSubtitle(banner.subtitle || "")
        const match = (banner.link_url || "").match(/\/category(?:\?id=|\/)(.+)/)
        setSelectedCategoryId(match ? match[1] : "")
        setImagePreview(banner.image_url || "")
        setEditingBanner(banner)
        setShowForm(true)
    }

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setImageFile(file)
            const reader = new FileReader()
            reader.onloadend = () => setImagePreview(reader.result as string)
            reader.readAsDataURL(file)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!imagePreview && !editingBanner) {
            toast.error("Upload gambar banner terlebih dahulu")
            return
        }

        setSaving(true)
        try {
            let finalImageUrl = editingBanner?.image_url || ""

            if (imageFile) {
                const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1200, useWebWorker: true }
                const compressed = await imageCompression(imageFile, options)
                const ext = imageFile.name.split('.').pop()
                const fileName = `banner-${Date.now()}.${ext}`

                const { error: uploadErr } = await supabase.storage
                    .from("product-images")
                    .upload(fileName, compressed)

                if (uploadErr) throw uploadErr

                const { data: { publicUrl } } = supabase.storage
                    .from("product-images")
                    .getPublicUrl(fileName)

                finalImageUrl = publicUrl
            }

            const finalLinkUrl = selectedCategoryId ? `/category?id=${selectedCategoryId}` : ""

            if (editingBanner) {
                const { error } = await supabase
                    .from("banners")
                    .update({ title, subtitle, link_url: finalLinkUrl, image_url: finalImageUrl })
                    .eq("id", editingBanner.id)

                if (error) throw error
                toast.success("Banner diperbarui!")
            } else {
                const newOrder = banners.length
                const { error } = await supabase
                    .from("banners")
                    .insert([{ title, subtitle, link_url: finalLinkUrl, image_url: finalImageUrl, is_active: true, order: newOrder }])

                if (error) throw error
                toast.success("Banner ditambahkan!")
            }

            resetForm()
            fetchBanners()
        } catch (err: any) {
            toast.error("Error: " + err.message)
        } finally {
            setSaving(false)
        }
    }

    const toggleActive = async (id: string, current: boolean) => {
        setProcessingId(id)
        const { error } = await supabase
            .from("banners")
            .update({ is_active: !current })
            .eq("id", id)

        if (error) {
            toast.error("Gagal mengupdate")
        } else {
            setBanners(prev => prev.map(b => b.id === id ? { ...b, is_active: !current } : b))
            toast.success(!current ? "Banner diaktifkan" : "Banner dinonaktifkan")
        }
        setProcessingId(null)
    }

    const deleteBanner = async (id: string) => {
        if (!confirm("Hapus banner ini?")) return
        setProcessingId(id)
        const { error } = await supabase.from("banners").delete().eq("id", id)

        if (error) {
            toast.error("Gagal menghapus")
        } else {
            setBanners(prev => prev.filter(b => b.id !== id))
            toast.success("Banner dihapus")
        }
        setProcessingId(null)
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans max-w-md mx-auto pb-24 selection:bg-indigo-100">
            {/* HEADER */}
            <div className="bg-white sticky top-0 z-40 border-b border-slate-100/60 backdrop-blur-md bg-white/80">
                <div className="px-5 pt-12 pb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.push('/admin')} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                            <ArrowLeft size={20} strokeWidth={2.5} />
                        </button>
                        <div>
                            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">Banner Promo</h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Atur Slider Home</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="px-2 py-1 bg-indigo-50 text-indigo-600 text-[9px] font-extrabold rounded-lg border border-indigo-100">
                            {banners.length} AKTIF
                        </span>
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-5">
                {/* UPGRADE: Floating Add Button Card */}
                {!showForm && (
                    <button
                        onClick={() => { resetForm(); setShowForm(true); }}
                        className="group w-full bg-indigo-600 p-4 rounded-3xl flex items-center justify-between text-white shadow-xl shadow-indigo-100 active:scale-[0.98] transition-all overflow-hidden relative"
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-white/20 transition-colors"></div>
                        <div className="flex items-center gap-4 relative z-10">
                            <div className="p-2 bg-white/20 rounded-2xl"><Plus size={20} /></div>
                            <div className="text-left">
                                <p className="text-sm font-extrabold">Tambah Banner Baru</p>
                                <p className="text-[10px] text-indigo-100 font-medium">Buat visual promosi di halaman utama</p>
                            </div>
                        </div>
                        <ChevronRight size={18} className="text-indigo-200" />
                    </button>
                )}

                {/* FORM MODAL STYLE */}
                {showForm && (
                    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-slate-800">{editingBanner ? "Edit Banner" : "Banner Visual Baru"}</h3>
                            <button type="button" onClick={resetForm} className="p-1.5 text-slate-400 hover:text-slate-600 bg-slate-50 rounded-lg">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Upload Gambar Premium Look */}
                        <label className="block aspect-[21/9] bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 cursor-pointer overflow-hidden hover:border-indigo-300 transition-all relative group">
                            {imagePreview ? (
                                <img src={imagePreview} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" alt="preview" />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-300 group-hover:text-indigo-400 transition-colors">
                                    <ImagePlus size={32} strokeWidth={1.5} />
                                    <span className="text-[10px] mt-2 font-bold uppercase tracking-widest">Pilih Gambar Banner</span>
                                </div>
                            )}
                            <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                            <div className="absolute bottom-2 right-2 p-1.5 bg-black/50 backdrop-blur-md rounded-lg text-white pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                                <Pencil size={12} />
                            </div>
                        </label>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Judul Utama</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="Contoh: Promo Flash Sale!"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all font-medium"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Subtitle / Punchline</label>
                                <input
                                    type="text"
                                    value={subtitle}
                                    onChange={e => setSubtitle(e.target.value)}
                                    placeholder="Contoh: Diskon Hingga 90%"
                                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all font-medium"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Tautan Kategori</label>
                                <div className="relative">
                                    <select
                                        value={selectedCategoryId}
                                        onChange={e => setSelectedCategoryId(e.target.value)}
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all appearance-none font-medium"
                                    >
                                        <option value="">Tidak ada tautan</option>
                                        {categories.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"><ChevronRight size={16} className="rotate-90" /></div>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-sm shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:bg-slate-300"
                        >
                            {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                            <span>{saving ? "Memproses..." : editingBanner ? "Simpan Perubahan" : "Terbitkan Banner"}</span>
                        </button>
                    </form>
                )}

                {/* LIST BANNERS PREMIUM - Grid/Staggered Style */}
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2].map(i => <div key={i} className="aspect-[21/9] bg-white rounded-3xl animate-pulse border border-slate-100" />)}
                    </div>
                ) : banners.length > 0 ? (
                    <div className="space-y-4 pb-12">
                        <div className="flex items-center gap-2 ml-1">
                            <div className="w-1 h-3.5 bg-indigo-500 rounded-full"></div>
                            <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Daftar Banner Aktif</h3>
                        </div>
                        {banners.map((b) => (
                            <div
                                key={b.id}
                                className={`bg-white rounded-[2rem] border shadow-sm overflow-hidden transition-all group ${b.is_active ? 'border-slate-100' : 'border-slate-200 opacity-60'}`}
                            >
                                <div className="aspect-[21/9] bg-slate-100 relative overflow-hidden">
                                    <img src={b.image_url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={b.title || "Banner"} />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                                    
                                    <div className="absolute bottom-4 left-5 right-5 text-white">
                                        <h4 className="text-sm font-bold truncate leading-tight">{b.title || "Visual Tanpa Judul"}</h4>
                                        {b.subtitle && <p className="text-[10px] font-medium text-white/80 line-clamp-1">{b.subtitle}</p>}
                                    </div>

                                    {!b.is_active && (
                                        <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px] flex items-center justify-center">
                                            <span className="bg-slate-900/80 text-white text-[9px] font-extrabold px-3 py-1 rounded-full uppercase tracking-tighter shadow-lg">OFFLINE</span>
                                        </div>
                                    )}
                                </div>
                                <div className="px-5 py-4 flex items-center justify-between bg-white">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <ImageIcon size={12} className="text-slate-300" />
                                            <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-tighter">
                                                {b.link_url ? (categories.find(c => b.link_url?.includes(c.id))?.name || "Direct Link") : "Tanpa Tautan"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0 ml-2">
                                        <button
                                            onClick={() => toggleActive(b.id, b.is_active)}
                                            disabled={processingId === b.id}
                                            className={`p-2.5 rounded-xl transition-all ${b.is_active ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'text-slate-400 bg-slate-50 hover:bg-slate-100'}`}
                                        >
                                            {b.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                                        </button>
                                        <button
                                            onClick={() => openEditForm(b)}
                                            className="p-2.5 text-slate-400 bg-slate-50 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            onClick={() => deleteBanner(b.id)}
                                            disabled={processingId === b.id}
                                            className="p-2.5 text-slate-400 bg-slate-50 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                        >
                                            {processingId === b.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-100 flex flex-col items-center shadow-inner">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-4"><ImageIcon size={32} /></div>
                        <h4 className="text-sm font-bold text-slate-700">Banner Kosong</h4>
                        <p className="text-[10px] text-slate-400 font-medium px-10 leading-relaxed">Promosi utama belum dikonfigurasi. Tambahkan banner visual sekarang.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
