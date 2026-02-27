"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, CheckCircle2, Truck, QrCode, Loader2, Wallet } from "lucide-react"

export default function PaymentPage() {
  const router = useRouter()
  const [selectedMethod, setSelectedMethod] = useState<string>('qris')
  const [loading, setLoading] = useState(false)
  const [orderInfo, setOrderInfo] = useState<{ orderId: string, totalAmount: number } | null>(null)

  // Ambil info order dari localStorage
  useEffect(() => {
    const data = localStorage.getItem('pendingOrder')
    if (data) {
      setOrderInfo(JSON.parse(data))
    } else {
      // Jika tidak ada data (akses langsung), tendang balik ke cart
      router.push('/cart')
    }
  }, [router])

  const paymentMethods = [
    { id: 'qris', name: 'QRIS (Dana, Gopay, OVO)', icon: <QrCode size={20} />, sub: 'Pembayaran instan otomatis', type: 'digital' },
    { id: 'cod', name: 'Bayar di Tempat (COD)', icon: <Truck size={20} />, sub: 'Bayar tunai ke kurir', type: 'offline' },
  ]

  const handleProcessPayment = async () => {
    if (!orderInfo) return;

    setLoading(true);
    
    if (selectedMethod === 'cod') {
      // Logika COD: Update status pesanan langsung ke 'processing' atau 'pending_cod'
      // Di sini kita skip redirect ke Duitku
      // TODO: Panggil API internal untuk update status order di Supabase menjadi 'confirmed'
      localStorage.removeItem('pendingOrder'); // Bersihkan cache
      router.push('/checkout/success?method=cod');
      return
    }

    // Logika QRIS (Integrasi Duitku)
    try {
      const response = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: orderInfo.totalAmount,
          orderId: orderInfo.orderId, // Gunakan ID dari database
          productDetails: "Pembayaran Order #" + orderInfo.orderId.slice(0, 8),
          customerName: "Customer Warden", // Idealnya ambil dari auth
          email: "customer@warden.com"
        }),
      })

      const data = await response.json()

      if (data.paymentUrl) {
        window.location.href = data.paymentUrl
      } else {
        alert("Gagal membuat transaksi: " + (data.statusMessage || "Error unknown"));
        setLoading(false);
      }
    } catch (error) {
      console.error(error)
      alert("Terjadi kesalahan jaringan.")
      setLoading(false)
    }
  }

  // Loading state saat ambil data order
  if (!orderInfo) {
     return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600" size={28} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans max-w-md mx-auto">
      <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-lg border-b border-slate-100 z-50 flex items-center px-5 max-w-md mx-auto">
        <button onClick={() => router.back()} className="p-1 -ml-1 text-slate-700">
          <ArrowLeft size={24} />
        </button>
        <h1 className="ml-3 text-lg font-bold text-slate-900">Pembayaran</h1>
      </header>

      <main className="pt-24 px-5 pb-32">
        <div className="mb-6">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 pl-1">Pilih Metode</p>
          <div className="space-y-3">
            {paymentMethods.map((method) => (
              <button
                key={method.id}
                onClick={() => setSelectedMethod(method.id)}
                disabled={loading}
                className={`w-full p-4 rounded-2xl border-2 transition-all duration-300 flex items-center justify-between group
                  ${selectedMethod === method.id 
                    ? "border-indigo-600 bg-indigo-50 shadow-md shadow-indigo-100" 
                    : "border-transparent bg-white shadow-sm hover:border-slate-200"}
                `}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl transition-colors duration-300 ${selectedMethod === method.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"}`}>
                    {method.icon}
                  </div>
                  <div className="text-left">
                    <p className={`text-sm font-bold transition-colors ${selectedMethod === method.id ? "text-indigo-900" : "text-slate-700"}`}>
                      {method.name}
                    </p>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">{method.sub}</p>
                  </div>
                </div>
                {selectedMethod === method.id && (
                  <CheckCircle2 size={22} className="text-indigo-600 animate-in zoom-in duration-200" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Wallet size={16} className="text-slate-400" />
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ringkasan</p>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 font-medium">Total Pesanan</span>
              <span className="font-bold text-slate-800">Rp {orderInfo.totalAmount.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 font-medium">Biaya Layanan</span>
              <span className="font-bold text-slate-800">Rp 0</span>
            </div>
            <div className="pt-3 border-t border-dashed border-slate-200 flex justify-between items-center">
              <span className="text-sm font-bold text-slate-900">Total Tagihan</span>
              <span className="text-xl font-black text-indigo-600">
                Rp {orderInfo.totalAmount.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-slate-100 p-5 max-w-md mx-auto z-50">
        <button
          disabled={loading}
          onClick={handleProcessPayment}
          className={`w-full text-white py-4 rounded-2xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2
            ${loading ? "bg-slate-400 cursor-not-allowed" : "bg-indigo-600 active:scale-95 shadow-indigo-200 hover:bg-indigo-700"}
          `}
        >
          {loading && <Loader2 className="animate-spin" size={18} />}
          {loading ? "Menghubungkan..." : (selectedMethod === 'qris' ? 'Bayar dengan QRIS' : 'Konfirmasi Pesanan COD')}
        </button>
      </div>
    </div>
  )
}