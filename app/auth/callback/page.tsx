"use client"
import { useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Tunggu sampe event-nya beneran 'SIGNED_IN'
      if (event === "SIGNED_IN" && session) {
        const user = session.user

        // 2. Cek apakah email ini ada di tabel 'admins'
        const { data: adminData, error } = await supabase
          .from("admins")
          .select("email")
          .eq("email", user.email)
          .maybeSingle() // Pake maybeSingle biar gak error kalau gak nemu

        if (adminData) {
          router.push("/admin")
        } else {
          router.push("/profile")
        }
      } else if (event === "INITIAL_SESSION" && !session) {
        // Kalau nunggu kelamaan dan tetep gak ada session, balikin ke login
        // Tapi kasih jeda dikit buat WebView
        const timeout = setTimeout(() => router.push("/login"), 3000)
        return () => clearTimeout(timeout)
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
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