"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, CheckCircle2, Truck, Loader2, CreditCard } from "lucide-react"
import { createClient } from '@supabase/supabase-js'

// 1. Inisialisasi Supabase Client (Client-side)
// Gunakan NEXT_PUBLIC_SUPABASE_ANON_KEY (bukan Service Role) di frontend
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function PaymentPage() {
  const router = useRouter()
  const [selectedMethod, setSelectedMethod] = useState<string>('online')
  const [loading, setLoading] = useState(false)
  const [fetchingData, setFetchingData] = useState(true) // State untuk loading awal
  
  // State disesuaikan dengan kolom tabel 'orders' (snake_case)
  const [orderInfo, setOrderInfo] = useState<{ 
    id: string, 
    total_amount: number, 
    customer_name: string,
    payment_status: string 
  } | null>(null)

  useEffect(() => {
    const initializePage = async () => {
      // 1. Ambil Order ID dari localStorage (hanya ID saja yang dipercaya)
      const data = localStorage.getItem('pendingOrder')
      if (!data) {
        router.push('/cart')
        return
      }

      const parsedData = JSON.parse(data)
      const orderId = parsedData.orderId

      if (!orderId) {
        alert("Sesi pesanan tidak valid.");
        router.push('/cart');
        return;
      }

      // 2. Ambil Data ASLI dari Supabase berdasarkan Order ID
      const { data: order, error } = await supabase
        .from('orders')
        .select('id, total_amount, customer_name, payment_status')
        .eq('id', orderId)
        .single()

      if (error || !order) {
        console.error("Error fetching order:", error)
        alert("Gagal memuat data pesanan.");
        router.push('/cart')
        return
      }

      // 3. Validasi: Jika sudah dibayar, jangan tampilkan halaman bayar
      if (order.payment_status !== 'pending') {
        alert("Pesanan ini sudah dibayar atau diproses.");
        localStorage.removeItem('pendingOrder');
        router.push('/orders'); // Arahkan ke halaman pesanan
        return;
      }

      setOrderInfo(order)
      setFetchingData(false)

      // 4. Load Script Snap Midtrans
      const snapScriptUrl = "https://app.sandbox.midtrans.com/snap/snap.js";
      const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;

      if (!clientKey) {
        console.error("Midtrans Client Key tidak ditemukan!");
        return;
      }

      const script = document.createElement('script');
      script.src = snapScriptUrl;
      script.setAttribute('data-client-key', clientKey);
      script.async = true;

      document.body.appendChild(script);

      // Cleanup script saat unmount
      return () => {
        if (document.body.contains(script)) {
          document.body.removeChild(script);
        }
      }
    }

    initializePage()
  }, [router])

  const handleProcessPayment = async () => {
    if (!orderInfo) {
      alert("Data pesanan tidak ditemukan!");
      return;
    }

    if (selectedMethod === 'cod') {
      // Untuk COD, sebaiknya panggil API untuk update status DB juga
      // Di sini kita biarkan simulasi seperti kode asli
      alert("Pesanan COD berhasil dibuat! (Simulasi)");
      localStorage.removeItem('pendingOrder'); 
      router.push('/checkout/success');
      return;
    }

    setLoading(true);
    try {
      // Kirim HANYA Order ID. Backend yang akan handle sisanya.
      const payload = {
        orderId: orderInfo.id, 
      };

      const response = await fetch('/api/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        alert(data.error || data.message || "Gagal memproses pembayaran.");
        setLoading(false);
        return;
      }

      if (data.token && typeof (window as any).snap !== 'undefined') {
        (window as any).snap.pay(data.token, {
          onSuccess: function (result: any) {
            console.log('Payment Success:', result);
            localStorage.removeItem('pendingOrder'); 
            router.push('/checkout/success');
          },
          onPending: function (result: any) {
            alert("Pesanan disimpan, segera selesaikan pembayaran ya!");
            localStorage.removeItem('pendingOrder');
            router.push('/orders');
          },
          onError: function (result: any) {
            console.error('Payment Error:', result);
            alert("Pembayaran Gagal, silakan coba metode lain.");
          },
          onClose: function () {
            alert('Yah, kok ditutup? Belum bayar loh ini.');
            setLoading(false);
          }
        });
      } else {
        alert("Gagal mendapatkan token pembayaran.");
      }
    } catch (error) {
      console.error("Fetch Error:", error);
      alert("Terjadi kesalahan jaringan.");
    } finally {
      setLoading(false)
    }
  }

  // Tampilkan loading spinner saat mengambil data dari DB
  if (fetchingData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto">
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b flex items-center px-5 max-w-md mx-auto z-50">
        <button onClick={() => router.back()}><ArrowLeft size={24} /></button>
        <h1 className="ml-3 font-bold">Pembayaran</h1>
      </header>

      <main className="pt-24 px-5 pb-32">
        <div className="space-y-3 mb-6">
          <p className="text-xs font-bold text-slate-400 uppercase">Pilih Metode</p>
          
          {/* Online Payment Button */}
          <button 
            onClick={() => setSelectedMethod('online')}
            className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${selectedMethod === 'online' ? "border-indigo-600 bg-indigo-50" : "bg-white border-transparent"}`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${selectedMethod === 'online' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"}`}><CreditCard size={20} /></div>
              <div className="text-left">
                <p className="text-sm font-bold">Pembayaran Online</p>
                <p className="text-[10px] text-slate-400">VA, E-Wallet, QRIS (Midtrans)</p>
              </div>
            </div>
            {selectedMethod === 'online' && <CheckCircle2 size={20} className="text-indigo-600" />}
          </button>

          {/* COD Button */}
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
          {/* Data diambil langsung dari state (yang berasal dari DB) */}
          <div className="flex justify-between text-lg font-black">
            <span>Total Bayar</span>
            {/* Perhatikan: total_amount (snake_case) sesuai DB */}
            <span>Rp {orderInfo?.total_amount?.toLocaleString('id-ID') || "0"}</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1 text-right">
            Order ID: {orderInfo?.id || "Loading..."}
          </p>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 p-5 bg-white border-t max-w-md mx-auto">
        <button 
          disabled={loading || !orderInfo}
          onClick={handleProcessPayment}
          className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 disabled:bg-slate-300"
        >
          {loading ? <Loader2 className="animate-spin" size={18} /> : (selectedMethod === 'online' ? 'Bayar Sekarang' : 'Buat Pesanan COD')}
        </button>
      </div>
    </div>
  )
}