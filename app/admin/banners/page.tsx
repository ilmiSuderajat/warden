"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { ArrowLeft, Plus, Trash2, Loader2, ImagePlus, GripVertical, Eye, EyeOff, Pencil, X, Check } from "lucide-react"
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
        // Coba extract category id dari link_url format /category/xxx
        const match = (banner.link_url || "").match(/\/category\/(.+)/)
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

            const finalLinkUrl = selectedCategoryId ? `/category/${selectedCategoryId}` : ""

            if (editingBanner) {
                // UPDATE
                const { error } = await supabase
                    .from("banners")
                    .update({ title, subtitle, link_url: finalLinkUrl, image_url: finalImageUrl })
                    .eq("id", editingBanner.id)

                if (error) throw error
                toast.success("Banner diperbarui!")
            } else {
                // INSERT
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
        <div className="min-h-screen bg-slate-50/80 font-sans max-w-md mx-auto pb-10">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
                <div className="flex items-center justify-between px-5 pt-12 pb-4">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                            <ArrowLeft size={20} strokeWidth={2.5} />
                        </button>
                        <div>
                            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Banner Promo</h1>
                            <p className="text-[10px] font-medium text-slate-400">Kelola banner slider</p>
                        </div>
                    </div>
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-full border border-indigo-100">
                        {banners.length} Banner
                    </span>
                </div>
            </div>

            <div className="p-5 space-y-4">
                {/* Tombol Tambah */}
                {!showForm && (
                    <button
                        onClick={() => { resetForm(); setShowForm(true); }}
                        className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold text-sm transition-all active:scale-[0.98] shadow-sm shadow-indigo-100"
                    >
                        <Plus size={18} />
                        <span>Tambah Banner</span>
                    </button>
                )}

                {/* FORM */}
                {showForm && (
                    <form onSubmit={handleSubmit} className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-bold text-slate-900">{editingBanner ? "Edit Banner" : "Banner Baru"}</h3>
                            <button type="button" onClick={resetForm} className="p-1 text-slate-400 hover:text-slate-600">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Upload Gambar */}
                        <label className="block aspect-[21/9] bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 cursor-pointer overflow-hidden hover:border-indigo-300 transition-colors relative">
                            {imagePreview ? (
                                <img src={imagePreview} className="w-full h-full object-cover" alt="preview" />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-slate-300">
                                    <ImagePlus size={28} />
                                    <span className="text-[10px] mt-2 font-medium">Klik untuk upload gambar</span>
                                </div>
                            )}
                            <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                        </label>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Judul (opsional)</label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="Promo Spesial Lebaran"
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Subtitle (opsional)</label>
                            <input
                                type="text"
                                value={subtitle}
                                onChange={e => setSubtitle(e.target.value)}
                                placeholder="Diskon hasta 50%"
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Kategori Tujuan (opsional)</label>
                            <select
                                value={selectedCategoryId}
                                onChange={e => setSelectedCategoryId(e.target.value)}
                                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-indigo-500 appearance-none"
                            >
                                <option value="">Pilih Kategori...</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:bg-slate-400 transition-all"
                        >
                            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                            <span>{saving ? "Menyimpan..." : editingBanner ? "Simpan Perubahan" : "Tambahkan"}</span>
                        </button>
                    </form>
                )}

                {/* LIST BANNERS */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Loader2 className="animate-spin mb-3" size={28} />
                        <p className="text-xs font-medium">Memuat banner...</p>
                    </div>
                ) : banners.length > 0 ? (
                    <div className="space-y-3">
                        {banners.map((b) => (
                            <div
                                key={b.id}
                                className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${b.is_active ? 'border-indigo-100' : 'border-slate-100 opacity-60'}`}
                            >
                                <div className="aspect-[21/9] bg-slate-100 relative">
                                    <img src={b.image_url} className="w-full h-full object-cover" alt={b.title || "Banner"} />
                                    {!b.is_active && (
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                            <span className="bg-slate-800 text-white text-[10px] font-bold px-3 py-1 rounded-md">NONAKTIF</span>
                                        </div>
                                    )}
                                </div>
                                <div className="p-3 flex items-center justify-between">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold text-slate-800 truncate">{b.title || "Tanpa Judul"}</p>
                                        {b.subtitle && <p className="text-[10px] text-slate-400 truncate">{b.subtitle}</p>}
                                        {b.link_url && <p className="text-[9px] text-indigo-500 truncate mt-0.5">→ {categories.find(c => b.link_url?.includes(c.id))?.name || b.link_url}</p>}
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0 ml-2">
                                        <button
                                            onClick={() => toggleActive(b.id, b.is_active)}
                                            disabled={processingId === b.id}
                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                        >
                                            {b.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                                        </button>
                                        <button
                                            onClick={() => openEditForm(b)}
                                            className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        <button
                                            onClick={() => deleteBanner(b.id)}
                                            disabled={processingId === b.id}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                        >
                                            {processingId === b.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 flex flex-col items-center border-2 border-dashed border-slate-200 rounded-2xl bg-white">
                        <ImagePlus size={32} className="text-slate-300 mb-3" />
                        <p className="text-sm font-semibold text-slate-700 mb-1">Belum Ada Banner</p>
                        <p className="text-xs text-slate-400">Tambahkan banner promo untuk pengguna.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
