"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  Search, MessageCircle, Send, Loader2, User,
  ChevronLeft, CheckCircle2, Sparkles, Clock, CircleDot, Info, Phone, MoreVertical
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface ChatMessage {
  id: string;
  user_id: string;
  message: string;
  sender_type: "user" | "admin";
  is_read?: boolean;
  created_at: string;
}

interface ChatUser {
  user_id: string;
  name: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
}

const DOM_WINDOW = 60;
const FETCH_SIZE = 30;

export default function AdminChatPage() {
  const router = useRouter();

  // User list state
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Chat state
  const allMessagesRef = useRef<ChatMessage[]>([]);
  const [visibleMessages, setVisibleMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [hasOlderOnServer, setHasOlderOnServer] = useState(false);
  const [isFetchingOlder, setIsFetchingOlder] = useState(false);
  const [newMessageIds, setNewMessageIds] = useState<Set<string>>(new Set());
  const [isTyping, setIsTyping] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedUserRef = useRef(selectedUser);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const oldestCursorRef = useRef<string | null>(null);
  const isAtBottomRef = useRef(true);

  useEffect(() => { selectedUserRef.current = selectedUser; }, [selectedUser]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior }), 80);
  }, []);

  const syncVisible = useCallback((focusNewest = false) => {
    const sliced = allMessagesRef.current.slice(-DOM_WINDOW);
    setVisibleMessages([...sliced]);
    if (focusNewest) scrollToBottom("auto");
  }, [scrollToBottom]);

  const fetchUsers = useCallback(async (showLoading = true) => {
    if (showLoading) setLoadingUsers(true);
    try {
      const { data: chatsData, error: chatsError } = await supabase
        .from("chats")
        .select("*")
        .order("created_at", { ascending: false });

      if (chatsError) throw chatsError;

      const userMap = new Map<string, { user_id: string; last_message: string; last_message_time: string; unread_count: number }>();
      (chatsData || []).forEach((chat: ChatMessage) => {
        if (!userMap.has(chat.user_id)) {
          userMap.set(chat.user_id, {
            user_id: chat.user_id,
            last_message: chat.message,
            last_message_time: chat.created_at,
            unread_count: 0,
          });
        }
        if (chat.sender_type === "user" && !chat.is_read) {
          userMap.get(chat.user_id)!.unread_count += 1;
        }
      });

      const userIds = Array.from(userMap.keys());
      if (userIds.length > 0) {
        const { data: addrData } = await supabase
          .from("addresses")
          .select("user_id, name")
          .in("user_id", userIds)
          .eq("is_default", true);

        const nameMap = new Map<string, string>();
        addrData?.forEach((a: { user_id: string; name: string }) =>
          nameMap.set(a.user_id, a.name)
        );

        const finalUsers: ChatUser[] = Array.from(userMap.values()).map(u => ({
          ...u,
          name: nameMap.get(u.user_id) || `User ${u.user_id.slice(0, 5)}`,
        }));

        setUsers(
          finalUsers.sort(
            (a, b) =>
              new Date(b.last_message_time).getTime() -
              new Date(a.last_message_time).getTime()
          )
        );
      } else {
        setUsers([]);
      }
    } catch (err) {
      console.error("Error fetching chat users:", err);
      toast.error("Gagal memuat daftar chat");
    } finally {
      if (showLoading) setLoadingUsers(false);
    }
  }, []);

  const markAsRead = useCallback(async (userId: string) => {
    await supabase
      .from("chats")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("sender_type", "user")
      .eq("is_read", false);
  }, []);

  useEffect(() => {
    fetchUsers();

    const channel = supabase
      .channel("admin:chats")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chats" }, payload => {
        const msg = payload.new as ChatMessage;

        setUsers(prev => {
          const idx = prev.findIndex(u => u.user_id === msg.user_id);
          if (idx === -1) { fetchUsers(false); return prev; }
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            last_message: msg.message,
            last_message_time: msg.created_at,
            unread_count:
              msg.sender_type === "user" &&
                (!selectedUserRef.current || selectedUserRef.current.user_id !== msg.user_id)
                ? (next[idx].unread_count || 0) + 1
                : next[idx].unread_count,
          };
          return next.sort(
            (a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
          );
        });

        const current = selectedUserRef.current;
        if (current && msg.user_id === current.user_id) {
          const all = allMessagesRef.current;
          const tempIdx = all.findIndex(
            m => m.id.startsWith("temp-") &&
              m.message === msg.message &&
              m.sender_type === msg.sender_type
          );

          if (tempIdx > -1) {
            allMessagesRef.current = [
              ...all.slice(0, tempIdx),
              msg,
              ...all.slice(tempIdx + 1),
            ];
          } else if (!all.some(m => m.id === msg.id)) {
            allMessagesRef.current = [...all, msg];
            setNewMessageIds(ids => new Set([...ids, msg.id]));
          }

          syncVisible(isAtBottomRef.current);

          if (msg.sender_type === "user") markAsRead(msg.user_id);
        }
      })
      .on("broadcast", { event: "typing" }, payload => {
        if (payload.sender_type === "user") {
          const current = selectedUserRef.current;
          if (current && payload.user_id === current.user_id) {
            setIsTyping(payload.is_typing);
            if (payload.is_typing) setTimeout(() => setIsTyping(false), 3000);
          }
        }
      })
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [fetchUsers, markAsRead, syncVisible]);

  const loadChat = async (chatUser: ChatUser) => {
    setSelectedUser(chatUser);
    setLoadingChat(true);
    allMessagesRef.current = [];
    setVisibleMessages([]);
    setNewMessageIds(new Set());
    oldestCursorRef.current = null;
    isAtBottomRef.current = true;

    setUsers(prev =>
      prev.map(u => (u.user_id === chatUser.user_id ? { ...u, unread_count: 0 } : u))
    );
    markAsRead(chatUser.user_id);

    try {
      const { data, error, count } = await supabase
        .from("chats")
        .select("*", { count: "exact" })
        .eq("user_id", chatUser.user_id)
        .order("created_at", { ascending: false })
        .limit(FETCH_SIZE);

      if (error) throw error;
      const msgs = (data || []).reverse() as ChatMessage[];
      allMessagesRef.current = msgs;
      oldestCursorRef.current = msgs[0]?.created_at ?? null;
      setHasOlderOnServer((count ?? 0) > FETCH_SIZE);
      syncVisible(true);
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat isi chat");
    } finally {
      setLoadingChat(false);
    }
  };

  const fetchOlder = useCallback(async () => {
    if (isFetchingOlder || !hasOlderOnServer || !selectedUserRef.current || !oldestCursorRef.current) return;
    setIsFetchingOlder(true);

    const scrollArea = scrollAreaRef.current;
    const prevScrollHeight = scrollArea?.scrollHeight ?? 0;

    try {
      const { data, error } = await supabase
        .from("chats")
        .select("*")
        .eq("user_id", selectedUserRef.current.user_id)
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
  }, [isFetchingOlder, hasOlderOnServer]);

  useEffect(() => {
    const sentinel = topSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) fetchOlder();
      },
      { root: scrollAreaRef.current, rootMargin: "120px 0px 0px 0px", threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchOlder]);

  const handleScroll = useCallback(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distFromBottom < 100;

    if (isAtBottomRef.current && allMessagesRef.current.length > DOM_WINDOW) {
      setVisibleMessages([...allMessagesRef.current.slice(-DOM_WINDOW)]);
    }
  }, []);

  useEffect(() => {
    if (visibleMessages.length === 0) return;
    if (isAtBottomRef.current) scrollToBottom("smooth");
  }, [visibleMessages, isTyping, scrollToBottom]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const handleResize = () => {
      if (document.activeElement?.tagName === "INPUT")
        document.activeElement.scrollIntoView({ behavior: "smooth", block: "end" });
      if (isAtBottomRef.current) setTimeout(() => scrollToBottom("smooth"), 100);
    };
    window.visualViewport.addEventListener("resize", handleResize);
    return () => window.visualViewport?.removeEventListener("resize", handleResize);
  }, [scrollToBottom]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser) return;

    const msg = newMessage.trim();
    setNewMessage("");

    const tempId = `temp-${Date.now()}`;
    const tempMsg: ChatMessage = {
      id: tempId,
      user_id: selectedUser.user_id,
      message: msg,
      sender_type: "admin",
      created_at: new Date().toISOString(),
    };

    allMessagesRef.current = [...allMessagesRef.current, tempMsg];
    syncVisible(true);

    setTimeout(() => inputRef.current?.focus(), 50);

    try {
      const { error } = await supabase
        .from("chats")
        .insert([{ user_id: selectedUser.user_id, message: msg, sender_type: "admin", is_read: false }]);
      if (error) throw error;
    } catch {
      toast.error("Gagal membalas pesan");
      allMessagesRef.current = allMessagesRef.current.filter(m => m.id !== tempId);
      syncVisible();
    }
  };

  const handleAIReply = async () => {
    if (!selectedUser) return;
    setLoadingAI(true);
    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.user_id, userName: selectedUser.name }),
      });
      const data = await res.json();
      if (data.reply) setNewMessage(data.reply);
      else toast.error("AI gagal generate balasan");
    } catch {
      toast.error("Terjadi kesalahan saat menggunakan AI");
    } finally {
      setLoadingAI(false);
    }
  };

  const handleTyping = () => {
    if (!channelRef.current || !selectedUser) return;
    channelRef.current.send({
      type: "broadcast",
      event: "typing",
      payload: { user_id: selectedUser.user_id, is_typing: true, sender_type: "admin" },
    });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      channelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: { user_id: selectedUser.user_id, is_typing: false, sender_type: "admin" },
      });
    }, 2000);
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: "smooth", block: "end" });
      if (isAtBottomRef.current) scrollToBottom("smooth");
    }, 300);
  };

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-[#fdfdff] font-sans text-slate-900 border-x border-slate-100 shadow-2xl overflow-hidden selection:bg-indigo-100">
      <div className="flex flex-col h-full max-w-5xl mx-auto w-full relative">

        {/* ══ HEADER PREMIUM GLASSMISM ══ */}
        <div className="flex-none h-20 bg-white/80 border-b border-slate-100/60 flex items-center justify-between px-6 backdrop-blur-xl shadow-sm z-30">
          <div className="flex items-center gap-4">
            <button
                onClick={() => router.push("/admin")}
                className="p-2.5 -ml-2 text-slate-400 hover:text-slate-900 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all active:scale-95 border border-slate-100/50"
            >
                <ChevronLeft size={22} strokeWidth={2.5} />
            </button>
            <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-indigo-600 rounded-[1.2rem] flex items-center justify-center shadow-lg shadow-indigo-100 text-white">
                    <MessageCircle size={22} strokeWidth={2.5} />
                </div>
                <div>
                    <h1 className="text-base font-black text-slate-900 tracking-tight leading-none mb-1">Live Chat</h1>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Support Center</p>
                </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-black uppercase tracking-tighter border border-emerald-100 flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                System Online
            </div>
          </div>
        </div>

        {/* ══ BODY ══ */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── SIDEBAR REDESIGN ── */}
          <div
            className={`w-full md:w-80 bg-white/50 backdrop-blur-md border-r border-slate-100 flex flex-col shrink-0 transition-transform ${
              selectedUser ? "hidden md:flex" : "flex"
            }`}
          >
            {/* Search Premium */}
            <div className="p-4 shrink-0">
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                  <Search size={16} strokeWidth={3} />
                </div>
                <input
                  type="text"
                  placeholder="Cari percakapan..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-50 transition-all text-xs font-bold shadow-sm"
                />
              </div>
            </div>

            {/* User list */}
            <div className="flex-1 overflow-y-auto space-y-1 p-2">
              {loadingUsers ? (
                 [1,2,3,4,5].map(i => (
                     <div key={i} className="h-20 bg-white/60 rounded-2xl animate-pulse mx-2" />
                 ))
              ) : filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center">
                  <div className="p-4 bg-slate-50 rounded-full text-slate-200 mb-4"><MessageCircle size={32} /></div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Chat Kosong</p>
                </div>
              ) : (
                filteredUsers.map(u => (
                  <button
                    key={u.user_id}
                    onClick={() => loadChat(u)}
                    className={`w-full p-4 flex gap-4 text-left transition-all rounded-[1.8rem] mb-1 group relative ${
                      selectedUser?.user_id === u.user_id ? "bg-indigo-600 text-white shadow-xl shadow-indigo-100 scale-[1.02] z-10" : "hover:bg-white hover:shadow-sm"
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border font-black text-lg transition-colors ${selectedUser?.user_id === u.user_id ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-slate-50 border-slate-100 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 group-hover:border-indigo-100'}`}>
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      {u.unread_count > 0 && (
                        <span className={`absolute -top-1 -right-1 text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-lg shadow-lg ${selectedUser?.user_id === u.user_id ? 'bg-rose-500' : 'bg-indigo-600'}`}>
                          {u.unread_count > 9 ? "9+" : u.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <h3 className={`text-sm font-black truncate tracking-tight ${selectedUser?.user_id === u.user_id ? "text-white" : "text-slate-800"}`}>{u.name}</h3>
                        <span className={`text-[8px] font-black uppercase tracking-tighter ml-2 whitespace-nowrap ${selectedUser?.user_id === u.user_id ? "text-white/60" : "text-slate-300"}`}>
                           {new Date(u.last_message_time).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className={`text-[11px] truncate tracking-tight ${selectedUser?.user_id === u.user_id ? "font-medium text-white/80" : "font-bold text-slate-400"}`}>
                        {u.last_message}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── CHAT PANEL REDESIGN ── */}
          <div
            className={`flex-1 flex flex-col min-w-0 relative shadow-2xl ${
              !selectedUser ? "hidden md:flex items-center justify-center bg-slate-50/30" : "flex bg-white"
            }`}
          >
            {!selectedUser ? (
              <div className="text-center opacity-20 flex flex-col items-center">
                <div className="w-24 h-24 bg-slate-100 rounded-[2.5rem] flex items-center justify-center text-slate-400 mb-6"><MessageCircle size={48} /></div>
                <h4 className="font-black text-xl tracking-tighter uppercase">Warden Admin Chat</h4>
                <p className="text-sm font-bold mt-2">Pilih pelanggan untuk memulai bantuan</p>
              </div>
            ) : (
              <>
                {/* Active Chat Header */}
                <div className="flex-none h-20 bg-white/60 backdrop-blur-md border-b border-slate-50 flex items-center justify-between px-6 z-20">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSelectedUser(null)}
                            className="p-2 -ml-2 mr-1 md:hidden text-slate-400 hover:text-slate-900 bg-slate-50 rounded-xl"
                        >
                            <ChevronLeft size={20} strokeWidth={3} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200">
                                <User size={20} className="text-slate-400" strokeWidth={2.5} />
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-sm font-black text-slate-800 truncate">{selectedUser.name}</h2>
                                <div className="flex items-center gap-1.5 text-emerald-600">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                                    <span className="text-[10px] font-black uppercase tracking-tighter">Verified session</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button className="p-2.5 text-slate-300 hover:text-slate-600 transition-colors"><Phone size={18} /></button>
                        <button className="p-2.5 text-slate-300 hover:text-slate-600 transition-colors"><MoreVertical size={18} /></button>
                    </div>
                </div>

                {/* Messages scroll area */}
                <div
                  ref={scrollAreaRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#fcfdff]"
                >
                  <div ref={topSentinelRef} className="flex justify-center h-8 items-center">
                    {isFetchingOlder ? (
                      <div className="px-4 py-1.5 bg-white border border-slate-100 rounded-full flex items-center gap-2 text-[10px] font-bold text-slate-400 shadow-sm">
                        <Loader2 size={12} className="animate-spin text-indigo-500" />
                        Sinkronisasi pesan lama...
                      </div>
                    ) : hasOlderOnServer ? (
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                    ) : (
                      <div className="px-4 py-1.5 bg-slate-50 rounded-full text-[9px] font-black text-slate-300 uppercase tracking-widest">Chat dimulai</div>
                    )}
                  </div>

                  {loadingChat ? (
                    <div className="flex justify-center py-20">
                      <div className="w-10 h-10 border-4 border-indigo-50 border-t-indigo-500 rounded-full animate-spin"></div>
                    </div>
                  ) : (
                    visibleMessages.map((msg, i) => {
                      const isAdmin = msg.sender_type === "admin";
                      const isTemp = msg.id.startsWith("temp-");
                      const showDate = i === 0 || new Date(msg.created_at).getDate() !== new Date(visibleMessages[i-1].created_at).getDate();

                      return (
                        <div key={msg.id} className="space-y-4">
                            {showDate && (
                                <div className="flex justify-center my-4">
                                    <span className="px-3 py-1 bg-slate-100 rounded-lg text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                                        {new Date(msg.created_at).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
                                    </span>
                                </div>
                            )}
                            <div className={`flex ${isAdmin ? "justify-end" : "justify-start"} group`}>
                                <div className={`max-w-[80%] md:max-w-[70%] flex flex-col ${isAdmin ? "items-end" : "items-start"}`}>
                                    <div
                                        className={`px-5 py-3 rounded-3xl relative shadow-sm transition-all duration-300 ${
                                            isAdmin
                                            ? "bg-indigo-600 text-white rounded-tr-sm shadow-indigo-100"
                                            : "bg-white text-slate-800 border border-slate-100 rounded-tl-sm"
                                        } ${isTemp ? "opacity-40 translate-y-1" : "opacity-100"}`}
                                    >
                                        <p className="text-[13px] font-bold leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                                    </div>
                                    <div className={`flex items-center gap-2 mt-1.5 px-1.5 ${isAdmin ? "flex-row-reverse" : ""}`}>
                                        <span className="text-[9px] font-black text-slate-300 uppercase">
                                            {isTemp ? "SINKRON..." : new Date(msg.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                                        </span>
                                        {isAdmin && !isTemp && (
                                            msg.is_read 
                                                ? <CheckCircle2 size={12} className="text-emerald-500" strokeWidth={2.5} /> 
                                                : <CheckCircle2 size={12} className="text-slate-200" strokeWidth={2.5} />
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                      );
                    })
                  )}

                  {isTyping && (
                    <div className="flex justify-start items-center gap-2">
                        <div className="bg-slate-50 px-4 py-3 rounded-2xl rounded-tl-sm border border-slate-100">
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

                {/* Input Designer Look */}
                <div className="flex-none p-5 bg-white border-t border-slate-50 z-20">
                    <form onSubmit={sendMessage} className="relative">
                        <div className="flex gap-3 items-center">
                            <div className="relative flex-1 group">
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={newMessage}
                                    onChange={e => { setNewMessage(e.target.value); handleTyping(); }}
                                    onFocus={handleFocus}
                                    style={{ fontSize: "16px" }}
                                    placeholder={`Tulis balasan untuk ${selectedUser.name.split(' ')[0]}...`}
                                    className="w-full bg-slate-50 border border-slate-100 rounded-[2rem] px-6 py-4 text-sm font-bold outline-none focus:bg-white focus:ring-4 focus:ring-indigo-100/50 transition-all shadow-inner pr-14 placeholder:text-slate-300"
                                />
                                <button
                                    type="button"
                                    onClick={handleAIReply}
                                    disabled={loadingAI}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-[1.4rem] bg-white text-indigo-600 hover:text-white hover:bg-indigo-600 shadow-sm border border-slate-100 transition-all disabled:opacity-40"
                                >
                                    {loadingAI ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} strokeWidth={2.5} />}
                                </button>
                            </div>
                            <button
                                type="submit"
                                disabled={!newMessage.trim()}
                                className="w-14 h-14 bg-indigo-600 text-white rounded-[1.8rem] flex items-center justify-center shadow-xl shadow-indigo-100 hover:bg-indigo-700 active:scale-90 transition-all disabled:bg-slate-200 disabled:shadow-none"
                            >
                                <Send size={24} strokeWidth={2.5} className="mr-0.5" />
                            </button>
                        </div>
                        <div className="mt-3 flex items-center gap-2 px-1">
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 rounded-full">
                                <Sparkles size={11} className="text-indigo-400" />
                                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">AI Assistant Active</span>
                            </div>
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-full">
                                <Info size={11} className="text-slate-300" />
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Shift: Administrator</span>
                            </div>
                        </div>
                    </form>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
