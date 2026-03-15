"use client";

import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { usePathname } from "next/navigation";

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Hide widget on admin pages or login/register pages
  const isHidden = pathname.startsWith("/admin") || pathname.startsWith("/login") || pathname.startsWith("/register");
  const isChatPage = pathname.startsWith("/chat");

  if (!isChatPage) return null;
  useEffect(() => {
    if (isHidden) return;
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      if (session?.user) {
        fetchMessages(session.user.id);
        setupRealtime(session.user.id);
      }
    };

    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        fetchMessages(session.user.id);
        setupRealtime(session.user.id);
      } else {
        setMessages([]);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
      supabase.removeAllChannels();
    };
  }, [isHidden]);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      markAsRead();
    }
  }, [messages, isOpen]);

  const fetchMessages = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("chats")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      // Hitung unread dari admin (jika panel tertutup)
      if (!isOpen) {
        const unreadMsgs = data.filter(m => m.sender_type === "admin" && !m.is_read);
        setUnreadCount(unreadMsgs.length);
      }
    } catch (err) {
      console.error("Error fetching chats:", err);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtime = (userId: string) => {
    supabase
      .channel('public:chats')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chats', filter: `user_id=eq.${userId}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new]);
          if (payload.new.sender_type === "admin" && !isOpen) {
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .subscribe();
  };

  const markAsRead = async () => {
    if (!user || unreadCount === 0) return;

    try {
      await supabase
        .from("chats")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("sender_type", "admin")
        .eq("is_read", false);

      setUnreadCount(0);
    } catch (err) {
      console.error("Error marking read", err);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const msg = newMessage.trim();
    setNewMessage("");

    // Optimistic UI
    const tempId = `temp-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: tempId,
      user_id: user.id,
      message: msg,
      sender_type: "user",
      created_at: new Date().toISOString()
    }]);

    try {
      const { error } = await supabase
        .from("chats")
        .insert([{
          user_id: user.id,
          message: msg,
          sender_type: "user"
        }]);

      if (error) throw error;
      // Note: we don't need to update state here because REALTIME will trigger an INSERT event.
      // But since we did Optimistic UI, we shouldn't rely on realtime to duplicate it, 
      // or we just let Realtime handle it and remove optimistic UI.
      // Let's remove optimistic UI from state actually, then let realtime fetch it, to avoid duplicates.
      setMessages(prev => prev.filter(m => m.id !== tempId)); // remove temp
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Gagal mengirim pesan");
      setMessages(prev => prev.filter(m => m.id !== tempId)); // remove temp on error
    }
  };

  if (isHidden || isChatPage || !user) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) markAsRead();
        }}
        className={`fixed bottom-[80px] md:bottom-6 right-5 p-4 rounded-full shadow-lg shadow-indigo-200 transition-all z-50 text-white ${isOpen ? 'bg-slate-800' : 'bg-indigo-600 hover:bg-indigo-700'}`}
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}

        {/* Unread Badge */}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-[140px] md:bottom-24 right-5 w-[calc(100vw-40px)] md:w-80 h-[450px] bg-white rounded-3xl shadow-2xl border border-slate-100 z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="bg-indigo-600 p-4 text-white flex gap-3 items-center shrink-0">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <MessageCircle size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Customer Support</h3>
              <p className="text-[10px] text-indigo-200">Balasan cepat dalam 5 menit</p>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
            {loading ? (
              <div className="flex justify-center items-center h-full text-slate-400">
                <Loader2 size={24} className="animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-2 opacity-50">
                <MessageCircle size={32} />
                <p className="text-xs font-medium">Belum ada chat.</p>
                <p className="text-[10px]">Tanyakan soal produk, pesanan, atau stok.</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isAdmin = msg.sender_type === "admin";
                return (
                  <div key={msg.id} className={`flex ${isAdmin ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2 ${isAdmin
                      ? 'bg-white border border-slate-100 text-slate-700 rounded-tl-none shadow-sm'
                      : 'bg-indigo-600 text-white rounded-tr-none shadow-md shadow-indigo-100'
                      }`}>
                      <p className="text-[13px] whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                      <p className={`text-[9px] mt-1 text-right ${isAdmin ? 'text-slate-400' : 'text-indigo-200'}`}>
                        {new Date(msg.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form onSubmit={sendMessage} className="p-3 bg-white border-t border-slate-100 shrink-0">
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 pl-4 rounded-full border border-slate-200">
              <input
                type="text"
                placeholder="Ketik pesan..."
                className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="w-9 h-9 flex items-center justify-center bg-indigo-600 text-white rounded-full disabled:bg-slate-300 disabled:text-slate-500 transition-colors"
              >
                <Send size={14} className="ml-0.5" />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
