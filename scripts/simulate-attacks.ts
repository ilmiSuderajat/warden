/**
 * ============================================================
 * Wallet System — Full Security Audit Test Suite (PATCHED)
 * ============================================================
 * Patches applied vs original:
 *   [P1] Test 3 idempotency: gunakan key yang SAMA di kedua call,
 *        bukan key berbeda — test sebelumnya tidak benar-benar menguji idempotency
 *   [P2] Test 5d insufficient balance: hindari direct .update() pada wallets
 *        (bypass CHECK constraint); gunakan RPC topup negatif atau seed data
 *        dengan balance 0 dari awal
 *   [P3] Test 8 race condition: tiap request pakai key yang sama supaya
 *        idempotency + FOR UPDATE lock benar-benar diuji bersama
 *
 * Prerequisites:
 *   1. Apply 20260329_user_wallet_refunds_patched.sql
 *   2. Set env vars (lihat bagian REQUIRED ENV VARS di bawah)
 *   3. Seed data: USER_A harus punya wallet dengan balance cukup untuk 1 order
 *
 * Usage:
 *   npx tsx scripts/simulate-attacks.ts
 * ============================================================
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ──────────────────────────────────────────────────────────────
// REQUIRED ENV VARS
// ──────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const USER_A = process.env.TEST_USER_ID_A!           // user dengan wallet balance > 0
const ORDER_UNPAID = process.env.TEST_ORDER_ID_UNPAID!     // order milik USER_A, belum dibayar
const ORDER_PAID = process.env.TEST_ORDER_ID_PAID!       // order milik USER_A, sudah paid
const ORDER_CANCELED = process.env.TEST_ORDER_ID_CANCELED!   // status=Dibatalkan, is_refunded=FALSE
const ORDER_COMPLETED = process.env.TEST_ORDER_ID_COMPLETED!  // status=Selesai

const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
})

// ──────────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────────
let passed = 0
let failed = 0

const pass = (label: string) => { passed++; console.log(`  ✅ PASS: ${label}`) }
const fail = (label: string, detail?: any) => { failed++; console.error(`  ❌ FAIL: ${label}`, detail ?? '') }

async function rpc(fn: string, params: Record<string, unknown>) {
    const { data, error } = await admin.rpc(fn, params)
    return { data, error }
}

/**
 * Seed helper: reset ORDER_UNPAID ke unpaid dan USER_A wallet ke balance awal.
 * Dipanggil sebelum test yang perlu state bersih.
 * Menggunakan service_role (bypass RLS) — staging only.
 */
async function resetTestState(walletBalance: number) {
    await admin.from('wallets')
        .upsert({ user_id: USER_A, balance: walletBalance }, { onConflict: 'user_id' })
    await admin.from('orders')
        .update({ payment_status: null, status: 'Menunggu Pembayaran', is_refunded: false })
        .eq('id', ORDER_UNPAID)
    await admin.from('transactions')
        .delete()
        .eq('order_id', ORDER_UNPAID)
}

// ──────────────────────────────────────────────────────────────
// TEST 1: Double Payment — 10 concurrent requests
// Hanya 1 yang boleh sukses; sisanya harus throw 'Already paid'
// ──────────────────────────────────────────────────────────────
async function test_double_payment() {
    console.log('\n【TEST 1】 Double Payment (10 concurrent requests)')

    // Tiap request pakai idempotency key berbeda agar UNIQUE(order_id,type)
    // yang menjadi garda terdepan, bukan idempotency_key
    const results = await Promise.allSettled(
        Array.from({ length: 10 }, (_, i) =>
            admin.rpc('process_payment', {
                p_order_id: ORDER_UNPAID,
                p_idempotency_key: `double-pay-${Date.now()}-${i}`,
            })
        )
    )

    const successes = results.filter(r => r.status === 'fulfilled' && !(r as any).value.error)
    const rejections = results.filter(r => r.status === 'rejected' || (r as any).value?.error)

    successes.length === 1
        ? pass(`Tepat 1 sukses dari 10 request (got ${successes.length})`)
        : fail(`Expected 1 success, got ${successes.length}`)

    rejections.length === 9
        ? pass(`9 request ditolak seperti yang diharapkan`)
        : fail(`Expected 9 rejections, got ${rejections.length}`)

    const { data: wallet } = await admin.from('wallets').select('balance').eq('user_id', USER_A).single()
    console.log(`  ℹ️  Wallet balance setelah serangan: ${wallet?.balance}`)
}

