import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

function loadEnv(filename: string) {
  const envPath = path.join(process.cwd(), filename)
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    process.env[key] = val.replace(/^['"]|['"]$/g, '')
  }
}

// Load production env
loadEnv('.env.production')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function verify() {
  console.log('\n--- VERIFYING CORE FUNCTIONS ---')
  const functions = [
    'topup_wallet',
    'process_payment',
    'cancel_order',
    'refund_order',
    'verify_hash_chain',
    'check_balance_integrity'
  ]
  
  for (const fn of functions) {
    // Check if function is callable via RPC (RPC returns 404 if not found)
    const { error } = await supabase.rpc(fn, {})
    if (error && error.message.includes('module not found') || error && error.code === 'PGRST202') {
       console.log(`❌ Function NOT found: ${fn}`)
    } else {
       console.log(`✅ Function exists: ${fn}`)
    }
  }

  console.log('\n--- CHECKING BALANCE INTEGRITY (LIMIT 5) ---')
  const { data: wallets, error: wError } = await supabase.from('wallets').select('user_id').limit(5)
  if (wError) {
    console.error('Failed to fetch wallets:', wError)
    return
  }

  if (!wallets || wallets.length === 0) {
    console.log('No wallets found to check.')
  } else {
    for (const w of wallets) {
      const { data: integrity, error: iError } = await supabase.rpc('check_balance_integrity', { p_user_id: w.user_id })
      if (iError) {
        console.error(`- User ${w.user_id}: Error calling check_balance_integrity: ${iError.message}`)
      } else {
        console.log(`- User ${w.user_id}:`, integrity)
      }
    }
  }
  console.log('\n--- VERIFICATION COMPLETE ---')
}

verify()
