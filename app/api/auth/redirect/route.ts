import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  const cookieStore = await cookies()

  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => { },
      },
    }
  )

  const { data: { session } } = await supabaseAuth.auth.getSession()

  console.log("[Auth Redirect] Session exists:", !!session)

  if (!session) {
    console.log("[Auth Redirect] No session, redirecting to /login")
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL))
  }

  const supabaseAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => { } } }
  )

  console.log("[Auth Redirect] Verifying admin for:", session.user.email, "(ID:", session.user.id, ")")

  // 1. Cek di tabel 'admins' lewat email (case-insensitive)
  const { data: adminByEmail } = session.user.email
    ? await supabaseAdmin
      .from("admins")
      .select("id")
      .ilike("email", session.user.email)
      .maybeSingle()
    : { data: null }

  // 2. Cek di tabel 'admins' lewat user_id
  const { data: adminById } = await supabaseAdmin
    .from("admins")
    .select("id")
    .eq("user_id", session.user.id)
    .maybeSingle()

  // 3. Cek di tabel 'users' (kolom role)
  const { data: userRecord } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle()

  const isAdmin = !!adminByEmail || !!adminById || userRecord?.role === "admin"
  console.log("[Auth Redirect] Check Results - AdminEmail:", !!adminByEmail, "AdminId:", !!adminById, "UserRole:", userRecord?.role)
  console.log("[Auth Redirect] Final isAdmin:", isAdmin)

  const destination = isAdmin ? "/admin" : "/profile"
  console.log("[Auth Redirect] Redirecting to:", destination)
  return NextResponse.redirect(new URL(destination, process.env.NEXT_PUBLIC_APP_URL))
}