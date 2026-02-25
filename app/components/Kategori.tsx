"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"

export default function AdminAddCategory() {
  const [name, setName] = useState("")
  const [icon, setIcon] = useState("Package")
  const [color, setColor] = useState("from-orange-300 to-orange-400")
  const [loading, setLoading] = useState(false)

  const availableIcons = [
    "Package", "Soup", "Utensils", "Shirt", "Gem", 
    "Gift", "ShoppingBag", "Coffee", "Apple", "Leaf",
    "Fish", "Store", "Baby", "Smartphone", "Wrench"
  ]

  const availableColors = [
    { name: "Orange Sun", class: "from-orange-300 to-orange-400" },
    { name: "Indigo Night", class: "from-indigo-400 to-indigo-600" },
    { name: "Emerald", class: "from-emerald-400 to-emerald-500" },
    { name: "Rose", class: "from-rose-400 to-rose-500" },
    { name: "Sky Blue", class: "from-sky-400 to-blue-500" },
    { name: "Violet", class: "from-violet-400 to-purple-500" },
    { name: "Amber", class: "from-amber-300 to-amber-500" },
    { name: "Slate", class: "from-slate-400 to-slate-600" },
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
      setColor("from-orange-300 to-orange-400")
    }
  }

  return (
    <div className="p-8 max-w-md mx-auto bg-white rounded-2xl shadow-lg mt-12 border border-gray-200 mb-20">
      
      <h1 className="text-2xl font-semibold mb-8 text-gray-900 tracking-tight text-center">
        Tambah Kategori
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Nama Kategori */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">
            Nama Kategori
          </label>
          <input 
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Ketik nama kategori..."
            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl 
            focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 
            transition text-sm font-medium text-gray-800"
          />
        </div>

        {/* Color Picker */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-3">
            Pilih Warna Tema
          </label>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {availableColors.map((c) => (
              <button
                key={c.class}
                type="button"
                onClick={() => setColor(c.class)}
                className={`w-10 h-10 rounded-full shrink-0 bg-linear-to-br ${c.class} transition-all ${
                  color === c.class
                    ? "ring-4 ring-offset-2 ring-indigo-500 scale-105"
                    : "opacity-70 hover:opacity-100"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Icon Picker */}
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-3">
            Pilih Ikon
          </label>
          <div className="grid grid-cols-5 gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
            {availableIcons.map((iconName) => {
              const IconComponent = (Icons as any)[iconName]
              return (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => setIcon(iconName)}
                  className={`p-3 rounded-lg flex items-center justify-center transition-all ${
                    icon === iconName
                      ? "bg-white text-indigo-600 shadow-md scale-105"
                      : "text-gray-400 hover:text-indigo-500"
                  }`}
                >
                  <IconComponent size={20} />
                </button>
              )
            })}
          </div>
        </div>

        {/* Preview */}
        <div className="p-5 rounded-xl border border-dashed border-gray-300 flex items-center gap-4">
          <div className={`w-14 h-14 bg-linear-to-br ${color} rounded-full flex items-center justify-center shadow-md text-white`}>
            {(() => {
              const PreviewIcon = (Icons as any)[icon] || Icons.Package
              return <PreviewIcon size={26} />
            })()}
          </div>

          <div className="flex flex-col">
            <span className="text-xs font-medium text-gray-500">
              Preview
            </span>
            <span className="text-lg font-semibold text-gray-900">
              {name || "Nama Kategori"}
            </span>
          </div>
        </div>

        {/* Submit Button */}
        <button 
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-3 rounded-xl 
          font-semibold shadow-md hover:bg-indigo-700 
          active:scale-95 transition text-sm disabled:opacity-60"
        >
          {loading ? "Menyimpan..." : "Simpan Kategori"}
        </button>

      </form>
    </div>
  )
}