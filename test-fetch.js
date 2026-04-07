const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf-8') || fs.readFileSync('.env', 'utf-8');
const SUPABASE_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const SERVICE_KEY = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim();

async function run() {
    const fetch = require('node-fetch'); 
    
    // 1. increment_wallet_balance
    const url1 = SUPABASE_URL + '/rest/v1/rpc/increment_wallet_balance';
    const res1 = await globalThis.fetch(url1, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SERVICE_KEY,
            'Authorization': 'Bearer ' + SERVICE_KEY,
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({
            p_user_id: '984bb24b-2353-42f6-a25c-cf88746efc8c',
            p_amount: 50000
        })
    });
    console.log('increment_wallet_balance:', res1.status, await res1.text());

    // 2. create_transaction
    const url2 = SUPABASE_URL + '/rest/v1/rpc/create_transaction';
    const res2 = await globalThis.fetch(url2, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SERVICE_KEY,
            'Authorization': 'Bearer ' + SERVICE_KEY,
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({
            p_user_id: '984bb24b-2353-42f6-a25c-cf88746efc8c',
            p_order_id: null,
            p_type: 'topup',
            p_amount: 50000,
            p_description: `Topup Saldo Wallet via Midtrans test`
        })
    });
    console.log('create_transaction:', res2.status, await res2.text());
}
run().catch(console.error);
