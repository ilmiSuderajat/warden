"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Check, Home, ShoppingBag, PartyPopper, Loader2 } from "lucide-react"

// --- Bagian 1: Konten Utama Halaman ---
function SuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  
  // Ambil data dari URL parameter Midtrans atau manual redirect
  const method = searchParams.get('method')
  const transactionStatus = searchParams.get('transaction_status') 

  useEffect(() => {
    setMounted(true)

    // 1. PROTEKSI: Jika statusnya pending, jangan tampilkan halaman sukses
    // User yang menutup popup Midtrans tanpa bayar akan diarahkan ke sini dengan status pending
    if (transactionStatus === 'pending') {
      router.replace('/orders')
      return
    }

    // 2. Bersihkan data order sementara dari storage agar tidak double order
    localStorage.removeItem('pendingOrder')
  }, [transactionStatus, router])

  // Cegah konten berkedip sebelum proses redirect di atas selesai
  if (!mounted || transactionStatus === 'pending') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
        <p className="text-slate-400 font-medium animate-pulse">Memverifikasi status...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans max-w-md mx-auto flex flex-col items-center justify-center px-8 relative overflow-hidden">
      
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-indigo-600 rounded-b-[100%] z-0 opacity-10"></div>

      <div className="z-10 flex flex-col items-center w-full">
        {/* ANIMASI ICON SUKSES */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-indigo-400 rounded-full scale-[1.2] animate-ping opacity-20"></div>
          <div className="absolute inset-0 bg-green-400 rounded-full scale-[1.4] animate-pulse opacity-20"></div>
          
          <div className="relative w-28 h-28 bg-linearo-tr from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-2xl shadow-green-200 border-4 border-white">
            {method === 'cod' ? (
                <Check size={52} className="text-white" strokeWidth={3} />
            ) : (
                <PartyPopper size={48} className="text-white" strokeWidth={2.5} />
            )}
          </div>
        </div>

        {/* TEXT CONTENT */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-slate-900 mb-3">
            {method === 'cod' ? 'Pesanan Dibuat!' : 'Pembayaran Berhasil!'}
          </h1>
          <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
            {method === 'cod' 
              ? 'Pesanan COD kamu sudah dikonfirmasi. Silakan siapkan uang pas saat kurir tiba.'
              : 'Terima kasih! Pembayaran kamu sudah kami terima dan pesanan sedang diproses.'}
          </p>
        </div>

        {/* KARTU DETAIL */}
        <div className="w-full bg-white rounded-3xl p-6 mb-8 border border-slate-100 shadow-xl shadow-slate-100">
          <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Metode</span>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
              {method === 'cod' ? 'Bayar di Tempat' : 'Pembayaran Online'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Status</span>
            <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                BERHASIL
            </span>
          </div>
        </div>

        {/* TOMBOL AKSI */}
        <div className="w-full space-y-3">
          <button 
            onClick={() => router.push('/orders')}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg"
          >
            <ShoppingBag size={18} />
            Lihat Detail Pesanan
          </button>
          
          <button 
            onClick={() => router.push('/')}
            className="w-full bg-white text-slate-700 border border-slate-200 py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}