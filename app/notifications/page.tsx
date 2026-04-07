"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { 
  ShoppingCart, MessageCircle, Tag, Tv, 
  Wallet, ShoppingBag, ChevronRight 
} from "lucide-react";
import Link from "next/link";
import Skeleton from "@/app/components/Skeleton";

export default function NotificationsPage() {
  const router = useRouter();
  const [userNotifications, setUserNotifications] = useState<any[]>([]);
  const [shopNotifications, setShopNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"saya" | "toko">("saya");
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  // Badges state for top header
  const [cartCount, setCartCount] = useState(0);
  const [chatCount, setChatCount] = useState(0);

  useEffect(() => {
    fetchData();

    // Subscribe to realtime notification updates
    const notifyChannel = supabase
      .channel('notif_page_sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(notifyChannel); };
  }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    // 1. Fetch Notifications
    const { data: notifs } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (notifs) {
      setUserNotifications(notifs.filter(n => !n.for_shop));
      setShopNotifications(notifs.filter(n => n.for_shop));
    }

    // 2. Fetch Cart Count
    const { count: cCount } = await supabase
      .from("cart")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    setCartCount(cCount || 0);

    // 3. Fetch Chat Count
    let totalUnread = 0;
    
    // a. As buyer
    const { data: asBuyer } = await supabase
      .from("shop_conversations")
      .select("unread_buyer")
      .eq("buyer_id", user.id);
    asBuyer?.forEach((c: any) => totalUnread += (c.unread_buyer || 0));

    // b. As shop owner
    const { data: myShops } = await supabase
      .from("shops")
      .select("id")
      .eq("owner_id", user.id);
      
    if (myShops && myShops.length > 0) {
      const shopIds = myShops.map((s: any) => s.id);
      const { data: asShop } = await supabase
        .from("shop_conversations")
        .select("unread_shop")
        .in("shop_id", shopIds);
      asShop?.forEach((c: any) => totalUnread += (c.unread_shop || 0));
    }
    
    setChatCount(totalUnread);

    setLoading(false);
  };

  const markOrdersAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    // Optimistic UI
    if (activeTab === "saya") {
      setUserNotifications(prev => prev.map(n => n.type === 'order' ? { ...n, is_read: true } : n));
    } else {
      setShopNotifications(prev => prev.map(n => n.type === 'order' ? { ...n, is_read: true } : n));
    }

    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("type", "order")
      .eq("for_shop", activeTab === "toko")
      .eq("is_read", false);
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.is_read) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", notif.id);
      if (notif.for_shop) {
         setShopNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      } else {
         setUserNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      }
    }
    if (notif.link) router.push(notif.link);
  };

  const handleCategoryClick = async (catId: string) => {
    if (expandedCat === catId) {
      setExpandedCat(null);
      return;
    }
    setExpandedCat(catId);
    // Mark all of this type as read
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (activeTab === "saya") {
      setUserNotifications(prev => prev.map(n => n.type === catId ? { ...n, is_read: true } : n));
    } else {
      setShopNotifications(prev => prev.map(n => n.type === catId ? { ...n, is_read: true } : n));
    }
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("type", catId)
      .eq("for_shop", activeTab === "toko")
      .eq("is_read", false);
  };

  // derived data
  const currentNotifs = activeTab === "saya" ? userNotifications : shopNotifications;
  const orderNotifs = currentNotifs.filter(n => n.type === 'order');
  
  const getUnreadCount = (type: string) => {
    return currentNotifs.filter(n => n.type === type && !n.is_read).length;
  };

  const getLatestMsg = (type: string, fallback: string) => {
    const matched = currentNotifs.filter(n => n.type === type);
    if (!matched.length) return fallback;
    return matched[0].message; // sorted by created_at desc so [0] is latest
  };

  const totalUnreadSaya = userNotifications.filter(n => !n.is_read).length;

  const categories = [
    { 
      id: "promo", 
      title: "Promo Warden", 
      desc: getLatestMsg("promo", "Belum ada promo baru hari ini. Nantikan kejutannya!"), 
      icon: <Tag size={22} className="text-orange-500" />
    },
    { 
      id: "live", 
      title: "Live, Video dan Hadiah", 
      desc: getLatestMsg("live", "Tonton siaran live dan dapatkan hadiah menarik!"), 
      icon: <Tv size={22} className="text-emerald-500" />
    },
    { 
      id: "finance", 
      title: "Keuangan", 
      desc: getLatestMsg("finance", "Atur keuanganmu dan nikmati berbagai layanan dompet."), 
      icon: <Wallet size={22} className="text-red-500" />
    },
    { 
      id: "system", 
      title: "Info Warden", 
      desc: getLatestMsg("system", "Tidak ada pembaruan sistem yang baru."), 
      icon: <ShoppingBag size={22} className="text-indigo-500" />
    }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 max-w-md mx-auto">
        <div className="bg-white p-4 flex items-center justify-between border-b">
          <Skeleton className="w-24 h-6" />
          <div className="flex gap-4">
            <Skeleton className="w-6 h-6 rounded-full" />
            <Skeleton className="w-6 h-6 rounded-full" />
          </div>
        </div>
        <div className="p-4 space-y-3">
          <Skeleton className="w-full h-16" />
          <Skeleton className="w-full h-16" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 max-w-md mx-auto font-sans text-slate-800 pb-20">
      
      {/* ── HEADER ── */}
      <div className="sticky top-0 z-40 bg-white">
        <div className="flex items-center justify-between px-4 py-3.5">
          <h1 className="text-lg font-medium text-slate-900">Notifikasi</h1>
          
          <div className="flex items-center gap-5">
             <Link href="/cart" className="relative text-indigo-600">
               <ShoppingCart size={24} strokeWidth={2} />
               {cartCount > 0 && (
                 <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 border border-white">
                   {cartCount > 99 ? '99+' : cartCount}
                 </span>
               )}
             </Link>
             <Link href="/chat" className="relative text-indigo-600">
               <MessageCircle size={24} strokeWidth={2} />
               {chatCount > 0 && (
                 <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 border border-white">
                   {chatCount > 99 ? '99+' : chatCount}
                 </span>
               )}
             </Link>
          </div>
        </div>
        
        {/* TABS */}
        <div className="flex">
          <button 
            onClick={() => setActiveTab("saya")}
            className={`flex-1 flex justify-center items-center gap-1.5 py-3 text-[14px] transition-colors border-b-2 ${activeTab === "saya" ? "border-indigo-600 text-indigo-600 font-medium" : "border-transparent text-slate-600"}`}
          >
            Notifikasi Saya 
            {totalUnreadSaya > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center justify-center min-w-[18px]">
                {totalUnreadSaya > 99 ? '99+' : totalUnreadSaya}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab("toko")}
            className={`flex-1 flex justify-center items-center py-3 text-[14px] transition-colors border-b-2 ${activeTab === "toko" ? "border-indigo-600 text-indigo-600 font-medium" : "border-transparent text-slate-600"}`}
          >
            Notifikasi Toko
          </button>
        </div>
      </div>

      {/* STATIC CATEGORIES AND LIST SHARED BY BOTH TABS */}
      <div className="bg-white">
        {/* STATIC CATEGORIES */}
        <div className="divide-y divide-slate-100">
            {categories.map((cat) => {
              const unread = getUnreadCount(cat.id);
              const catNotifs = currentNotifs.filter(n => n.type === cat.id);
              const isExpanded = expandedCat === cat.id;
              return (
                <div key={cat.id}>
                  <div
                    onClick={() => handleCategoryClick(cat.id)}
                    className="flex items-center p-3.5 hover:bg-slate-50 cursor-pointer active:bg-slate-100 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center shrink-0">
                        {cat.icon}
                    </div>
                    <div className="ml-3 flex-1 min-w-0 pr-2">
                        <h3 className="text-[14px] font-medium text-slate-800">{cat.title}</h3>
                        <p className="text-[12px] text-slate-500 truncate mt-0.5">{cat.desc}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {unread > 0 && (
                          <span className="bg-rose-500 text-white text-[10px] font-bold min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center">
                            {unread > 99 ? '99+' : unread}
                          </span>
                        )}
                        <ChevronRight size={16} className={`text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} />
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="bg-slate-50 divide-y divide-slate-100 border-t border-slate-100">
                      {catNotifs.length === 0 ? (
                        <div className="py-8 text-center text-[12px] text-slate-400">Belum ada notifikasi</div>
                      ) : catNotifs.map(notif => (
                        <div
                          key={notif.id}
                          onClick={() => handleNotificationClick(notif)}
                          className={`flex items-start px-4 py-3 cursor-pointer hover:bg-white transition-colors ${notif.is_read ? 'opacity-60' : ''}`}
                        >
                          {!notif.is_read && <div className="w-2 h-2 bg-rose-500 rounded-full shrink-0 mt-1.5 mr-2" />}
                          <div className={`flex-1 ${notif.is_read ? '' : 'ml-0'}`}>
                            <p className="text-[13px] font-medium text-slate-800 line-clamp-1">{notif.title}</p>
                            <p className="text-[12px] text-slate-600 mt-0.5 line-clamp-2">{notif.message}</p>
                            <p className="text-[11px] text-slate-400 mt-1">
                              {new Date(notif.created_at).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {/* STATUS PESANAN HEADER */}
        <div className="bg-slate-50 flex items-center justify-between px-4 py-2 border-y border-slate-100">
            <span className="text-[13px] text-slate-500 font-medium">Status Pesanan</span>
            <button 
              onClick={markOrdersAsRead}
              className="text-[12px] text-slate-400 hover:text-slate-600 transition-colors"
            >
              Tandai Sudah Dibaca
            </button>
        </div>

        {/* PESANAN LIST ATAU EMPTY STATE */}
        <div className="bg-white">
          {orderNotifs.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {orderNotifs.map((notif) => (
                  <div 
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`flex p-4 cursor-pointer hover:bg-slate-50 transition-colors ${notif.is_read ? 'opacity-60' : 'bg-indigo-50/20'}`}
                  >
                    <div className="w-10 h-10 rounded-full border border-slate-200 flex items-center justify-center shrink-0 bg-white">
                        <ShoppingCart size={20} className="text-emerald-500" />
                    </div>
                    <div className="ml-3 flex-1">
                        <div className="flex justify-between items-start">
                          <h3 className="text-[14px] font-medium text-slate-800 line-clamp-1">{notif.title}</h3>
                          {!notif.is_read && <div className="w-2 h-2 bg-rose-500 rounded-full shrink-0 mt-1.5" />}
                        </div>
                        <p className="text-[13px] text-slate-600 mt-0.5 leading-snug line-clamp-2">{notif.message}</p>
                        <p className="text-[11px] text-slate-400 mt-1.5">
                          {new Date(notif.created_at).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                  </div>
                ))}
              </div>
          ) : (
              <div className="flex flex-col items-center justify-center py-16">
                {/* Empty state illustration */}
                <div className="relative w-32 h-32 flex items-center justify-center mb-2">
                  <ShoppingCart size={64} className="text-orange-400 opacity-80 rotate-12" strokeWidth={1.5} />
                  <div className="absolute top-4 right-8 bg-orange-500 w-10 h-10 rounded text-white flex items-center justify-center font-serif italic text-lg shadow-sm -rotate-12">
                    S
                  </div>
                  <div className="absolute bottom-4 w-20 h-2 bg-slate-200 rounded-full blur-[2px]" />
                </div>
                <button onClick={() => router.push(activeTab === "toko" ? "/admin" : "/")} className="mt-4 border border-orange-500 text-orange-500 hover:bg-orange-50 font-medium px-6 py-2 rounded text-[14px] transition-colors">
                  {activeTab === "toko" ? "Kembali ke Dashboard" : "Belanja Sekarang"}
                </button>
              </div>
          )}
        </div>
      </div>

    </div>
  );
}
