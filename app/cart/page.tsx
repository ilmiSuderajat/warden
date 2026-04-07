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
  
  // Variant Edit Modal
  const [editingVariantItem, setEditingVariantItem] = useState<any>(null);
  const [tempVariants, setTempVariants] = useState<Record<string, any>>({});
  const [isUpdatingVariant, setIsUpdatingVariant] = useState(false);

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

  const handleOpenVariantEdit = (item: any) => {
    setEditingVariantItem(item);
    setTempVariants(item.variants_saved || {});
  };

  const saveVariants = async () => {
    if (!editingVariantItem) return;
    setIsUpdatingVariant(true);
    const { error } = await supabase.from("cart").update({ variants: tempVariants }).eq("id", editingVariantItem.cart_id);
    if (!error) {
       await fetchCart();
       setEditingVariantItem(null);
    }
    setIsUpdatingVariant(false);
  };

  const selectedItems = cartItems.filter((i) => selectedIds.has(i.id));
  const subtotal = selectedItems.reduce((acc, item) => acc + item.price * (item.quantity || 1), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 max-w-md mx-auto">
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
    <div className="min-h-screen bg-slate-100 max-w-md mx-auto font-sans pb-32 text-slate-800">
      
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
                          
                          {item.variant_labels && item.variant_labels.length > 0 && (
                            <button onClick={() => handleOpenVariantEdit(item)} className="self-start mt-0.5 mb-2 bg-slate-50 border border-slate-100 px-2 py-0.5 flex items-center gap-1 rounded text-[11px] text-slate-500 hover:bg-slate-100 transition-colors">
                              <span>Variasi: {item.variant_labels.join(', ')}</span>
                              <Icons.ChevronDown size={10} />
                            </button>
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

      {/* VARIANT EDIT MODAL */}
      {editingVariantItem && editingVariantItem.product_variants && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[90] animate-in fade-in" onClick={() => setEditingVariantItem(null)}></div>
          <div className="fixed bottom-0 left-0 right-0 z-[100] bg-white rounded-t-3xl p-5 animate-in slide-in-from-bottom flex flex-col shadow-2xl max-w-md mx-auto" style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-slate-800">Ubah Variasi</h3>
              <button onClick={() => setEditingVariantItem(null)} className="p-2 -mr-2 text-slate-400 hover:bg-slate-50 rounded-full">
                <Icons.X size={20} />
              </button>
            </div>
            
            <div className="flex gap-3 mb-5 pb-5 border-b border-slate-100">
              <img src={editingVariantItem.image_url} className="w-16 h-16 object-cover rounded-lg border border-slate-100" alt="" />
              <div>
                <p className="text-xl font-bold text-indigo-600">
                  Rp {(() => {
                    let price = editingVariantItem.base_price;
                    Object.values(tempVariants).forEach(v => { price += (v.price || 0) });
                    return price.toLocaleString('id-ID');
                  })()}
                </p>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{editingVariantItem.name}</p>
              </div>
            </div>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto no-scrollbar pb-4">
              {editingVariantItem.product_variants.map((group: any, idx: number) => (
                <div key={idx}>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{group.name}</h4>
                  <div className="flex flex-wrap gap-2">
                    {group.options.map((opt: any, oIdx: number) => {
                      const isSelected = tempVariants[group.name]?.label === opt.label;
                      return (
                        <button
                          key={oIdx}
                          onClick={() => setTempVariants(prev => ({ ...prev, [group.name]: opt }))}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                            isSelected ? 'bg-indigo-50 border-indigo-500 text-indigo-700' : 'bg-white border-slate-200 text-slate-600'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <button
              disabled={isUpdatingVariant}
              onClick={saveVariants}
              className="mt-4 w-full h-12 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl font-bold transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center"
            >
              {isUpdatingVariant ? <Icons.Loader2 className="animate-spin" size={20} /> : 'Konfirmasi'}
            </button>
          </div>
        </>
      )}

    </div>
  );
}