// ──────────────────────────────────────────────────────────────
// TEST 2: Double Refund
// ──────────────────────────────────────────────────────────────
async function test_double_refund() {
    console.log('\n【TEST 2】 Double Refund Attack')

    const { error: e1 } = await rpc('refund_order', { p_order_id: ORDER_CANCELED, p_internal: true })
    e1
        ? fail('Refund pertama seharusnya sukses', e1.message)
        : pass('Refund pertama sukses')

    const { error: e2 } = await rpc('refund_order', { p_order_id: ORDER_CANCELED, p_internal: true })
    e2?.message?.includes('Already refunded')
        ? pass(`Refund kedua ditolak dengan benar: "${e2.message}"`)
        : fail('Refund kedua seharusnya raise Already refunded', e2)
}

// ──────────────────────────────────────────────────────────────
// [P1] TEST 3: Idempotency — key yang SAMA dipakai dua kali
// Kedua call harus return success; hanya 1 row transaksi yang boleh ada
// ──────────────────────────────────────────────────────────────
async function test_idempotency() {
    console.log('\n【TEST 3】 Idempotency Key (key yang SAMA dikirim dua kali)')

    // Reset state dulu agar ORDER_UNPAID belum dibayar
    await resetTestState(999999)

    // [P1 FIX] Gunakan key yang IDENTIK di kedua call
    const SAME_KEY = `idem-same-key-${Date.now()}`

    const r1 = await admin.rpc('process_payment', {
        p_order_id: ORDER_UNPAID,
        p_idempotency_key: SAME_KEY,
    })
    const r2 = await admin.rpc('process_payment', {
        p_order_id: ORDER_UNPAID,
        p_idempotency_key: SAME_KEY,   // ← key sama persis
    })

    // Hanya 1 transaksi yang boleh tersimpan di DB
    const { data: txns } = await admin
        .from('transactions')
        .select('id')
        .eq('idempotency_key', SAME_KEY)

    const count = txns?.length ?? 0
    count === 1
        ? pass(`Hanya 1 transaksi tersimpan untuk idempotency_key yang sama (count=${count})`)
        : fail(`Expected 1 transaksi, got ${count}`)

    !r1.error && !r2.error
        ? pass('Kedua call return success (idempotent)')
        : fail('Salah satu call idempotent error tidak terduga', { e1: r1.error, e2: r2.error })
}

// ──────────────────────────────────────────────────────────────
// TEST 4: Frontend Amount Manipulation
// process_payment tidak menerima parameter amount dari client —
// amount selalu diambil dari orders.total_amount di DB
// ──────────────────────────────────────────────────────────────
async function test_frontend_manipulation() {
    console.log('\n【TEST 4】 Frontend Amount Manipulation')

    const { data: order } = await admin
        .from('orders').select('total_amount').eq('id', ORDER_PAID).single()
    const { data: txns } = await admin
        .from('transactions').select('amount').eq('order_id', ORDER_PAID).eq('type', 'payment')

    if (txns && txns.length > 0) {
        const storedAmt = Math.abs(txns[0].amount)
        storedAmt === order?.total_amount
            ? pass(`Amount di transaksi (${storedAmt}) = DB order total (${order.total_amount}) — tidak bisa diinjeksi dari client`)
            : fail(`Amount mismatch: stored=${storedAmt}, db_total=${order?.total_amount}`)
    } else {
        console.log('  ℹ️  Tidak ada transaksi payment untuk ORDER_PAID — skip amount check')
    }

    // Verifikasi tambahan: signature RPC tidak punya parameter p_amount
    // Jika kita coba kirim p_amount, Postgres akan ignore (unknown param)
    const { error: eExtra } = await admin.rpc('process_payment', {
        p_order_id: ORDER_UNPAID,
        p_amount: -1,          // parameter asing — harus diabaikan
        p_idempotency_key: `manip-${Date.now()}`,
    } as any)

    // Error boleh muncul (order sudah paid / insufficient), tapi bukan karena p_amount diterima
    const errMsg = eExtra?.message ?? ''
    !errMsg.includes('amount')
        ? pass('Parameter p_amount diabaikan oleh RPC (tidak ada error terkait amount injection)')
        : fail('RPC mungkin memproses p_amount dari client', eExtra)
}

