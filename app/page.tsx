import Hero from "./components/Hero";
import Banner from "./components/Banner";
import ProductList from "./components/ProductList";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100 max-w-md mx-auto">
      <Hero />
      <div className="flex justify-center my-3">
  <div className="w-8 h-1 bg-red-500 rounded-full"></div>
</div>
      <Banner />
      <ProductList />
    </div>
  );
}