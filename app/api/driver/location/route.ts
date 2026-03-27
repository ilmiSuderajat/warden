import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function POST(req: Request) {
    try {
        const cookieStore = await cookies()
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
        )
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

        const { supabaseAdmin } = await import('@/lib/driverOrders')

        const body = await req.json()
        const { lat, lng } = body

        if (typeof lat !== "number" || typeof lng !== "number") {
            return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 })
        }

        // Bypass RLS 
        const { error } = await supabaseAdmin
            .from("users")
            .update({ last_lat: lat, last_lng: lng })
            .eq("id", session.user.id)

        if (error) {
            console.error("Supabase Error:", error)
            throw error;
        }

        return NextResponse.json({ success: true })
    } catch (e: any) {
        console.error("Location update error:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
