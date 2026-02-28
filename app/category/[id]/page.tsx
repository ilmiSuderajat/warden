"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import * as Icons from "lucide-react";
import Link from "next/link";

function CategoryContent() {
  const params = useParams();
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategoryData = async () => {
      if (!params.id) return;
      setLoading(true);

      try {
        // 1. Ambil Nama Kategori biar Header-nya bener
        const { data: catData } = await supabase
          .from("categories")
          .select("name")
          .eq("id", params.id)
          .maybeSingle();

        if (catData) setCategoryName(catData.name);

        // 2. Ambil Produk lewat tabel junction 'product_categories'
        const { data: pivotData, error } = await supabase
          .from("product_categories")
          .select(`
            products (*)
          `)
          .eq("category_id", params.id);

        if (!error && pivotData) {
          // Kita bersihkan datanya biar gampang di-map
          const flattened = pivotData.map((item: any) => item.products).filter(p => p !== null);
          setProducts(flattened);
        }
      } catch (err) {
        console.error("Error fetching category products:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCategoryData();
  }, [params.id]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      {/* HEADER NAVBAR FIXED */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-4 max-w-md mx-auto flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 rounded-full active:scale-90 transition-all text-gray-800"
        >
          <Icons.ArrowLeft size={20} />
        </button>
        <div className="flex flex-col">
          <h1 className="text-[10px] font-black text-orange-500 uppercase tracking-widest leading-none">Kategori</h1>
          <h2 className="text-sm font-bold text-gray-900 truncate">{loading ? "Memuat..." : categoryName}</h2>
        </div>
      </div>

      {/* CONTENT AREA */}
      <div className="pt-20 px-3 max-w-md mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 opacity-20">
            <Icons.Loader2 size={32} className="animate-spin text-orange-500 mb-2" />
            <span className="text-[10px] font-black uppercase tracking-tighter">Nyiapin Barang...</span>
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {products.map((p) => {
              const price = p.price || 0;
              const original = p.original_price || 0;
              const discount = original > price ? Math.round(((original - price) / original) * 100) : 0;
              // Ambil foto pertama dari array atau string tunggal
              const imgUrl = Array.isArray(p.image_url) ? p.image_url[0] : p.image_url;

              return (
                <Link
                  href={`/product/${p.id}`}
                  key={p.id}
                  className="bg-white  overflow-hidden border border-gray-100 shadow-sm flex flex-col active:scale-95 transition-all"
                >
                  <div className="aspect-square relative bg-gray-50">
                    {imgUrl ? (
                      <img src={imgUrl} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Icons.ImageOff size={24} className="text-gray-200" /></div>
                    )}
                    {discount > 0 && (
                      <span className="absolute top-2 left-2 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-lg shadow-sm">-{discount}%</span>
                    )}
                  </div>
                  <div className="p-3 flex flex-col justify-between flex-1">
                    <div>
                      <h3 className="text-[11px] font-bold text-gray-800 line-clamp-2 leading-tight mb-1">{p.name}</h3>
                      <p className="text-orange-600 font-black text-sm">Rp {price.toLocaleString('id-ID')}</p>
                    </div>
                    <div className="mt-2 flex items-center gap-1 opacity-50">
                      <Icons.MapPin size={8} className="text-orange-500" />
                      <span className="text-[9px] font-bold truncate">{p.location || "Lokasi Toko"}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-[2.5rem] shadow-sm border border-gray-100 flex flex-col items-center">
            <div className="bg-gray-50 p-6 rounded-full mb-4 text-gray-200">
              <Icons.ShoppingBag size={48} />
            </div>
            <p className="text-gray-400 text-xs font-bold px-12">Waduh Lur, kategori <span className="text-orange-500">"{categoryName}"</span> ini stoknya lagi kosong.</p>
            <button
              onClick={() => router.push('/')}
              className="mt-6 text-[10px] font-black uppercase tracking-widest text-orange-500 border-b-2 border-orange-500 pb-1"
            >
              Cari Produk Lain
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Wrapper buat handle Next.js client-side
export default function CategoryPage() {
  return (
    <Suspense fallback={<div className="p-20 text-center text-xs font-black uppercase opacity-20">Memuat Halaman...</div>}>
      <CategoryContent />
    </Suspense>
  );
}