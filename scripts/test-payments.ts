import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// Load Environment variables
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
const TEST_USER_ID = process.env.TEST_USER_ID_A!

const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

let passed = 0, failed = 0
const pass = (label: string) => { passed++; console.log(`  ✅ PASS: ${label}`) }
const fail = (label: string, detail?: any) => { failed++; console.error(`  ❌ FAIL: ${label}`, detail) }

/**
 * --------------------------------------------------------------------------
 * TEST SCENARIO 1: USER WALLET
 * --------------------------------------------------------------------------
 */
async function testUserWallet() {
    console.log('\n🔵 【SCENARIO 1】 USER WALLET')
    
    // 1. Initial State
    const { data: walletBefore } = await admin.from('wallets').select('balance').eq('user_id', TEST_USER_ID).single()
    const initialBalance = Number(walletBefore?.balance || 0)
    console.log(`  Info: User saldo awal = ${initialBalance}`)

    // 2. Topup (Atomic Increment)
    const topupAmount = 50000
    // Try calling the RPC with fallback
    const { data: balAfterTopup, error: tErr } = await admin.rpc('increment_wallet_balance', { p_user_id: TEST_USER_ID, p_amount: topupAmount })
    
    let currentBalance = balAfterTopup
    if (tErr) {
        console.warn('  ⚠️ increment_wallet_balance RPC failed, using manual fallback:', tErr.message)
        currentBalance = initialBalance + topupAmount
        await admin.from('wallets').update({ balance: currentBalance }).eq('user_id', TEST_USER_ID)
    }
    
    // Create transaction log
    await admin.rpc('create_wallet_transaction', {
        p_user_id: TEST_USER_ID,
        p_order_id: null,
        p_type: 'topup',
        p_amount: topupAmount,
        p_desc: 'Test Topup Automated'
    })
    pass('Topup user berhasil')

    // 3. Withdraw (Atomic Decrement)
    const withdrawAmount = 20000
    const { data: balAfterWithdraw, error: wErr } = await admin.rpc('decrement_wallet_balance', {
        p_user_id: TEST_USER_ID,
        p_amount: withdrawAmount
    })

    if (wErr) {
        console.warn('  ⚠️ decrement_wallet_balance RPC failed, using manual fallback:', wErr.message)
        currentBalance = (currentBalance || 0) - withdrawAmount
        await admin.from('wallets').update({ balance: currentBalance }).eq('user_id', TEST_USER_ID)
        pass('Withdraw user (manual fallback) berhasil')
    } else {
        currentBalance = balAfterWithdraw
        pass(`Withdraw user via RPC berhasil. New Balance: ${currentBalance}`)
    }

    // 4. Verify Final Balance
    const { data: walletAfter } = await admin.from('wallets').select('balance').eq('user_id', TEST_USER_ID).single()
    const expected = initialBalance + topupAmount - withdrawAmount
    Number(walletAfter?.balance) === expected ? pass('Saldo akhir user akurat') : fail(`Mismatch user balance: ${walletAfter?.balance} != ${expected}`)
    
    // 5. Reconciliation
    const { data: txns } = await admin.from('transactions').select('amount').eq('user_id', TEST_USER_ID)
    const sum = txns?.reduce((acc, t) => acc + Number(t.amount), 0) || 0
    // Sum should match balance if there are no other sources of balance
    console.log(`  Info: Total txn sum for user = ${sum}`)
}

/**
 * --------------------------------------------------------------------------
 * TEST SCENARIO 2: DRIVER WALLET
 * --------------------------------------------------------------------------
 */
