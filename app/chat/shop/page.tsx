"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Store, MessageCircle, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ChatConversation {
  shop_id: string;
  shop_name: string;
  shop_image: string | null;
  last_message: string;
  last_time: string;
  unread_count: number;
}

export default function ShopChatList() {
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

      // Fetch all shop_chats for this buyer
      const { data: chats, error } = await supabase
        .from("shop_chats")
        .select("*")
        .eq("buyer_id", uid)
        .order("created_at", { ascending: false });

      if (error) {
        console.error(error);
        setLoading(false);
        return;
      }

      // Group by shop_id
      const shopMap = new Map<string, { shop_id: string; last_message: string; last_time: string; unread_count: number }>();
      (chats || []).forEach((chat: any) => {
        if (!shopMap.has(chat.shop_id)) {
          shopMap.set(chat.shop_id, {
            shop_id: chat.shop_id,
            last_message: chat.message,
            last_time: chat.created_at,
            unread_count: 0,
          });
        }
        if (chat.sender_id !== uid && !chat.is_read) {
          shopMap.get(chat.shop_id)!.unread_count += 1;
        }
      });

      // Fetch shop info
      const shopIds = Array.from(shopMap.keys());
      if (shopIds.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const { data: shops } = await supabase
        .from("shops")
        .select("id, name, image_url")
        .in("id", shopIds);

      const shopInfoMap = new Map<string, { name: string; image_url: string | null }>();
      (shops || []).forEach((s: any) => shopInfoMap.set(s.id, { name: s.name, image_url: s.image_url }));

      const convs: ChatConversation[] = Array.from(shopMap.values()).map(c => ({
        ...c,
        shop_name: shopInfoMap.get(c.shop_id)?.name || "Toko",
        shop_image: shopInfoMap.get(c.shop_id)?.image_url || null,
      }));

      convs.sort((a, b) => new Date(b.last_time).getTime() - new Date(a.last_time).getTime());
      setConversations(convs);
      setLoading(false);

      // Subscribe to new messages
      const channel = supabase
        .channel("shop-chat-list")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "shop_chats" },
          (payload) => {
            const msg = payload.new as any;
            if (msg.buyer_id !== uid) return;

            setConversations(prev => {
              const idx = prev.findIndex(c => c.shop_id === msg.shop_id);
              const updated = [...prev];
              if (idx > -1) {
                updated[idx] = {
                  ...updated[idx],
                  last_message: msg.message,
                  last_time: msg.created_at,
                  unread_count: msg.sender_id !== uid ? updated[idx].unread_count + 1 : updated[idx].unread_count,
                };
              } else {
                // New conversation — refetch
                init();
                return prev;
              }
              return updated.sort((a, b) => new Date(b.last_time).getTime() - new Date(a.last_time).getTime());
            });
          }
        )
        .subscribe();

      return () => { supabase.removeChannel(channel); };
    };

    init();
  }, []);

  const formatTime = (dateStr: string) => {
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
          <h1 className="ml-3 text-lg font-bold tracking-tight">Chat Toko</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
            <MessageCircle size={28} className="text-indigo-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">Login diperlukan</h2>
          <p className="text-sm text-slate-500 mb-6">Silakan login untuk melihat daftar chat toko.</p>
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
      {/* Header */}
      <header className="fixed max-w-md mx-auto top-0 left-0 right-0 z-50 flex justify-center bg-white">
        <div className="w-full max-w-md h-14 flex items-center px-4 border-b border-slate-100">
          <button onClick={() => router.back()} className="p-1 -ml-1 text-slate-700 active:scale-95 transition-transform">
            <ArrowLeft size={24} strokeWidth={2.5} />
          </button>
          <h1 className="ml-3 text-lg font-bold tracking-tight">Chat Toko</h1>
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
              <Store className="w-10 h-10 text-indigo-400" />
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-2">Belum ada percakapan</h2>
            <p className="text-sm text-slate-500 max-w-[260px]">
              Mulai chat dengan toko dari halaman produk untuk menanyakan ketersediaan, harga, dan informasi lainnya.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {conversations.map(conv => (
              <Link
                key={conv.shop_id}
                href={`/chat/shop/${conv.shop_id}`}
                className="flex items-center gap-3 px-4 py-4 bg-white hover:bg-slate-50 active:bg-slate-100 transition-colors"
              >
                {/* Avatar */}
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full bg-slate-100 overflow-hidden flex items-center justify-center border border-slate-200">
                    {conv.shop_image ? (
                      <img src={conv.shop_image} alt={conv.shop_name} className="w-full h-full object-cover" />
                    ) : (
                      <Store size={20} className="text-slate-400" />
                    )}
                  </div>
                  {conv.unread_count > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white">
                      {conv.unread_count > 99 ? "99+" : conv.unread_count}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <h3 className="text-sm font-bold text-slate-800 truncate">{conv.shop_name}</h3>
                    <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap ml-3">
                      {formatTime(conv.last_time)}
                    </span>
                  </div>
                  <p className={`text-xs truncate ${conv.unread_count > 0 ? "font-bold text-slate-700" : "text-slate-400"}`}>
                    {conv.last_message}
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
