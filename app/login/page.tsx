"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import * as Icons from "lucide-react"
import { useRouter } from "next/navigation"

import { motion, AnimatePresence } from "framer-motion"

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.replace("/api/auth/redirect")
      }
    }
    checkSession()

    window.onNativeGoogleLogin = async (idToken: string) => {
      setLoading(true)
      try {
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
        })
        if (error) throw error
        router.replace("/api/auth/redirect")
      } catch (err) {
        setLoading(false)
      }
    }

    return () => {
      delete window.onNativeGoogleLogin
    }
  }, [router])

  const handleGoogleLogin = async () => {
    if (window.AndroidBridge) {
      window.AndroidBridge.loginWithGoogle()
      return
    }

    setLoading(true)
    try {
      const isApp = navigator.userAgent.includes("WarungKitaApp")
      const redirectUrl = isApp
        ? 'warung-kita-app://auth-callback'
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
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col items-center justify-center p-6 max-w-md mx-auto font-sans" 
         style={{ background: "linear-gradient(135deg, #4f46e5 0%, #6d28d9 60%, #7c3aed 100%)" }}>
      
      {/* DECORATIVE ELEMENTS */}
      <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.4, scale: 1 }}
            transition={{ duration: 2, delay: i * 0.2, repeat: Infinity, repeatType: "reverse" }}
            className="absolute rounded-full border border-white"
            style={{
              width: `${100 + i * 40}px`,
              height: `${100 + i * 40}px`,
              top: `${(i % 3) * 30 - 20}%`,
              left: `${(i % 3) * 30 - 20}%`,
            }}
          />
        ))}
      </div>

      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative w-full flex flex-col items-center"
      >
        {/* BRAND SECTION */}
        <div className="flex flex-col items-center mb-12">
          <div className="relative mb-6">
            <motion.div 
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 6, repeat: Infinity }}
              className="relative bg-white w-24 h-24 rounded-[2.5rem] flex items-center justify-center shadow-2xl border border-white/20 backdrop-blur-xl"
            >
              <div className="w-20 h-20 bg-indigo-50 rounded-[2rem] flex items-center justify-center overflow-hidden">
                <Icons.Store className="text-indigo-600" size={40} strokeWidth={2.5} />
              </div>
            </motion.div>
            <div className="absolute -bottom-2 -right-2 bg-yellow-400 w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
              <Icons.Sparkles className="text-yellow-900" size={14} />
            </div>
          </div>

          <h1 className="text-4xl font-black text-white tracking-tight mb-2">
            WARUNG <span className="text-yellow-300 italic">KITA</span>
          </h1>
          <div className="h-1 w-12 bg-yellow-400 rounded-full mb-4" />
          <p className="text-indigo-100 text-sm font-medium text-center max-w-[240px] leading-relaxed">
            Satu ketukan untuk mengelola semua kebutuhan tokomu
          </p>
        </div>

        {/* LOGIN CARD */}
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="w-full bg-white/10 backdrop-blur-2xl border border-white/20 p-8 rounded-[3rem] shadow-2xl relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Icons.Fingerprint size={80} className="text-white" />
          </div>

          <div className="relative z-10">
            <h2 className="text-xl font-bold text-white mb-8 text-center">Selamat Datang Kembali</h2>
            
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-4 bg-white text-indigo-900 p-4 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] active:scale-[0.97] transition-all disabled:opacity-70 font-bold text-sm tracking-tight hover:shadow-xl hover:-translate-y-0.5"
            >
              {loading ? (
                <Icons.Loader2 className="animate-spin text-indigo-600" size={20} />
              ) : (
                <>
                  <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  <span>Masuk dengan Google</span>
                </>
              )}
            </button>

            <div className="mt-8 flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 w-full text-white/30">
                <div className="h-[1px] bg-current flex-1" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Akses Cepat</span>
                <div className="h-[1px] bg-current flex-1" />
              </div>
              
              <div className="bg-indigo-500/20 rounded-2xl p-4 border border-white/5 w-full">
                <p className="text-[11px] text-indigo-100 text-center leading-relaxed font-medium">
                  Masuk sebagai <span className="text-yellow-300 font-bold">Admin</span>, <span className="text-yellow-300 font-bold">Mitra</span> atau <span className="text-yellow-300 font-bold">User</span> dalam satu akun terintegrasi.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* FOOTER */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center"
        >
          <div className="flex items-center justify-center gap-4 mb-4">
            <span className="text-[10px] text-indigo-200/50 font-bold uppercase tracking-widest cursor-pointer hover:text-white transition-colors">Bantuan</span>
            <div className="w-1 h-1 rounded-full bg-white/20" />
            <span className="text-[10px] text-indigo-200/50 font-bold uppercase tracking-widest cursor-pointer hover:text-white transition-colors">Kebijakan</span>
            <div className="w-1 h-1 rounded-full bg-white/20" />
            <span className="text-[10px] text-indigo-200/50 font-bold uppercase tracking-widest cursor-pointer hover:text-white transition-colors">Syarat</span>
          </div>
          <p className="text-[10px] text-indigo-300/40 font-medium">
            Powered by Warden Engine v1.0.4. Protected by SSL.
          </p>
        </motion.div>
      </motion.div>

      {/* BOTTOM BLUR DECOR */}
      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-indigo-400/20 blur-3xl rounded-full" />
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-purple-400/20 blur-3xl rounded-full" />
    </div>
  )
}