"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Send, Loader2, Clock, Store, MessageCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useRouter, useParams } from "next/navigation";

interface ChatMessage {
  id: string;
  shop_id: string;
  buyer_id: string;
  sender_id: string;
  message: string;
  is_read?: boolean;
  created_at: string;
}

interface ShopInfo {
  id: string;
  name: string;
  image_url: string | null;
  slug: string | null;
  owner_id: string | null;
}

const DOM_WINDOW = 60;
const FETCH_SIZE = 30;

export default function ShopChatRoom() {
  const router = useRouter();
  const params = useParams();
  const shopId = params.shopId as string;

  const allMessagesRef = useRef<ChatMessage[]>([]);
  const [visibleMessages, setVisibleMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [hasOlderOnServer, setHasOlderOnServer] = useState(false);
  const [isFetchingOlder, setIsFetchingOlder] = useState(false);
  const [newMessageIds, setNewMessageIds] = useState<Set<string>>(new Set());
  const [isTyping, setIsTyping] = useState(false);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const oldestCursorRef = useRef<string | null>(null);
  const isAtBottomRef = useRef(true);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior }), 80);
  }, []);

  const syncVisible = useCallback((focusNewest = false) => {
    const all = allMessagesRef.current;
    const sliced = all.slice(-DOM_WINDOW);
    setVisibleMessages([...sliced]);
    if (focusNewest) scrollToBottom("auto");
  }, [scrollToBottom]);

  // Load shop info
  useEffect(() => {
    const fetchShop = async () => {
      const { data, error } = await supabase
        .from("shops")
        .select("id, name, image_url, slug, owner_id")
        .eq("id", shopId)
        .single();
      if (data && !error) setShop(data);
    };
    if (shopId) fetchShop();
  }, [shopId]);

  // Load initial messages
  const fetchInitial = useCallback(async (userId: string) => {
    try {
      const { data, error, count } = await supabase
        .from("shop_chats")
        .select("*", { count: "exact" })
        .eq("shop_id", shopId)
        .eq("buyer_id", userId)
        .order("created_at", { ascending: false })
        .limit(FETCH_SIZE);

      if (error) throw error;

      const msgs = (data || []).reverse() as ChatMessage[];
      allMessagesRef.current = msgs;
      oldestCursorRef.current = msgs[0]?.created_at ?? null;
      setHasOlderOnServer((count ?? 0) > FETCH_SIZE);
      syncVisible(true);
    } catch (err) {
      console.error("Error fetching chats:", err);
    } finally {
      setLoading(false);
    }
  }, [shopId, syncVisible]);

  // Load older messages
  const fetchOlder = useCallback(async (userId: string) => {
    if (isFetchingOlder || !hasOlderOnServer || !oldestCursorRef.current) return;
    setIsFetchingOlder(true);

    const scrollArea = scrollAreaRef.current;
    const prevScrollHeight = scrollArea?.scrollHeight ?? 0;

    try {
      const { data, error } = await supabase
        .from("shop_chats")
        .select("*")
        .eq("shop_id", shopId)
        .eq("buyer_id", userId)
        .lt("created_at", oldestCursorRef.current)
        .order("created_at", { ascending: false })
        .limit(FETCH_SIZE);

      if (error) throw error;

      const older = (data || []).reverse() as ChatMessage[];
      if (older.length === 0) { setHasOlderOnServer(false); return; }

      allMessagesRef.current = [...older, ...allMessagesRef.current];
      oldestCursorRef.current = older[0].created_at;
      setHasOlderOnServer(older.length === FETCH_SIZE);

      const all = allMessagesRef.current;
      setVisibleMessages([...all.slice(0, Math.min(DOM_WINDOW, all.length))]);

      requestAnimationFrame(() => {
        if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight - prevScrollHeight;
      });
    } catch {
      toast.error("Gagal memuat pesan lama");
    } finally {
      setIsFetchingOlder(false);
    }
  }, [shopId, isFetchingOlder, hasOlderOnServer]);

  // Setup IntersectionObserver
  const userIdRef = useRef<string | null>(null);
  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && userIdRef.current) fetchOlder(userIdRef.current);
      },
      { root: scrollAreaRef.current, rootMargin: "120px 0px 0px 0px", threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchOlder]);

  // Track scroll
  const handleScroll = useCallback(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distanceFromBottom < 100;

    if (isAtBottomRef.current && allMessagesRef.current.length > DOM_WINDOW) {
      setVisibleMessages([...allMessagesRef.current.slice(-DOM_WINDOW)]);
    }
  }, []);

  // Realtime setup
  const setupRealtime = useCallback((userId: string) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const channel = supabase
      .channel(`shop-chat:${shopId}:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "shop_chats", filter: `shop_id=eq.${shopId}` },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          // Only process if this conversation involves us
          if (newMsg.buyer_id !== userId) return;

          const all = allMessagesRef.current;
          const tempIdx = all.findIndex(
            m => m.id.startsWith("temp-") && m.message === newMsg.message && m.sender_id === newMsg.sender_id
          );

          if (tempIdx > -1) {
            allMessagesRef.current = [...all.slice(0, tempIdx), newMsg, ...all.slice(tempIdx + 1)];
          } else if (!all.some(m => m.id === newMsg.id)) {
            allMessagesRef.current = [...all, newMsg];
            setNewMessageIds(ids => new Set([...ids, newMsg.id]));
          }

          syncVisible(isAtBottomRef.current);
        }
      )
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.sender_type === "owner") {
          setIsTyping(payload.is_typing);
          if (payload.is_typing) setTimeout(() => setIsTyping(false), 3000);
        }
      })
      .subscribe();

    channelRef.current = channel;
  }, [shopId, syncVisible]);

  const markAsRead = useCallback(async (userId: string) => {
    try {
      await supabase
        .from("shop_chats")
        .update({ is_read: true })
        .eq("shop_id", shopId)
        .eq("buyer_id", userId)
        .neq("sender_id", userId)
        .eq("is_read", false);
    } catch (err) {
      console.error("Error marking read", err);
    }
  }, [shopId]);

  // Auth init
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const u = { id: session.user.id };
        setUser(u);
        userIdRef.current = u.id;
        fetchInitial(u.id);
        setupRealtime(u.id);
        markAsRead(u.id);
      } else {
        setLoading(false);
      }
    };
    init();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [fetchInitial, setupRealtime, markAsRead]);

  // Auto-scroll
  useEffect(() => {
    if (visibleMessages.length === 0) return;
    if (isAtBottomRef.current) scrollToBottom("smooth");
  }, [visibleMessages, isTyping, scrollToBottom]);

  // Keyboard
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const handleResize = () => {
      if (document.activeElement?.tagName === "INPUT") {
        document.activeElement.scrollIntoView({ behavior: "smooth", block: "end" });
      }
      if (isAtBottomRef.current) setTimeout(() => scrollToBottom("smooth"), 100);
    };
    window.visualViewport.addEventListener("resize", handleResize);
    return () => window.visualViewport?.removeEventListener("resize", handleResize);
  }, [scrollToBottom]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || sending) return;

    const msg = newMessage.trim();
    setNewMessage("");
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const tempMsg: ChatMessage = {
      id: tempId,
      shop_id: shopId,
      buyer_id: user.id,
      sender_id: user.id,
      message: msg,
      created_at: new Date().toISOString(),
    };

    allMessagesRef.current = [...allMessagesRef.current, tempMsg];
    syncVisible(true);

    setTimeout(() => inputRef.current?.focus(), 50);

    try {
      const { error } = await supabase
        .from("shop_chats")
        .insert([{ shop_id: shopId, buyer_id: user.id, sender_id: user.id, message: msg }]);
      if (error) throw error;
    } catch {
      toast.error("Gagal mengirim pesan");
      allMessagesRef.current = allMessagesRef.current.filter(m => m.id !== tempId);
      syncVisible();
    } finally {
      setSending(false);
    }
  };

  const handleTyping = () => {
    if (!channelRef.current || !user) return;
    channelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: user.id, is_typing: true, sender_type: "buyer" },
    });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      channelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: { user_id: user.id, is_typing: false, sender_type: "buyer" },
      });
    }, 2000);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: "smooth", block: "end" });
      if (isAtBottomRef.current) scrollToBottom("smooth");
    }, 300);
  };

  // Not logged in
  if (!loading && !user) {
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
          <p className="text-sm text-slate-500 mb-6">Silakan login terlebih dahulu untuk chat dengan toko.</p>
          <button
            onClick={() => router.push("/login")}
            className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold text-sm hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-200"
          >
            Login Sekarang
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-50">
      <div className="flex flex-col flex-1 max-w-md mx-auto w-full overflow-hidden">
        {/* HEADER */}
        <header className="flex-none bg-white border-b border-slate-100 shadow-sm z-20">
          <div className="h-14 flex items-center px-4">
            <button
              onClick={() => router.back()}
              className="p-1 -ml-1 text-slate-700 active:scale-95 transition-transform touch-manipulation"
            >
              <ArrowLeft size={24} strokeWidth={2.5} />
            </button>
            <div className="ml-3 flex items-center gap-3">
              <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center overflow-hidden shadow-sm border border-slate-200">
                {shop?.image_url ? (
                  <img src={shop.image_url} alt={shop.name} className="w-full h-full object-cover" />
                ) : (
                  <Store size={18} className="text-slate-400" />
                )}
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-800 leading-tight">{shop?.name || "Memuat..."}</h1>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Toko</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* SCROLL AREA */}
        <div
          ref={scrollAreaRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3 bg-slate-50"
        >
          <div ref={topSentinelRef} className="w-full flex justify-center h-6 items-center">
            {isFetchingOlder ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                <Loader2 size={13} className="animate-spin text-indigo-400" />
                Memuat pesan lama...
              </div>
            ) : hasOlderOnServer ? (
              <div className="w-2 h-2 rounded-full bg-slate-200" />
            ) : (
              <span className="text-[10px] text-slate-300 font-medium tracking-wide">Awal percakapan</span>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20 text-slate-400">
              <Loader2 size={28} className="animate-spin" />
            </div>
          ) : visibleMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center space-y-3 opacity-60 py-20">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                <Store size={28} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">Mulai percakapan</p>
                <p className="text-xs text-slate-500 mt-1 max-w-[220px]">
                  Tanyakan soal produk, stok, promo, atau informasi toko.
                </p>
              </div>
            </div>
          ) : (
            visibleMessages.map((msg) => {
              const isMine = msg.sender_id === user?.id;
              const isTemp = msg.id.startsWith("temp-");
              const isNew = newMessageIds.has(msg.id);

              return (
                <div
                  key={msg.id}
                  className={`flex ${isMine ? "justify-end" : "justify-start"} ${isNew ? (isMine ? "msg-slide-right" : "msg-slide-left") : ""}`}
                >
                  <div className={`max-w-[80%] flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                    <div
                      className={`px-4 py-2.5 rounded-2xl ${isMine
                        ? "bg-indigo-600 text-white rounded-tr-sm shadow-md shadow-indigo-100"
                        : "bg-white border border-slate-100 text-slate-700 rounded-tl-sm shadow-sm"
                        } ${isTemp ? "opacity-60" : "opacity-100 transition-opacity duration-300"}`}
                    >
                      <p className="text-[13.5px] whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                    </div>
                    <div className={`flex items-center gap-1 mt-1 px-1 ${isMine ? "" : "flex-row-reverse"}`}>
                      <span className="text-[10px] font-medium text-slate-400">
                        {isTemp ? "Mengirim..." : new Date(msg.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {isTemp && <Clock size={10} className="text-slate-300" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex justify-start msg-slide-left">
              <div className="bg-white border px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm">
                <div className="flex gap-1 items-center">
                  <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* INPUT */}
        <form onSubmit={sendMessage} className="flex-none p-4 bg-white border-t border-slate-200">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                placeholder={`Chat dengan ${shop?.name?.split(' ')[0] || 'toko'}...`}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner"
                value={newMessage}
                onChange={(e) => { setNewMessage(e.target.value); handleTyping(); }}
                onFocus={handleFocus}
                style={{ fontSize: "16px" }}
              />
            </div>
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="h-auto px-5 bg-indigo-600 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 active:scale-95 disabled:bg-slate-300 transition-all shadow-md shadow-indigo-200"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
