"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { ArrowLeft, Loader2, Check } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export default function AddVoucherPage() {
    const router = useRouter()
    const [saving, setSaving] = useState(false)

    const [form, setForm] = useState({
        code: "",
        discount_type: "fixed", // 'fixed' | 'percentage'
        discount_value: "",
        min_order_amount: "",
        max_discount_amount: "",
        usage_limit: "",
        start_date: "",
        end_date: "",
        is_active: true
    })

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setForm(prev => ({ ...prev, [name]: checked }));
        } else {
            setForm(prev => ({ ...prev, [name]: value }));
        }
    }

    const generateCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        const length = 8
        let result = ''
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        setForm(prev => ({ ...prev, code: result }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!form.code || !form.discount_value) {
            toast.error("Kode voucher & nilai diskon tidak boleh kosong!")
            return
        }

        setSaving(true)

        // Parsing numbers
        const payload = {
            code: form.code.toUpperCase(),
            discount_type: form.discount_type,
            discount_value: Number(form.discount_value) || 0,
            min_order_amount: form.min_order_amount ? Number(form.min_order_amount) : 0,
            max_discount_amount: form.discount_type === 'percentage' && form.max_discount_amount ? Number(form.max_discount_amount) : null,
            usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
            start_date: form.start_date ? new Date(form.start_date).toISOString() : new Date().toISOString(),
            end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
            is_active: form.is_active,
            used_count: 0
        }

        if (payload.discount_type === 'percentage' && payload.discount_value > 100) {
            toast.error("Diskon persentase tidak boleh lebih dari 100%")
            setSaving(false)
            return
        }

        const { error } = await supabase.from("vouchers").insert([payload])

        if (error) {
            if (error.code === '23505') { // unique violation
                toast.error("Kode voucher ini sudah digunakan. Coba kode lain.")
            } else {
                toast.error("Gagal menambahkan voucher")
            }
            console.error(error)
        } else {
            toast.success("Voucher berhasil ditambahkan!")
            router.push("/admin/vouchers")
        }
        setSaving(false)
    }

    return (
        <div className="min-h-screen bg-slate-50/80 font-sans max-w-md mx-auto pb-10">
            {/* HEADER */}
            <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
                <div className="flex items-center gap-3 px-5 pt-12 pb-4">
                    <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                        <ArrowLeft size={20} strokeWidth={2.5} />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900 tracking-tight">Buat Voucher</h1>
                        <p className="text-[10px] font-medium text-slate-400">Promosi diskon pelanggan</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
                    
                    {/* KODE VOUCHER */}
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Kode Voucher *</label>
                            <button type="button" onClick={generateCode} className="text-[10px] text-indigo-600 font-bold hover:underline">
                                Auto Generate
                            </button>
                        </div>
                        <input
                            type="text"
                            name="code"
                            required
                            value={form.code}
                            onChange={(e) => setForm(prev => ({...prev, code: e.target.value.toUpperCase()}))}
                            placeholder="Contoh: PROMO2026"
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-indigo-500 uppercase font-mono tracking-wider font-bold"
                            style={{ textTransform: 'uppercase' }}
                        />
                    </div>

                    {/* TIPE DISKON */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Tipe Diskon *</label>
                        <select
                            name="discount_type"
                            value={form.discount_type}
                            onChange={handleChange}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-indigo-500 appearance-none font-semibold"
                        >
                            <option value="fixed">Potongan Harga Tetap (Rp)</option>
                            <option value="percentage">Persentase (%)</option>
                        </select>
                    </div>

                    {/* NILAI DISKON */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Nilai Diskon *</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <span className="text-slate-400 font-medium text-sm">
                                    {form.discount_type === 'fixed' ? 'Rp' : ''}
                                </span>
                            </div>
                            <input
                                type="number"
                                name="discount_value"
                                required
                                min="1"
                                value={form.discount_value}
                                onChange={handleChange}
                                placeholder={form.discount_type === 'fixed' ? "10000" : "50"}
                                className={`w-full py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-indigo-500 ${form.discount_type === 'fixed' ? 'pl-10 pr-4' : 'px-4'}`}
                            />
                            {form.discount_type === 'percentage' && (
                                <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                                    <span className="text-slate-400 font-medium text-sm">%</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* MINIMAL ORDER */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Minimal Pembelian (Opsional)</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <span className="text-slate-400 font-medium text-sm">Rp</span>
                            </div>
                            <input
                                type="number"
                                name="min_order_amount"
                                min="0"
                                value={form.min_order_amount}
                                onChange={handleChange}
                                placeholder="0"
                                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">Kosongkan jika tanpa minimal order</p>
                    </div>

                    {/* MAKSIMAL DISKON (hanya jika persentase) */}
                    {form.discount_type === 'percentage' && (
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Maksimal Diskon (Opsional)</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <span className="text-slate-400 font-medium text-sm">Rp</span>
                                </div>
                                <input
                                    type="number"
                                    name="max_discount_amount"
                                    min="0"
                                    value={form.max_discount_amount}
                                    onChange={handleChange}
                                    placeholder="0"
                                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">Batas maksimal nominal diskon yang diberikan</p>
                        </div>
                    )}
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm space-y-4">
                    {/* BATAS PENGGUNAAN */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Batas Penggunaan (Kuota)</label>
                        <input
                            type="number"
                            name="usage_limit"
                            min="1"
                            value={form.usage_limit}
                            onChange={handleChange}
                            placeholder="Contoh: 100"
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Kosongkan jika kuota tidak terbatas</p>
                    </div>

                    {/* TANGGAL MULAI */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Tanggal Mulai Berlaku</label>
                        <input
                            type="datetime-local"
                            name="start_date"
                            value={form.start_date}
                            onChange={handleChange}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Kosongkan untuk berlaku sekarang</p>
                    </div>

                    {/* TANGGAL BERAKHIR */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Tanggal Berakhir</label>
                        <input
                            type="datetime-local"
                            name="end_date"
                            value={form.end_date}
                            onChange={handleChange}
                            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <p className="text-[10px] text-slate-400 mt-1">Kosongkan jika voucher berlaku selamanya</p>
                    </div>

                    {/* STATUS AKTIF */}
                    <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 cursor-pointer">
                        <input
                            type="checkbox"
                            name="is_active"
                            checked={form.is_active}
                            onChange={handleChange}
                            className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                        />
                        <div>
                            <p className="text-sm font-bold text-slate-800">Aktifkan Voucher</p>
                            <p className="text-[10px] text-slate-500">Voucher dapat digunakan oleh pelanggan</p>
                        </div>
                    </label>
                </div>

                <div className="pt-4 pb-8">
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:bg-slate-400 transition-all shadow-md shadow-indigo-200 active:scale-[0.98]"
                    >
                        {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                        <span>{saving ? "Menyimpan..." : "Simpan Voucher"}</span>
                    </button>
                    <p className="text-center text-[10px] text-slate-400 mt-3 px-4">
                        Pastikan semua informasi promo diskon sudah sesuai.
                    </p>
                </div>
            </form>
        </div>
    )
}
