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

        // Bypass RLS for users table
        const { supabaseAdmin } = await import('@/lib/driverOrders')

        const body = await req.json()
        const updates: any = {}
        
        if (typeof body.is_online === 'boolean') updates.is_online = body.is_online
        if (typeof body.is_auto_accept === 'boolean') updates.is_auto_accept = body.is_auto_accept

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
        }

        const { error } = await supabaseAdmin
            .from("users")
            .update(updates)
            .eq("id", session.user.id)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (e: any) {
        console.error("Settings update error:", e)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}
