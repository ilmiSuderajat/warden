"use client"

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import * as Icons from "lucide-react";
import { useRouter } from "next/navigation";

export default function CheckoutPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [address, setAddress] = useState<any>(null);
  const [shippingFee, setShippingFee] = useState(0);
  const [distance, setDistance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const TARIF_PER_KM = 2000;
  const ONGKIR_MINIMAL = 10000;

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  useEffect(() => {
    prepareCheckout();
  }, []);

  const prepareCheckout = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.push("/login");

    const { data: addrData } = await supabase
      .from("addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .limit(1).single();
    
    setAddress(addrData);

    const { data: cartData } = await supabase
      .from("cart")
      .select("*, products(*)")
      .eq("user_id", user.id);

    if (cartData) {
      const formattedCart = cartData.map(item => ({
        cart_id: item.id,
        id: item.product_id,
        name: item.products.name,
        price: item.products.price,
        image_url: Array.isArray(item.products.image_url) ? item.products.image_url[0] : item.products.image_url,
        quantity: item.quantity,
        lat: item.products.latitude,
        lng: item.products.longitude
      }));
      setCartItems(formattedCart);
      if (addrData) updateShipping(formattedCart, addrData);
    }
    setLoading(false);
  };

  const updateShipping = (items: any[], addr: any) => {
    if (items.length > 0 && addr?.latitude) {
      const dist = calculateDistance(items[0].lat, items[0].lng, addr.latitude, addr.longitude);
      setDistance(dist);
      const fee = Math.ceil(dist) * TARIF_PER_KM;
      setShippingFee(fee < ONGKIR_MINIMAL ? ONGKIR_MINIMAL : fee);
    }
  };

  const updateQuantity = async (cartId: string, newQty: number) => {
    // Optimistic update untuk UI responsif
    const prevItems = [...cartItems];
    
    if (newQty < 1) {
      await supabase.from("cart").delete().eq("id", cartId);
      const newItems = cartItems.filter(item => item.cart_id !== cartId);
      setCartItems(newItems);
      if (newItems.length === 0) setShippingFee(0);
    } else {
      await supabase.from("cart").update({ quantity: newQty }).eq("id", cartId);
      const newItems = cartItems.map(item => 
        item.cart_id === cartId ? { ...item, quantity: newQty } : item
      );
      setCartItems(newItems);
    }
  };

  const totalPrice = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const handlePlaceOrder = async () => {
    if (!address || cartItems.length === 0) return;
    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert([{
          customer_name: address.name,
          whatsapp_number: address.phone,
          address: `${address.detail}, ${address.city}`,
          subtotal_amount: totalPrice,
          shipping_amount: shippingFee,
          distance_km: distance,
          total_amount: totalPrice + shippingFee,
          status: "pending",
          user_id: user?.id
        }]).select().single();

      if (orderError) throw orderError;

      const itemsToInsert = cartItems.map((item: any) => ({
        order_id: orderData.id,
        product_name: item.name,
        quantity: item.quantity,
        price: item.price,
        image_url: item.image_url
      }));
      await supabase.from("order_items").insert(itemsToInsert);
      await supabase.from("cart").delete().eq("user_id", user?.id);

      router.push("/orders");
    } catch (error: any) {
      alert("Gagal memproses pesanan: " + error.message);
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3 bg-slate-50">
        <Icons.Loader2 className="animate-spin text-indigo-600" size={28} />
        <p className="text-xs font-medium text-slate-400">Memuat data checkout...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/80 font-sans max-w-md mx-auto pb-32">
      {/* HEADER */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="flex items-center gap-3 px-5 pt-12 pb-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
            <Icons.ArrowLeft size={20} strokeWidth={2.5} />
          </button>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Konfirmasi</h1>
        </div>
      </div>

      <div className="p-5 space-y-4">
        
        {/* ALAMAT PENGIRIMAN */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex justify-between items-center px-5 py-3 border-b border-slate-50 bg-slate-50/50">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alamat Pengiriman</span>
             {address && (
                <button onClick={() => router.push("/address")} className="text-xs font-bold text-indigo-600 hover:text-indigo-700">
                    Ubah
                </button>
             )}
          </div>
          
          <div className="p-5">
            {address ? (
              <div className="flex gap-3">
                <div className="p-2.5 bg-indigo-50 rounded-xl shrink-0 h-fit">
                  <Icons.MapPin size={18} className="text-indigo-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-800">{address.name}</p>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{address.detail}, {address.city}</p>
                  <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 rounded-full border border-emerald-100">
                    <Icons.Route size={12} className="text-emerald-600"/>
                    <span className="text-[10px] font-bold text-emerald-700">{distance.toFixed(1)} KM</span>
                  </div>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => router.push("/address/add")} 
                className="w-full py-8 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:text-slate-500 hover:border-slate-300 transition-colors flex flex-col items-center gap-2"
              >
                <Icons.PlusCircle size={20} />
                <span className="text-xs font-semibold">Tambah Alamat Baru</span>
              </button>
            )}
          </div>
        </div>

        {/* ITEM BELANJA */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex justify-between items-center px-5 py-3 border-b border-slate-50 bg-slate-50/50">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Item Belanja</span>
             <span className="text-xs font-medium text-slate-500">{cartItems.length} Produk</span>
          </div>
          
          <div className="divide-y divide-slate-50">
            {cartItems.map((item: any, idx: number) => (
              <div key={idx} className="p-5 flex justify-between items-center gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-14 h-14 bg-slate-100 rounded-xl overflow-hidden shrink-0 border border-slate-50">
                    <img src={item.image_url} className="w-full h-full object-cover" alt={item.name} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 line-clamp-1">{item.name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Rp {item.price.toLocaleString('id-ID')}</p>
                  </div>
                </div>
                
                {/* Quantity Control */}
                <div className="flex items-center gap-1 shrink-0 border border-slate-200 rounded-full p-1">
                  <button 
                    onClick={() => updateQuantity(item.cart_id, item.quantity - 1)}
                    className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
                  >
                    <Icons.Minus size={14} className="text-slate-500" />
                  </button>
                  <span className="w-6 text-center text-xs font-bold text-slate-700">{item.quantity}</span>
                  <button 
                    onClick={() => updateQuantity(item.cart_id, item.quantity + 1)}
                    className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-900 hover:bg-slate-800 transition-colors"
                  >
                    <Icons.Plus size={14} className="text-white" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RINCIAN PEMBAYARAN */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="text-slate-700 font-medium">Rp {totalPrice.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Ongkos Kirim</span>
            <span className="text-slate-700 font-medium">Rp {shippingFee.toLocaleString('id-ID')}</span>
          </div>
          <div className="border-t border-slate-100 pt-3 mt-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-slate-600">Total Tagihan</span>
              <span className="text-lg font-bold text-slate-900">
                Rp {(totalPrice + shippingFee).toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* FLOATING ACTION BUTTON */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-100 p-5 max-w-md mx-auto z-50">
        <button 
          onClick={handlePlaceOrder}
          disabled={isProcessing || !address || cartItems.length === 0}
          className="w-full py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-sm font-bold transition-all active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400 shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <Icons.Loader2 size={16} className="animate-spin" />
              <span>Memproses...</span>
            </>
          ) : (
            <>
              <span>Bayar Sekarang</span>
              <Icons.ArrowRight size={16} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}