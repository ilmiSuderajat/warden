"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Send, Loader2, Clock, Store, MessageCircle, X, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useRouter, useParams, useSearchParams } from "next/navigation";

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  is_read?: boolean;
  created_at: string;
}

interface ConversationContext {
  id: string;
  shop_id: string;
  buyer_id: string;
  target_name: string;
  target_image: string | null;
  role: "buyer" | "shop";
}

const DOM_WINDOW = 60;
const FETCH_SIZE = 30;

export default function UnifiedChatRoom() {
  const router = useRouter();
  const params = useParams();
  const conversationId = params.conversationId as string;

  const [isMounted, setIsMounted] = useState(false);
  const allMessagesRef = useRef<ChatMessage[]>([]);
  const [visibleMessages, setVisibleMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [user, setUser] = useState<{ id: string } | null>(null);
  
  const [convContext, setConvContext] = useState<ConversationContext | null>(null);
  
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

  // Auto product attachment (Buyer Only usually)
  const searchParams = useSearchParams();
  const productId = searchParams.get("product_id");
  const [productContext, setProductContext] = useState<{ id: string; name: string; image_url: string; price: number } | null>(null);

  useEffect(() => { setIsMounted(true); }, []);

  // Product context logic
  useEffect(() => {
    if (!productId) return;
    const fetchProductContext = async () => {
      try {
        const { data, error } = await supabase.from("products").select("id, name, image_url, price").eq("id", productId).single();
        if (data && !error) {
          const img = Array.isArray(data.image_url) ? data.image_url[0] : data.image_url;
          setProductContext({ id: data.id, name: data.name, image_url: img, price: data.price });
        }
      } catch (err) { }
    };
    fetchProductContext();
  }, [productId]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior }), 80);
  }, []);

  const syncVisible = useCallback((focusNewest = false) => {
    const all = allMessagesRef.current;
    const sliced = all.slice(-DOM_WINDOW);
    setVisibleMessages([...sliced]);
    if (focusNewest) scrollToBottom("auto");
  }, [scrollToBottom]);

  // Load conversation context
  const loadConversation = useCallback(async (uid: string) => {
    try {
      const { data: conv, error } = await supabase.from("shop_conversations").select("*").eq("id", conversationId).single();
      if (error || !conv) throw new Error("Conversation not found");

      // Verify Role
      let role: "buyer" | "shop" | null = null;
      if (conv.buyer_id === uid) role = "buyer";
      
      const { data: shopData } = await supabase.from("shops").select("owner_id, name, image_url").eq("id", conv.shop_id).single();
      if (shopData?.owner_id === uid) role = "shop";

      if (!role) throw new Error("Unauthorized");

      // Resolve Display Target
      let targetName = "";
      let targetImage: string | null = null;

      if (role === "buyer") {
        targetName = shopData?.name || "Toko";
        targetImage = shopData?.image_url || null;
      } else {
        const { data: buyerData } = await supabase.from("addresses").select("name").eq("user_id", conv.buyer_id).eq("is_default", true).maybeSingle();
        targetName = buyerData?.name || "Pembeli";
      }

      setConvContext({
        id: conv.id,
        shop_id: conv.shop_id,
        buyer_id: conv.buyer_id,
        role,
        target_name: targetName,
        target_image: targetImage
      });

      return { role, conv };

    } catch (err) {
      toast.error("Gagal memuat detail obrolan");
      router.replace("/chat/shop");
      throw err;
    }
  }, [conversationId, router]);

  // Load initial messages
  const fetchInitial = useCallback(async (uid: string) => {
    try {
      // 1. Context
      const { role } = await loadConversation(uid);

      // 2. Messages
      const { data, count } = await supabase
        .from("shop_messages")
        .select("*", { count: "exact" })
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(FETCH_SIZE);

      const msgs = (data || []).reverse() as ChatMessage[];
      allMessagesRef.current = msgs;
      oldestCursorRef.current = msgs[0]?.created_at ?? null;
      setHasOlderOnServer((count ?? 0) > FETCH_SIZE);
      syncVisible(true);

      // 3. Mark Read
      await supabase.from("shop_messages")
        .update({ is_read: true })
        .eq("conversation_id", conversationId)
        .neq("sender_id", uid)
        .eq("is_read", false);
        
      // Reset unread counts in conversation
      await supabase.from("shop_conversations")
        .update(role === "buyer" ? { unread_buyer: 0 } : { unread_shop: 0 })
        .eq("id", conversationId);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [conversationId, syncVisible, loadConversation]);

  // Realtime setup
  const setupRealtime = useCallback((uid: string) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const channel = supabase
      .channel(`chat-room:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "shop_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          const all = allMessagesRef.current;
          
          const tempIdx = all.findIndex(m => m.id.startsWith("temp-") && m.message === newMsg.message && m.sender_id === newMsg.sender_id);
          if (tempIdx > -1) {
            allMessagesRef.current = [...all.slice(0, tempIdx), newMsg, ...all.slice(tempIdx + 1)];
          } else if (!all.some(m => m.id === newMsg.id)) {
            allMessagesRef.current = [...all, newMsg];
            setNewMessageIds(ids => new Set([...ids, newMsg.id]));
          }
          syncVisible(isAtBottomRef.current);
          
          // Auto Mark read if sent by other
          if (newMsg.sender_id !== uid && isAtBottomRef.current) {
            supabase.from("shop_messages").update({ is_read: true }).eq("id", newMsg.id);
            if (convContext) {
               supabase.from("shop_conversations")
                 .update(convContext.role === "buyer" ? { unread_buyer: 0 } : { unread_shop: 0 })
                 .eq("id", conversationId);
            }
          }
        }
      )
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.user_id !== uid) {
          setIsTyping(payload.is_typing);
          if (payload.is_typing) setTimeout(() => setIsTyping(false), 3000);
        }
      })
      .subscribe();

    channelRef.current = channel;
  }, [conversationId, syncVisible, convContext]);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser({ id: session.user.id });
        await fetchInitial(session.user.id);
        setupRealtime(session.user.id);
      } else {
        setLoading(false);
      }
    };
    init();
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [conversationId, fetchInitial, setupRealtime]);

  const loadOlder = async () => {
    // Simplified logic for fetching older
    if (!hasOlderOnServer || isFetchingOlder || !oldestCursorRef.current) return;
    setIsFetchingOlder(true);
    const scrollArea = scrollAreaRef.current;
    const prevScrollHeight = scrollArea?.scrollHeight ?? 0;

    const { data } = await supabase.from("shop_messages").select("*").eq("conversation_id", conversationId)
      .lt("created_at", oldestCursorRef.current).order("created_at", { ascending: false }).limit(FETCH_SIZE);
      
    if (data?.length) {
       const older = data.reverse() as ChatMessage[];
       allMessagesRef.current = [...older, ...allMessagesRef.current];
       oldestCursorRef.current = older[0].created_at;
       setHasOlderOnServer(older.length === FETCH_SIZE);
       syncVisible();
       requestAnimationFrame(() => { if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight - prevScrollHeight; });
    } else {
       setHasOlderOnServer(false);
    }
    setIsFetchingOlder(false);
  };

  useEffect(() => {
    const sel = topSentinelRef.current;
    if (!sel) return;
    const observer = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) loadOlder(); });
    observer.observe(sel);
    return () => observer.disconnect();
  }, [hasOlderOnServer, isFetchingOlder]);

  const handleScroll = useCallback(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distanceFromBottom < 100;
  }, []);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || sending || !convContext) return;

    const msgInput = newMessage.trim();
    setNewMessage("");
    setSending(true);

    let finalMessage = msgInput;
    if (productContext) {
      finalMessage = JSON.stringify({ type: "product_reference", product: productContext, text: msgInput });
      setProductContext(null);
    }

    const tempId = `temp-${Date.now()}`;
    const tempMsg: ChatMessage = {
      id: tempId, conversation_id: conversationId, sender_id: user.id, message: finalMessage, created_at: new Date().toISOString(),
    };

    allMessagesRef.current = [...allMessagesRef.current, tempMsg];
    syncVisible(true);
    setTimeout(() => inputRef.current?.focus(), 50);

    try {
      const { error } = await supabase.from("shop_messages").insert([{ conversation_id: conversationId, sender_id: user.id, message: finalMessage }]);
      if (error) throw error;
      
      const toUpdate = convContext.role === "buyer" 
        ? { last_message: finalMessage, last_time: new Date().toISOString() } 
        : { last_message: finalMessage, last_time: new Date().toISOString() };
        
      await supabase.from("shop_conversations").update(toUpdate).eq("id", conversationId);
      
      // Increment unread manually (not 100% atomic unless RPC, but good enough)
      const { data: currCount } = await supabase.from("shop_conversations").select("unread_shop, unread_buyer").eq("id", conversationId).single();
      if (currCount) {
        if (convContext.role === "buyer") {
          await supabase.from("shop_conversations").update({ unread_shop: currCount.unread_shop + 1 }).eq("id", conversationId);
        } else {
          await supabase.from("shop_conversations").update({ unread_buyer: currCount.unread_buyer + 1 }).eq("id", conversationId);
        }
      }

    } catch {
      toast.error("Gagal mengirim pesan");
      allMessagesRef.current = allMessagesRef.current.filter(m => m.id !== tempId);
      syncVisible();
    } finally {
      setSending(false);
    }
  };

  const handleTyping = () => {
    if (!channelRef.current || !user || !convContext) return;
    channelRef.current.send({ type: "broadcast", event: "typing", payload: { user_id: user.id, is_typing: true } });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      channelRef.current?.send({ type: "broadcast", event: "typing", payload: { user_id: user.id, is_typing: false } });
    }, 2000);
  };

  if (!isMounted) return <div className="fixed inset-0 bg-white" />;

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-50 z-[60]">
      <div className="flex flex-col flex-1 max-w-md mx-auto w-full overflow-hidden">
        {/* HEADER */}
        <header className="flex-none bg-white border-b border-slate-100 shadow-sm z-20">
          <div className="h-14 flex items-center px-4">
            <button onClick={() => router.back()} className="p-1 -ml-1 text-slate-700 active:scale-95 transition-transform">
              <ArrowLeft size={24} strokeWidth={2.5} />
            </button>
            {loading ? (
               <div className="ml-3 font-bold text-slate-800">Memuat...</div>
            ) : convContext && (
              <div className="ml-3 flex items-center gap-3">
                <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                  {convContext.target_image ? (
                    <img src={convContext.target_image} alt={convContext.target_name} className="w-full h-full object-cover" />
                  ) : (
                    convContext.role === "buyer" ? <Store size={18} className="text-slate-400" /> : <User size={18} className="text-slate-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pr-4">
                  <h1 className="text-sm font-bold text-slate-800 leading-tight truncate">{convContext.target_name}</h1>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">
                      {convContext.role === "buyer" ? "Toko" : "Pembeli"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* SCROLL AREA */}
        <div ref={scrollAreaRef} onScroll={handleScroll} className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3 bg-slate-50">
          <div ref={topSentinelRef} className="w-full flex justify-center h-6 items-center">
            {isFetchingOlder ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                <Loader2 size={13} className="animate-spin text-indigo-400" /> Memuat pesan lama...
              </div>
            ) : hasOlderOnServer ? <div className="w-2 h-2 rounded-full bg-slate-200" /> : (
              <span className="text-[10px] text-slate-300 font-medium tracking-wide">Awal percakapan</span>
            )}
          </div>

          {loading ? (
             <div className="flex justify-center items-center py-20 text-slate-400"><Loader2 size={28} className="animate-spin" /></div>
          ) : visibleMessages.map((msg) => {
            const isMine = msg.sender_id === user?.id;
            const isTemp = msg.id.startsWith("temp-");
            
            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                  <div className={`px-4 py-2.5 rounded-2xl ${isMine
                    ? "bg-indigo-600 text-white rounded-tr-sm shadow-md"
                    : "bg-white border border-slate-100 text-slate-700 rounded-tl-sm shadow-sm"} 
                    ${isTemp ? "opacity-60" : "opacity-100 transition-opacity duration-300"}`}>
                    
                    {(() => {
                        try {
                          if (msg.message.startsWith('{"type":"product_reference"')) {
                            const parsed = JSON.parse(msg.message);
                            return (
                              <div className="flex flex-col gap-2">
                                <div onClick={() => router.push(`/product/${parsed.product.id}`)} className={`flex items-center gap-2 p-2 rounded-xl border ${isMine ? 'bg-white/10 border-indigo-500 hover:bg-white/20' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'} cursor-pointer transition-colors active:scale-95`}>
                                  {parsed.product.image_url ? (
                                    <img src={parsed.product.image_url} alt={parsed.product.name} className="w-10 h-10 object-cover rounded-md shrink-0" />
                                  ) : (
                                    <div className="w-10 h-10 bg-slate-200 rounded-md flex items-center justify-center shrink-0"><Store size={14} className="text-slate-400" /></div>
                                  )}
                                  <div className="flex-1 min-w-0 pr-2">
                                    <h4 className={`text-[11px] font-bold truncate mb-0.5 ${isMine ? 'text-white' : 'text-slate-800'}`}>{parsed.product.name}</h4>
                                    <p className={`text-[10px] font-bold ${isMine ? 'text-indigo-100' : 'text-indigo-600'}`}>Rp {parsed.product.price?.toLocaleString('id-ID')}</p>
                                  </div>
                                </div>
                                <p className="text-[13.5px] whitespace-pre-wrap leading-relaxed">{parsed.text}</p>
                              </div>
                            );
                          }
                        } catch {}
                        return <p className="text-[13.5px] whitespace-pre-wrap leading-relaxed">{msg.message}</p>;
                    })()}
                  </div>
                  <div className="flex items-center gap-1 mt-1 px-1">
                    <span className="text-[10px] font-medium text-slate-400">
                      {isTemp ? "Mengirim..." : new Date(msg.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {isTyping && (
             <div className="flex justify-start">
               <div className="bg-white border px-4 py-2.5 rounded-2xl rounded-tl-sm shadow-sm"><Loader2 size={14} className="animate-spin text-indigo-400" /></div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT */}
        <div className="flex-none bg-white border-t border-slate-200">
          {productContext && (
            <div className="px-4 pt-3 pb-1 relative">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center gap-3 pr-8 shadow-sm">
                {productContext.image_url && <img src={productContext.image_url} className="w-10 h-10 object-cover rounded-lg shrink-0" />}
                <div className="flex-1 min-w-0">
                  <h4 className="text-[11px] font-bold text-slate-800 truncate mb-0.5">{productContext.name}</h4>
                  <p className="text-[10px] text-indigo-600 font-bold">Rp {productContext.price?.toLocaleString()}</p>
                </div>
                <button type="button" onClick={() => setProductContext(null)} className="absolute right-6 p-1.5 text-slate-400"><X size={12} strokeWidth={3} /></button>
              </div>
            </div>
          )}
          <form onSubmit={sendMessage} className="p-4 flex gap-3">
            <input
              ref={inputRef} type="text"
              placeholder={`Tulis pesan...`}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner"
              value={newMessage} onChange={(e) => { setNewMessage(e.target.value); handleTyping(); }}
              onFocus={() => { setTimeout(() => scrollToBottom(), 300); }} style={{ fontSize: "16px" }}
            />
            <button type="submit" disabled={!newMessage.trim() || sending} className="px-5 bg-indigo-600 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 disabled:bg-slate-300 shadow-md">
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
