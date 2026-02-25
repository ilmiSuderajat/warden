"use client"
import { supabase } from "@/lib/supabase"

export default function LoginPage() {

  const loginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000/auth/callback"
      }
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <button
        onClick={loginWithGoogle}
        className="px-6 py-3 bg-white border rounded-xl shadow-sm hover:shadow-md transition"
      >
        Login dengan Google
      </button>
    </div>
  )
}