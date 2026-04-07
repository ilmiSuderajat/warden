"use client";
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [updatingCartId, setUpdatingCartId] = useState<string | null>(null);

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
    const { data } = await supabase
      .from("cart")
      .select("*, products(*, shops(id, name))")
      .eq("user_id", user.id);

    if (data) {
      const items = data.map((item) => {
        let variantPrice = 0;
        let variantLabels: string[] = [];
        if (item.variants) {
          Object.values(item.variants).forEach((opt: any) => {
            variantPrice += (opt.price || 0);
            variantLabels.push(opt.label);
          });
        }
        return {
          id: item.id,
          cart_id: item.id,
          product_id: item.product_id,
          name: item.products.name,
          price: item.products.price + variantPrice,
          base_price: item.products.price,
          variants_saved: item.variants || {},
          variant_labels: variantLabels,
          image_url: Array.isArray(item.products.image_url)
            ? item.products.image_url[0]
            : item.products.image_url,
          quantity: item.quantity,
          shop_name: item.products.shops?.name || "Toko",
          product_variants: item.products.variants || null,
        };
      });
      setCartItems(items);

      // Select all by default
      setSelectedIds(new Set(items.map((i: any) => i.id)));
    }
    setLoading(false);
  };

  const updateQuantity = async (id: string, delta: number, currentQty: number) => {
    const newQty = Math.max(1, currentQty + delta);
    setCartItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity: newQty } : item))
    );
    const { error } = await supabase.from("cart").update({ quantity: newQty }).eq("id", id);
    if (error) fetchCart();
  };

  const removeItem = async (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    await supabase.from("cart").delete().eq("id", id);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === cartItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(cartItems.map((i) => i.id)));
    }
  };

  const updateVariantInline = async (cartId: string, groupName: string, option: any) => {
    const item = cartItems.find((i) => i.id === cartId);
    if (!item) return;

    const newVariants = { ...item.variants_saved, [groupName]: option };

    // Optimistic Update locally
    setCartItems(prev => prev.map(i => {
      if (i.id === cartId) {
        let variantPrice = 0;
        let variantLabels: string[] = [];
        Object.values(newVariants).forEach((opt: any) => {
          variantPrice += (opt.price || 0);
          variantLabels.push(opt.label);
        });
        return {
          ...i,
          variants_saved: newVariants,
          variant_labels: variantLabels,
          price: i.base_price + variantPrice
        };
      }
      return i;
    }));

    setUpdatingCartId(cartId);
    const { error } = await supabase
      .from("cart")
      .update({ variants: newVariants })
      .eq("id", cartId);

    if (error) {
      // Revert if error
      await fetchCart();
    }
    setUpdatingCartId(null);
  };


  const selectedItems = cartItems.filter((i) => selectedIds.has(i.id));
  const subtotal = selectedItems.reduce((acc, item) => acc + item.price * (item.quantity || 1), 0);

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-slate-100 max-w-md mx-auto">
        <div className="bg-white p-4 flex items-center justify-between border-b">
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="w-32 h-6" />
          <Skeleton className="w-8 h-8 rounded-full" />
        </div>
        <div className="p-4 space-y-3">
          <Skeleton className="w-full h-32" />
          <Skeleton className="w-full h-32" />
        </div>
      </div>
    );
  }

  // Grupping by shop name
  const groupedItems = cartItems.reduce((acc, item) => {
    if (!acc[item.shop_name]) acc[item.shop_name] = [];
    acc[item.shop_name].push(item);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-slate-100 max-w-md mx-auto font-sans pb-32 text-slate-800">

      {/* ── HEADER ── */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between px-4 py-3.5">
          <button onClick={() => router.back()} className="text-indigo-600">
            <Icons.ArrowLeft size={24} strokeWidth={2} />
          </button>

          <div className="flex-1 px-4">
            <h1 className="text-lg font-medium text-slate-900">
              Keranjang Saya <span className="text-slate-500 font-normal">({cartItems.length})</span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <button className="text-slate-600 text-[14px]">Ubah</button>
            <div className="relative text-indigo-600">
              <Icons.MessageSquare size={22} strokeWidth={2} />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white flex items-center justify-center text-[9px] rounded-full font-bold">1</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── CART ITEMS ── */}
      <div className="mt-2 space-y-2">
        {cartItems.length > 0 ? (
          Object.entries(groupedItems).map(([shopName, itemsObj]) => {
            const items = itemsObj as any[];
            const isAllShopSelected = items.every((i: any) => selectedIds.has(i.id));

            const toggleShop = () => {
              setSelectedIds((prev) => {
                const next = new Set(prev);
                if (isAllShopSelected) {
                  items.forEach((i) => next.delete(i.id));
                } else {
                  items.forEach((i) => next.add(i.id));
                }
                return next;
              });
            };

            return (
              <div key={shopName} className="bg-white px-0 border-y border-slate-200">
                {/* Shop Header */}
                <div className="flex items-center justify-between px-3 py-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <button onClick={toggleShop} className="shrink-0 flex items-center justify-center">
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isAllShopSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                        {isAllShopSelected && <Icons.Check size={14} className="text-white" />}
                      </div>
                    </button>
                    <div className="flex items-center gap-1.5 cursor-pointer">
                      <span className="bg-red-600 text-white text-[10px] px-1 rounded font-bold uppercase tracking-wider">Mall | Ori</span>
                      <Icons.Store size={14} className="text-slate-600" />
                      <span className="text-sm font-semibold">{shopName}</span>
                      <Icons.ChevronRight size={14} className="text-slate-400" />
                    </div>
                  </div>
                </div>

                {/* Products */}
                <div className="divide-y divide-slate-100">
                  {items.map((item: any) => {
                    const isSelected = selectedIds.has(item.id);
                    return (
                      <div key={item.id} className="relative flex gap-3 p-3 pt-4">
                        <button onClick={() => toggleSelect(item.id)} className="shrink-0 flex pt-6">
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                            {isSelected && <Icons.Check size={14} className="text-white" />}
                          </div>
                        </button>

                        <div className="w-[84px] h-[84px] rounded border border-slate-100 overflow-hidden shrink-0">
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        </div>

                        <div className="flex-1 flex flex-col min-w-0 pb-1">
                          <h3 className="text-[13px] leading-tight text-slate-800 line-clamp-2 mb-1 pr-4">{item.name}</h3>

                          {item.product_variants && Array.isArray(item.product_variants) && item.product_variants.length > 0 && (
                            <div className="mt-1 mb-3 space-y-2">
                              {item.product_variants.map((group: any, gIdx: number) => (
                                <div key={gIdx} className="space-y-1">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{group.name}</p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {group.options.map((opt: any, oIdx: number) => {
                                      const isSelected = item.variants_saved?.[group.name]?.label === opt.label;
                                      const isUpdating = updatingCartId === item.id;
                                      return (
                                        <button
                                          key={oIdx}
                                          disabled={isUpdating}
                                          onClick={() => updateVariantInline(item.id, group.name, opt)}
                                          className={`px-2 py-1 rounded text-[10px] font-semibold border transition-all flex items-center gap-1 ${isSelected
                                            ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                                            : "bg-white border-slate-200 text-slate-600 hover:border-indigo-300"
                                            } ${isUpdating ? "opacity-50 cursor-not-allowed" : ""}`}
                                        >
                                          {isSelected && <Icons.Check size={10} strokeWidth={3} />}
                                          {opt.label}
                                          {opt.price > 0 && (
                                            <span className={`text-[8px] font-normal ${isSelected ? "text-indigo-100" : "text-slate-400"}`}>
                                              (+{opt.price.toLocaleString("id-ID")})
                                            </span>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="mt-auto flex items-end justify-between">
                            <span className="text-sm font-semibold text-indigo-600">Rp{item.price.toLocaleString("id-ID")}</span>

                            <div className="flex items-center border border-slate-200 rounded-sm overflow-hidden h-7">
                              <button onClick={() => updateQuantity(item.id, -1, item.quantity)} className="w-7 h-full flex items-center justify-center bg-white text-slate-500 active:bg-slate-100 border-r border-slate-200">
                                <Icons.Minus size={12} />
                              </button>
                              <span className="w-9 h-full flex items-center justify-center text-[13px] font-medium text-slate-700 bg-white">
                                {item.quantity}
                              </span>
                              <button onClick={() => updateQuantity(item.id, 1, item.quantity)} className="w-7 h-full flex items-center justify-center bg-white text-slate-500 active:bg-slate-100 border-l border-slate-200">
                                <Icons.Plus size={12} />
                              </button>
                            </div>
                          </div>
                          <button onClick={() => removeItem(item.id)} className="absolute top-4 right-3 text-slate-300 hover:text-red-500 transition-colors">
                            <Icons.X size={16} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-20 bg-white">
            <h3 className="text-slate-900 font-medium text-lg mb-2">Keranjang Kosong</h3>
            <Link href="/" className="px-6 py-2 border border-indigo-600 text-indigo-600 rounded text-sm font-medium mt-4">
              Belanja Sekarang
            </Link>
          </div>
        )}
      </div>

      {/* ── FOOTER CHECKOUT ── */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto bg-white border-t border-slate-200 divide-y divide-slate-100">

          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <Icons.TicketPercent size={18} className="text-indigo-600" />
              <span className="text-[13px] text-slate-800">Voucher</span>
            </div>
            <div className="flex items-center gap-1 cursor-pointer">
              <span className="text-[12px] text-slate-400">Gunakan/masukkan kode</span>
              <Icons.ChevronRight size={14} className="text-slate-400" />
            </div>
          </div>

          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <Icons.Coins size={18} className="text-amber-500" />
              <span className="text-[13px] text-slate-500">Tidak ada produk yang dipilih</span>
            </div>
            <div className="w-8 h-4 bg-slate-200 rounded-full cursor-not-allowed"></div>
          </div>

          <div className="flex items-center justify-between h-14 pl-3">
            <div className="flex items-center gap-3">
              <button onClick={toggleSelectAll} className="flex items-center gap-2">
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selectedIds.size === cartItems.length && cartItems.length > 0 ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                  {selectedIds.size === cartItems.length && cartItems.length > 0 && <Icons.Check size={14} className="text-white" />}
                </div>
                <span className="text-[14px]">Semua</span>
              </button>
            </div>

            <div className="flex items-center h-full">
              <div className="text-right pr-3 flex items-center gap-1">
                <span className="text-[14px]">Total</span>
                <span className="text-[15px] font-semibold text-indigo-600">Rp{subtotal.toLocaleString("id-ID")}</span>
              </div>
              <button
                disabled={selectedItems.length === 0}
                onClick={() => router.push("/checkout")}
                className="h-full px-6 bg-indigo-600 disabled:bg-slate-300 text-white font-medium text-[14px] transition-colors"
                style={{ width: "130px" }}
              >
                Checkout ({selectedItems.length})
              </button>
            </div>
          </div>

        </div>
      )}


    </div>
  );
}