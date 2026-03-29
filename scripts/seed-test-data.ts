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

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const TEST_USER_EMAIL   = `wallet-test-${Date.now()}@seed.local`

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
})

const REQUIRED_ORDER_FIELDS = {
  customer_name:    'Test User Seed',
  whatsapp_number:  '08123456789',
  phone_number:     '08123456789',
  address:          'Jl. Test Seed No.1',
  shipping_address: 'Jl. Test Seed No.1',
  maps_link:        'https://maps.google.com/?q=-6.2,106.8',
  latitude:         -6.2,
  longitude:        106.8,
  subtotal_amount:  90000,
  shipping_amount:  10000,
  distance_km:      2.5,
  payment_method:   'wallet',
}

async function main() {
  const { data: created } = await admin.auth.admin.createUser({
    email: TEST_USER_EMAIL,
    password: 'SeedTest@123!',
    email_confirm: true,
  })
  const userId = created.user!.id

  // We need enough balance for exactly tests that deduct: Test 1 (100k), Test 3 (100k), Test 8 (100k)
  await admin.from('wallets').upsert({ user_id: userId, balance: 1500000 }, { onConflict: 'user_id' })

  const specs = [
    { label: 'UNPAID_1', total_amount: 100000, status: 'Menunggu Pembayaran', payment_status: null, is_refunded: false },
    { label: 'UNPAID_2', total_amount: 100000, status: 'Menunggu Pembayaran', payment_status: null, is_refunded: false },
    { label: 'UNPAID_3', total_amount: 100000, status: 'Menunggu Pembayaran', payment_status: null, is_refunded: false },
    { label: 'UNPAID_4', total_amount: 100000, status: 'Menunggu Pembayaran', payment_status: null, is_refunded: false },
    { label: 'UNPAID_OVER', total_amount: 2000000, status: 'Menunggu Pembayaran', payment_status: null, is_refunded: false },
    { label: 'PAID', total_amount: 100000, status: 'Perlu Dikemas', payment_status: 'paid', is_refunded: false },
    { label: 'CANCELED_1', total_amount: 100000, status: 'Dibatalkan', payment_status: 'paid', is_refunded: false, canceled_by: 'user' },
    { label: 'CANCELED_2', total_amount: 100000, status: 'Dibatalkan', payment_status: 'paid', is_refunded: false, canceled_by: 'user' },
    { label: 'COMPLETED_1', total_amount: 100000, status: 'Selesai', payment_status: 'paid', is_refunded: true },
    { label: 'COMPLETED_2', total_amount: 100000, status: 'Selesai', payment_status: 'paid', is_refunded: true },
  ]

  const ids: Record<string, string> = {}
  for (const spec of specs) {
    const { label, ...restSpec } = spec;
    const row = { ...REQUIRED_ORDER_FIELDS, user_id: userId, ...restSpec }
    const { data, error } = await admin.from('orders').insert(row).select('id').single()
    if (error) {
      console.error(`Failed to insert order ${label}:`, error)
      process.exit(1)
    }
    ids[label] = data!.id
  }

  const content = [
    `NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}`,
    `SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}`,
    `TEST_USER_ID_A=${userId}`,
    ...Object.entries(ids).map(([k, v]) => `TEST_ORDER_${k}=${v}`)
  ].join('\n') + '\n'

  fs.writeFileSync(path.join(process.cwd(), '.env.test'), content, 'utf-8')
  console.log('Seed done.')
}
main()
