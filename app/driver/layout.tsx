"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const router = useRouter()

  useEffect(() => {
    let mounted = true
    const checkDriver = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        if (mounted) router.replace("/login")
        return
      }

      // Allow either driver role or admin role 
      const { data: userRecord } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle()
        
      const { data: adminRecord } = await supabase
        .from("admins")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle()

      const isDriver = userRecord?.role === "driver" || userRecord?.role === "admin" || adminRecord

      if (!isDriver) {
        if (mounted) router.replace("/profile")
        return
      }

      if (mounted) setIsAuthorized(true)
    }

    checkDriver()

    return () => {
      mounted = false
    }
  }, [router])

  if (isAuthorized === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-3 max-w-md mx-auto">
        <Loader2 className="animate-spin text-slate-400" size={28} />
        <p className="text-xs font-medium text-slate-400">Verifikasi akses driver...</p>
      </div>
    )
  }

  return <>{children}</>
}
