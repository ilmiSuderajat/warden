"use client"

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as Icons from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Skeleton from "@/app/components/Skeleton";

export default function CartPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("cart")
      .select("*, products(*)")
      .eq("user_id", user.id);

    if (data) {
      const formattedData = data.map(item => ({
        id: item.id,
        product_id: item.product_id,
        name: item.products.name,
        price: item.products.price,
        image_url: Array.isArray(item.products.image_url) ? item.products.image_url[0] : item.products.image_url,
        quantity: item.quantity
      }));
      setCartItems(formattedData);
    }
    setLoading(false);
  };

  const updateQuantity = async (id: string, delta: number, currentQty: number) => {
    const newQty = Math.max(1, currentQty + delta);

    // Optimistic Update
    setCartItems(prev => prev.map(item => item.id === id ? { ...item, quantity: newQty } : item));

    const { error } = await supabase
      .from("cart")
      .update({ quantity: newQty })
      .eq("id", id);

    if (error) fetchCart();
  };

  const removeItem = async (id: string) => {
    // Optimistic Update
    setCartItems(prev => prev.filter(item => item.id !== id));

    const { error } = await supabase
      .from("cart")
      .delete()
      .eq("id", id);

    if (error) fetchCart(); // Rollback if error
  };

  const clearCart = async () => {
    if (confirm("Kosongkan semua keranjang?")) {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("cart").delete().eq("user_id", user?.id);
      setCartItems([]);
    }
  };

  const subtotal = cartItems.reduce((acc, item) => acc + (item.price * (item.quantity || 1)), 0);

  if (loading) return (
    <div className="min-h-screen bg-slate-50/80 max-w-md mx-auto relative pb-32">
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="flex items-center justify-between px-5 pt-12 pb-4">
          <Skeleton className="w-8 h-8 rounded-xl" />
          <Skeleton className="h-6 w-24" />
          <div className="w-8"></div>
        </div>
      </div>
      <div className="p-5 space-y-3">
        {Array(3).fill(0).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex gap-4">
            <Skeleton className="w-20 h-20 rounded-xl" />
            <div className="flex-1 flex flex-col justify-between py-1">
              <div>
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-5 w-1/2" />
              </div>
              <div className="flex items-center justify-between mt-2">
                <Skeleton className="h-8 w-24 rounded-full" />
                <Skeleton className="w-6 h-6 rounded-md" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/80 font-sans max-w-md mx-auto relative pb-32">

      {/* HEADER */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="flex items-center justify-between px-5 pt-12 pb-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
            <Icons.ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Keranjang</h1>
          {cartItems.length > 0 ? (
            <button onClick={clearCart} className="p-2 -mr-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
              <Icons.Trash2 size={18} />
            </button>
          ) : (
            <div className="w-8"></div>
          )}
        </div>
      </div>

      {/* CONTENT */}
      <div className="p-5 space-y-3">
        {cartItems.length > 0 ? (
          cartItems.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex gap-4 relative group"
            >
              {/* Image */}
              <div className="w-20 h-20 bg-slate-100 rounded-xl overflow-hidden shrink-0 border border-slate-50">
                <img
                  src={item.image_url}
                  className="w-full h-full object-cover"
                  alt={item.name}
                />
              </div>

              {/* Detail */}
              <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 line-clamp-1 leading-tight">{item.name}</h3>
                  <p className="text-sm font-bold text-slate-900 mt-1">
                    Rp {item.price.toLocaleString('id-ID')}
                  </p>
                </div>

                {/* Quantity Control (Modern Pill Style) */}
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1 shrink-0 border border-slate-200 rounded-full p-1">
                    <button
                      onClick={() => updateQuantity(item.id, -1, item.quantity)}
                      className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
                    >
                      <Icons.Minus size={14} className="text-slate-500" />
                    </button>
                    <span className="w-5 text-center text-xs font-bold text-slate-700">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, 1, item.quantity)}
                      className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-900 hover:bg-slate-800 transition-colors"
                    >
                      <Icons.Plus size={14} className="text-white" />
                    </button>
                  </div>

                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors p-1"
                  >
                    <Icons.X size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          /* EMPTY STATE */
          <div className="text-center py-20 flex flex-col items-center justify-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-5">
              <Icons.ShoppingBag size={32} className="text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-1">Keranjang Kosong</p>
            <p className="text-xs text-slate-400 mb-6">Waktunya isi dengan barang favoritmu!</p>
            <Link
              href="/"
              className="bg-slate-900 text-white px-8 py-3 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors shadow-sm"
            >
              Mulai Belanja
            </Link>
          </div>
        )}
      </div>

      {/* FOOTER CHECKOUT (Floating) */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-t border-slate-100 max-w-md mx-auto p-4">
          <div className="flex items-center justify-between gap-4">
            {/* Total Section */}
            <div className="flex-1">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Total Tagihan</p>
              <p className="text-lg font-bold text-slate-900">Rp {subtotal.toLocaleString('id-ID')}</p>
            </div>

            {/* Checkout Button */}
            <button
              onClick={() => router.push("/checkout")}
              className="bg-indigo-600 hover:bg-indigo-800 text-white h-12 px-6 rounded-xl text-sm font-bold transition-all active:scale-[0.98] shadow-sm flex items-center gap-2"
            >
              <span>Checkout</span>
              <Icons.ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}