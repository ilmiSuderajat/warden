"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { ArrowLeft, Tag, Copy, Loader2, Check } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export default function VoucherPage() {
    const router = useRouter()
    const [vouchers, setVouchers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [copiedCode, setCopiedCode] = useState<string | null>(null)

    useEffect(() => {
        const fetchVouchers = async () => {
            const nowIso = new Date().toISOString()
            const { data, error } = await supabase
                .from("vouchers")
                .select("*")
                .eq("is_active", true)
                .or(`start_date.lte.${nowIso},start_date.is.null`)
                .or(`end_date.gte.${nowIso},end_date.is.null`)
                .order("discount_value", { ascending: false })

            if (data) {
                // Filter further if usage_limit is reached. 
                // We use Filter JS to avoid complex custom SQL queries for now.
                const availableVouchers = data.filter(v => 
                    !v.usage_limit || (v.used_count || 0) < v.usage_limit
                )
                setVouchers(availableVouchers)
            }
            setLoading(false)
        }
        fetchVouchers()
    }, [])

    const handleCopy = (code: string) => {
        navigator.clipboard.writeText(code)
        setCopiedCode(code)
        toast.success(`Kode voucher ${code} disalin!`)
        setTimeout(() => setCopiedCode(null), 2000)
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount)
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans max-w-md mx-auto pb-10">
            {/* Navigasi / Header */}
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white rounded-b-3xl shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-400/20 rounded-full blur-2xl" />
                
                <div className="flex items-center justify-between px-5 pt-12 pb-4 relative z-10">
                    <button 
                        onClick={() => router.back()} 
                        className="p-2 -ml-2 text-white/90 hover:bg-white/10 rounded-xl transition-colors"
                    >
                        <ArrowLeft size={24} strokeWidth={2.5} />
                    </button>
                    <h1 className="text-lg font-bold tracking-wide">Voucher Belanja</h1>
                    <div className="w-10"></div> {/* Placeholder to keep header justified */}
                </div>

                <div className="px-6 pb-8 pt-2 relative z-10 text-center">
                    <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm border border-white/20">
                        <Tag size={32} className="text-white drop-shadow-md" />
                    </div>
                    <h2 className="text-2xl font-extrabold tracking-tight drop-shadow-sm">Voucher Spesial</h2>
                    <p className="text-indigo-100 text-sm mt-1 font-medium">Gunakan kode di halaman checkout</p>
                </div>
            </div>

            {/* List Voucher */}
            <div className="p-5 -mt-4 relative z-20 space-y-4">
                {loading ? (
                    <div className="bg-white rounded-xl shadow-sm p-8 flex flex-col items-center justify-center border border-slate-100">
                        <Loader2 className="animate-spin text-indigo-500 mb-3" size={32} />
                        <p className="text-sm font-medium text-slate-500">Mencari promo terbaik...</p>
                    </div>
                ) : vouchers.length > 0 ? (
                    vouchers.map((v) => (
                        <div key={v.id} className="bg-white rounded-2xl shadow-md border border-slate-100 overflow-hidden relative">
                            {/* Dekorasi potong tepi seperti tiket sungguhan */}
                            <div className="absolute top-1/2 -left-3 w-6 h-6 bg-slate-50 rounded-full -translate-y-1/2 border-r border-slate-100"></div>
                            <div className="absolute top-1/2 -right-3 w-6 h-6 bg-slate-50 rounded-full -translate-y-1/2 border-l border-slate-100"></div>
                            
                            <div className="p-5 pl-8 border-b border-dashed border-slate-200 bg-gradient-to-r from-amber-50 to-white">
                                <h3 className="text-lg font-extrabold text-slate-800">
                                    {v.discount_type === 'percentage' 
                                        ? `Diskon ${v.discount_value}%` 
                                        : `Potongan ${formatCurrency(v.discount_value)}`}
                                </h3>
                                <p className="text-xs text-slate-500 font-medium mt-1">
                                    {v.min_order_amount > 0 ? `Min. blj ${formatCurrency(v.min_order_amount)}` : 'Tanpa minimal belanja'}
                                    {v.min_order_amount > 0 && v.max_discount_amount > 0 ? ' • ' : ''}
                                    {v.max_discount_amount > 0 ? `Maks. potongan ${formatCurrency(v.max_discount_amount)}` : ''}
                                </p>
                            </div>

                            <div className="p-4 px-6 bg-white flex items-center justify-between gap-4">
                                <div className="flex-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Kode Voucher</p>
                                    <p className="text-xl font-black text-indigo-600 font-mono tracking-widest">{v.code}</p>
                                    <p className="text-[10px] font-medium text-slate-400 mt-1">
                                        {v.end_date ? `Berakhir: ${new Date(v.end_date).toLocaleDateString('id-ID')}` : 'Berlaku selamanya'}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleCopy(v.code)}
                                    className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                                        copiedCode === v.code 
                                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200' 
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                                >
                                    {copiedCode === v.code ? <Check size={16} /> : <Copy size={16} />}
                                    {copiedCode === v.code ? 'Tersalin' : 'Salin'}
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-16 flex flex-col items-center bg-white rounded-2xl border border-slate-100 shadow-sm">
                        <Tag size={40} className="text-slate-300 mb-3" />
                        <h3 className="text-base font-bold text-slate-800">Yah, voucher belum tersedia</h3>
                        <p className="text-sm text-slate-400 mt-1 px-8">Saat ini belum ada voucher aktif. Cek lagi nanti ya!</p>
                        <button 
                            onClick={() => router.push('/')}
                            className="mt-6 px-6 py-2.5 bg-indigo-50 text-indigo-600 font-bold text-sm rounded-full"
                        >
                            Belanja Sekarang
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