// ──────────────────────────────────────────────────────────────
// TEST 5: Edge Cases
// ──────────────────────────────────────────────────────────────
async function test_edge_cases() {
    console.log('\n【TEST 5】 Edge Cases')

    // 5a: Refund pada order selesai harus gagal
    const { error: e1 } = await rpc('refund_order', { p_order_id: ORDER_COMPLETED, p_internal: true })
    e1?.message?.includes('Order completed') || e1?.message?.includes('not canceled')
        ? pass(`Refund pada order selesai ditolak: "${e1.message}"`)
        : fail('Refund pada order selesai seharusnya gagal', e1)

    // 5b: Cancel order yang sudah dibatalkan
    const { error: e2 } = await rpc('cancel_order', {
        p_order_id: ORDER_CANCELED, p_actor: 'user', p_reason: 'test'
    })
    e2?.message?.toLowerCase().includes('already canceled') || e2?.message?.toLowerCase().includes('canceled')
        ? pass(`Cancel order yang sudah dibatalkan ditolak: "${e2.message}"`)
        : fail('Cancel order yang sudah dibatalkan seharusnya gagal', e2)

    // 5c: Cancel order selesai
    const { error: e3 } = await rpc('cancel_order', {
        p_order_id: ORDER_COMPLETED, p_actor: 'user', p_reason: 'test'
    })
    e3?.message?.includes('Cannot cancel completed')
        ? pass(`Cancel order selesai ditolak: "${e3.message}"`)
        : fail('Cancel order selesai seharusnya gagal', e3)

    // [P2 FIX] 5d: Insufficient balance
    // Alih-alih direct .update() yang bisa konflik dengan CHECK constraint,
    // kita seed order baru dengan total_amount jauh di atas saldo user,
    // atau gunakan order yang kita tahu saldonya tidak cukup.
    // Di sini: reset balance ke 1 dan coba bayar order dengan total > 1
    const { data: targetOrder } = await admin
        .from('orders').select('total_amount').eq('id', ORDER_UNPAID).single()

    if (targetOrder && targetOrder.total_amount > 1) {
        // Set balance ke nilai yang pasti tidak cukup
        await admin.from('wallets')
            .upsert({ user_id: USER_A, balance: 1 }, { onConflict: 'user_id' })

        // Reset order ke unpaid dulu
        await admin.from('orders')
            .update({ payment_status: null, status: 'Menunggu Pembayaran' })
            .eq('id', ORDER_UNPAID)

        const { error: e4 } = await rpc('process_payment', {
            p_order_id: ORDER_UNPAID,
            p_idempotency_key: `insuf-${Date.now()}`
        })
        e4?.message?.includes('Insufficient balance')
            ? pass(`Saldo tidak cukup ditolak: "${e4.message}"`)
            : fail('Pembayaran dengan saldo tidak cukup seharusnya gagal', e4)
    } else {
        console.log('  ℹ️  total_amount order <= 1, skip insufficient balance test')
    }

    // Restore balance untuk test selanjutnya
    await admin.from('wallets')
        .upsert({ user_id: USER_A, balance: 999999 }, { onConflict: 'user_id' })
}

// ──────────────────────────────────────────────────────────────
// TEST 6: Hash Chain Integrity
// ──────────────────────────────────────────────────────────────
async function test_hash_chain() {
    console.log('\n【TEST 6】 Hash Chain Integrity')

    const { data: before, error: e1 } = await rpc('verify_hash_chain', { p_user_id: USER_A })
    before === true
        ? pass('Hash chain valid sebelum tampering')
        : fail('Hash chain seharusnya valid sebelum tamper', e1)

    const { data: lastTx } = await admin
        .from('transactions')
        .select('id, hash')
        .eq('user_id', USER_A)
        .order('seq', { ascending: false })
        .limit(1)
        .single()

    if (lastTx) {
        const { error: tamperErr } = await admin
            .from('transactions')
            .update({ hash: 'tampered_hash_000' })
            .eq('id', lastTx.id)

        if (tamperErr) {
            // Rule transactions_no_update memblok ini — ini justru PASS terkuat
            pass(`UPDATE pada transactions diblok oleh DB rule: "${tamperErr.message}"`)
        } else {
            // Jika update tembus (staging tanpa rule), verifikasi chain harus fail
            const { data: after } = await rpc('verify_hash_chain', { p_user_id: USER_A })
            after === false
                ? pass('verify_hash_chain mendeteksi tampering dengan benar')
                : fail('Hash chain seharusnya gagal setelah tamper')

            const { data: violations } = await admin
                .from('audit_log')
                .select('*')
                .eq('action', 'hash_chain_violation')
                .eq('target_id', lastTx.id)

            violations && violations.length > 0
                ? pass('hash_chain_violation tercatat di audit_log')
                : fail('Tidak ada hash_chain_violation di audit_log')
        }
    } else {
        console.log('  ℹ️  Tidak ada transaksi untuk USER_A — skip tamper test')
    }
}

