"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { ArrowLeft, Plus, Trash2, Loader2, Pencil, CheckCircle2, XCircle, Tag, Eye, EyeOff } from "lucide-react"
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
            console.error(error)
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
        <div className="min-h-screen bg-slate-50/80 font-sans max-w-md mx-auto pb-10">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
                <div className="flex items-center justify-between px-5 pt-12 pb-4">
                    <div className="flex items-center gap-3">
                        <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                            <ArrowLeft size={20} strokeWidth={2.5} />
                        </button>
                        <div>
                            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Kelola Voucher</h1>
                            <p className="text-[10px] font-medium text-slate-400">Daftar diskon promo</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-5 space-y-4">
                <Link
                    href="/admin/vouchers/add"
                    className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold text-sm transition-all active:scale-[0.98] shadow-sm shadow-indigo-100"
                >
                    <Plus size={18} />
                    <span>Buat Voucher Baru</span>
                </Link>

                {/* LIST VOUCHERS */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                        <Loader2 className="animate-spin mb-3" size={28} />
                        <p className="text-xs font-medium">Memuat voucher...</p>
                    </div>
                ) : vouchers.length > 0 ? (
                    <div className="space-y-3">
                        {vouchers.map((v) => (
                            <div
                                key={v.id}
                                className={`bg-white rounded-xl border shadow-sm p-4 transition-all ${v.is_active ? 'border-indigo-100' : 'border-slate-100 opacity-60'}`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-md text-xs font-bold font-mono tracking-wider">
                                                {v.code}
                                            </span>
                                            {!v.is_active && (
                                                <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase">
                                                    Nonaktif
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm font-bold text-slate-800">
                                            {v.discount_type === 'percentage' 
                                                ? `Diskon ${v.discount_value}%` 
                                                : `Potongan ${formatCurrency(v.discount_value)}`}
                                        </p>
                                        {(v.min_order_amount > 0 || v.max_discount_amount > 0) && (
                                            <p className="text-[10px] text-slate-500 mt-1">
                                                {v.min_order_amount > 0 ? `Min. blj ${formatCurrency(v.min_order_amount)}` : ''}
                                                {v.min_order_amount > 0 && v.max_discount_amount > 0 ? ' • ' : ''}
                                                {v.max_discount_amount > 0 ? `Maks. diskon ${formatCurrency(v.max_discount_amount)}` : ''}
                                            </p>
                                        )}
                                        {/* Usage Info */}
                                        <div className="mt-2 text-[10px] font-medium text-slate-400 flex items-center gap-4">
                                            <span>Terpakai: {v.used_count || 0} {v.usage_limit ? `/ ${v.usage_limit}` : ''}</span>
                                            {v.end_date && (
                                                <span className={new Date(v.end_date) < new Date() ? 'text-red-500' : ''}>
                                                    Exp: {new Date(v.end_date).toLocaleDateString("id-ID")}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="flex flex-col items-center gap-2 ml-3">
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => toggleActive(v.id, v.is_active)}
                                                disabled={processingId === v.id}
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                title={v.is_active ? "Nonaktifkan Voucher" : "Aktifkan Voucher"}
                                            >
                                                {v.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
                                            </button>
                                            <Link
                                                href={`/admin/vouchers/edit/${v.id}`}
                                                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                                            >
                                                <Pencil size={16} />
                                            </Link>
                                            <button
                                                onClick={() => deleteVoucher(v.id)}
                                                disabled={processingId === v.id}
                                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                            >
                                                {processingId === v.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-16 flex flex-col items-center border-2 border-dashed border-slate-200 rounded-2xl bg-white">
                        <Tag size={32} className="text-slate-300 mb-3" />
                        <p className="text-sm font-semibold text-slate-700 mb-1">Belum Ada Voucher</p>
                        <p className="text-xs text-slate-400">Buat voucher pertama Anda untuk menarik pembeli.</p>
                    </div>
                )}
            </div>
        </div>
    )
}
