"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";

export default function ConditionalNavbar() {
  const pathname = usePathname();
  const isProductPage = pathname.startsWith('/product');
  const isCheckoutPage = pathname.startsWith('/checkout');
  const isCartPage = pathname.startsWith('/cart');
  const isCategoryPage = pathname.startsWith('/category');
  const isProductDetailPage = pathname.match(/^\/product\/[^\/]+$/);
  const isAdressPage = pathname.startsWith('/address');
  const isAdminPage = pathname.startsWith('/admin');
  const isChatPage = pathname.startsWith('/chat');
  const isShopPage = pathname.startsWith('/shop');
  const isDriverPage = pathname.startsWith('/driver');
  if (isProductPage || isCartPage || isCheckoutPage || isCategoryPage || isProductDetailPage || isAdressPage || isChatPage || isAdminPage || isShopPage || isDriverPage) return null;

  return (
    <>
      <Navbar />
    </>
  );
}