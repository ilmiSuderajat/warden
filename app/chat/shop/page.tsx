"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Store, MessageCircle, Loader2, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ChatConversation {
  id: string;
  shop_id: string;
  buyer_id: string;
  last_message: string;
  last_time: string;
  unread_count: number;
  display_name: string;
  display_image: string | null;
  display_role: "buyer" | "shop";
}

export default function UnifiedShopChatList() {
  const router = useRouter();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoading(false);
        return;
      }

      const uid = session.user.id;
      setUserId(uid);

      // 1. Fetch shops owned by user
      const { data: myShopsData } = await supabase.from("shops").select("id").eq("owner_id", uid);
      const myShopIds = (myShopsData || []).map(s => s.id);

      // 2. Fetch all conversations matching either buyer_id or shop_id
      let query = supabase.from("shop_conversations").select("*");
      if (myShopIds.length > 0) {
        query = query.or(`buyer_id.eq.${uid},shop_id.in.(${myShopIds.join(',')})`);
      } else {
        query = query.eq("buyer_id", uid);
      }

      const { data: rawConvs, error } = await query;

      if (error || !rawConvs) {
        setLoading(false);
        return;
      }

      // 3. Resolve display names natively without making N+1 queries
      const allShopIds = [...new Set(rawConvs.map(c => c.shop_id))];
      const allBuyerIds = [...new Set(rawConvs.filter(c => c.buyer_id !== uid).map(c => c.buyer_id))];

      const [shopsData, buyersData] = await Promise.all([
        allShopIds.length ? supabase.from("shops").select("id, name, image_url").in("id", allShopIds) : Promise.resolve({ data: [] }),
        allBuyerIds.length ? supabase.from("addresses").select("user_id, name").in("user_id", allBuyerIds).eq("is_default", true) : Promise.resolve({ data: [] })
      ]);

      const shopMap = new Map((shopsData.data || []).map(s => [s.id, s]));
      const buyerMap = new Map((buyersData.data || []).map(b => [b.user_id, b.name]));

      // 4. Map them together
      const mapped: ChatConversation[] = rawConvs.flatMap(c => {
        const results: ChatConversation[] = [];
        const isBuyer = c.buyer_id === uid;
        const isOwner = myShopIds.includes(c.shop_id);
        const sData = shopMap.get(c.shop_id);

        if (isBuyer) {
          results.push({
            id: c.id,
            shop_id: c.shop_id,
            buyer_id: c.buyer_id,
            last_message: c.last_message || "",
            last_time: c.last_time || c.created_at,
            unread_count: c.unread_buyer || 0,
            display_name: sData?.name || "Toko",
            display_image: sData?.image_url || null,
            display_role: "buyer" // I am the buyer interacting with the shop
          });
        }

        if (isOwner && c.buyer_id !== uid) {
          results.push({
            id: c.id,
            shop_id: c.shop_id,
            buyer_id: c.buyer_id,
            last_message: c.last_message || "",
            last_time: c.last_time || c.created_at,
            unread_count: c.unread_shop || 0,
            display_name: buyerMap.get(c.buyer_id) || "Pembeli",
            display_image: null,
            display_role: "shop" // I am the shop interacting with the buyer
          });
        }

        return results;
      });

      mapped.sort((a, b) => new Date(b.last_time).getTime() - new Date(a.last_time).getTime());
      setConversations(mapped);
      setLoading(false);

      // 5. Subscription
      const channel = supabase
        .channel("shop-conv-list")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "shop_conversations" },
          (payload) => {
             // For simplicity, just refetch on any change that affects us.
             init();
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    };

    init();
  }, []);

  const formatMessagePreview = (message: string) => {
    if (!message) return "Memulai percakapan...";
    try {
      if (message.startsWith('{"type":"product_reference"')) {
        const parsed = JSON.parse(message);
        return `📦 ${parsed.product?.name || "Produk"}`;
      }
    } catch { }
    return message;
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    if (diffDays === 1) return "Kemarin";
    if (diffDays < 7) return date.toLocaleDateString("id-ID", { weekday: "short" });
    return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
  };

  if (!loading && !userId) {
    return (
      <div className="min-h-screen bg-slate-50 max-w-md mx-auto font-sans flex flex-col">
        <header className="h-14 bg-white flex items-center px-4 border-b border-slate-100 shrink-0">
          <button onClick={() => router.back()} className="p-1 -ml-1 text-slate-700 active:scale-95 transition-transform">
            <ArrowLeft size={24} strokeWidth={2.5} />
          </button>
          <h1 className="ml-3 text-lg font-bold tracking-tight">Chat & Pesan</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
            <MessageCircle size={28} className="text-indigo-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">Login diperlukan</h2>
          <p className="text-sm text-slate-500 mb-6">Silakan login untuk melihat daftar kotak masuk Anda.</p>
          <button
            onClick={() => router.push("/login")}
            className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm active:scale-95 transition-all shadow-md shadow-indigo-200"
          >
            Login Sekarang
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto font-sans pb-20">
      <header className="fixed max-w-md mx-auto top-0 left-0 right-0 z-50 flex justify-center bg-white">
        <div className="w-full max-w-md h-14 flex items-center px-4 border-b border-slate-100">
          <button onClick={() => router.back()} className="p-1 -ml-1 text-slate-700 active:scale-95 transition-transform">
            <ArrowLeft size={24} strokeWidth={2.5} />
          </button>
          <h1 className="ml-3 text-lg font-bold tracking-tight">Kotak Masuk</h1>
          <span className="ml-auto text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 px-2 py-1 rounded-full">
            {conversations.length} Chat
          </span>
        </div>
      </header>

      <main className="pt-14">
        {loading ? (
          <div className="flex justify-center pt-20">
            <Loader2 size={28} className="animate-spin text-indigo-600" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-20 text-center px-8">
            <div className="w-20 h-20 bg-indigo-50 rounded-3xl flex items-center justify-center mb-5">
              <MessageCircle className="w-10 h-10 text-indigo-400" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">Belum ada percakapan</h2>
            <p className="text-sm text-slate-500 max-w-[260px]">
              Chat dari toko maupun pertanyaan dari pembeli toko Anda akan muncul di sini.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {conversations.map(conv => (
              <Link
                key={`${conv.id}-${conv.display_role}`}
                href={`/chat/shop/${conv.id}`}
                className="flex items-center gap-3 px-4 py-4 bg-white hover:bg-slate-50 active:bg-slate-100 transition-colors"
              >
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-200">
                    {conv.display_image ? (
                      <img src={conv.display_image} alt={conv.display_name} className="w-full h-full object-cover" />
                    ) : (
                      conv.display_role === "buyer" ? <Store size={20} className="text-slate-400" /> : <User size={20} className="text-slate-400" />
                    )}
                  </div>
                  {conv.unread_count > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white">
                      {conv.unread_count > 99 ? "99+" : conv.unread_count}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <h3 className="text-sm font-bold text-slate-800 truncate flex items-center gap-1.5">
                      {conv.display_name}
                      {conv.display_role === "shop" && (
                        <span className="text-[8px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded uppercase tracking-wider font-extrabold">
                          Pembeli
                        </span>
                      )}
                    </h3>
                    <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap ml-3">
                      {formatTime(conv.last_time)}
                    </span>
                  </div>
                  <p className={`text-xs truncate ${conv.unread_count > 0 ? "font-bold text-slate-700" : "text-slate-400"}`}>
                    {formatMessagePreview(conv.last_message)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
