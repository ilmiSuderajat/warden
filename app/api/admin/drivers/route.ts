import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Verify the caller is an admin (mirrors app/admin/layout.tsx logic)
async function verifyAdmin() {
    const cookieStore = await cookies()
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null

    // Check admins table
    const { data: adminRecord } = await supabase
        .from("admins")
        .select("id")
        .or(`user_id.eq.${session.user.id},email.eq.${session.user.email}`)
        .maybeSingle()

    // Check users.role
    const { data: userRecord } = await supabase
        .from("users")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle() as { data: any }

    const isAdmin = adminRecord || userRecord?.role === "admin"
    return isAdmin ? session : null
}

// POST: assign or revoke driver role
export async function POST(req: Request) {
    const session = await verifyAdmin()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { userId, action } = await req.json()
    if (!userId || !["assign", "revoke"].includes(action)) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const updates: any =
        action === "assign"
            ? { role: "driver", is_online: false, is_auto_accept: false }
            : { role: "customer" }

    const { error } = await supabaseAdmin.from("users").update(updates).eq("id", userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
}

// PATCH: toggle driver status (is_online / is_auto_accept)
export async function PATCH(req: Request) {
    const session = await verifyAdmin()
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { userId, field, value } = await req.json()
    if (!userId || !["is_online", "is_auto_accept"].includes(field)) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const { error } = await supabaseAdmin.from("users").update({ [field]: value }).eq("id", userId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
}
