"use client"
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as Icons from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Skeleton from "@/app/components/Skeleton";

// ── Inline Confirmation Modal ──────────────────────────────────────────────
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
      className="fixed inset-0 z-[100] flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-t-3xl p-6 pb-10"
        style={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-6" />

        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/25 flex items-center justify-center mb-4">
            <Icons.Trash2 size={24} className="text-red-400" />
          </div>
          <h3 className="text-white font-black text-lg mb-1">{title}</h3>
          <p className="text-white/50 text-sm">{description}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onCancel}
            className="h-12 rounded-2xl font-bold text-sm text-white/70 transition-all active:scale-95"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            className="h-12 rounded-2xl font-bold text-sm text-white transition-all active:scale-95 shadow-lg"
            style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)", boxShadow: "0 8px 20px rgba(239,68,68,0.35)" }}
          >
            Kosongkan
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
        data.map((item) => ({
          id: item.id,
          product_id: item.product_id,
          name: item.products.name,
          price: item.products.price,
          image_url: Array.isArray(item.products.image_url)
            ? item.products.image_url[0]
            : item.products.image_url,
          quantity: item.quantity,
        }))
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
    // Small delay for exit animation feel
    setTimeout(async () => {
      setCartItems((prev) => prev.filter((item) => item.id !== id));
      setRemovingId(null);
      const { error } = await supabase.from("cart").delete().eq("id", id);
      if (error) fetchCart();
    }, 180);
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

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading)
    return (
      <div
        className="min-h-screen max-w-md mx-auto pb-36"
        style={{ background: "linear-gradient(160deg, #0f172a 0%, #1a1a2e 100%)" }}
      >
        <div className="sticky top-0 z-40 px-5 pt-14 pb-4" style={{ background: "rgba(15,23,42,0.85)", backdropFilter: "blur(12px)" }}>
          <div className="flex items-center justify-between">
            <Skeleton className="w-9 h-9 rounded-xl" />
            <Skeleton className="h-5 w-24 rounded-lg" />
            <div className="w-9" />
          </div>
        </div>
        <div className="p-4 space-y-3">
          {Array(3)
            .fill(0)
            .map((_, i) => (
              <div
                key={i}
                className="rounded-2xl p-4 flex gap-4"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
              >
                <Skeleton className="w-20 h-20 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <Skeleton className="h-4 w-3/4 rounded-lg" />
                  <Skeleton className="h-5 w-1/2 rounded-lg" />
                  <div className="flex justify-between pt-2">
                    <Skeleton className="h-8 w-24 rounded-full" />
                    <Skeleton className="w-7 h-7 rounded-xl" />
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    );

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen font-sans max-w-md mx-auto relative pb-36"
      style={{ background: "linear-gradient(160deg, #0f172a 0%, #1a1a2e 100%)" }}
    >
      {/* Clear confirmation modal */}
      <ConfirmModal
        open={showClearModal}
        title="Kosongkan Keranjang?"
        description="Semua item akan dihapus dari keranjangmu."
        onConfirm={handleClearConfirm}
        onCancel={() => setShowClearModal(false)}
      />

      {/* ── HEADER ── */}
      <div
        className="sticky top-0 z-40"
        style={{ background: "rgba(15,23,42,0.85)", backdropFilter: "blur(14px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center justify-between px-5 pt-14 pb-4">
          <button
            onClick={() => router.back()}
            className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <Icons.ArrowLeft size={18} className="text-white/80" strokeWidth={2.5} />
          </button>

          <div className="flex items-center gap-2">
            <h1 className="text-base font-black text-white tracking-tight">Keranjang</h1>
            {cartItems.length > 0 && (
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white"
                style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
              >
                {cartItems.length}
              </span>
            )}
          </div>

          {cartItems.length > 0 ? (
            <button
              onClick={() => setShowClearModal(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
              style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <Icons.Trash2 size={16} className="text-red-400" />
            </button>
          ) : (
            <div className="w-9" />
          )}
        </div>
      </div>

      {/* ── CART ITEMS ── */}
      <div className="p-4 space-y-3">
        {cartItems.length > 0 ? (
          cartItems.map((item, i) => (
            <div
              key={item.id}
              className="rounded-2xl p-4 flex gap-4 transition-all duration-200"
              style={{
                background: removingId === item.id ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.04)",
                border: removingId === item.id ? "1px solid rgba(239,68,68,0.2)" : "1px solid rgba(255,255,255,0.08)",
                opacity: removingId === item.id ? 0.4 : 1,
                transform: removingId === item.id ? "scale(0.97)" : "scale(1)",
              }}
            >
              {/* Product image */}
              <div
                className="w-20 h-20 rounded-2xl overflow-hidden shrink-0"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Detail */}
              <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
                <div>
                  <h3 className="text-sm font-bold text-white/90 line-clamp-2 leading-snug">{item.name}</h3>
                  <p
                    className="text-sm font-black mt-1.5"
                    style={{
                      background: "linear-gradient(90deg,#e0e7ff,#a5b4fc)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    Rp {item.price.toLocaleString("id-ID")}
                  </p>
                </div>

                {/* Quantity + Remove row */}
                <div className="flex items-center justify-between mt-3">
                  {/* Qty pill */}
                  <div
                    className="flex items-center gap-1 rounded-full p-1"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    <button
                      onClick={() => updateQuantity(item.id, -1, item.quantity)}
                      className="w-7 h-7 flex items-center justify-center rounded-full transition-colors"
                      style={{ background: "rgba(255,255,255,0.07)" }}
                    >
                      <Icons.Minus size={13} className="text-white/70" />
                    </button>
                    <span className="w-6 text-center text-xs font-black text-white">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, 1, item.quantity)}
                      className="w-7 h-7 flex items-center justify-center rounded-full transition-colors"
                      style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
                    >
                      <Icons.Plus size={13} className="text-white" />
                    </button>
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={() => removeItem(item.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl transition-all active:scale-90"
                    style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.15)" }}
                  >
                    <Icons.X size={14} className="text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          /* ── EMPTY STATE ── */
          <div className="flex flex-col items-center justify-center py-24 text-center px-8">
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <Icons.ShoppingBag size={36} className="text-white/20" />
            </div>
            <h3 className="text-white font-black text-xl mb-2">Keranjang Kosong</h3>
            <p className="text-white/40 text-sm leading-relaxed mb-8">
              Belum ada item di keranjangmu. Yuk mulai belanja!
            </p>
            <Link
              href="/"
              className="px-8 py-3 rounded-2xl text-sm font-black text-white transition-all active:scale-95"
              style={{
                background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                boxShadow: "0 8px 24px rgba(99,102,241,0.35)",
              }}
            >
              Mulai Belanja
            </Link>
          </div>
        )}
      </div>

      {/* ── FOOTER CHECKOUT ── */}
      {cartItems.length > 0 && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto p-4"
          style={{
            background: "rgba(15,23,42,0.90)",
            backdropFilter: "blur(16px)",
            borderTop: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          {/* Subtotal row */}
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="text-[11px] font-bold text-white/40 uppercase tracking-widest">Total</span>
            <span className="text-xl font-black text-white">
              Rp {subtotal.toLocaleString("id-ID")}
            </span>
          </div>

          {/* Checkout CTA */}
          <button
            onClick={() => router.push("/checkout")}
            className="w-full h-14 rounded-2xl font-black text-sm text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              boxShadow: "0 10px 28px rgba(99,102,241,0.40)",
            }}
          >
            <span>Lanjut Checkout</span>
            <Icons.ArrowRight size={18} strokeWidth={2.5} />
          </button>
        </div>
      )}
    </div>
  );
}