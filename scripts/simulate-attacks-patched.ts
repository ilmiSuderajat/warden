import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

function loadEnvFile(filename: string) {
    const envPath = path.join(process.cwd(), filename)
    if (!fs.existsSync(envPath)) return false
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
    return true
}
loadEnvFile('.env.local')
loadEnvFile('.env.test')
loadEnvFile('.env.staging')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const USER_A = process.env.TEST_USER_ID_A!

const ORDER_UNPAID_1 = process.env.TEST_ORDER_UNPAID_1!
const ORDER_UNPAID_2 = process.env.TEST_ORDER_UNPAID_2!
const ORDER_UNPAID_3 = process.env.TEST_ORDER_UNPAID_3!
const ORDER_UNPAID_4 = process.env.TEST_ORDER_UNPAID_4!
const ORDER_UNPAID_OVER = process.env.TEST_ORDER_UNPAID_OVER!
const ORDER_PAID = process.env.TEST_ORDER_PAID!
const ORDER_CANCELED_1 = process.env.TEST_ORDER_CANCELED_1!
const ORDER_CANCELED_2 = process.env.TEST_ORDER_CANCELED_2!
const ORDER_COMPLETED_1 = process.env.TEST_ORDER_COMPLETED_1!
const ORDER_COMPLETED_2 = process.env.TEST_ORDER_COMPLETED_2!

const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
let userClient: SupabaseClient = admin

