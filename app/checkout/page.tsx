/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft, MapPin, Loader2,
  AlertTriangle, ChevronRight, Store,
  Wallet, CreditCard, Truck, CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Skeleton from "@/app/components/Skeleton";
import { getWalletBalance } from "@/lib/wallet";

type PaymentMethod = "online" | "cod" | "wallet";

interface VariantOption {
  label: string;
  price: number;
  isAutoSelected?: boolean;
}

interface SelectedVariants {
  [cartId: string]: {
    [groupName: string]: VariantOption;
  };
}

// Load Midtrans Snap script dynamically
const loadMidtransScript = (clientKey: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if ((window as any).snap) { resolve(); return; }
    const isSandbox = clientKey.startsWith("SB-");
    const src = isSandbox
      ? "https://app.sandbox.midtrans.com/snap/snap.js"
      : "https://app.snap.midtrans.com/snap/snap.js";
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) { existing.addEventListener("load", () => resolve()); return; }
    const script = document.createElement("script");
    script.src = src;
    script.setAttribute("data-client-key", clientKey);
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Gagal memuat payment gateway"));
    document.body.appendChild(script);
  });
};

const COD_MAX_KM = 15;

export default function CheckoutPage() {
  const router = useRouter();
  const isProcessingRef = useRef(false);

  const [cartItems, setCartItems] = useState<any[]>([]);
  const [address, setAddress] = useState<any>(null);
  const [shippingFee, setShippingFee] = useState(0);
  const [distance, setDistance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState<SelectedVariants>({});
  const [multiShopError, setMultiShopError] = useState(false);
  const [shopName, setShopName] = useState("");
  const [shopImageUrl, setShopImageUrl] = useState<string | null>(null);
  const [messageToSeller, setMessageToSeller] = useState("");

  // Voucher
  const [appliedVoucher, setAppliedVoucher] = useState<any>(null);
  const [discountAmount, setDiscountAmount] = useState(0);

  // Payment
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>("online");
  const [walletBalance, setWalletBalance] = useState(0);
  const [codError, setCodError] = useState<string | null>(null);

  const TARIF_PER_KM = 2000;
  const ONGKIR_MINIMAL = 10000;

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  useEffect(() => {
    prepareCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prepareCheckout = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push("/login");

      // Address
      const { data: addrData } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();
      setAddress(addrData);

      // Cart
      const { data: cartData } = await supabase
        .from("cart")
        .select("*, products(*, shops(id, name, latitude, longitude, image_url))")
        .eq("user_id", user.id);

      if (cartData && cartData.length > 0) {
        const firstShopId = cartData[0].products.shop_id;
        const hasMultipleShops = cartData.some((i) => i.products.shop_id !== firstShopId);
        if (hasMultipleShops) setMultiShopError(true);

        setShopName(cartData[0].products.shops?.name || "Toko");
        setShopImageUrl(cartData[0].products.shops?.image_url || null);

        const initialVariants: SelectedVariants = {};
        const formattedCart = cartData.map((item) => {
          initialVariants[item.id] = {};
          if (item.variants && Object.keys(item.variants).length > 0) {
            initialVariants[item.id] = item.variants;
          } else if (item.products.variants && Array.isArray(item.products.variants)) {
            item.products.variants.forEach((group: any) => {
              if (group.options?.length > 0) {
                initialVariants[item.id][group.name] = { ...group.options[0], isAutoSelected: true };
              }
            });
            if (Object.keys(initialVariants[item.id]).length > 0) {
              supabase.from("cart").update({ variants: initialVariants[item.id] }).eq("id", item.id).then();
            }
          }
          const shopLat = item.products.shops?.latitude ?? item.products.latitude;
          const shopLng = item.products.shops?.longitude ?? item.products.longitude;
          return {
            cart_id: item.id,
            id: item.product_id,
            name: item.products.name,
            price: item.products.price,
            image_url: Array.isArray(item.products.image_url) ? item.products.image_url[0] : item.products.image_url,
            quantity: item.quantity,
            lat: shopLat,
            lng: shopLng,
            shop_id: item.products.shop_id,
            product_variants: item.products.variants || null,
          };
        });

        setSelectedVariants(initialVariants);
        setCartItems(formattedCart);

        if (addrData && !hasMultipleShops) {
          const dist = calculateDistance(formattedCart[0].lat, formattedCart[0].lng, addrData.latitude, addrData.longitude);
          setDistance(dist);
          const fee = Math.ceil(dist) * TARIF_PER_KM;
          setShippingFee(fee < ONGKIR_MINIMAL ? ONGKIR_MINIMAL : fee);

          if (dist > COD_MAX_KM) {
            setCodError(`COD tidak tersedia — jarak ${dist.toFixed(1)} km melebihi batas ${COD_MAX_KM} km`);
          }
        }
      } else {
        setCartItems([]);
      }

      // Wallet balance — isolated try/catch so it can't crash the rest of prepareCheckout
      try {
        const balance = await getWalletBalance();
        setWalletBalance(balance);
      } catch {
        // Silently default to 0 if wallet fetch fails (unauthenticated, network error, etc.)
        setWalletBalance(0);
      }
    } catch (error) {
      console.error("Error preparing checkout:", error);
    } finally {
      setLoading(false);
    }
  };

  const getVariantPrice = (cartId: string) => {
    const selections = selectedVariants[cartId];
    if (!selections) return 0;
    return Object.values(selections).reduce((sum, opt) => sum + (opt.price || 0), 0);
  };

  const getSubtotal = () =>
    cartItems.reduce((acc, item) => acc + (item.price + getVariantPrice(item.cart_id)) * item.quantity, 0);

  const updateQuantity = async (cartId: string, delta: number, currentQty: number) => {
    const newQty = Math.max(1, currentQty + delta);
    setCartItems((prev) => prev.map((item) => item.cart_id === cartId ? { ...item, quantity: newQty } : item));
    await supabase.from("cart").update({ quantity: newQty }).eq("id", cartId);
  };

  const subTotalPrice = getSubtotal();
  const grandTotal = Math.max(0, subTotalPrice + shippingFee - discountAmount);
  const codUnavailable = distance > COD_MAX_KM && distance > 0;
  const walletInsufficient = walletBalance < grandTotal;

  const handlePlaceOrder = async () => {
    if (multiShopError) return toast.error("Selesaikan pesanan dari 1 toko terlebih dahulu!");
    if (!address || cartItems.length === 0) return toast.error("Alamat atau keranjang tidak valid!");
    if (selectedPayment === "cod" && codUnavailable) return toast.error(codError || "COD tidak tersedia untuk jarak ini.");
    if (selectedPayment === "wallet" && walletInsufficient) return toast.error("Saldo Wallet tidak mencukupi.");

    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User tidak ditemukan");

      const orderAddress = `${address.detail}, RT ${address.rt || "00"}/RW ${address.rw || "00"}, ${address.kelurahan}, ${address.kecamatan}, ${address.city}`;
      const shopId = cartItems[0]?.shop_id;

      const items = cartItems.map((item: any) => {
        const finalPricePerItem = item.price + getVariantPrice(item.cart_id);
        return {
          product_id: item.id,
          product_name: item.name,
          quantity: item.quantity,
          price: item.price,
          final_price: finalPricePerItem,
          variants: selectedVariants[item.cart_id] || null,
          image_url: item.image_url || null,
        };
      });

      // 1. Create order
      const createRes = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: address.name,
          whatsapp_number: address.phone,
          address: orderAddress,
          latitude: address.latitude,
          longitude: address.longitude,
          maps_link: address.latitude ? `https://www.google.com/maps/place/${address.latitude},${address.longitude}` : null,
          subtotal_amount: subTotalPrice,
          shipping_amount: shippingFee,
          distance_km: distance,
          total_amount: grandTotal,
          voucher_code: appliedVoucher ? appliedVoucher.code : null,
          discount_amount: discountAmount,
          customer_note: messageToSeller || null,
          shop_id: shopId,
          items,
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || "Gagal membuat pesanan.");

      const orderId = createData.orderId;

      // 2. Trigger payment based on selected method
      if (selectedPayment === "cod") {
        const codRes = await fetch("/api/payment/cod", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId }),
        });
        const codData = await codRes.json();
        if (!codRes.ok) throw new Error(codData.error || "Gagal konfirmasi COD.");
        router.push(`/checkout/success?method=cod&order_id=${orderId}`);
        return;
      }

      if (selectedPayment === "wallet") {
        const idempotencyKey = crypto.randomUUID();
        const walletRes = await fetch("/api/payment/wallet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, idempotencyKey }),
        });
        const walletData = await walletRes.json();
        if (!walletRes.ok) throw new Error(walletData.error || "Gagal memproses Wallet.");
        router.push(`/checkout/success?method=wallet&order_id=${orderId}`);
        return;
      }

      // Online (Midtrans Snap)
      const snapRes = await fetch("/api/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const snapData = await snapRes.json();
      if (!snapRes.ok) throw new Error(snapData.error || "Gagal memproses pembayaran.");
      if (!snapData.token) throw new Error("Token pembayaran tidak diterima.");

      const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY!;
      await loadMidtransScript(clientKey);

      if (!(window as any).snap) throw new Error("Payment gateway tidak siap. Refresh dan coba lagi.");

      (window as any).snap.pay(snapData.token, {
        onSuccess: () => router.push(`/checkout/success?order_id=${orderId}`),
        onPending: () => {
          toast.info("Pembayaran diproses. Cek status di Pesanan saya.");
          router.push(`/orders?active=${orderId}`);
        },
        onError: () => {
          toast.error("Terjadi kesalahan saat pembayaran.");
          router.push(`/orders?active=${orderId}`);
        },
        onClose: () => {
          toast.info("Pembayaran dibatalkan. Pesanan tersimpan.");
          router.push(`/orders?active=${orderId}`);
        },
      });
    } catch (error: any) {
      toast.error(error.message || "Gagal memproses pesanan.");
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  };

  const fmt = (n: number) => n.toLocaleString("id-ID");

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] max-w-md mx-auto">
        <div className="bg-white p-4 items-center flex border-b">
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="w-24 h-6 ml-4" />
        </div>
        <div className="p-4 space-y-3">
          <Skeleton className="h-24 w-full bg-white" />
          <Skeleton className="h-32 w-full bg-white" />
          <Skeleton className="h-32 w-full bg-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] max-w-md mx-auto flex flex-col bg-slate-100 font-sans text-slate-800">

      {/* ── HEADER ── */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="flex items-center gap-4 px-4 py-3.5">
          <button onClick={() => router.back()} className="text-indigo-600">
            <ArrowLeft size={24} strokeWidth={2.5} />
          </button>
          <h1 className="text-[17px] font-medium text-slate-900">Checkout</h1>
        </div>
      </div>

      {multiShopError && (
        <div className="bg-red-50 p-4 border-b border-red-200 text-[13px] text-red-600">
          Kamu memiliki item dari 2 toko berbeda di keranjang. Hapus item dari salah satu toko.
          <button onClick={() => router.push("/cart")} className="font-bold underline ml-1">Ubah Keranjang</button>
        </div>
      )}

      {/* ── ALAMAT PENGIRIMAN ── */}
      <div className="bg-white mt-0 border-b border-slate-200 relative pt-3 pb-4">
        <div className="absolute top-0 left-0 right-0 h-[3px]" style={{
          background: "repeating-linear-gradient(45deg, #4f46e5, #4f46e5 20px, transparent 20px, transparent 30px, #f43f5e 30px, #f43f5e 50px, transparent 50px, transparent 60px)"
        }} />
        <div className="px-4 flex items-start gap-2 mt-2" onClick={() => router.push("/address")}>
          <MapPin size={16} className="text-indigo-600 shrink-0 mt-0.5" strokeWidth={2.5} />
          <div className="flex-1 cursor-pointer">
            {address ? (
              <>
                <div className="text-[13px] font-medium text-slate-900 mb-0.5 flex gap-2">
                  <span>{address.name}</span>
                  <span className="text-slate-500 font-normal">({address.phone})</span>
                </div>
                <div className="text-[13px] text-slate-600 leading-snug">
                  {address.detail}, RT.{address.rt || "00"}/RW.{address.rw || "00"} kec.{address.kecamatan}
                  <br />{address.kelurahan}, {address.city}
                </div>
                {!distance && cartItems.length > 0 && !multiShopError && (
                  <div className="text-[11px] text-amber-600 flex items-center gap-1 mt-1 bg-amber-50 inline-flex px-2 py-0.5 rounded">
                    <AlertTriangle size={10} /> Titik koordinat belum diatur
                  </div>
                )}
              </>
            ) : (
              <div className="text-[13px] text-slate-500 font-medium py-2">Silakan tambah alamat pengiriman</div>
            )}
          </div>
          <ChevronRight size={18} className="text-slate-400 shrink-0" />
        </div>
      </div>

      {/* ── TOKO & PRODUK ── */}
      <div className={`bg-white mt-2 border-y border-slate-200 ${multiShopError ? "opacity-50 pointer-events-none" : ""}`}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100">
          {shopImageUrl ? (
            <img src={shopImageUrl} alt={shopName} className="w-5 h-5 rounded-full object-cover border border-slate-200" />
          ) : (
            <Store size={18} className="text-slate-500" />
          )}
          <span className="text-[14px] font-bold text-slate-800">{shopName}</span>
        </div>

        <div className="divide-y divide-slate-50">
          {cartItems.map((item) => {
            const va = getVariantPrice(item.cart_id);
            const variantLabels = Object.values(selectedVariants[item.cart_id] || {}).map((o) => o.label).join(", ");
            return (
              <div key={item.cart_id} className="p-4 flex gap-3 bg-[#fafafa]">
                <div className="w-16 h-16 rounded border border-slate-200 bg-white shrink-0 overflow-hidden">
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  <div>
                    <p className="text-[13px] leading-tight text-slate-800 line-clamp-1">{item.name}</p>
                    {variantLabels && (
                      <p className="text-[11px] text-slate-500 mt-1">Variasi: {variantLabels}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[13px] font-medium text-slate-900">Rp{fmt(item.price + va)}</span>
                    <div className="flex items-center border border-slate-200 rounded-sm overflow-hidden h-6">
                      <button onClick={() => updateQuantity(item.cart_id, -1, item.quantity)} className="w-6 h-full flex items-center justify-center bg-white text-slate-500 active:bg-slate-100 border-r border-slate-200">
                        <span className="text-lg leading-none -mt-0.5">-</span>
                      </button>
                      <span className="w-8 h-full flex items-center justify-center text-[12px] font-medium text-slate-700 bg-white">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.cart_id, 1, item.quantity)} className="w-6 h-full flex items-center justify-center bg-white text-slate-500 active:bg-slate-100 border-l border-slate-200">
                        <span className="text-sm font-bold flex items-center leading-none">+</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Message for seller */}
        <div className="flex items-center border-y border-slate-100 px-4 py-3 bg-white">
          <span className="text-[13px] text-slate-800 w-36 shrink-0">Pesan untuk Penjual</span>
          <input
            value={messageToSeller}
            onChange={(e) => setMessageToSeller(e.target.value)}
            className="flex-1 text-[13px] text-right text-slate-800 placeholder:text-slate-400 outline-none"
            placeholder="Tinggalkan pesan (Maks. 50 char)"
            maxLength={50}
          />
        </div>

        {/* Shipping */}
        <div className="px-4 py-3.5 bg-white flex justify-between items-center border-t border-slate-100">
          <span className="text-[13px] text-slate-800">Ongkos Kirim</span>
          <span className="text-[13px] font-medium text-slate-800">Rp{fmt(shippingFee)}</span>
        </div>

        {/* Subtotal row */}
        <div className="px-4 py-3.5 bg-white flex justify-between items-center border-t border-slate-100">
          <span className="text-[13px] text-slate-800">Total {cartItems.length} Produk</span>
          <span className="text-[14px] font-semibold text-indigo-600">Rp{fmt(subTotalPrice)}</span>
        </div>
      </div>

      {/* ── METODE PEMBAYARAN ── */}
      <div className="mt-2 bg-white border-y border-slate-200">
        <div className="px-4 py-3 border-b border-slate-100">
          <span className="text-[14px] font-semibold text-slate-800">Metode Pembayaran</span>
        </div>

        <div className="p-3 space-y-2">

          {/* Wallet */}
          <button
            onClick={() => setSelectedPayment("wallet")}
            className={`w-full p-3.5 rounded-xl flex items-center gap-3 transition-all border-2 ${selectedPayment === "wallet"
              ? "bg-indigo-50 border-indigo-400"
              : "bg-slate-50 border-transparent hover:border-slate-200"
              }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${selectedPayment === "wallet" ? "bg-indigo-600 text-white" : "bg-white text-slate-400 border border-slate-200"
              }`}>
              <Wallet size={18} />
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-bold text-slate-800">Saldo Wallet</p>
                <p className={`text-[12px] font-bold ${walletInsufficient ? "text-red-500" : "text-indigo-600"}`}>
                  Rp{fmt(walletBalance)}
                </p>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {walletInsufficient ? "Saldo tidak mencukupi" : "Bayar instan dari saldo"}
              </p>
            </div>
            {selectedPayment === "wallet" && <CheckCircle2 size={18} className="text-indigo-600 shrink-0" />}
          </button>

          {/* Online / Midtrans */}
          <button
            onClick={() => setSelectedPayment("online")}
            className={`w-full p-3.5 rounded-xl flex items-center gap-3 transition-all border-2 ${selectedPayment === "online"
              ? "bg-indigo-50 border-indigo-400"
              : "bg-slate-50 border-transparent hover:border-slate-200"
              }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${selectedPayment === "online" ? "bg-indigo-600 text-white" : "bg-white text-slate-400 border border-slate-200"
              }`}>
              <CreditCard size={18} />
            </div>
            <div className="flex-1 text-left">
              <p className="text-[13px] font-bold text-slate-800">Pembayaran Online</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Transfer VA, QRIS, E-Wallet, Kartu Kredit</p>
            </div>
            {selectedPayment === "online" && <CheckCircle2 size={18} className="text-indigo-600 shrink-0" />}
          </button>

          {/* COD */}
          <button
            onClick={() => !codUnavailable && setSelectedPayment("cod")}
            disabled={codUnavailable}
            className={`w-full p-3.5 rounded-xl flex items-center gap-3 transition-all border-2 ${codUnavailable
              ? "bg-slate-50 border-dashed border-slate-200 opacity-60 cursor-not-allowed"
              : selectedPayment === "cod"
                ? "bg-indigo-50 border-indigo-400"
                : "bg-slate-50 border-transparent hover:border-slate-200"
              }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${codUnavailable
              ? "bg-white text-slate-300 border border-slate-200"
              : selectedPayment === "cod"
                ? "bg-indigo-600 text-white"
                : "bg-white text-slate-400 border border-slate-200"
              }`}>
              <Truck size={18} />
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-bold text-slate-800">Bayar di Tempat (COD)</p>
                {codUnavailable && (
                  <span className="text-[9px] font-bold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                    Tidak Tersedia
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {codUnavailable
                  ? `Hanya tersedia jarak ≤ ${COD_MAX_KM} km`
                  : "Bayar tunai saat kurir tiba"}
              </p>
            </div>
            {!codUnavailable && selectedPayment === "cod" && <CheckCircle2 size={18} className="text-indigo-600 shrink-0" />}
          </button>

          {/* COD distance error */}
          {codError && selectedPayment === "cod" && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2 mt-1">
              <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-[12px] text-amber-700 font-medium">{codError}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── RINCIAN PEMBAYARAN ── */}
      <div className="mt-2 bg-white border-y border-slate-200 px-4 py-3">
        <div className="text-[13px] font-medium text-slate-800 mb-3">Rincian Pembayaran</div>
        <div className="space-y-2.5">
          <div className="flex justify-between items-center text-[12px] text-slate-600">
            <span>Subtotal Pesanan</span>
            <span>Rp{fmt(subTotalPrice)}</span>
          </div>
          <div className="flex justify-between items-center text-[12px] text-slate-600">
            <span>Subtotal Pengiriman</span>
            <span>Rp{fmt(shippingFee)}</span>
          </div>
          {discountAmount > 0 && (
            <div className="flex justify-between items-center text-[12px] text-slate-600">
              <span>Diskon</span>
              <span className="text-emerald-500">- Rp{fmt(discountAmount)}</span>
            </div>
          )}
          <div className="flex justify-between items-center text-[13px] text-slate-800 pt-3 border-t border-slate-100 mt-1">
            <span className="font-semibold">Total Pembayaran</span>
            <span className="font-semibold text-indigo-600 text-[15px]">Rp{fmt(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* ── STICKY FOOTER ── */}

      {/* BOTTOM BAR */}
      <div className="sticky bottom-0 z-50 bg-white border-t border-slate-200">
        <div className="flex items-center">
          <div className="flex-1 pl-4">
            <div className="flex items-baseline gap-1">
              <span className="text-[12px] text-slate-500">Total</span>
              <span className="text-[17px] font-bold text-indigo-600">
                Rp{fmt(grandTotal)}
              </span>
            </div>

            {discountAmount > 0 && (
              <div className="text-[11px] text-emerald-500 font-medium">
                Hemat Rp{fmt(discountAmount)}
              </div>
            )}
          </div>

          <button
            onClick={handlePlaceOrder}
            disabled={isProcessing || !address || cartItems.length === 0 || multiShopError}
            className="h-14 flex items-center justify-center bg-indigo-600 text-white font-semibold text-[14px] disabled:bg-slate-300 px-6"
          >
            {isProcessing ? <Loader2 size={16} className="animate-spin" /> : "Buat Pesanan"}
          </button>
        </div>
      </div>

    </div>
  );
}