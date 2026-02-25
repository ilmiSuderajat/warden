"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import Link from "next/link"

export default function AdminAddCategory() {
  const [name, setName] = useState("")
  const [icon, setIcon] = useState("Package")
  const [color, setColor] = useState("from-blue-500 to-blue-700") // default diganti lebih pro

  const [loading, setLoading] = useState(false)

  const availableIcons = [
    "Package", "Soup", "Utensils", "Shirt", "Gem",
    "Gift", "ShoppingBag", "Coffee", "Apple", "Leaf",
    "Fish", "Store", "Baby", "Smartphone", "Wrench",
    // boleh tambah lagi kalau mau: Truck, Laptop, Headphones, Book, etc.
  ]

  const availableColors = [
    { name: "Slate Professional",    class: "from-slate-500 to-slate-700" },
    { name: "Indigo Deep",           class: "from-indigo-500 to-indigo-700" },
    { name: "Blue Corporate",        class: "from-blue-500 to-blue-700" },
    { name: "Emerald Green",         class: "from-emerald-500 to-emerald-700" },
    { name: "Teal Modern",           class: "from-teal-500 to-teal-700" },
    { name: "Cyan Clean",            class: "from-cyan-500 to-cyan-600" },
    { name: "Violet Elegant",        class: "from-violet-500 to-violet-700" },
    { name: "Purple Rich",           class: "from-purple-500 to-purple-700" },
    { name: "Rose Muted",            class: "from-rose-500 to-rose-700" },
    { name: "Amber Warm Pro",        class: "from-amber-500 to-amber-700" },
    { name: "Orange Sunset",         class: "from-orange-500 to-orange-600" },
    { name: "Lime Fresh",            class: "from-lime-500 to-lime-700" },
    { name: "Gray Neutral",          class: "from-gray-600 to-gray-800" },
    { name: "Stone Sophisticated",   class: "from-stone-500 to-stone-700" },
    { name: "Zinc Premium",          class: "from-zinc-600 to-zinc-800" },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase
      .from("categories")
      .insert([{ name, icon_name: icon, color_theme: color }])

    setLoading(false)

    if (error) alert(error.message)
    else {
      alert("Kategori berhasil ditambah!")
      setName("")
      setIcon("Package")
      setColor("from-blue-500 to-blue-700") // reset ke yang baru
    }
  }

  return (
    <div className="p-8 max-w-md mx-auto bg-white rounded-2xl shadow-lg mt-12 border border-gray-200 mb-20">
      <button
        onClick={() => window.history.back()}
        className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 text-sm mb-6 transition-colors"
      >
        <Icons.ArrowLeft size={16} />
        Kembali ke Daftar Kategori
      </button>

      <h1 className="text-2xl font-bold mb-8 text-gray-900 tracking-tight text-center">
        Tambah Kategori Baru
      </h1>

      <form onSubmit={handleSubmit} className="space-y-7">

        {/* Nama Kategori */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nama Kategori
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Contoh: Elektronik, Fashion, Makanan..."
            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl 
                       focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 
                       transition text-sm text-gray-900 placeholder-gray-400"
          />
        </div>

        {/* Color Picker – lebih besar supaya nyaman diklik */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Pilih Warna Tema
          </label>
          <div className="flex flex-wrap gap-3">
            {availableColors.map((c) => (
              <button
                key={c.class}
                type="button"
                onClick={() => setColor(c.class)}
                title={c.name}
                className={`w-11 h-11 rounded-full shrink-0 bg-linear-to-br ${c.class} 
                           transition-all duration-200 shadow-sm
                           ${color === c.class
                             ? "ring-4 ring-indigo-500/40 scale-110 shadow-lg"
                             : "hover:scale-105 hover:shadow opacity-90 hover:opacity-100"
                           }`}
              />
            ))}
          </div>
          {/* Optional: tampilkan nama warna yang sedang dipilih */}
          <p className="mt-2 text-xs text-gray-500">
            Warna saat ini: <span className="font-medium text-gray-700">
              {availableColors.find(c => c.class === color)?.name || "Custom"}
            </span>
          </p>
        </div>

        {/* Icon Picker – tetap sama, tapi grid lebih rapi */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Pilih Ikon
          </label>
          <div className="grid grid-cols-6 sm:grid-cols-5 gap-3 p-4 bg-gray-50/70 rounded-xl border border-gray-200">
            {availableIcons.map((iconName) => {
              const IconComponent = (Icons as any)[iconName] ?? Icons.Package
              return (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => setIcon(iconName)}
                  title={iconName}
                  className={`p-3 rounded-lg flex items-center justify-center transition-all duration-200
                             ${icon === iconName
                               ? "bg-indigo-50 text-indigo-700 shadow-inner scale-105"
                               : "text-gray-500 hover:text-indigo-600 hover:bg-indigo-50/50"
                             }`}
                >
                  <IconComponent size={22} strokeWidth={1.8} />
                </button>
              )
            })}
          </div>
        </div>

        {/* Preview – dibuat lebih menarik */}
        <div className="p-6 rounded-2xl border border-gray-200 bg-linear-to-br from-gray-50 to-white shadow-sm flex items-center gap-5">
          <div className={`w-16 h-16 bg-linear-to-br ${color} rounded-2xl flex items-center justify-center shadow-lg text-white ring-1 ring-black/5`}>
            {(() => {
              const PreviewIcon = (Icons as any)[icon] || Icons.Package
              return <PreviewIcon size={28} strokeWidth={1.8} />
            })()}
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-medium text-gray-500 tracking-wide uppercase">
              Preview Kategori
            </span>
            <span className="text-xl font-semibold text-gray-900 mt-0.5">
              {name.trim() || "Nama Kategori"}
            </span>
          </div>
        </div>

        {/* Submit */}
        <button
          disabled={loading || !name.trim()}
          className="w-full bg-linear-to-r from-indigo-600 to-indigo-700 
                     hover:from-indigo-700 hover:to-indigo-800 
                     text-white py-3.5 rounded-xl font-semibold shadow-md 
                     hover:shadow-lg active:scale-[0.98] transition-all duration-200 
                     disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {loading ? "Menyimpan..." : "Simpan Kategori"}
        </button>

      </form>
    </div>
  )
}