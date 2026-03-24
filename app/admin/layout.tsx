"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const router = useRouter()

  useEffect(() => {
    let mounted = true
    const checkAdmin = async () => {
      // Tunggu session supabase ter-load dengan getUser yang memverifikasi di server
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        if (mounted) router.replace("/login")
        return
      }

      // Pastikan role diset admin di tabel 'admins' atau tabel 'users'
      const { data: adminRecord } = await supabase
        .from("admins")
        .select("id")
        .or(`user_id.eq.${user.id},email.eq.${user.email}`)
        .maybeSingle()

      const { data: userRecord } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle()

      const isAdmin = adminRecord || userRecord?.role === "admin"

      if (!isAdmin) {
        if (mounted) router.replace("/profile")
        return
      }

      if (mounted) setIsAuthorized(true)
    }

    checkAdmin()

    return () => {
      mounted = false
    }
  }, [router])

  // Tampilkan loading yang elegan sembari menunggu
  if (isAuthorized === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3 max-w-md mx-auto">
        <Loader2 className="animate-spin text-slate-400" size={28} />
        <p className="text-xs font-medium text-slate-400">Verifikasi akses admin...</p>
      </div>
    )
  }

  return <>{children}</>
}