// ──────────────────────────────────────────────────────────────
// TEST 7: Balance Reconciliation
// ──────────────────────────────────────────────────────────────
async function test_balance_reconciliation() {
    console.log('\n【TEST 7】 Balance Reconciliation (SUM transaksi == saldo wallet)')

    const { data, error } = await rpc('check_balance_integrity', { p_user_id: USER_A })
    if (error) { fail('check_balance_integrity RPC gagal', error.message); return }

    data.is_valid
        ? pass(`Saldo cocok: wallet=${data.wallet_balance}, sum_txns=${data.transaction_sum}`)
        : fail(`MISMATCH: wallet=${data.wallet_balance}, sum_txns=${data.transaction_sum}, variance=${data.variance}`)
}

// ──────────────────────────────────────────────────────────────
// [P3] TEST 8: Race Condition — 10 concurrent payments, key SAMA
// Menguji: idempotency + FOR UPDATE lock bekerja bersama
// Balance harus tidak pernah negatif; hanya 1 deduction yang boleh terjadi
// ──────────────────────────────────────────────────────────────
async function test_race_condition() {
    console.log('\n【TEST 8】 Race Condition — 10 concurrent payments, idempotency key sama')

    await resetTestState(999999)

    // [P3 FIX] Semua 10 request pakai key yang SAMA
    // Ini menguji apakah idempotency + lock mencegah double-deduction
    const RACE_KEY = `race-same-key-${Date.now()}`

    const results = await Promise.allSettled(
        Array.from({ length: 10 }, () =>
            admin.rpc('process_payment', {
                p_order_id: ORDER_UNPAID,
                p_idempotency_key: RACE_KEY,
            })
        )
    )

    const { data: wallet } = await admin
        .from('wallets').select('balance').eq('user_id', USER_A).single()

        ; (wallet?.balance ?? -1) >= 0
            ? pass(`Balance tidak negatif setelah concurrent attack: ${wallet?.balance}`)
            : fail(`Balance negatif! balance=${wallet?.balance}`)

    // Verifikasi: hanya 1 row transaksi dengan key ini
    const { data: txns } = await admin
        .from('transactions').select('id').eq('idempotency_key', RACE_KEY)

    const txCount = txns?.length ?? 0
    txCount <= 1
        ? pass(`Hanya ${txCount} transaksi tersimpan dari 10 concurrent request`)
        : fail(`Expected ≤1 transaksi, got ${txCount} — ada double-deduction!`)

    const successes = results.filter(r => r.status === 'fulfilled' && !(r as any).value.error)
    console.log(`  ℹ️  ${successes.length}/10 call return success`)
}

// ──────────────────────────────────────────────────────────────
// RUNNER
// ──────────────────────────────────────────────────────────────
async function main() {
    const allEnvs = [SUPABASE_URL, SERVICE_ROLE_KEY, USER_A, ORDER_UNPAID, ORDER_PAID, ORDER_CANCELED, ORDER_COMPLETED]
    if (allEnvs.some(v => !v)) {
        console.error('❌ Missing required environment variables.')
        console.error('Set: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,')
        console.error('     TEST_USER_ID_A, TEST_ORDER_ID_UNPAID, TEST_ORDER_ID_PAID,')
        console.error('     TEST_ORDER_ID_CANCELED, TEST_ORDER_ID_COMPLETED')
        process.exit(1)
    }

    console.log('╔══════════════════════════════════════════════════╗')
    console.log('║   WALLET SYSTEM — FINAL AUDIT TEST SUITE v2     ║')
    console.log('╚══════════════════════════════════════════════════╝')

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

main().catch(err => {
    console.error('Fatal error:', err)
    process.exit(1)
})