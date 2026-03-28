/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft, MapPin, Route, PlusCircle, Minus, Plus,
  ShieldCheck, Loader2, ArrowRight, TicketPercent,
  CheckCircle2, AlertTriangle, Store, Tag, ChevronRight,
  Package, Bike
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Skeleton from "@/app/components/Skeleton";

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

export default function CheckoutPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [address, setAddress] = useState<any>(null);
  const [shippingFee, setShippingFee] = useState(0);
  const [distance, setDistance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState<SelectedVariants>({});
  const [multiShopError, setMultiShopError] = useState(false);
  const [shopName, setShopName] = useState("");

  // Voucher states
  const [voucherCode, setVoucherCode] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState<any>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [isCheckingVoucher, setIsCheckingVoucher] = useState(false);

  const TARIF_PER_KM = 2000;
  const ONGKIR_MINIMAL = 10000;

  // Haversine
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
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

      const { data: addrData } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false })
        .limit(1)
        .maybeSingle();

      setAddress(addrData);

      // ✅ FIX: Join shops table to get shop lat/lng
      const { data: cartData, error: cartError } = await supabase
        .from("cart")
        .select("*, products(*, shops(id, name, latitude, longitude))")
        .eq("user_id", user.id);

      if (cartError) {
        console.warn("Cart fetch error:", cartError);
      }

      if (cartData && cartData.length > 0) {
        const firstShopId = cartData[0].products.shop_id;
        const hasMultipleShops = cartData.some(
          (item) => item.products.shop_id !== firstShopId
        );
        if (hasMultipleShops) setMultiShopError(true);

        // Set shop name for display
        const sName = cartData[0].products.shops?.name || "";
        setShopName(sName);

        const initialVariants: SelectedVariants = {};

        const formattedCart = cartData.map((item) => {
          initialVariants[item.id] = {};

          if (item.variants && Object.keys(item.variants).length > 0) {
            initialVariants[item.id] = item.variants;
          } else if (
            item.products.variants &&
            Array.isArray(item.products.variants)
          ) {
            let hasUpdates = false;
            item.products.variants.forEach((group: any) => {
              if (group.options && group.options.length > 0) {
                const defaultOpt = { ...group.options[0], isAutoSelected: true };
                initialVariants[item.id][group.name] = defaultOpt;
                hasUpdates = true;
              }
            });
            if (hasUpdates) {
              supabase
                .from("cart")
                .update({ variants: initialVariants[item.id] })
                .eq("id", item.id)
                .then();
            }
          }

          // ✅ FIX: Prefer shop lat/lng, fallback to product lat/lng
          const shopLat = item.products.shops?.latitude ?? item.products.latitude;
          const shopLng = item.products.shops?.longitude ?? item.products.longitude;

          return {
            cart_id: item.id,
            id: item.product_id,
            name: item.products.name,
            price: item.products.price,
            image_url: Array.isArray(item.products.image_url)
              ? item.products.image_url[0]
              : item.products.image_url,
            quantity: item.quantity,
            lat: shopLat,
            lng: shopLng,
            shop_id: item.products.shop_id,
            product_variants: item.products.variants || null,
          };
        });

        setSelectedVariants(initialVariants);
        setCartItems(formattedCart);
        if (addrData && !hasMultipleShops) updateShipping(formattedCart, addrData);
      } else {
        setCartItems([]);
      }
    } catch (error) {
      console.error("Error preparing checkout:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateShipping = (items: any[], addr: any) => {
    if (items.length > 0 && addr?.latitude && items[0].lat && items[0].lng) {
      const dist = calculateDistance(
        items[0].lat,
        items[0].lng,
        addr.latitude,
        addr.longitude
      );
      setDistance(dist);
      const fee = Math.ceil(dist) * TARIF_PER_KM;
      setShippingFee(fee < ONGKIR_MINIMAL ? ONGKIR_MINIMAL : fee);
    }
  };

  const updateQuantity = async (cartId: string, newQty: number) => {
    let newItems;
    if (newQty < 1) {
      newItems = cartItems.filter((item) => item.cart_id !== cartId);
      setCartItems(newItems);
      if (newItems.length === 0) setShippingFee(0);
      await supabase.from("cart").delete().eq("id", cartId);
    } else {
      newItems = cartItems.map((item) =>
        item.cart_id === cartId ? { ...item, quantity: newQty } : item
      );
      setCartItems(newItems);
      await supabase.from("cart").update({ quantity: newQty }).eq("id", cartId);
    }
    if (address && newItems.length > 0 && !multiShopError)
      updateShipping(newItems, address);
  };

  const handleSelectVariant = async (
    cartId: string,
    groupName: string,
    option: VariantOption
  ) => {
    const newVariantStateForCart = {
      ...selectedVariants[cartId],
      [groupName]: { ...option, isAutoSelected: false },
    };
    setSelectedVariants((prev) => ({ ...prev, [cartId]: newVariantStateForCart }));
    await supabase
      .from("cart")
      .update({ variants: newVariantStateForCart })
      .eq("id", cartId);
  };

  const getVariantPrice = (cartId: string) => {
    const selections = selectedVariants[cartId];
    if (!selections) return 0;
    return Object.values(selections).reduce(
      (sum, opt) => sum + (opt.price || 0),
      0
    );
  };

  const getSubtotal = () => {
    return cartItems.reduce((acc, item) => {
      const unitPrice = item.price + getVariantPrice(item.cart_id);
      return acc + unitPrice * item.quantity;
    }, 0);
  };

  const subTotalPrice = getSubtotal();

  useEffect(() => {
    if (
      appliedVoucher &&
      subTotalPrice < (appliedVoucher.min_order_amount || 0)
    ) {
      toast.info("Voucher dilepas karena total belanja tidak memenuhi syarat.");
      removeVoucher();
    } else if (appliedVoucher) {
      recalcVoucher(subTotalPrice, appliedVoucher);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subTotalPrice]);

  const recalcVoucher = (total: number, vData: any) => {
    let calc = 0;
    if (vData.discount_type === "percentage") {
      calc = total * (vData.discount_value / 100);
      if (vData.max_discount_amount && calc > vData.max_discount_amount)
        calc = vData.max_discount_amount;
    } else {
      calc = vData.discount_value;
    }
    if (calc > total) calc = total;
    setDiscountAmount(calc);
  };

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
      if (data.usage_limit && data.used_count >= data.usage_limit) {
        toast.error("Kuota voucher ini sudah habis");
        setAppliedVoucher(null);
        setDiscountAmount(0);
        return;
      }
      if (data.min_order_amount && subTotalPrice < data.min_order_amount) {
        toast.error(
          `Minimal belanja Rp ${data.min_order_amount.toLocaleString("id-ID")}`
        );
        setAppliedVoucher(null);
        setDiscountAmount(0);
        return;
      }
      recalcVoucher(subTotalPrice, data);
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
  };

  const handlePlaceOrder = async () => {
    if (multiShopError) {
      toast.error("Selesaikan pesanan dari 1 toko terlebih dahulu!");
      return;
    }
    if (!address || cartItems.length === 0) {
      toast.error("Alamat atau keranjang tidak valid!");
      return;
    }
    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User tidak ditemukan");

      for (const item of cartItems) {
        if (item.product_variants) {
          const userSelections = selectedVariants[item.cart_id] || {};
          const missingGroup = item.product_variants.find(
            (g: any) => !userSelections[g.name]
          );
          if (missingGroup) {
            throw new Error(
              `Pilih varian "${missingGroup.name}" pada produk "${item.name}"`
            );
          }
        }
      }

      const orderAddress = `${address.detail}, RT ${address.rt || "00"}/RW ${address.rw || "00"}, ${address.kelurahan}, ${address.kecamatan}, ${address.city}`;
      const finalTotal = Math.max(0, subTotalPrice + shippingFee - discountAmount);

      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .insert([{
          customer_name: address.name,
          whatsapp_number: address.phone,
          address: orderAddress,
          latitude: address.latitude ?? null,
          longitude: address.longitude ?? null,
          maps_link:
            address.latitude && address.longitude
              ? `https://www.google.com/maps/place/${address.latitude},${address.longitude}/@${address.latitude},${address.longitude},17z`
              : null,
          subtotal_amount: subTotalPrice,
          shipping_amount: shippingFee,
          distance_km: distance,
          total_amount: finalTotal,
          status: "Menunggu Pembayaran",
          payment_status: "pending",
          user_id: user.id,
          voucher_code: appliedVoucher ? appliedVoucher.code : null,
          discount_amount: discountAmount,
        }])
        .select()
        .maybeSingle();

      if (orderError) throw orderError;

      if (appliedVoucher) {
        try {
          await supabase.rpc("increment_voucher_usage", {
            v_id: appliedVoucher.id,
          });
        } catch {
          await supabase
            .from("vouchers")
            .update({ used_count: appliedVoucher.used_count + 1 })
            .eq("id", appliedVoucher.id);
        }
      }

      const itemsToInsert = cartItems.map((item: any) => {
        const finalPricePerItem = item.price + getVariantPrice(item.cart_id);
        let cleanVariants: Record<string, any> | null = null;
        if (selectedVariants[item.cart_id]) {
          cleanVariants = JSON.parse(
            JSON.stringify(selectedVariants[item.cart_id])
          );
          if (cleanVariants) {
            Object.keys(cleanVariants).forEach(
              (k) => delete cleanVariants![k].isAutoSelected
            );
          }
        }
        return {
          order_id: orderData.id,
          product_id: item.id,
          product_name: `${item.name} | ${item.shop_id}`,
          quantity: item.quantity,
          price: item.price,
          final_price: finalPricePerItem,
          variants: cleanVariants,
          image_url: item.image_url,
        };
      });

      const { error: insertItemsError } = await supabase
        .from("order_items")
        .insert(itemsToInsert);

      if (insertItemsError) {
        await supabase.from("orders").delete().eq("id", orderData.id);
        throw new Error("Gagal finalisasi item: " + insertItemsError.message);
      }

      await supabase.from("cart").delete().eq("user_id", user.id);
      router.push(`/checkout/payment?order_id=${orderData.id}`);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Gagal memproses pesanan.");
      setIsProcessing(false);
    }
  };

  const fmt = (n: number) => n.toLocaleString("id-ID");

  // ─── LOADING SKELETON ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] max-w-md mx-auto">
        <div className="bg-white sticky top-0 z-40 border-b border-slate-100">
          <div className="flex items-center gap-3 px-4 pt-14 pb-4">
            <Skeleton className="w-9 h-9 rounded-full bg-slate-200" />
            <Skeleton className="h-5 w-40 bg-slate-200 rounded" />
          </div>
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full bg-white rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const grandTotal = Math.max(0, subTotalPrice + shippingFee - discountAmount);

  // ─── MAIN RENDER ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F5F5F5] max-w-md mx-auto pb-52 font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        .checkout-page * { font-family: 'Inter', sans-serif; }
        .price-tag { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .btn-order { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); }
        .btn-order:disabled { background: #e2e8f0; color: #94a3b8; }
        @keyframes slideUp { from { opacity:0; transform: translateY(8px);} to { opacity:1; transform:none; } }
        .slide-up { animation: slideUp 0.25s ease forwards; }
      `}</style>

      {/* ── HEADER ── */}
      <div className="bg-white sticky top-0 z-40 border-b border-slate-100 shadow-sm checkout-page">
        <div className="flex items-center gap-3 px-4 pt-14 pb-4">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-slate-700 active:scale-90 transition-transform"
          >
            <ArrowLeft size={18} strokeWidth={2.5} />
          </button>
          <h1 className="text-[15px] font-bold text-slate-900 flex-1">Checkout</h1>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
            <span className="w-5 h-5 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px] font-bold">1</span>
            <span className="text-orange-500 font-semibold">Pesanan</span>
            <ChevronRight size={12} className="text-slate-300" />
            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[10px] font-bold">2</span>
            <span>Bayar</span>
          </div>
        </div>
      </div>

      <div className="checkout-page">

        {/* ── MULTI SHOP ERROR ── */}
        {multiShopError && (
          <div className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3 slide-up">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
              <AlertTriangle size={18} className="text-red-500" />
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-bold text-red-700 mb-1">Checkout dari 2 toko berbeda!</p>
              <p className="text-[11px] text-red-600 leading-relaxed">Kamu hanya bisa checkout dari 1 toko sekaligus. Hapus produk dari toko lain.</p>
              <button
                onClick={() => router.push("/cart")}
                className="mt-2.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-[11px] font-bold active:scale-95 transition-transform"
              >
                Edit Keranjang
              </button>
            </div>
          </div>
        )}

        {/* ── ALAMAT PENGIRIMAN ── */}
        <div className="mx-4 mt-4 bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100">
          {/* Section header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-50">
            <MapPin size={14} className="text-orange-500" strokeWidth={2.5} />
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Alamat Pengiriman</span>
          </div>

          {address ? (
            <div className="px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[13px] font-bold text-slate-900">{address.name}</p>
                    <span className="text-[10px] text-slate-400 font-medium">{address.phone}</span>
                  </div>
                  <p className="text-[12px] text-slate-500 leading-relaxed capitalize">
                    {address.detail}, RT {address.rt || "00"}/RW {address.rw || "00"},<br />
                    {address.kelurahan}, {address.kecamatan}, {address.city}
                  </p>
                  {distance > 0 && (
                    <div className="mt-2.5 inline-flex items-center gap-1.5 bg-blue-50 border border-blue-100 px-2.5 py-1.5 rounded-lg">
                      <Route size={11} className="text-blue-500" />
                      <span className="text-[11px] font-semibold text-blue-600">
                        {distance.toFixed(1)} km dari toko
                      </span>
                    </div>
                  )}
                  {!distance && address && cartItems.length > 0 && (
                    <div className="mt-2.5 inline-flex items-center gap-1.5 bg-amber-50 border border-amber-100 px-2.5 py-1.5 rounded-lg">
                      <AlertTriangle size={11} className="text-amber-500" />
                      <span className="text-[11px] font-semibold text-amber-600">
                        Lokasi toko belum diatur
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => router.push("/address")}
                  className="shrink-0 text-[11px] font-bold text-orange-500 border border-orange-200 bg-orange-50 px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
                >
                  Ubah
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => router.push("/address/add")}
              className="w-full px-4 py-5 flex items-center gap-3 text-slate-500 hover:bg-slate-50 transition-colors active:scale-[0.99]"
            >
              <div className="w-10 h-10 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center">
                <PlusCircle size={18} className="text-slate-400" />
              </div>
              <div className="text-left">
                <p className="text-[13px] font-bold text-slate-700">Tambah Alamat Pengiriman</p>
                <p className="text-[11px] text-slate-400">Belum ada alamat tersimpan</p>
              </div>
            </button>
          )}
        </div>

        {/* ── PESANAN DARI TOKO ── */}
        <div className={`mx-4 mt-3 bg-white rounded-2xl overflow-hidden shadow-sm border ${multiShopError ? "border-red-200" : "border-slate-100"}`}>
          {/* Store header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-50 bg-slate-50/60">
            <Store size={13} className="text-slate-500" />
            <span className="text-[12px] font-bold text-slate-700 flex-1 truncate">
              {shopName || "Toko"}
            </span>
            <Package size={12} className="text-slate-400" />
            <span className="text-[11px] text-slate-400 font-medium">{cartItems.length} produk</span>
          </div>

          {/* Cart Items */}
          <div className="divide-y divide-slate-50">
            {cartItems.map((item: any) => {
              const variantAddon = getVariantPrice(item.cart_id);
              const unitPrice = item.price + variantAddon;
              const itemTotal = unitPrice * item.quantity;

              return (
                <div key={item.cart_id} className="px-4 py-4 slide-up">
                  {/* Product row */}
                  <div className="flex gap-3">
                    <div className="w-[72px] h-[72px] rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-100">
                      <img
                        src={item.image_url}
                        className="w-full h-full object-cover"
                        alt={item.name}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-slate-800 leading-snug line-clamp-2 mb-1">
                        {item.name}
                      </p>

                      {/* Price display */}
                      <div className="flex items-center gap-1.5 flex-wrap mb-2">
                        <span className="text-[13px] font-extrabold text-orange-600">
                          Rp {fmt(item.price)}
                        </span>
                        {variantAddon > 0 && (
                          <>
                            <span className="text-[11px] text-slate-400">+</span>
                            <span className="text-[11px] font-bold text-purple-600 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded-md">
                              +Rp {fmt(variantAddon)}
                            </span>
                            <span className="text-[11px] text-slate-400">=</span>
                            <span className="text-[12px] font-bold text-slate-700">
                              Rp {fmt(unitPrice)}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Quantity control */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                          <button
                            disabled={multiShopError}
                            onClick={() => updateQuantity(item.cart_id, item.quantity - 1)}
                            className="w-8 h-8 flex items-center justify-center text-slate-600 hover:bg-slate-200 active:bg-slate-300 transition-colors disabled:opacity-40"
                          >
                            <Minus size={13} strokeWidth={2.5} />
                          </button>
                          <span className="w-8 text-center text-[13px] font-bold text-slate-800">
                            {item.quantity}
                          </span>
                          <button
                            disabled={multiShopError}
                            onClick={() => updateQuantity(item.cart_id, item.quantity + 1)}
                            className="w-8 h-8 flex items-center justify-center text-orange-600 hover:bg-orange-100 active:bg-orange-200 bg-orange-50/50 transition-colors disabled:opacity-40"
                          >
                            <Plus size={13} strokeWidth={2.5} />
                          </button>
                        </div>
                        {/* Item subtotal */}
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 font-medium">
                            {item.quantity} × Rp {fmt(unitPrice)}
                          </p>
                          <p className="text-[14px] font-extrabold text-slate-900">
                            Rp {fmt(itemTotal)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Variant Selector */}
                  {item.product_variants && item.product_variants.length > 0 && (
                    <div className="mt-3 bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-3">
                      {item.product_variants.map((group: any) => {
                        const currentSel = selectedVariants[item.cart_id]?.[group.name];
                        const isAuto = currentSel?.isAutoSelected;

                        return (
                          <div key={group.name}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                                {group.name}
                              </span>
                              {isAuto && (
                                <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                  <AlertTriangle size={8} />
                                  Otomatis
                                </span>
                              )}
                              {!isAuto && currentSel && (
                                <span className="text-[9px] font-semibold text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                  <CheckCircle2 size={8} />
                                  Terpilih
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {group.options.map((opt: VariantOption) => {
                                const isSel = currentSel?.label === opt.label;
                                return (
                                  <button
                                    disabled={multiShopError}
                                    key={opt.label}
                                    onClick={() =>
                                      handleSelectVariant(item.cart_id, group.name, opt)
                                    }
                                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all border outline-none active:scale-95 flex items-center gap-1 disabled:opacity-50
                                      ${isSel
                                        ? "bg-orange-500 text-white border-orange-500 shadow-sm shadow-orange-300/40"
                                        : "bg-white text-slate-600 border-slate-200 hover:border-orange-300"
                                      }`}
                                  >
                                    {isSel && <CheckCircle2 size={10} />}
                                    {opt.label}
                                    {opt.price > 0 && (
                                      <span
                                        className={
                                          isSel
                                            ? "text-orange-200"
                                            : "text-purple-500 font-semibold"
                                        }
                                      >
                                        +{fmt(opt.price)}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Shipping info row */}
          {!multiShopError && (
            <div className="px-4 py-3 bg-blue-50 border-t border-blue-100 flex items-center gap-2">
              <Bike size={14} className="text-blue-500 shrink-0" />
              <div className="flex-1">
                <span className="text-[11px] text-blue-700 font-semibold">
                  Pengiriman reguler
                  {distance > 0 && ` • ${distance.toFixed(1)} km`}
                </span>
              </div>
              <span className="text-[12px] font-bold text-blue-700">
                Rp {fmt(shippingFee)}
              </span>
            </div>
          )}
        </div>

        {/* ── VOUCHER ── */}
        <div className="mx-4 mt-3 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-50">
            <Tag size={13} className="text-emerald-500" />
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex-1">
              Voucher / Promo
            </span>
          </div>

          <div className="px-4 py-3.5">
            {appliedVoucher ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-3 flex items-center justify-between slide-up">
                <div>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <ShieldCheck size={12} className="text-emerald-600" />
                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                      Voucher Aktif
                    </span>
                  </div>
                  <p className="text-[13px] font-extrabold text-emerald-800 uppercase">
                    {appliedVoucher.code}
                  </p>
                  <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                    Hemat Rp {fmt(discountAmount)}
                  </p>
                </div>
                <button
                  onClick={removeVoucher}
                  className="text-[11px] font-bold text-red-500 border border-red-200 bg-white px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
                >
                  Hapus
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  disabled={multiShopError}
                  type="text"
                  placeholder="Masukkan kode voucher..."
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold text-slate-800 placeholder:text-slate-400 placeholder:font-normal outline-none focus:border-orange-400 focus:ring-3 focus:ring-orange-400/10 transition uppercase disabled:opacity-50"
                />
                <button
                  onClick={applyVoucher}
                  disabled={isCheckingVoucher || !voucherCode || multiShopError}
                  className="bg-slate-900 text-white font-bold text-[12px] px-4 py-2.5 rounded-xl active:scale-95 transition-transform disabled:opacity-40 flex items-center gap-1.5 shrink-0"
                >
                  {isCheckingVoucher ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <TicketPercent size={14} />
                  )}
                  Pakai
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── RINCIAN HARGA ── */}
        <div className="mx-4 mt-3 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-50">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Rincian Harga
            </span>
          </div>
          <div className="px-4 py-3.5 space-y-2.5">
            {/* Per item breakdown */}
            {cartItems.map((item) => {
              const va = getVariantPrice(item.cart_id);
              const unitP = item.price + va;
              return (
                <div key={item.cart_id} className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-slate-600 font-medium truncate">{item.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {item.quantity} × Rp {fmt(unitP)}
                      {va > 0 && (
                        <span className="text-purple-500 font-semibold">
                          {" "}(+Rp {fmt(va)} varian)
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="text-[12px] font-bold text-slate-700 shrink-0">
                    Rp {fmt(unitP * item.quantity)}
                  </span>
                </div>
              );
            })}

            <div className="border-t border-dashed border-slate-200 pt-2.5 space-y-2">
              <div className="flex justify-between text-[12px]">
                <span className="text-slate-500">Subtotal Produk</span>
                <span className="font-bold text-slate-700">Rp {fmt(subTotalPrice)}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-slate-500">
                  Ongkos Kirim
                  {distance > 0 && (
                    <span className="text-slate-400"> ({distance.toFixed(1)} km × Rp {fmt(TARIF_PER_KM)})</span>
                  )}
                </span>
                <span className="font-bold text-slate-700">Rp {fmt(shippingFee)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-[12px]">
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <TicketPercent size={11} />
                    Diskon Voucher
                  </span>
                  <span className="font-bold text-emerald-600">- Rp {fmt(discountAmount)}</span>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ── STICKY FOOTER ── */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-50 checkout-page">
        <div className="bg-white border-t border-slate-100 shadow-[0_-8px_32px_rgba(0,0,0,0.10)] px-4 pt-4 pb-6">
          {/* Total row */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">
                Total Pembayaran
              </p>
              <p className="text-[22px] font-black text-slate-900 leading-none tracking-tight">
                Rp {fmt(grandTotal)}
              </p>
              {discountAmount > 0 && (
                <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">
                  Hemat Rp {fmt(discountAmount)} 🎉
                </p>
              )}
            </div>

            <button
              onClick={handlePlaceOrder}
              disabled={
                isProcessing ||
                !address ||
                cartItems.length === 0 ||
                multiShopError
              }
              className="btn-order h-12 px-6 text-white rounded-2xl text-[13px] font-bold transition-all active:scale-[0.96] disabled:bg-slate-200 disabled:text-slate-400 shadow-lg shadow-orange-500/25 flex items-center gap-2 min-w-[150px] justify-center"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <span>Bayar Sekarang</span>
                  <ArrowRight size={15} strokeWidth={2.5} className="group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </div>

          {/* Trust badges */}
          <div className="flex items-center justify-center gap-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-1">
              <ShieldCheck size={11} className="text-emerald-500" />
              <span className="text-[10px] text-slate-400 font-medium">Transaksi Aman</span>
            </div>
            <span className="text-slate-200">•</span>
            <div className="flex items-center gap-1">
              <Package size={11} className="text-blue-500" />
              <span className="text-[10px] text-slate-400 font-medium">Garansi Pesanan</span>
            </div>
            <span className="text-slate-200">•</span>
            <div className="flex items-center gap-1">
              <Bike size={11} className="text-orange-400" />
              <span className="text-[10px] text-slate-400 font-medium">Antar ke Pintu</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}