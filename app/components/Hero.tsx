"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import * as LucideIcons from "lucide-react"

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
    <div className="max-w-md mx-auto mt-16 py-4">
      <div className="grid grid-cols-5 gap-y-4 text-center text-xs font-bold">
        {categories.map((item, i) => {
          // Mengambil icon secara dinamis berdasarkan nama di database
          const Icon = (LucideIcons as any)[item.icon_name] || LucideIcons.Package
          
          return (
            <div key={item.id} className="flex flex-col items-center">
              <div className={`w-12 h-12 bg-linear-to-br ${item.color_theme} rounded-full flex items-center justify-center shadow-sm`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <span className="mt-1 text-gray-700 text-[10px] leading-tight">{item.name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}