import { createServerClient } from "@supabase/ssr"
import { NextRequest, NextResponse } from "next/server"

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const { pathname } = req.nextUrl

  if (!pathname.startsWith("/admin")) return res

  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { session } } = await supabaseAuth.auth.getSession()

  console.log("[Middleware] Path:", pathname)
  console.log("[Middleware] Session exists:", !!session)

  if (!session) {
    console.log("[Middleware] No session, redirecting to /login")
    return NextResponse.redirect(new URL("/login", req.url))
  }

  const supabaseAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => { } } }
  )

  console.log("[Middleware] Verifying admin for:", session.user.email, "(ID:", session.user.id, ")")

  // 1. Cek di tabel 'admins' lewat email (case-insensitive)
  const { data: adminByEmail, error: errorEmail } = session.user.email
    ? await supabaseAdmin
      .from("admins")
      .select("id")
      .ilike("email", session.user.email)
      .maybeSingle()
    : { data: null, error: null }
  if (errorEmail) console.error("[Middleware] AdminEmail Error:", errorEmail)

  // 2. Cek di tabel 'admins' lewat user_id
  const { data: adminById, error: errorId } = await supabaseAdmin
    .from("admins")
    .select("id")
    .eq("user_id", session.user.id)
    .maybeSingle()
  if (errorId) console.error("[Middleware] AdminId Error:", errorId)

  // 3. Cek di tabel 'users' (kolom role)
  const { data: userRecord, error: errorRole } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle()
  if (errorRole) console.error("[Middleware] UserRole Error:", errorRole)

  const isAdmin = !!adminByEmail || !!adminById || userRecord?.role === "admin"
  console.log("[Middleware] Check Results - AdminEmail:", !!adminByEmail, "AdminId:", !!adminById, "UserRole:", userRecord?.role)
  console.log("[Middleware] Final isAdmin:", isAdmin)

  if (!isAdmin) {
    console.log("[Middleware] Not admin, redirecting to /profile")
    return NextResponse.redirect(new URL("/profile", req.url))
  }

  console.log("[Middleware] Admin verified, proceeding to", pathname)
  return res
}

export const config = {
  matcher: ["/admin/:path*"],
}