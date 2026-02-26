"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { House, ShoppingCart, ChartBarStacked, Users, Zap, Package, FolderPlus } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function Navbar() {
  const pathname = usePathname();
  const isAdminPage = pathname.startsWith('/admin');
  
  const [profileHref, setProfileHref] = useState("/login");
  // Perbaiki isProfileActive agar menyala di halaman profil manapun
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
          // KUNCI DISINI: Kalau dia admin, arahkan ke sub-folder profile admin
          setProfileHref("/admin/profile"); 
        } else {
          setProfileHref("/profile");
        }
      }
    };

    getDynamicLink();
  }, [pathname]);

  return (
    <main className="max-w-md mx-auto h-16 font-bold fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-[0_-4px_10px_rgba(0,0,0,0.03)] flex items-center justify-between px-6 z-50">
      
      {isAdminPage ? (
        /* === MENU KHUSUS ADMIN === */
        <>
          <Link href="/admin" className={`text-xs focus:outline-none ${pathname === '/admin' ? 'text-indigo-600' : 'text-gray-400'}`}>
            <House className={`m-auto mb-0.5 ${pathname === '/admin' ? 'text-indigo-600' : 'text-gray-400'}`} size={20} />
            <span className="text-[9px] uppercase tracking-tighter font-black">Dash</span>
          </Link>

          <Link href="/admin/flash-sale" className={`text-xs focus:outline-none ${pathname.includes('flash-sale') ? 'text-indigo-600' : 'text-gray-400'}`}>
            <Zap className={`m-auto mb-0.5 ${pathname.includes('flash-sale') ? 'text-indigo-600' : 'text-gray-400'}`} size={20} />
            <span className="text-[9px] uppercase tracking-tighter font-black">Flash</span>
          </Link>
          
          <Link href="/admin/add-category" className={`text-xs focus:outline-none ${pathname.includes('add-category') ? 'text-indigo-600' : 'text-gray-400'}`}>
            <FolderPlus className={`m-auto mb-0.5 ${pathname.includes('add-category') ? 'text-indigo-600' : 'text-gray-400'}`} size={20} />
            <span className="text-[9px] uppercase tracking-tighter font-black">Kategori</span>
          </Link>

          <Link href="/admin/add-product" className={`text-xs focus:outline-none ${pathname.includes('add-product') ? 'text-indigo-600' : 'text-gray-400'}`}>
            <Package className={`m-auto mb-0.5 ${pathname.includes('add-product') ? 'text-indigo-600' : 'text-gray-400'}`} size={20} />
            <span className="text-[9px] uppercase tracking-tighter font-black">Produk</span>
          </Link>
        </>
      ) : (
        /* === MENU KHUSUS USER === */
        <>
          <Link href="/" className={`text-xs focus:outline-none ${pathname === '/' ? 'text-indigo-600' : 'text-gray-400'}`}>
            <House className={`m-auto mb-0.5 ${pathname === '/' ? 'text-indigo-600' : 'text-gray-400'}`} size={20} />
            <span className="text-[9px] uppercase tracking-tighter font-black">Beranda</span>
          </Link>
          
          <Link href="/category" className={`text-xs focus:outline-none ${pathname === '/category' ? 'text-indigo-600' : 'text-gray-400'}`}>
            <ChartBarStacked className={`m-auto mb-0.5 ${pathname === '/category' ? 'text-indigo-600' : 'text-gray-400'}`} size={20} />
            <span className="text-[9px] uppercase tracking-tighter font-black">Kategori</span>
          </Link>

          <Link href="/cart" className={`text-xs focus:outline-none ${pathname === '/cart' ? 'text-indigo-600' : 'text-gray-400'}`}>
            <ShoppingCart className={`m-auto mb-0.5 ${pathname === '/cart' ? 'text-indigo-600' : 'text-gray-400'}`} size={20} />
            <span className="text-[9px] uppercase tracking-tighter font-black">Keranjang</span>
          </Link>
        </>
      )}

      {/* LINK AKUN DINAMIS (Sekarang nge-link ke /admin/profile atau /profile) */}
      <Link 
        href={profileHref} 
        className={`text-xs focus:outline-none transition-all active:scale-90 ${isProfileActive ? 'text-indigo-600' : 'text-gray-400'}`}
      >
        <Users className={`m-auto mb-0.5 ${isProfileActive ? 'text-indigo-600' : 'text-gray-400'}`} size={20} />
        <span className="text-[9px] uppercase tracking-tighter font-black">Akun</span>
      </Link>

    </main>
  );
}