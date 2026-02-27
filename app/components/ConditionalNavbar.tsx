"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import { Suspense } from "react";

export default function ConditionalNavbar() {
  const pathname = usePathname();
  const isProductPage = pathname.startsWith('/product');
  const isOrdersPage = pathname.startsWith('/orders');
  const isCheckoutPage = pathname.startsWith('/checkout');
  const isCartPage = pathname.startsWith('/cart');
  const isCategoryPage = pathname.startsWith('/category');
  const isProductDetailPage = pathname.match(/^\/product\/[^\/]+$/);
  const isAdressPage = pathname.startsWith('/address');
  if (isProductPage || isOrdersPage || isCheckoutPage || isCartPage || isCategoryPage || isProductDetailPage || isAdressPage) return null;

  return (
   <>
   <Navbar />
   </>
  );
}