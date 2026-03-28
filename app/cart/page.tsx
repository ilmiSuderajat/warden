"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as Icons from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Skeleton from "@/app/components/Skeleton";

// ── Inline Confirmation Modal (Clean Version) ──────────────────────────────
function ConfirmModal({
  open,
  title,
  description,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center max-w-md mx-auto bg-slate-900/40 backdrop-blur-sm transition-opacity"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-t-3xl p-6 pb-10 bg-white animate-slide-up shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-1.5 rounded-full bg-slate-200 mx-auto mb-8" />

        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-5 border border-red-100">
            <Icons.Trash2 size={28} className="text-red-500" />
          </div>
          <h3 className="text-slate-900 font-bold text-xl mb-2">{title}</h3>
          <p className="text-slate-500 text-sm leading-relaxed">{description}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={onCancel}
            className="h-14 rounded-2xl font-semibold text-sm text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all active:scale-95"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            className="h-14 rounded-2xl font-semibold text-sm text-white bg-red-500 hover:bg-red-600 transition-all active:scale-95 shadow-lg shadow-red-500/20"
          >
            Hapus Semua
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function CartPage() {
  const router = useRouter();
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClearModal, setShowClearModal] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }
    const { data } = await supabase
      .from("cart")
      .select("*, products(*)")
      .eq("user_id", user.id);
    if (data) {
      setCartItems(
        data.map((item) => {
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
            product_id: item.product_id,
            name: item.products.name,
            price: item.products.price + variantPrice,
            base_price: item.products.price,
            variant_labels: variantLabels,
            image_url: Array.isArray(item.products.image_url)
              ? item.products.image_url[0]
              : item.products.image_url,
            quantity: item.quantity,
          };
        })
      );
    }
    setLoading(false);
  };

  const updateQuantity = async (id: string, delta: number, currentQty: number) => {
    const newQty = Math.max(1, currentQty + delta);
    setCartItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity: newQty } : item))
    );
    const { error } = await supabase
      .from("cart")
      .update({ quantity: newQty })
      .eq("id", id);
    if (error) fetchCart();
  };

  const removeItem = async (id: string) => {
    setRemovingId(id);
    setTimeout(async () => {
      setCartItems((prev) => prev.filter((item) => item.id !== id));
      setRemovingId(null);
      const { error } = await supabase.from("cart").delete().eq("id", id);
      if (error) fetchCart();
    }, 200);
  };

  const handleClearConfirm = async () => {
    setShowClearModal(false);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("cart").delete().eq("user_id", user?.id);
    setCartItems([]);
  };

  const subtotal = cartItems.reduce(
    (acc, item) => acc + item.price * (item.quantity || 1),
    0
  );

  // Simple CSS animation for modal
  const style = `
    @keyframes slide-up {
      from { transform: translateY(100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .animate-slide-up { animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
  `;

  // ── Loading skeleton (Clean Mode) ────────────────────────────────────────
  if (loading)
    return (
      <div className="min-h-screen max-w-md mx-auto bg-slate-50 pb-36">
        <style>{style}</style>
        <div className="sticky top-0 z-40 px-5 pt-14 pb-4 bg-white/80 backdrop-blur-xl border-b border-slate-200">
          <div className="flex items-center justify-between">
            <Skeleton className="w-10 h-10 rounded-full bg-slate-200" />
            <Skeleton className="h-5 w-28 rounded-lg bg-slate-200" />
            <div className="w-10" />
          </div>
        </div>
        <div className="p-5 space-y-4">
          {Array(3)
            .fill(0)
            .map((_, i) => (
              <div key={i} className="rounded-2xl p-4 flex gap-4 bg-white border border-slate-100 shadow-sm">
                <Skeleton className="w-24 h-24 rounded-xl shrink-0 bg-slate-100" />
                <div className="flex-1 space-y-3 py-1">
                  <Skeleton className="h-4 w-full rounded-lg bg-slate-100" />
                  <Skeleton className="h-4 w-1/2 rounded-lg bg-slate-100" />
                  <Skeleton className="h-6 w-20 rounded-lg mt-4 bg-slate-100" />
                </div>
              </div>
            ))}
        </div>
      </div>
    );

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen font-sans max-w-md mx-auto relative pb-36 bg-slate-50 text-slate-900">
      <style>{style}</style>
      
      <ConfirmModal
        open={showClearModal}
        title="Hapus Semua Item?"
        description="Tindakan ini akan menghapus semua produk di keranjang belanja kamu."
        onConfirm={handleClearConfirm}
        onCancel={() => setShowClearModal(false)}
      />

      {/* ── HEADER ── */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200">
        <div className="flex items-center justify-between px-5 pt-14 pb-4">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors active:scale-90"
          >
            <Icons.ArrowLeft size={20} className="text-slate-700" strokeWidth={2.5} />
          </button>

          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">Keranjang</h1>
            {cartItems.length > 0 && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                {cartItems.length}
              </span>
            )}
          </div>

          {cartItems.length > 0 ? (
            <button
              onClick={() => setShowClearModal(true)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-red-50 transition-colors group active:scale-90"
            >
              <Icons.Trash2 size={18} className="text-slate-400 group-hover:text-red-500 transition-colors" />
            </button>
          ) : (
            <div className="w-10" />
          )}
        </div>
      </div>

      {/* ── CART ITEMS ── */}
      <div className="p-5 space-y-4">
        {cartItems.length > 0 ? (
          cartItems.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl overflow-hidden transition-all duration-300 border border-slate-100 shadow-sm"
              style={{
                opacity: removingId === item.id ? 0.5 : 1,
                transform: removingId === item.id ? "scale(0.96)" : "scale(1)",
              }}
            >
              <div className="flex gap-4 p-4">
                {/* Product image */}
                <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-slate-100 border border-slate-50">
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Detail */}
                <div className="flex-1 flex flex-col justify-between min-w-0 py-0.5">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug mb-1">
                      {item.name}
                    </h3>
                    {item.variant_labels && item.variant_labels.length > 0 && (
                      <p className="text-[11px] font-medium text-slate-500 mb-1 line-clamp-1">
                        Varian: {item.variant_labels.join(', ')}
                      </p>
                    )}
                    <p className="text-base font-bold text-indigo-600">
                      Rp {item.price.toLocaleString("id-ID")}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    {/* Modern Quantity Selector */}
                    <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                      <button
                        onClick={() => updateQuantity(item.id, -1, item.quantity)}
                        className="w-9 h-9 flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-colors active:bg-slate-300"
                      >
                        <Icons.Minus size={14} strokeWidth={2.5} />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-slate-700 select-none">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id, 1, item.quantity)}
                        className="w-9 h-9 flex items-center justify-center text-indigo-600 hover:bg-indigo-100 transition-colors bg-indigo-50"
                      >
                        <Icons.Plus size={14} strokeWidth={2.5} />
                      </button>
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => removeItem(item.id)}
                      className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors active:scale-90"
                    >
                      <Icons.Trash2 size={18} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          /* ── EMPTY STATE ── */
          <div className="flex flex-col items-center justify-center py-20 text-center px-8">
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-6 border border-slate-200">
              <Icons.ShoppingBag size={32} className="text-slate-400" />
            </div>
            <h3 className="text-slate-900 font-bold text-xl mb-2">Keranjang Kosong</h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-8 max-w-xs">
              Yah, keranjangmu masih kosong. Yuk mulai belanja dan temukan produk favoritmu!
            </p>
            <Link
              href="/"
              className="px-8 py-3.5 rounded-2xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-600/30"
            >
              Mulai Belanja
            </Link>
          </div>
        )}
      </div>

      {/* ── FOOTER CHECKOUT ── */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto bg-white border-t border-slate-200 p-5 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          
          {/* Summary Details */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Total Pembayaran</p>
              <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
                Rp {subtotal.toLocaleString("id-ID")}
              </p>
            </div>
            <div className="text-right">
               <p className="text-xs font-medium text-slate-700">{cartItems.length} Item</p>
               <p className="text-xs text-slate-400">Belum termasuk ongkir</p>
            </div>
          </div>

          {/* Checkout CTA */}
          <button
            onClick={() => router.push("/checkout")}
            className="w-full h-14 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/30"
          >
            <span>Lanjut ke Pembayaran</span>
            <Icons.ArrowRight size={18} strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  );
}