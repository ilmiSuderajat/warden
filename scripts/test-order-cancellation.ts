import './env-setup'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function testCancellation() {
    console.log("🏁 STARTING ORDER CANCELLATION TESTS")
    console.log("══════════════════════════════════════════════════")

    const testUserId = "e56a035f-114e-4d34-bfb4-888168863d51" // Valid user in DB
    const testDriverId = "6cbdb8c2-cd97-45a5-be65-1bdfef906099" // Valid driver in DB
    const initialAmount = 100000

    const pass = (msg: string) => console.log(`  ✅ PASS: ${msg}`)
    const fail = (msg: string, err?: any) => {
        console.error(`  ❌ FAIL: ${msg}`, err || "")
        process.exit(1)
    }

    try {
        // Setup: Ensure wallet exists and has balance
        await admin.from('wallets').upsert({ user_id: testUserId, balance: initialAmount }).eq('user_id', testUserId)

        // SCENARIO 1: Early Cancellation (Mencari Kurir)
        console.log("\n🚀 【SCENARIO 1】 EARLY CANCELLATION (Status: Mencari Kurir)")
        
        // 1. Create order
        const { data: order1, error: order1Err } = await admin.from('orders').insert({
            user_id: testUserId,
            total_amount: 25000,
            status: 'Mencari Kurir',
            payment_method: 'wallet',
            payment_status: 'paid',
            customer_name: 'Test Customer 1',
            whatsapp_number: '08123456781',
            address: 'Alamat Test 1'
        }).select().single()

        if (order1Err || !order1) fail("Gagal membuat order 1", order1Err)

        // 2. Deduct initially (Simulation of payment)
        await admin.from('wallets').update({ balance: initialAmount - 25000 }).eq('user_id', testUserId)

        // 3. Cancel
        console.log("  - Step: Membatalkan pesanan via RPC...")
        const { error: cancel1Err } = await admin.rpc('cancel_order', {
            p_order_id: order1.id,
            p_actor: 'user',
            p_reason: 'Berubah pikiran'
        })
        if (cancel1Err) fail("Gagal membatalkan order 1", cancel1Err)

        // 4. Verify
        const { data: wallet1 } = await admin.from('wallets').select('balance').eq('user_id', testUserId).single()
        const { data: order1Final } = await admin.from('orders').select('status, is_refunded').eq('id', order1.id).single()

        if (order1Final?.status === 'Dibatalkan' && order1Final?.is_refunded === true && Number(wallet1?.balance) === initialAmount) {
            pass("Order dibatalkan, status 'Dibatalkan', Dana di-refund otomatis")
        } else {
            fail("Refund Scenario 1 Gagal!", { wallet: wallet1?.balance, status: order1Final?.status, refunded: order1Final?.is_refunded })
        }


        // SCENARIO 2: Mid-way Cancellation (Driver Accepted)
        console.log("\n🚀 【SCENARIO 2】 MID-WAY CANCELLATION (Status: Kurir Menuju Lokasi)")
        
        // 1. Create order
        const { data: order2, error: order2Err } = await admin.from('orders').insert({
            user_id: testUserId,
            total_amount: 30000,
            status: 'Kurir Menuju Lokasi',
            driver_id: testDriverId,
            payment_method: 'wallet',
            payment_status: 'paid',
            customer_name: 'Test Customer 2',
            whatsapp_number: '08123456782',
            address: 'Alamat Test 2'
        }).select().single()

        if (order2Err || !order2) fail("Gagal membuat order 2", order2Err)
        
        // Setup driver_orders
        await admin.from('driver_orders').insert({
            order_id: order2.id,
            driver_id: testDriverId,
            status: 'accepted'
        })

        // 2. Cancel
        console.log("  - Step: Membatalkan pesanan via RPC...")
        const { error: cancel2Err } = await admin.rpc('cancel_order', {
            p_order_id: order2.id,
            p_actor: 'user',
            p_reason: 'Batal karena kelamaan'
        })
        if (cancel2Err) fail("Gagal membatalkan order 2", cancel2Err)

        // 3. Verify driver status
        const { data: driverOrder2 } = await admin.from('driver_orders').select('status').eq('order_id', order2.id).single()
        if (driverOrder2?.status === 'expired') {
            pass("Status Driver di-reset menjadi 'expired'")
        } else {
            fail("Status Driver tidak di-reset!", driverOrder2?.status)
        }


        // SCENARIO 3: Illegal Cancellation (Status: Dikirim)
        console.log("\n🚀 【SCENARIO 3】 ILLEGAL CANCELLATION (Status: Dikirim)")
        
        // 1. Create order
        const { data: order3, error: order3Err } = await admin.from('orders').insert({
            user_id: testUserId,
            total_amount: 30000,
            status: 'Dikirim',
            payment_method: 'wallet',
            payment_status: 'paid',
            customer_name: 'Test Customer 3',
            whatsapp_number: '08123456789',
            address: 'Alamat Test 3'
        }).select().single()

        if (order3Err || !order3) fail("Gagal membuat order 3", order3Err)

        // 2. Attempt Cancel
        console.log("  - Step: Mencoba membatalkan (Expected Failure)...")
        const { error: cancel3Err } = await admin.rpc('cancel_order', {
            p_order_id: order3.id,
            p_actor: 'user',
            p_reason: 'Batal pas di jalan'
        })

        if (cancel3Err && cancel3Err.message.includes('tidak dapat dibatalkan')) {
            pass(`Sistem menolak pembatalan dengan benar: "${cancel3Err.message}"`)
        } else if (!cancel3Err) {
            fail("Order yang sedang dikirim berhasil dibatalkan (BUG!)")
        } else {
            fail("Error tidak terduga saat mencoba pembatalan ilegal", cancel3Err)
        }

        console.log("\n══════════════════════════════════════════════════")
        console.log("  RESULTS: Semua Skenario Berhasil!")
        console.log("══════════════════════════════════════════════════")

    } catch (e) {
        fail("Panic Exception!", e)
    }
}

testCancellation().catch(console.error)
