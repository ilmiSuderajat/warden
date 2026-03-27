"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  Search, MessageCircle, Send, Loader2, User,
  ChevronLeft, CheckCircle2, Sparkles, Clock
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

  // Sync visible DOM window from all fetched messages
  const syncVisible = useCallback((focusNewest = false) => {
    const sliced = allMessagesRef.current.slice(-DOM_WINDOW);
    setVisibleMessages([...sliced]);
    if (focusNewest) scrollToBottom("auto");
  }, [scrollToBottom]);

  // ── FETCH USERS ──
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

  // ── REALTIME GLOBAL CHANNEL ──
  useEffect(() => {
    fetchUsers();

    const channel = supabase
      .channel("admin:chats")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chats" }, payload => {
        const msg = payload.new as ChatMessage;

        // Sidebar update
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

        // Active chat update
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

  // ── LOAD CHAT (initial page) ──
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

  // ── LOAD OLDER (via IntersectionObserver) ──
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

      // Re-window from the top
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

  // ── INTERSECTION OBSERVER ──
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

  // ── SCROLL TRACKING ──
  const handleScroll = useCallback(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distFromBottom < 100;

    // Re-window to newest when user returns to bottom
    if (isAtBottomRef.current && allMessagesRef.current.length > DOM_WINDOW) {
      setVisibleMessages([...allMessagesRef.current.slice(-DOM_WINDOW)]);
    }
  }, []);

  // Auto-scroll for new messages
  useEffect(() => {
    if (visibleMessages.length === 0) return;
    if (isAtBottomRef.current) scrollToBottom("smooth");
  }, [visibleMessages, isTyping, scrollToBottom]);

  // WebView keyboard
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

  // ── SEND MESSAGE ──
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
    <div className="flex flex-col h-[100dvh] w-full bg-slate-50 font-sans text-slate-900 border-x border-slate-200 shadow-xl overflow-hidden">
      <div className="flex flex-col h-full max-w-5xl mx-auto w-full">

        {/* ══ FIXED HEADER ══ */}
        <div className="flex-none h-16 bg-white border-b border-slate-200 flex items-center px-4 shadow-sm z-20">
          <button
            onClick={() => router.push("/admin")}
            className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <ChevronLeft size={20} strokeWidth={2.5} />
          </button>
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center ml-2 mr-3">
            <MessageCircle size={20} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-800 tracking-tight">Live Chat</h1>
            <p className="text-[11px] font-medium text-slate-500">Pusat Bantuan Pelanggan</p>
          </div>
        </div>

        {/* ══ BODY ══ */}
        <div className="flex flex-1 overflow-hidden">

          {/* ── SIDEBAR ── */}
          <div
            className={`w-full md:w-80 bg-white border-r border-slate-100 flex flex-col shrink-0 ${
              selectedUser ? "hidden md:flex" : "flex"
            }`}
          >
            {/* Search */}
            <div className="p-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 shadow-sm">
                <Search size={15} className="text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari pembeli..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 text-gray-800"
                />
              </div>
            </div>

            {/* User list */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
              {loadingUsers ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                  <Loader2 size={24} className="animate-spin mb-2" />
                  <p className="text-xs">Memuat obrolan...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-10 text-center text-slate-500">
                  <MessageCircle size={32} className="text-slate-300 mb-3" />
                  <p className="text-sm font-semibold text-slate-700">Tidak ada chat</p>
                  <p className="text-xs text-slate-400 mt-1">Belum ada pelanggan yang menghubungi.</p>
                </div>
              ) : (
                filteredUsers.map(u => (
                  <button
                    key={u.user_id}
                    onClick={() => loadChat(u)}
                    className={`w-full p-4 flex gap-3 text-left transition-colors hover:bg-slate-50 active:bg-indigo-50/60 ${
                      selectedUser?.user_id === u.user_id ? "bg-indigo-50/50" : ""
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-11 h-11 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200">
                        <User size={20} className="text-slate-400" />
                      </div>
                      {u.unread_count > 0 && (
                        <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                          {u.unread_count > 9 ? "9+" : u.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <h3 className={`text-sm font-bold truncate ${u.unread_count > 0 ? "text-slate-900" : "text-slate-700"}`}>{u.name}</h3>
                        <span className="text-[10px] text-slate-400 ml-2 whitespace-nowrap">
                          {new Date(u.last_message_time).toLocaleDateString("id-ID", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                        </span>
                      </div>
                      <p className={`text-xs truncate ${u.unread_count > 0 ? "font-semibold text-slate-800" : "text-slate-500"}`}>
                        {u.last_message}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* ── CHAT PANEL ── */}
          <div
            className={`flex-1 flex flex-col min-w-0 ${
              !selectedUser ? "hidden md:flex items-center justify-center bg-slate-50/50" : "flex bg-white"
            }`}
          >
            {!selectedUser ? (
              <div className="text-center opacity-40">
                <MessageCircle size={64} className="mx-auto mb-4" />
                <p className="font-semibold text-lg">Warung Kita Chat Center</p>
                <p className="text-sm mt-1">Pilih chat pada sidebar untuk mulai merespon</p>
              </div>
            ) : (
              <>
                {/* Chat Header — fixed within panel */}
                <div className="flex-none h-16 bg-white border-b border-slate-100 flex items-center px-4 shadow-sm z-10">
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="p-2 -ml-2 mr-2 md:hidden text-slate-600 hover:bg-slate-100 rounded-xl"
                  >
                    <ChevronLeft size={20} strokeWidth={2.5} />
                  </button>
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mr-3 border border-slate-200">
                    <User size={18} className="text-slate-500" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-sm font-bold text-slate-800">{selectedUser.name}</h2>
                    <div className="flex items-center gap-1.5 text-emerald-600 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Online</span>
                    </div>
                  </div>
                </div>

                {/* Messages scroll area */}
                <div
                  ref={scrollAreaRef}
                  onScroll={handleScroll}
                  className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#f8fafc]"
                >
                  {/* Top sentinel */}
                  <div ref={topSentinelRef} className="flex justify-center h-6 items-center">
                    {isFetchingOlder ? (
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Loader2 size={12} className="animate-spin text-indigo-400" />
                        Memuat pesan lama...
                      </div>
                    ) : hasOlderOnServer ? (
                      <div className="w-2 h-2 rounded-full bg-slate-200" />
                    ) : (
                      <span className="text-[10px] text-slate-300 tracking-wide">Awal percakapan</span>
                    )}
                  </div>

                  {loadingChat ? (
                    <div className="flex justify-center text-indigo-600 py-10">
                      <Loader2 size={32} className="animate-spin" />
                    </div>
                  ) : (
                    visibleMessages.map(msg => {
                      const isAdmin = msg.sender_type === "admin";
                      const isTemp = msg.id.startsWith("temp-");
                      const isNew = newMessageIds.has(msg.id);

                      return (
                        <div
                          key={msg.id}
                          className={`flex ${isAdmin ? "justify-end" : "justify-start"} ${
                            isNew ? (isAdmin ? "msg-slide-right" : "msg-slide-left") : ""
                          }`}
                        >
                          <div className={`max-w-[75%] md:max-w-[60%] flex flex-col ${isAdmin ? "items-end" : "items-start"}`}>
                            <div
                              className={`px-4 py-2.5 rounded-2xl ${
                                isAdmin
                                  ? "bg-indigo-600 text-white rounded-tr-sm shadow-md shadow-indigo-100"
                                  : "bg-white text-slate-800 border border-slate-200 rounded-tl-sm shadow-sm"
                              } ${isTemp ? "opacity-60" : "opacity-100 transition-opacity duration-300"}`}
                            >
                              <p className="text-[13.5px] whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                            </div>
                            <div className={`flex items-center gap-1 mt-1 px-1 ${isAdmin ? "flex-row-reverse" : ""}`}>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {isTemp ? "Mengirim..." : new Date(msg.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                              {isAdmin && (
                                isTemp
                                  ? <Clock size={11} className="text-slate-300" />
                                  : <CheckCircle2 size={12} className={msg.is_read ? "read-receipt-read" : "read-receipt-unread"} />
                              )}
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
                          <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={sendMessage} className="flex-none p-4 bg-white border-t border-slate-200">
                  <div className="flex gap-3">
                    <div className="relative flex-1">
                      <input
                        ref={inputRef}
                        type="text"
                        value={newMessage}
                        onChange={e => { setNewMessage(e.target.value); handleTyping(); }}
                        onFocus={handleFocus}
                        style={{ fontSize: "16px" }}
                        placeholder={`Balas ${selectedUser.name}...`}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all shadow-inner pr-12"
                      />
                      <button
                        type="button"
                        onClick={handleAIReply}
                        disabled={loadingAI}
                        title="Auto-reply dengan AI"
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-50 transition-all"
                      >
                        {loadingAI ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                      </button>
                    </div>
                    <button
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="h-auto px-5 bg-indigo-600 text-white rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 active:scale-95 disabled:bg-slate-300 transition-all shadow-md shadow-indigo-200"
                    >
                      <span>Kirim</span>
                      <Send size={16} />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                    <Sparkles size={10} className="text-indigo-400" />
                    Klik ikon bintang untuk saran balasan dari AI Warung Kita
                  </p>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
