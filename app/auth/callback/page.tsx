"use client"
import { useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const handleAuth = async () => {
      // 1. Pastikan session sudah masuk
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // 2. Cek apakah email ini ada di tabel 'admins'
        const { data: adminData } = await supabase
          .from("admins")
          .select("email")
          .eq("email", user.email)
          .single()

        if (adminData) {
          // Kalau Admin -> Lempar ke Dashboard Admin
          router.push("/admin")
        } else {
          // Kalau User Biasa -> Lempar ke Profile
          router.push("/profile")
        }
      } else {
        router.push("/login")
      }
    }

    handleAuth()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Menyortir Akses, Lur...</p>
      </div>
    </div>
  )
}