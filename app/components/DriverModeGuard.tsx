"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

/**
 * Checks localStorage on mount.
 * If "warden_mode" === "driver", redirects to /driver immediately.
 * This persists driver mode across page refreshes.
 */
export default function DriverModeGuard() {
    const router = useRouter()

    useEffect(() => {
        const mode = localStorage.getItem("warden_mode")
        if (mode === "driver") {
            router.replace("/driver")
        }
    }, [router])

    return null
}
