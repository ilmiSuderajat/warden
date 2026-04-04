"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  Search, Send, Loader2, User, Store,
  ChevronLeft, CheckCircle2, Clock, MessageCircle
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ChatMessage {
  id: string;
  shop_id: string;
  buyer_id: string;
  sender_id: string;
  message: string;
  is_read?: boolean;
  created_at: string;
}

interface ChatBuyer {
  buyer_id: string;
  name: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
}

const DOM_WINDOW = 60;
const FETCH_SIZE = 30;

export default function ShopOwnerChatPage() {
  const router = useRouter();

  const [shopId, setShopId] = useState<string | null>(null);
  const [shopName, setShopName] = useState("");
  const [buyers, setBuyers] = useState<ChatBuyer[]>([]);
  const [selectedBuyer, setSelectedBuyer] = useState<ChatBuyer | null>(null);
  const [loadingBuyers, setLoadingBuyers] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const allMessagesRef = useRef<ChatMessage[]>([]);
  const [visibleMessages, setVisibleMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const [hasOlderOnServer, setHasOlderOnServer] = useState(false);
  const [isFetchingOlder, setIsFetchingOlder] = useState(false);
  const [newMessageIds, setNewMessageIds] = useState<Set<string>>(new Set());
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedBuyerRef = useRef(selectedBuyer);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const oldestCursorRef = useRef<string | null>(null);
  const isAtBottomRef = useRef(true);
  const ownerIdRef = useRef<string | null>(null);

  useEffect(() => { selectedBuyerRef.current = selectedBuyer; }, [selectedBuyer]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior }), 80);
  }, []);

  const syncVisible = useCallback((focusNewest = false) => {
    const sliced = allMessagesRef.current.slice(-DOM_WINDOW);
    setVisibleMessages([...sliced]);
    if (focusNewest) scrollToBottom("auto");
  }, [scrollToBottom]);

  // Init: find shop owned by current user
  const fetchBuyers = useCallback(async (currentShopId: string, showLoading = true) => {
    if (showLoading) setLoadingBuyers(true);
    try {
      const { data: chatsData, error } = await supabase
        .from("shop_chats")
        .select("*")
        .eq("shop_id", currentShopId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const buyerMap = new Map<string, { buyer_id: string; last_message: string; last_message_time: string; unread_count: number }>();
      (chatsData || []).forEach((chat: ChatMessage) => {
        if (!buyerMap.has(chat.buyer_id)) {
          buyerMap.set(chat.buyer_id, {
            buyer_id: chat.buyer_id,
            last_message: chat.message,
            last_message_time: chat.created_at,
            unread_count: 0,
          });
        }
        // Unread = sent by buyer (not owner) and not read
        if (chat.sender_id === chat.buyer_id && !chat.is_read) {
          buyerMap.get(chat.buyer_id)!.unread_count += 1;
        }
      });

      const buyerIds = Array.from(buyerMap.keys());
      if (buyerIds.length > 0) {
        const { data: addrData } = await supabase
          .from("addresses")
          .select("user_id, name")
          .in("user_id", buyerIds)
          .eq("is_default", true);

        const nameMap = new Map<string, string>();
        addrData?.forEach((a: { user_id: string; name: string }) => nameMap.set(a.user_id, a.name));

        const finalBuyers: ChatBuyer[] = Array.from(buyerMap.values()).map(u => ({
          ...u,
          name: nameMap.get(u.buyer_id) || `User ${u.buyer_id.slice(0, 6)}`,
        }));

        setBuyers(finalBuyers.sort((a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()));
      } else {
        setBuyers([]);
      }
    } catch (err) {
      console.error("Error fetching buyers:", err);
      toast.error("Gagal memuat daftar chat");
    } finally {
      if (showLoading) setLoadingBuyers(false);
    }
  }, []);

  const markAsRead = useCallback(async (buyerId: string, currentShopId: string) => {
    await supabase
      .from("shop_chats")
      .update({ is_read: true })
      .eq("shop_id", currentShopId)
      .eq("buyer_id", buyerId)
      .eq("sender_id", buyerId) // Read messages sent by buyer
      .eq("is_read", false);
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setLoadingBuyers(false); return; }

      ownerIdRef.current = session.user.id;

      // Find shop owned by this user
      const { data: shopData } = await supabase
        .from("shops")
        .select("id, name")
        .eq("owner_id", session.user.id)
        .single();

      if (!shopData) {
        setLoadingBuyers(false);
        return;
      }

      setShopId(shopData.id);
      setShopName(shopData.name);
      fetchBuyers(shopData.id);

      // Subscribe to new messages for this shop
      const channel = supabase
        .channel(`shop-owner-chat:${shopData.id}`)
        .on("postgres_changes", {
          event: "INSERT", schema: "public", table: "shop_chats",
          filter: `shop_id=eq.${shopData.id}`
        }, payload => {
          const msg = payload.new as ChatMessage;

          // Update buyer list
          setBuyers(prev => {
            const idx = prev.findIndex(u => u.buyer_id === msg.buyer_id);
            if (idx === -1) { fetchBuyers(shopData.id, false); return prev; }
            const next = [...prev];
            next[idx] = {
              ...next[idx],
              last_message: msg.message,
              last_message_time: msg.created_at,
              unread_count:
                msg.sender_id === msg.buyer_id &&
                  (!selectedBuyerRef.current || selectedBuyerRef.current.buyer_id !== msg.buyer_id)
                  ? (next[idx].unread_count || 0) + 1
                  : next[idx].unread_count,
            };
            return next.sort((a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime());
          });

          // Update current chat if selected
          const current = selectedBuyerRef.current;
          if (current && msg.buyer_id === current.buyer_id) {
            const all = allMessagesRef.current;
            const tempIdx = all.findIndex(
              m => m.id.startsWith("temp-") && m.message === msg.message && m.sender_id === msg.sender_id
            );
            if (tempIdx > -1) {
              allMessagesRef.current = [...all.slice(0, tempIdx), msg, ...all.slice(tempIdx + 1)];
            } else if (!all.some(m => m.id === msg.id)) {
              allMessagesRef.current = [...all, msg];
              setNewMessageIds(ids => new Set([...ids, msg.id]));
            }
            syncVisible(isAtBottomRef.current);
            if (msg.sender_id === msg.buyer_id) markAsRead(msg.buyer_id, shopData.id);
          }
        })
        .on("broadcast", { event: "typing" }, payload => {
          if (payload.sender_type === "buyer") {
            const current = selectedBuyerRef.current;
            if (current && payload.user_id === current.buyer_id) {
              setIsTyping(payload.is_typing);
              if (payload.is_typing) setTimeout(() => setIsTyping(false), 3000);
            }
          }
        })
        .subscribe();

      channelRef.current = channel;
      return () => { supabase.removeChannel(channel); };
    };
    init();
  }, [fetchBuyers, markAsRead, syncVisible]);

  const loadChat = async (buyer: ChatBuyer) => {
    if (!shopId) return;
    setSelectedBuyer(buyer);
    setLoadingChat(true);
    allMessagesRef.current = [];
    setVisibleMessages([]);
    setNewMessageIds(new Set());
    oldestCursorRef.current = null;
    isAtBottomRef.current = true;

    setBuyers(prev => prev.map(u => (u.buyer_id === buyer.buyer_id ? { ...u, unread_count: 0 } : u)));
    markAsRead(buyer.buyer_id, shopId);

    try {
      const { data, error, count } = await supabase
        .from("shop_chats")
        .select("*", { count: "exact" })
        .eq("shop_id", shopId)
        .eq("buyer_id", buyer.buyer_id)
        .order("created_at", { ascending: false })
        .limit(FETCH_SIZE);

      if (error) throw error;
      const msgs = (data || []).reverse() as ChatMessage[];
      allMessagesRef.current = msgs;
      oldestCursorRef.current = msgs[0]?.created_at ?? null;
      setHasOlderOnServer((count ?? 0) > FETCH_SIZE);
      syncVisible(true);
    } catch {
      toast.error("Gagal memuat isi chat");
    } finally {
      setLoadingChat(false);
    }
  };

  const fetchOlder = useCallback(async () => {
    if (isFetchingOlder || !hasOlderOnServer || !selectedBuyerRef.current || !oldestCursorRef.current || !shopId) return;
    setIsFetchingOlder(true);
    const scrollArea = scrollAreaRef.current;
    const prevScrollHeight = scrollArea?.scrollHeight ?? 0;

    try {
      const { data, error } = await supabase
        .from("shop_chats")
        .select("*")
        .eq("shop_id", shopId)
        .eq("buyer_id", selectedBuyerRef.current.buyer_id)
        .lt("created_at", oldestCursorRef.current)
        .order("created_at", { ascending: false })
        .limit(FETCH_SIZE);

      if (error) throw error;
      const older = (data || []).reverse() as ChatMessage[];
      if (older.length === 0) { setHasOlderOnServer(false); return; }

      allMessagesRef.current = [...older, ...allMessagesRef.current];
      oldestCursorRef.current = older[0].created_at;
      setHasOlderOnServer(older.length === FETCH_SIZE);

      setVisibleMessages([...allMessagesRef.current.slice(0, Math.min(DOM_WINDOW, allMessagesRef.current.length))]);

      requestAnimationFrame(() => {
        if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight - prevScrollHeight;
      });
    } catch {
      toast.error("Gagal memuat pesan lama");
    } finally {
      setIsFetchingOlder(false);
    }
  }, [shopId, isFetchingOlder, hasOlderOnServer]);

  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting) fetchOlder(); },
      { root: scrollAreaRef.current, rootMargin: "120px 0px 0px 0px", threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchOlder]);

  const handleScroll = useCallback(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (isAtBottomRef.current && allMessagesRef.current.length > DOM_WINDOW) {
      setVisibleMessages([...allMessagesRef.current.slice(-DOM_WINDOW)]);
    }
  }, []);

  useEffect(() => {
    if (visibleMessages.length === 0) return;
    if (isAtBottomRef.current) scrollToBottom("smooth");
  }, [visibleMessages, isTyping, scrollToBottom]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedBuyer || !shopId || !ownerIdRef.current) return;

    const msg = newMessage.trim();
    setNewMessage("");

    const tempId = `temp-${Date.now()}`;
    const tempMsg: ChatMessage = {
      id: tempId,
      shop_id: shopId,
      buyer_id: selectedBuyer.buyer_id,
      sender_id: ownerIdRef.current,
      message: msg,
      created_at: new Date().toISOString(),
    };

    allMessagesRef.current = [...allMessagesRef.current, tempMsg];
    syncVisible(true);
    setTimeout(() => inputRef.current?.focus(), 50);

    try {
      const { error } = await supabase
        .from("shop_chats")
        .insert([{
          shop_id: shopId,
          buyer_id: selectedBuyer.buyer_id,
          sender_id: ownerIdRef.current,
          message: msg,
          is_read: false
        }]);
      if (error) throw error;
    } catch {
      toast.error("Gagal membalas pesan");
      allMessagesRef.current = allMessagesRef.current.filter(m => m.id !== tempId);
      syncVisible();
    }
  };

  const handleTyping = () => {
    if (!channelRef.current || !selectedBuyer) return;
    channelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: selectedBuyer.buyer_id, is_typing: true, sender_type: "owner" },
    });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      channelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: { user_id: selectedBuyer.buyer_id, is_typing: false, sender_type: "owner" },
      });
    }, 2000);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: "smooth", block: "end" });
      if (isAtBottomRef.current) scrollToBottom("smooth");
    }, 300);
  };

  const filteredBuyers = buyers.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-[#fdfdff] font-sans text-slate-900 border-x border-slate-100 overflow-hidden">
      <div className="flex flex-col h-full max-w-5xl mx-auto w-full relative">
        {/* HEADER */}
        <div className="flex-none h-16 bg-white border-b border-slate-100 flex items-center justify-between px-5 z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 -ml-2 text-slate-400 hover:text-slate-900 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all active:scale-95">
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
                <Store size={18} strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-900 leading-none">{shopName || "Chat Toko"}</h1>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chat Pembeli</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-bold uppercase tracking-tighter border border-emerald-100 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Online
            </div>
          </div>
        </div>

        {/* BODY */}
        <div className="flex flex-1 overflow-hidden">
          {/* SIDEBAR */}
          <div className={`w-full md:w-72 bg-white border-r border-slate-100 flex flex-col shrink-0 transition-transform ${selectedBuyer ? "hidden md:flex" : "flex"}`}>
            <div className="p-3 shrink-0">
              <div className="relative group">
                <Search size={14} strokeWidth={3} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  type="text"
                  placeholder="Cari pembeli..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-50 transition-all text-xs font-medium"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingBuyers ? (
                [1, 2, 3].map(i => <div key={i} className="h-16 bg-slate-50 animate-pulse mx-3 mb-1.5 rounded-xl" />)
              ) : filteredBuyers.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-10 text-center">
                  <div className="p-3 bg-slate-50 rounded-full text-slate-200 mb-3"><MessageCircle size={24} /></div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Belum Ada Chat</p>
                </div>
              ) : (
                filteredBuyers.map(u => (
                  <button
                    key={u.buyer_id}
                    onClick={() => loadChat(u)}
                    className={`w-full px-3 py-3 flex gap-3 text-left transition-all rounded-xl mx-1.5 mb-0.5 ${selectedBuyer?.buyer_id === u.buyer_id
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-100"
                      : "hover:bg-slate-50"
                      }`}
                    style={{ width: "calc(100% - 12px)" }}
                  >
                    <div className="relative shrink-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border font-bold text-sm ${selectedBuyer?.buyer_id === u.buyer_id
                        ? "bg-indigo-500 border-indigo-400 text-white"
                        : "bg-slate-50 border-slate-100 text-slate-400"
                        }`}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      {u.unread_count > 0 && (
                        <span className={`absolute -top-1 -right-1 text-white text-[8px] font-bold w-4 h-4 flex items-center justify-center rounded-md ${selectedBuyer?.buyer_id === u.buyer_id ? "bg-rose-500" : "bg-indigo-600"}`}>
                          {u.unread_count > 9 ? "9+" : u.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <h3 className={`text-xs font-bold truncate ${selectedBuyer?.buyer_id === u.buyer_id ? "text-white" : "text-slate-700"}`}>{u.name}</h3>
                        <span className={`text-[8px] font-bold ml-2 whitespace-nowrap ${selectedBuyer?.buyer_id === u.buyer_id ? "text-white/60" : "text-slate-300"}`}>
                          {new Date(u.last_message_time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className={`text-[10px] truncate ${selectedBuyer?.buyer_id === u.buyer_id ? "text-white/80" : "text-slate-400"}`}>
                        {u.last_message}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* CHAT PANEL */}
          <div className={`flex-1 flex flex-col min-w-0 ${!selectedBuyer ? "hidden md:flex items-center justify-center bg-slate-50/30" : "flex bg-white"}`}>
            {!selectedBuyer ? (
              <div className="text-center opacity-20 flex flex-col items-center">
                <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-400 mb-4"><Store size={40} /></div>
                <h4 className="font-bold text-lg">Chat Pembeli</h4>
                <p className="text-sm font-medium mt-1">Pilih percakapan untuk memulai</p>
              </div>
            ) : (
              <>
                {/* Chat Header */}
                <div className="flex-none h-14 bg-white border-b border-slate-100 flex items-center justify-between px-4 z-20">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedBuyer(null)}
                      className="p-1.5 -ml-1 md:hidden text-slate-400 hover:text-slate-900 bg-slate-50 rounded-lg"
                    >
                      <ChevronLeft size={18} strokeWidth={3} />
                    </button>
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200">
                        <User size={18} className="text-slate-400" strokeWidth={2.5} />
                      </div>
                      <div>
                        <h2 className="text-sm font-bold text-slate-800 truncate">{selectedBuyer.name}</h2>
                        <span className="text-[10px] text-emerald-600 font-bold uppercase">Pembeli</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Messages */}
                <div ref={scrollAreaRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                  <div ref={topSentinelRef} className="flex justify-center h-6 items-center">
                    {isFetchingOlder ? (
                      <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400">
                        <Loader2 size={12} className="animate-spin text-indigo-500" />
                        Memuat pesan lama...
                      </div>
                    ) : hasOlderOnServer ? (
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                    ) : (
                      <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Chat dimulai</span>
                    )}
                  </div>

                  {loadingChat ? (
                    <div className="flex justify-center py-20">
                      <Loader2 size={24} className="animate-spin text-indigo-500" />
                    </div>
                  ) : (
                    visibleMessages.map((msg, i) => {
                      const isOwner = msg.sender_id !== msg.buyer_id;
                      const isTemp = msg.id.startsWith("temp-");
                      const showDate = i === 0 || new Date(msg.created_at).getDate() !== new Date(visibleMessages[i - 1].created_at).getDate();

                      return (
                        <div key={msg.id} className="space-y-3">
                          {showDate && (
                            <div className="flex justify-center my-3">
                              <span className="px-3 py-1 bg-slate-100 rounded-lg text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                                {new Date(msg.created_at).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short" })}
                              </span>
                            </div>
                          )}
                          <div className={`flex ${isOwner ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[80%] flex flex-col ${isOwner ? "items-end" : "items-start"}`}>
                              <div className={`px-4 py-2.5 rounded-2xl shadow-sm ${isOwner
                                ? "bg-indigo-600 text-white rounded-tr-sm"
                                : "bg-white text-slate-700 border border-slate-100 rounded-tl-sm"
                                } ${isTemp ? "opacity-50" : ""}`}>
                                <p className="text-[13px] whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                              </div>
                              <div className={`flex items-center gap-1.5 mt-1 px-1 ${isOwner ? "flex-row-reverse" : ""}`}>
                                <span className="text-[9px] font-bold text-slate-300">
                                  {isTemp ? "Mengirim..." : new Date(msg.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                                {isOwner && !isTemp && (
                                  msg.is_read
                                    ? <CheckCircle2 size={11} className="text-emerald-500" strokeWidth={2.5} />
                                    : <CheckCircle2 size={11} className="text-slate-200" strokeWidth={2.5} />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-white border px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm">
                        <div className="flex gap-1">
                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                          <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={sendMessage} className="flex-none p-3 bg-white border-t border-slate-100">
                  <div className="flex gap-2.5 items-center">
                    <div className="relative flex-1">
                      <input
                        ref={inputRef}
                        type="text"
                        value={newMessage}
                        onChange={e => { setNewMessage(e.target.value); handleTyping(); }}
                        onFocus={handleFocus}
                        style={{ fontSize: "16px" }}
                        placeholder={`Balas ${selectedBuyer.name.split(" ")[0]}...`}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-50 transition-all"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="w-11 h-11 bg-indigo-600 text-white rounded-xl flex items-center justify-center hover:bg-indigo-700 active:scale-90 transition-all disabled:bg-slate-200"
                    >
                      <Send size={18} strokeWidth={2.5} />
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
