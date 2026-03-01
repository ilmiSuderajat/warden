import Hero from "./components/Hero";
import Banner from "./components/Banner";
import PromoBanner from "./components/PromoBanner";
import ProductList from "./components/ProductList";
import Link from "next/link";
import { ChevronRight, ShoppingBag } from "lucide-react";

export default function Home() {
  return (

    <div className="min-h-screen bg-gray-100 max-w-md mx-auto">
      {/* PROMO BANNER SLIDER */}
      <PromoBanner />
      <Hero />


      <Banner />

      {/* JAJANAN READY BANNER - Modern Clean Style */}
      <div className="px-4 mb-5">
        <Link href="/ready">
          <div className="relative rounded-2xl overflow-hidden group active:scale-[0.98] transition-all duration-200 cursor-pointer shadow-lg shadow-emerald-500/10">

            {/* 1. Background Gradient (Fresh Green Theme) */}
            <div className="absolute inset-0 bg-indigo-600" />

            {/* 2. Modern Dot Pattern (Replacement for Noise) */}
            <div
              className="absolute inset-0 opacity-10"
              style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '16px 16px' }}
            />

            {/* 3. Decorative Orbs */}
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-teal-300/30 rounded-full blur-2xl" />
            <div className="absolute -bottom-8 -left-8 w-28 h-28 bg-emerald-400/20 rounded-full blur-2xl" />

            {/* 4. Content Layout */}
            <div className="relative z-10 px-5 py-4 flex items-center justify-between gap-4">

              {/* Left Side: Text Hierarchy */}
              <div className="flex flex-col flex-1">
                {/* Badge Pill */}
                <div className="inline-flex items-center gap-1.5 mb-1.5 self-start bg-white/15 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-lime-300 animate-pulse" />
                  <span className="text-[10px] font-bold text-white uppercase tracking-wide">
                    Siap Kirim
                  </span>
                </div>

                {/* Title */}
                <h2 className="text-xl font-extrabold text-white tracking-tight drop-shadow-sm">
                  Jajanan Ready
                </h2>

                {/* Subtitle/CTA */}
                <p className="text-white/80 text-xs mt-1 flex items-center gap-1 font-medium">
                  Klik disini untuk Lihat jajanan Favorit.
                  <ChevronRight
                    size={14}
                    className="mt-0.5 opacity-70 group-hover:translate-x-1 transition-transform duration-200"
                  />
                </p>
              </div>

              {/* Right Side: Icon Container */}
              <div className="flex-shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center bg-indigo-600 border-white/20  transition-transform duration-300 group-hover:scale-105">
                <ShoppingBag size={26} className="text-white" strokeWidth={2} />
              </div>
            </div>
          </div>
        </Link>
      </div>

      <ProductList />
    </div>
  );
}