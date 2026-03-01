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


      {/* JAJANAN READY BANNER */}
      <div className="px-4 mb-5">
        <Link href="/ready">
          <div className="bg-indigo-600 rounded-2xl p-4 flex items-center justify-between shadow-lg shadow-indigo-100 relative overflow-hidden group active:scale-[0.98] transition-all">
            <div className="relative z-10 flex flex-col">
              <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-1">Stok Ready</span>
              <h2 className="text-lg font-extrabold text-white leading-tight">Jajanan Ready</h2>
              <p className="text-indigo-100 text-[10px] mt-1 flex items-center gap-1 font-medium">
                Cek jajanan yang siap kirim <ChevronRight size={12} className="group-hover:translate-x-1 transition-transform" />
              </p>
            </div>
            <div className="bg-white/10 p-3 rounded-xl relative z-10">
              <ShoppingBag size={24} className="text-white" />
            </div>
            <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/5 rounded-full blur-2xl"></div>
          </div>
        </Link>
      </div>

      <Banner />
      <ProductList />
    </div>
  );
}