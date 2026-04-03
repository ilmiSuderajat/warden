import ProductList from "./components/ProductList"
import CategoryDiscovery from "./components/CategoryDiscovery"
import TopCard from "./components/TopCardTemp"
import FlashSale from "./components/FlashSale"
import PromoBanner from "./components/PromoBanner"
import VoucherBanner from "./components/VoucherBanner"

export default function Home() {
  return (
    <div className="max-w-md mx-auto bg-gray-200 min-h-screen pb-20">
      <div className="w-full">
        <TopCard />
      </div>

      <div className="w-full ">
        <CategoryDiscovery />
      </div>

      {/* Row 1: Shopee Live & Flash Sale */}
      <div className="px-3 mt-3 ">
        <div className="h-full">
          <FlashSale />
        </div>
      </div>

      {/* Row 2: Promo Banner + Product List (Merged) */}
      <div className="mt-2">
        <ProductList headerItem={<PromoBanner />} />
      </div>
    </div>
  )
}