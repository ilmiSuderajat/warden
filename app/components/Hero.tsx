"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import * as LucideIcons from "lucide-react"
import Link from "next/link" // Import Link agar bisa pindah halaman

export default function Hero() {
  const [categories, setCategories] = useState<any[]>([])

  useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await supabase.from("categories").select("*")
      if (data) setCategories(data)
    }
    fetchCategories()
  }, [])

  return (
    <div className="max-w-md bg-gray-50 mx-auto mt-16 py-4 px-2">
      <div className="grid grid-cols-5 gap-y-4 text-center text-xs font-bold">
        {categories.map((item) => {
          // Mengambil icon secara dinamis berdasarkan nama di database
          const Icon = (LucideIcons as any)[item.icon_name] || LucideIcons.Package
          
          return (
            // Gunakan Link dan arahkan ke path kategori berdasarkan ID atau slug
            <Link 
              href={`/category/${item.id}`} 
              key={item.id} 
              className="flex flex-col items-center group active:scale-90 transition-transform"
            >
              <div className={`w-12 h-12 bg-linear-to-br ${item.color_theme || 'from-orange-400 to-orange-600'} rounded-full flex items-center justify-center shadow-md group-hover:shadow-lg transition-all`}>
                <Icon className="w-6 h-6 text-white" strokeWidth={2.5} />
              </div>
              <span className="mt-1.5 text-gray-700 text-[10px] ">
                {item.name}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}