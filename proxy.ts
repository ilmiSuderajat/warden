import { createServerClient } from "@supabase/ssr"
import { NextRequest, NextResponse } from "next/server"

export async function proxy(req: NextRequest) {
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

  const {
    data: { session },
  } = await supabaseAuth.auth.getSession()

  console.log("[Proxy] Path:", pathname)
  console.log("[Proxy] Session exists:", !!session)

  if (!session) {
    console.log("[Proxy] No session, redirecting to /login")
    return NextResponse.redirect(new URL("/login", req.url))
  }

  const supabaseAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  )

  console.log(
    "[Proxy] Verifying admin for:",
    session.user.email,
    "(ID:",
    session.user.id,
    ")"
  )

  const { data: adminByEmail, error: errorEmail } = session.user.email
    ? await supabaseAdmin
        .from("admins")
        .select("id")
        .ilike("email", session.user.email)
        .maybeSingle()
    : { data: null, error: null }
  if (errorEmail) console.error("[Proxy] AdminEmail Error:", errorEmail)

  const { data: adminById, error: errorId } = await supabaseAdmin
    .from("admins")
    .select("id")
    .eq("user_id", session.user.id)
    .maybeSingle()
  if (errorId) console.error("[Proxy] AdminId Error:", errorId)

  const { data: userRecord, error: errorRole } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("id", session.user.id)
    .maybeSingle()
  if (errorRole) console.error("[Proxy] UserRole Error:", errorRole)

  const isAdmin = !!adminByEmail || !!adminById || userRecord?.role === "admin"
  console.log(
    "[Proxy] Check Results - AdminEmail:",
    !!adminByEmail,
    "AdminId:",
    !!adminById,
    "UserRole:",
    userRecord?.role
  )
  console.log("[Proxy] Final isAdmin:", isAdmin)

  if (!isAdmin) {
    console.log("[Proxy] Not admin, redirecting to /profile")
    return NextResponse.redirect(new URL("/profile", req.url))
  }

  console.log("[Proxy] Admin verified, proceeding to", pathname)
  return res
}

export const config = {
  matcher: ["/admin/:path*"],
}
