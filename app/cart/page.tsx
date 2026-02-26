"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as Icons from "lucide-react";
import Link from "next/link";

export default function CartPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Ambil data dari LocalStorage
  useEffect(() => {
    const savedCart = localStorage.getItem("warden-cart");
    if (savedCart) {
      setCartItems(JSON.parse(savedCart));
    }
    setLoading(false);
  }, []);

  // 2. Update Jumlah Barang (Plus/Minus)
  const updateQuantity = (id: string, delta: number) => {
    const newCart = cartItems.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, (item.quantity || 1) + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    });
    setCartItems(newCart);
    localStorage.setItem("warden-cart", JSON.stringify(newCart));
  };

  // 3. Hapus Barang dari Keranjang
  const removeItem = (id: string) => {
    const newCart = cartItems.filter(item => item.id !== id);
    setCartItems(newCart);
    localStorage.setItem("warden-cart", JSON.stringify(newCart));
  };

  // 4. Hitung Total
  const subtotal = cartItems.reduce((acc, item) => acc + (item.price * (item.quantity || 1)), 0);

  if (loading) return <div className="p-20 text-center text-[10px] font-black uppercase opacity-20">Ngecek Keranjang...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-32 font-sans max-w-md mx-auto relative">
      {/* HEADER NAVBAR */}
      <div className="bg-white px-6 py-6 rounded-b-[2.5rem] shadow-sm border-b border-gray-100 sticky top-0 z-50">
        <div className="flex justify-between items-center">
          <button onClick={() => router.back()} className="p-2 bg-gray-50 rounded-xl active:scale-90 transition-all">
            <Icons.ArrowLeft size={18} />
          </button>
          <h2 className="text-sm font-black uppercase tracking-widest text-gray-800">Keranjang Belanja</h2>
          <button className="p-2 bg-gray-50 rounded-xl text-red-500" onClick={() => {if(confirm("Kosongkan keranjang?")){setCartItems([]); localStorage.removeItem("warden-cart")}}}>
            <Icons.Trash2 size={18} />
          </button>
        </div>
      </div>

      <div className="px-4 mt-6 space-y-4">
        {cartItems.length > 0 ? (
          cartItems.map((item) => (
            <div key={item.id} className="bg-white p-4 rounded-4xl shadow-xl shadow-gray-200/40 border border-gray-50 flex gap-4 relative overflow-hidden group">
              {/* IMAGE */}
              <div className="w-20 h-20 bg-gray-100 rounded-2xl overflow-hidden shrink-0">
                <img src={Array.isArray(item.image_url) ? item.image_url[0] : item.image_url} className="w-full h-full object-cover" alt={item.name} />
              </div>

              {/* INFO */}
              <div className="flex flex-col justify-between flex-1 py-1">
                <div>
                  <h3 className="text-[11px] font-bold text-gray-800 line-clamp-1">{item.name}</h3>
                  <p className="text-indigo-600 font-black text-sm">Rp {item.price.toLocaleString('id-ID')}</p>
                </div>

                {/* COUNTER */}
                <div className="flex items-center gap-3 bg-gray-50 self-start px-2 py-1 rounded-xl">
                  <button onClick={() => updateQuantity(item.id, -1)} className="w-6 h-6 flex items-center justify-center bg-white rounded-lg shadow-sm active:scale-90">-</button>
                  <span className="text-[11px] font-black w-4 text-center">{item.quantity || 1}</span>
                  <button onClick={() => updateQuantity(item.id, 1)} className="w-6 h-6 flex items-center justify-center bg-white rounded-lg shadow-sm active:scale-90">+</button>
                </div>
              </div>

              {/* REMOVE BUTTON */}
              <button onClick={() => removeItem(item.id)} className="absolute top-4 right-4 text-gray-300 hover:text-red-500 transition-colors">
                <Icons.X size={16} />
              </button>
            </div>
          ))
        ) : (
          <div className="text-center py-24 bg-white rounded-[3rem] shadow-sm border border-gray-100">
            <div className="bg-indigo-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Icons.ShoppingBag size={32} className="text-indigo-600 opacity-30" />
            </div>
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Keranjang Kosong, Lur!</p>
            <Link href="/" className="mt-6 inline-block bg-indigo-600 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 active:scale-95 transition-all">
              Cari Donsu
            </Link>
          </div>
        )}
      </div>

      {/* RINGKASAN PEMBAYARAN FIXED BOTTOM */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-24 left-0 right-0 max-w-md mx-auto px-4 z-40">
          <div className="bg-gray-900 text-white p-6 rounded-[2.5rem] shadow-2xl shadow-indigo-200">
            <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-4">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">Total Bayar</span>
              <span className="text-xl font-black">Rp {subtotal.toLocaleString('id-ID')}</span>
            </div>
            
            <button className="w-full bg-white text-gray-900 py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 group">
              Checkout Sekarang
              <Icons.ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}