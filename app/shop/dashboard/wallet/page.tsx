"use client"

import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

declare global {
    interface Window {
        snap: any
    }
}

export default function ShopWalletPage() {
    const router = useRouter()
    const [shop, setShop] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    // Topup modal
    const [showTopup, setShowTopup] = useState(false)
    const [topupAmount, setTopupAmount] = useState("")
    const [topupLoading, setTopupLoading] = useState(false)

    // Withdraw modal
    const [showWithdraw, setShowWithdraw] = useState(false)
    const [wdAmount, setWdAmount] = useState("")
    const [wdBank, setWdBank] = useState("")
    const [wdAccount, setWdAccount] = useState("")
    const [wdName, setWdName] = useState("")
    const [wdLoading, setWdLoading] = useState(false)

    const [toastMsg, setToastMsg] = useState<{ msg: string; type: "success" | "error" } | null>(null)

    const showToast = (msg: string, type: "success" | "error" = "success") => {
        setToastMsg({ msg, type })
        setTimeout(() => setToastMsg(null), 3500)
    }

    const fetchData = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.push("/login"); return }

        const { data: shopData } = await supabase
            .from("shops")
            .select("id, name, balance, owner_id")
            .eq("owner_id", session.user.id)
            .single()

        if (!shopData) {
            router.replace("/shop/create")
            return
        }

        const { data: walletData } = await supabase
            .from("wallets")
            .select("balance")
            .eq("user_id", session.user.id)
            .maybeSingle()

        setShop({ ...shopData, balance: walletData?.balance ?? shopData.balance })
        setLoading(false)
    }, [router])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    // Load Midtrans Snap script
    useEffect(() => {
        if (document.querySelector('script[src*="snap.js"]')) return
        const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || ""
        const isSandbox = clientKey.startsWith('SB-')
        const scriptSrc = isSandbox 
          ? "https://app.sandbox.midtrans.com/snap/snap.js"
          : "https://app.midtrans.com/snap/snap.js"

        const script = document.createElement("script")
        script.src = scriptSrc
        script.setAttribute("data-client-key", clientKey)
        script.async = true
        document.head.appendChild(script)
    }, [])

    const handleTopup = async () => {
        const amount = parseInt(topupAmount.replace(/\D/g, ""))
        if (isNaN(amount) || amount < 10000) { showToast("Minimal topup Rp 10.000", "error"); return }
        
        setTopupLoading(true)
        try {
            const res = await fetch("/api/shop/topup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)

            setShowTopup(false)
            setTopupAmount("")

            window.snap.pay(data.token, {
                onSuccess: () => { showToast("Topup berhasil!"); fetchData() },
                onPending: () => { showToast("Menunggu konfirmasi pembayaran..."); fetchData() },
                onError: () => { showToast("Pembayaran gagal.", "error") },
                onClose: () => { showToast("Pembayaran dibatalkan.", "error") },
            })
        } catch (err: any) {
            showToast(err.message || "Gagal membuat topup.", "error")
        } finally {
            setTopupLoading(false)
        }
    }

    const handleWithdraw = async () => {
        const amount = parseInt(wdAmount.replace(/\D/g, ""))
        if (isNaN(amount) || amount < 10000) { showToast("Minimal penarikan Rp 10.000", "error"); return }
        if (!wdBank || !wdAccount || !wdName) { showToast("Lengkapi semua data rekening.", "error"); return }
        
        setWdLoading(true)
        try {
            const res = await fetch("/api/shop/withdraw", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount, bank_name: wdBank, account_number: wdAccount, account_name: wdName }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            
            setShowWithdraw(false)
            setWdAmount(""); setWdBank(""); setWdAccount(""); setWdName("")
            showToast("Pengajuan penarikan dana berhasil!")
            fetchData()
        } catch (err: any) {
            showToast(err.message || "Gagal membuat penarikan.", "error")
        } finally {
            setWdLoading(false)
        }
    }

    const formatRp = (v: number) => `Rp ${Math.abs(v).toLocaleString("id-ID")}`

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <Icons.Loader2 className="animate-spin text-indigo-600" size={32} />
        </div>
    )
    if (!shop) return null

    const balance: number = shop.balance || 0

    return (
        <div className="min-h-screen bg-[#F5F5F5] max-w-md mx-auto font-sans pb-12">
            {toastMsg && (
                <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-2xl shadow-xl text-sm font-semibold text-white transition-all ${toastMsg.type === "success" ? "bg-emerald-500" : "bg-red-500"}`}>
                    {toastMsg.msg}
                </div>
            )}

            {/* HEADER */}
            <div className="bg-white border-b border-black/5 sticky top-0 z-40">
                <div className="flex items-center justify-between px-4 h-14">
                    <div className="flex items-center gap-3">
                        <Link href="/shop/dashboard" className="p-1 -ml-1 text-indigo-600">
                            <Icons.ArrowLeft size={24} />
                        </Link>
                        <h1 className="text-lg font-medium text-slate-800">Keuangan</h1>
                    </div>
                    <button className="text-indigo-600">
                        <Icons.Settings size={22} />
                    </button>
                </div>
            </div>

            <div className="p-3">
                {/* Total Saldo Card */}
                <div className="bg-white rounded-xl shadow-sm border border-black/5 p-4 mb-3">
                    <div className="flex justify-between items-center mb-2">
                        <div className="flex gap-1 items-center">
                            <h2 className="text-[13px] font-medium text-slate-800">Total Saldo Transaksi</h2>
                            <Icons.ChevronRight size={14} className="text-slate-400" />
                        </div>
                        <button 
                            onClick={() => setShowWithdraw(true)}
                            disabled={balance <= 0}
                            className={`px-3 py-1.5 rounded text-xs font-semibold ${balance > 0 ? "bg-slate-100 text-slate-800" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}
                        >
                            Tarik Dana
                        </button>
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-sm font-semibold text-indigo-600">Rp</span>
                        <span className="text-3xl font-semibold text-indigo-600">{Math.abs(balance).toLocaleString("id-ID")}</span>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors -mx-4 px-4 pb-1">
                        <div className="flex gap-2 items-center">
                            <Icons.CreditCard size={18} className="text-indigo-500" />
                            <span className="text-sm font-medium text-slate-800">Penghasilan Saya</span>
                        </div>
                        <Icons.ChevronRight size={16} className="text-slate-400" />
                    </div>
                </div>

                {/* Fitur Keuangan Card */}
                <div className="bg-white rounded-xl shadow-sm border border-black/5 p-4 mb-3">
                    <h3 className="text-sm font-medium text-slate-800 mb-4">Fitur Keuangan</h3>
                    <div className="flex gap-6">
                        <button onClick={() => setShowTopup(true)} className="flex flex-col items-center gap-2 group">
                            <div className="w-10 h-10 rounded-full border border-black/5 shadow-sm flex items-center justify-center bg-indigo-50 group-hover:bg-indigo-100 transition-colors">
                                <Icons.PlusCircle size={20} className="text-indigo-600" />
                            </div>
                            <span className="text-[11px] text-slate-600 text-center">Isi Saldo</span>
                        </button>
                        <button className="flex flex-col items-center gap-2">
                            <div className="w-10 h-10 rounded-full border border-black/5 shadow-sm flex items-center justify-center bg-white">
                                <Icons.Banknote size={20} className="text-amber-500" />
                            </div>
                            <span className="text-[11px] text-slate-600 text-center leading-tight">Pinjaman<br/>Untuk Penjual</span>
                        </button>
                    </div>
                </div>

                {/* Status Verifikasi */}
                <div className="bg-white rounded-xl shadow-sm border border-black/5 p-4 mb-3 flex justify-between items-center">
                    <span className="text-sm text-slate-600">Status Verifikasi</span>
                    <div className="flex items-center gap-1.5 text-indigo-600 text-[13px] font-medium">
                        <Icons.AlertCircle size={14} /> Perlu Diverifikasi
                    </div>
                </div>

                {/* Rekomendasi Untukmu */}
                <div className="bg-white rounded-xl shadow-sm border border-black/5 p-4">
                    <h3 className="text-sm font-medium text-slate-800 mb-4">Rekomendasi Untukmu</h3>
                    
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-50 pb-4">
                            <div className="flex gap-3 items-center">
                                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                                    <Icons.CreditCard size={20} className="text-indigo-600" />
                                </div>
                                <div>
                                    <h4 className="text-[13px] font-semibold text-slate-800">Pinjam Plus</h4>
                                    <p className="text-[11px] text-slate-500">100X GRATIS transfer antarbank</p>
                                    <p className="text-[10px] text-indigo-600 mt-0.5 border border-indigo-200 inline-block px-1 rounded bg-indigo-50">15JT pengguna telah berhemat</p>
                                </div>
                            </div>
                            <button className="bg-indigo-600 text-white px-3 py-1.5 rounded text-[11px] font-semibold flex-shrink-0">Hubungkan</button>
                        </div>
                        
                        <div className="flex justify-between items-center border-b border-slate-50 pb-4">
                            <div className="flex gap-3 items-center">
                                <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
                                    <Icons.Banknote size={20} className="text-amber-600" />
                                </div>
                                <div>
                                    <h4 className="text-[13px] font-semibold text-slate-800">Pinjaman Modal Toko</h4>
                                    <p className="text-[11px] text-slate-500 line-clamp-1">Kembangkan tokomu dengan modal eksklusif!</p>
                                </div>
                            </div>
                            <button className="bg-indigo-600 text-white px-3 py-1.5 rounded text-[11px] font-semibold flex-shrink-0">Pelajari</button>
                        </div>

                        <div className="flex justify-between items-center pb-2">
                            <div className="flex gap-3 items-center">
                                <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
                                    <Icons.Package size={20} className="text-indigo-600" />
                                    <Icons.ShieldCheck size={10} className="text-indigo-600 absolute ml-3 mt-3 bg-white rounded-full" />
                                </div>
                                <div className="min-w-0 pr-2">
                                    <h4 className="text-[13px] font-semibold text-slate-800">Asuransi Pengiriman</h4>
                                    <p className="text-[11px] text-slate-500 line-clamp-1">Kompensasi atas barang hilang/rusak</p>
                                    <p className="text-[10px] text-indigo-600 mt-0.5 border border-indigo-200 inline-block px-1 rounded bg-indigo-50 truncate max-w-full">
                                        1.000.000 Penjual telah mendaftar
                                    </p>
                                </div>
                            </div>
                            <button className="bg-indigo-600 text-white px-3 py-1.5 rounded text-[11px] font-semibold flex-shrink-0">Daftar</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Topup Modal */}
            {showTopup && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end justify-center backdrop-blur-sm transition-opacity" onClick={() => setShowTopup(false)}>
                    <div className="bg-white rounded-t-3xl p-6 w-full max-w-md shadow-2xl animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
                        <h2 className="text-lg font-black text-slate-900 mb-1">Isi Saldo Warung</h2>
                        <p className="text-xs text-slate-500 mb-5">Untuk keamanan toko & buka blokir COD</p>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Nominal Topup</label>
                        <div className="relative mb-3">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">Rp</span>
                            <input
                                type="number"
                                placeholder="Min. 10.000"
                                value={topupAmount}
                                onChange={e => setTopupAmount(e.target.value)}
                                className="w-full pl-12 pr-4 py-4 rounded-2xl border-2 border-slate-100 focus:border-indigo-600 outline-none text-slate-900 font-bold text-lg bg-slate-50 transition-colors"
                            />
                        </div>
                        <button
                            onClick={handleTopup}
                            disabled={topupLoading || !topupAmount}
                            className="w-full bg-indigo-600 text-white rounded-2xl py-4 font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 hover:bg-indigo-700"
                        >
                            {topupLoading ? <Icons.Loader2 className="animate-spin" size={18} /> : <Icons.CreditCard size={18} />}
                            {topupLoading ? "Memproses..." : "Bayar"}
                        </button>
                    </div>
                </div>
            )}

            {/* Withdraw Modal */}
            {showWithdraw && (
                <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end justify-center backdrop-blur-sm transition-opacity" onClick={() => setShowWithdraw(false)}>
                    <div className="bg-white rounded-t-[32px] p-6 w-full max-w-md shadow-2xl animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6" />
                        <h2 className="text-xl font-black text-slate-900 mb-1">Tarik Omzet Toko</h2>
                        <p className="text-xs text-slate-500 mb-5">Maksimal penarikan: <span className="font-bold text-slate-800">{formatRp(balance)}</span></p>
                        
                        <div className="space-y-4 mb-8">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Nominal Pencairan</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">Rp</span>
                                    <input type="number" placeholder="Min. 20000" value={wdAmount} onChange={e => setWdAmount(e.target.value)} max={balance}
                                        className="w-full pl-12 pr-4 py-3.5 rounded-2xl border-2 border-slate-100 focus:border-slate-400 outline-none text-slate-900 font-bold bg-slate-50 transition-colors" />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Bank Tujuan</label>
                                    <input type="text" placeholder="BCA / Mandiri / Dana" value={wdBank} onChange={e => setWdBank(e.target.value)}
                                        className="w-full px-4 py-3.5 rounded-2xl border-2 border-slate-100 focus:border-slate-400 outline-none text-slate-900 font-semibold bg-slate-50 transition-colors" />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Nomor Rekening / HP</label>
                                    <input type="text" placeholder="No. Rek / HP" value={wdAccount} onChange={e => setWdAccount(e.target.value)}
                                        className="w-full px-4 py-3.5 rounded-2xl border-2 border-slate-100 focus:border-slate-400 outline-none text-slate-900 font-semibold bg-slate-50 transition-colors" />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 mb-1.5">Nama Pemilik Rekening</label>
                                <input type="text" placeholder="Atas Nama" value={wdName} onChange={e => setWdName(e.target.value)}
                                    className="w-full px-4 py-3.5 rounded-2xl border-2 border-slate-100 focus:border-slate-400 outline-none text-slate-900 font-semibold bg-slate-50 transition-colors" />
                            </div>
                        </div>
                        
                        <button
                            onClick={handleWithdraw}
                            disabled={wdLoading || !wdAmount || !wdBank || !wdAccount || !wdName}
                            className="w-full bg-slate-900 text-white rounded-2xl py-4 font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-all hover:bg-slate-800"
                        >
                            {wdLoading ? <Icons.Loader2 className="animate-spin" size={18} /> : <Icons.ArrowUpFromLine size={18} />}
                            {wdLoading ? "Memproses Pengajuan..." : "Ajukan Pencairan Dana"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
