const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testWebhook(order_id) {
    const { data: topupReq, error: fetchError } = await supabase
        .from("user_topup_requests")
        .select("id, user_id, amount, status")
        .eq("midtrans_order_id", order_id)
        .maybeSingle();

    console.log("Fetch user_topup_requests:", { topupReq, fetchError });

    if (!topupReq) {
        console.log("Not found.");
        return;
    }

    const numericAmount = Number(topupReq.amount);
    console.log("numericAmount:", numericAmount);

    const { error: updateErr } = await supabase.rpc('increment_wallet_balance', {
        p_user_id: topupReq.user_id,
        p_amount: numericAmount
    });

    console.log("updateErr:", updateErr);

    const { error: ledgerErr } = await supabase.rpc('create_transaction', {
        p_user_id: topupReq.user_id,
        p_order_id: null,
        p_type: 'topup',
        p_amount: numericAmount,
        p_description: `Topup Saldo Wallet via Midtrans (${order_id})`
    });

    console.log("ledgerErr:", ledgerErr);
    
    if (ledgerErr) {
        console.log("LEDGER ERROR DETAILS:", JSON.stringify(ledgerErr, null, 2));
    }
}

testWebhook("USERTOPUP-984bb24b-1775523062010").catch(console.error);
