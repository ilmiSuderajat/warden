import ProductList from "./components/ProductList"
import CategoryDiscovery from "./components/CategoryDiscovery"
import TopCard from "./components/TopCardTemp"
import FlashSale from "./components/FlashSale"
import PromoBanner from "./components/PromoBanner"
import VoucherBanner from "./components/VoucherBanner"

export default function Home() {
  return (
    <div className="max-w-md mx-auto bg-gray-100 min-h-screen pb-20 flex flex-col gap-2">
      <div className="w-full mt-2">
        <TopCard />
      </div>

      <div className="w-full">
        <CategoryDiscovery />
      </div>

      {/* Row 1: Shopee Live & Flash Sale */}
      <div className="px-3">
        <FlashSale />
      </div>

      {/* Row 2: Promo Banner + Product List (Merged) */}
      <div className="w-full bg-gray-50/50 mb-10">
        <ProductList headerItem={<PromoBanner />} />
      </div>
    </div>
  )
}