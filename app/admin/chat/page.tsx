"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Search, MessageCircle, Send, Loader2, User, ChevronLeft, CheckCircle2, Sparkles } from "lucide-react";
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

export default function AdminChatPage() {
  const router = useRouter();
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingChat, setLoadingChat] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Refs to avoid stale closures in realtime callbacks
  const selectedUserRef = useRef(selectedUser);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { selectedUserRef.current = selectedUser; }, [selectedUser]);

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
            unread_count: 0
          });
        }

        if (chat.sender_type === "user" && !chat.is_read) {
          const u = userMap.get(chat.user_id)!;
          u.unread_count += 1;
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
        addrData?.forEach((a: { user_id: string; name: string }) => nameMap.set(a.user_id, a.name));

        const finalUsers: ChatUser[] = Array.from(userMap.values()).map(u => ({
          ...u,
          name: nameMap.get(u.user_id) || `User ${u.user_id.slice(0, 5)}`
        }));

        setUsers(finalUsers.sort((a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()));
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

  // Realtime subscription — single channel for all chats
  useEffect(() => {
    fetchUsers();

    const channel = supabase
      .channel('admin:chats')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chats' }, payload => {
        const msg = payload.new as ChatMessage;

        // Update user list
        setUsers(prev => {
          const uIdx = prev.findIndex(u => u.user_id === msg.user_id);
          const newUsers = [...prev];

          if (uIdx > -1) {
            newUsers[uIdx] = {
              ...newUsers[uIdx],
              last_message: msg.message,
              last_message_time: msg.created_at,
            };
            if (msg.sender_type === "user") {
              // Only increment unread if this user is NOT currently selected
              const current = selectedUserRef.current;
              if (!current || current.user_id !== msg.user_id) {
                newUsers[uIdx] = {
                  ...newUsers[uIdx],
                  unread_count: (newUsers[uIdx].unread_count || 0) + 1
                };
              }
            }
          } else {
            // New user chatted — refetch in background
            fetchUsers(false);
          }

          return newUsers.sort((a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime());
        });

        // Update active chat if currently viewing this user
        const current = selectedUserRef.current;
        if (current && msg.user_id === current.user_id) {
          setMessages(prev => {
            // Deduplicate: if a temp message exists with same text+sender, replace it
            const tempIdx = prev.findIndex(
              m => m.id.startsWith("temp-") &&
                m.message === msg.message &&
                m.sender_type === msg.sender_type
            );

            if (tempIdx > -1) {
              const updated = [...prev];
              updated[tempIdx] = msg;
              return updated;
            }

            // Check if we already have this message (by real id)
            if (prev.some(m => m.id === msg.id)) {
              return prev;
            }

            return [...prev, msg];
          });

            if (msg.sender_type === "user") {
              markAsRead(msg.user_id);
            }
          }
        })
        .on("broadcast", { event: "typing" }, (payload) => {
          if (payload.sender_type === "user") {
            const current = selectedUserRef.current;
            if (current && payload.user_id === current.user_id) {
              setIsTyping(payload.is_typing);
              if (payload.is_typing) {
                setTimeout(() => setIsTyping(false), 3000);
              }
            }
          }
        })
        .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchUsers]); // Only mount once — uses refs for selectedUser


  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
      if (isAtBottom || (messages.length > 0 && messages[messages.length - 1].sender_type === "admin")) {
        scrollToBottom();
      }
    }
  }, [messages, isTyping]);

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

  const markAsRead = async (userId: string) => {
    try {
      await supabase
        .from("chats")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("sender_type", "user")
        .eq("is_read", false);
    } catch (e) {
      console.error("Error marking as read", e);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadChat = async (chatUser: ChatUser) => {
    setSelectedUser(chatUser);
    setLoadingChat(true);

    // Clear unread optimistically
    setUsers(prev => prev.map(u => u.user_id === chatUser.user_id ? { ...u, unread_count: 0 } : u));
    markAsRead(chatUser.user_id);

    try {
      const { data, error } = await supabase
        .from("chats")
        .select("*")
        .eq("user_id", chatUser.user_id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat isi chat");
    } finally {
      setLoadingChat(false);
    }
  };

  // Handle focus event to scroll to bottom
  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    // Delay slightly to let keyboard appear or layout to shift
    setTimeout(() => {
      // Use 'end' block to ensure the input is pushed above the keyboard
      e.target.scrollIntoView({ behavior: 'smooth', block: 'end' });
      scrollToBottom();
    }, 300);
  }, []);

  // Visual Viewport API for WebView keyboard handling
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const handleResize = () => {
      if (document.activeElement?.tagName === "INPUT") {
        document.activeElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
      setTimeout(() => scrollToBottom(), 100);
    };

    window.visualViewport.addEventListener("resize", handleResize);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleResize);
      }
    };
  }, []);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedUser) return;

    const msg = newMessage.trim();
    setNewMessage("");

    // Optimistic UI — keep temp message until realtime replaces it
    const tempId = `temp-${Date.now()}`;
    const tempMsg: ChatMessage = {
      id: tempId,
      user_id: selectedUser.user_id,
      message: msg,
      sender_type: "admin",
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMsg]);

    // Keep keyboard open and re-scroll
    setTimeout(() => {
      inputRef.current?.focus();
      scrollToBottom();
    }, 50);

    try {
      const { error } = await supabase
        .from("chats")
        .insert([{
          user_id: selectedUser.user_id,
          message: msg,
          sender_type: "admin",
          is_read: false
        }]);

      if (error) throw error;
      // Realtime INSERT event will replace the temp message via dedup logic
    } catch (error) {
      console.error("Error sending response:", error);
      toast.error("Gagal membalas pesan");
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  const handleAIReply = async () => {
    if (!selectedUser) return;
    setLoadingAI(true);
    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.user_id,
          userName: selectedUser.name
        })
      });
      const data = await res.json();
      if (data.reply) {
        setNewMessage(data.reply);
      } else {
        toast.error("AI gagal generate balasan");
      }
    } catch (err) {
      console.error(err);
      toast.error("Terjadi kesalahan saat menggunakan AI");
    } finally {
      setLoadingAI(false);
    }
  };

  const filteredUsers = users.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div 
      ref={containerRef}
      className="bg-slate-50 font-sans flex flex-col h-[100dvh] w-full relative overflow-hidden text-slate-900 border-x border-slate-200 shadow-xl"
    >
      {/* Inner wrapper for max-width centering */}
      <div className="flex flex-col h-full max-w-5xl mx-auto w-full relative">
        {/* HEADER */}
        <div className="h-16 bg-white border-b border-slate-200 flex items-center px-4 shrink-0 shadow-sm z-10 w-full">
          <button onClick={() => router.push("/admin")} className="p-2 -ml-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
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

      <div className="flex flex-1 overflow-hidden">
        {/* LIST USER (SIDEBAR) */}
        <div className={`w-full md:w-80 bg-white border-r border-slate-100 flex flex-col shrink-0 ${selectedUser ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-slate-50 bg-slate-50/50 shrink-0">
            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm">
              <Search size={16} className="text-slate-400" />
              <input
                type="text"
                placeholder="Cari pembeli..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400 text-gray-800"
              />
            </div>
          </div>

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
              filteredUsers.map((u) => (
                <button
                  key={u.user_id}
                  onClick={() => loadChat(u)}
                  className={`w-full p-4 flex gap-3 text-left transition-colors hover:bg-slate-50 ${selectedUser?.user_id === u.user_id ? 'bg-indigo-50/50' : ''}`}
                >
                  <div className="relative shrink-0 mt-0.5">
                    <div className="w-11 h-11 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200">
                      <User size={20} className="text-slate-400" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-0.5">
                      <h3 className={`text-sm font-bold truncate pr-2 ${u.unread_count > 0 ? 'text-slate-900' : 'text-slate-700'}`}>{u.name}</h3>
                      <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap mt-0.5">
                        {new Date(u.last_message_time).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <p className={`text-xs truncate ${u.unread_count > 0 ? 'font-bold text-slate-800' : 'text-slate-500'}`}>
                        {u.last_message}
                      </p>
                      {u.unread_count > 0 && (
                        <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full shrink-0">
                          {u.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* CHAT AREA (MAIN) */}
        <div className={`flex-1 bg-slate-50/50 flex items-center justify-center flex-col shrink-0 min-w-0 ${!selectedUser ? 'hidden md:flex' : 'flex'}`}>
          {!selectedUser ? (
            <div className="text-center opacity-40">
              <MessageCircle size={64} className="mx-auto mb-4" />
              <p className="font-semibold text-lg">Warden Chat Center</p>
              <p className="text-sm mt-1">Pilih chat pada sidebar untuk mulai merespon</p>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col bg-white">
              {/* Active Chat Header */}
              <div className="h-16 bg-white border-b border-slate-100 flex items-center px-4 shrink-0 shadow-sm">
                <button onClick={() => setSelectedUser(null)} className="p-2 -ml-2 mr-2 md:hidden text-slate-600 hover:bg-slate-100 rounded-xl">
                  <ChevronLeft size={20} strokeWidth={2.5} />
                </button>
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mr-3 border border-slate-200">
                  <User size={18} className="text-slate-500" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">{selectedUser.name}</h2>
                  <div className="flex items-center gap-1.5 text-emerald-600 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Online</span>
                  </div>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#f8fafc]">
                {loadingChat ? (
                  <div className="flex justify-center items-center h-full text-indigo-600">
                    <Loader2 size={32} className="animate-spin" />
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isAdmin = msg.sender_type === "admin";
                    return (
                      <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] md:max-w-[60%] flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}>
                          <div className={`px-4 py-2.5 rounded-2xl ${isAdmin
                            ? 'bg-indigo-600 text-white rounded-tr-sm shadow-md shadow-indigo-100'
                            : 'bg-white text-slate-800 border border-slate-200 rounded-tl-sm shadow-sm'
                            }`}>
                            <p className="text-[13.5px] whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                          </div>
                          <div className="flex items-center gap-1 mt-1 px-1">
                            <span className="text-[10px] text-slate-400 font-medium">
                              {new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {isAdmin && (
                              msg.is_read ? <CheckCircle2 size={12} className="text-emerald-500" /> : <CheckCircle2 size={12} className="text-slate-300" />
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white border px-4 py-2 rounded-2xl shadow-sm">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150" />
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-300" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <form onSubmit={sendMessage} className="p-4 bg-white border-t border-slate-200 shrink-0">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <input
                      ref={inputRef}
                      type="text"
                       value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        handleTyping();
                      }}
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
                  Klik ikon bintang untuk saran balasan dari AI Warden
                </p>
              </form>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