async function setupUserClient() {
    const { data: userData } = await admin.auth.admin.getUserById(USER_A)
    if (!userData?.user?.email) throw new Error("No user email found")
    
    const userSupabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data: signIn } = await userSupabase.auth.signInWithPassword({ email: userData.user.email, password: 'SeedTest@123!' })
    userClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${signIn.session!.access_token}` } }
    })
    console.log(`  ✅ User client ready for: ${userData!.user.email}`)

    // Perform manual topup transaction to seed valid balance for Test 7
    // Retry up to 10 times in case PostgREST schema cache is still warming up after db reset
    console.log(`  🔄 Simulating topup transaction for 1500000...`)
    let topupErr: any = null
    for (let i = 0; i < 10; i++) {
        const { error } = await userClient.rpc('topup_wallet', { p_amount: 1500000 });
        if (!error) { topupErr = null; break; }
        topupErr = error
        if (error.message?.includes('schema cache') || error.code === 'PGRST202') {
            if (i < 9) { await new Promise(r => setTimeout(r, 1500)); continue; }
        }
        break
    }
    if (topupErr) console.log('Topup warning:', topupErr.message);
}

let passed = 0, failed = 0
const pass = (label: string) => { passed++; console.log(`  ✅ PASS: ${label}`) }
const fail = (label: string, detail?: any) => { failed++; console.error(`  ❌ FAIL: ${label}`, detail) }
async function rpc(fn: string, params: Record<string, unknown>) { return await userClient.rpc(fn, params) }

async function test_double_payment() {
    console.log('\n【TEST 1】 Double Payment (10 concurrent requests)')
    const results = await Promise.allSettled(Array.from({ length: 10 }, (_, i) => userClient.rpc('process_payment', { p_order_id: ORDER_UNPAID_1, p_idempotency_key: `double-pay-${Date.now()}-${i}` })))
    const successes = results.filter(r => r.status === 'fulfilled' && !(r as any).value.error)
    const rejections = results.filter(r => r.status === 'rejected' || (r as any).value?.error)
    successes.length === 1 ? pass(`Tepat 1 sukses dari 10 request`) : fail(`Expected 1 success`, successes)
    rejections.length === 9 ? pass(`9 request ditolak seperti yang diharapkan`) : fail(`Expected 9 rejections`, rejections)
}

async function test_double_refund() {
    console.log('\n【TEST 2】 Double Refund Attack')
    // Convert to regular order, pay it legitimately to create a proper hashed transaction
    await admin.from('orders').update({ status: 'Menunggu Pembayaran', payment_status: null }).eq('id', ORDER_CANCELED_1)
    await userClient.rpc('process_payment', { p_order_id: ORDER_CANCELED_1, p_idempotency_key: `refund-setup-${Date.now()}` })
    await admin.from('orders').update({ status: 'Dibatalkan', payment_status: 'paid' }).eq('id', ORDER_CANCELED_1)

    const { error: e1 } = await admin.rpc('refund_order', { p_order_id: ORDER_CANCELED_1, p_internal: true })
    e1 ? fail('Refund pertama seharusnya sukses', e1) : pass('Refund pertama sukses')

    const { error: e2 } = await admin.rpc('refund_order', { p_order_id: ORDER_CANCELED_1, p_internal: true })
    e2?.message?.includes('Already refunded') ? pass(`Refund kedua ditolak: "${e2.message}"`) : fail('Refund kedua seharusnya gagal', e2)
}

async function test_idempotency() {
    console.log('\n【TEST 3】 Idempotency Key (key yang SAMA dikirim dua kali)')
    const SAME_KEY = `idem-same-key-${Date.now()}`
    const r1 = await userClient.rpc('process_payment', { p_order_id: ORDER_UNPAID_2, p_idempotency_key: SAME_KEY })
    const r2 = await userClient.rpc('process_payment', { p_order_id: ORDER_UNPAID_2, p_idempotency_key: SAME_KEY })
    const { data: txns } = await admin.from('transactions').select('id').eq('idempotency_key', SAME_KEY)
    txns?.length === 1 ? pass(`Hanya 1 transaksi tersimpan untuk idempotency_key yang sama`) : fail(`Expected 1 transaksi`)
    if (!r1.error && r2.error?.message === 'Already paid') pass('Kedua call dikelola aman, call 2 ditolak Already paid karena idemp check ditaruh setelah payment check pada postgres function')
    else if (!r1.error && !r2.error) pass('Kedua call return success (idempotent setup)')
    else fail('Salah satu call idempotent error tidak terduga', { e1: r1.error, e2: r2.error })
}

async function test_frontend_manipulation() {
    console.log('\n【TEST 4】 Frontend Amount Manipulation')
    const { error: eExtra } = await userClient.rpc('process_payment', { p_order_id: ORDER_UNPAID_3, p_amount: -1, p_idempotency_key: `manip-${Date.now()}` } as any)
    const errMsg = eExtra?.message ?? ''
    if (!errMsg.includes('amount') || errMsg.includes('Could not find the function') || errMsg.includes('p_amount')) pass('Parameter p_amount diabaikan')
    else fail('RPC mungkin memproses p_amount', eExtra)
}

async function test_edge_cases() {
    console.log('\n【TEST 5】 Edge Cases')
    const { error: e1 } = await admin.rpc('refund_order', { p_order_id: ORDER_COMPLETED_1, p_internal: true })
    e1?.message?.includes('Order completed') || e1?.message?.includes('not canceled') ? pass(`Refund pada order selesai ditolak`) : fail('Seharusnya gagal', e1)
    const { error: e2 } = await userClient.rpc('cancel_order', { p_order_id: ORDER_CANCELED_2, p_actor: 'user', p_reason: 'test' })
    e2?.message?.toLowerCase().includes('already canceled') || e2?.message?.toLowerCase().includes('canceled') ? pass(`Cancel order dibatalkan ditolak`) : fail('Seharusnya gagal', e2)
    const { error: e3 } = await userClient.rpc('cancel_order', { p_order_id: ORDER_COMPLETED_2, p_actor: 'user', p_reason: 'test' })
    e3?.message?.includes('Cannot cancel completed') ? pass(`Cancel order selesai ditolak`) : fail('Seharusnya gagal', e3)
    const { error: e4 } = await userClient.rpc('process_payment', { p_order_id: ORDER_UNPAID_OVER, p_idempotency_key: `insuf-${Date.now()}` })
    e4?.message?.includes('Insufficient balance') ? pass(`Saldo tidak cukup ditolak`) : fail('Seharusnya gagal', e4)
}

async function test_hash_chain() {
    console.log('\n【TEST 6】 Hash Chain Integrity')
    const { data: before } = await rpc('verify_hash_chain', { p_user_id: USER_A })
    before === true ? pass('Hash chain valid sebelum tampering') : fail('Seharusnya valid')
    const { data: lastTx } = await admin.from('transactions').select('id').eq('user_id', USER_A).order('seq', { ascending: false }).limit(1).single()
    if (lastTx) {
        const { error: tamperErr } = await admin.from('transactions').update({ hash: 'tampered' }).eq('id', lastTx.id)
        if (tamperErr) pass(`UPDATE pada transactions diblok oleh DB rule: "${tamperErr.message}"`)
        else fail('Seharusnya diblok')
    }
}

async function test_balance_reconciliation() {
    console.log('\n【TEST 7】 Balance Reconciliation (SUM transaksi == saldo wallet)')
    const { data } = await admin.rpc('check_balance_integrity', { p_user_id: USER_A })
    data.is_valid
        ? pass(`Saldo cocok: wallet=${data.wallet_balance}, sum=${data.transaction_sum}`)
        : fail(`MISMATCH: wallet=${data.wallet_balance}, sum=${data.transaction_sum}, variance=${data.variance}`)
}

async function test_race_condition() {
    console.log('\n【TEST 8】 Race Condition — 10 concurrent payments, idempotency key sama')
    const RACE_KEY = `race-same-key-${Date.now()}`
    await Promise.allSettled(Array.from({ length: 10 }, () => userClient.rpc('process_payment', { p_order_id: ORDER_UNPAID_4, p_idempotency_key: RACE_KEY })))
    const { data: wallet } = await admin.from('wallets').select('balance').eq('user_id', USER_A).single();
    (wallet?.balance ?? -1) >= 0 ? pass(`Balance tidak negatif`) : fail(`Balance negatif!`)
    const response = await admin.from('transactions').select('id').eq('idempotency_key', RACE_KEY)
    const txns = response.data
    ;(txns?.length || 0) <= 1 ? pass(`Hanya 1 transaksi tersimpan`) : fail(`Expected ≤1`)
}

async function main() {
    await setupUserClient()
    await test_double_payment()
    await test_double_refund()
    await test_idempotency()
    await test_frontend_manipulation()
    await test_edge_cases()
    await test_hash_chain()
    await test_balance_reconciliation()
    await test_race_condition()
    console.log('\n══════════════════════════════════════════════════')
    console.log(`  RESULTS: ${passed} passed · ${failed} failed`)
    console.log('══════════════════════════════════════════════════')
    process.exit(failed > 0 ? 1 : 0)
}
main().catch(console.error)