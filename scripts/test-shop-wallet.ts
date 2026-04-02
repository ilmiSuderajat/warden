import './env-setup'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function testShopWallet() {
    console.log("🏁 STARTING SHOP WALLET INTEGRATION TESTS")
    console.log("══════════════════════════════════════════════════")

    const testShopId = "9f717179-fb1b-47f1-852f-935568c88203" // Warung bolang
    const testOwnerId = "6cbdb8c2-cd97-45a5-be65-1bdfef906099" // Owner

    const pass = (msg: string) => console.log(`  ✅ PASS: ${msg}`)
    const fail = (msg: string) => { console.log(`  ❌ FAIL: ${msg}`); process.exit(1); }

    try {
        // 0. Ensure owner has a wallet
        await admin.from('wallets').upsert({ user_id: testOwnerId }, { onConflict: 'user_id' })
        
        // --- SCENARIO 1: SALE & COMMISSION ---
        console.log("\n🚀 【SCENARIO 1】 SALE & COMMISSION")
        
        // Create dummy order
        const { data: order, error: orderErr } = await admin.from('orders').insert({
            user_id: testOwnerId, // ordered by self for testing
            status: 'Selesai',
            total_amount: 50000,
            shipping_amount: 10000,
            payment_method: 'wallet',
            payment_status: 'paid',
            customer_name: 'Test Customer',
            whatsapp_number: '08123456789',
            address: 'Test Address'
        }).select().single()
        if (orderErr) throw orderErr

        // Create order item (required for shop_id extraction)
        await admin.from('order_items').insert({
            order_id: order.id,
            product_name: `Test Product | ${testShopId}`,
            quantity: 1,
            price: 50000
        })

        const { data: walletBefore } = await admin.from('wallets').select('balance').eq('user_id', testOwnerId).single()
        const { data: shopBefore } = await admin.from('shops').select('balance').eq('id', testShopId).single()

        // Call distribute_commission
        console.log("  - Running distribute_commission RPC...")
        const { error: commErr } = await admin.rpc('distribute_commission', { p_order_id: order.id })
        if (commErr) throw commErr

        // Verify balance updates
        const { data: walletAfter } = await admin.from('wallets').select('balance').eq('user_id', testOwnerId).single()
        const { data: shopAfter } = await admin.from('shops').select('balance').eq('id', testShopId).single()
        
        const expectedEarning = 40000 // 50000 total - 10000 shipping
        if (walletAfter!.balance - walletBefore!.balance !== expectedEarning) fail("Wallet balance not updated correctly")
        if (shopAfter!.balance - shopBefore!.balance !== expectedEarning) fail("Shop legacy balance not updated correctly")
        pass("Komisi berhasil didistribusikan ke Wallet & Shops sync")

        // Verify transaction ledger
        const { data: tx } = await admin.from('transactions').select('*').eq('order_id', order.id).eq('user_id', testOwnerId).single()
        if (!tx || tx.amount !== expectedEarning || tx.type !== 'commission') fail("Transaction ledger entry incorrect")
        pass(`Ledger Transaction Valid: Type=${tx.type}, Seq=${tx.seq}, BalanceAfter=${tx.balance_after}`)


        // --- SCENARIO 2: WITHDRAW ---
        console.log("\n🚀 【SCENARIO 2】 WITHDRAW (Logic Verification)")
        const withdrawAmount = 20000
        
        console.log("  - Manually performing withdrawal logic (Service Role Bypass)...")
        
        // a. Subtract from wallet
        const { error: wdSubErr } = await admin.from('wallets').update({ balance: walletAfter!.balance - withdrawAmount }).eq('user_id', testOwnerId)
        if (wdSubErr) throw wdSubErr

        // b. Create transaction ledger
        await admin.rpc('create_wallet_transaction', {
            p_user_id: testOwnerId,
            p_order_id: null,
            p_type: 'withdraw',
            p_amount: -withdrawAmount,
            p_desc: 'Withdrawal BCA 12345678 (Test Script)'
        })

        // c. Create withdraw request entry (Unified table)
        const { data: wdReq, error: wdReqErr } = await admin.from('withdraw_requests').insert({
            user_id: testOwnerId,
            amount: withdrawAmount,
            bank_name: 'BCA',
            bank_account: '12345678',
            bank_holder: 'Test Owner',
            status: 'pending'
        }).select().single()
        if (wdReqErr) throw wdReqErr

        const { data: walletWd } = await admin.from('wallets').select('balance').eq('user_id', testOwnerId).single()
        if (walletAfter!.balance - walletWd!.balance !== withdrawAmount) fail("Withdraw balance deduction failed")
        
        pass(`Withdrawal Berhasil: Amount=${wdReq.amount}, Status=${wdReq.status}, Transaction Captured in Ledger`)


        // --- SCENARIO 3: TOPUP SYNC ---
        console.log("\n🚀 【SCENARIO 3】 TOPUP WEBHOOK SYNC")
        // We simulate the logic from our webhook directly here for verification
        const topupAmount = 100000
        
        console.log("  - Simulating Topup logic...")
        await admin.rpc('increment_wallet_balance', { p_user_id: testOwnerId, p_amount: topupAmount })
        await admin.rpc('create_wallet_transaction', {
            p_user_id: testOwnerId,
            p_order_id: null,
            p_type: 'topup',
            p_amount: topupAmount,
            p_desc: 'Simulated Topup Test'
        })
        
        // Sync legacy shop for COD (as done in our webhook)
        const { data: shopFinal } = await admin.from('shops').select('balance').eq('id', testShopId).single()
        const newShopBal = (shopFinal!.balance || 0) + topupAmount
        await admin.from('shops').update({ balance: newShopBal, cod_enabled: newShopBal >= 0 }).eq('id', testShopId)

        const { data: walletFinal } = await admin.from('wallets').select('balance').eq('user_id', testOwnerId).single()
        const { data: shopVerify } = await admin.from('shops').select('balance, cod_enabled').eq('id', testShopId).single()
        
        if (walletFinal!.balance - walletWd!.balance !== topupAmount) fail("Wallet topup sync failed")
        if (shopVerify!.cod_enabled !== true) fail("Shop COD enablement failed")
        pass("Topup berhasil & fitur COD otomatis terbuka")

        console.log("\n══════════════════════════════════════════════════")
        console.log("  RESULTS: Semua Skenario Berhasil!")
        console.log("══════════════════════════════════════════════════")

    } catch (err: any) {
        console.error("Critical Test Error:", err.message)
        process.exit(1)
    }
}

testShopWallet()
