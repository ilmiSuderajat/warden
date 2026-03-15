"use client"

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, MapPin, Truck, ShieldCheck, ChevronRight, Loader2, Pencil, Route, PlusCircle, Minus, Plus, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation";
import Skeleton from "@/app/components/Skeleton";

export default function CheckoutPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [address, setAddress] = useState<any>(null);
  const [shippingFee, setShippingFee] = useState(0);
  const [distance, setDistance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Voucher states
  const [voucherCode, setVoucherCode] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<any>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [isCheckingVoucher, setIsCheckingVoucher] = useState(false);

  const TARIF_PER_KM = 2000;
  const ONGKIR_MINIMAL = 10000;

  // Fungsi hitung jarak (Haversine Formula)
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
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push("/login");

      const { data: addrData } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();

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
    } catch (error) {
      console.error("Error preparing checkout:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateShipping = (items: any[], addr: any) => {
    if (items.length > 0 && addr?.latitude && items[0].lat && items[0].lng) {
      const dist = calculateDistance(items[0].lat, items[0].lng, addr.latitude, addr.longitude);
      setDistance(dist);
      const fee = Math.ceil(dist) * TARIF_PER_KM;
      setShippingFee(fee < ONGKIR_MINIMAL ? ONGKIR_MINIMAL : fee);
    }
  };

  const updateQuantity = async (cartId: string, newQty: number) => {
    const prevItems = [...cartItems];

    // Optimistic UI Update
    let newItems;
    if (newQty < 1) {
      newItems = cartItems.filter(item => item.cart_id !== cartId);
      setCartItems(newItems);
      if (newItems.length === 0) setShippingFee(0);
    } else {
      newItems = cartItems.map(item =>
        item.cart_id === cartId ? { ...item, quantity: newQty } : item
      );
      setCartItems(newItems);
    }

    // Update ke Supabase
    if (newQty < 1) {
      await supabase.from("cart").delete().eq("id", cartId);
    } else {
      await supabase.from("cart").update({ quantity: newQty }).eq("id", cartId);
    }

    // Hitung ulang ongkir jika perlu
    if (address && newItems.length > 0) updateShipping(newItems, address);
  };

  const totalPrice = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  // Fungsi untuk Mengecek dan Mengaplikasikan Voucher
  const applyVoucher = async () => {
    if (!voucherCode.trim()) {
      toast.error("Masukkan kode voucher terlebih dahulu!");
      return;
    }

    setIsCheckingVoucher(true);
    try {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("vouchers")
        .select("*")
        .eq("code", voucherCode.toUpperCase())
        .eq("is_active", true)
        .or(`start_date.lte.${nowIso},start_date.is.null`)
        .or(`end_date.gte.${nowIso},end_date.is.null`)
        .single();

      if (error || !data) {
        toast.error("Voucher tidak ditemukan atau sudah tidak aktif");
        setAppliedVoucher(null);
        setDiscountAmount(0);
        return;
      }

      // Cek Batas Penggunaan
      if (data.usage_limit && data.used_count >= data.usage_limit) {
        toast.error("Kuota voucher ini sudah habis digunakan");
        setAppliedVoucher(null);
        setDiscountAmount(0);
        return;
      }

      // Cek Minimal Pembelian
      if (data.min_order_amount && totalPrice < data.min_order_amount) {
        toast.error(`Voucher ini memerlukan minimal belanja Rp ${data.min_order_amount.toLocaleString('id-ID')}`);
        setAppliedVoucher(null);
        setDiscountAmount(0);
        return;
      }

      // Hitung Diskon
      let calculatedDiscount = 0;
      if (data.discount_type === 'percentage') {
        calculatedDiscount = totalPrice * (data.discount_value / 100);
        if (data.max_discount_amount && calculatedDiscount > data.max_discount_amount) {
          calculatedDiscount = data.max_discount_amount;
        }
      } else {
        calculatedDiscount = data.discount_value;
      }

      // Diskon tidak boleh melebihi total belanja
      if (calculatedDiscount > totalPrice) {
        calculatedDiscount = totalPrice;
      }

      setDiscountAmount(calculatedDiscount);
      setAppliedVoucher(data);
      toast.success("Voucher berhasil digunakan!");

    } catch (err) {
      console.error(err);
      toast.error("Terjadi kesalahan saat mengecek voucher");
    } finally {
      setIsCheckingVoucher(false);
    }
  };

  const removeVoucher = () => {
    setVoucherCode("");
    setAppliedVoucher(null);
    setDiscountAmount(0);
    toast.info("Penggunaan voucher dibatalkan");
  };

  const handlePlaceOrder = async () => {
    if (!address || cartItems.length === 0) {
      toast.error("Alamat atau keranjang tidak valid!");
      return;
    }

    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User tidak ditemukan");

      const orderAddress = `${address.detail}, RT ${address.rt || '00'} / RW ${address.rw || '00'}, ${address.kelurahan}, ${address.kecamatan}, ${address.city}`;

      // 1. Buat Order ke Supabase
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert([{
          customer_name: address.name,
          whatsapp_number: address.phone,
          address: orderAddress,
          latitude: address.latitude ?? null,
          longitude: address.longitude ?? null,
          maps_link: (address.latitude && address.longitude) 
            ? `https://www.google.com/maps/place/${address.latitude},${address.longitude}/@${address.latitude},${address.longitude},17z` 
            : null,
          subtotal_amount: totalPrice,
          shipping_amount: shippingFee,
          distance_km: distance,
          total_amount: Math.max(0, totalPrice + shippingFee - discountAmount),
          payment_status: "pending",
          user_id: user.id,
          voucher_code: appliedVoucher ? appliedVoucher.code : null,
          discount_amount: discountAmount
        }]).select().maybeSingle();

      if (orderError) throw orderError;

      // 1.5 Update Voucher Used Count jika menggunakan voucher
      if (appliedVoucher) {
        try {
          // Attempt using RPC if defined
          await supabase.rpc('increment_voucher_usage', { v_id: appliedVoucher.id });
        } catch (e) {
          // Fallback manual increment jika RPC belum dibuat
          await supabase.from("vouchers")
            .update({ used_count: appliedVoucher.used_count + 1 })
            .eq("id", appliedVoucher.id);
        }
      }

      // 2. Buat Order Items
      const itemsToInsert = cartItems.map((item: any) => ({
        order_id: orderData.id,
        product_name: item.name,
        quantity: item.quantity,
        price: item.price,
        image_url: item.image_url
      }));
      await supabase.from("order_items").insert(itemsToInsert);

      // --- PERBAIKAN DI SINI ---
      // Kita arahkan ke payment sambil membawa order_id di URL
      // Di CheckoutPage handlePlaceOrder
      router.push(`/checkout/payment?order_id=${orderData.id}`);

    } catch (error: any) {
      console.error(error);
      toast.error("Gagal memproses pesanan: " + error.message);
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans max-w-md mx-auto pb-28">
        <div className="bg-white border-b border-slate-100 sticky top-0 z-40 backdrop-blur-lg ">
          <div className="flex items-center gap-3 px-5 pt-12 pb-4">
            <Skeleton className="w-8 h-8 rounded-xl" />
            <Skeleton className="h-6 w-40" />
          </div>
        </div>
        <div className="p-5 space-y-5">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 flex gap-4">
            <Skeleton className="w-12 h-12 rounded-2xl shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-6 w-1/3 rounded-full mt-2" />
            </div>
          </div>
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-4 space-y-4">
              <Skeleton className="h-3 w-20" />
              <div className="flex justify-between items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <Skeleton className="w-16 h-16 rounded-2xl" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
                <Skeleton className="h-8 w-20 rounded-full" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-8 w-full mt-4" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans max-w-md mx-auto pb-28">
      {/* HEADER */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-40 backdrop-blur-lg ">
        <div className="flex items-center gap-3 px-5 pt-12 pb-4">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <ArrowLeft size={22} strokeWidth={2.5} />
          </button>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Konfirmasi Pesanan</h1>
        </div>
      </div>

      <div className="p-5 space-y-5">

        {/* ALAMAT PENGIRIMAN */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex justify-between items-center px-5 py-3 border-b border-slate-50 bg-slate-50/40">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Kirim Ke</span>
            {address && (
              <button onClick={() => router.push("/address")} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                Ubah <Pencil size={12} />
              </button>
            )}
          </div>

          <div className="p-5">
            {address ? (
              <div className="flex gap-4">
                <div className="p-3 bg-indigo-50 rounded-2xl shrink-0 h-fit">
                  <MapPin size={20} className="text-indigo-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-800">{address.name} • {address.phone}</p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed uppercase font-medium">
                    {address.detail}, RT {address.rt || '00'}/RW {address.rw || '00'}, {address.kelurahan}, {address.kecamatan}, {address.city}
                  </p>
                  <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 rounded-full border border-emerald-100">
                    <Route size={12} className="text-emerald-600" />
                    <span className="text-[11px] font-bold text-emerald-700">{distance.toFixed(1)} KM dari toko</span>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => router.push("/address/add")}
                className="w-full py-10 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors flex flex-col items-center gap-2"
              >
                <PlusCircle size={24} />
                <span className="text-sm font-semibold">Tambah Alamat Pengiriman</span>
              </button>
            )}
          </div>
        </div>

        {/* ITEM BELANJA */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex justify-between items-center px-5 py-3 border-b border-slate-50 bg-slate-50/40">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Pesananmu</span>
            <span className="text-xs font-medium text-slate-500">{cartItems.length} Item</span>
          </div>

          <div className="divide-y divide-slate-50">
            {cartItems.map((item: any) => (
              <div key={item.cart_id} className="p-4 flex justify-between items-center gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl overflow-hidden shrink-0 border border-slate-50 shadow-sm">
                    <img src={item.image_url} className="w-full h-full object-cover" alt={item.name} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 line-clamp-1">{item.name}</p>
                    <p className="text-xs text-slate-400 mt-1 font-medium">Rp {item.price.toLocaleString('id-ID')}</p>
                  </div>
                </div>

                {/* Quantity Control */}
                <div className="flex items-center gap-0 shrink-0 border border-slate-200 rounded-full bg-white shadow-sm">
                  <button
                    onClick={() => updateQuantity(item.cart_id, item.quantity - 1)}
                    className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-6 text-center text-xs font-bold text-slate-700">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.cart_id, item.quantity + 1)}
                    className="w-8 h-8 flex items-center justify-center bg-slate-900 text-white rounded-full hover:bg-slate-700 transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* INPUT VOUCHER DISKON */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span> Diskon & Promo
            </span>
          </div>
          
          {appliedVoucher ? (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <ShieldCheck size={14} /> Voucher Terpasang!
                </p>
                <p className="text-sm font-extrabold text-emerald-600 mt-1 uppercase font-mono tracking-wider">{appliedVoucher.code}</p>
              </div>
              <button 
                onClick={removeVoucher}
                className="text-xs font-bold text-red-500 hover:text-red-700 bg-white px-3 py-1.5 rounded-full shadow-sm"
              >
                Hapus
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Masukkan Kode Voucher"
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 uppercase transition-all"
              />
              <button 
                onClick={applyVoucher}
                disabled={isCheckingVoucher || !voucherCode}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-5 py-3 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center shrink-0"
              >
                {isCheckingVoucher ? <Loader2 size={16} className="animate-spin" /> : 'Pakai'}
              </button>
            </div>
          )}
        </div>

        {/* RINCIAN PEMBAYARAN */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Subtotal Produk</span>
            <span className="text-slate-700 font-medium">Rp {totalPrice.toLocaleString('id-ID')}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Ongkos Kirim ({distance.toFixed(1)} km)</span>
            <span className="text-slate-700 font-medium">Rp {shippingFee.toLocaleString('id-ID')}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between text-sm items-center">
              <span className="text-emerald-600 font-medium">Diskon Voucher</span>
              <span className="text-emerald-600 font-bold">- Rp {discountAmount.toLocaleString('id-ID')}</span>
            </div>
          )}
          <div className="border-t border-dashed border-slate-200 pt-4 mt-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-slate-700">Total Tagihan</span>
              <span className="text-xl font-extrabold text-slate-900">
                Rp {Math.max(0, totalPrice + shippingFee - discountAmount).toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* FLOATING ACTION BUTTON */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-100 p-5 max-w-md mx-auto z-50">
        <button
          onClick={handlePlaceOrder}
          disabled={isProcessing || !address || cartItems.length === 0}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-sm font-bold transition-all active:scale-[0.98] disabled:bg-indigo-300 disabled:cursor-not-allowed shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
        >
          {isProcessing ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>Memproses Pesanan...</span>
            </>
          ) : (
            <>
              <span>Lanjut ke Pembayaran</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}