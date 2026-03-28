import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { createClient } from "@supabase/supabase-js"

/**
 * Creates a server-side Supabase client using SSR cookies.
 * Used for user-facing auth checks (reads session from cookie).
 */
export async function createAuthClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )
}

/**
 * Creates a server-side Supabase admin client using the service role key.
 * Bypasses RLS — use only in server-side API routes.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Verifies the current user via Supabase Auth server (NOT cookie-trusted getSession).
 * Returns the verified user or null if unauthenticated.
 */
export async function getAuthenticatedUser() {
  const client = await createAuthClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) return null
  return user
}
