/**
 * scripts/debug-orders-schema.ts
 * Checks the schema of the orders table and tries a minimal insert.
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

async function main() {
  // Get a list of users to find a valid user_id
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1 })
  const userId = users?.users?.[0]?.id
  console.log('Using user_id:', userId)

  if (!userId) {
    console.error('No users found!')
    process.exit(1)
  }

  // Try minimal insert
  const { data, error } = await admin
    .from('orders')
    .insert({
      user_id: userId,
      total_amount: 100000,
      status: 'Menunggu Pembayaran',
      payment_status: null,
      is_refunded: false,
    })
    .select('*')
    .single()

  if (error) {
    console.error('Insert error:', error.message)
    console.error('Full error:', JSON.stringify(error, null, 2))
    
    // Check table info
    const { data: sample, error: e2 } = await admin
      .from('orders')
      .select('*')
      .limit(1)
    
    if (sample && sample.length > 0) {
      console.log('\nSample order columns:', Object.keys(sample[0]))
    } else if (e2) {
      console.error('Cannot read orders:', e2.message)
    } else {
      console.log('orders table is empty')
    }
    
    process.exit(1)
  }

  console.log('✅ Order created:', data)
  console.log('Columns:', Object.keys(data))
  
  // Cleanup
  await admin.from('orders').delete().eq('id', data.id)
  console.log('✅ Cleanup done')
}

main().catch(e => { console.error('Fatal:', e); process.exit(1) })
