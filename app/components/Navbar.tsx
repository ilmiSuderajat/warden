"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Home, ShoppingCart, LayoutGrid, Users, Zap,
  Package, FolderPlus, LayoutDashboard, MessageCircle
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const [isActuallyAdmin, setIsActuallyAdmin] = useState(false);
  const [profileHref, setProfileHref] = useState("/login");
  const [loading, setLoading] = useState(true);

  // Cek apakah halaman profil sedang aktif
  const isProfileActive = pathname === "/profile" || pathname === "/admin/profile" || pathname === "/login";

  useEffect(() => {
    const checkRole = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setProfileHref("/login");
        setIsActuallyAdmin(false);
      } else {
        // 1. Cek di tabel 'admins' lewat email
        const { data: adminByEmail } = user.email
          ? await supabase
            .from("admins")
            .select("id")
            .ilike("email", user.email)
            .maybeSingle()
          : { data: null };

        // 2. Cek di tabel 'admins' lewat user_id
        const { data: adminById } = await supabase
          .from("admins")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        // 3. Cek di tabel 'users'
        const { data: userRecord } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        const isAdmin = !!adminByEmail || !!adminById || userRecord?.role === "admin";

        console.log("[Navbar] Client-side role check:", {
          email: user.email,
          isAdminByEmail: !!adminByEmail,
          isAdminById: !!adminById,
          roleInUsers: userRecord?.role,
          finalIsAdmin: isAdmin
        });

        setIsActuallyAdmin(isAdmin);
        setProfileHref(isAdmin ? "/admin/profile" : "/profile");
      }
      setLoading(false);
    };

    checkRole();
  }, [pathname]);

  // Definisi Menu User
  const userMenu = [
    { href: "/", label: "Beranda", icon: Home, match: pathname === "/" },
    { href: "/category", label: "Kategori", icon: LayoutGrid, match: pathname === "/category" },
    { href: "/chat", label: "Chat", icon: MessageCircle, match: pathname === "/chat" },
    { href: "/cart", label: "Keranjang", icon: ShoppingCart, match: pathname === "/cart" },
  ];

  // Definisi Menu Admin
  const adminMenu = [
    { href: "/admin", label: "Home", icon: LayoutDashboard, match: pathname === "/admin" },
    { href: "/admin/flash-sale", label: "Flash", icon: Zap, match: pathname.includes("flash-sale") },
    { href: "/admin/add-category", label: "Kategori", icon: FolderPlus, match: pathname.includes("add-category") },
    { href: "/admin/add-product", label: "Produk", icon: Package, match: pathname.includes("add-product") },
  ];

  // Menu berubah based on role, bukan cuma URL
  const currentMenu = isActuallyAdmin ? adminMenu : userMenu;

  if (loading) return (
    <nav className="max-w-md mx-auto fixed bottom-0 left-0 right-0 h-16 bg-gray-50 border-t border-slate-100 z-50 flex items-center justify-center">
      <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </nav>
  );

  return (
    <nav className="max-w-md mx-auto fixed bottom-0 left-0 right-0 h-16 bg-gray-50 border-t border-slate-100 z-50">
      <div className="flex justify-around items-center h-full px-2">

        {/* Render Menu Dinamis */}
        {currentMenu.map((item) => {
          const isActive = item.match;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${isActive ? 'text-indigo-600' : 'text-gray-600'
                }`}
            >
              <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
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