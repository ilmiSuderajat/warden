"use client"

import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import * as Icons from "lucide-react"

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleGoogleLogin = async () => {
    setLoading(true)
    
    // 1. Panggil Google OAuth
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Redirect ke halaman khusus buat ngecek role
        redirectTo: `${window.location.origin}/auth/callback`, 
      },
    })

    if (error) {
      alert("Gagal Login: " + error.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 font-sans max-w-md mx-auto">
      <div className="text-center mb-12">
        <div className="bg-indigo-600 w-20 h-20 rounded-[2.5rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-indigo-200">
          <Icons.Fingerprint className="text-white" size={40} />
        </div>
        <h1 className="text-3xl font-black text-gray-900 tracking-tighter italic">WARDEN</h1>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-2">Satu Akun Untuk Semua, Lur!</p>
      </div>

      <button 
        onClick={handleGoogleLogin}
        disabled={loading}
        className="w-full flex items-center justify-center gap-4 bg-white border-2 border-gray-100 p-5 rounded-4xl shadow-xl shadow-gray-100 active:scale-95 transition-all group hover:border-indigo-500 disabled:opacity-50"
      >
        {loading ? (
          <Icons.Loader2 className="animate-spin text-indigo-600" size={20} />
        ) : (
          <>
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
            <span className="text-xs font-black uppercase tracking-widest text-gray-700 group-hover:text-indigo-600">Masuk dengan Google</span>
          </>
        )}
      </button>

      <div className="mt-12 p-6 bg-gray-50 rounded-4xl w-full border border-gray-100">
         <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest leading-loose text-center">
            Sistem akan otomatis mendeteksi akses Admin atau User biasa berdasarkan email kamu.
         </p>
      </div>
    </div>
  )
}