"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { ArrowLeft, MapPin, Camera, Phone, FileText, Loader2, Navigation, CheckCircle2 } from "lucide-react"
import imageCompression from 'browser-image-compression'
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function EditShopPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [detecting, setDetecting] = useState(false)
    const [shopId, setShopId] = useState<string | null>(null)

    // Form State
    const [name, setName] = useState("")
    const [slug, setSlug] = useState("")
    const [description, setDescription] = useState("")
    const [whatsapp, setWhatsapp] = useState("")
    const [address, setAddress] = useState("")
    const [latitude, setLatitude] = useState<number | null>(null)
    const [longitude, setLongitude] = useState<number | null>(null)
    
    // Image State
    const [file, setFile] = useState<File | null>(null)
    const [preview, setPreview] = useState<string>("")
    const [existingImage, setExistingImage] = useState<string | null>(null)

    useEffect(() => {
        const fetchShop = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push("/login")
                return
            }

            const { data: shop, error } = await supabase
                .from("shops")
                .select("*")
                .eq("owner_id", user.id)
                .single()

            if (error || !shop) {
                toast.error("Warung tidak ditemukan")
                router.replace("/shop/create")
                return
            }

            setShopId(shop.id)
            setName(shop.name)
            setSlug(shop.slug)
            setDescription(shop.description || "")
            setWhatsapp(shop.whatsapp || "")
            setAddress(shop.address || "")
            setLatitude(shop.latitude)
            setLongitude(shop.longitude)
            setPreview(shop.image_url || "")
            setExistingImage(shop.image_url)
            
            setLoading(false)
        }
        fetchShop()
    }, [router])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0]
        if (selected) {
            setFile(selected)
            const reader = new FileReader()
            reader.onloadend = () => {
                setPreview(reader.result as string)
            }
            reader.readAsDataURL(selected)
        }
    }

    const detectLocation = () => {
        setDetecting(true)
        if (!navigator.geolocation) {
            toast.error("Browser tidak mendukung lokasi.")
            setDetecting(false)
            return
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
                    const data = await res.json()
                    const detectedAddress = data.address.village || data.address.suburb || data.address.hamlet || data.address.city || "Lokasi ditemukan"
                    
                    setAddress(detectedAddress)
                    setLatitude(latitude)
                    setLongitude(longitude)
                    toast.success("Lokasi berhasil diperbarui")
                } catch (err) {
                    toast.error("Gagal mendeteksi nama lokasi.")
                } finally {
                    setDetecting(false)
                }
            },
            () => {
                toast.error("Izin lokasi ditolak atau gagal mendeteksi.")
                setDetecting(false)
            }
        )
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!shopId) return
        
        // Basic validation
        if (name.trim().length < 3) return toast.error("Nama warung minimal 3 karakter")
        if (address.trim().length < 5) return toast.error("Alamat terlalu pendek")
        if (whatsapp.trim().length < 8) return toast.error("Nomor WA tidak valid")

        setSaving(true)

        try {
            // Cek apakah slug sudah ada dan DIBUAT OLEH ORANG LAIN
            const { data: existingSlug } = await supabase
                .from("shops")
                .select("id")
                .eq("slug", slug)
                .neq("id", shopId)
                .maybeSingle()

            if (existingSlug) {
                toast.error("Link Warung (Slug) sudah dipakai toko lain")
                setSaving(false)
                return
            }

            let uploadedUrl = existingImage

            // Upload Image jika ada foto baru
            if (file) {
                const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true }
                const compressedFile = await imageCompression(file, options)
                const fileExt = file.name.split('.').pop()
                const fileName = `update-${shopId}-${Date.now()}.${fileExt}`

                const { error: uploadError } = await supabase.storage
                    .from('shop-images')
                    .upload(fileName, compressedFile)

                if (uploadError) throw uploadError

                const { data: { publicUrl } } = supabase.storage
                    .from('shop-images')
                    .getPublicUrl(fileName)
                
                uploadedUrl = publicUrl
            } else if (!preview) {
                // User menghapus foto (preview kosong, tapi origin ada)
                uploadedUrl = null
            }

            // Simpan ke DB
            const { error: updateError } = await supabase
                .from("shops")
                .update({
                    name,
                    slug,
                    description,
                    address,
                    whatsapp,
                    image_url: uploadedUrl,
                    latitude,
                    longitude
                })
                .eq("id", shopId)

            if (updateError) throw updateError

            toast.success("Profil warung berhasil diperbarui!")
            router.push("/shop/dashboard")
            router.refresh()

        } catch (error: any) {
            toast.error(`Gagal update warung: ${error.message}`)
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50/80 font-sans max-w-md mx-auto pb-32">
            {/* ── HEADER ── */}
            <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
                <div className="flex items-center gap-3 px-5 py-4">
                    <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                        <ArrowLeft size={20} strokeWidth={2.5} />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900 tracking-tight">Edit Profil Warung</h1>
                        <p className="text-[10px] font-medium text-slate-400">Ubah informasi tokomu</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-6">
                
                {/* ── FOTO WARUNG ── */}
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm flex flex-col items-center justify-center">
                    <label className={`relative w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all shadow-md group ${preview ? 'border-white' : 'border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100'}`}>
                        {preview ? (
                            <>
                                <img src={preview} className="w-full h-full object-cover" alt="Preview" />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera size={24} className="text-white" />
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center text-slate-400">
                                <Camera size={24} className="mb-2" />
                                <span className="text-[10px] font-bold uppercase">Ubah</span>
                            </div>
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                    </label>
                    {preview && (
                        <button type="button" onClick={() => { setFile(null); setPreview(""); }} className="mt-4 text-xs font-bold text-red-500 bg-red-50 px-4 py-1.5 rounded-full hover:bg-red-100">
                            Hapus Foto
                        </button>
                    )}
                </div>

                {/* ── INFO DASAR ── */}
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Nama Warung *</label>
                        <input
                            type="text"
                            value={name}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:border-indigo-500 transition-all"
                            onChange={e => setName(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                            Link Warung (Slug) *
                        </label>
                        <div className="flex border border-slate-200 rounded-xl overflow-hidden focus-within:ring-1 focus-within:ring-indigo-500">
                            <span className="bg-slate-50 px-3 py-3 text-sm text-slate-400 border-r border-slate-200 select-none">/shop/</span>
                            <input
                                type="text"
                                value={slug}
                                className="flex-1 px-3 py-3 w-full bg-white text-sm outline-none"
                                onChange={e => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                            <FileText size={12} /> Deskripsi
                        </label>
                        <textarea
                            value={description}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl h-24 text-sm outline-none focus:bg-white focus:border-indigo-500 transition-all resize-none"
                            onChange={e => setDescription(e.target.value)}
                        />
                    </div>
                </div>

                {/* ── LOKASI & KONTAK ── */}
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                            <Phone size={12} /> WhatsApp *
                        </label>
                        <input
                            type="tel"
                            value={whatsapp}
                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:bg-white focus:border-indigo-500 transition-all"
                            onChange={e => setWhatsapp(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                            <MapPin size={12} /> Alamat Lengkap *
                        </label>
                        <div className="relative group">
                            <textarea
                                value={address}
                                className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl h-24 text-sm outline-none focus:bg-white focus:border-indigo-500 transition-all resize-none"
                                onChange={e => setAddress(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                onClick={detectLocation}
                                title="Deteksi Lokasi GPS"
                                className="absolute right-3 top-3 p-2 bg-white text-indigo-600 shadow border border-slate-100 rounded-lg hover:bg-slate-50 transition-all"
                            >
                                {detecting ? <Loader2 size={18} className="animate-spin" /> : <Navigation size={18} />}
                            </button>
                        </div>
                        {latitude && longitude && (
                            <p className="text-[10px] text-emerald-600 font-bold mt-2 ml-1 flex items-center gap-1">
                                <CheckCircle2 size={12} /> Koordinat GPS tersimpan
                            </p>
                        )}
                    </div>
                </div>

                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:bg-slate-400 disabled:shadow-none flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
                    >
                        {saving ? (
                            <><Loader2 size={18} className="animate-spin" /> <span>Menyimpan...</span></>
                        ) : (
                            <><CheckCircle2 size={18} /> <span>Simpan Perubahan</span></>
                        )}
                    </button>
                </div>
            </form>
        </div>
    )
}
