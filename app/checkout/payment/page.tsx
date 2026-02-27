"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, CheckCircle2, Truck, QrCode, Loader2, Wallet } from "lucide-react"

export default function PaymentPage() {
  const router = useRouter()
  const [selectedMethod, setSelectedMethod] = useState<string>('qris')
  const [loading, setLoading] = useState(false)
  const [orderInfo, setOrderInfo] = useState<{ orderId: string, totalAmount: number } | null>(null)

  useEffect(() => {
    const data = localStorage.getItem('pendingOrder')
    if (data) {
      setOrderInfo(JSON.parse(data))
    } else {
      router.push('/cart')
    }
  }, [router])

  const handleProcessPayment = async () => {
    if (!orderInfo) return;
    setLoading(true);

    if (selectedMethod === 'cod') {
      // Simulasi COD
      setTimeout(() => {
        localStorage.removeItem('pendingOrder');
        router.push('/checkout/success?method=cod');
      }, 1000);
      return;
    }

    try {
      const response = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: orderInfo.totalAmount, // Pastikan ini number (misal: 151000)
          orderId: orderInfo.orderId,
          productDetails: "Order Warden #" + orderInfo.orderId.slice(0, 5),
          customerName: "Pembeli Warden",
          email: "customer@gmail.com"
        }),
      })

      const data = await response.json()

      if (response.ok && data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        alert("Gagal: " + (data.statusMessage || "Cek Log Vercel"));
        setLoading(false);
      }
    } catch (error) {
      alert("Koneksi Error");
      setLoading(false);
    }
  }

  if (!orderInfo) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" /></div>

  return (
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto">
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b flex items-center px-5 max-w-md mx-auto z-50">
        <button onClick={() => router.back()}><ArrowLeft size={24} /></button>
        <h1 className="ml-3 font-bold">Pembayaran</h1>
      </header>

      <main className="pt-24 px-5">
        <div className="space-y-3 mb-6">
          <p className="text-xs font-bold text-slate-400 uppercase">Pilih Metode</p>
          {/* Tombol QRIS */}
          <button 
            onClick={() => setSelectedMethod('qris')}
            className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${selectedMethod === 'qris' ? "border-indigo-600 bg-indigo-50" : "bg-white border-transparent"}`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${selectedMethod === 'qris' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"}`}><QrCode size={20} /></div>
              <div className="text-left">
                <p className="text-sm font-bold">QRIS (Duitku)</p>
                <p className="text-[10px] text-slate-400">Otomatis Terverifikasi</p>
              </div>
            </div>
            {selectedMethod === 'qris' && <CheckCircle2 size={20} className="text-indigo-600" />}
          </button>

          {/* Tombol COD */}
          <button 
            onClick={() => setSelectedMethod('cod')}
            className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${selectedMethod === 'cod' ? "border-indigo-600 bg-indigo-50" : "bg-white border-transparent"}`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${selectedMethod === 'cod' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"}`}><Truck size={20} /></div>
              <div className="text-left">
                <p className="text-sm font-bold">Bayar di Tempat (COD)</p>
                <p className="text-[10px] text-slate-400">Bayar saat kurir sampai</p>
              </div>
            </div>
            {selectedMethod === 'cod' && <CheckCircle2 size={20} className="text-indigo-600" />}
          </button>
        </div>

        <div className="bg-white rounded-2xl p-5 border shadow-sm">
          <div className="flex justify-between text-lg font-black">
            <span>Total Bayar</span>
            <span className="text-indigo-600">Rp {orderInfo.totalAmount.toLocaleString('id-ID')}</span>
          </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-5 bg-white border-t max-w-md mx-auto">
        <button 
          disabled={loading}
          onClick={handleProcessPayment}
          className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : (selectedMethod === 'qris' ? 'Bayar Sekarang' : 'Buat Pesanan COD')}
        </button>
      </div>
    </div>
  )
}