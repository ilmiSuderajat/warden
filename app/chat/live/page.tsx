"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, MessageCircle, Send, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
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

export default function LiveChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    // We use a small delay to ensure the DOM has updated and layout has settled
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior });
    }, 150);
  }, []);

  const fetchMessages = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("chats")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error("Error fetching chats:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const setupRealtime = useCallback((userId: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`live-chat:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chats", filter: `user_id=eq.${userId}` },
        (payload) => {
          const newMsg = payload.new as ChatMessage;

          setMessages(prev => {
            // Deduplicate: replace temp message if matching
            const tempIdx = prev.findIndex(
              m => m.id.startsWith("temp-") &&
                m.message === newMsg.message &&
                m.sender_type === newMsg.sender_type
            );
            if (tempIdx > -1) {
              const updated = [...prev];
              updated[tempIdx] = newMsg;
              return updated;
            }
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    channelRef.current = channel;
  }, []);

  // Mark admin messages as read
  const markAsRead = useCallback(async (userId: string) => {
    try {
      await supabase
        .from("chats")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("sender_type", "admin")
        .eq("is_read", false);
    } catch (err) {
      console.error("Error marking read", err);
    }
  }, []);

  // Auth + data init
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const u = { id: session.user.id };
        setUser(u);
        fetchMessages(u.id);
        setupRealtime(u.id);
        markAsRead(u.id);
      } else {
        setLoading(false);
      }
    };

    init();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const u = { id: session.user.id };
        setUser(u);
        fetchMessages(u.id);
        setupRealtime(u.id);
        markAsRead(u.id);
      } else {
        setUser(null);
        setMessages([]);
        setLoading(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [fetchMessages, setupRealtime, markAsRead]);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Handle focus event to scroll to bottom
  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    // Delay slightly to let keyboard appear
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      scrollToBottom();
    }, 400);
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
      user_id: user.id,
      message: msg,
      sender_type: "user",
      created_at: new Date().toISOString(),
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
          user_id: user.id,
          message: msg,
          sender_type: "user",
        }]);

      if (error) throw error;
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Gagal mengirim pesan");
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setSending(false);
    }
  };

  // Not logged in state
  if (!loading && !user) {
    return (
      <div className="min-h-screen bg-slate-50 max-w-md mx-auto font-sans flex flex-col">
        <header className="h-14 bg-white flex items-center px-4 border-b border-slate-100 shrink-0">
          <button onClick={() => router.back()} className="p-1 -ml-1 text-slate-700 active:scale-95 transition-transform">
            <ArrowLeft size={24} strokeWidth={2.5} />
          </button>
          <h1 className="ml-3 text-lg font-bold tracking-tight">Live Chat</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
            <MessageCircle size={28} className="text-indigo-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">Login diperlukan</h2>
          <p className="text-sm text-slate-500 mb-6">Silakan login terlebih dahulu untuk menggunakan Live Chat.</p>
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
    <div
      ref={containerRef}
      className="bg-slate-50 font-sans flex flex-col h-[100dvh] w-full relative overflow-hidden z-50 text-slate-900"
    >
      {/* Inner wrapper for max-width centering */}
      <div className="flex flex-col h-full max-w-md mx-auto w-full relative">
        {/* Header */}
        <header className="bg-white border-b border-slate-100 shrink-0">
          <div className="h-14 flex items-center px-4">
            <button
              onClick={() => router.back()}
              className="p-1 -ml-1 text-slate-700 active:scale-95 transition-transform touch-manipulation"
            >
              <ArrowLeft size={24} strokeWidth={2.5} />
            </button>
            <div className="ml-3 flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-600 rounded-full flex items-center justify-center">
                <MessageCircle size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-slate-800 leading-tight">Customer Support</h1>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">Online</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 overscroll-contain">
          {loading ? (
            <div className="flex justify-center items-center h-full text-slate-400">
              <Loader2 size={28} className="animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-60">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
                <MessageCircle size={28} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700">Mulai percakapan</p>
                <p className="text-xs text-slate-500 mt-1 max-w-[220px]">
                  Tanyakan soal produk, pesanan, stok, atau kendala apapun.
                </p>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isAdmin = msg.sender_type === "admin";
              const isTemp = msg.id.startsWith("temp-");
              return (
                <div key={msg.id} className={`flex ${isAdmin ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${isAdmin
                      ? "bg-white border border-slate-100 text-slate-700 rounded-tl-sm shadow-sm"
                      : "bg-indigo-600 text-white rounded-tr-sm shadow-md shadow-indigo-100"
                    } ${isTemp ? "opacity-70" : ""}`}
                  >
                    <p className="text-[13.5px] whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                    <p className={`text-[9px] mt-1 text-right ${isAdmin ? "text-slate-400" : "text-indigo-200"}`}>
                      {isTemp ? "Mengirim..." : new Date(msg.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={sendMessage} className="p-3 bg-white border-t border-slate-100 shrink-0">
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 pl-4 rounded-full border border-slate-200">
            <input
              ref={inputRef}
              type="text"
              placeholder="Ketik pesan..."
              className="flex-1 bg-transparent border-none outline-none text-slate-700"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onFocus={handleFocus}
              style={{ fontSize: "16px" }}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="w-10 h-10 flex items-center justify-center bg-indigo-600 text-white rounded-full disabled:bg-slate-300 disabled:text-slate-500 transition-colors active:scale-90"
            >
              <Send size={16} className="ml-0.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
