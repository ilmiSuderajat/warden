"use client"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function AdminProfilePage() {
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  return (
    <div className="p-6 max-w-md mx-auto mt-10 bg-white shadow rounded-xl text-center">
      <div className="w-24 h-24 bg-indigo-100 rounded-full mx-auto mb-4 flex items-center justify-center">
        <span className="text-3xl font-bold text-indigo-600">A</span>
      </div>
      <h1 className="text-xl font-bold text-gray-800">Profil Admin Desa</h1>
      <p className="text-gray-500 text-sm mb-6">Kelola toko dan pantau transaksi</p>

      <div className="space-y-3">
        <button 
          onClick={() => router.push('/admin')}
          className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
        >
          Balik ke Dashboard
        </button>
        
        <button 
          onClick={handleLogout}
          className="w-full py-3 bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition"
        >
          Keluar (Logout)
        </button>
      </div>
    </div>
  )
}