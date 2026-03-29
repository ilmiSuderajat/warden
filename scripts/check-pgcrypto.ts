/**
 * scripts/check-pgcrypto.ts
 * Checks if pgcrypto is installed and tests digest function.
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

function loadEnv(f: string) {
  const p = path.join(process.cwd(), f)
  if (!fs.existsSync(p)) return false
  for (const line of fs.readFileSync(p, 'utf-8').split('\n')) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue
    const idx = t.indexOf('='); if (idx === -1) continue
    const k = t.slice(0, idx).trim(), v = t.slice(idx + 1).trim()
    if (!process.env[k]) process.env[k] = v
  }
  return true
}
loadEnv('.env.test') || loadEnv('.env.local')

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

async function main() {
  // Check pg_extension
  const { data: ext, error: extErr } = await admin
    .from('pg_catalog.pg_extension')
    .select('extname')
    .eq('extname', 'pgcrypto')

  if (extErr) {
    console.log('Cannot query pg_catalog.pg_extension:', extErr.message)
  } else {
    console.log('pgcrypto extension entries:', ext)
  }

  // Try calling digest directly via a test RPC
  // Use check_balance_integrity which doesn't use digest
  const { data: bal, error: balErr } = await admin.rpc('check_balance_integrity', {
    p_user_id: '00000000-0000-0000-0000-000000000000'
  })
  console.log('check_balance_integrity (no digest):', { data: bal, error: balErr?.message })

  // Try create_transaction with explicit cast — this would test if issue is type inference
  // We can't call create_transaction directly (it's internal), but we can test via process_payment

  // Check if the issue is pgcrypto not installed
  // Try to list functions containing 'digest'
  const { data: fns, error: fnErr } = await admin
    .from('pg_catalog.pg_proc')
    .select('proname, pronamespace')
    .ilike('proname', 'digest')
    .limit(10)

  if (fnErr) {
    console.log('Cannot query pg_catalog.pg_proc:', fnErr.message)
  } else {
    console.log('digest functions found:', fns?.length, fns)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
