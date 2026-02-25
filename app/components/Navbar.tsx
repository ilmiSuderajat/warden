"use client"
import { House, ShoppingCart, ChartBarStacked, Users, Zap, Package, FolderPlus } from "lucide-react";
import { usePathname } from "next/navigation";
import Link from "next/link";

export default function Navbar() {
  const pathname = usePathname();
  const isAdminPage = pathname.startsWith('/admin');

  // Logika penentuan Link Akun
  const profileHref = isAdminPage ? "/admin/profile" : "/profile";
  const isProfileActive = pathname === "/admin/profile" || pathname === "/profile";

  return (
    <main className="max-w-md mx-auto h-16 font-bold fixed bottom-0 left-0 right-0 bg-gray-50 shadow-md flex items-center justify-between px-4 z-10">
      
      {isAdminPage ? (
        /* === MENU KHUSUS ADMIN === */

        <>
        <Link href="/admin/" className={`text-xs focus:outline-none ${pathname.includes('dashboard') ? 'text-indigo-600' : 'text-gray-500'}`}>
            <House className={`m-auto ${pathname.includes('dashboard') ? 'text-indigo-600' : 'text-gray-500'}`} />
            Dashboard
          </Link>


          <Link href="/admin/flash-sale" className={`text-xs focus:outline-none ${pathname.includes('flash-sale') ? 'text-indigo-600' : 'text-gray-500'}`}>
            <Zap className={`m-auto ${pathname.includes('flash-sale') ? 'text-indigo-600' : 'text-gray-500'}`} />
            FlashSale
          </Link>
          
          <Link href="/admin/add-category" className={`text-xs focus:outline-none ${pathname.includes('category') ? 'text-indigo-600' : 'text-gray-500'}`}>
            <FolderPlus className={`m-auto ${pathname.includes('category') ? 'text-indigo-600' : 'text-gray-500'}`} />
            Kategori
          </Link>

          <Link href="/admin/add-product" className={`text-xs focus:outline-none ${pathname.includes('product') ? 'text-indigo-600' : 'text-gray-500'}`}>
            <Package className={`m-auto ${pathname.includes('product') ? 'text-indigo-600' : 'text-gray-500'}`} />
            Produk
          </Link>
        </>
      ) : (
        /* === MENU KHUSUS USER === */
        <>
          <Link href="/" className={`text-xs focus:outline-none ${pathname === '/' ? 'text-indigo-600' : 'text-gray-500'}`}>
            <House className={`m-auto ${pathname === '/' ? 'text-indigo-600' : 'text-gray-500'}`} />
            Beranda
          </Link>
          
          <Link href="/category" className={`text-xs focus:outline-none ${pathname === '/category' ? 'text-indigo-600' : 'text-gray-500'}`}>
            <ChartBarStacked className={`m-auto ${pathname === '/category' ? 'text-indigo-600' : 'text-gray-500'}`} />
            Kategori
          </Link>

          <Link href="/cart" className={`text-xs focus:outline-none ${pathname === '/cart' ? 'text-indigo-600' : 'text-gray-500'}`}>
            <ShoppingCart className={`m-auto ${pathname === '/cart' ? 'text-indigo-600' : 'text-gray-500'}`} />
            Keranjang
          </Link>
        </>
      )}

      {/* LINK AKUN DINAMIS */}
      <Link 
        href={profileHref} 
        className={`text-xs focus:outline-none ${isProfileActive ? 'text-indigo-600' : 'text-gray-500'}`}
      >
        <Users className={`m-auto ${isProfileActive ? 'text-indigo-600' : 'text-gray-500'}`} />
        Akun
      </Link>

    </main>
  );
}