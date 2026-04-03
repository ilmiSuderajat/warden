"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { ArrowLeft, Plus, Trash2, Loader2, Pencil, CheckCircle2, XCircle, Tag, Eye, EyeOff, ChevronRight, Ticket } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function AdminVouchersPage() {
    const router = useRouter()
    const [vouchers, setVouchers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [processingId, setProcessingId] = useState<string | null>(null)

    const fetchVouchers = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from("vouchers")
            .select("*")
            .order("created_at", { ascending: false })

        if (error) {
            toast.error("Gagal memuat voucher")
        } else if (data) {
            setVouchers(data)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchVouchers()
    }, [])

    const toggleActive = async (id: string, current: boolean) => {
        setProcessingId(id)
        const { error } = await supabase
            .from("vouchers")
            .update({ is_active: !current })
            .eq("id", id)

        if (error) {
            toast.error("Gagal mengupdate status voucher")
        } else {
            setVouchers(prev => prev.map(v => v.id === id ? { ...v, is_active: !current } : v))
            toast.success(!current ? "Voucher diaktifkan" : "Voucher dinonaktifkan")
        }
        setProcessingId(null)
    }

    const deleteVoucher = async (id: string) => {
        if (!confirm("Hapus voucher ini secara permanen?")) return
        setProcessingId(id)
        const { error } = await supabase.from("vouchers").delete().eq("id", id)

        if (error) {
            toast.error("Gagal menghapus voucher")
        } else {
            setVouchers(prev => prev.filter(v => v.id !== id))
            toast.success("Voucher dihapus")
        }
        setProcessingId(null)
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amount)
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
                            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">Kelola Voucher</h1>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Diskon & Promo Tiket</p>
                        </div>
                    </div>
                    <div className="px-2.5 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-extrabold rounded-lg border border-indigo-100">
                        {vouchers.length} Terdaftar
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-5">
                {/* UPGRADE: Floating Add Button Card */}
                <Link
                    href="/admin/vouchers/add"
                    className="group w-full bg-indigo-600 p-4 rounded-3xl flex items-center justify-between text-white shadow-xl shadow-indigo-100 active:scale-[0.98] transition-all overflow-hidden relative"
                >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 blur-2xl"></div>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-2 bg-white/20 rounded-2xl"><Plus size={20} /></div>
                        <div className="text-left">
                            <p className="text-sm font-extrabold">Buat Voucher Baru</p>
                            <p className="text-[10px] text-indigo-100 font-medium">Tambah kode promo untuk pelanggan</p>
                        </div>
                    </div>
                    <ChevronRight size={18} className="text-indigo-200" />
                </Link>

                {/* LIST VOUCHERS PREMIUM */}
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => <div key={i} className="h-32 bg-white rounded-3xl animate-pulse border border-slate-100" />)}
                    </div>
                ) : vouchers.length > 0 ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 ml-1">
                            <div className="w-1 h-3.5 bg-indigo-500 rounded-full"></div>
                            <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">Daftar Aktif</h3>
                        </div>
                        {vouchers.map((v) => (
                            <div
                                key={v.id}
                                className={`bg-white rounded-[2rem] border shadow-sm p-5 transition-all group relative overflow-hidden ${v.is_active ? 'border-slate-100 bg-white' : 'border-slate-200 bg-slate-50 opacity-60'}`}
                            >
                                {/* Decorative "ticket" circle cuts */}
                                <div className="absolute top-1/2 -left-2.5 w-5 h-5 bg-slate-50 rounded-full border border-slate-100 shadow-inner -translate-y-1/2" />
                                <div className="absolute top-1/2 -right-2.5 w-5 h-5 bg-slate-50 rounded-full border border-slate-100 shadow-inner -translate-y-1/2" />

                                <div className="flex items-start justify-between relative z-10">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="bg-slate-100 text-slate-800 border border-slate-200 px-3 py-1 rounded-xl text-xs font-black font-mono tracking-widest shadow-sm group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all duration-300 uppercase">
                                                {v.code}
                                            </span>
                                            {v.is_active ? (
                                                <div className="flex items-center gap-1 text-[8px] font-extrabold text-emerald-500 uppercase tracking-tighter bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                                    <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" /> Aktif
                                                </div>
                                            ) : (
                                                <div className="text-[8px] font-extrabold text-slate-400 uppercase tracking-tighter bg-slate-100 px-2 py-0.5 rounded-full">OFFLINE</div>
                                            )}
                                        </div>
                                        
                                        <h3 className="text-base font-black text-slate-900 leading-tight">
                                            {v.discount_type === 'percentage' 
                                                ? `DISKON ${v.discount_value}%` 
                                                : `POTONGAN ${formatCurrency(v.discount_value)}`}
                                        </h3>

                                        <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3">
                                            {(v.min_order_amount > 0) && (
                                                <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
                                                    <Ticket size={10} strokeWidth={2.5} /> Min. {formatCurrency(v.min_order_amount)}
                                                </div>
                                            )}
                                            {v.end_date && (
                                                <div className={`flex items-center gap-1.5 text-[9px] font-bold px-2 py-1 rounded-lg ${new Date(v.end_date) < new Date() ? 'text-red-500 bg-red-50' : 'text-slate-400 bg-slate-50'}`}>
                                                    <Clock size={10} strokeWidth={2.5} /> Exp: {new Date(v.end_date).toLocaleDateString("id-ID")}
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-3 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-indigo-500 rounded-full"
                                                style={{ width: `${v.usage_limit ? Math.min((v.used_count || 0) / v.usage_limit * 100, 100) : 0}%` }}
                                            />
                                        </div>
                                        <p className="text-[9px] font-bold text-slate-400 mt-1.5 uppercase tracking-tighter">
                                            Terpakai: <span className="text-slate-700">{v.used_count || 0}</span> {v.usage_limit ? `/ ${v.usage_limit}` : '(Tanpa Batas)'}
                                        </p>
                                    </div>
                                    
                                    <div className="flex flex-col gap-2 shrink-0">
                                        <button
                                            onClick={() => toggleActive(v.id, v.is_active)}
                                            disabled={processingId === v.id}
                                            className={`p-2.5 rounded-2xl shadow-sm transition-all ${v.is_active ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100' : 'text-slate-400 bg-slate-100 hover:bg-slate-200'}`}
                                        >
                                            {v.is_active ? <Eye size={18} strokeWidth={2.5} /> : <EyeOff size={18} strokeWidth={2.5} />}
                                        </button>
                                        <Link
                                            href={`/admin/vouchers/edit/${v.id}`}
                                            className="p-2.5 text-slate-400 bg-slate-50 hover:text-amber-600 hover:bg-amber-100 rounded-2xl shadow-sm transition-all"
                                        >
                                            <Pencil size={18} strokeWidth={2.5} />
                                        </Link>
                                        <button
                                            onClick={() => deleteVoucher(v.id)}
                                            disabled={processingId === v.id}
                                            className="p-2.5 text-slate-400 bg-slate-50 hover:text-red-500 hover:bg-red-100 rounded-2xl shadow-sm transition-all"
                                        >
                                            {processingId === v.id ? <Loader2 size={18} className="animate-spin text-red-500" /> : <Trash2 size={18} strokeWidth={2.5} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-200 flex flex-col items-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-4"><Tag size={32} /></div>
                        <h4 className="text-sm font-bold text-slate-700">Belum Ada Voucher</h4>
                        <p className="text-[10px] text-slate-400 font-medium px-12 leading-relaxed">Buat voucher diskon pertama untuk meningkatkan loyalitas pembeli.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
