"use client"
import { useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[Auth Callback] Event:", event)
      console.log("[Auth Callback] Session exists:", !!session)

      if (event === "SIGNED_IN" && session) {
        console.log("[Auth Callback] Sign in detected, redirecting to /api/auth/redirect")
        router.replace("/api/auth/redirect")  // ← hanya ini, tidak ada query admins
      } else if (event === "INITIAL_SESSION" && !session) {
        console.log("[Auth Callback] Initial session null, setting timeout to redirect to /login")
        const timeout = setTimeout(() => router.replace("/login"), 3000)
        return () => clearTimeout(timeout)
      }
    })

    return () => authListener.subscription.unsubscribe()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">
          Menyortir Akses, Lur...
        </p>
      </div>
    </div>
  )
}