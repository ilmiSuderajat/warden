"use client";

import { usePathname } from "next/navigation";
import SearchBar from "./SearchBar";
import { Suspense } from "react";

export default function ConditionalSearchBar() {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const isCategory = pathname.startsWith("/category");
  const isCart = pathname.startsWith("/cart");
  const isProfile = pathname.startsWith("/profile") || pathname.startsWith("/admin/profile");
  const isLogin = pathname.startsWith("/login");
  const isOrders = pathname.startsWith("/orders");
  const isCheckout = pathname.startsWith("/checkout");
  const isAdressPage = pathname.startsWith('/address');
  const isProductDetailPage = pathname.match(/^\/product\/[^\/]+$/);
  const isFlashSale = pathname.startsWith("/flash-sale");
  if (isAdmin || isCategory || isCart || isProfile || isLogin || isOrders || isCheckout || isProductDetailPage || isAdressPage || isFlashSale) return null;

  return (
    <Suspense fallback={<div className="h-16 bg-white animate-pulse" />}>
      <SearchBar />
    </Suspense>
  );
}