"use client"
import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import * as LucideIcons from "lucide-react"
import Link from "next/link"
import { motion } from "framer-motion"

interface Category {
  id: string
  name: string
  icon_name: string
  color_theme: string | null
}

interface CategoryItemProps {
  href: string
  icon: React.ReactNode
  label: string
  index: number
  colorTheme?: string | null
}

export default function CategoryDiscovery() {
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isMounted, setIsMounted] = useState(false)
  const [scrollPosition, setScrollPosition] = useState(0)

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsMounted(true)
    const fetchCategories = async () => {
      try {
        const { data } = await supabase
          .from("categories")
          .select("id, name, icon_name, color_theme")
          .order("created_at", { ascending: true })
        if (data) setCategories(data)
      } catch (error) {
        console.error("Error fetching categories:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchCategories()
  }, [])

  // Handle scroll position untuk indikator
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return
    const scrollWidth = scrollRef.current.scrollWidth - scrollRef.current.clientWidth
    const scrollLeft = scrollRef.current.scrollLeft
    const progress = scrollWidth > 0 ? scrollLeft / scrollWidth : 0
    setScrollPosition(progress * 100)
  }

  if (isLoading) return null

  return (
    <section className="bg-white py-4 w-[95%] h-27 rounded-xl mx-auto border-b border-gray-100">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto flex-nowrap gap-x-2 no-scrollbar scroll-smooth"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {categories.map((item, i) => {
          const Icon = (LucideIcons as any)[item.icon_name] || LucideIcons.Package
          return (
            <div key={item.id} className="flex-shrink-0 w-[72px]">
              <CategoryItem
                href={`/category?id=${item.id}`}
                index={i}
                icon={<Icon className="w-6 h-6" />}
                label={item.name}
                colorTheme={item.color_theme}
              />
            </div>
          )
        })}
      </div>

      {/* Indikator scroll - hanya render jika mounted dan ada categories */}
      {isMounted && categories.length > 0 && (
        <div className="flex justify-center">
          <div className="w-8 h-1 bg-gray-100 rounded-full relative overflow-hidden">
            <motion.div
              layoutId="scroll-indicator"
              initial={{ width: 0 }}
              animate={{
                x: `${scrollPosition}%`,
                width: 16
              }}
              transition={{ type: "tween", duration: 0.2 }}
              className="absolute top-0 left-0 h-full bg-orange-500 rounded-full"
            />
          </div>
        </div>
      )}
    </section>
  )
}

function CategoryItem({ href, icon, label, index, colorTheme }: CategoryItemProps) {
  // Default color if colorTheme is missing (using a soft gradient as default)
  const bgClass = colorTheme ? `bg-linear-to-br ${colorTheme}` : "bg-linear-to-br from-indigo-500 to-indigo-600"

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.02, duration: 0.3 }}
      viewport={{ once: true }}
    >
      <Link
        href={href}
        className="flex flex-col items-center group active:opacity-70 transition-opacity"
      >
        <div className={`w-12 h-12 ${bgClass} rounded-2xl flex items-center justify-center shadow-xs transition-transform group-active:scale-90 text-white ring-1 ring-black/5`}>
          {icon}
        </div>
        <span className="mt-1.5 text-slate-700 text-[10px] text-center font-medium leading-[1.1] h-7 flex items-start justify-center px-1 overflow-hidden line-clamp-2">
          {label}
        </span>
      </Link>
    </motion.div>
  )
}