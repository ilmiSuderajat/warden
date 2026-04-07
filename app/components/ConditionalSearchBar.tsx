"use client";

import { usePathname } from "next/navigation";
import SearchBar from "./SearchBar";
import { Suspense, useEffect, useState } from "react";

export default function ConditionalSearchBar() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);

  const isAdmin = pathname.startsWith("/admin");
  const isCategory = pathname.startsWith("/category");
  const isCart = pathname.startsWith("/cart");
  const isProfile = pathname.startsWith("/profile") || pathname.startsWith("/admin/profile");
  const isLogin = pathname.startsWith("/login");
  const isOrders = pathname.startsWith("/orders");
  const isCheckout = pathname.startsWith("/checkout");
  const isAdressPage = pathname.startsWith('/address');
  const isProductDetailPage = !!pathname.match(/^\/product\/[^\/]+$/);
  const isFlashSale = pathname.startsWith("/flash-sale");
  const isReady = pathname.startsWith("/ready");
  const isWishlist = pathname.startsWith('/wishlist');
  const isVoucher = pathname.startsWith('/voucher');
  const isChat = pathname.startsWith('/chat');
  const isShopPage = pathname.startsWith('/shop');
  const isDriverPage = pathname.startsWith('/driver');
  const isWalletPage = pathname.startsWith('/wallet');
  const isReviewPage = pathname.startsWith('/reviews');
  const isNotificationPage = pathname.startsWith('/notifications');

  const hiddenPages = isAdmin || isCategory || isCart || isProfile || isLogin || isOrders || isCheckout || isAdressPage || isFlashSale || isReady || isWishlist || isVoucher || isChat || isShopPage || isDriverPage || isWalletPage || isReviewPage || isNotificationPage;

  useEffect(() => {
    if (!isProductDetailPage) return;
    const onScroll = () => setIsScrolled(window.scrollY > 80);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [isProductDetailPage]);

  // Halaman yang memang tidak butuh SearchBar sama sekali
  if (hiddenPages) return null;

  // Halaman product detail: tampilkan SearchBar hanya saat scroll
  if (isProductDetailPage) {
    if (!isScrolled) return null;
    return (
      <Suspense fallback={<div className="h-16 bg-indigo-600 animate-pulse" />}>
        <SearchBar />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<div className="h-16 bg-white animate-pulse" />}>
      <SearchBar />
    </Suspense>
  );
}