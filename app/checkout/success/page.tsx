"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Check, Home, ShoppingBag, PartyPopper, Loader2, ShieldCheck } from "lucide-react"

// --- Bagian 1: Konten Utama Halaman ---
function SuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  
  const method = searchParams.get('method')
  const transactionStatus = searchParams.get('transaction_status') 

  useEffect(() => {
    setMounted(true)
    if (transactionStatus === 'pending') {
      router.replace('/orders')
      return
    }
    localStorage.removeItem('pendingOrder')
  }, [transactionStatus, router])

  // Loading State yang Clean
  if (!mounted || transactionStatus === 'pending') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
        <p className="text-slate-400 font-medium text-sm">Memverifikasi...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans max-w-md mx-auto flex flex-col items-center justify-center px-6 relative overflow-hidden">
      
      {/* Background Decoration - Simplified */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-150 h-150 bg-indigo-50 rounded-full blur-3xl opacity-60 z-0"></div>

      <div className="z-10 flex flex-col items-center w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* ICON SUKSES - Clean & Solid */}
        <div className="relative mb-8">
          {/* Ring Luar */}
          <div className="absolute inset-0 bg-indigo-100 rounded-full scale-[1.4] animate-pulse"></div>
          
          {/* Icon Container */}
          <div className="relative w-24 h-24 bg-linear-to-tr from-indigo-600 to-indigo-500 rounded-full flex items-center justify-center shadow-xl shadow-indigo-200 border-4 border-white">
            {method === 'cod' ? (
              <Check size={48} className="text-white" strokeWidth={3} />
            ) : (
              <PartyPopper size={42} className="text-white" strokeWidth={2} />
            )}
          </div>
        </div>

        {/* TEXT CONTENT */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            {method === 'cod' ? 'Pesanan Dibuat!' : 'Pembayaran Berhasil!'}
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
            {method === 'cod' 
              ? 'Pesanan COD kamu sudah dikonfirmasi. Siapkan uang pas saat kurir tiba.'
              : 'Terima kasih! Pembayaran diterima, pesanan sedang diproses.'}
          </p>
        </div>

        {/* KARTU DETAIL - Clean Card Style */}
        <div className="w-full bg-white rounded-2xl p-5 mb-8 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0">
              <ShieldCheck size={24} className="text-indigo-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Status Transaksi</p>
              <p className="text-base font-bold text-slate-800 mt-0.5">
                {method === 'cod' ? 'Konfirmasi COD' : 'Lunas'}
              </p>
            </div>
            <div className="bg-green-50 text-green-600 text-[10px] font-bold px-2.5 py-1 rounded-full border border-green-100 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
              BERHASIL
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-sm">
             <span className="text-slate-500">Metode</span>
             <span className="font-semibold text-slate-700">
               {method === 'cod' ? 'Bayar di Tempat (COD)' : 'Pembayaran Online'}
             </span>
          </div>
        </div>

        {/* TOMBOL AKSI - Indigo Accent */}
        <div className="w-full space-y-3">
          <button 
            onClick={() => router.push('/orders')}
            className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-md shadow-indigo-200 hover:bg-indigo-700"
          >
            <ShoppingBag size={18} />
            Lihat Detail Pesanan
          </button>
          
          <button 
            onClick={() => router.push('/')}
            className="w-full bg-white text-slate-600 border border-slate-200 py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform hover:bg-slate-50"
          >
            <Home size={18} />
            Kembali ke Beranda
          </button>
        </div>
      </div>
    </div>
  )
}

// --- Bagian 2: Wrapper Suspense ---
export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}