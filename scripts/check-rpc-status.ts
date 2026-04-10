/**
 * scripts/check-rpc-status.ts
 * Checks whether the wallet RPC functions exist on the cloud instance.
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

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})

async function checkFunction(name: string, params: Record<string, any>) {
  const { data, error } = await admin.rpc(name, params)
  if (error) {
    const exists = !error.message.includes('function') || !error.message.includes('does not exist')
    console.log(`  ${name}: ${exists ? '✅ EXISTS (but errored as expected)' : '❌ NOT FOUND'} — ${error.message.slice(0, 80)}`)
    return exists
  }
  console.log(`  ${name}: ✅ EXISTS and returned:`, JSON.stringify(data).slice(0, 100))
  return true
}

async function checkTable(name: string) {
  const { data, error } = await admin.from(name).select('*').limit(1)
  if (error) {
    console.log(`  Table ${name}: ❌ — ${error.message.slice(0, 80)}`)
    return false
  }
  console.log(`  Table ${name}: ✅ EXISTS (${data?.length ?? 0} rows)`)
  return true
}

async function main() {
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║         CHECKING MIGRATION STATUS               ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log()

  console.log('[Tables]')
  await checkTable('wallets')
  await checkTable('transactions')
  await checkTable('audit_log')
  await checkTable('pending_refunds')
  
  console.log()
  console.log('[RPC Functions]')
  // Use a fake UUID - the function should exist but fail with "Order not found" or similar
  const fakeUUID = '00000000-0000-0000-0000-000000000000'
  await checkFunction('verify_hash_chain', { p_user_id: fakeUUID })
  await checkFunction('check_balance_integrity', { p_user_id: fakeUUID })
  await checkFunction('process_pending_refunds', {})
  await checkFunction('topup_wallet', { p_amount: -1 }) // expects "Topup amount must be..." error
  await checkFunction('process_payment', { p_order_id: fakeUUID })
  await checkFunction('cancel_order', { p_order_id: fakeUUID, p_actor: 'user', p_reason: 'test' })
  await checkFunction('refund_order', { p_order_id: fakeUUID, p_internal: true })
  await checkFunction('create_transaction', { p_user_id: fakeUUID, p_order_id: fakeUUID, p_type: 'commission', p_amount: 1000, p_description: 'Test' })
  await checkFunction('create_wallet_transaction', { p_user_id: fakeUUID, p_order_id: fakeUUID, p_type: 'commission', p_amount: 1000, p_desc: 'Test' })
  await checkFunction('distribute_commission', { p_order_id: fakeUUID })

  console.log()
  console.log('[Orders Table Columns]')
  const { data: cols, error: colsErr } = await admin
    .from('orders')
    .select('id, user_id, total_amount, status, payment_status, is_refunded, canceled_by, cancel_reason, canceled_at')
    .limit(1)
  
  if (colsErr) {
    console.log('  orders columns: ❌', colsErr.message)
  } else {
    console.log('  orders columns: ✅ All wallet-related columns exist')
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
