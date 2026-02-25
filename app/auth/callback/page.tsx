"use client"
import { useEffect } from "react"
import { supabase } from "@/lib/supabase"

export default function Callback() {

  useEffect(() => {
    const syncUser = async () => {
      const { data } = await supabase.auth.getUser()

      if (data.user) {
        await supabase.from("users").upsert({
          id: data.user.id,
          name: data.user.user_metadata.full_name,
          role: "user"
        })

        window.location.href = "/role/user"
      }
    }

    syncUser()
  }, [])

  return <p>Loading...</p>
}