"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { usePathname } from "next/navigation";

interface ChatMessage {
  id: string;
  user_id: string;
  message: string;
  sender_type: "user" | "admin";
  is_read?: boolean;
  created_at: string;
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  /**
   * keyboardOffset = px keyboard mengambil dari bawah layar.
   * Dipakai untuk menggeser floating button & chat window.
   */
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  /**
   * availableHeight = tinggi area tersisa setelah keyboard muncul.
   * Dipakai untuk membatasi tinggi chat window agar tidak meluap ke atas.
   */
  const [availableHeight, setAvailableHeight] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatWindowRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();

  // Refs to avoid stale closures in realtime callbacks
  const isOpenRef = useRef(isOpen);
  const userRef = useRef(user);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Baseline height — simpan tinggi layar sebelum keyboard muncul
  const baselineHeightRef = useRef(0);

  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);
  useEffect(() => { userRef.current = user; }, [user]);

  const isChatPage = pathname === "/chat";

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 120);
  }, []);

  const markAsRead = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser) return;

    try {
      await supabase
        .from("chats")
        .update({ is_read: true })
        .eq("user_id", currentUser.id)
        .eq("sender_type", "admin")
        .eq("is_read", false);

      setUnreadCount(0);
    } catch (err) {
      console.error("Error marking read", err);
    }
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

      if (!isOpenRef.current) {
        const unreadMsgs = (data || []).filter(
          (m: ChatMessage) => m.sender_type === "admin" && !m.is_read
        );
        setUnreadCount(unreadMsgs.length);
      }
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
      .channel(`user-chat:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chats', filter: `user_id=eq.${userId}` },
        (payload) => {
          const newMsg = payload.new as ChatMessage;

          setMessages(prev => {
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

          if (newMsg.sender_type === "admin" && !isOpenRef.current) {
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;
  }, []);

  // Auth listener
  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ? { id: session.user.id } : null
      setUser(currentUser)
      if (currentUser) {
        fetchMessages(currentUser.id)
        setupRealtime(currentUser.id)
      } else {
        setMessages([])
        setLoading(false)
        if (channelRef.current) supabase.removeChannel(channelRef.current)
      }
    })
    return () => {
      authListener.subscription.unsubscribe()
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [fetchMessages, setupRealtime]);

  // Event listener for "open-warden-chat" from the Chat page
  useEffect(() => {
    const handleOpenChat = () => {
      setIsOpen(true);
      markAsRead();
    };

    window.addEventListener('open-warden-chat', handleOpenChat);
    return () => window.removeEventListener('open-warden-chat', handleOpenChat);
  }, [markAsRead]);

  // Scroll to bottom when messages change or chat opens
  useEffect(() => {
    if (isOpen && isChatPage) {
      scrollToBottom();
      markAsRead();
    }
  }, [messages, isOpen, isChatPage, scrollToBottom, markAsRead]);

  /**
   * Keyboard detection via visualViewport API.
   *
   * Strategi:
   * - Simpan baseline height (window.innerHeight) saat pertama mount.
   *   Ini tidak berubah di iOS, tapi bisa berubah di Android.
   * - Gunakan visualViewport.height untuk deteksi keyboard.
   * - Di Android WebView, window.innerHeight kadang ikut mengecil
   *   saat keyboard muncul. Jadi kita pakai baseline sebagai referensi.
   * - keyboardOffset = baseline - visualViewport.height
   * - availableHeight = visualViewport.height
   */
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Simpan baseline height saat mount (sebelum keyboard muncul)
    baselineHeightRef.current = window.innerHeight;

    const vv = window.visualViewport;

    const updateLayout = () => {
      const baseline = baselineHeightRef.current;

      if (vv) {
        const vpHeight = Math.round(vv.height);
        const vpOffsetTop = Math.round(vv.offsetTop);

        // Keyboard offset: perbedaan antara baseline dan area visible
        const kbHeight = Math.max(0, baseline - vpHeight - vpOffsetTop);
        setKeyboardOffset(kbHeight);
        setAvailableHeight(vpHeight);
      } else {
        // Fallback: bandingkan current innerHeight dengan baseline
        const currentHeight = window.innerHeight;
        const kbHeight = Math.max(0, baseline - currentHeight);
        setKeyboardOffset(kbHeight);
        setAvailableHeight(currentHeight);
      }
    };

    updateLayout();

    if (vv) {
      vv.addEventListener("resize", updateLayout);
      vv.addEventListener("scroll", updateLayout);
    }
    window.addEventListener("resize", updateLayout);

    return () => {
      if (vv) {
        vv.removeEventListener("resize", updateLayout);
        vv.removeEventListener("scroll", updateLayout);
      }
      window.removeEventListener("resize", updateLayout);
    };
  }, []);

  // Scroll ke bawah & cegah page scroll saat keyboard muncul/hilang
  useEffect(() => {
    if (isOpen) {
      scrollToBottom();

      // Cegah halaman di belakang ikut scroll saat keyboard muncul
      // Ini penting di Android WebView
      if (keyboardOffset > 0) {
        window.scrollTo(0, 0);
      }
    }
  }, [keyboardOffset, isOpen, scrollToBottom]);

  // Handle input focus — pastikan chat window tetap visible
  const handleInputFocus = useCallback(() => {
    // Delay agar keyboard sempat muncul & visualViewport ter-update
    setTimeout(() => {
      scrollToBottom();
      // Cegah page scroll (bukan chat scroll)
      window.scrollTo(0, 0);
    }, 300);
  }, [scrollToBottom]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const msg = newMessage.trim();
    setNewMessage("");

    const tempId = `temp-${Date.now()}`;
    const tempMsg: ChatMessage = {
      id: tempId,
      user_id: user.id,
      message: msg,
      sender_type: "user",
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMsg]);

    // Re-focus input setelah kirim agar keyboard tetap terbuka
    setTimeout(() => inputRef.current?.focus(), 50);

    try {
      const { error } = await supabase
        .from("chats")
        .insert([{
          user_id: user.id,
          message: msg,
          sender_type: "user"
        }]);

      if (error) throw error;
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Gagal mengirim pesan");
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  if (!isChatPage || !user) return null;

  // ── Layout constants ──────────────────────────────────────────────
  const BUTTON_BOTTOM_BASE = 20;
  const WINDOW_GAP_FROM_BUTTON = 70;
  const WINDOW_HEIGHT_DEFAULT = 450;
  const WINDOW_MIN_HEIGHT = 220;

  const buttonBottomPx = BUTTON_BOTTOM_BASE + keyboardOffset;

  const computedWindowHeight = availableHeight
    ? Math.min(
      WINDOW_HEIGHT_DEFAULT,
      Math.max(
        WINDOW_MIN_HEIGHT,
        availableHeight - buttonBottomPx - WINDOW_GAP_FROM_BUTTON
      )
    )
    : WINDOW_HEIGHT_DEFAULT;

  const windowBottomPx = buttonBottomPx + WINDOW_GAP_FROM_BUTTON;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) markAsRead();
        }}
        style={{ bottom: `${buttonBottomPx}px` }}
        className={`fixed right-5 p-4 rounded-full shadow-lg shadow-indigo-200 transition-all duration-200 z-50 text-white ${isOpen ? 'bg-slate-800' : 'bg-indigo-600 hover:bg-indigo-700'
          }`}
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
        <div
          ref={chatWindowRef}
          style={{
            bottom: `${windowBottomPx}px`,
            height: `${computedWindowHeight}px`,
          }}
          className="fixed right-5 w-[calc(100vw-40px)] md:w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5"
        >
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
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 overscroll-contain">
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
                onFocus={handleInputFocus}
                // fontSize 16px mencegah auto-zoom di iOS
                style={{ fontSize: "16px" }}
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