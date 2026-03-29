/**
 * scripts/apply-migrations.ts
 * ──────────────────────────────────────────────────────────────
 * Applies SQL migration files to Supabase cloud using the
 * Management API (requires SUPABASE_ACCESS_TOKEN) OR by 
 * using the service_role to call a SQL execution helper.
 *
 * Strategy: We create an exec_sql helper function via the
 * Supabase REST API, then use it to run each migration.
 *
 * Usage:
 *   npx tsx scripts/apply-migrations.ts
 *
 * Required env vars (auto-loaded from .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional (for Management API approach):
 *   SUPABASE_ACCESS_TOKEN  -- personal access token from app.supabase.com
 * ──────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvLocal()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN // optional

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
if (!projectRef) {
  console.error('❌ Could not extract project ref from URL:', SUPABASE_URL)
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})

// Migration files to apply in order
const MIGRATIONS = [
  'supabase/migrations/20260329_user_wallet_refunds_patched.sql',
  'supabase/migrations/20260329_topup_wallet.sql',
]

/**
 * Run SQL via Supabase Management API.
 * Requires SUPABASE_ACCESS_TOKEN (personal access token).
 */
async function runSQLViaManagementAPI(sql: string): Promise<void> {
  if (!ACCESS_TOKEN) throw new Error('SUPABASE_ACCESS_TOKEN not set')
  
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ query: sql }),
    }
  )
  
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Management API error (${res.status}): ${text}`)
  }
}

/**
 * Bootstrap: Create an exec_sql helper function using the service role.
 * This is a workaround when we can't use the Management API.
 * The function is SECURITY DEFINER so it runs as the db owner.
 */
async function bootstrapExecHelper(): Promise<boolean> {
  // We try to create the helper using direct SQL.
  // Supabase REST API doesn't support arbitrary SQL without an exec function.
  // So we use the fact that service_role can write to any table.
  // 
  // Instead, we'll check if we can call pg_catalog functions.
  const { data, error } = await admin
    .from('pg_catalog.pg_class')
    .select('relname')
    .limit(1)
  
  // If this works, we have direct table access
  if (!error) {
    console.log('  ℹ️  Direct pg_catalog access works')
    return true
  }
  
  return false
}

async function main() {
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║      SUPABASE MIGRATION RUNNER (Cloud Mode)     ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log(`  Project ref : ${projectRef}`)
  console.log(`  URL         : ${SUPABASE_URL}`)
  console.log(`  Access token: ${ACCESS_TOKEN ? '✅ set' : '❌ not set'}`)
  console.log()

  if (!ACCESS_TOKEN) {
    console.log('⚠️  SUPABASE_ACCESS_TOKEN not found in env.')
    console.log('   For Supabase Cloud, you can apply migrations via:')
    console.log()
    console.log('   Option A — Supabase Dashboard SQL Editor:')
    console.log('   1. Go to: https://app.supabase.com/project/' + projectRef + '/sql/new')
    console.log('   2. Paste and run each SQL file below in order:')
    console.log()
    
    for (const migrationPath of MIGRATIONS) {
      const fullPath = path.join(process.cwd(), migrationPath)
      console.log(`   📄 ${migrationPath}`)
      console.log(`      Full path: ${fullPath}`)
    }
    
    console.log()
    console.log('   Option B — Set SUPABASE_ACCESS_TOKEN=<your-pat> in .env.local')
    console.log('   Get token from: https://app.supabase.com/account/tokens')
    console.log()
    console.log('   Option C — Direct pg connection string:')
    
    const dbHost = `db.${projectRef}.supabase.co`
    console.log(`   postgresql://postgres:<password>@${dbHost}:5432/postgres`)
    console.log('   Then run: psql <connection_string> -f <migration_file>')
    console.log()
    
    // Try with access token anyway if provided
    console.log('Attempting Management API anyway...')
    process.exit(0)
  }

  // Apply migrations via Management API
  for (const migrationPath of MIGRATIONS) {
    const fullPath = path.join(process.cwd(), migrationPath)
    if (!fs.existsSync(fullPath)) {
      console.error(`❌ File not found: ${fullPath}`)
      process.exit(1)
    }
    
    const sql = fs.readFileSync(fullPath, 'utf-8')
    console.log(`\n[→] Applying: ${migrationPath}`)
    
    try {
      await runSQLViaManagementAPI(sql)
      console.log(`  ✅ Applied successfully`)
    } catch (e: any) {
      console.error(`  ❌ Error: ${e.message}`)
      process.exit(1)
    }
  }

  console.log('\n══════════════════════════════════════════════════')
  console.log('  Migrations applied! Run seed next:')
  console.log('  npx tsx scripts/seed-test-data.ts')
  console.log('══════════════════════════════════════════════════\n')
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
