"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { ArrowLeft, MapPin, Store, Camera, Link as LinkIcon, Phone, FileText, ChevronRight, Loader2, Navigation, CheckCircle2, Trash2, XCircle } from "lucide-react"
import imageCompression from 'browser-image-compression'
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import dynamic from "next/dynamic"

const DraggableMap = dynamic(() => import("@/app/components/DraggableMap"), { ssr: false })

export default function CreateShopPage() {
    const router = useRouter()
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [detecting, setDetecting] = useState(false)
    const [user, setUser] = useState<any>(null)

    // Form State
    const [name, setName] = useState("")
    const [slug, setSlug] = useState("")
    const [isSlugManuallyEdited, setIsSlugManuallyEdited] = useState(false)
    const [isSlugAvailable, setIsSlugAvailable] = useState<boolean | null>(null)
    const [checkingSlug, setCheckingSlug] = useState(false)
    const [description, setDescription] = useState("")
    const [whatsapp, setWhatsapp] = useState("")
    const [address, setAddress] = useState("")
    const [latitude, setLatitude] = useState<number | null>(null)
    const [longitude, setLongitude] = useState<number | null>(null)

    // Image State
    const [file, setFile] = useState<File | null>(null)
    const [preview, setPreview] = useState<string>("")

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                toast.error("Silakan login terlebih dahulu")
                router.push("/login")
                return
            }
            setUser(user)

            const { data: existingShop } = await supabase
                .from("shops")
                .select("id")
                .eq("owner_id", user.id)
                .maybeSingle()

            if (existingShop) {
                toast.info("Anda sudah memiliki warung")
                router.replace("/shop/dashboard")
                return
            }
            setLoading(false)
        }
        checkAuth()
    }, [router])

    useEffect(() => {
        // Otomatis generate slug jika user tidak sedang mengedit slug secara manual
        if (!isSlugManuallyEdited && name) {
            setSlug(generateSlug(name))
        }
    }, [name, isSlugManuallyEdited])

    useEffect(() => {
        if (!slug || slug.trim().length < 3) {
            setIsSlugAvailable(null)
            return
        }

        const checkSlugAvailability = async () => {
            setCheckingSlug(true)
            const { data } = await supabase
                .from("shops")
                .select("id")
                .eq("slug", slug)
                .maybeSingle()
            
            setIsSlugAvailable(!data)
            setCheckingSlug(false)
        }

        const timeoutId = setTimeout(() => {
            checkSlugAvailability()
        }, 500)

        return () => clearTimeout(timeoutId)
    }, [slug])

    const generateSlug = (text: string) => {
        return text
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-')
            .replace(/^-+/, '')
            .replace(/-+$/, '')
    }

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
                    // Prioritaskan nama jalan/area yang lebih spesifik
                    const detectedAddress = data.display_name || data.address.village || data.address.suburb || "Lokasi ditemukan"

                    setAddress(detectedAddress)
                    setLatitude(latitude)
                    setLongitude(longitude)
                    toast.success("Lokasi berhasil dideteksi")
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

    const isStep1Valid = name.trim().length > 2 && slug.trim().length > 2 && isSlugAvailable === true
    const isStep2Valid = address.trim().length > 5 && whatsapp.trim().length > 8

    const handleSubmit = async () => {
        if (!user) return
        setSaving(true)

        try {
            const { data: existingSlug } = await supabase
                .from("shops")
                .select("id")
                .eq("slug", slug)
                .maybeSingle()

            if (existingSlug) {
                toast.error("Link Warung (Slug) sudah dipakai, silakan gunakan yang lain")
                setStep(1)
                setSaving(false)
                return
            }

            let uploadedUrl = null

            if (file) {
                const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true }
                const compressedFile = await imageCompression(file, options)
                const fileExt = file.name.split('.').pop()
                const fileName = `${user.id}-${Date.now()}.${fileExt}`

                const { error: uploadError } = await supabase.storage
                    .from('shop-images')
                    .upload(fileName, compressedFile)

                if (uploadError) {
                    if (uploadError.message.includes("Bucket not found")) {
                        toast.error("Hubungi Admin: Bucket shop-images belum dibuat")
                        throw uploadError
                    }
                    throw uploadError
                }

                const { data: { publicUrl } } = supabase.storage
                    .from('shop-images')
                    .getPublicUrl(fileName)

                uploadedUrl = publicUrl
            }

            const { error: insertError } = await supabase
                .from("shops")
                .insert({
                    owner_id: user.id,
                    name,
                    slug,
                    description,
                    address,
                    whatsapp,
                    image_url: uploadedUrl,
                    latitude,
                    longitude
                })

            if (insertError) throw insertError

            toast.success("Warung berhasil dibuat!")
            router.push("/shop/dashboard")
            router.refresh()

        } catch (error: any) {
            toast.error(`Gagal membuat warung: ${error.message}`)
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
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 font-sans max-w-lg mx-auto pb-32">
            {/* ── HEADER ── */}
            <div className="bg-white/80 backdrop-blur-lg border-b border-slate-200/50 sticky top-0 z-40">
                <div className="flex items-center gap-4 px-4 py-4">
                    <button
                        onClick={() => step > 1 ? setStep(step - 1) : router.back()}
                        className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                    >
                        <ArrowLeft size={22} strokeWidth={2.5} />
                    </button>
                    <div className="flex-1">
                        <h1 className="text-lg font-bold text-slate-900 tracking-tight">Buka Warung Baru</h1>
                        <p className="text-xs text-slate-500">Langkah {step} dari 3</p>
                    </div>
                </div>

                {/* Progress Bar - Stylish */}
                <div className="w-full bg-slate-100 h-1.5 flex gap-1 px-4 pb-2">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className="flex-1 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-500 ease-out ${s <= step ? 'bg-indigo-600' : 'bg-transparent'}`}
                            />
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-4 sm:p-6 space-y-6">

                {/* ── STEP 1: INFO DASAR ── */}
                {step === 1 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                        <div className="flex flex-col items-center text-center pt-4">
                            <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-indigo-100">
                                <Store size={28} strokeWidth={2} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900">Info Dasar</h2>
                            <p className="text-sm text-slate-500 mt-1 max-w-xs">Beri nama warungmu agar mudah dikenali pelanggan</p>
                        </div>

                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
                            {/* Nama Warung */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Nama Warung</label>
                                <input
                                    type="text"
                                    value={name}
                                    placeholder="Contoh: Warung Makan Barokah"
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-base outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400 text-slate-900 font-medium"
                                    onChange={e => setName(e.target.value)}
                                />
                            </div>

                            {/* Link Warung */}
                            <div>
                                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                                    <LinkIcon size={12} className="text-indigo-500" /> Link Warung
                                </label>
                                <div className={`flex border rounded-xl overflow-hidden focus-within:ring-2 transition-all bg-slate-50 ${isSlugAvailable === false ? 'border-red-300 focus-within:ring-red-100 focus-within:border-red-500' : 'border-slate-200 focus-within:ring-indigo-100 focus-within:border-indigo-500'}`}>
                                    <span className="bg-slate-100 px-4 py-3.5 text-sm text-slate-500 border-r border-slate-200 select-none whitespace-nowrap font-medium flex items-center">warungkita.id/</span>
                                    <input
                                        type="text"
                                        value={slug}
                                        placeholder="warung-barokah"
                                        className="flex-1 px-4 py-3.5 w-full bg-transparent text-base outline-none text-slate-800 font-medium placeholder:text-slate-400"
                                        onChange={e => {
                                            setSlug(generateSlug(e.target.value))
                                            setIsSlugManuallyEdited(true)
                                        }}
                                    />
                                    <div className="flex items-center pr-4">
                                        {checkingSlug ? (
                                            <Loader2 size={18} className="animate-spin text-slate-400" />
                                        ) : isSlugAvailable === true ? (
                                            <CheckCircle2 size={18} className="text-emerald-500" />
                                        ) : isSlugAvailable === false ? (
                                            <XCircle size={18} className="text-red-500" />
                                        ) : null}
                                    </div>
                                </div>
                                {isSlugAvailable === false && (
                                    <p className="text-xs text-red-500 font-medium mt-1.5 ml-1">Link ini sudah dipakai, coba yang lain.</p>
                                )}
                                {isSlugAvailable === true && (
                                    <p className="text-xs text-emerald-600 font-medium mt-1.5 ml-1">Link tersedia!</p>
                                )}
                            </div>

                            {/* Deskripsi */}
                            <div>
                                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                                    <FileText size={12} className="text-indigo-500" /> Deskripsi Singkat
                                </label>
                                <textarea
                                    value={description}
                                    placeholder="Jelaskan menu unggulan atau keunikan warungmu..."
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl h-28 text-sm outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all resize-none placeholder:text-slate-400 font-medium text-slate-800"
                                    onChange={e => setDescription(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            onClick={() => setStep(2)}
                            disabled={!isStep1Valid}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md shadow-indigo-200"
                        >
                            Lanjutkan <ChevronRight size={18} />
                        </button>
                    </div>
                )}

                {/* ── STEP 2: LOKASI & KONTAK ── */}
                {step === 2 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                        <div className="flex flex-col items-center text-center pt-4">
                            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-blue-100">
                                <MapPin size={28} strokeWidth={2} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900">Lokasi & Kontak</h2>
                            <p className="text-sm text-slate-500 mt-1 max-w-xs">Pastikan pelanggan bisa menemukan & menghubungimu</p>
                        </div>

                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
                            {/* WhatsApp */}
                            <div>
                                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                                    <Phone size={12} className="text-blue-500" /> Nomor WhatsApp
                                </label>
                                <input
                                    type="tel"
                                    value={whatsapp}
                                    placeholder="Contoh: 08123456789"
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-base outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400 font-medium text-slate-900"
                                    onChange={e => setWhatsapp(e.target.value)}
                                />
                            </div>

                            {/* Alamat */}
                            <div>
                                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                                    <MapPin size={12} className="text-blue-500" /> Alamat Lengkap
                                </label>
                                <textarea
                                    value={address}
                                    placeholder="Jl. Contoh No. 12, Kelurahan, Kecamatan"
                                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl h-28 text-sm outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all resize-none placeholder:text-slate-400 font-medium text-slate-800"
                                    onChange={e => setAddress(e.target.value)}
                                />
                            </div>

                            {/* Tombol Deteksi Lokasi */}
                            <button
                                type="button"
                                onClick={detectLocation}
                                disabled={detecting}
                                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all active:scale-[0.99] disabled:opacity-50"
                            >
                                {detecting ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <Navigation size={18} />
                                )}
                                <span>{detecting ? "Mendeteksi..." : "Gunakan Lokasi Saya Saat Ini"}</span>
                            </button>

                            {/* Leaflet Draggable Map */}
                            <div className="pt-2">
                                <label className="flex items-center justify-between text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
                                    <span>Titik Peta</span>
                                    <span className="text-[10px] text-slate-400 normal-case font-normal">Geser pin ke lokasi akurat</span>
                                </label>
                                <DraggableMap
                                    initialLat={latitude}
                                    initialLng={longitude}
                                    onLocationSelect={(lat, lng) => {
                                        setLatitude(lat);
                                        setLongitude(lng);
                                    }}
                                />
                            </div>

                            {latitude && longitude && (
                                <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100">
                                    <CheckCircle2 size={14} className="flex-shrink-0" />
                                    <span>Koordinat GPS berhasil tersimpan.</span>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setStep(1)}
                                className="flex-1 bg-white text-slate-700 border border-slate-200 py-4 rounded-xl font-bold text-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
                            >
                                Kembali
                            </button>
                            <button
                                onClick={() => setStep(3)}
                                disabled={!isStep2Valid}
                                className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md shadow-indigo-200"
                            >
                                Lanjutkan <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                )}

                {/* ── STEP 3: FOTO WARUNG ── */}
                {step === 3 && (
                    <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
                        <div className="flex flex-col items-center text-center pt-4">
                            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-emerald-100">
                                <Camera size={28} strokeWidth={2} />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900">Foto Warung</h2>
                            <p className="text-sm text-slate-500 mt-1 max-w-xs">Tampilkan wajah warungmu (opsional tapi disarankan)</p>
                        </div>

                        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                            <div className="flex flex-col items-center justify-center">
                                <label className={`relative w-48 h-48 rounded-2xl border-2 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition-all group ${preview ? 'border-indigo-200 border-solid bg-slate-50' : 'border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-indigo-400'}`}>
                                    {preview ? (
                                        <>
                                            <img src={preview} className="w-full h-full object-cover" alt="Preview" />
                                            <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-2">
                                                <Camera size={24} className="text-white" />
                                                <span className="text-white text-xs font-medium">Ganti Foto</span>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center text-slate-400 p-4 text-center">
                                            <Camera size={32} className="mb-3 opacity-50" />
                                            <span className="text-sm font-bold text-slate-600">Upload Foto</span>
                                            <span className="text-xs text-slate-400 mt-1">Klik untuk memilih</span>
                                        </div>
                                    )}
                                    <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                                </label>

                                {preview && (
                                    <button
                                        onClick={() => { setFile(null); setPreview(""); }}
                                        className="mt-4 flex items-center gap-2 text-xs font-semibold text-red-500 hover:text-red-600 bg-red-50 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors"
                                    >
                                        <Trash2 size={14} /> Hapus Foto
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setStep(2)}
                                className="flex-1 bg-white text-slate-700 border border-slate-200 py-4 rounded-xl font-bold text-sm transition-all hover:bg-slate-50 active:scale-[0.98]"
                            >
                                Kembali
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={saving}
                                className="flex-[2] bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-xl font-bold text-sm transition-all active:scale-[0.98] disabled:bg-emerald-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-200"
                            >
                                {saving ? (
                                    <><Loader2 size={18} className="animate-spin" /> <span>Menyimpan...</span></>
                                ) : (
                                    <><CheckCircle2 size={18} /> <span>Buka Warung Sekarang</span></>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}