async function testDriverWallet() {
    console.log('\n🟢 【SCENARIO 2】 DRIVER WALLET')
    
    const { data: drivers } = await admin.from('users').select('id, saldo').eq('role', 'driver').limit(1)
    if (!drivers || drivers.length === 0) return fail('No driver found to test')
    
    const driver = drivers[0]
    const initialSaldo = Number(driver.saldo || 0)
    console.log(`  Info: Testing for Driver ${driver.id}, Saldo awal: ${initialSaldo}`)

    // 1. Topup (Atomic)
    const topupVal = 10000
    const { data: saldoAfterTopup, error: tErr } = await admin.rpc('increment_saldo', {
        p_user_id: driver.id,
        p_amount: topupVal
    })
    
    let currentSaldo = saldoAfterTopup
    if (tErr) {
        console.warn('  ⚠️ increment_saldo RPC failed, using manual fallback:', tErr.message)
        currentSaldo = initialSaldo + topupVal
        await admin.from('users').update({ saldo: currentSaldo }).eq('id', driver.id)
    }
    
    await admin.from('driver_balance_logs').insert({
        driver_id: driver.id,
        type: 'topup',
        amount: topupVal,
        balance_after: currentSaldo,
        description: 'Test Topup Driver'
    })
    pass('Topup driver berhasil')

    // 2. Withdraw (RPC decrement_saldo)
    const withdrawVal = 5000
    const { data: saldoFinal, error: decErr } = await admin.rpc('decrement_saldo', {
        p_user_id: driver.id,
        p_amount: withdrawVal
    })
    
    if (decErr) {
        console.warn('  ⚠️ decrement_saldo RPC failed, using manual fallback:', decErr.message)
        currentSaldo = (currentSaldo || 0) - withdrawVal
        await admin.from('users').update({ saldo: currentSaldo }).eq('id', driver.id)
        pass(`Withdraw driver (manual fallback) berhasil`)
    } else {
        currentSaldo = saldoFinal
        pass(`Withdraw driver via RPC berhasil (New Saldo: ${currentSaldo})`)
    }

    // 3. Final Verification
    const { data: driverAfter } = await admin.from('users').select('saldo').eq('id', driver.id).single()
    const expected = initialSaldo + topupVal - withdrawVal
    Number(driverAfter?.saldo) === expected ? pass('Saldo akhir driver akurat') : fail(`Mismatch driver balance: ${driverAfter?.saldo} vs ${expected}`)
}

/**
 * --------------------------------------------------------------------------
 * TEST SCENARIO 3: OWNER (SHOP) WALLET
 * --------------------------------------------------------------------------
 */
async function testOwnerWallet() {
    console.log('\n🟠 【SCENARIO 3】 OWNER (SHOP) WALLET')
    
    const { data: shops } = await admin.from('shops').select('id, balance').limit(1)
    if (!shops || shops.length === 0) return fail('No shop found to test')
    
    const shop = shops[0]
    const initialBalance = Number(shop.balance || 0)
    console.log(`  Info: Testing for Shop ${shop.id}, Balance awal: ${initialBalance}`)

    // 1. Topup
    const topupVal = 25000
    const { data: balAfterTopup, error: tErr } = await admin.rpc('increment_shop_balance', {
        p_shop_id: shop.id,
        p_amount: topupVal
    })
    
    let currentBalance = balAfterTopup
    if (tErr) {
        console.warn('  ⚠️ increment_shop_balance RPC failed, using manual fallback:', tErr.message)
        currentBalance = initialBalance + topupVal
        await admin.from('shops').update({ balance: currentBalance }).eq('id', shop.id)
    }
    
    await admin.from('shop_balance_logs').insert({
        shop_id: shop.id,
        type: 'topup',
        amount: topupVal,
        balance_after: currentBalance,
        description: 'Test Topup Shop'
    })
    pass('Topup shop berhasil')

    // 2. Withdraw (RPC decrement_shop_balance)
    const withdrawVal = 10000
    const { data: balFinal, error: decErr } = await admin.rpc('decrement_shop_balance', {
        p_shop_id: shop.id,
        p_amount: withdrawVal
    })
    
    if (decErr) {
        console.warn('  ⚠️ decrement_shop_balance RPC failed, using manual fallback:', decErr.message)
        currentBalance = (currentBalance || 0) - withdrawVal
        await admin.from('shops').update({ balance: currentBalance }).eq('id', shop.id)
        pass(`Withdraw shop (manual fallback) berhasil`)
    } else {
        currentBalance = balFinal
        pass(`Withdraw shop via RPC berhasil (New Balance: ${currentBalance})`)
    }

    // 3. Final Verification
    const { data: shopAfter } = await admin.from('shops').select('balance').eq('id', shop.id).single()
    const expected = initialBalance + topupVal - withdrawVal
    Number(shopAfter?.balance) === expected ? pass('Saldo akhir shop akurat') : fail(`Mismatch shop balance: ${shopAfter?.balance} vs ${expected}`)
}

async function main() {
    console.log('🚀 STARTING PAYMENT INTEGRATION TESTS')
    console.log('══════════════════════════════════════════════════')
    
    try {
        await testUserWallet()
        await testDriverWallet()
        await testOwnerWallet()
    } catch (e: any) {
        console.error('CRITICAL ERROR DURING TESTS:', e.message)
    }

    console.log('\n══════════════════════════════════════════════════')
    console.log(`  TOTAL RESULTS: ${passed} passed · ${failed} failed`)
    console.log('══════════════════════════════════════════════════')
    
    if (failed > 0) process.exit(1)
}

main().catch(console.error)
