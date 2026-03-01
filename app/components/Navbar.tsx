"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home, ShoppingCart, LayoutGrid, Users, Zap,
  Package, FolderPlus, LayoutDashboard, Heart, MessageCircle,
  type LucideIcon
} from "lucide-react";

type MenuItem = { href: string; label: string; icon: LucideIcon; match: boolean };

export default function Navbar() {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  // Listen to auth state changes agar navbar selalu update
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Tentukan apakah ini halaman admin berdasarkan URL saja
  const isAdminPage = pathname.startsWith("/admin");

  const isProfileActive = pathname === "/profile" || pathname === "/admin/profile" || pathname === "/login";

  const userMenu: MenuItem[] = [
    { href: "/", label: "Beranda", icon: Home, match: pathname === "/" },
    { href: "/wishlist", label: "Wishlist", icon: Heart, match: pathname === "/wishlist" },
    { href: "/chat", label: "Chat", icon: MessageCircle, match: pathname === "/chat" },
    { href: "/cart", label: "Keranjang", icon: ShoppingCart, match: pathname === "/cart" },
  ];

  // Menu Admin
  const adminMenu: MenuItem[] = [
    { href: "/admin", label: "Home", icon: LayoutDashboard, match: pathname === "/admin" },
    { href: "/admin/flash-sale", label: "Flash", icon: Zap, match: pathname.includes("flash-sale") },
    { href: "/admin/add-category", label: "Kategori", icon: FolderPlus, match: pathname.includes("add-category") },
    { href: "/admin/add-product", label: "Produk", icon: Package, match: pathname.includes("add-product") },
  ];

  const currentMenu = isAdminPage ? adminMenu : userMenu;

  // Jika belum login → /login, jika admin page → /admin/profile, kalau sudah login → /profile
  const profileHref = !isLoggedIn ? "/login" : isAdminPage ? "/admin/profile" : "/profile";

  return (
    <nav className="max-w-md mx-auto fixed bottom-0 left-0 right-0 h-16 bg-gray-50 border-t border-slate-100 z-50">
      <div className="flex justify-around items-center h-full px-2">

        {/* Render Menu Dinamis */}
        {currentMenu.map((item) => {
          const isActive = item.match;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${isActive ? 'text-indigo-600' : 'text-gray-600'
                }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-[10px] font-semibold`}>{item.label}</span>

              {/* Indikator Garis Bawah saat Aktif */}
              {isActive && (
                <div className="absolute bottom-0 h-0.5 w-6 bg-indigo-600 rounded-full"></div>
              )}
            </Link>
          );
        })}

        {/* Menu Akun (Selalu di ujung) */}
        <Link
          href={profileHref}
          className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${isProfileActive ? 'text-indigo-600' : 'text-gray-600'
            }`}
        >
          <Users size={20} strokeWidth={isProfileActive ? 2.5 : 2} />
          <span className={`text-[10px] font-semibold`}>Akun</span>

          {isProfileActive && (
            <div className="absolute bottom-0 h-0.5 w-6 bg-slate-900 rounded-full"></div>
          )}
        </Link>

      </div>
    </nav>
  );
}