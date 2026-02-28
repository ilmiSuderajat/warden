"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      console.log("[Login Page] Initial session check:", !!session)
      if (session) {
        console.log("[Login Page] Session found, redirecting to /api/auth/redirect")
        router.replace("/api/auth/redirect")
      }
    }
    checkSession()

    // 1. Definisikan callback global untuk menangkap token dari Android native
    window.onNativeGoogleLogin = async (idToken: string) => {
      console.log("[Login Page] Received native idToken, signing in to Supabase...")
      setLoading(true)
      try {
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
        })

        if (error) throw error

        console.log("[Login Page] Native sign in success:", !!data.session)
        router.replace("/api/auth/redirect")
      } catch (err) {
        console.error("[Login Page] Native sign in error:", err)
        setLoading(false)
      }
    }

    // Cleanup callback saat unmount
    return () => {
      delete window.onNativeGoogleLogin
    }
  }, [router])

  const handleGoogleLogin = async () => {
    console.log("[Login Page] Starting Google Login...")

    // 2. Cek apakah dibuka di dalam Android App dengan Bridge
    if (window.AndroidBridge) {
      console.log("[Login Page] AndroidBridge detected, calling native login...")
      window.AndroidBridge.loginWithGoogle()
      return
    }

    setLoading(true)
    try {
      const isApp = navigator.userAgent.includes("WardenApp")
      console.log("[Login Page] Is App (WardenApp):", isApp)

      // URL redirect untuk Webview (Custom Scheme) atau Browser (Web URL)
      const redirectUrl = isApp
        ? 'warden-app://auth-callback'
        : `${window.location.origin}/auth/callback`

      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })
    } catch (error) {
      console.error("Login error:", error)
      setLoading(false) // Hanya set false jika error, karena jika sukses akan redirect
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 max-w-md mx-auto font-sans">

      {/* BRAND SECTION */}
      <div className="flex flex-col items-center mb-10">
        {/* Logo Icon dengan efek glow halus */}
        <div className="relative mb-5">
          <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 rounded-full scale-150" />
          <div className="relative bg-indigo-600 w-20 h-20 rounded-3xl flex items-center justify-center shadow-lg border border-indigo-500">
            <Icons.Fingerprint className="text-white" size={36} strokeWidth={1.5} />
          </div>
        </div>

        {/* Brand Name */}
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">WARDEN</h1>
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.2em] mt-1.5">
          Single Sign On
        </p>
      </div>

      {/* LOGIN BUTTON */}
      <div className="w-full">
        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 p-4 rounded-2xl shadow-sm active:scale-[0.98] transition-all group disabled:opacity-70 hover:border-slate-300"
        >
          {loading ? (
            <Icons.Loader2 className="animate-spin text-indigo-600" size={20} />
          ) : (
            <>
              {/* Google Official SVG Icon (Tidak perlu load gambar external) */}
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900">
                Masuk dengan Google
              </span>
            </>
          )}
        </button>
      </div>

      {/* INFO SECTION */}
      <div className="mt-8 w-full bg-white border border-slate-200 rounded-2xl p-4 text-center">
        <p className="text-xs text-slate-500 leading-relaxed">
          Sistem akan otomatis mendeteksi akses <span className="font-bold text-slate-700">Admin</span> atau <span className="font-bold text-slate-700">User</span> berdasarkan email terdaftar.
        </p>
      </div>

      {/* FOOTER TEXT */}
      <p className="mt-8 text-[10px] text-slate-400 text-center">
        Dengan masuk, kamu menyetujui <span className="font-semibold text-slate-500">Ketentuan Layanan</span> kami.
      </p>

    </div>
  )
}