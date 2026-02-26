"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { 
  Home, ShoppingCart, LayoutGrid, Users, Zap, 
  Package, FolderPlus, LayoutDashboard 
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const isAdminPage = pathname.startsWith('/admin');
  const [profileHref, setProfileHref] = useState("/login");
  
  // Cek apakah halaman profil sedang aktif
  const isProfileActive = pathname === "/profile" || pathname === "/admin/profile" || pathname === "/login";

  useEffect(() => {
    const getDynamicLink = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setProfileHref("/login");
      } else {
        const { data: adminData } = await supabase
          .from("admins")
          .select("email")
          .eq("email", user.email)
          .single();

        if (adminData) {
          setProfileHref("/admin/profile"); 
        } else {
          setProfileHref("/profile");
        }
      }
    };

    getDynamicLink();
  }, [pathname]);

  // Definisi Menu User
  const userMenu = [
    { href: "/", label: "Beranda", icon: Home, match: pathname === "/" },
    { href: "/category", label: "Kategori", icon: LayoutGrid, match: pathname === "/category" },
    { href: "/cart", label: "Keranjang", icon: ShoppingCart, match: pathname === "/cart" },
  ];

  // Definisi Menu Admin
  const adminMenu = [
    { href: "/admin", label: "Home", icon: LayoutDashboard, match: pathname === "/admin" },
    { href: "/admin/flash-sale", label: "Flash", icon: Zap, match: pathname.includes("flash-sale") },
    { href: "/admin/add-category", label: "Kategori", icon: FolderPlus, match: pathname.includes("add-category") },
    { href: "/admin/add-product", label: "Produk", icon: Package, match: pathname.includes("add-product") },
  ];

  const currentMenu = isAdminPage ? adminMenu : userMenu;

  return (
    <nav className="max-w-md mx-auto fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-100 z-50">
      <div className="flex justify-around items-center h-full px-2">
        
        {/* Render Menu Dinamis */}
        {currentMenu.map((item) => {
          const isActive = item.match;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
                isActive ? 'text-slate-900' : 'text-slate-400'
              }`}
            >
              <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-[10px] font-semibold`}>{item.label}</span>
              
              {/* Indikator Garis Bawah saat Aktif */}
              {isActive && (
                <div className="absolute bottom-0 h-0.5 w-6 bg-slate-900 rounded-full"></div>
              )}
            </Link>
          );
        })}

        {/* Menu Akun (Selalu di ujung) */}
        <Link
          href={profileHref}
          className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${
            isProfileActive ? 'text-slate-900' : 'text-slate-400'
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